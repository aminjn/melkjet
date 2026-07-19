import { NextRequest } from 'next/server'
import { getAdminData } from '@/app/lib/admin-store'
import { shecanRequestBuffer } from '@/app/lib/shecan-https'

// تصویرِ نقشهٔ استاتیکِ نشان (داخلی، مطمئن از داخلِ ایران). کلید سمتِ سرور می‌ماند.
//   ?lat=&lng=                 → یک نقطه با مارکر
//   ?pts=lat,lng;lat,lng&center=lat,lng&zoom=&w=&h=  → چند نقطه (نمای منطقه)
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n))

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const nz = getAdminData().neshan
  // نقشهٔ استاتیک تاریخاً با کلیدِ سرویس کار می‌کرد — ترجیح با کلیدِ غیرِ وب (خودترمیم، فاز ۳۰)
  const key = [nz?.mapKey, nz?.serviceKey].find(k => k && !/^web\./i.test(k)) || nz?.mapKey || nz?.serviceKey
  if (!key) return new Response('no-neshan-key', { status: 404 })

  // مارکرها
  let markers: [number, number][] = []
  const ptsRaw = sp.get('pts') || ''
  if (ptsRaw) {
    markers = ptsRaw.split(';').map(s => s.split(',').map(Number) as [number, number])
      .filter(a => a.length === 2 && Number.isFinite(a[0]) && Number.isFinite(a[1]) && Math.abs(a[0]) > 0.1)
      .slice(0, 25)
  } else {
    const lat = parseFloat(sp.get('lat') || ''), lng = parseFloat(sp.get('lng') || '')
    if (Number.isFinite(lat) && Number.isFinite(lng)) markers = [[lat, lng]]
  }

  // مرکز
  let center = sp.get('center') || ''
  if (!center) {
    if (markers.length) {
      const clat = markers.reduce((s, m) => s + m[0], 0) / markers.length
      const clng = markers.reduce((s, m) => s + m[1], 0) / markers.length
      center = `${clat},${clng}`
    } else return new Response('bad coords', { status: 400 })
  }

  const zoom = clamp(parseInt(sp.get('zoom') || (markers.length > 1 ? '12' : '15'), 10) || 14, 3, 18)
  const w = clamp(parseInt(sp.get('w') || '720', 10) || 720, 100, 1000)
  const h = clamp(parseInt(sp.get('h') || '320', 10) || 320, 100, 1000)
  // نشانِ استاتیک یک مارکر روی «center» می‌گذارد (marker=COLOR). برای تک‌نقطه، center
  // همان نقطه است ⇒ پین دقیقاً روی ملک. (پینِ چندتایی را نقشهٔ تعاملی می‌زند.)
  const markerStr = markers.length ? '&marker=red' : ''
  const url = `https://api.neshan.org/v4/static?key=${encodeURIComponent(key)}&type=standard-night&zoom=${zoom}&center=${center}&width=${w}&height=${h}${markerStr}`

  // فاز ۱۷۹ — کشِ حافظه‌ایِ سرور: چند کاربرِ هم‌شهر (یا زوم/پنِ تکراری) دیگر به نشان نمی‌روند.
  const ck = url
  const hit = MAP_CACHE.get(ck)
  if (hit && Date.now() - hit.at < MAP_TTL) return new Response(new Uint8Array(hit.buf), { headers: { 'content-type': hit.ct, 'cache-control': 'public, max-age=86400, immutable' } })
  try {
    const r = await shecanRequestBuffer(url, { timeout: 12000 })
    if (r.status < 200 || r.status >= 400) return new Response('neshan-error', { status: 502 })
    MAP_CACHE.set(ck, { buf: r.buffer, ct: r.contentType, at: Date.now() })
    if (MAP_CACHE.size > 400) { const oldest = [...MAP_CACHE.entries()].sort((a, b) => a[1].at - b[1].at)[0]; if (oldest) MAP_CACHE.delete(oldest[0]) }
    return new Response(new Uint8Array(r.buffer), { headers: { 'content-type': r.contentType, 'cache-control': 'public, max-age=86400, immutable' } })
  } catch {
    return new Response('fetch-failed', { status: 502 })
  }
}

const MAP_CACHE = new Map<string, { buf: Buffer; ct: string; at: number }>()
const MAP_TTL = 6 * 3600e3
