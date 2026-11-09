// SPS Warehouse Service Worker for Mobile Notifications & PWA
const CACHE_NAME = 'sps-warehouse-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming push messages (if configured)
self.addEventListener('push', (event) => {
  let data = {
    title: 'SPS Warehouse Alert',
    body: 'You have a new warehouse update.',
    icon: '/sps-logo.png',
    badge: '/sps-logo.png',
    data: { url: '/' }
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/sps-logo.png',
    badge: data.badge || '/sps-logo.png',
    vibrate: [200, 100, 200],
    data: data.data || { url: '/' },
    tag: data.tag || 'sps-default',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle notification click on Android / Mobile
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notificationData = event.notification.data || {};
  const targetView = notificationData.view || 'inventory';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and post a message
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'SPS_NAVIGATE',
            view: targetView,
            bookingId: notificationData.bookingId,
          });
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
