const webPush = require('web-push');
const { pushSubscriptions } = require('../store');

function sendNotification(userId, payload, io) {
  const { users } = require('../store');
  const user = users.get(userId);
  if (user && user.socketId && io && io.sockets && io.sockets.sockets && io.sockets.sockets.get(user.socketId)) {
    return; // пользователь онлайн — пуш не нужен
  }
  const sub = pushSubscriptions.get(userId);
  if (!sub) return;
  try {
    webPush.sendNotification(sub, JSON.stringify(payload));
  } catch (e) {
    console.error('Push send error:', e.message || e);
  }
}

module.exports = { sendNotification };
