// REOS · Recommendation Feed + Property Ranking Engine (Zillow × TikTok × Amazon)
// PropertyRankingScore = 0.35*UserMatch + 0.20*Quality + 0.15*Engagement + 0.10*Freshness + 0.10*Demand + 0.10*Promotion
import { type UserEntity, type PropertyEntity } from './types'
import { hybridScore } from './hybrid'
import { clamp01, demandScore } from './features'
import { predictEngage } from './train'

export const RANK_WEIGHTS = { userMatch: 0.35, quality: 0.20, engagement: 0.15, freshness: 0.10, demand: 0.10, promotion: 0.10 } as const

export interface FeedCard { id: string; score: number; matchPct: number; reasons: string[]; parts: Record<string, number> }

// کیفیتِ آگهی (۰..۱): کاملیِ اطلاعات = عکس + متراژ + اتاق + توضیحات + قیمت.
function quality(p: PropertyEntity): number {
  let q = 0
  if ((p as any).image || (p.tokens && p.tokens.length)) q += 0.15
  if (p.area) q += 0.2; if (p.rooms) q += 0.15; if (p.price || p.rentMonthly) q += 0.2
  if (p.locationText) q += 0.15; if ((p.features || []).length) q += 0.15
  return clamp01(q)
}
function engagement(p: PropertyEntity): number {
  const raw = Math.log1p(p.views || 0) * 0.3 + Math.log1p(p.contacts || 0) * 1.0 + Math.log1p(p.saves || 0) * 0.8
  return clamp01(1 - Math.exp(-raw / 3))
}
function freshness(p: PropertyEntity): number {
  if (!p.createdAt) return 0.5
  const days = (Date.now() - p.createdAt) / 864e5
  return clamp01(1 - days / 30)
}

// امتیازِ رتبه‌بندیِ ملک برای یک کاربر (با گیتِ کیفیت روی promotion — pay to spam نمی‌شود).
export function propertyRankScore(u: UserEntity, p: PropertyEntity, boost = 0): FeedCard {
  const hy = hybridScore(u, p, { boost })
  const userMatch = hy.layers.rulePass ? hy.final : 0
  const qual = quality(p)
  // engagement = ترکیبِ سیگنالِ خام + پیش‌بینیِ مدلِ آموزش‌دیده (learned engagement propensity).
  const learned = predictEngage(p, u.engagementScore ?? 0.3)
  const eng = clamp01(0.5 * engagement(p) + 0.5 * learned)
  const fresh = freshness(p)
  const dem = demandScore(p)
  const promo = clamp01(boost) * clamp01(0.5 + 0.5 * qual)   // Trust gate: boost × quality
  const score = clamp01(
    RANK_WEIGHTS.userMatch * userMatch + RANK_WEIGHTS.quality * qual + RANK_WEIGHTS.engagement * eng +
    RANK_WEIGHTS.freshness * fresh + RANK_WEIGHTS.demand * dem + RANK_WEIGHTS.promotion * promo,
  )
  return { id: p.id, score: r3(score), matchPct: Math.round(userMatch * 100), reasons: hy.reasons, parts: { userMatch: r3(userMatch), quality: r3(qual), engagement: r3(eng), learned: r3(learned), freshness: r3(fresh), demand: r3(dem), promotion: r3(promo) } }
}

// لایهٔ توضیحِ AI: «چرا این ملک پیشنهاد شد؟»
export function explain(u: UserEntity, card: FeedCard, interactedSimilar: number): string[] {
  const out: string[] = []
  if (card.parts.userMatch >= 0.5 && interactedSimilar > 0) out.push(`مشابهِ ${interactedSimilar.toLocaleString('fa-IR')} فایلی که دیده/ذخیره کرده‌اید`)
  if (card.parts.userMatch >= 0.6) out.push('در بودجه و منطقهٔ موردنظرِ شما')
  if (card.parts.demand >= 0.6) out.push('پرتقاضا در این منطقه')
  if (card.parts.freshness >= 0.8) out.push('تازه ثبت شده')
  if (card.parts.promotion >= 0.5) out.push('آگهیِ ویژه')
  return out.length ? out : card.reasons
}

// ── فیدِ خانه: چند بخش (مثلِ TikTok/Zillow) ──
export interface HomeFeed {
  forYou: FeedCard[]
  hotInArea: FeedCard[]
  freshMatches: FeedCard[]
  priceDrops: FeedCard[]
  investment: FeedCard[]
}
export function buildHomeFeed(u: UserEntity, properties: PropertyEntity[], boosts: Record<string, number> = {}, priceDropIds: Set<string> = new Set(), limit = 12): HomeFeed {
  // Candidate generation (فیلترِ سریع) → Ranking → Business rules
  const scored = properties
    .map(p => ({ p, card: propertyRankScore(u, p, boosts[p.id] || 0) }))
    .filter(x => x.card.parts.userMatch > 0 || x.card.score > 0.2)   // حذفِ کاملاً نامرتبط
  const byScore = [...scored].sort((a, b) => b.card.score - a.card.score)
  const forYou = byScore.slice(0, limit).map(x => x.card)
  const hotInArea = [...scored].sort((a, b) => (b.card.parts.demand + b.card.parts.engagement) - (a.card.parts.demand + a.card.parts.engagement)).slice(0, limit).map(x => x.card)
  const freshMatches = [...scored].filter(x => x.card.parts.freshness >= 0.8 && x.card.parts.userMatch > 0.2).sort((a, b) => b.card.score - a.card.score).slice(0, limit).map(x => x.card)
  const priceDrops = scored.filter(x => priceDropIds.has(x.p.id)).sort((a, b) => b.card.score - a.card.score).slice(0, limit).map(x => x.card)
  const investment = u.intent === 'invest'
    ? [...scored].sort((a, b) => (b.card.parts.demand) - (a.card.parts.demand)).slice(0, limit).map(x => x.card)
    : []
  return { forYou, hotInArea, freshMatches, priceDrops, investment }
}

function r3(x: number): number { return Math.round(x * 1000) / 1000 }
