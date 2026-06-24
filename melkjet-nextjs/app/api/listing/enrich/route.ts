import { NextRequest, NextResponse } from 'next/server'
import { getEnrichment } from '@/app/lib/enrich-store'
import { ENRICH_V, ensureEnrichment } from '@/app/lib/enrich-warm'

// کش غنی‌سازیِ هر آگهی: دادهٔ دیوار + تحلیل AI فقط یک‌بار محاسبه و ذخیره می‌شود.
// تولید معمولاً هنگامِ «افزودن» آگهی در پس‌زمینه انجام شده، پس این‌جا فقط از کش می‌خواند.
export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id') || ''
  if (!id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })

  const cached = getEnrichment(id)
  if (cached?.v === ENRICH_V && cached?.baseDone && cached?.analysisOk) {
    return NextResponse.json({ ok: true, cached: true, ...cached })
  }

  const result = await ensureEnrichment(id)
  return NextResponse.json({ ok: true, cached: false, ...result })
}
