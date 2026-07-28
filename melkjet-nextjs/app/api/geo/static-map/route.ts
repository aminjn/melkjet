import { NextRequest } from 'next/server'
import { geoStaticMapUrl, geoApiEnabled, geoApiCfg } from '@/app/lib/geo-api'

// تصویرِ نقشهٔ استاتیک — از سامانهٔ نقشهٔ اختصاصی (فاز ۲۳۴). کلید سمتِ سرور می‌ماند.
//   ?lat=&lng=                 → یک نقطه با مارکر
//   ?pts=lat,lng;lat,lng&center=lat,lng&zoom=&w=&h=  → چند نقطه (نمای منطقه)
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n))

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  if (!geoApiEnabled()) return new Response('no-geoapi', { status: 404 })

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

  let center = sp.get('center') || ''
  if (!center) {
    if (markers.length) {
      const clat = markers.reduce((s, m) => s + m[0], 0) / markers.length
      const clng = markers.reduce((s, m) => s + m[1], 0) / markers.length
      center = `${clat},${clng}`
    } else return new Response('bad coords', { status: 400 })
  }

  const zoom = clamp(parseInt(sp.get('zoom') || (markers.length > 1 ? '12' : '15'), 10) || 14, 3, 18)
  const w = clamp(parseInt(sp.get('w') || '720', 10) || 720, 100, 1280)
  const h = clamp(parseInt(sp.get('h') || '420', 10) || 420, 100, 1280)

  const url = geoStaticMapUrl({ center, zoom, w, h, markers })
  if (!url) return new Response('no-geoapi', { status: 404 })
  try {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 10000)
    // فاز ۲۳۵: کلید در هدر هم می‌رود — پنلِ سامانه احراز با X-API-Key را خواسته.
    const { apiKey } = geoApiCfg()
    const r = await fetch(url, { signal: ctl.signal, headers: apiKey ? { 'X-API-Key': apiKey, 'Api-Key': apiKey } : undefined, cache: 'no-store' })
    clearTimeout(timer)
    if (!r.ok) return new Response('upstream ' + r.status, { status: 502 })
    const buf = Buffer.from(await r.arrayBuffer())
    const type = r.headers.get('content-type') || 'image/png'
    return new Response(buf, { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' } })
  } catch {
    return new Response('upstream-error', { status: 502 })
  }
}
