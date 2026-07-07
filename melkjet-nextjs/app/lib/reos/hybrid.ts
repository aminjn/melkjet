// REOS · Hybrid AI Ranking (Production) — ۴ لایه + فرمولِ نهاییِ نسخهٔ تولید
// FinalScore = 0.30*ML_Conversion + 0.25*Vector + 0.20*Rule + 0.15*Behavioral + 0.10*BusinessBoost
import { type UserEntity, type PropertyEntity } from './types'
import { userVector, propertyVector, cosine, tokenize, clamp01 } from './features'
import { budgetMatch, locationMatch, intentStrength } from './scoring'
import { config } from './reos-config'

export const HYBRID_WEIGHTS = { ml: 0.30, vector: 0.25, rule: 0.20, behavioral: 0.15, boost: 0.10 } as const

export interface HybridResult {
  final: number
  layers: { rulePass: boolean; ruleScore: number; ml: number; vector: number; behavioral: number; boost: number }
  reasons: string[]
}

// Layer 1 — Rule engine (فیلترِ سریع + امتیازِ قاعده‌مند). rulePass=false یعنی رد.
function ruleLayer(u: UserEntity, p: PropertyEntity): { pass: boolean; score: number } {
  const price = p.deal === 'rent' ? (p.rentMonthly || p.price || 0) : (p.price || 0)
  if (u.budget && price && price > u.budget * 1.3) return { pass: false, score: 0 }   // قیمت خیلی بالاتر از بودجه → رد
  const bm = budgetMatch(u.budget || 0, price)
  const lm = locationMatch(u.lat ?? null, u.lng ?? null, p.lat ?? null, p.lng ?? null, textOverlap(u.locationText, p.locationText))
  const is = intentStrength(u.intent || null, p.deal || null, clamp01(u.engagementScore ?? 0.3))
  return { pass: true, score: clamp01(0.45 * bm + 0.35 * lm + 0.2 * is) }
}
// Layer 2 — ML conversion probability (لجستیک روی ویژگی‌های تطبیق).
function mlConversion(bm: number, vector: number, demand: number, engagement: number): number {
  const z = -1.0 + 2.2 * bm + 1.6 * vector + 0.9 * demand + 0.8 * engagement
  return 1 / (1 + Math.exp(-z))
}
function textOverlap(a?: string, b?: string): number {
  const sa = new Set(tokenize(a)), sb = tokenize(b)
  if (!sa.size || !sb.length) return 0
  let hit = 0; for (const t of sb) if (sa.has(t)) hit++
  return Math.min(1, hit / Math.max(3, sb.length))
}

// boost = ۰..۱ (از Monetization: featured/boost/vip، با گیتِ کیفیت اعمال‌شده بیرون).
export function hybridScore(u: UserEntity, p: PropertyEntity, opts: { boost?: number } = {}): HybridResult {
  const uv = userVector(u), pv = propertyVector(p)
  const rule = ruleLayer(u, p)
  if (!rule.pass) return { final: 0, layers: { rulePass: false, ruleScore: 0, ml: 0, vector: 0, behavioral: 0, boost: 0 }, reasons: ['خارج از بودجه'] }
  const vector = cosine(uv.embed, pv.embed)
  const bm = budgetMatch(u.budget || 0, pv.price)
  const ml = mlConversion(bm, vector, pv.demand, uv.engagement)
  const behavioral = clamp01(0.6 * uv.engagement + 0.4 * vector)
  const boost = clamp01(opts.boost ?? 0)
  const HW = config().hybrid   // وزن‌ها از تنظیماتِ سوپرادمین (پیش‌فرض = HYBRID_WEIGHTS)
  const final = clamp01(
    HW.ml * ml +
    HW.vector * vector +
    HW.rule * rule.score +
    HW.behavioral * behavioral +
    HW.boost * boost,
  )
  const reasons: string[] = []
  if (ml >= 0.6) reasons.push('احتمالِ تبدیلِ بالا')
  if (vector >= 0.5) reasons.push('هم‌راستا با سلیقه')
  if (rule.score >= 0.7) reasons.push('در بودجه/منطقه')
  if (boost >= 0.5) reasons.push('آگهیِ ویژه')
  if (!reasons.length) reasons.push('گزینهٔ محتمل')
  return { final: r3(final), layers: { rulePass: true, ruleScore: r3(rule.score), ml: r3(ml), vector: r3(vector), behavioral: r3(behavioral), boost: r3(boost) }, reasons }
}

// رتبه‌بندیِ هایبریدِ فهرستِ املاک برای یک کاربر (فیدِ تولید).
export function hybridRank(u: UserEntity, properties: PropertyEntity[], boosts: Record<string, number> = {}, limit = 20) {
  const out = properties.map(p => ({ id: p.id, ...hybridScore(u, p, { boost: boosts[p.id] || 0 }) }))
    .filter(m => m.layers.rulePass)
  out.sort((a, b) => b.final - a.final)
  return out.slice(0, limit)
}

function r3(x: number): number { return Math.round(x * 1000) / 1000 }
