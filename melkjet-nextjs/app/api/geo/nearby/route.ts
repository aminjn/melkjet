import { NextRequest, NextResponse } from 'next/server'
import { getAdminData } from '@/app/lib/admin-store'
import { computeNearby } from '@/app/lib/nearby'
import { shecanRequest } from '@/app/lib/shecan-https'

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
        const r = await shecanRequest(url, { method: 'GET', headers: { 'Api-Key': k, accept: 'application/json' }, timeout: 8000 })
        return { status: r.status, ok: r.status === 200, body: r.body.slice(0, 120) }
      } catch (e: any) { return { error: e?.message || 'fetch failed' } }
    }
    const testKey = async (label: string, k?: string) => {
      if (!k) return { label, set: false }
      const [search, reverse, matrix, geocode] = await Promise.all([
        hit(k, `https://api.neshan.org/v1/search?term=${encodeURIComponent('بانک')}&lat=${lat}&lng=${lng}`),
        hit(k, `https://api.neshan.org/v5/reverse?lat=${lat}&lng=${lng}`),
        hit(k, `https://api.neshan.org/v1/distance-matrix?type=car&origins=${lat},${lng}&destinations=${lat + 0.01},${lng + 0.01}`),
        // فاز ۲۰۶ج: سلامتِ geocoding هم دیده شود — مسیرِ جایگزینِ nearby (بدونِ Search) به آن تکیه دارد
        hit(k, `https://api.neshan.org/v4/geocoding?address=${encodeURIComponent('میدان آزادی تهران')}`),
      ])
      return { label, set: true, tail: '***' + k.slice(-4), search, reverse, matrix, geocode }
    }
    const [service, map] = await Promise.all([testKey('serviceKey', nz?.serviceKey), testKey('mapKey', nz?.mapKey)])
    return NextResponse.json({ debug: true, service, map, hint: 'دقیق‌ترین حالت: search+matrix هر دو ۲۰۰ روی یک کلید. مسیرِ جایگزین (بدونِ Search): reverse+geocode+matrix ۲۰۰ کافی است.' })
  }

  const r = await computeNearby(lat, lng)
  return NextResponse.json({ ok: true, ...r })
}
