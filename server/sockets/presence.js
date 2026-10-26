const store = require('../store');
const { generateId } = require('../utils/id');

function registerPresence(io, socket) {
  socket.on('join', ({ name, userId }) => {
    if (!userId) userId = generateId();

    if (store.users.has(userId)) {
      const existing = store.users.get(userId);
      if (existing.socketId && existing.socketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(existing.socketId);
        if (oldSocket) {
          oldSocket.emit('kicked', { message: 'Вы вошли с другого устройства', userId: existing.id });
          oldSocket.disconnect(true);
        }
      }
      existing.name = name;
      existing.socketId = socket.id;
      store.users.set(userId, existing);
    } else {
      store.users.set(userId, { id: userId, name, socketId: socket.id });
    }

    socket.emit('joined', { id: userId, name });

    if (store.offlineMessages.has(userId)) {
      store.offlineMessages.get(userId).forEach(msg => socket.emit('private message', msg));
      store.offlineMessages.delete(userId);
    }

    const userGroups = Array.from(store.groups.entries())
      .filter(([_, g]) => g.members.includes(userId))
      .map(([gid, g]) => ({ id: gid, name: g.name, members: g.members }));
    socket.emit('groups list', userGroups);

    broadcastUserList(io);
  });

  socket.on('get users', () => {
    const userList = Array.from(store.users.values()).map(({ id, name }) => ({ id, name }));
    socket.emit('users list', userList);
  });

  socket.on('disconnect', () => {
    let disconnectedUserId = null;
    for (let [userId, user] of store.users.entries()) {
      if (user.socketId === socket.id) {
        disconnectedUserId = userId;
        store.users.delete(userId);
        break;
      }
    }
    if (disconnectedUserId) {
      store.lastSeen.set(disconnectedUserId, Date.now());
    }
    broadcastUserList(io);
  });
}

function broadcastUserList(io) {
  const userList = Array.from(store.users.values()).map(({ id, name }) => ({ id, name }));
  io.emit('user list', userList);
  io.emit('last seen update', Object.fromEntries(store.lastSeen));
}

module.exports = { registerPresence };
