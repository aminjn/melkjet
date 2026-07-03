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
// اگر تحلیلِ AI شکست بخورد، تا این مدت دوباره تلاش نمی‌شود (تا هر بار بازکردنِ آگهی AI صدا نزند).
const ANALYSIS_COOLDOWN = 6 * 60 * 60 * 1000

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
    // تحلیل فقط یک‌بار (و در صورتِ شکست، با کول‌داون) تلاش می‌شود — نه در هر بازکردنِ آگهی.
    const tried = cur.analysisTriedAt || 0
    if (Date.now() - tried >= ANALYSIS_COOLDOWN) {
      cur = patchEnrichment(id, { v: ENRICH_V, analysisTriedAt: Date.now() })
      const a = await analyzeListing({
        title: it.title, price: it.price, location: it.location,
        facts: cur.facts || [], description: cur.description || it.excerpt || '',
        meta: it.meta, amenities: cur.amenities || [],
      })
      if (a.analysis) cur = patchEnrichment(id, { v: ENRICH_V, analysis: a.analysis, analysisOk: true })
    }
  }
  return cur
}

export function isEnriched(id: string): boolean {
  const c = getEnrichment(id)
  if (!c || c.v !== ENRICH_V || !c.baseDone) return false
  if (c.analysisOk) return true
  // تحلیل اخیراً تلاش شده ولی هنوز نشده → تا پایانِ کول‌داون دوباره گرم نکن (جلوگیری از تکرارِ AI).
  return !!c.analysisTriedAt && (Date.now() - c.analysisTriedAt < ANALYSIS_COOLDOWN)
}

/** غنی‌سازی را تولید یا از کش برمی‌گرداند (با حذفِ درخواست‌های هم‌زمانِ تکراری). */
export function ensureEnrichment(id: string): Promise<Enrichment> {
  let p = inflight.get(id)
  if (!p) { p = generate(id).finally(() => inflight.delete(id)); inflight.set(id, p) }
  return p
}

// ── صفِ پیش‌گرمِ پس‌زمینه با محدودیتِ هم‌زمانی ─────────────────────────────
// هنگامِ اسکرپ ممکن است ده‌ها آگهیِ جدید بیاید؛ نباید هم‌زمان ده‌ها درخواستِ AI بفرستیم.
const warmQueue: string[] = []
let warmRunning = 0
const WARM_CONCURRENCY = 2
function pumpWarm() {
  while (warmRunning < WARM_CONCURRENCY && warmQueue.length) {
    const id = warmQueue.shift()!
    if (isEnriched(id)) continue
    warmRunning++
    ensureEnrichment(id).catch(() => {}).finally(() => { warmRunning--; pumpWarm() })
  }
}

/** پیش‌گرم‌کردنِ کش در پس‌زمینه هنگامِ اسکرپ/افزودن/انتشارِ آگهی — بدون انتظار (fire-and-forget). */
export function warmEnrichment(id: string): void {
  if (!id || isEnriched(id) || warmQueue.includes(id)) return
  warmQueue.push(id)
  pumpWarm()
}

/** پیش‌گرمِ گروهیِ آگهی‌های تازه‌اسکرپ‌شده. */
export function warmMany(ids: string[]): void {
  for (const id of ids) warmEnrichment(id)
}
