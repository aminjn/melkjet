import { NextRequest, NextResponse } from 'next/server'
import { getAdminData } from '@/app/lib/admin-store'

// دسترسی‌های واقعی اطراف یک ملک، کاملاً از سرویس نشان:
//   ۱) جستجوی نشان نزدیک‌ترین مکان هر دسته را پیدا می‌کند (نام واقعی)
//   ۲) Distance-Matrix نشان زمان/فاصلهٔ واقعی مسیر را می‌دهد (نه تخمین خط مستقیم)

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

// نزدیک‌ترین مکانِ یک دسته از نتایج جستجوی نشان
async function nearestPlace(key: string, term: string, lat: number, lng: number) {
  const r = await fetch(`https://api.neshan.org/v1/search?term=${encodeURIComponent(term)}&lat=${lat}&lng=${lng}`, {
    headers: { 'Api-Key': key },
    signal: AbortSignal.timeout(7000),
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

// زمان/فاصلهٔ واقعی مسیر ماشین از یک مبدأ به چند مقصد، با Distance-Matrix نشان
async function routeMatrix(key: string, lat: number, lng: number, dests: { lat: number; lng: number }[]) {
  const origins = `${lat},${lng}`
  const destinations = dests.map(d => `${d.lat},${d.lng}`).join('|')
  const r = await fetch(`https://api.neshan.org/v1/distance-matrix?type=car&origins=${origins}&destinations=${encodeURIComponent(destinations)}`, {
    headers: { 'Api-Key': key },
    signal: AbortSignal.timeout(8000),
  })
  if (!r.ok) return null
  const d = await r.json()
  return d.rows?.[0]?.elements || null
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const lat = parseFloat(sp.get('lat') || '')
  const lng = parseFloat(sp.get('lng') || '')
  if (Number.isNaN(lat) || Number.isNaN(lng)) return NextResponse.json({ error: 'مختصات نامعتبر' }, { status: 400 })

  const key = getAdminData().neshan?.serviceKey
  if (!key) return NextResponse.json({ ok: true, nearby: [], source: 'none', note: 'کلید سرویس نشان تنظیم نشده' })

  // حالت دیباگ: وضعیت واقعی پاسخ نشان را برمی‌گرداند تا علت خالی‌بودن مشخص شود
  if (sp.get('debug') === '1') {
    try {
      const r = await fetch(`https://api.neshan.org/v1/search?term=${encodeURIComponent('بیمارستان')}&lat=${lat}&lng=${lng}`, {
        headers: { 'Api-Key': key }, signal: AbortSignal.timeout(8000),
      })
      const text = await r.text()
      return NextResponse.json({ debug: true, status: r.status, keyTail: '***' + key.slice(-4), body: text.slice(0, 500) })
    } catch (e: any) {
      return NextResponse.json({ debug: true, error: e?.message || 'fetch failed', cause: String(e?.cause || ''), keyTail: '***' + key.slice(-4) })
    }
  }

  // ۱) نزدیک‌ترین مکان هر دسته
  const places = (await Promise.all(CATEGORIES.map(async (c) => {
    try {
      const p = await nearestPlace(key, c.term, lat, lng)
      if (!p || p.km > 8) return null // دورتر از ۸ کیلومتر دسترسی محله نیست
      return { type: c.type, name: p.name, lat: p.lat, lng: p.lng, km: p.km }
    } catch { return null }
  }))).filter(Boolean) as { type: string; name: string; lat: number; lng: number; km: number }[]

  if (!places.length) return NextResponse.json({ ok: true, nearby: [], source: 'neshan' })

  // ۲) زمان واقعی مسیر (ماشین) برای همه با یک درخواست
  let elements: any[] | null = null
  try { elements = await routeMatrix(key, lat, lng, places.map(p => ({ lat: p.lat, lng: p.lng }))) } catch { /* fallback below */ }

  const nearby = places.map((p, i) => {
    const el = elements?.[i]
    const meters = el?.status === 'OK' ? Number(el.distance?.value) : Math.round(p.km * 1000 * 1.3)
    const carSec = el?.status === 'OK' ? Number(el.duration?.value) : null
    let time: string
    if (meters <= 1000) {
      const min = Math.max(1, Math.round(meters / 80)) // ~۵ km/h پیاده
      time = `${fa(min)} دقیقه پیاده`
    } else if (carSec) {
      time = `${fa(Math.max(1, Math.round(carSec / 60)))} دقیقه با ماشین`
    } else {
      time = `${fa(Math.max(1, Math.round((p.km * 1.3 / 26) * 60)))} دقیقه با ماشین`
    }
    return { type: p.type, name: p.name, time, meters }
  }).sort((a, b) => a.meters - b.meters)

  return NextResponse.json({ ok: true, nearby, source: 'neshan' })
}
