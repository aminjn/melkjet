'use client'
import { useEffect, useRef, useState } from 'react'

// نقشهٔ تعاملیِ نشان (داخلی) — مشترک در همهٔ صفحات. از Web SDK نشان استفاده می‌کند.
// نقاط (آگهی‌ها) را با مارکر روی نقشه می‌گذارد و با کلیک به صفحهٔ ملک می‌رود.

export interface MapPoint { id: string; lat: number; lng: number; title?: string; price?: string }

const SDK_CSS = 'https://static.neshan.org/sdk/leaflet/1.4.0/neshan-sdk-v1.0.8/dist/index.css'
const SDK_JS = 'https://static.neshan.org/sdk/leaflet/1.4.0/neshan-sdk-v1.0.8/dist/index.js'
const TEHRAN: [number, number] = [35.7559, 51.4105]

let sdkPromise: Promise<any> | null = null
function loadSdk(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject('ssr')
  if ((window as any).L?.Map) return Promise.resolve((window as any).L)
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${SDK_CSS}"]`)) {
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = SDK_CSS; document.head.appendChild(link)
    }
    const s = document.createElement('script'); s.src = SDK_JS; s.async = true
    s.onload = () => resolve((window as any).L)
    s.onerror = () => reject('sdk-load-failed')
    document.body.appendChild(s)
  })
  return sdkPromise
}

export default function NeshanMap({
  points = [], center, zoom = 13, height = '100%', onSelect, theme,
}: {
  points?: MapPoint[]
  center?: { lat: number; lng: number }
  zoom?: number
  height?: number | string
  onSelect?: (id: string) => void
  theme?: 'day' | 'night'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [err, setErr] = useState<string>('')

  // ساختِ یک‌بارهٔ نقشه
  useEffect(() => {
    let dead = false
    fetch('/api/geo/mapkey').then(r => r.ok ? r.json() : null).then(async (d) => {
      const key = d?.key
      if (!key) { if (!dead) setErr('no-key'); return }
      let L: any
      try { L = await loadSdk() } catch { if (!dead) setErr('sdk'); return }
      if (dead || !ref.current || mapRef.current) return
      const isLight = theme ? theme === 'day' : (typeof document !== 'undefined' && document.documentElement.classList.contains('light'))
      try {
        mapRef.current = new L.Map(ref.current, {
          key, maptype: isLight ? 'standard-day' : 'standard-night',
          poi: true, traffic: false,
          center: center ? [center.lat, center.lng] : TEHRAN,
          zoom,
        })
      } catch { if (!dead) setErr('init') }
    }).catch(() => { if (!dead) setErr('key') })
    return () => { dead = true; try { mapRef.current?.remove() } catch {} ; mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    return (
      <div style={{ width: '100%', height, borderRadius: 16, border: '1px solid var(--line)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
        {err === 'no-key' ? 'نقشه به «کلیدِ نقشهٔ نشان» (web.…) نیاز دارد — پنل سوپرادمین → اتصال‌ها → نشان → کلید نقشه' : 'بارگذاریِ نقشه ناموفق بود.'}
      </div>
    )
  }
  return <div ref={ref} style={{ width: '100%', height, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--bg2)' }} />
}
