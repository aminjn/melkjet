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
// فاز ۵۷ (فیدبک: «کلیدِ گپ را عوض کردم، تحلیل نمی‌آید»): هر تلاشِ شکست‌خورده (کلیدِ نامعتبر/شبکه/
// پاسخِ خراب — از جمله مهرهای قدیمیِ بدونِ فیلدِ جدید) کول‌داونِ کوتاه می‌گیرد تا بعد از رفعِ
// مشکل، تحلیل خودش ظرفِ چند دقیقه برگردد؛ کول‌داونِ بلند فقط مالِ حالتِ موفق است (بازتولید نکن).
const ANALYSIS_ERR_COOLDOWN = 10 * 60 * 1000
const cooldownOf = (c: Enrichment) => ((c.analysisOk || c.analysisErr === false) ? ANALYSIS_COOLDOWN : ANALYSIS_ERR_COOLDOWN)
// فاز ۲۰۱ (فیدبک: «جدیداً مکان‌های نزدیک رو نمی‌گه، عکس‌ها باز نمی‌شه»): جارویِ enrich در ساعاتی که
// پروکسیِ دیوار اشباع بود اجرا شد؛ fetchDivarPost شکست را با reason برمی‌گرداند (نه exception) و
// generate همان جوابِ خالی را baseDone قطعی کش می‌کرد → گالری/geo/nearby برای همیشه خالی می‌ماند.
// حالا شکستِ گذرا فقط baseTriedAt می‌گیرد و بعدِ این کول‌داون دوباره تلاش می‌شود.
export const BASE_ERR_COOLDOWN = 30 * 60 * 1000
// شکستِ قطعی (توکنِ خراب یا 4xx غیر از 429 — آگهیِ حذف‌شده): تلاشِ دوباره بی‌فایده است → همان‌جا نهایی کن.
const permanentReason = (r?: string) => !!r && (r === 'bad_token' || (/^http_4\d\d$/.test(r) && r !== 'http_429'))

async function generate(id: string): Promise<Enrichment> {
  const it = await getItemById(id)
  if (!it) return {}
  let cur = getEnrichment(id) || {}
  if (cur.v !== ENRICH_V) cur = {}

  if (!cur.baseDone) {
    // فاز ۲۰۱: بعدِ شکستِ گذرا تا پایانِ کول‌داون دوباره سراغِ دیوار نرو (تلاش در جاروی بعدی)
    if (cur.baseTriedAt && Date.now() - cur.baseTriedAt < BASE_ERR_COOLDOWN) return cur
    let gallery: string[] | undefined, facts: any[] = [], amenities: string[] = [], description: string | undefined
    let geo: { lat: number; lng: number } | undefined
    const token = divarToken(it.url)
    if (token) {
      const g = await fetchDivarPost(token)
      if (g.reason && !g.images?.length && !g.description && !permanentReason(g.reason)) {
        // شکستِ گذرا (پروکسی/شبکه/429) — نهایی نکن؛ فقط مهرِ تلاش بزن تا جارو بعداً برگردد.
        return patchEnrichment(id, { v: ENRICH_V, baseTriedAt: Date.now() })
      }
      gallery = g.images?.length ? g.images : undefined
      facts = g.facts || []
      amenities = g.amenities || []
      description = g.description || undefined
      if (typeof g.lat === 'number' && typeof g.lng === 'number') geo = { lat: g.lat, lng: g.lng }
    }
    // فاز ۲۰۳ (فیدبک: «همچنان مکان‌های نزدیک رو نشون نمی‌ده» — آگهیِ ثبتِ کاربر): geo فقط از دیوار
    // می‌آمد؛ آگهیِ ثبتِ کاربر/مشاور مختصاتش در متایِ خودِ آگهی است → nearby هرگز ساخته نمی‌شد.
    if (!geo) {
      const mlat = Number(it.meta?.['__lat']), mlng = Number(it.meta?.['__lng'])
      if (mlat && mlng) geo = { lat: mlat, lng: mlng }
    }
    let nearby: any[] = []
    if (geo) { try { nearby = (await computeNearby(geo.lat, geo.lng)).nearby } catch { nearby = [] } }
    cur = patchEnrichment(id, { v: ENRICH_V, gallery, facts, amenities, description, geo, nearby, baseDone: true })
    // فاز ۲۰۱ (فیدبک: «نزدیک ۴۰۰۰ آگهی داریم ولی نقشه ۴۰ تا نشون می‌ده»): مختصاتِ به‌دست‌آمده از
    // دیوار روی خودِ آگهی هم بنشیند (meta.__lat/__lng) تا نقشهٔ جستجو پین‌دار شود — فقط اگر نداشت.
    if (geo && !(Number(it.meta?.['__lat']) && Number(it.meta?.['__lng']))) {
      try {
        const { setItemCoords } = await import('./scraper-store')
        await setItemCoords(id, geo.lat, geo.lng)
      } catch { /* غیرحیاتی — جاروی بعدی دوباره geo دارد */ }
    }
  }

  if (!cur.analysisOk) {
    // تحلیل فقط یک‌بار (و در صورتِ شکست، با کول‌داون) تلاش می‌شود — نه در هر بازکردنِ آگهی.
    const tried = cur.analysisTriedAt || 0
    if (Date.now() - tried >= cooldownOf(cur)) {
      cur = patchEnrichment(id, { v: ENRICH_V, analysisTriedAt: Date.now() })
      const a = await analyzeListing({
        title: it.title, price: it.price, location: it.location,
        facts: cur.facts || [], description: cur.description || it.excerpt || '',
        meta: it.meta, amenities: cur.amenities || [],
      })
      if (a.analysis) cur = patchEnrichment(id, { v: ENRICH_V, analysis: a.analysis, analysisOk: true, analysisErr: false, analysisNote: '' })
      else {
        // فاز ۲۱۰ (فیدبک: «همچنان آگهی بدونِ تحلیل هست» — بارِ سوم): شکست دیگر بی‌صدا نیست؛
        // علتِ دقیق هم در کش می‌نشیند (در پاسخِ /api/listing/enrich دیده می‌شود) هم در لاگِ pm2.
        const note = String(a.error || 'خطای نامشخص').slice(0, 200)
        console.error(`[enrich] analysis FAILED ${id}: ${note}`)
        cur = patchEnrichment(id, { v: ENRICH_V, analysisErr: true, analysisNote: note })   // فاز ۵۷: کول‌داونِ کوتاه برای شکستِ سرویسی
      }
    }
  }
  return cur
}

export function isEnriched(id: string): boolean {
  const c = getEnrichment(id)
  if (!c || c.v !== ENRICH_V) return false
  // فاز ۲۰۱: پایه بعدِ شکستِ گذرا در کول‌داون است → فعلاً «رها کن» (جارو بعدِ کول‌داون برمی‌گردد)
  if (!c.baseDone) return !!c.baseTriedAt && (Date.now() - c.baseTriedAt < BASE_ERR_COOLDOWN)
  if (c.analysisOk) return true
  // تحلیل اخیراً تلاش شده ولی هنوز نشده → تا پایانِ کول‌داون دوباره گرم نکن (جلوگیری از تکرارِ AI).
  return !!c.analysisTriedAt && (Date.now() - c.analysisTriedAt < cooldownOf(c))
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
// فاز ۲۱۱: ۲→۳ — با بک‌لاگِ ۱۲هزارتایی و قانونِ «اولین بازدید تحلیل‌دار»، توانِ بیشتر لازم است
const WARM_CONCURRENCY = 3
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
