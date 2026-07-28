import { NextRequest, NextResponse } from 'next/server'
import { geoGeocode, geoApiEnabled } from '@/app/lib/geo-api'

// geocode جمعی: چند آدرس/محله → مختصات — از سامانهٔ نقشهٔ اختصاصی (فاز ۲۳۴). با کش.
const cache = new Map<string, { lat: number; lng: number } | null>()

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({} as any))
  const queries: string[] = Array.isArray(b.queries) ? b.queries.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 40) : []
  if (!queries.length) return NextResponse.json({ results: {} })
  if (!geoApiEnabled()) return NextResponse.json({ results: {} }, { status: 200 })
  const results: Record<string, { lat: number; lng: number } | null> = {}
  const CONC = 4
  let idx = 0
  const worker = async () => {
    while (idx < queries.length) {
      const q = queries[idx++]
      if (cache.has(q)) { results[q] = cache.get(q) || null; continue }
      const r = await geoGeocode(q, 5000)
      const out = r ? { lat: r.lat, lng: r.lng } : null
      if (cache.size > 5000) cache.clear()
      cache.set(q, out)
      results[q] = out
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONC, queries.length) }, () => worker()))
  return NextResponse.json({ results }, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}
