// REOS v3 · AVM — Automated Valuation Model (ارزش‌گذاریِ خودکار با املاکِ مشابه/comparables).
// هستهٔ خالص (avmFromComps) تست‌پذیر است؛ valuate از دادهٔ واقعی comps می‌سازد و تعدیلِ تقاضا می‌زند.
import { getItemById, candidateListings } from '../scraper-store'
import { itemToProperty } from './data'
import { parseFaNum } from './features'

export interface Comp { id?: string; perM: number; sim: number }
export interface AvmResult { estimate: number; low: number; high: number; confidence: number; pricePerM: number; comps: number; method: string; note: string }

// میانگینِ وزنیِ قیمتِ هر متر + بازه/اطمینان از پراکندگیِ comps.
export function avmFromComps(targetAreaM: number, comps: Comp[], demand = 0.5): AvmResult {
  const valid = comps.filter(c => c.perM > 0)
  if (valid.length < 1 || !targetAreaM) return { estimate: 0, low: 0, high: 0, confidence: 0, pricePerM: 0, comps: valid.length, method: 'insufficient', note: 'دادهٔ کافی برای ارزش‌گذاری نیست' }
  const wSum = valid.reduce((a, c) => a + Math.max(0.05, c.sim), 0)
  const perM = valid.reduce((a, c) => a + c.perM * Math.max(0.05, c.sim), 0) / wSum
  // پراکندگی (ضریبِ تغییرات) برای بازه و اطمینان
  const mean = valid.reduce((a, c) => a + c.perM, 0) / valid.length
  const variance = valid.reduce((a, c) => a + (c.perM - mean) ** 2, 0) / valid.length
  const cv = mean ? Math.sqrt(variance) / mean : 0.5
  // تعدیلِ تقاضا: تقاضای بالا کمی قیمت را بالا می‌برد (±۵٪).
  const adjPerM = perM * (1 + (clamp01(demand) - 0.5) * 0.1)
  const estimate = Math.round(adjPerM * targetAreaM)
  const band = Math.min(0.25, 0.05 + cv)
  const confidence = Math.round(clamp01(Math.min(1, valid.length / 8) * (1 - Math.min(0.8, cv))) * 100)
  return {
    estimate, low: Math.round(estimate * (1 - band)), high: Math.round(estimate * (1 + band)),
    confidence, pricePerM: Math.round(adjPerM), comps: valid.length, method: 'comparables',
    note: confidence >= 60 ? 'ارزش‌گذاریِ مطمئن بر پایهٔ فایل‌های مشابه' : confidence >= 30 ? 'ارزش‌گذاریِ تقریبی — comparablesِ محدود' : 'اطمینانِ پایین — فایلِ مشابهِ کافی نیست',
  }
}

const areaKey = (it: { meta?: Record<string, string>; location?: string }) => {
  const m = it.meta || {}
  return [String(m['شهر'] || '').trim(), String(m['محله'] || it.location || '').trim()].filter(Boolean).join('|')
}

// ارزش‌گذاریِ یک آگهیِ واقعی: comparablesِ هم‌منطقه‌ی فروشی با قیمت+متراژ.

// ── فایل‌های مشابهِ همان محله — مبنای مشترکِ AVM و «جایگاهِ بازار» ──────────────
// یک منبع، تا این دو هرگز از هم جدا نیفتند.
async function compsFor(propertyId: string): Promise<{ area: number; comps: Comp[]; targetPerM: number } | null> {
  const it = await getItemById(propertyId)
  if (!it) return null
  const p = itemToProperty(it)
  if (!p.area) return null
  const tArea = areaKey(it)
  // سقفِ ۶۰۰ باعث می‌شد AVM فقط بخشی از فایل‌های محله را ببیند و میانه را جابه‌جا کند
  // (جاهدشهر: ۱۲۱ م/متر به‌جای ۹۹ که میانهٔ واقعیِ ۵۳۹ فایل است). فهرست کش‌شده است.
  const items = await candidateListings(20000)
  const comps: Comp[] = []
  for (const x of items) {
    if (x.id === propertyId) continue
    if (areaKey(x) !== tArea) continue
    if (x.meta?.['نوع معامله'] === 'اجاره') continue
    const price = parseFaNum(x.price), m = parseFaNum(String(x.meta?.['متراژ'] || ''))
    if (price > 0 && m > 0) comps.push({ id: x.id, perM: price / m, sim: 1 })
  }
  const own = parseFaNum(it.price)
  return { area: p.area, comps, targetPerM: own > 0 ? own / p.area : 0 }
}

/** جایگاهِ این فایل در بازارِ واقعیِ محله — همه از دادهٔ ثبت‌شده، بدونِ هیچ تخمینِ رفتاری. */
export interface MarketPosition {
  comps: number; cheaperThanPct: number; p25PerM: number; p75PerM: number; targetPerM: number
}
export async function marketPosition(propertyId: string): Promise<MarketPosition | null> {
  const c = await compsFor(propertyId)
  if (!c || c.comps.length < 5 || !c.targetPerM) return null   // زیرِ ۵ نمونه، ادعا نمی‌کنیم
  const arr = c.comps.map(x => x.perM).sort((a, b) => a - b)
  const dearer = arr.filter(v => v > c.targetPerM).length
  const q = (f: number) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(f * (arr.length - 1))))]
  return {
    comps: arr.length,
    cheaperThanPct: Math.round((dearer / arr.length) * 100),
    p25PerM: Math.round(q(0.25)), p75PerM: Math.round(q(0.75)),
    targetPerM: Math.round(c.targetPerM),
  }
}

export async function valuate(propertyId: string): Promise<AvmResult & { targetArea?: number }> {
  const it = await getItemById(propertyId)
  if (!it) return { ...empty(), note: 'ملک یافت نشد' }
  const p = itemToProperty(it)
  if (!p.area) return { ...empty(), note: 'متراژِ ملک نامشخص است' }
  const c = await compsFor(propertyId)
  const comps: Comp[] = c?.comps || []
  const res = avmFromComps(p.area, comps, p.views || p.contacts ? clamp01((p.contacts || 0) / 10 + 0.3) : 0.5)
  return { ...res, targetArea: p.area }
}
function empty(): AvmResult { return { estimate: 0, low: 0, high: 0, confidence: 0, pricePerM: 0, comps: 0, method: 'none', note: '' } }
function clamp01(x: number): number { return Math.max(0, Math.min(1, x)) }
