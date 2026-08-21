// آمارِ واقعیِ بازارِ محله — فقط از آگهی‌های ثبت‌شده.
// هیچ سنجهٔ رفتاری (بازدید/تماس) اینجا نیست: تا وقتی ترافیکِ واقعی نداریم «تقاضا»
// قابلِ اندازه‌گیری نیست، و عددِ ساختگی از نبودِ عدد بدتر است.
import { listItems, type Item } from '../scraper-store'
import { parseFaNum, rentPartsOf } from './features'
import { RENT_CONVERT } from './area-insight'

export const DEAL_SALE = 'فروش'
export const DEAL_RENT = 'اجاره'

export interface AreaCell {
  city: string; hood: string; deal: string; ptype: string
  listings: number
  /** فروش: قیمتِ کلِ متری · اجاره: اجارهٔ ماهانهٔ متری */
  medianPerM: number; p25PerM: number; p75PerM: number
  medianArea: number
  /** فقط اجاره: میانهٔ ودیعه */
  medianDeposit?: number
}

const KEY = (c: string, h: string, d: string, t: string) => [c, h, d, t].join('|')
const q = (a: number[], f: number) => a[Math.min(a.length - 1, Math.max(0, Math.floor(f * (a.length - 1))))]

/** واحدِ سنجش بر حسبِ نوعِ معامله — چسباندنِ ودیعه و اجاره ریشهٔ اعدادِ نجومی بود. */
function perMeterOf(it: Item, deal: string, area: number): { perM: number; deposit?: number } | null {
  if (deal === DEAL_SALE) {
    const price = parseFaNum(it.price)
    return price > 0 ? { perM: price / area } : null
  }
  if (deal === DEAL_RENT) {
    const parts = rentPartsOf(it.price)
    const monthly = parts?.monthly || 0
    const deposit = parts?.deposit || 0
    // اجارهٔ مؤثر: ودیعه با نرخِ عرفی به اجاره تبدیل می‌شود، وگرنه «رهنِ کامل» با
    // اجارهٔ اسمیِ ۱۰ هزار تومان «۱۰۰٪ زیرِ میانه» می‌شد و ۶۴۲ فایل کلاً حذف می‌شدند.
    const eff = monthly + deposit * RENT_CONVERT
    if (!(eff > 0)) return null
    return { perM: eff / area, deposit }
  }
  return null   // اجارهٔ کوتاه‌مدت واحدِ دیگری دارد (شبانه) — قاطی نمی‌شود
}

interface Bucket { perM: number[]; area: number[]; deposit: number[] }

/** سلول و قیمتِ متریِ یک آگهی — همان منطقِ آمار، برای مصرفِ بیرونی (پنلِ پیشنهادها). */
export function itemCell(it: Item): { city: string; hood: string; deal: string; ptype: string; area: number; perM: number; deposit?: number } | null {
  const meta = it.meta || {}
  const city = String(meta['شهر'] || '').trim()
  const hood = String(meta['محله'] || '').trim()
  const deal = String(meta['نوع معامله'] || '').trim()
  const ptype = String(meta['نوع ملک'] || '').trim()
  if (!hood || !deal || !ptype) return null
  const area = parseFaNum(String(meta['متراژ'] || ''))
  if (!(area > 0)) return null
  const v = perMeterOf(it, deal, area)
  if (!v || !(v.perM > 0)) return null
  return { city, hood, deal, ptype, area, perM: v.perM, deposit: v.deposit }
}

function cellsOf(items: Item[]): Map<string, Bucket> {
  const m = new Map<string, Bucket>()
  for (const it of items) {
    const c = itemCell(it)
    if (!c) continue
    const k = KEY(c.city, c.hood, c.deal, c.ptype)
    const g = m.get(k) || { perM: [], area: [], deposit: [] }
    g.perM.push(c.perM); g.area.push(c.area)
    if (c.deposit != null && c.deposit > 0) g.deposit.push(c.deposit)
    m.set(k, g)
  }
  return m
}

function toCell(k: string, g: Bucket): AreaCell {
  const [city, hood, deal, ptype] = k.split('|')
  const perM = [...g.perM].sort((a, b) => a - b)
  const area = [...g.area].sort((a, b) => a - b)
  const dep = [...g.deposit].sort((a, b) => a - b)
  return {
    city, hood, deal, ptype, listings: perM.length,
    medianPerM: Math.round(q(perM, 0.5)), p25PerM: Math.round(q(perM, 0.25)), p75PerM: Math.round(q(perM, 0.75)),
    medianArea: Math.round(q(area, 0.5)),
    medianDeposit: dep.length ? Math.round(q(dep, 0.5)) : undefined,
  }
}

/** سلول‌های دارای نمونهٔ کافی. `hoods` = محدودکردن به محله‌های یک مشاور. */
export async function areaCells(opts?: { hoods?: string[]; city?: string; minSamples?: number; items?: Item[] }): Promise<AreaCell[]> {
  const min = opts?.minSamples ?? 5
  const items = opts?.items ?? await listItems('listing', { publicOnly: true })
  const want = opts?.hoods?.length ? new Set(opts.hoods.map(h => h.trim()).filter(Boolean)) : null
  const city = (opts?.city || '').trim()
  const out: AreaCell[] = []
  for (const [k, g] of cellsOf(items)) {
    if (g.perM.length < min) continue
    const c = toCell(k, g)
    if (want && !want.has(c.hood)) continue
    if (city && c.city !== city) continue
    out.push(c)
  }
  return out.sort((a, b) => b.listings - a.listings)
}

export interface PriceGuide {
  perM: { median: number; p25: number; p75: number }
  samples: number
  basis: string
  deal: string
  suggested?: number
  suggestedDeposit?: number
}

/** راهنمای قیمت هنگامِ ثبتِ آگهی — با افتِ پله‌ای و اعلامِ صریحِ منبع. */
export async function priceGuide(input: {
  city?: string; hood?: string; deal: string; ptype: string; area?: number
}): Promise<PriceGuide | null> {
  const items = await listItems('listing', { publicOnly: true })
  const all = [...cellsOf(items)].map(([k, g]) => ({ c: toCell(k, g), g }))
  const city = (input.city || '').trim(), hood = (input.hood || '').trim()

  const pick = (fn: (c: AreaCell) => boolean, basis: string): PriceGuide | null => {
    const perM: number[] = [], dep: number[] = []
    for (const { c, g } of all) if (fn(c)) { perM.push(...g.perM); dep.push(...g.deposit) }
    if (perM.length < 5) return null
    perM.sort((a, b) => a - b); dep.sort((a, b) => a - b)
    const median = Math.round(q(perM, 0.5))
    return {
      perM: { median, p25: Math.round(q(perM, 0.25)), p75: Math.round(q(perM, 0.75)) },
      samples: perM.length, basis, deal: input.deal,
      suggested: input.area && input.area > 0 ? Math.round(median * input.area) : undefined,
      suggestedDeposit: dep.length ? Math.round(q(dep, 0.5)) : undefined,
    }
  }

  // شهر همیشه در شرط هست — وگرنه «شهرک غربِ مشهد» با «شهرک غربِ تهران» قاطی می‌شود.
  const sameCity = (c: AreaCell) => !city || c.city === city
  return (
    (hood ? pick(c => sameCity(c) && c.hood === hood && c.deal === input.deal && c.ptype === input.ptype,
      `${hood}${city ? '، ' + city : ''} · ${input.ptype} · ${input.deal}`) : null) ||
    (hood ? pick(c => sameCity(c) && c.hood === hood && c.deal === input.deal,
      `${hood}${city ? '، ' + city : ''} · همهٔ انواع · ${input.deal}`) : null) ||
    (city ? pick(c => c.city === city && c.deal === input.deal && c.ptype === input.ptype,
      `${city} · ${input.ptype} · ${input.deal}`) : null) ||
    pick(c => c.deal === input.deal && c.ptype === input.ptype,
      `کلِ بازار · ${input.ptype} · ${input.deal}`)
  )
}
