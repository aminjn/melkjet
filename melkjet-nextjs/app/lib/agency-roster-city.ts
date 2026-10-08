/**
 * شهرِ هر آژانسِ رُستر — برای فیلترِ «جداکردنِ شهرها» در پنلِ هوشِ آژانس (۸ اکتبر).
 *
 * شهر روی خودِ ردیفِ آژانس ذخیره نمی‌شد، چون دیوار آن را در صفحهٔ pro نمی‌دهد؛ شهر
 * خاصیتِ «فایل‌های» آژانس است. دو مسیر دارد و هر دو لازم است:
 *
 *  ۱) سینکِ موفق `city` را روی ردیف می‌نویسد (منبعِ دائمی، بی‌هزینه).
 *  ۲) برای آژانس‌هایی که از آخرین دیپلوی هنوز سینک نشده‌اند، این ماژول همان لحظه
 *     حساب می‌کند — وگرنه فیلترِ شهر تا دو هفته (دورِ کاملِ سینک) خالی می‌مانْد.
 *
 * هزینه عمداً سقف‌دار است: حداکثر **دو** خواندنِ شاردِ advisor برای هر آژانسِ بدونِ
 * `city` (خودِ آژانس = آگهی‌های بی‌امضا، و پرفایل‌ترین مشاورش)، با ۶ کارگرِ موازی و
 * کشِ ده‌دقیقه‌ای. بدونِ این سقف همان دامِ «پنل کلِ پیکره را می‌خواند» می‌شد که
 * CLAUDE.md بارها ثبتش کرده. ردیفی که `city` دارد هیچ خواندنی ندارد.
 *
 * این ماژول عمداً از agency-roster-store چیزی «اجرا» نمی‌کند (فقط type) تا حلقهٔ
 * import نسازد — خودِ store این را صدا می‌زند.
 */
import { getAdvisor } from './advisor-store'
import { cityOfListing } from './listing-similarity'

/** کمینهٔ ساختاریِ یک ردیفِ رُستر که برای یافتنِ شهر لازم است. */
export interface CityProbe {
  id: string
  city?: string
  agencyOwner: string
  agencyPhone?: string
  advisors?: Array<{ owner: string; phone?: string; listingCount?: number }>
}

const TTL = 10 * 60_000
let cache: { at: number; map: Record<string, string> } | null = null

/** پرتکرارترین شهر در یک مجموعه فایل — «شهرِ» آن آژانس. */
function topCity(listings: Array<{ location?: string; meta?: Record<string, string> }>): string {
  const n = new Map<string, number>()
  for (const l of listings) {
    const c = cityOfListing(l)
    if (c) n.set(c, (n.get(c) || 0) + 1)
  }
  let best = '', bn = 0
  for (const [c, k] of n) if (k > bn) { best = c; bn = k }
  return best
}

/** شهرِ یک آژانس از فایل‌هایش. حداکثر دو خواندن؛ خطا = رشتهٔ خالی، نه throw. */
export async function cityOfScrape(s: CityProbe): Promise<string> {
  if (s.city) return s.city
  const top = [...(s.advisors || [])].sort((a, b) => (b.listingCount || 0) - (a.listingCount || 0))[0]
  for (const owner of [s.agencyPhone || s.agencyOwner, top?.phone || top?.owner]) {
    if (!owner) continue
    try {
      const adv = await getAdvisor(owner)
      const c = topCity((adv?.listings || []) as Array<{ location?: string; meta?: Record<string, string> }>)
      if (c) return c
    } catch { /* شاردِ غایب/خطای گذرا — آژانسِ بعدی */ }
  }
  return ''
}

/** نقشهٔ `id → شهر` برای همهٔ آژانس‌ها. `force` کش را دور می‌زند. */
export async function rosterCities(scrapes: CityProbe[], force = false): Promise<Record<string, string>> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache.map
  const map: Record<string, string> = {}
  let i = 0
  const worker = async () => {
    for (;;) {
      const k = i++
      if (k >= scrapes.length) return
      const c = await cityOfScrape(scrapes[k])
      if (c) map[scrapes[k].id] = c
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  cache = { at: Date.now(), map }
  return map
}
