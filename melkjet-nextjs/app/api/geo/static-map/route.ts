import { NextRequest } from 'next/server'
import { getAdminData } from '@/app/lib/admin-store'

// Neshan static map image (domestic, reliable from Iran). Proxied so the key stays server-side.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const lat = parseFloat(sp.get('lat') || ''), lng = parseFloat(sp.get('lng') || '')
  if (Number.isNaN(lat) || Number.isNaN(lng)) return new Response('bad coords', { status: 400 })

  const key = getAdminData().neshan?.serviceKey
  if (!key) return new Response('no-neshan-key', { status: 404 })

  const url = `https://api.neshan.org/v4/static?key=${encodeURIComponent(key)}&type=neshan&zoom=15&center=${lat},${lng}&width=720&height=320&marker=red,${lat},${lng}`
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!r.ok) return new Response('neshan-error', { status: 502 })
    const buf = await r.arrayBuffer()
    return new Response(buf, { headers: { 'content-type': r.headers.get('content-type') || 'image/png', 'cache-control': 'public, max-age=86400' } })
  } catch {
    return new Response('fetch-failed', { status: 502 })
  }
}
