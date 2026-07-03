'use client'
import { useEffect, useRef, useState } from 'react'

// نقشهٔ تعاملیِ نشان (داخلی) — مشترک در همهٔ صفحات. از Web SDK نشان استفاده می‌کند.
// نقاط (آگهی‌ها) را با مارکر روی نقشه می‌گذارد و با کلیک به صفحهٔ ملک می‌رود.

export interface MapPoint { id: string; lat: number; lng: number; title?: string; price?: string }

const SDK_CSS = 'https://static.neshan.org/sdk/leaflet/1.4.0/neshan-sdk-v1.0.8/dist/index.css'
const SDK_JS = 'https://static.neshan.org/sdk/leaflet/1.4.0/neshan-sdk-v1.0.8/dist/index.js'
const TEHRAN: [number, number] = [35.7559, 51.4105]

let sdkPromise: Promise<any> | null = null
function neshanReady(): any { const L = (window as any).L; return (L && L.Map && L.Marker) ? L : null }
// لودرِ مقاومِ SDKِ نشان: تلاشِ مجدد، منتظرِ آماده‌شدنِ واقعیِ L.Map، و کش‌نکردنِ شکست
// (تا اگر یک‌بار CDN هیک‌آپ کرد، دفعهٔ بعد دوباره تلاش شود — نه اینکه برای همیشه «sdk» بدهد).
function loadSdk(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject('ssr')
  const ready = neshanReady(); if (ready) return Promise.resolve(ready)
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${SDK_CSS}"]`)) {
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = SDK_CSS; document.head.appendChild(link)
    }
    let tries = 0
    const retry = () => { if (tries >= 3) { sdkPromise = null; reject('sdk-load-failed') } else setTimeout(attempt, 700) }
    const attempt = () => {
      tries++
      if (neshanReady()) { resolve(neshanReady()); return }
      // اسکریپتِ موجود را دوباره اضافه نکن؛ اگر نبود، بساز.
      let s = document.querySelector(`script[src="${SDK_JS}"]`) as HTMLScriptElement | null
      if (!s) {
        s = document.createElement('script'); s.src = SDK_JS; s.async = true
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

  // به‌روزرسانیِ مارکرها
  useEffect(() => {
    const L = (typeof window !== 'undefined') ? (window as any).L : null
    const map = mapRef.current
    if (!L || !map) return
    markersRef.current.forEach(m => { try { map.removeLayer(m) } catch {} })
    markersRef.current = []
    const valid = points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) > 0.1)
    for (const p of valid) {
      try {
        const m = L.marker([p.lat, p.lng]).addTo(map)
        if (p.title || p.price) m.bindPopup(`<div style="font-family:Vazirmatn,sans-serif;direction:rtl;font-size:12px"><b>${(p.title || '').slice(0, 60)}</b>${p.price ? `<br><span style="color:#c9a84c">${p.price}</span>` : ''}</div>`)
        if (onSelect) m.on('click', () => onSelect(p.id))
        markersRef.current.push(m)
      } catch {}
    }
    if (valid.length > 1) {
      try { map.fitBounds(L.latLngBounds(valid.map(p => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 15 }) } catch {}
    } else if (valid.length === 1) {
      try { map.setView([valid[0].lat, valid[0].lng], 15) } catch {}
    } else if (center) {
      try { map.setView([center.lat, center.lng], zoom) } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, center?.lat, center?.lng])

  if (err) {
    // اگر SDKِ تعاملی بارگذاری نشد، به نقشهٔ استاتیک (که مطمئن است) برگرد.
    if (fallback) return <>{fallback}</>
    return (
      <div style={{ width: '100%', height, borderRadius: 16, border: '1px solid var(--line)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
        {err === 'no-key' ? 'نقشه به «کلیدِ نقشهٔ نشان» (web.…) نیاز دارد — پنل سوپرادمین → اتصال‌ها → نشان → کلید نقشه' : `بارگذاریِ نقشه ناموفق بود. (${err})`}
      </div>
    )
  }
  return <div ref={ref} style={{ width: '100%', height, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--bg2)' }} />
}
