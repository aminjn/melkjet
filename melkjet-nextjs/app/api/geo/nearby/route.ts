import { NextRequest, NextResponse } from 'next/server'
import { computeNearby } from '@/app/lib/nearby'
import { geoApiCfg, geoSearch } from '@/app/lib/geo-api'

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const lat = parseFloat(sp.get('lat') || '')
  const lng = parseFloat(sp.get('lng') || '')
  if (Number.isNaN(lat) || Number.isNaN(lng)) return NextResponse.json({ error: 'مختصات نامعتبر' }, { status: 400 })

  // فاز ۲۳۴→۲۴۴ — حالتِ دیباگ: هر چهار سرویس با «کدِ وضعیتِ HTTP و تکهٔ پاسخِ خام» — سندِ قطعی
  // برای سمتِ سامانهٔ نقشه (0 = تایم‌اوت/شبکه، 401 = کلید، 404 = مسیر، 500 = خطای داخلی/دیتابیس).
  if (sp.get('debug') === '1') {
    const cfg = geoApiCfg()
    if (!cfg.baseUrl) return NextResponse.json({ debug: true, configured: false, hint: 'ادمین → اتصال‌ها → سامانهٔ نقشه: آدرس و کلید را وارد کن.' })
    const { geoDebugProbe } = await import('@/app/lib/geo-api')
    const probes = await geoDebugProbe()
    const search = await geoSearch('', { lat, lng, radius: 1000, limit: 3 }).then(r => ({ ok: true, count: r.length, sample: r[0]?.name || '' })).catch(e => ({ ok: false, error: String((e as Error)?.message || e) }))
    return NextResponse.json({ debug: true, configured: true, baseUrl: cfg.baseUrl, searchAtPoint: search, probes })
  }

  const r = await computeNearby(lat, lng)
  return NextResponse.json({ ok: true, ...r })
}
