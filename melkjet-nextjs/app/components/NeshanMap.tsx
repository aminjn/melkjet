'use client'
import { useEffect, useRef, useState } from 'react'

// نقشهٔ تعاملیِ نشان (داخلی) — مشترک در همهٔ صفحات. از Web SDK نشان استفاده می‌کند.
// نقاط (آگهی‌ها) را با مارکر روی نقشه می‌گذارد و با کلیک به صفحهٔ ملک می‌رود.

// icon/color: پینِ سفارشی (divIcon) — مثلاً 🏛 طلایی برای دارایی خودِ کاربر، 🔥 نارنجی برای فرصتِ روز، 🏞 سبز برای زمین.
export interface MapPoint { id: string; lat: number; lng: number; title?: string; price?: string; icon?: string; color?: string }

// ⚠️ قانونِ کامپوننتِ مشترک: این نقشه در صفحهٔ ملک/سازنده‌ها/امپراتوری استفاده می‌شود — رفتارِ پیش‌فرضش
// قفل است و هرگز عوض نمی‌شود؛ قابلیتِ جدید فقط با propِ جدید (opt-in). مسیرِ SDK همان مسیرِ اثبات‌شدهٔ
// قدیمی است (تغییرش یک‌بار همهٔ نقشه‌های سایت را خاکستری کرد — فاز ۳۰)؛ v1.9.4 فقط نامزدِ پشتیبان است.
const SDK_SOURCES = [
  { css: 'https://static.neshan.org/sdk/leaflet/1.4.0/neshan-sdk-v1.0.8/dist/index.css', js: 'https://static.neshan.org/sdk/leaflet/1.4.0/neshan-sdk-v1.0.8/dist/index.js' },
  { css: 'https://static.neshan.org/sdk/leaflet/v1.9.4/neshan-sdk/v1.0.8/index.css', js: 'https://static.neshan.org/sdk/leaflet/v1.9.4/neshan-sdk/v1.0.8/index.js' },
]
const TEHRAN: [number, number] = [35.7559, 51.4105]

let sdkPromise: Promise<any> | null = null
function neshanReady(): any { const L = (window as any).L; return (L && L.Map && L.Marker) ? L : null }
// لودرِ مقاومِ SDKِ نشان: نامزدها را به‌ترتیب امتحان می‌کند، منتظرِ آماده‌شدنِ واقعیِ L.Map می‌ماند،
// و شکست را کش نمی‌کند (تا اگر یک‌بار CDN هیک‌آپ کرد، دفعهٔ بعد دوباره تلاش شود — نه اینکه برای همیشه «sdk» بدهد).
function loadSdk(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject('ssr')
  const ready = neshanReady(); if (ready) return Promise.resolve(ready)
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    let idx = 0, tries = 0
    const retry = () => {
      tries++
      if (tries % 2 === 0) idx = (idx + 1) % SDK_SOURCES.length   // بعد از ۲ شکست، سراغِ نامزدِ بعدی
      if (tries >= 2 * SDK_SOURCES.length) { sdkPromise = null; reject('sdk-load-failed') } else setTimeout(attempt, 700)
    }
    const attempt = () => {
      if (neshanReady()) { resolve(neshanReady()); return }
      const src = SDK_SOURCES[idx]
      if (!document.querySelector(`link[href="${src.css}"]`)) {
        const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = src.css; document.head.appendChild(link)
      }
      // اسکریپتِ موجود را دوباره اضافه نکن؛ اگر نبود، بساز.
      let s = document.querySelector(`script[src="${src.js}"]`) as HTMLScriptElement | null
      if (!s) {
        s = document.createElement('script'); s.src = src.js; s.async = true
        s.onerror = () => { try { s?.remove() } catch {} ; retry() }
        document.body.appendChild(s)
      }
      // پس از لود، منتظرِ آماده‌شدنِ واقعیِ L.Map بمان (گاهی بعد از onload کمی طول می‌کشد).
      const started = Date.now()
      const poll = setInterval(() => {
        const L = neshanReady()
        if (L) { clearInterval(poll); resolve(L); return }
        if (Date.now() - started > 8000) { clearInterval(poll); try { s?.remove() } catch {} ; retry() }
      }, 200)
    }
    attempt()
  })
  return sdkPromise
}

export default function NeshanMap({
  points = [], center, zoom = 13, height = '100%', onSelect, onMapClick, theme, fallback,
}: {
  points?: MapPoint[]
  center?: { lat: number; lng: number }
  zoom?: number
  height?: number | string
  onSelect?: (id: string) => void
  onMapClick?: (lat: number, lng: number) => void   // انتخابِ موقعیت با کلیک روی نقشه (مارکر جابه‌جا می‌شود)
  theme?: 'day' | 'night'
  fallback?: React.ReactNode   // اگر SDK بارگذاری نشد، این نمایش داده می‌شود (مثلِ نقشهٔ استاتیک)
}) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const pickRef = useRef<any>(null)
  const [err, setErr] = useState<string>('')
  const [tick, setTick] = useState(0)   // برای تلاشِ مجددِ خودکار در صورتِ شکستِ گذرا
  const [ready, setReady] = useState(0) // نقشه ساخته شد → مارکرها سوار شوند (بدونِ اتکا به تغییرِ props)
  const [tileHint, setTileHint] = useState(false)   // کاشی‌ها لود نشدند → راهنمای مجوزِ کلید (فاز ۲۸)
  const fitKeyRef = useRef('')          // امضای دادهٔ فعلیِ پین‌ها — رندرِ والد (هر ثانیه) دیگر نقشه را دست نمی‌زند
  const idsKeyRef = useRef('')          // مجموعهٔ idهای فعلی — تشخیصِ «دادهٔ اساساً جدید» (مثلاً محلهٔ دیگر در جستجو)
  const userMovedRef = useRef(false)    // بعد از زوم/جابه‌جاییِ کاربر، روی «همان داده» auto-fit نکن (زوم نپَرد)
  const programmaticRef = useRef(false) // حرکتِ برنامه‌ای (fitBounds/setView) با حرکتِ کاربر اشتباه نشود

  // ساختِ یک‌بارهٔ نقشه (با تلاشِ مجددِ خودکار تا ۲ بار در صورتِ خطای گذرا)
  useEffect(() => {
    let dead = false
    const failSoft = (code: string) => {
      if (dead) return
      if (tick < 2) setTimeout(() => { if (!dead) setTick(t => t + 1) }, 1200)   // دوباره تلاش کن
      else setErr(code)
    }
    fetch('/api/geo/mapkey').then(r => r.ok ? r.json() : null).then(async (d) => {
      const key = d?.key
      if (!key) { if (!dead) setErr('no-key'); return }   // کلید نیست = مشکلِ تنظیمات، تلاشِ مجدد بی‌فایده
      // تشخیصِ قطعیِ نوعِ کلید: SDK نشان فقط با کلیدِ «وب» (web.…) کاشی می‌دهد؛ کلیدِ سرویس هرگز.
      // (ریشهٔ نقشه‌های خاکستری: کلیدِ service در فیلدِ کلیدِ نقشه — فاز ۳۰)
      if (!/^web\./i.test(String(key)) && !dead) setTileHint(true)
      let L: any
      try { L = await loadSdk() } catch { failSoft('sdk'); return }
      if (dead || !ref.current || mapRef.current) return
      const isLight = theme ? theme === 'day' : (typeof document !== 'undefined' && document.documentElement.classList.contains('light'))
      // اگر همان container قبلاً توسط Leaflet مقداردهی شده (ری‌مانت/ناوبریِ مرحله) پاک کن تا خطای «already initialized» ندهد.
      try { if ((ref.current as any)._leaflet_id) { (ref.current as any)._leaflet_id = null; ref.current.innerHTML = '' } } catch {}
      try {
        mapRef.current = new L.Map(ref.current, {
          key, maptype: isLight ? 'standard-day' : 'standard-night',
          poi: true, traffic: false,
          center: center ? [center.lat, center.lng] : TEHRAN,
          zoom,
        })
      } catch { failSoft('init'); return }
      // اندازهٔ نقشه را بعد از چیدمان درست کن (کانتینرهایی که هنگام init هنوز اندازه نداشته‌اند).
      setTimeout(() => { try { mapRef.current?.invalidateSize?.() } catch {} }, 250)
      // حرکتِ خودِ کاربر (نه fit برنامه‌ای) → از این به بعد زوم/مرکزِ او محترم است و auto-fit خاموش می‌شود.
      try { mapRef.current.on('movestart zoomstart', () => { if (!programmaticRef.current) userMovedRef.current = true }) } catch {}
      // برچسبِ پیش‌فرضِ «Leaflet» حذف می‌شود — اعتبارِ «نشان» سرِ جای خودش می‌ماند.
      try { mapRef.current.attributionControl?.setPrefix?.('') } catch {}
      setReady(r => r + 1)
      // نگهبانِ تایل (فاز ۳۰ — «یک‌بار برای همیشه»): SDK لود می‌شود اما اگر کلیدِ نقشه مجوزِ
      // «نقشهٔ پویا (Web SDK)» نداشته باشد، کاشیِ نشان هرگز نمی‌آید. نقشه دیگر تحتِ هیچ شرایطی
      // خاکستری نمی‌ماند: آخرین سنگر = کاشی‌های OpenStreetMap روی همان نقشهٔ تعاملی (پین‌ها/زوم سالم).
      // به‌محضِ فعال‌شدنِ مجوزِ کلید در پنلِ نشان، استایلِ نشان خودکار برمی‌گردد و این مسیر اجرا نمی‌شود.
      setTimeout(() => {
        if (dead || !ref.current || !mapRef.current) return
        if (ref.current.querySelectorAll('.leaflet-tile-loaded').length > 0) return
        try {
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapRef.current)
          console.warn('NeshanMap: کاشیِ نشان نیامد (مجوزِ Web SDK روی کلید؟) — موقتاً OSM')
        } catch {
          if (fallback) { try { mapRef.current.remove() } catch {} ; mapRef.current = null; setErr('tiles') }
          else setTileHint(true)
        }
      }, 8000)
      // انتخابِ موقعیت با کلیک — جدا و غیرِمخرب: اگر بایندِ کلیک شکست بخورد، خودِ نقشه نباید خطا شود.
      if (onMapClick) {
        try {
          if (center) pickRef.current = L.marker([center.lat, center.lng]).addTo(mapRef.current)
          mapRef.current.on('click', (e: any) => {
            const la = e.latlng.lat, ln = e.latlng.lng
            if (pickRef.current) { try { pickRef.current.setLatLng([la, ln]) } catch {} }
            else { try { pickRef.current = L.marker([la, ln]).addTo(mapRef.current) } catch {} }
            onMapClick(la, ln)
          })
        } catch { /* بایندِ کلیک غیرِحیاتی است */ }
      }
    }).catch(() => failSoft('key'))
    return () => { dead = true; try { mapRef.current?.remove() } catch {} ; mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  // به‌روزرسانیِ مارکرها — فقط وقتی «دادهٔ» پین‌ها واقعاً عوض شده باشد. والدِ نقشه ممکن است هر ثانیه رندر شود
  // (شمارشِ معکوس و…) و آرایهٔ points هویتِ تازه بگیرد؛ بدونِ این نگهبان، هر رندر = بازسازیِ مارکرها + پریدنِ زوم.
  useEffect(() => {
    const L = (typeof window !== 'undefined') ? (window as any).L : null
    const map = mapRef.current
    if (!L || !map) return
    const valid = points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) > 0.1)
    const key = valid.map(p => `${p.id},${p.lat.toFixed(5)},${p.lng.toFixed(5)},${p.icon || ''}`).join('|')
    if (key === fitKeyRef.current) return
    fitKeyRef.current = key
    // دادهٔ اساساً جدید (مثلاً انتخابِ محلهٔ دیگر در جستجو: بیش از نصفِ پین‌ها تازه‌اند) → قفلِ «کاربر جابه‌جا
    // کرده» برداشته می‌شود تا نقشه به محتوای جدید برود. دادهٔ همان‌ها (رندرِ والد/لایهٔ زیرمجموعه) زوم را نمی‌پراند.
    if (idsKeyRef.current && valid.length > 0) {
      const prev = new Set(idsKeyRef.current.split('|'))
      const overlap = valid.filter(p => prev.has(String(p.id))).length
      if (overlap < valid.length / 2) userMovedRef.current = false
    }
    idsKeyRef.current = valid.map(p => String(p.id)).join('|')
    markersRef.current.forEach(m => { try { map.removeLayer(m) } catch {} })
    markersRef.current = []
    for (const p of valid) {
      try {
        // پینِ سفارشی: دارایی‌ِ خودِ کاربر/کارگاه/فرصت/زمین هر کدام شکل و رنگِ خودشان را دارند (فصل ۹ City Screen)
        const opts = (p.icon || p.color) ? {
          icon: L.divIcon({
            className: 'mj-pin',
            html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50% 50% 50% 6px;background:${p.color || '#c9a84c'};border:2px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.5);font-size:16px;line-height:1">${p.icon || '📍'}</div>`,
            iconSize: [32, 32], iconAnchor: [16, 30], popupAnchor: [0, -28],
          }),
        } : undefined
        const m = L.marker([p.lat, p.lng], opts).addTo(map)
        if (p.title || p.price) m.bindPopup(`<div style="font-family:Vazirmatn,sans-serif;direction:rtl;font-size:12px"><b>${(p.title || '').slice(0, 60)}</b>${p.price ? `<br><span style="color:#c9a84c">${p.price}</span>` : ''}</div>`)
        if (onSelect) m.on('click', () => onSelect(p.id))
        markersRef.current.push(m)
      } catch {}
    }
    // فیت فقط تا وقتی کاربر خودش زوم/جابه‌جا نکرده — زوم و مرکزِ کاربر هرگز نمی‌پَرد.
    if (userMovedRef.current) return
    programmaticRef.current = true
    try {
      if (valid.length > 1) map.fitBounds(L.latLngBounds(valid.map(p => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 15 })
      else if (valid.length === 1) map.setView([valid[0].lat, valid[0].lng], 15)
      else if (center) map.setView([center.lat, center.lng], zoom)
    } catch {}
    setTimeout(() => { programmaticRef.current = false }, 600)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, ready, center?.lat, center?.lng])

  if (err) {
    // اگر SDKِ تعاملی بارگذاری نشد، به نقشهٔ استاتیک (که مطمئن است) برگرد.
    if (fallback) return <>{fallback}</>
    return (
      <div style={{ width: '100%', height, borderRadius: 16, border: '1px solid var(--line)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
        {err === 'no-key' ? 'نقشه به «کلیدِ نقشهٔ نشان» (web.…) نیاز دارد — پنل سوپرادمین → اتصال‌ها → نشان → کلید نقشه' : `بارگذاریِ نقشه ناموفق بود. (${err})`}
      </div>
    )
  }
  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div ref={ref} style={{ position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--bg2)' }} />
      {tileHint && <div style={{ position: 'absolute', bottom: 10, right: 10, left: 10, zIndex: 500, pointerEvents: 'none', background: 'rgba(20,16,4,.9)', border: '1px solid var(--gold)', borderRadius: 10, padding: '8px 12px', fontSize: 11.5, color: '#f3d98a', textAlign: 'center' }}>
        کلیدِ ثبت‌شده در «کلیدِ نقشه» از نوعِ سرویس (service.…) است — نقشهٔ تعاملی فقط با کلیدِ «وب» کار می‌کند. در پنلِ نشان یک کلیدِ جدید از نوعِ «وب» (دامنهٔ melkjet.com) بساز و در ادمین → اتصال‌ها → نشان → کلیدِ نقشه بگذار. تا آن موقع نقشه با کاشیِ جایگزین بالا می‌آید.
      </div>}
    </div>
  )
}
