const CACHE = 'melkjet-v2'
const STATIC = [
  '/',
  '/search',
  '/auth',
  '/manifest.json',
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  if (e.request.url.includes('/api/')) return
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
        return res
      })
      .catch(() => caches.match(e.request))
  )
})

// ── پوش‌نوتیفیکیشن (حتی وقتی PWA/مرورگر بسته است) ──
self.addEventListener('push', e => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch (err) { try { d = { body: e.data.text() } } catch (e2) {} }
  const title = d.title || 'ملک‌جت'
  const options = {
    body: d.body || '',
    icon: d.icon || '/icon-192.png',
    badge: '/icon-192.png',
    dir: 'rtl', lang: 'fa',
    tag: d.tag || undefined,
    data: { url: d.url || '/' },
    vibrate: [80, 40, 80],
  }
  e.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cls => {
      for (const c of cls) { if ('focus' in c) { c.navigate(url); return c.focus() } }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
