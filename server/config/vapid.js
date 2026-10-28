const webPush = require('web-push');

let vapidPublicKey = null;
let vapidPrivateKey = null;

function initVapid() {
  vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublicKey || !vapidPrivateKey) {
    const vapidKeys = webPush.generateVAPIDKeys();
    vapidPublicKey = vapidPublicKey || vapidKeys.publicKey;
    vapidPrivateKey = vapidPrivateKey || vapidKeys.privateKey;
  }
  webPush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:example@yourdomain.com',
    vapidPublicKey,
    vapidPrivateKey
  );
  return webPush;
}

function getPublicKey() {
  return vapidPublicKey || process.env.VAPID_PUBLIC_KEY || 'BK0ZuTTtvnwKTDxfjMrMTeYWoAejPX_J6PIHPMwvx6b5J3V3LuM8MV91d1wbb_kDj7huTVQgryycEgzCTIKdcNk';
}

module.exports = { initVapid, getPublicKey };
