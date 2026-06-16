import { NextRequest, NextResponse } from 'next/server'
import { getAdminData } from '@/app/lib/admin-store'

// Reverse geocoding: lat/lng → neighbourhood/city/address.
// Uses Neshan when a service key is configured, otherwise OSM Nominatim.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const lat = parseFloat(sp.get('lat') || '')
  const lng = parseFloat(sp.get('lng') || '')
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: 'مختصات نامعتبر' }, { status: 400 })
  }

  const key = getAdminData().neshan?.serviceKey

  try {
    if (key) {
      const r = await fetch(`https://api.neshan.org/v5/reverse?lat=${lat}&lng=${lng}`, {
        headers: { 'Api-Key': key },
        signal: AbortSignal.timeout(8000),
      })
      if (r.ok) {
        const d = await r.json()
        return NextResponse.json({
          neighbourhood: d.neighbourhood || undefined,
          city: d.city || d.county || undefined,
          address: d.formatted_address || undefined,
          source: 'neshan',
        })
      }
    }
  } catch { /* fall through to nominatim */ }

  // Fallback: OpenStreetMap Nominatim (free, no key)
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=fa&zoom=16`, {
      headers: { 'User-Agent': 'MelkJet/1.0 (melkjet.com)' },
      signal: AbortSignal.timeout(8000),
    })
    if (r.ok) {
      const d = await r.json()
      const a = d.address || {}
      return NextResponse.json({
        neighbourhood: a.neighbourhood || a.suburb || a.quarter || a.city_district || undefined,
        city: a.city || a.town || a.county || undefined,
        address: d.display_name || undefined,
        source: 'osm',
      })
    }
  } catch { /* ignore */ }

  return NextResponse.json({ neighbourhood: undefined, city: undefined, address: undefined, source: 'none' })
}
