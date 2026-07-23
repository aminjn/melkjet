import { NextRequest, NextResponse } from 'next/server'
import { getEnrichment, patchEnrichment } from '@/app/lib/enrich-store'
import { ENRICH_V, warmEnrichment } from '@/app/lib/enrich-warm'

// کشِ غنی‌سازیِ هر آگهی: دادهٔ دیوار + تحلیلِ AI فقط یک‌بار (هنگامِ اسکرپ) محاسبه و ذخیره می‌شود.
// این endpoint فقط از دیتابیس می‌خواند و هرگز در مسیرِ بازکردنِ آگهی، AI را به‌صورتِ همزمان اجرا نمی‌کند —
// اگر آگهی هنوز غنی نشده باشد، فقط یک پیش‌گرمِ پس‌زمینه راه می‌اندازد و دادهٔ موجود را برمی‌گرداند.

// فاز ۲۰۱ — ترمیمِ «دسترسی‌های اطراف» در مسیرِ خواندن: geo داریم ولی nearby خالی کش شده
// (شکستِ نشان در لحظهٔ غنی‌سازی). هر ۶ ساعت یک‌بار، در پس‌زمینه دوباره ساخته و ذخیره می‌شود.
const NEARBY_RETRY_MS = 6 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id') || ''
  if (!id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })

  const cached = getEnrichment(id)
  const complete = cached?.v === ENRICH_V && cached?.baseDone && cached?.analysisOk
  if (!complete) warmEnrichment(id)   // پس‌زمینه، بدونِ انتظار — نتیجه در اسکرپِ بعدی/رفرش می‌آید
  // فاز ۲۰۳: geo از کش یا از متایِ خودِ آگهی (آگهیِ ثبتِ کاربر geo دیواری ندارد ولی مختصات دارد)
  // فاز ۲۰۷ب: nearbyِ «همه-دور» (میراثِ شعاعِ ۷کیلومتری — فیدبک: «کاربر مسخره می‌کند») هم خراب حساب
  // می‌شود: در پس‌زمینه با منطقِ سخت‌گیرِ جدید بازسازی و جایگزین می‌شود؛ نشد → پاک (هیچ بهتر از مضحک).
  const allFar = (cached?.nearby?.length || 0) > 0 && cached!.nearby!.every(n => typeof (n as { meters?: number }).meters === 'number' && (n as { meters?: number }).meters! > 3500)
  if (cached?.baseDone && (!cached.nearby?.length || allFar) && Date.now() - (cached.nearbyTriedAt || 0) > NEARBY_RETRY_MS) {
    const cachedGeo = cached.geo
    patchEnrichment(id, { nearbyTriedAt: Date.now() })
    ;(async () => {
      try {
        let g = cachedGeo
        if (!g) {
          const { getItemById } = await import('@/app/lib/scraper-store')
          const it = await getItemById(id)
          const mlat = Number(it?.meta?.['__lat']), mlng = Number(it?.meta?.['__lng'])
          if (mlat && mlng) g = { lat: mlat, lng: mlng }
        }
        if (!g) return
        const { computeNearby } = await import('@/app/lib/nearby')
        const n = (await computeNearby(g.lat, g.lng)).nearby
        if (n?.length) patchEnrichment(id, { nearby: n, geo: g })
        else if (allFar) patchEnrichment(id, { nearby: [] })   // فهرستِ مضحکِ قدیمی پاک شود
      } catch { /* تلاشِ بعدی بعدِ کول‌داون */ }
    })()
  }
  return NextResponse.json({ ok: true, cached: !!complete, pending: !complete, ...(cached || {}) })
}
