'use client'
import { useState } from 'react'

// نقشهٔ استاتیکِ نشان (سمتِ سرور، مطمئن از داخلِ ایران). تک‌نقطه یا چندنقطه.
// با کلیک، نشانِ تعاملی در تبِ جدید باز می‌شود.
export interface SMPoint { lat: number; lng: number }

export default function StaticMap({
  points, height = 200, zoom, link = true,
}: { points: SMPoint[]; height?: number; zoom?: number; link?: boolean }) {
  const [err, setErr] = useState(false)
  const valid = (points || []).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) > 0.1).slice(0, 25)

  if (!valid.length || err) {
    return (
      <div style={{ width: '100%', height, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12.5, textAlign: 'center', padding: 16 }}>
        {!valid.length ? 'موقعیتِ مکانی برای این پروژه ثبت نشده است.' : 'نقشه به «کلید نقشهٔ نشان» نیاز دارد — پنل سوپرادمین → اتصال‌ها → نشان.'}
      </div>
    )
  }

  const center = valid.length === 1
    ? `${valid[0].lat},${valid[0].lng}`
    : `${valid.reduce((s, p) => s + p.lat, 0) / valid.length},${valid.reduce((s, p) => s + p.lng, 0) / valid.length}`
  const pts = valid.map(p => `${p.lat},${p.lng}`).join(';')
  const src = `/api/geo/static-map?pts=${encodeURIComponent(pts)}&center=${center}&h=${height}&w=720${zoom ? `&zoom=${zoom}` : ''}`
  const href = `https://neshan.org/maps/@${valid[0].lat},${valid[0].lng},${zoom || (valid.length > 1 ? 13 : 16)}z`

  const img = <img src={src} alt="نقشه" onError={() => setErr(true)} style={{ width: '100%', height, objectFit: 'cover', display: 'block' }} />

  return link ? (
    <a href={href} target="_blank" rel="noreferrer" style={{ display: 'block', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)' }}>{img}</a>
  ) : (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)' }}>{img}</div>
  )
}
