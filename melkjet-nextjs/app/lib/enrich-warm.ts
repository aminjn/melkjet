import { getItemById } from './scraper-store'
import { getEnrichment, patchEnrichment, type Enrichment } from './enrich-store'
import { fetchDivarPost, divarToken } from './divar-post'
import { computeNearby } from './nearby'
import { analyzeListing } from './analyze'

// غنی‌سازیِ هر آگهی (دیوار + نزدیکی‌ها + تحلیل AI) فقط یک‌بار محاسبه و کش می‌شود.
// این ماژول مشترک است: هم endpointِ خواندن از آن استفاده می‌کند، هم هنگامِ «افزودن/
// انتشارِ» آگهی در پس‌زمینه صدا زده می‌شود تا اولین بازِ کاربر سریع باشد.

export const ENRICH_V = 4
const inflight = new Map<string, Promise<Enrichment>>()

async function generate(id: string): Promise<Enrichment> {
  const it = getItemById(id)
  if (!it) return {}
  let cur = getEnrichment(id) || {}
  if (cur.v !== ENRICH_V) cur = {}

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
    cur = patchEnrichment(id, { v: ENRICH_V, gallery, facts, amenities, description, geo, nearby, baseDone: true })
  }

  if (!cur.analysisOk) {
    const a = await analyzeListing({
      title: it.title, price: it.price, location: it.location,
      facts: cur.facts || [], description: cur.description || it.excerpt || '',
      meta: it.meta, amenities: cur.amenities || [],
    })
    if (a.analysis) cur = patchEnrichment(id, { v: ENRICH_V, analysis: a.analysis, analysisOk: true })
  }
  return cur
}

export function isEnriched(id: string): boolean {
  const c = getEnrichment(id)
  return !!(c && c.v === ENRICH_V && c.baseDone && c.analysisOk)
}

/** غنی‌سازی را تولید یا از کش برمی‌گرداند (با حذفِ درخواست‌های هم‌زمانِ تکراری). */
export function ensureEnrichment(id: string): Promise<Enrichment> {
  let p = inflight.get(id)
  if (!p) { p = generate(id).finally(() => inflight.delete(id)); inflight.set(id, p) }
  return p
}

/** پیش‌گرم‌کردنِ کش در پس‌زمینه هنگامِ افزودن/انتشارِ آگهی — بدون انتظار (fire-and-forget). */
export function warmEnrichment(id: string): void {
  if (!id || isEnriched(id)) return
  ensureEnrichment(id).catch(() => { /* دفعهٔ بعد دوباره تلاش می‌شود */ })
}
