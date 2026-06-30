'use client'
import { useState } from 'react'

// نقشهٔ استاتیکِ نشان (سمتِ سرور، مطمئن از داخلِ ایران) + پین‌های روی‌هم‌چیده که خودمان
// با تصویرِ مرکاتور دقیقاً روی مختصاتِ هر نقطه می‌گذاریم. پین‌ها همیشه دیده می‌شوند و دقیقاً
// سرِجای ملک‌اند — مستقل از رندرِ مارکرِ نشان یا SDKِ تعاملی (که ممکن است بارگذاری نشود).
export interface SMPoint { id?: string; lat: number; lng: number }

const TILE = 256
function project(lat: number, lng: number, z: number) {
  const s = TILE * Math.pow(2, z)
  const x = ((lng + 180) / 360) * s
  const sinL = Math.sin((lat * Math.PI) / 180)
  const y = (0.5 - Math.log((1 + sinL) / (1 - sinL)) / (4 * Math.PI)) * s
  return { x, y }
}
function fitZoom(pts: SMPoint[], W: number, H: number, center: { lat: number; lng: number }) {
  if (pts.length <= 1) return 15
  for (let z = 16; z >= 3; z--) {
    const c = project(center.lat, center.lng, z)
    const ok = pts.every(p => { const q = project(p.lat, p.lng, z); return Math.abs(q.x - c.x) < W / 2 - 24 && Math.abs(q.y - c.y) < H / 2 - 30 })
    if (ok) return z
  }
  return 11
}

export default function StaticMap({
  points, aspect = 1.7, link = true, onSelect,
}: { points: SMPoint[]; aspect?: number; link?: boolean; onSelect?: (id: string) => void }) {
  const [err, setErr] = useState(false)
  const valid = (points || []).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) > 0.1).slice(0, 60)
  const W = 1000, H = Math.round(W / aspect)

  if (!valid.length || err) {
    return (
      <div style={{ width: '100%', aspectRatio: `${W} / ${H}`, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12.5, textAlign: 'center', padding: 16 }}>
        {!valid.length ? 'موقعیتِ مکانی ثبت نشده است.' : 'نقشه به «کلید نقشهٔ نشان» نیاز دارد — پنل سوپرادمین → اتصال‌ها → نشان.'}
      </div>
    )
  }

  const lats = valid.map(p => p.lat), lngs = valid.map(p => p.lng)
  const center = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 }
  const zoom = fitZoom(valid, W, H, center)
  const src = `/api/geo/static-map?center=${center.lat},${center.lng}&zoom=${zoom}&w=${W}&h=${H}`
  const c0 = project(center.lat, center.lng, zoom)

  const pins = valid.map((p, i) => {
    const q = project(p.lat, p.lng, zoom)
    const left = (0.5 + (q.x - c0.x) / W) * 100
    const top = (0.5 + (q.y - c0.y) / H) * 100
    if (left < -2 || left > 102 || top < -2 || top > 102) return null
    return { ...p, left, top, i }
  }).filter(Boolean) as (SMPoint & { left: number; top: number; i: number })[]

  return (
    <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)', width: '100%', aspectRatio: `${W} / ${H}`, background: 'var(--bg2)' }}>
      <img src={src} alt="نقشه" onError={() => setErr(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      {pins.map((p) => {
        const pin = <div style={{ fontSize: valid.length > 1 ? 22 : 30, lineHeight: 1, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.6))', cursor: onSelect || link ? 'pointer' : 'default' }}>📍</div>
        const style: React.CSSProperties = { position: 'absolute', left: `${p.left}%`, top: `${p.top}%`, transform: 'translate(-50%,-100%)', zIndex: 2 }
        if (onSelect && p.id) return <div key={p.i} style={style} onClick={() => onSelect(p.id!)} title="مشاهدهٔ پروژه">{pin}</div>
        return <div key={p.i} style={{ ...style, pointerEvents: 'none' }}>{pin}</div>
      })}
      {link && valid.length === 1 && (
        <a href={`https://neshan.org/maps/@${valid[0].lat},${valid[0].lng},16z`} target="_blank" rel="noreferrer" style={{ position: 'absolute', inset: 0, zIndex: 1 }} aria-label="باز کردن در نشان" />
      )}
    </div>
  )
}
