/* Service worker de Me : affiche les rappels envoyés par le serveur (Web Push), même quand l'app est fermée. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { titre: 'me', corps: e.data ? e.data.text() : '' };
  }
  e.waitUntil(
    self.registration.showNotification(d.titre || 'me', {
      body: d.corps || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: d.tag || undefined,
      renotify: !!d.tag,
      data: { url: d.url || '/notifications' },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/notifications', self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) {
        if (f.url.startsWith(self.location.origin) && 'focus' in f) {
          f.navigate(url).catch(() => {});
          return f.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
