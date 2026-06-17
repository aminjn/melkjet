import { NextRequest, NextResponse } from 'next/server'
import { getItemById } from '@/app/lib/scraper-store'
import { getEnrichment, patchEnrichment, Enrichment } from '@/app/lib/enrich-store'
import { fetchDivarPost, divarToken } from '@/app/lib/divar-post'
import { computeNearby } from '@/app/lib/nearby'
import { analyzeListing } from '@/app/lib/analyze'

// صف/کش غنی‌سازی هر آگهی: دادهٔ دیوار + تحلیل AI + دسترسی‌های نشان فقط یک‌بار محاسبه
// و ذخیره می‌شود؛ دفعات بعد از کش خوانده می‌شود. همهٔ کارها مستقیم با توابع داخلی
// انجام می‌شود (نه fetch به دامنهٔ عمومی) تا به شبکهٔ بیرونی سرور وابسته نباشد.

const inflight = new Map<string, Promise<Enrichment>>()
const V = 4  // نسخهٔ کش؛ با بالا بردن این عدد، کش‌های قدیمی نادیده گرفته می‌شوند

async function generate(id: string): Promise<Enrichment> {
  const it = getItemById(id)
  if (!it) return {}
  let cur = getEnrichment(id) || {}
  if (cur.v !== V) cur = {}   // ورودی قدیمی/خراب را دور بریز و از نو بساز

  // ۱) بخش‌های غیر-AI (دیوار + نشان) فقط یک‌بار
  if (!cur.baseDone) {
    let gallery: string[] | undefined, facts: any[] = [], amenities: string[] = [], description: string | undefined
    let geo: { lat: number; lng: number } | undefined
    const token = divarToken(it.url)
    if (token) {
      const g = await fetchDivarPost(token)
      gallery = g.images?.length ? g.images : undefined
      facts = g.facts || []
      amenities = g.amenities || []
      description = g.description || undefined
      if (typeof g.lat === 'number' && typeof g.lng === 'number') geo = { lat: g.lat, lng: g.lng }
    }
    let nearby: any[] = []
    if (geo) { try { nearby = (await computeNearby(geo.lat, geo.lng)).nearby } catch { nearby = [] } }
    cur = patchEnrichment(id, { v: V, gallery, facts, amenities, description, geo, nearby, baseDone: true })
  }

  // ۲) تحلیل AI فقط یک‌بار با موفقیت؛ تا موفق نشده، دفعهٔ بعد دوباره تلاش می‌شود
  if (!cur.analysisOk) {
    const a = await analyzeListing({
      title: it.title, price: it.price, location: it.location,
      facts: cur.facts || [], description: cur.description || it.excerpt || '',
      meta: it.meta, amenities: cur.amenities || [],
    })
    if (a.analysis) cur = patchEnrichment(id, { v: V, analysis: a.analysis, analysisOk: true })
  }
  return cur
}

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id') || ''
  if (!id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })

  const cached = getEnrichment(id)
  if (cached?.v === V && cached?.baseDone && cached?.analysisOk) {
    return NextResponse.json({ ok: true, cached: true, ...cached })
  }

  let p = inflight.get(id)
  if (!p) { p = generate(id).finally(() => inflight.delete(id)); inflight.set(id, p) }
  const result = await p
  return NextResponse.json({ ok: true, cached: false, ...result })
}
