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

webPush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:example@yourdomain.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не отправлен' });
  res.json({
    url: `/uploads/${req.file.filename}`,
    mimetype: req.file.mimetype,
    originalname: req.file.originalname
  });
});

app.post('/api/subscribe', (req, res) => {
  const { userId, subscription } = req.body;
  if (!userId || !subscription) return res.status(400).json({ error: 'Missing data' });
  pushSubscriptions.set(userId, subscription);
  res.json({ ok: true });
});

const users = new Map();
const offlineMessages = new Map();
const pushSubscriptions = new Map();
const lastSeen = new Map();

io.on('connection', (socket) => {
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
    if (offlineMessages.has(userId)) {
      offlineMessages.get(userId).forEach(msg => socket.emit('private message', msg));
      offlineMessages.delete(userId);
    }
    broadcastUserList();
  });

  socket.on('private message', ({ to, text, imageUrl, replyTo, fileInfo }) => {
    const fromUser = Array.from(users.values()).find(u => u.socketId === socket.id);
    if (!fromUser) return;
    const message = {
      id: generateId(),
      from: fromUser.id,
      fromName: fromUser.name,
      to,
      text,
      imageUrl,
      fileInfo,
      replyTo,
      timestamp: Date.now(),
      edited: false
    };
    const recipient = users.get(to);
    if (recipient && recipient.socketId) {
      const toSocket = io.sockets.sockets.get(recipient.socketId);
      if (toSocket) toSocket.emit('private message', message);
    } else {
      if (!offlineMessages.has(to)) offlineMessages.set(to, []);
      offlineMessages.get(to).push(message);
      const subscription = pushSubscriptions.get(to);
      if (subscription) {
        const payload = JSON.stringify({
          title: `Новое сообщение от ${fromUser.name}`,
          body: text || (fileInfo ? `📎 ${fileInfo.originalname}` : (imageUrl ? (imageUrl.match(/\.(mp4|webm|ogg|mov)$/i) ? '🎥 Видео' : '📷 Изображение') : '')),
          url: '/',
          senderId: fromUser.id
        });
        webPush.sendNotification(subscription, payload).catch(err => {
          if (err.statusCode === 410 || err.statusCode === 403) pushSubscriptions.delete(to);
        });
      }
    }
    socket.emit('private message', message);
  });

  socket.on('edit message', ({ messageId, newText, peerId }) => {
    const fromUser = Array.from(users.values()).find(u => u.socketId === socket.id);
    if (!fromUser) return;
    const recipient = users.get(peerId);
    if (recipient && recipient.socketId) {
      const toSocket = io.sockets.sockets.get(recipient.socketId);
      if (toSocket) toSocket.emit('message edited', { messageId, newText, from: fromUser.id });
    }
    socket.emit('message edited', { messageId, newText, from: fromUser.id });
  });

  socket.on('delete message', ({ messageId, peerId }) => {
    const fromUser = Array.from(users.values()).find(u => u.socketId === socket.id);
    if (!fromUser) return;
    const recipient = users.get(peerId);
    if (recipient && recipient.socketId) {
      const toSocket = io.sockets.sockets.get(recipient.socketId);
      if (toSocket) toSocket.emit('message deleted', { messageId, from: fromUser.id });
    }
    socket.emit('message deleted', { messageId, from: fromUser.id });
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
    let disconnectedUserId = null;
    for (let [userId, user] of users.entries()) {
      if (user.socketId === socket.id) {
        disconnectedUserId = userId;
        users.delete(userId);
        break;
      }
    }
    if (disconnectedUserId) lastSeen.set(disconnectedUserId, Date.now());
    broadcastUserList();
  });
});

function broadcastUserList() {
  const userList = Array.from(users.values()).map(({ id, name }) => ({ id, name }));
  io.emit('user list', userList);
  io.emit('last seen update', Object.fromEntries(lastSeen));
}

function generateId() {
  return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Сервер запущен на порту ${PORT}`));