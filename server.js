const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

// Хранилище пользователей: userId -> { id: userId, name, socketId }
const users = new Map();

function generateId() {
  return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);

  socket.on('join', ({ name, userId }) => {
    // Если передан userId и такой пользователь существует, обновляем его
    if (userId && users.has(userId)) {
      const user = users.get(userId);
      if (user.socketId && user.socketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(user.socketId);
        if (oldSocket) {
          oldSocket.emit('kicked', 'Вы вошли с другого устройства или перезагрузили страницу');
          oldSocket.disconnect(true);
        }
      }
      user.name = name;
      user.socketId = socket.id;
      users.set(userId, user);
      socket.emit('joined', { id: userId, name: user.name });
      broadcastUserList();
      return;
    }

    // Создаём нового пользователя
    const newUserId = generateId();
    const newUser = { id: newUserId, name, socketId: socket.id };
    users.set(newUserId, newUser);
    socket.emit('joined', { id: newUserId, name });
    broadcastUserList();
  });

  socket.on('private message', ({ to, text }) => {
    const fromUser = Array.from(users.values()).find(u => u.socketId === socket.id);
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
    socket.emit('private message', {
      from: fromUser.id,
      fromName: fromUser.name,
      to: to,
      text,
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});