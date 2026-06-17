import { NextRequest, NextResponse } from 'next/server'
import { getAdminData } from '@/app/lib/admin-store'
import { shecanRequest } from '@/app/lib/shecan-https'

// Reverse geocoding: lat/lng → neighbourhood/city/address.
// Uses Neshan when a service key is configured, otherwise OSM Nominatim.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const lat = parseFloat(sp.get('lat') || '')
  const lng = parseFloat(sp.get('lng') || '')
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: 'مختصات نامعتبر' }, { status: 400 })
  }

  // هر دو کلید نشان را امتحان کن (سرور بین‌الملل ندارد، پس فقط نشان از طریق DNS شکن)
  const nz = getAdminData().neshan
  const keys = Array.from(new Set([nz?.serviceKey, nz?.mapKey].filter(Boolean) as string[]))
  for (const key of keys) {
    try {
      const r = await shecanRequest(`https://api.neshan.org/v5/reverse?lat=${lat}&lng=${lng}`, { method: 'GET', headers: { 'Api-Key': key, accept: 'application/json' }, timeout: 8000 })
      if (r.status === 200) {
        const d = JSON.parse(r.body)
        return NextResponse.json({
          neighbourhood: d.neighbourhood || undefined,
          city: d.city || d.county || undefined,
          address: d.formatted_address || undefined,
          source: 'neshan',
        })
      }
    } catch { /* try next key */ }
  }

  return NextResponse.json({ neighbourhood: undefined, city: undefined, address: undefined, source: 'none' })
}
