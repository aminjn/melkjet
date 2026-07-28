import { NextRequest, NextResponse } from 'next/server'
import { computeNearby } from '@/app/lib/nearby'
import { geoApiCfg, geoGeocode, geoReverse, geoSearch, geoMatrix } from '@/app/lib/geo-api'

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const lat = parseFloat(sp.get('lat') || '')
  const lng = parseFloat(sp.get('lng') || '')
  if (Number.isNaN(lat) || Number.isNaN(lng)) return NextResponse.json({ error: 'مختصات نامعتبر' }, { status: 400 })

  // فاز ۲۳۴ — حالتِ دیباگ: هر چهار سرویسِ سامانهٔ نقشهٔ اختصاصی روی همین نقطه تست می‌شود.
  if (sp.get('debug') === '1') {
    const cfg = geoApiCfg()
    if (!cfg.baseUrl) return NextResponse.json({ debug: true, configured: false, hint: 'ادمین → اتصال‌ها → سامانهٔ نقشه: آدرس و کلید را وارد کن.' })
    const [search, reverse, matrix, geocode] = await Promise.all([
      geoSearch('', { lat, lng, radius: 1000, limit: 3 }).then(r => ({ ok: true, count: r.length, sample: r[0]?.name || '' })).catch(e => ({ ok: false, error: String(e?.message || e) })),
      geoReverse(lat, lng).then(r => ({ ok: !!r, city: r?.city || '', neighbourhood: r?.neighbourhood || '' })).catch(e => ({ ok: false, error: String(e?.message || e) })),
      geoMatrix([{ lat, lng }], [{ lat: lat + 0.01, lng: lng + 0.01 }], 'pedestrian').then(m => ({ ok: !!m, durS: m?.durations?.[0]?.[0] ?? null })).catch(e => ({ ok: false, error: String(e?.message || e) })),
      geoGeocode('میدان آزادی تهران').then(g => ({ ok: !!g, loc: g ? `${g.lat.toFixed(3)},${g.lng.toFixed(3)}` : '' })).catch(e => ({ ok: false, error: String(e?.message || e) })),
    ])
    return NextResponse.json({ debug: true, configured: true, baseUrl: cfg.baseUrl, search, reverse, matrix, geocode, hint: 'مسیرِ اصلی: search شعاعی + matrix. مسیرِ پشتیبان: reverse + geocode.' })
  }

  const r = await computeNearby(lat, lng)
  return NextResponse.json({ ok: true, ...r })
}
