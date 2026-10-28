const store = require('../store');
const { generateId } = require('../utils/id');
const { sendNotification } = require('./notifications');

function registerGroups(io, socket) {
  socket.on('create group', ({ name, members }) => {
    const creator = Array.from(store.users.values()).find(u => u.socketId === socket.id);
    if (!creator) return;

    if (!Array.isArray(members)) members = [];
    if (!members.includes(creator.id)) members.push(creator.id);

    const groupId = generateId();
    const newGroup = {
      id: groupId,
      name: name || 'Группа',
      members: members,
      createdAt: Date.now()
    };
    store.groups.set(groupId, newGroup);
    if (!store.groupMessages.has(groupId)) store.groupMessages.set(groupId, []);

    members.forEach(memberId => {
      const member = store.users.get(memberId);
      if (member && member.socketId) {
        const memberSocket = io.sockets.sockets.get(member.socketId);
        if (memberSocket) {
          memberSocket.emit('group created', { id: groupId, name: newGroup.name, members: newGroup.members });
        }
      }
    });

    socket.emit('group created', { id: groupId, name: newGroup.name, members: newGroup.members });
  });

  socket.on('group message', ({ groupId, text, fileInfo, replyTo }) => {
    const fromUser = Array.from(store.users.values()).find(u => u.socketId === socket.id);
    if (!fromUser) return;
    const group = store.groups.get(groupId);
    if (!group) return;

    const message = {
      id: generateId(),
      from: fromUser.id,
      fromName: fromUser.name,
      groupId,
      text,
      fileInfo,
      replyTo,
      timestamp: Date.now(),
      edited: false
    };

    if (!store.groupMessages.has(groupId)) store.groupMessages.set(groupId, []);
    store.groupMessages.get(groupId).push(message);

    group.members.forEach(memberId => {
      if (memberId === fromUser.id) return;
      const member = store.users.get(memberId);
      if (member && member.socketId) {
        const memberSocket = io.sockets.sockets.get(member.socketId);
        if (memberSocket) memberSocket.emit('group message', message);
      } else {
        if (!store.groupOfflineMessages.has(groupId)) store.groupOfflineMessages.set(groupId, []);
        store.groupOfflineMessages.get(groupId).push(message);
      }
    });

    socket.emit('group message', message);

    group.members.forEach(memberId => {
      if (memberId === fromUser.id) return;
      sendNotification(memberId, { title: (group.name || 'Группа') + ': ' + fromUser.name, body: text || 'new message', url: '/' }, io);
    });
  });

  socket.on('edit group message', ({ messageId, newText, groupId }) => {
    const fromUser = Array.from(store.users.values()).find(u => u.socketId === socket.id);
    if (!fromUser) return;
    const group = store.groups.get(groupId);
    if (!group) return;

    const msgs = store.groupMessages.get(groupId) || [];
    const msgIndex = msgs.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;
    if (msgs[msgIndex].from !== fromUser.id) return;

    msgs[msgIndex].text = newText;
    msgs[msgIndex].edited = true;

    group.members.forEach(memberId => {
      const member = store.users.get(memberId);
      if (member && member.socketId) {
        const memberSocket = io.sockets.sockets.get(member.socketId);
        if (memberSocket) {
          memberSocket.emit('group message edited', { messageId, newText, groupId, from: fromUser.id });
        }
      }
    });
  });

  socket.on('delete group message', ({ messageId, groupId }) => {
    const fromUser = Array.from(store.users.values()).find(u => u.socketId === socket.id);
    if (!fromUser) return;
    const group = store.groups.get(groupId);
    if (!group) return;

    const msgs = store.groupMessages.get(groupId) || [];
    const msgIndex = msgs.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;
    if (msgs[msgIndex].from !== fromUser.id) return;

    msgs.splice(msgIndex, 1);

    group.members.forEach(memberId => {
      const member = store.users.get(memberId);
      if (member && member.socketId) {
        const memberSocket = io.sockets.sockets.get(member.socketId);
        if (memberSocket) {
          memberSocket.emit('group message deleted', { messageId, groupId, from: fromUser.id });
        }
      }
    });
  });
}

module.exports = { registerGroups };
