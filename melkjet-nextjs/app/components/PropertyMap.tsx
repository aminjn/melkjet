'use client'
import NeshanMap from './NeshanMap'
import StaticMap from './StaticMap'

// نقشهٔ تکیِ ملک — تعاملی و زوم‌شو (نشان)، و اگر SDK بارگذاری نشد، نقشهٔ استاتیکِ پین‌دار.
// پین دقیقاً روی مختصاتِ ملک می‌نشیند.
export default function PropertyMap({ lat, lng }: { lat: number; lng: number }) {
  const ok = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) > 0.1
  if (!ok) return (
    <div style={{ width: '100%', height: 200, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>موقعیتِ دقیق ثبت نشده است.</div>
  )
  return (
    <NeshanMap
      points={[{ id: 'p', lat, lng }]}
      center={{ lat, lng }}
      zoom={16}
      height={280}
      fallback={<StaticMap points={[{ lat, lng }]} aspect={1.9} />}
    />
  )
}
