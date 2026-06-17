import { getAdminData } from './admin-store'
import { proxiedRequest } from './proxy-fetch'

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

function timeFromKm(km: number): string {
  const m = km * 1000 * 1.3
  if (m <= 1000) return `${fa(Math.max(1, Math.round(m / 80)))} دقیقه پیاده`
  return `${fa(Math.max(1, Math.round((km * 1.3 / 26) * 60)))} دقیقه با ماشین`
}

// ── Fallback: OpenStreetMap Overpass (وقتی کلید نشان مجوز Search ندارد) ──
// از طریق پروکسی سرور (اگر تنظیم باشد) وگرنه مستقیم. مکان‌های واقعی با نام فارسی.
function classifyOsm(tags: Record<string, string>): string | null {
  if (tags.railway === 'station' || tags.station === 'subway' || tags.subway === 'yes') return 'مترو'
  if (tags.amenity === 'hospital') return 'بیمارستان'
  if (tags.leisure === 'park') return 'پارک'
  if (tags.amenity === 'school' || tags.amenity === 'college') return 'مدرسه'
  if (tags.amenity === 'pharmacy') return 'داروخانه'
  if (tags.amenity === 'bank') return 'بانک'
  if (tags.shop === 'mall' || tags.shop === 'supermarket') return 'مرکز خرید'
  if (tags.highway === 'bus_stop' || tags.amenity === 'bus_station') return 'اتوبوس'
  if (tags.amenity === 'university') return 'دانشگاه'
  return null
}

async function overpassNearby(lat: number, lng: number): Promise<NearbyResult> {
  const q = `[out:json][timeout:20];(` +
    `node(around:1700,${lat},${lng})["railway"="station"];` +
    `node(around:1700,${lat},${lng})["station"="subway"];` +
    `node(around:2500,${lat},${lng})["amenity"="hospital"];way(around:2500,${lat},${lng})["amenity"="hospital"];` +
    `way(around:1700,${lat},${lng})["leisure"="park"];node(around:1700,${lat},${lng})["leisure"="park"];` +
    `node(around:1700,${lat},${lng})["amenity"="school"];` +
    `node(around:1200,${lat},${lng})["amenity"="pharmacy"];` +
    `node(around:1200,${lat},${lng})["amenity"="bank"];` +
    `node(around:2500,${lat},${lng})["shop"="mall"];` +
    `node(around:2500,${lat},${lng})["amenity"="university"];way(around:2500,${lat},${lng})["amenity"="university"];` +
    `node(around:900,${lat},${lng})["highway"="bus_stop"];` +
    `);out center 80;`
  const body = 'data=' + encodeURIComponent(q)
  const proxyUrl = getAdminData().divar?.proxyUrl || process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || undefined
  const hosts = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
  // ترتیب تلاش: هر میزبان، اول از طریق پروکسی، بعد مستقیم
  const attempts: { host: string; px?: string }[] = []
  for (const host of hosts) { if (proxyUrl) attempts.push({ host, px: proxyUrl }); attempts.push({ host }) }
  let json: any = null
  for (const a of attempts) {
    try {
      const res = await proxiedRequest(a.host, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'MelkJet/1.0 (melkjet.com)' }, body, proxyUrl: a.px, timeout: 22000 })
      if (res.status === 200) { json = JSON.parse(res.body); break }
    } catch { /* try next */ }
  }
  if (!json?.elements?.length) return { nearby: [], source: 'osm', note: 'دادهٔ دسترسی از OSM دریافت نشد.' }

  // نزدیک‌ترین مکان هر دسته با نام
  const best: Record<string, { name: string; km: number }> = {}
  for (const el of json.elements) {
    const tags = el.tags || {}
    const type = classifyOsm(tags)
    if (!type) continue
    const name = tags['name:fa'] || tags.name || tags['name:en']
    if (!name) continue
    const y = el.lat ?? el.center?.lat, x = el.lon ?? el.center?.lon
    if (typeof y !== 'number' || typeof x !== 'number') continue
    const km = haversine(lat, lng, y, x)
    if (!best[type] || km < best[type].km) best[type] = { name, km }
  }
  const nearby = Object.entries(best)
    .map(([type, v]) => ({ type, name: v.name, time: timeFromKm(v.km), meters: Math.round(v.km * 1000) }))
    .sort((a, b) => a.meters - b.meters)
  return { nearby, source: 'osm' }
}

// دسترسی‌های واقعی اطراف یک نقطه: اول نشان (search + distance-matrix)؛
// اگر کلید نشان مجوز Search نداشت، fallback به OpenStreetMap.
export async function computeNearby(lat: number, lng: number): Promise<NearbyResult> {
  const key = getAdminData().neshan?.serviceKey
  if (!key) return overpassNearby(lat, lng)

  const places = (await Promise.all(CATEGORIES.map(async (c) => {
    try {
      const p = await nearestPlace(key, c.term, lat, lng)
      if (!p || p.km > 8) return null
      return { type: c.type, name: p.name, lat: p.lat, lng: p.lng, km: p.km }
    } catch { return null }
  }))).filter(Boolean) as { type: string; name: string; lat: number; lng: number; km: number }[]

  if (!places.length) {
    // نشان نتیجه نداد (اغلب: کلید مجوز Search ندارد) → fallback به OpenStreetMap
    const osm = await overpassNearby(lat, lng)
    if (osm.nearby.length) return { ...osm, note: 'از OpenStreetMap (کلید نشان مجوز Search نداشت)' }
    return { nearby: [], source: 'neshan', note: 'کلید سرویس نشان مجوز سرویس‌های Search/Distance-Matrix را ندارد و OSM هم در دسترس نبود.' }
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
