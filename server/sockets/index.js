const { registerPresence } = require('./presence');
const { registerPrivate } = require('./private');
const { registerGroups } = require('./groups');
const { registerTyping } = require('./typing');

function registerSockets(io) {
  io.on('connection', (socket) => {
    console.log('Новое подключение:', socket.id);
    registerPresence(io, socket);
    registerPrivate(io, socket);
    registerGroups(io, socket);
    registerTyping(io, socket);
  });
}

module.exports = { registerSockets };
