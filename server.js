const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Настройка multer для загрузки изображений
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Эндпоинт для загрузки изображений
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не отправлен' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// Хранилище пользователей
const users = new Map();

io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);

  socket.on('join', ({ name, userId }) => {
    if (!userId) {
      userId = generateId();
    }

    if (users.has(userId)) {
      const existing = users.get(userId);
      if (existing.socketId && existing.socketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(existing.socketId);
        if (oldSocket) {
          oldSocket.emit('kicked', { message: 'Вы вошли с другого устройства или перезагрузили страницу', userId: existing.id });
          oldSocket.disconnect(true);
        }
      }
      existing.name = name;
      existing.socketId = socket.id;
      users.set(userId, existing);
    } else {
      users.set(userId, { id: userId, name, socketId: socket.id });
    }

    socket.emit('joined', { id: userId, name });
    broadcastUserList();
  });

  socket.on('private message', ({ to, text, imageUrl }) => {
    let fromUser = null;
    for (let user of users.values()) {
      if (user.socketId === socket.id) {
        fromUser = user;
        break;
      }
    }
    if (!fromUser) return;

    const recipient = users.get(to);
    if (recipient && recipient.socketId) {
      const toSocket = io.sockets.sockets.get(recipient.socketId);
      if (toSocket) {
        toSocket.emit('private message', {
          from: fromUser.id,
          fromName: fromUser.name,
          to: recipient.id,
          text,
          imageUrl,
        });
      }
    }
    socket.emit('private message', {
      from: fromUser.id,
      fromName: fromUser.name,
      to: to,
      text,
      imageUrl,
    });
  });

  socket.on('disconnect', () => {
    for (let [userId, user] of users.entries()) {
      if (user.socketId === socket.id) {
        users.delete(userId);
        break;
      }
    }
    broadcastUserList();
  });
});

function broadcastUserList() {
  const userList = Array.from(users.values()).map(({ id, name }) => ({ id, name }));
  io.emit('user list', userList);
}

function generateId() {
  return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});