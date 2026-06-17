import { NextRequest, NextResponse } from 'next/server'
import { getAdminData } from '@/app/lib/admin-store'
import { computeNearby } from '@/app/lib/nearby'

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const lat = parseFloat(sp.get('lat') || '')
  const lng = parseFloat(sp.get('lng') || '')
  if (Number.isNaN(lat) || Number.isNaN(lng)) return NextResponse.json({ error: 'مختصات نامعتبر' }, { status: 400 })

  // حالت دیباگ: هر دو کلید (سرویس و نقشه) را روی Search تست می‌کند
  if (sp.get('debug') === '1') {
    const nz = getAdminData().neshan
    const testKey = async (k?: string) => {
      if (!k) return { set: false }
      try {
        const r = await fetch(`https://api.neshan.org/v1/search?term=${encodeURIComponent('بیمارستان')}&lat=${lat}&lng=${lng}`, { headers: { 'Api-Key': k }, signal: AbortSignal.timeout(8000) })
        const t = await r.text()
        return { set: true, tail: '***' + k.slice(-4), status: r.status, ok: r.status === 200, body: t.slice(0, 160) }
      } catch (e: any) { return { set: true, tail: '***' + k.slice(-4), error: e?.message || 'fetch failed' } }
    }
    const [service, map] = await Promise.all([testKey(nz?.serviceKey), testKey(nz?.mapKey)])
    return NextResponse.json({ debug: true, serviceKey: service, mapKey: map })
  }

  const r = await computeNearby(lat, lng)
  return NextResponse.json({ ok: true, ...r })
}
