import { NextRequest, NextResponse } from 'next/server'
import { geoReverse, geoApiEnabled } from '@/app/lib/geo-api'

// Reverse geocoding: lat/lng → استان/شهر/منطقه/محله/آدرس — از سامانهٔ نقشهٔ اختصاصی (فاز ۲۳۴).
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const lat = parseFloat(sp.get('lat') || '')
  const lng = parseFloat(sp.get('lng') || '')
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: 'مختصات نامعتبر' }, { status: 400 })
  }
  if (geoApiEnabled()) {
    const r = await geoReverse(lat, lng)
    if (r) return NextResponse.json({ ...r, source: 'geoapi' })
  }
  return NextResponse.json({ neighbourhood: undefined, city: undefined, address: undefined, source: 'none' })
}
