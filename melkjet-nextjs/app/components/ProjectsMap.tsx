'use client'
import { useEffect, useRef, useState } from 'react'
import NeshanMap, { type MapPoint } from './NeshanMap'
import StaticMap from './StaticMap'

// فاز ۲۸۸ — نقشهٔ پروژه‌های یک متخصص (معمار): چند پین روی نقشهٔ خودِ ملک‌جت.
// مثلِ PropertyMap تنبل است: تا کاربر به نقشه نرسیده، SDK لود نمی‌شود.
export default function ProjectsMap({ points }: { points: { id: string; lat: number; lng: number; title?: string }[] }) {
  const pts: MapPoint[] = points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) > 0.1)
  const ref = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!pts.length || show) return
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setShow(true); return }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setShow(true); io.disconnect() } }, { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [pts.length, show])
  if (!pts.length) return null
  // مرکز = میانگین؛ زوم از پراکندگیِ پین‌ها (NeshanMap مستقیم fitBounds ندارد)
  const lat = pts.reduce((a, p) => a + p.lat, 0) / pts.length
  const lng = pts.reduce((a, p) => a + p.lng, 0) / pts.length
  const spread = Math.max(
    Math.max(...pts.map(p => p.lat)) - Math.min(...pts.map(p => p.lat)),
    Math.max(...pts.map(p => p.lng)) - Math.min(...pts.map(p => p.lng)),
  )
  const zoom = spread > 6 ? 5 : spread > 3 ? 6 : spread > 1.2 ? 7 : spread > 0.5 ? 9 : spread > 0.1 ? 11 : 13
  return (
    <div ref={ref} style={{ minHeight: 300 }}>
      {show ? (
        <NeshanMap points={pts} center={{ lat, lng }} zoom={zoom} height={300}
          fallback={<StaticMap points={pts.map(p => ({ lat: p.lat, lng: p.lng }))} aspect={2.2} />} />
      ) : (
        <StaticMap points={pts.map(p => ({ lat: p.lat, lng: p.lng }))} aspect={2.2} />
      )}
    </div>
  )
}
