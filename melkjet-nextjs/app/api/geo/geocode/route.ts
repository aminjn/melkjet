import { NextRequest, NextResponse } from 'next/server'
import { geoGeocode, geoApiEnabled } from '@/app/lib/geo-api'

// Forward-geocode (آدرس/محله → مختصات) — از سامانهٔ نقشهٔ اختصاصی (فاز ۲۳۴). با کش.
const cache = new Map<string, { lat: number; lng: number } | null>()

export async function GET(req: NextRequest) {
  const q = (new URL(req.url).searchParams.get('q') || '').trim()
  if (!q) return NextResponse.json({}, { status: 400 })
  if (cache.has(q)) return NextResponse.json(cache.get(q) || {}, { headers: { 'Cache-Control': 'public, max-age=86400' } })
  if (!geoApiEnabled()) return NextResponse.json({}, { status: 404 })
  const r = await geoGeocode(q)
  const out = r ? { lat: r.lat, lng: r.lng } : null
  if (cache.size > 5000) cache.clear()
  cache.set(q, out)
  return NextResponse.json(out || {}, { headers: { 'Cache-Control': 'public, max-age=86400' } })
}
