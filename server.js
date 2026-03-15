const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

const users = new Map(); // socket.id -> { id, name }

io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);

  socket.on('join', (name) => {
    let nameTaken = false;
    for (let [_, user] of users) {
      if (user.name === name) {
        nameTaken = true;
        break;
      }
    }
    if (nameTaken) {
      socket.emit('joinError', 'Это имя уже используется');
      return;
    }
    users.set(socket.id, { id: socket.id, name });
    socket.emit('joined', { id: socket.id, name });
    broadcastUserList();
  });

  socket.on('private message', ({ to, text }) => {
    const fromUser = users.get(socket.id);
    if (!fromUser) return;

    const toSocket = io.sockets.sockets.get(to);
    if (toSocket) {
      toSocket.emit('private message', {
        from: socket.id,
        fromName: fromUser.name,
        to: to,
        text,
      });
    }
    // Отправляем подтверждение отправителю (тоже с полем to)
    socket.emit('private message', {
      from: socket.id,
      fromName: fromUser.name,
      to: to,
      text,
    });
  });

  socket.on('disconnect', () => {
    users.delete(socket.id);
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