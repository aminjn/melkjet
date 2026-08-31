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

// هندلرِ fetch لازم است وگرنه کروم اصلاً beforeinstallprompt نمی‌دهد و نوارِ نصب
// هرگز نمی‌آید. ولی کشِ نسخهٔ قبلی برنمی‌گردد: اینجا هیچ پاسخی ذخیره نمی‌شود، فقط
// وقتی شبکه کاملاً قطع است یک صفحهٔ آفلاینِ درون‌خطی برگردانده می‌شود. چون چیزی
// ذخیره نمی‌شود، هیچ نسخهٔ کهنه یا خرابی نمی‌تواند سِرو شود.
const OFFLINE = '<!doctype html><html lang=fa dir=rtl><meta charset=utf-8>'
  + '<meta name=viewport content="width=device-width,initial-scale=1">'
  + '<title>آفلاین</title><body style="margin:0;display:grid;place-items:center;height:100vh;'
  + 'background:#0f0e0c;color:#e8e3d8;font-family:system-ui,sans-serif;text-align:center">'
  + '<div><div style="font-size:44px">📡</div>'
  + '<h1 style="font-size:17px;margin:12px 0 6px">اتصال اینترنت قطع است</h1>'
  + '<p style="font-size:13px;color:#9a938a;margin:0">وصل که شدید، صفحه را دوباره باز کنید.</p></div>'

self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return
  e.respondWith(
    fetch(e.request).catch(() => new Response(OFFLINE, {
      status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }))
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
