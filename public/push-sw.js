// Loaded into the Workbox service worker (vite.config.js → workbox.importScripts).
self.addEventListener('push', event => {
  let d = {}
  try { d = event.data ? event.data.json() : {} } catch { d = { body: event.data && event.data.text() } }
  event.waitUntil(self.registration.showNotification(d.title || 'BeetFit', {
    body: d.body || '',
    tag: d.tag || 'beetfit',
    renotify: d.tag === 'coach',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    data: { url: d.url || '/' }
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const win = wins.find(w => new URL(w.url).origin === self.location.origin)
    if (win) { await win.focus(); win.postMessage({ type: 'bf-open', url }); return }
    await self.clients.openWindow(url)
  })())
})
