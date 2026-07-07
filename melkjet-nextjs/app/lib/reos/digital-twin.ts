// REOS v4 · Property Digital Twin — هر ملک یک موجودیتِ زندهٔ تحلیلی.
// ترکیبِ AVM + تقاضا (بازدید/تماسِ واقعی) + هوشِ بازار + مالی → پیش‌بینیِ فروش/نقدشوندگی/ریسک/اطمینان.
// هستهٔ خالص (twinMetrics) تست‌پذیر؛ buildTwin از دادهٔ واقعی می‌سازد.
import { getItemById } from '../scraper-store'
import { forIds } from '../listing-stats-store'
import { itemToProperty } from './data'
import { valuate } from './avm'
import { getMarketIntel } from './market-intel'
import { demandScore, parseFaNum, clamp01 } from './features'
import { rentalYield } from './investor'
import { config } from './reos-config'
import type { PropertyEntity } from './types'

function r1(x: number) { return Math.round(x * 10) / 10 }

// ── سنجه‌های خالص (تست‌پذیر) ──
// نقدشوندگی ۰..۱۰: تقاضای ملک + نقدشوندگیِ منطقه.
export function liquidityScore(demand: number, areaLiquidity = 0.5): number {
  return r1(clamp01(0.6 * clamp01(demand) + 0.4 * clamp01(areaLiquidity)) * 10)
}
// روزهای تا فروش: تقاضای بالا + قیمتِ زیرِ بازار = سریع‌تر. priceVsMarket: -0.2=۲۰٪ زیر، +0.2=۲۰٪ بالای بازار.
export function daysToSell(demand: number, priceVsMarket: number): number {
  const base = 90
  const demandFactor = 1 - clamp01(demand) * 0.7
  const priceFactor = priceVsMarket <= 0 ? Math.max(0.5, 1 + priceVsMarket * 1.5) : 1 + Math.min(2, priceVsMarket * 2.5)
  return Math.max(5, Math.round(base * demandFactor * priceFactor))
}
// احتمالِ فروش در پنجرهٔ N روزه (توزیعِ نمایی).
export function saleProbability(days: number, windowDays = 45): number {
  return Math.round((1 - Math.exp(-windowDays / Math.max(1, days))) * 100)
}
// پروفایلِ ریسک: قیمتِ خیلی بالای بازار، تقاضای پایین، آگهیِ ناقص، کهنگی.
export function riskProfile(input: { priceVsMarket: number; demand: number; completeness: number; ageDays?: number }): { score: number; level: 'کم' | 'متوسط' | 'بالا'; factors: string[] } {
  const factors: string[] = []
  let s = 0
  if (input.priceVsMarket > 0.12) { s += 0.35; factors.push('قیمتِ بالاتر از بازار') }
  if (input.demand < 0.3) { s += 0.3; factors.push('تقاضای پایین') }
  if (input.completeness < 0.6) { s += 0.2; factors.push('اطلاعاتِ ناقصِ آگهی') }
  if ((input.ageDays ?? 0) > 90) { s += 0.15; factors.push('آگهیِ قدیمی') }
  const score = Math.round(clamp01(s) * 100)
  return { score, level: score < 30 ? 'کم' : score < 60 ? 'متوسط' : 'بالا', factors: factors.length ? factors : ['ریسکِ قابل‌توجهی شناسایی نشد'] }
}
// اطمینانِ AI ۰..۱۰۰: تعدادِ comparable + کاملیِ داده.
export function aiConfidence(comps: number, completeness: number): number {
  return Math.round(clamp01(0.6 * Math.min(1, comps / 8) + 0.4 * clamp01(completeness)) * 100)
}
export function completenessOf(p: PropertyEntity): number {
  let c = 0
  if (p.area) c += 0.2; if (p.rooms) c += 0.15; if (p.price || p.rentMonthly) c += 0.2
  if (p.locationText) c += 0.15; if ((p.features || []).length) c += 0.15; if (p.lat && p.lng) c += 0.15
  return clamp01(c)
}

export interface Twin {
  id: string; title?: string
  valuation: { estimate: number; low: number; high: number; confidence: number; pricePerM: number }
  demand: number; liquidity: number; daysToSell: number; saleProbability: number
  priceVsMarket: number; rentalYield: number | null
  risk: { score: number; level: string; factors: string[] }
  aiConfidence: number; trend: 'up' | 'down' | 'flat'; note: string
}

// ── ساختِ Twin از دادهٔ واقعی ──
export async function buildTwin(propertyId: string): Promise<Twin | null> {
  const it = await getItemById(propertyId)
  if (!it) return null
  const stats = await forIds([propertyId]).catch(() => ({} as Record<string, { views: number; contacts: number }>))
  const stat = stats[propertyId] || { views: 0, contacts: 0 }
  const p = itemToProperty(it, stat)
  const avm = await valuate(propertyId).catch(() => null)
  const areaKey = [String(it.meta?.['شهر'] || '').trim(), String(it.meta?.['محله'] || it.location || '').trim()].filter(Boolean).join('|')
  const intel = areaKey ? await getMarketIntel(areaKey).catch(() => null) : null

  const demand = demandScore(p)
  const actualPerM = p.area && p.price ? p.price / p.area : 0
  const fairPerM = avm?.pricePerM || 0
  const priceVsMarket = actualPerM && fairPerM ? (actualPerM - fairPerM) / fairPerM : 0
  const days = daysToSell(demand, priceVsMarket)
  const completeness = completenessOf(p)
  const monthlyRent = parseFaNum(String(it.meta?.['اجاره'] || it.meta?.['اجاره ماهیانه'] || '')) || (p.deal === 'rent' ? p.rentMonthly || 0 : 0)
  const tw = config().twin   // آستانه‌ها از تنظیماتِ سوپرادمین
  const over = tw.overpricePct / 100, under = tw.underpricePct / 100

  return {
    id: propertyId, title: it.title,
    valuation: { estimate: avm?.estimate || 0, low: avm?.low || 0, high: avm?.high || 0, confidence: avm?.confidence || 0, pricePerM: fairPerM },
    demand: Math.round(demand * 100) / 100,
    liquidity: liquidityScore(demand, intel?.liquidityIndex ?? 0.5),
    daysToSell: days,
    saleProbability: saleProbability(days, tw.saleWindowDays),
    priceVsMarket: Math.round(priceVsMarket * 1000) / 10,   // درصد
    rentalYield: monthlyRent && p.price ? rentalYield(monthlyRent * 12, p.price) : null,
    risk: riskProfile({ priceVsMarket, demand, completeness, ageDays: p.createdAt ? (Date.now() - p.createdAt) / 864e5 : 0 }),
    aiConfidence: aiConfidence(avm?.comps || 0, completeness),
    trend: intel?.trend || 'flat',
    note: priceVsMarket > over ? 'قیمت بالاتر از بازار — احتمالِ کاهش/مذاکره' : priceVsMarket < -under ? 'قیمتِ رقابتی — احتمالِ فروشِ سریع' : 'قیمتِ نزدیک به بازار',
  }
}
