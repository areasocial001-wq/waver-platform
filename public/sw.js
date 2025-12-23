// Service Worker for Push Notifications
self.addEventListener('push', function(event) {
  const options = event.data ? event.data.json() : {};
  
  const title = options.title || 'Video Completato!';
  const notificationOptions = {
    body: options.body || 'Il tuo video è pronto per la visualizzazione',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: options.tag || 'video-notification',
    data: options.data || {},
    requireInteraction: true,
    actions: [
      { action: 'view', title: 'Visualizza' },
      { action: 'dismiss', title: 'Chiudi' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'view' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
        // Try to focus existing window
        for (const client of clientList) {
          if (client.url.includes('/history') && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow('/history');
        }
      })
    );
  }
});

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});
