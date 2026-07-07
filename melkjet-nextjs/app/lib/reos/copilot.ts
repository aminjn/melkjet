// REOS v4 · AI Copilot Everywhere — پیشنهادهای بهبودِ آگهی (عنوان/قیمت/عکس/زمان‌بندی).
// هستهٔ خالص (listingSuggestions) تست‌پذیر؛ copilotForListing روی داده + Digital Twin سوار است.
import { getItemById } from '../scraper-store'
import { buildTwin } from './digital-twin'
import { parseFaNum } from './features'

export type SugField = 'title' | 'price' | 'photos' | 'description' | 'timing'
export type Severity = 'good' | 'info' | 'warn'
export interface Suggestion { field: SugField; severity: Severity; message: string }

export interface ListingCtx {
  title?: string; area?: string; rooms?: number; meters?: number
  photoCount?: number; hasDescription?: boolean
  priceVsMarket?: number; saleProbability?: number
}

export function listingSuggestions(x: ListingCtx): Suggestion[] {
  const out: Suggestion[] = []
  const t = (x.title || '').trim()
  // ── عنوان ──
  if (t.length < 15) out.push({ field: 'title', severity: 'warn', message: 'عنوان کوتاه است — نوعِ ملک، متراژ و محله را اضافه کنید.' })
  else {
    const missing: string[] = []
    if (x.meters && !/[\d۰-۹]/.test(t)) missing.push('متراژ')
    const hood = (x.area || '').split(/[،,]/).pop()?.trim()
    if (hood && hood.length > 1 && !t.includes(hood)) missing.push('محله')
    if (x.rooms && !/خواب|اتاق/.test(t)) missing.push('تعدادِ خواب')
    if (missing.length) out.push({ field: 'title', severity: 'info', message: `برای دیده‌شدنِ بهتر، به عنوان اضافه کنید: ${missing.join('، ')}.` })
    else out.push({ field: 'title', severity: 'good', message: 'عنوانِ کامل و بهینه.' })
  }
  // ── عکس ──
  const pc = x.photoCount ?? 0
  if (pc === 0) out.push({ field: 'photos', severity: 'warn', message: 'بدونِ عکس — آگهی‌های دارای عکس چند برابر بیشتر دیده می‌شوند.' })
  else if (pc < 4) out.push({ field: 'photos', severity: 'info', message: `فقط ${pc.toLocaleString('fa-IR')} عکس — حداقل ۵ عکس توصیه می‌شود.` })
  else out.push({ field: 'photos', severity: 'good', message: 'تعدادِ عکسِ مناسب.' })
  // ── توضیحات ──
  if (x.hasDescription === false) out.push({ field: 'description', severity: 'info', message: 'توضیحات اضافه کنید (امکانات، موقعیت، وضعیتِ سند).' })
  // ── قیمت ──
  if ((x.priceVsMarket ?? 0) > 10) out.push({ field: 'price', severity: 'warn', message: `قیمت حدودِ ${Math.round(x.priceVsMarket!)}٪ بالاتر از بازار — کاهش، سرعتِ فروش را زیاد می‌کند.` })
  else if ((x.priceVsMarket ?? 0) < -8) out.push({ field: 'price', severity: 'good', message: 'قیمتِ رقابتی — فرصتِ فروشِ سریع.' })
  // ── زمان‌بندی ──
  if ((x.saleProbability ?? 0) >= 60) out.push({ field: 'timing', severity: 'good', message: `احتمالِ فروش در ۴۵ روز: ${Math.round(x.saleProbability!)}٪ — وضعیتِ خوب.` })
  else if ((x.saleProbability ?? 0) > 0) out.push({ field: 'timing', severity: 'info', message: `احتمالِ فروشِ ۴۵روزه ${Math.round(x.saleProbability!)}٪ — با بهبودِ عنوان/قیمت/عکس بالا می‌رود.` })
  return out
}

// امتیازِ سلامتِ آگهی (۰..۱۰۰): از تعدادِ هشدار/اطلاع.
export function listingHealth(sug: Suggestion[]): number {
  let s = 100
  for (const x of sug) { if (x.severity === 'warn') s -= 22; else if (x.severity === 'info') s -= 8 }
  return Math.max(0, Math.min(100, s))
}

export async function copilotForListing(propertyId: string): Promise<{ score: number; suggestions: Suggestion[]; saleProbability: number | null } | null> {
  const it = await getItemById(propertyId)
  if (!it) return null
  const twin = await buildTwin(propertyId).catch(() => null)
  const gallery = String(it.meta?.['__gallery'] || '')
  const photoCount = gallery ? gallery.split(/[\n,]+/).map(s => s.trim()).filter(Boolean).length : (it.image ? 1 : 0)
  const sug = listingSuggestions({
    title: it.title, area: it.location || String(it.meta?.['محله'] || ''),
    meters: parseFaNum(String(it.meta?.['متراژ'] || '')) || undefined, rooms: parseFaNum(String(it.meta?.['اتاق خواب'] || '')) || undefined,
    photoCount, hasDescription: !!(it.excerpt && it.excerpt.length > 20),
    priceVsMarket: twin?.priceVsMarket, saleProbability: twin?.saleProbability,
  })
  return { score: listingHealth(sug), suggestions: sug, saleProbability: twin?.saleProbability ?? null }
}
