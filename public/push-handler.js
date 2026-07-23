self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { notification: { body: event.data ? event.data.text() : '新しいお知らせがあります。' } };
  }
  const notification = payload.notification || payload.data || {};
  event.waitUntil(
    self.registration.showNotification(notification.title || '今日ノート', {
      body: notification.body || '予定を確認しましょう。',
      icon: '/icon-192x192.png',
      badge: '/icon-96x96.png',
      tag: notification.tag || 'kyou-note-cloud-message',
      data: { url: notification.url || '/#today' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/#today';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client);
      return existing
        ? ('navigate' in existing ? existing.navigate(url).then(() => existing.focus()) : existing.focus())
        : self.clients.openWindow(url);
    })
  );
});
