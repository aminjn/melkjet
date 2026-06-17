import { NextRequest, NextResponse } from 'next/server'
import { getAdminData } from '@/app/lib/admin-store'
import { computeNearby } from '@/app/lib/nearby'

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const lat = parseFloat(sp.get('lat') || '')
  const lng = parseFloat(sp.get('lng') || '')
  if (Number.isNaN(lat) || Number.isNaN(lng)) return NextResponse.json({ error: 'مختصات نامعتبر' }, { status: 400 })

  // حالت دیباگ: هر دو کلید را روی هر سه سرویس (Search / Reverse / Distance-Matrix) تست می‌کند
  if (sp.get('debug') === '1') {
    const nz = getAdminData().neshan
    const hit = async (k: string, url: string) => {
      try {
        const r = await fetch(url, { headers: { 'Api-Key': k }, signal: AbortSignal.timeout(8000) })
        return { status: r.status, ok: r.status === 200 }
      } catch (e: any) { return { error: e?.message || 'fetch failed' } }
    }
    const testKey = async (label: string, k?: string) => {
      if (!k) return { label, set: false }
      const [search, reverse, matrix] = await Promise.all([
        hit(k, `https://api.neshan.org/v1/search?term=${encodeURIComponent('بانک')}&lat=${lat}&lng=${lng}`),
        hit(k, `https://api.neshan.org/v5/reverse?lat=${lat}&lng=${lng}`),
        hit(k, `https://api.neshan.org/v1/distance-matrix?type=car&origins=${lat},${lng}&destinations=${lat + 0.01},${lng + 0.01}`),
      ])
      return { label, set: true, tail: '***' + k.slice(-4), search, reverse, matrix }
    }
    const [service, map] = await Promise.all([testKey('serviceKey', nz?.serviceKey), testKey('mapKey', nz?.mapKey)])
    return NextResponse.json({ debug: true, service, map, hint: 'برای «دسترسی‌های اطراف» باید search و matrix روی یکی از کلیدها status:200 بدهند.' })
  }

  const r = await computeNearby(lat, lng)
  return NextResponse.json({ ok: true, ...r })
}
