import { NextRequest, NextResponse } from 'next/server'
import { getAdminData } from '@/app/lib/admin-store'
import { shecanRequest } from '@/app/lib/shecan-https'

// geocode جمعی: چند آدرس/محله → مختصات (برای پین‌کردنِ آگهی‌ها روی نقشه). با کش.
const cache = new Map<string, { lat: number; lng: number } | null>()

async function geocodeOne(q: string, key: string): Promise<{ lat: number; lng: number } | null> {
  if (cache.has(q)) return cache.get(q) || null
  try {
    const r = await shecanRequest(`https://api.neshan.org/v4/geocoding?address=${encodeURIComponent(q)}`, { method: 'GET', headers: { 'Api-Key': key, accept: 'application/json' }, timeout: 8000 })
    let j: any = null; try { j = JSON.parse(r.body) } catch {}
    const loc = j?.location || j?.items?.[0]?.location
    const lat = loc?.y, lng = loc?.x
    const out = (typeof lat === 'number' && typeof lng === 'number' && Math.abs(lat) > 0.1) ? { lat, lng } : null
    cache.set(q, out)
    return out
  } catch { return null }
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({} as any))
  const queries: string[] = Array.isArray(b.queries) ? b.queries.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 40) : []
  const nzk = getAdminData().neshan
  // ترجیحِ کلیدِ سرویس — REST با کلیدِ وب کار نمی‌کند (خودترمیمِ جابه‌جایی، فاز ۳۰)
  const key = [nzk?.serviceKey, nzk?.mapKey].find(k => k && !/^web\./i.test(k)) || nzk?.serviceKey || nzk?.mapKey
  if (!key) return NextResponse.json({ results: {} }, { status: 404 })
  const uniq = Array.from(new Set(queries))
  const results: Record<string, { lat: number; lng: number } | null> = {}
  // ترتیبی تا فشار به سرویس نیاید؛ بیشترشان از کش می‌آیند
  for (const q of uniq) results[q] = await geocodeOne(q, key)
  return NextResponse.json({ results }, { headers: { 'Cache-Control': 'public, max-age=86400' } })
}
