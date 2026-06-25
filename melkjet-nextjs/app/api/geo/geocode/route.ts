import { NextRequest, NextResponse } from 'next/server'
import { getAdminData } from '@/app/lib/admin-store'
import { shecanRequest } from '@/app/lib/shecan-https'

// Forward-geocode (آدرس/محله → مختصات) با Neshan تا نقشه روی همان محله متمرکز شود.
const cache = new Map<string, { lat: number; lng: number } | null>()

export async function GET(req: NextRequest) {
  const q = (new URL(req.url).searchParams.get('q') || '').trim()
  if (!q) return NextResponse.json({}, { status: 400 })
  if (cache.has(q)) return NextResponse.json(cache.get(q) || {}, { headers: { 'Cache-Control': 'public, max-age=86400' } })

  const nz = getAdminData().neshan
  const key = nz?.serviceKey || nz?.mapKey
  if (!key) return NextResponse.json({}, { status: 404 })

  try {
    const r = await shecanRequest(`https://api.neshan.org/v4/geocoding?address=${encodeURIComponent(q)}`, { method: 'GET', headers: { 'Api-Key': key, accept: 'application/json' }, timeout: 8000 })
    let j: any = null; try { j = JSON.parse(r.body) } catch {}
    const loc = j?.location || j?.items?.[0]?.location
    const lat = loc?.y, lng = loc?.x
    if (typeof lat === 'number' && typeof lng === 'number' && Math.abs(lat) > 0.1) {
      const out = { lat, lng }; cache.set(q, out)
      return NextResponse.json(out, { headers: { 'Cache-Control': 'public, max-age=86400' } })
    }
    cache.set(q, null)
    return NextResponse.json({})
  } catch {
    return NextResponse.json({})
  }
}
