// Service Worker فقط برای پوش‌نوتیفیکیشن.
//
// ⚠️ چرا دیگر fetch/HTML کش نمی‌شود: نسخهٔ قبلی همهٔ GETهای غیرِ /api (شاملِ HTMLِ
// صفحات و چانک‌های JS) را network-first کش می‌کرد و روی هر خطای شبکه نسخهٔ کش‌شده را
// سِرو می‌کرد. اگر صفحه‌ای (مثلِ /admin) یک‌بار جوابِ خراب می‌داد (مثلاً وسطِ دیپلوی/
// کرش)، همان نسخهٔ خراب کش می‌شد و بعد از رفعِ مشکلِ سرور هم مرورگر همان کهنه را نشان
// می‌داد — «۱ ثانیه می‌آمد بعد This page couldn't load»، و Ctrl+Shift+R هم کاری نمی‌کرد
// چون SW جلوی شبکه را می‌گرفت. حالا هیچ fetch handlerای نداریم → مرورگر مستقیم شبکه را
// می‌زند و هیچ‌وقت نسخهٔ کهنه/خراب سِرو نمی‌شود.

const CACHE = 'melkjet-v3'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  // همهٔ کش‌های قدیمی (شاملِ HTML/چانک‌های خرابِ نسخه‌های قبلی) پاک شوند.
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// عمداً هیچ 'fetch' handlerای نیست: مرورگر ناوبری و دارایی‌ها را مثلِ حالتِ عادی
// مستقیم از شبکه می‌گیرد (چانک‌های /_next/static خودشان immutable و کش‌شده‌اند).

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
