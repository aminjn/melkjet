import { NextRequest, NextResponse } from 'next/server'
import { getItemById } from '@/app/lib/scraper-store'
import { getEnrichment, patchEnrichment, Enrichment } from '@/app/lib/enrich-store'

// صف/کش غنی‌سازی هر آگهی: داده‌های دیوار + تحلیل AI + دسترسی‌های نشان فقط یک‌بار
// محاسبه و ذخیره می‌شوند؛ دفعات بعدی از کش خوانده می‌شود (نه بازتولید AI).

const inflight = new Map<string, Promise<Enrichment>>()

async function jget(url: string) { try { const r = await fetch(url); return r.ok ? await r.json() : null } catch { return null } }
async function jpost(url: string, body: any) { try { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return r.ok ? await r.json() : null } catch { return null } }

async function generate(id: string, origin: string): Promise<Enrichment> {
  const it = getItemById(id)
  if (!it) return {}
  let cur = getEnrichment(id) || {}

  // ۱) بخش‌های غیر-AI (دیوار + نشان) فقط یک‌بار
  if (!cur.baseDone) {
    let gallery: string[] | undefined, facts: any[] = [], amenities: string[] = [], description: string | undefined
    let geo: { lat: number; lng: number } | undefined
    const m = (it.url || '').match(/divar\.ir\/v\/([A-Za-z0-9_-]+)/)
    if (m) {
      const g = await jget(`${origin}/api/divar/post?id=${id}`)
      if (g) {
        gallery = g.images?.length ? g.images : undefined
        facts = g.facts || []
        amenities = g.amenities || []
        description = g.description || undefined
        if (typeof g.lat === 'number' && typeof g.lng === 'number') geo = { lat: g.lat, lng: g.lng }
      }
    }
    let nearby: any[] = []
    if (geo) { const n = await jget(`${origin}/api/geo/nearby?lat=${geo.lat}&lng=${geo.lng}`); nearby = n?.nearby || [] }
    cur = patchEnrichment(id, { gallery, facts, amenities, description, geo, nearby, baseDone: true })
  }

  // ۲) تحلیل AI فقط یک‌بار با موفقیت؛ تا وقتی موفق نشده، دفعهٔ بعد دوباره تلاش می‌شود
  if (!cur.analysisOk) {
    const a = await jpost(`${origin}/api/ai/analyze`, {
      title: it.title, price: it.price, location: it.location,
      facts: cur.facts || [], description: cur.description || it.excerpt || '',
      meta: it.meta, amenities: cur.amenities || [],
    })
    if (a?.ok && a.analysis) cur = patchEnrichment(id, { analysis: a.analysis, analysisOk: true })
  }
  return cur
}

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id') || ''
  if (!id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  const origin = new URL(req.url).origin

  const cached = getEnrichment(id)
  // اگر همه‌چیز (پایه + تحلیل AI) آماده است، مستقیم از کش بده
  if (cached?.baseDone && cached?.analysisOk) {
    return NextResponse.json({ ok: true, cached: true, ...cached })
  }

  // در غیر این صورت یک‌بار تولید کن (با قفل برای جلوگیری از تولید همزمان تکراری)
  let p = inflight.get(id)
  if (!p) { p = generate(id, origin).finally(() => inflight.delete(id)); inflight.set(id, p) }
  const result = await p
  return NextResponse.json({ ok: true, cached: false, ...result })
}
