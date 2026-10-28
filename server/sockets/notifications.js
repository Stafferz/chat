const webPush = require('web-push');
const { pushSubscriptions } = require('../store');

function sendNotification(userId, payload) {
  const sub = pushSubscriptions.get(userId);
  if (!sub) return;
  try {
    webPush.sendNotification(sub, JSON.stringify(payload));
  } catch (e) {
    console.error('Push send error:', e.message || e);
  }
}

module.exports = { sendNotification };
