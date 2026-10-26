const store = require('../store');

function registerTyping(io, socket) {
  socket.on('typing', ({ to }) => {
    const fromUser = Array.from(store.users.values()).find(u => u.socketId === socket.id);
    if (!fromUser) return;
    const recipient = store.users.get(to);
    if (recipient && recipient.socketId) {
      const toSocket = io.sockets.sockets.get(recipient.socketId);
      if (toSocket) toSocket.emit('typing', { from: fromUser.id, fromName: fromUser.name });
    }
  });

  socket.on('stop typing', ({ to }) => {
    const fromUser = Array.from(store.users.values()).find(u => u.socketId === socket.id);
    if (!fromUser) return;
    const recipient = store.users.get(to);
    if (recipient && recipient.socketId) {
      const toSocket = io.sockets.sockets.get(recipient.socketId);
      if (toSocket) toSocket.emit('stop typing', { from: fromUser.id });
    }
  });
}

module.exports = { registerTyping };
