'use client'

// فاز ۲۳۸ — زمینهٔ نقشه، کاشی‌به‌کاشی از پروکسیِ خودِ سایت (/api/geo/tile).
// چرا: staticmapِ سامانه هنوز زمینهٔ خالی رندر می‌دهد و کشِ nginxاش placeholderهای قدیمی را نگه
// داشته بود؛ کاشی‌ها اما واقعی‌اند (سند: کاشیِ تازهٔ ۱۹.۶KB با جاده). این کامپوننت همان ریاضیِ
// مرکاتورِ نقشه‌های سایت را دارد و هر جا زمینه لازم است زیرِ پین‌ها می‌نشیند — وابستگیِ صفر به staticmap.
const TILE = 256
function project(lat: number, lng: number, z: number) {
  const s = TILE * Math.pow(2, z)
  const x = ((lng + 180) / 360) * s
  const sinL = Math.sin((lat * Math.PI) / 180)
  const y = (0.5 - Math.log((1 + sinL) / (1 - sinL)) / (4 * Math.PI)) * s
  return { x, y }
}

export default function TileBase({ lat, lng, zoom, w, h }: { lat: number; lng: number; zoom: number; w: number; h: number }) {
  const z = Math.max(0, Math.min(20, Math.round(zoom)))
  const c = project(lat, lng, z)
  const tl = { x: c.x - w / 2, y: c.y - h / 2 }
  const x0 = Math.floor(tl.x / TILE), y0 = Math.floor(tl.y / TILE)
  const x1 = Math.floor((tl.x + w) / TILE), y1 = Math.floor((tl.y + h) / TILE)
  const max = Math.pow(2, z)
  const tiles: { key: string; src: string; left: number; top: number }[] = []
  for (let ty = y0; ty <= y1; ty++) {
    if (ty < 0 || ty >= max) continue
    for (let tx = x0; tx <= x1; tx++) {
      const wx = ((tx % max) + max) % max
      tiles.push({ key: `${z}/${tx}/${ty}`, src: `/api/geo/tile/${z}/${wx}/${ty}`, left: tx * TILE - tl.x, top: ty * TILE - tl.y })
    }
  }
  return (
    <>
      {tiles.map(t => (
        <img key={t.key} src={t.src} alt="" draggable={false} decoding="async" loading="lazy"
          style={{ position: 'absolute', left: `${(t.left / w) * 100}%`, top: `${(t.top / h) * 100}%`, width: `${(TILE / w) * 100}%`, height: `${(TILE / h) * 100}%`, pointerEvents: 'none', userSelect: 'none' }} />
      ))}
    </>
  )
}
