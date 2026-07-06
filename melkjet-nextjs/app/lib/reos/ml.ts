// REOS · Machine Learning layer (inference)
// ۴ مدل: تبدیلِ لید، تقاضای ملک، عملکردِ مشاور، بهینه‌سازیِ قیمت.
// پیاده‌سازی: مدلِ لجستیکِ ویژگی‌محور (feature-weighted). آماده برای جایگزینی با وزنِ آموزش‌دیده
// (همان فرمول، فقط بردارِ وزن از فایل/جدولِ آموزش می‌آید). ML system از این نقطه تزریق می‌شود.
import { type AgentEntity, type PropertyEntity, type Prediction } from './types'
import { agentPerf, demandScore, parseFaNum, clamp01 } from './features'

function sigmoid(z: number): number { return 1 / (1 + Math.exp(-z)) }
function logit(features: Record<string, number>, weights: Record<string, number>, bias: number): number {
  let z = bias; for (const k in weights) z += (features[k] || 0) * weights[k]; return sigmoid(z)
}

// ── ۱) Lead Conversion Prediction: احتمالِ بستنِ معامله (۰..۱) ──
const CONV_W = { hasPhone: 1.1, hasBudget: 0.8, stageProgress: 1.6, recency: 0.9, activity: 0.7, agentPerf: 1.2, hasEmail: 0.3 }
const STAGE_IDX: Record<string, number> = { new: 0, contacted: 1, assigned: 1, sent: 2, visit: 3, negotiation: 4, review: 4, offered: 4, contract: 5, closed: 5, won: 5, lost: -3 }
export function predictLeadConversion(lead: {
  phone?: string; email?: string; budget?: string | number; stage?: string; lastActivityAt?: number; createdAt?: number; activityCount?: number
}, agent?: AgentEntity): Prediction {
  const stageIdx = STAGE_IDX[lead.stage || 'new'] ?? 0
  const ageH = (Date.now() - (lead.lastActivityAt || lead.createdAt || Date.now())) / 36e5
  const f: Record<string, number> = {
    hasPhone: lead.phone ? 1 : 0,
    hasEmail: lead.email ? 1 : 0,
    hasBudget: parseFaNum(lead.budget) > 0 ? 1 : 0,
    stageProgress: stageIdx / 5,
    recency: clamp01(1 - Math.min(1, ageH / (24 * 7))),
    activity: clamp01((lead.activityCount || 0) / 6),
    agentPerf: agent ? agentPerf(agent) : 0.5,
  }
  const value = logit(f, CONV_W, -1.4)
  return { value: r3(value), confidence: 0.7, features: f, label: value >= 0.66 ? 'داغ' : value >= 0.4 ? 'گرم' : 'سرد' }
}

// ── ۲) Property Demand Prediction (۰..۱) ──
export function predictPropertyDemand(p: PropertyEntity): Prediction {
  const d = demandScore(p)
  const f = { views: p.views || 0, contacts: p.contacts || 0, saves: p.saves || 0 }
  return { value: r3(d), confidence: (p.views || 0) + (p.contacts || 0) > 5 ? 0.75 : 0.4, features: f, label: d >= 0.6 ? 'پرتقاضا' : d >= 0.3 ? 'متوسط' : 'کم‌تقاضا' }
}

// ── ۳) Agent Performance Model (۰..۱) ──
export function predictAgentPerformance(a: AgentEntity): Prediction {
  const v = agentPerf(a)
  const f = { conversionRate: a.conversionRate || 0, responseMinutes: a.responseMinutes || 0, rating: a.rating || 0, deals: a.deals || 0 }
  return { value: r3(v), confidence: 0.7, features: f, label: v >= 0.66 ? 'عالی' : v >= 0.4 ? 'خوب' : 'نیازمندِ بهبود' }
}

// ── ۴) Price Optimization: قیمتِ پیشنهادی + بازه ──
export function optimizePrice(p: PropertyEntity, market: { medianPricePerM?: number; medianPrice?: number }): { suggested: number; low: number; high: number; note: string } {
  const perM = market.medianPricePerM || 0
  let base = 0
  if (perM && p.area) base = perM * p.area
  else if (market.medianPrice) base = market.medianPrice
  else base = p.price || 0
  // تعدیل با تقاضا: تقاضای بالا → +، پایین → −
  const d = demandScore(p)
  const adj = 1 + (d - 0.5) * 0.12                    // ±۶٪
  const suggested = Math.round(base * adj)
  return {
    suggested,
    low: Math.round(suggested * 0.94),
    high: Math.round(suggested * 1.08),
    note: d >= 0.6 ? 'تقاضا بالاست — قیمتِ کمی بالاتر قابل‌قبول است' : d < 0.3 ? 'تقاضا پایین است — قیمتِ رقابتی پیشنهاد می‌شود' : 'قیمتِ متعادلِ بازار',
  }
}

function r3(x: number): number { return Math.round(x * 1000) / 1000 }
