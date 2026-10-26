const { registerPresence } = require('./presence');
const { registerPrivate } = require('./private');
const { registerGroups } = require('./groups');
const { registerTyping } = require('./typing');

function registerSockets(io) {
  io.on('connection', (socket) => {
    console.log('Новое подключение:', socket.id);
    
    // Handle the join event - when a user joins the chat
    socket.on('join', (user) => {
      console.log('Пользователь вошел:', user);
      // Emit the joined event to the client - transform userId to id
      const userResponse = { name: user.name, id: user.userId || user.id };
      socket.emit('joined', userResponse);
    });
    
    registerPresence(io, socket);
    registerPrivate(io, socket);
    registerGroups(io, socket);
    registerTyping(io, socket);
  });
}

module.exports = { registerSockets };
