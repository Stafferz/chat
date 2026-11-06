const webPush = require('web-push');
const { pushSubscriptions } = require('../store');

function sendNotification(userId, payload, io) {
  const { users } = require('../store');
  const user = users.get(userId);
  const recipientSocket = user && user.socketId && io && io.sockets && io.sockets.sockets
    ? io.sockets.sockets.get(user.socketId)
    : null;
  if (recipientSocket && recipientSocket.data.pageVisible !== false) {
    return; // The active chat tab already shows the message.
  }
  const sub = pushSubscriptions.get(userId);
  if (!sub) return;
  webPush.sendNotification(sub, JSON.stringify(payload)).catch((e) => {
    console.error('Push send error:', e.message || e);
    if (e.statusCode === 404 || e.statusCode === 410) pushSubscriptions.delete(userId);
  });
}

module.exports = { sendNotification };
