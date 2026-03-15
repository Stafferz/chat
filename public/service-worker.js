self.addEventListener('push', function(event) {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon.png',
      badge: '/icon.png',
      data: {
        url: data.url || '/',
        senderId: data.senderId
      },
      silent: false,
      vibrate: [200, 100, 200]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } catch (err) {
    console.error('Push error:', err);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});