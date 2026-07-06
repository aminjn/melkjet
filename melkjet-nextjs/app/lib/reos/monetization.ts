// REOS · Monetization Engine (Revenue OS)
// Promotion boost · Lead marketplace pricing · Dynamic pricing · Trust gate · AI revenue suggestions
import { clamp01 } from './features'
import type { PropertyEntity, AgentEntity } from './types'

export type PromotionType = 'boost' | 'featured' | 'vip'
export interface Promotion { type: PromotionType; startAt: number; endAt: number; budget?: number }

// امتیازِ Boostِ خام هر نوع تبلیغ (۰..۱) — VIP بیشترین اثر.
const RAW_BOOST: Record<PromotionType, number> = { boost: 0.5, featured: 0.75, vip: 1 }

// Trust-Based Monetization: پول به‌تنهایی رتبه نمی‌خرد. boostِ مؤثر = boostِ خام × کیفیت.
// مشاور/آگهیِ ضعیف حتی با پولِ زیاد رتبهٔ کامل نمی‌گیرد.
export function effectiveBoost(promo: Promotion | null | undefined, qualityScore: number, now = Date.now()): number {
  if (!promo || now < promo.startAt || now > promo.endAt) return 0
  const q = clamp01(0.4 + 0.6 * clamp01(qualityScore))   // کفِ ۰.۴ تا کیفیتِ صفر هم کمی اثر بدهد ولی نه کامل
  return clamp01(RAW_BOOST[promo.type] * q)
}

// ── Lead Marketplace: قیمت‌گذاریِ لید ──
// ارزشِ لید ∝ شدتِ نیت × بودجه × تقاضای منطقه. exclusive گران‌تر از shared.
export function leadValue(input: { intentScore: number; budget: number; regionDemand?: number; exclusive?: boolean }): { price: number; band: [number, number]; tier: string } {
  const intent = clamp01(input.intentScore)
  const budgetTier = clamp01(Math.log1p(input.budget) / Math.log1p(50_000_000_000))   // نسبت به سقفِ ~۵۰ میلیارد
  const demand = clamp01(input.regionDemand ?? 0.5)
  const base = 50_000 + 400_000 * (0.5 * intent + 0.3 * budgetTier + 0.2 * demand)     // ۵۰هزار تا ~۴۵۰هزار
  const price = Math.round((input.exclusive ? base * 2.2 : base) / 1000) * 1000
  const tier = intent >= 0.8 ? 'داغ' : intent >= 0.5 ? 'گرم' : 'سرد'
  return { price, band: [Math.round(price * 0.8), Math.round(price * 1.3)], tier }
}

// ── Dynamic Pricing: ضریبِ زمان/منطقه ──
export function dynamicMultiplier(ctx: { hour?: number; weekend?: boolean; regionHotness?: number }): number {
  let m = 1
  if (ctx.weekend) m *= 1.15
  if (ctx.hour != null && (ctx.hour >= 19 || ctx.hour <= 1)) m *= 1.1   // شب: تقاضای مرور بالا
  if (ctx.regionHotness != null) m *= 1 + clamp01(ctx.regionHotness) * 0.25
  return Math.round(m * 100) / 100
}

// ── Agent Ranking (پول‌سازی + کیفیت): Score = عملکرد + boostِ پرداختی، با گیتِ کیفیت ──
export function agentRankingScore(a: AgentEntity, paidBoost = 0): number {
  const perf = clamp01(0.4 * (a.conversionRate ?? 0) + 0.25 * (a.responseMinutes != null ? 1 - Math.min(1, a.responseMinutes / 120) : 0.5) + 0.2 * ((a.rating ?? 3) / 5) + 0.15 * clamp01(Math.log1p(a.deals || 0) / 3))
  const boost = clamp01(paidBoost) * clamp01(0.5 + 0.5 * perf)   // گیتِ کیفیت روی پول
  return clamp01(0.7 * perf + 0.3 * boost)
}

// ── AI Revenue Optimization: پیشنهادِ درآمدزا برای صاحبِ آگهی/مشاور ──
export function revenueSuggestions(entity: { kind: 'property' | 'agent'; demand?: number; views?: number; medianViews?: number; hasPromotion?: boolean }): string[] {
  const out: string[] = []
  if (entity.kind === 'property') {
    if (!entity.hasPromotion && entity.medianViews && (entity.views ?? 0) < entity.medianViews * 0.7) {
      out.push(`آگهی شما ${Math.round((1 - (entity.views ?? 0) / entity.medianViews) * 100)}٪ کمتر از میانگین دیده شده — با Boost احتمالِ لید چند برابر می‌شود.`)
    }
    if ((entity.demand ?? 0) >= 0.6) out.push('این ملک پرتقاضاست — «پیشنهاد ویژه» آن را به خریدارانِ واقعی می‌رساند.')
  } else {
    if ((entity.demand ?? 0) < 0.4) out.push('برای دریافتِ لیدِ بیشتر، «مشاور طلایی» رتبهٔ شما را در صفحاتِ منطقه بالا می‌برد.')
  }
  return out
}

// ── Revenue Prediction: احتمالِ خریدِ پلن (upsell) ──
export function predictPlanUpsell(usage: { listings: number; leads: number; aiUses: number; loginDays: number }): { prob: number; label: string } {
  const z = -1.6 + 0.05 * Math.min(40, usage.listings) + 0.06 * Math.min(50, usage.leads) + 0.08 * Math.min(30, usage.aiUses) + 0.04 * Math.min(30, usage.loginDays)
  const prob = 1 / (1 + Math.exp(-z))
  return { prob: Math.round(prob * 100) / 100, label: prob >= 0.6 ? 'آمادهٔ ارتقا' : prob >= 0.35 ? 'مستعد' : 'زودهنگام' }
}
