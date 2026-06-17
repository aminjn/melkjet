import { getAdminData } from './admin-store'

const CATEGORIES: { type: string; term: string }[] = [
  { type: 'مترو', term: 'ایستگاه مترو' },
  { type: 'بیمارستان', term: 'بیمارستان' },
  { type: 'پارک', term: 'بوستان' },
  { type: 'مدرسه', term: 'مدرسه' },
  { type: 'مرکز خرید', term: 'مرکز خرید' },
  { type: 'بانک', term: 'بانک' },
  { type: 'داروخانه', term: 'داروخانه' },
  { type: 'اتوبوس', term: 'ایستگاه اتوبوس' },
]

function fa(n: number | string): string { return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]) }

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

async function nearestPlace(key: string, term: string, lat: number, lng: number) {
  const r = await fetch(`https://api.neshan.org/v1/search?term=${encodeURIComponent(term)}&lat=${lat}&lng=${lng}`, {
    headers: { 'Api-Key': key }, signal: AbortSignal.timeout(7000),
  })
  if (!r.ok) return null
  const d = await r.json()
  let best: { name: string; lat: number; lng: number; km: number } | null = null
  for (const it of (d.items || []).slice(0, 10)) {
    const y = it.location?.y, x = it.location?.x
    if (typeof y !== 'number' || typeof x !== 'number') continue
    const km = haversine(lat, lng, y, x)
    if (!best || km < best.km) best = { name: it.title || term, lat: y, lng: x, km }
  }
  return best
}

async function routeMatrix(key: string, lat: number, lng: number, dests: { lat: number; lng: number }[]) {
  const origins = `${lat},${lng}`
  const destinations = dests.map(d => `${d.lat},${d.lng}`).join('|')
  const r = await fetch(`https://api.neshan.org/v1/distance-matrix?type=car&origins=${origins}&destinations=${encodeURIComponent(destinations)}`, {
    headers: { 'Api-Key': key }, signal: AbortSignal.timeout(8000),
  })
  if (!r.ok) return null
  const d = await r.json()
  return d.rows?.[0]?.elements || null
}

export interface NearbyResult { nearby: { type?: string; name?: string; time: string; meters?: number }[]; source: string; note?: string }

// دسترسی‌های واقعی اطراف یک نقطه، کاملاً از نشان (search + distance-matrix).
export async function computeNearby(lat: number, lng: number): Promise<NearbyResult> {
  const key = getAdminData().neshan?.serviceKey
  if (!key) return { nearby: [], source: 'none', note: 'کلید سرویس نشان تنظیم نشده' }

  const places = (await Promise.all(CATEGORIES.map(async (c) => {
    try {
      const p = await nearestPlace(key, c.term, lat, lng)
      if (!p || p.km > 8) return null
      return { type: c.type, name: p.name, lat: p.lat, lng: p.lng, km: p.km }
    } catch { return null }
  }))).filter(Boolean) as { type: string; name: string; lat: number; lng: number; km: number }[]

  if (!places.length) {
    let note = ''
    try {
      const r = await fetch(`https://api.neshan.org/v1/search?term=${encodeURIComponent('بانک')}&lat=${lat}&lng=${lng}`, { headers: { 'Api-Key': key }, signal: AbortSignal.timeout(6000) })
      if (r.status === 485 || r.status === 401 || r.status === 403) note = 'کلید سرویس نشان مجوز سرویس‌های Search و Distance-Matrix را ندارد — در پنل نشان این سرویس‌ها را روی همین کلید فعال کنید.'
    } catch { note = 'دسترسی به سرویس نشان از سرور ممکن نشد.' }
    return { nearby: [], source: 'neshan', note }
  }

  let elements: any[] | null = null
  try { elements = await routeMatrix(key, lat, lng, places.map(p => ({ lat: p.lat, lng: p.lng }))) } catch { /* fallback below */ }

  const nearby = places.map((p, i) => {
    const el = elements?.[i]
    const meters = el?.status === 'OK' ? Number(el.distance?.value) : Math.round(p.km * 1000 * 1.3)
    const carSec = el?.status === 'OK' ? Number(el.duration?.value) : null
    let time: string
    if (meters <= 1000) time = `${fa(Math.max(1, Math.round(meters / 80)))} دقیقه پیاده`
    else if (carSec) time = `${fa(Math.max(1, Math.round(carSec / 60)))} دقیقه با ماشین`
    else time = `${fa(Math.max(1, Math.round((p.km * 1.3 / 26) * 60)))} دقیقه با ماشین`
    return { type: p.type, name: p.name, time, meters }
  }).sort((a, b) => a.meters - b.meters)

  return { nearby, source: 'neshan' }
}
