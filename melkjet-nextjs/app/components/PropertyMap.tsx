'use client'
import { useEffect, useRef, useState } from 'react'
import NeshanMap from './NeshanMap'
import StaticMap from './StaticMap'

// نقشهٔ تکیِ ملک — تعاملی و زوم‌شو (Leaflet)، و اگر SDK بارگذاری نشد، نقشهٔ استاتیکِ پین‌دار.
// پین دقیقاً روی مختصاتِ ملک می‌نشیند.
// فاز ۲۵۷ (سرعت): نقشهٔ تعاملی معمولاً پایینِ صفحهٔ آگهی است. تا وقتی کاربر به آن نرسیده،
// SDKِ سنگینِ Leaflet + کاشی‌ها لود نمی‌شوند — به‌جایش نقشهٔ استاتیکِ سبک (تصویرِ کش‌شده) نشان
// داده می‌شود و فقط با نزدیک‌شدنِ اسکرول (۳۰۰px مانده) به نقشهٔ تعاملی ارتقا می‌یابد. TBT/LCP پایین.
export default function PropertyMap({ lat, lng }: { lat: number; lng: number }) {
  const ok = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) > 0.1
  const ref = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!ok || show) return
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setShow(true); return }
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) { setShow(true); io.disconnect() }
    }, { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [ok, show])

  if (!ok) return (
    <div style={{ width: '100%', height: 200, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>موقعیتِ دقیق ثبت نشده است.</div>
  )
  return (
    <div ref={ref} style={{ minHeight: 280 }}>
      {show ? (
        <NeshanMap
          points={[{ id: 'p', lat, lng }]}
          center={{ lat, lng }}
          zoom={16}
          height={280}
          fallback={<StaticMap points={[{ lat, lng }]} aspect={1.9} />}
        />
      ) : (
        <StaticMap points={[{ lat, lng }]} aspect={1.9} />
      )}
    </div>
  )
}
