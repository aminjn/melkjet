import { NextRequest, NextResponse } from 'next/server'
import { getAdminData } from '@/app/lib/admin-store'

// دسترسی‌های واقعی اطراف یک نقطه: مترو، بیمارستان، پارک، مدرسه، مرکز خرید، بانک …
// از API جستجوی نشان استفاده می‌کند (در صورت نبود کلید، از OSM Nominatim).
// زمان تقریبی از فاصلهٔ واقعی هوایی × ضریب مسیر محاسبه می‌شود — نه حدس مدل.

const CATEGORIES: { type: string; term: string }[] = [
  { type: 'مترو', term: 'ایستگاه مترو' },
  { type: 'بیمارستان', term: 'بیمارستان' },
  { type: 'پارک', term: 'بوستان' },
  { type: 'مدرسه', term: 'مدرسه' },
  { type: 'مرکز خرید', term: 'مرکز خرید' },
  { type: 'بانک', term: 'بانک' },
  { type: 'داروخانه', term: 'داروخانه' },
]

function fa(n: number | string): string { return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]) }

// فاصلهٔ هوایی (km) — هاورساین
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// km → زمان تقریبی پیاده/با ماشین
function travelTime(km: number): string {
  const road = km * 1.3 // ضریب تقریبی مسیر واقعی نسبت به خط مستقیم
  if (road <= 0.9) {
    const min = Math.max(1, Math.round((road / 5) * 60)) // ۵ km/h پیاده
    return `${fa(min)} دقیقه پیاده`
  }
  const min = Math.max(1, Math.round((road / 26) * 60))  // ~۲۶ km/h داخل شهر
  return `${fa(min)} دقیقه با ماشین`
}

async function searchNeshan(key: string, term: string, lat: number, lng: number) {
  const r = await fetch(`https://api.neshan.org/v1/search?term=${encodeURIComponent(term)}&lat=${lat}&lng=${lng}`, {
    headers: { 'Api-Key': key },
    signal: AbortSignal.timeout(7000),
  })
  if (!r.ok) return null
  const d = await r.json()
  const items: any[] = d.items || []
  // نزدیک‌ترین مورد بر اساس فاصلهٔ واقعی
  let best: { name: string; lat: number; lng: number } | null = null
  let bestKm = Infinity
  for (const it of items.slice(0, 8)) {
    const y = it.location?.y, x = it.location?.x
    if (typeof y !== 'number' || typeof x !== 'number') continue
    const km = haversine(lat, lng, y, x)
    if (km < bestKm) { bestKm = km; best = { name: it.title || term, lat: y, lng: x } }
  }
  if (!best) return null
  return { name: best.name, km: bestKm }
}

async function searchOSM(term: string, lat: number, lng: number) {
  // viewbox کوچک حدود ۳ کیلومتری دور نقطه
  const d = 0.03
  const vb = `${lng - d},${lat + d},${lng + d},${lat - d}`
  const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(term)}&format=jsonv2&bounded=1&viewbox=${vb}&accept-language=fa&limit=5`, {
    headers: { 'User-Agent': 'MelkJet/1.0 (melkjet.com)' },
    signal: AbortSignal.timeout(8000),
  })
  if (!r.ok) return null
  const arr: any[] = await r.json()
  let best: { name: string; km: number } | null = null
  for (const it of arr) {
    const y = parseFloat(it.lat), x = parseFloat(it.lon)
    if (Number.isNaN(y) || Number.isNaN(x)) continue
    const km = haversine(lat, lng, y, x)
    const name = (it.name || it.display_name?.split('،')[0] || it.display_name?.split(',')[0] || term).trim()
    if (!best || km < best.km) best = { name, km }
  }
  return best
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const lat = parseFloat(sp.get('lat') || '')
  const lng = parseFloat(sp.get('lng') || '')
  if (Number.isNaN(lat) || Number.isNaN(lng)) return NextResponse.json({ error: 'مختصات نامعتبر' }, { status: 400 })

  const key = getAdminData().neshan?.serviceKey
  const results = await Promise.all(CATEGORIES.map(async (c) => {
    try {
      let hit = key ? await searchNeshan(key, c.term, lat, lng) : null
      if (!hit) hit = await searchOSM(c.term, lat, lng)
      if (!hit || hit.km > 8) return null // دورتر از ۸ کیلومتر را دسترسی محله حساب نکن
      return { type: c.type, name: hit.name, time: travelTime(hit.km), km: Math.round(hit.km * 10) / 10 }
    } catch { return null }
  }))

  const nearby = results.filter(Boolean).sort((a: any, b: any) => a.km - b.km)
  return NextResponse.json({ ok: true, nearby, source: key ? 'neshan' : 'osm' })
}
