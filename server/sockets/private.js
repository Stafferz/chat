const store = require('../store');
const { generateId } = require('../utils/id');
const { sendNotification } = require('./notifications');

function registerPrivate(io, socket) {
  socket.on('private message', ({ to, text, imageUrl, replyTo, fileInfo }) => {
    const fromUser = Array.from(store.users.values()).find(u => u.socketId === socket.id);
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

    const recipient = store.users.get(to);
    if (recipient && recipient.socketId) {
      const toSocket = io.sockets.sockets.get(recipient.socketId);
      if (toSocket) toSocket.emit('private message', message);
    } else {
      if (!store.offlineMessages.has(to)) store.offlineMessages.set(to, []);
      store.offlineMessages.get(to).push(message);
    }
    socket.emit('private message', message);
    if (fromUser.id !== to) {
      sendNotification(to, { title: fromUser.name + ': ' + (text || '').substring(0, 50), body: text || 'new message', url: '/' });
    }
  });

  socket.on('edit message', ({ messageId, newText, peerId }) => {
    const fromUser = Array.from(store.users.values()).find(u => u.socketId === socket.id);
    if (!fromUser) return;
    const recipient = store.users.get(peerId);
    if (recipient && recipient.socketId) {
      const toSocket = io.sockets.sockets.get(recipient.socketId);
      if (toSocket) toSocket.emit('message edited', { messageId, newText, from: fromUser.id });
    }
    socket.emit('message edited', { messageId, newText, from: fromUser.id });
  });

  socket.on('delete message', ({ messageId, peerId }) => {
    const fromUser = Array.from(store.users.values()).find(u => u.socketId === socket.id);
    if (!fromUser) return;
    const recipient = store.users.get(peerId);
    if (recipient && recipient.socketId) {
      const toSocket = io.sockets.sockets.get(recipient.socketId);
      if (toSocket) toSocket.emit('message deleted', { messageId, from: fromUser.id });
    }
    socket.emit('message deleted', { messageId, from: fromUser.id });
  });

  socket.on('clear chat', ({ peerId }) => {
    const fromUser = Array.from(store.users.values()).find(u => u.socketId === socket.id);
    if (!fromUser) return;
    const recipient = store.users.get(peerId);
    if (recipient && recipient.socketId) {
      const toSocket = io.sockets.sockets.get(recipient.socketId);
      if (toSocket) toSocket.emit('chat cleared', { peerId: fromUser.id });
    }
    socket.emit('chat cleared', { peerId });
  });
}

module.exports = { registerPrivate };
