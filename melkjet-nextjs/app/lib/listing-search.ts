// فاز ۲۰۴ (فیدبک: «۱۲هزار آگهی داریم؛ باید کارِ اصولی و دقیق انجام بشه») — منطقِ مشترکِ
// «استخراجِ فیلدهای جستجو از آگهی» + «فیلترِ جستجو»، بیرون از کامپوننتِ کلاینت:
// یک منبعِ حقیقت که هم SearchClient (کارت‌ها) و هم /api/map/clusters (نقشهٔ سرورساید،
// روی کلِ استخر) استفاده می‌کنند — تا شمارش/فیلترِ نقشه و فهرست هرگز از هم فاصله نگیرند.
// این توابع عیناً از SearchClient منتقل شده‌اند (رفتار ذره‌ای عوض نشده).

import { dealOf } from './listing-filter'
import { PROPERTY_KINDS } from './taxonomy'

export function seedNum(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const FA_DIGITS: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
}
export function faToEn(s: string): string { return (s || '').replace(/[۰-۹٠-٩]/g, d => FA_DIGITS[d] ?? d) }
export function firstInt(s?: string): number | null { const m = faToEn(s || '').match(/(\d{1,4})/); return m ? parseInt(m[1], 10) : null }

// واحدِ ملک (آپارتمان/ویلا/…) را از متن تشخیص می‌دهد
export function detectKind(text: string): string {
  for (const k of PROPERTY_KINDS) {
    for (const seg of k.split('/')) { if (seg && text.includes(seg)) return k }
  }
  return ''
}

// همهٔ امکاناتِ قابلِ تشخیص (برای فیلتر + تشخیصِ متن)
export const AMENITY_ALL = ['آسانسور', 'پارکینگ', 'انباری', 'بالکن', 'تراس', 'مبله', 'روف گاردن', 'استخر', 'سونا', 'جکوزی', 'لابی', 'سند تک‌برگ', 'بازسازی', 'نوساز']

// ─── تشخیصِ واقعیِ پارامترها از متنِ جستجو (نه فیک) ───────────────────────────
export interface ParsedQuery { kind: string; area: string; sizeNum: number; budgetMax: number; beds: number | null; amenities: string[]; deal: string; tokens: string[] }
const STOP = new Set(['در', 'با', 'و', 'زیر', 'تا', 'حدود', 'حداکثر', 'سقف', 'متری', 'متر', 'میلیارد', 'میلیون', 'تومان', 'خواب', 'خوابه', 'نزدیک', 'حوالی', 'منطقه', 'محله', 'یک', 'دو', 'سه', 'چهار', 'برای', 'فروش', 'اجاره', 'رهن', 'پیش‌فروش', 'پیش'])
export function parseQuery(raw: string): ParsedQuery {
  const t = faToEn(raw)
  const out: ParsedQuery = { kind: '', area: '', sizeNum: 0, budgetMax: 0, beds: null, amenities: [], deal: '', tokens: [] }
  if (!raw.trim()) return out
  if (/پیش[‌\s]?فروش/.test(raw)) out.deal = 'presale'
  else if (/کوتاه[‌\s]?مدت|روزانه|شبی\s/.test(raw)) out.deal = 'daily'   // فاز ۱۹۰: «اجارهٔ روزانه» قبل از rent
  else if (/اجاره|رهن|ودیعه/.test(raw)) out.deal = 'rent'
  out.kind = detectKind(raw)
  const sm = t.match(/(\d{2,4})\s*متر/); if (sm) out.sizeNum = parseInt(sm[1], 10)
  const bm = t.match(/(\d+)\s*خواب/); if (bm) out.beds = parseInt(bm[1], 10)
  const bg = t.match(/(?:زیر|تا|حداکثر|سقف)\s*([\d.]+)\s*(میلیارد|میلیون)?/)
  if (bg) { const n = parseFloat(bg[1]); out.budgetMax = /میلیون/.test(bg[2] || '') ? n / 1000 : n }
  for (const a of AMENITY_ALL) if (raw.includes(a)) out.amenities.push(a)
  const am = raw.match(/در\s+([^\d،,]+?)(?:\s+(?:زیر|با|تا|حدود|حداکثر)|،|$)/)
  if (am) out.area = am[1].replace(/‌/g, ' ').trim()
  // توکن‌های باقی‌مانده (مثلِ نامِ محله/برج) برای جستجوی متنی
  const consumed = new Set<string>([...out.amenities, ...(out.area ? out.area.split(/\s+/) : []), ...(out.kind ? out.kind.split('/') : [])])
  for (const w of raw.split(/[\s،,]+/)) {
    const word = w.trim()
    if (word.length < 2 || STOP.has(word) || consumed.has(word) || /^\d/.test(faToEn(word))) continue
    out.tokens.push(word)
  }
  return out
}

export function bedsMatch(target: number | null, bedsNum: number | null): boolean {
  if (target == null) return true
  if (bedsNum == null) return true
  if (target >= 4) return bedsNum >= 4
  return bedsNum === target
}

// ─── استخراجِ فیلدهای فیلترپذیر از آگهی (عیناً همان toPropertyِ کلاینت، بخشِ غیرنمایشی) ───
export interface DerivedListing {
  id: string; deal: string; location: string
  priceNum: number; bedsNum: number | null; areaNum: number; floorNum: number | null; yearNum: number
  kind: string; searchText: string; lat?: number; lng?: number; score: number
  title: string
}
export function deriveListing(it: { id: string; title: string; price?: string; location?: string; excerpt?: string; category?: string; tags?: string[]; meta?: Record<string, string>; url?: string }): DerivedListing {
  const h = seedNum(it.id)
  const enTitle = faToEn(it.title)
  const rawPrice = parseFloat(faToEn(it.price || '').replace(/[^\d.]/g, '')) || 0
  const ptxt = it.price || ''
  const priceNum = /میلیارد/.test(ptxt) ? rawPrice : /میلیون/.test(ptxt) ? rawPrice / 1000 : rawPrice / 1e9
  const bedsNum = (() => { const m = faToEn(`${it.title} ${it.excerpt || ''} ${it.meta?.['اتاق خواب'] || ''}`).match(/(\d+)\s*خواب/); return m ? parseInt(m[1], 10) : null })()
  const searchText = [it.title, it.location, it.excerpt, it.category, ...(it.tags || [])].filter(Boolean).join(' ').toLowerCase()
  const deal = dealOf(it as Parameters<typeof dealOf>[0])
  const areaNum = firstInt(it.meta?.['متراژ']) ?? (enTitle.match(/(\d+)\s*متر/) ? parseInt(enTitle.match(/(\d+)\s*متر/)![1], 10) : 0)
  const floorNum = firstInt(it.meta?.['طبقه'])
  const yearNum = (() => { const y = firstInt(it.meta?.['سال ساخت']) ?? firstInt(it.meta?.['ساخت']); return y && y > 50 ? y : 0 })()
  const kind = detectKind(`${it.title} ${it.category || ''} ${it.meta?.['نوع ملک'] || ''}`)
  const lat = Number(it.meta?.['__lat']) || undefined
  const lng = Number(it.meta?.['__lng']) || undefined
  return { id: it.id, deal, location: it.location || 'نامشخص', priceNum, bedsNum, areaNum, floorNum, yearNum, kind, searchText, lat, lng, score: h % 100, title: it.title }
}

// ─── فیلترِ مؤثر (فیلترِ دستی اولویت دارد، وگرنه تشخیصِ متن) + خودِ فیلتر ───
export interface EffectiveFilters {
  tab: string; kind: string; beds: number | null
  priceMin: number; budgetMax: number; sizeMin: number; sizeMax: number
  floorMin: number; yearMin: number; amenities: string[]; areaName: string; tokens: string[]
}
/** ورودی‌ها با همان قراردادِ UI: bedsLabel «همه» = بدونِ فیلتر؛ priceMax≤0 = بدونِ سقف. */
export function effectiveFiltersOf(q: {
  tab: string; q: string; kind: string; bedsLabel: string
  priceMin: number; priceMax: number; areaMin: number; areaMax: number
  floorMin: number; yearMin: number; amenities: string[]
}): EffectiveFilters {
  const parsed = parseQuery(q.q)
  return {
    tab: q.tab,
    kind: q.kind || parsed.kind || '',
    beds: q.bedsLabel !== 'همه' && q.bedsLabel ? parseInt(faToEn(q.bedsLabel), 10) : parsed.beds,
    priceMin: q.priceMin,
    budgetMax: q.priceMax > 0 ? q.priceMax : (parsed.budgetMax || 0),
    sizeMin: q.areaMin > 0 ? q.areaMin : (parsed.sizeNum ? Math.floor(parsed.sizeNum * 0.8) : 0),
    sizeMax: q.areaMax > 0 ? q.areaMax : (parsed.sizeNum ? Math.ceil(parsed.sizeNum * 1.2) : 0),
    floorMin: q.floorMin, yearMin: q.yearMin,
    amenities: Array.from(new Set([...q.amenities, ...parsed.amenities])),
    areaName: parsed.area || '', tokens: parsed.tokens,
  }
}

/** همان predicateِ filteredPropertiesِ کلاینت — ذره‌ای تغییرِ رفتار ندارد. */
export function matchesListing(p: DerivedListing, f: EffectiveFilters): boolean {
  if (p.deal !== f.tab) return false
  if (f.kind && p.kind && p.kind !== f.kind) return false
  if (!bedsMatch(f.beds ?? null, p.bedsNum)) return false
  if (f.priceMin > 0 && p.priceNum > 0 && p.priceNum < f.priceMin) return false
  if (f.budgetMax > 0 && p.priceNum > 0 && p.priceNum > f.budgetMax) return false
  if (f.sizeMin > 0 && p.areaNum > 0 && p.areaNum < f.sizeMin) return false
  if (f.sizeMax > 0 && p.areaNum > 0 && p.areaNum > f.sizeMax) return false
  if (f.floorMin > 0 && p.floorNum != null && p.floorNum < f.floorMin) return false
  if (f.yearMin > 0 && p.yearNum > 0 && p.yearNum < f.yearMin) return false
  for (const a of f.amenities) { if (p.searchText.trim() && !p.searchText.includes(a.toLowerCase())) return false }
  if (f.areaName) { const hay = `${p.location} ${p.searchText}`.toLowerCase(); if (!hay.includes(f.areaName.toLowerCase())) return false }
  if (f.tokens.length) {
    const hay = `${p.title} ${p.location} ${p.searchText}`.toLowerCase()
    if (!f.tokens.every(t => hay.includes(t.toLowerCase()))) return false
  }
  return true
}

export const normFa = (s: string) => (s || '').replace(/‌/g, '').replace(/\s/g, '').toLowerCase()
/** شهر = فیلترِ قطعی (همان قانونِ فاز ۱۵۱). */
export const cityMatch = (location: string, city: string) => !city || normFa(location).includes(normFa(city))
