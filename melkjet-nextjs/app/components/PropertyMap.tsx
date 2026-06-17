'use client'
import { useState } from 'react'

// Static map via Neshan (domestic). Falls back to a message if no Neshan key.
export default function PropertyMap({ lat, lng }: { lat: number; lng: number }) {
  const [err, setErr] = useState(false)
  if (err) {
    return (
      <div style={{ width: '100%', height: 200, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 16 }}>
        نقشه نیاز به کلید نشان دارد (پنل → مناطق و محله‌ها → کلید نشان)
      </div>
    )
  }
  return (
    <a href={`https://neshan.org/maps/@${lat},${lng},16z`} target="_blank" rel="noreferrer" style={{ display: 'block', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)' }}>
      <img src={`/api/geo/static-map?lat=${lat}&lng=${lng}`} alt="نقشه" style={{ width: '100%', height: 'auto', display: 'block' }} onError={() => setErr(true)} />
    </a>
  )
}
