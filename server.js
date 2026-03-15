const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const webPush = require('web-push');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Настройка VAPID для push-уведомлений
webPush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:example@yourdomain.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Настройка multer для загрузки файлов (изображения и видео)
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
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50 МБ
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Эндпоинт для загрузки файлов
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не отправлен' });
  }
  res.json({ url: `/uploads/${req.file.filename}` });
});

// Эндпоинт для сохранения push-подписки
app.post('/api/subscribe', (req, res) => {
  const { userId, subscription } = req.body;
  if (!userId || !subscription) {
    return res.status(400).json({ error: 'Missing data' });
  }
  pushSubscriptions.set(userId, subscription);
  console.log(`Push subscription saved for user ${userId}`);
  res.json({ ok: true });
});

// Хранилища
const users = new Map();               // userId -> { id, name, socketId }
const offlineMessages = new Map();      // userId -> [сообщения]
const pushSubscriptions = new Map();    // userId -> subscription

io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);

  socket.on('join', ({ name, userId }) => {
    if (!userId) userId = generateId();

    if (users.has(userId)) {
      const existing = users.get(userId);
      if (existing.socketId && existing.socketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(existing.socketId);
        if (oldSocket) {
          oldSocket.emit('kicked', { message: 'Вы вошли с другого устройства', userId: existing.id });
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

    // Отправляем офлайн-сообщения, если есть
    if (offlineMessages.has(userId)) {
      const messages = offlineMessages.get(userId);
      messages.forEach(msg => socket.emit('private message', msg));
      offlineMessages.delete(userId);
    }

    broadcastUserList();
  });

  socket.on('private message', ({ to, text, imageUrl }) => {
    const fromUser = Array.from(users.values()).find(u => u.socketId === socket.id);
    if (!fromUser) return;

    const message = {
      from: fromUser.id,
      fromName: fromUser.name,
      to: to,
      text,
      imageUrl,
      timestamp: Date.now()
    };

    const recipient = users.get(to);
    if (recipient && recipient.socketId) {
      // Получатель онлайн
      const toSocket = io.sockets.sockets.get(recipient.socketId);
      if (toSocket) toSocket.emit('private message', message);
    } else {
      // Получатель офлайн – сохраняем
      if (!offlineMessages.has(to)) offlineMessages.set(to, []);
      offlineMessages.get(to).push(message);

      // Пытаемся отправить push-уведомление
      const subscription = pushSubscriptions.get(to);
      if (subscription) {
        const payload = JSON.stringify({
          title: `Новое сообщение от ${fromUser.name}`,
          body: text || (imageUrl ? (imageUrl.match(/\.(mp4|webm|ogg|mov)$/i) ? '🎥 Видео' : '📷 Изображение') : ''),
          url: '/',
          senderId: fromUser.id
        });
        webPush.sendNotification(subscription, payload)
          .then(() => console.log(`Push sent to ${to}`))
          .catch(err => {
            console.error('Push error:', err);
            if (err.statusCode === 410) pushSubscriptions.delete(to); // подписка устарела
          });
      }
    }

    // Отправляем подтверждение отправителю
    socket.emit('private message', message);
  });

  socket.on('typing', ({ to }) => {
    const fromUser = Array.from(users.values()).find(u => u.socketId === socket.id);
    if (!fromUser) return;
    const recipient = users.get(to);
    if (recipient && recipient.socketId) {
      const toSocket = io.sockets.sockets.get(recipient.socketId);
      if (toSocket) toSocket.emit('typing', { from: fromUser.id, fromName: fromUser.name });
    }
  });

  socket.on('stop typing', ({ to }) => {
    const fromUser = Array.from(users.values()).find(u => u.socketId === socket.id);
    if (!fromUser) return;
    const recipient = users.get(to);
    if (recipient && recipient.socketId) {
      const toSocket = io.sockets.sockets.get(recipient.socketId);
      if (toSocket) toSocket.emit('stop typing', { from: fromUser.id });
    }
  });

  socket.on('clear chat', ({ peerId }) => {
    const fromUser = Array.from(users.values()).find(u => u.socketId === socket.id);
    if (!fromUser) return;
    const recipient = users.get(peerId);
    if (recipient && recipient.socketId) {
      const toSocket = io.sockets.sockets.get(recipient.socketId);
      if (toSocket) toSocket.emit('chat cleared', { peerId: fromUser.id });
    }
    socket.emit('chat cleared', { peerId });
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