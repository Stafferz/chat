const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

// Хранилище пользователей: userId -> { id, name, socketId }
const users = new Map();

io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);

  socket.on('join', ({ name, userId }) => {
    // Если userId не передан (на всякий случай) – генерируем
    if (!userId) {
      userId = generateId();
    }

    if (users.has(userId)) {
      const existing = users.get(userId);
      // Если старый сокет существует и это не текущий, отключаем старый
      if (existing.socketId && existing.socketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(existing.socketId);
        if (oldSocket) {
          oldSocket.emit('kicked', 'Вы вошли с другого устройства или перезагрузили страницу');
          oldSocket.disconnect(true);
        }
      }
      // Обновляем имя и сокет
      existing.name = name;
      existing.socketId = socket.id;
      users.set(userId, existing);
    } else {
      // Новый пользователь
      users.set(userId, { id: userId, name, socketId: socket.id });
    }

    socket.emit('joined', { id: userId, name });
    broadcastUserList();
  });

  socket.on('private message', ({ to, text }) => {
    // Находим отправителя по socket.id
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
        });
      }
    }
    // Отправляем подтверждение отправителю
    socket.emit('private message', {
      from: fromUser.id,
      fromName: fromUser.name,
      to: to,
      text,
    });
  });

  socket.on('disconnect', () => {
    // Удаляем пользователя из Map по socket.id
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