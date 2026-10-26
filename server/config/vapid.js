const webPush = require('web-push');

function initVapid() {
  webPush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:example@yourdomain.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  return webPush;
}

module.exports = { initVapid };
