const webPush = require('web-push');

function initVapid() {
  let vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
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

module.exports = { initVapid };
