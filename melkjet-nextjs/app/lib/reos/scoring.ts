// REOS · Global Scoring Engine
// FinalScore = 0.35*Budget + 0.25*Location + 0.15*Behavior + 0.10*Intent + 0.10*Historical + 0.05*Demand
import { type UserVector, type PropertyVector, type ScoreBreakdown, type Match } from './types'
import { cosine, haversineKm, clamp01 } from './features'

export const WEIGHTS = { budget: 0.35, location: 0.25, behavior: 0.15, intent: 0.10, historical: 0.10, demand: 0.05 } as const

// ── زیرامتیازها (همه ۰..۱) ──
// بودجه: قیمتِ زیرِ بودجه = ۱؛ بالای بودجه با فاصله افت می‌کند (تا +۲۵٪ قابلِ‌قبول).
export function budgetMatch(userBudget: number, price: number): number {
  if (!userBudget || !price) return 0.5              // ناشناخته → خنثی
  if (price <= userBudget) return 1
  const over = (price - userBudget) / userBudget
  return clamp01(1 - over / 0.25)                     // ۲۵٪ بالاتر → ۰
}
// موقعیت: فاصلهٔ جغرافیایی (اگر مختصات بود) وگرنه اشتراکِ توکنِ متنی.
export function locationMatch(uLat: number | null, uLng: number | null, pLat: number | null, pLng: number | null, textOverlap: number): number {
  if (uLat != null && uLng != null && pLat != null && pLng != null) {
    const km = haversineKm(uLat, uLng, pLat, pLng)
    return clamp01(1 - km / 15)                       // تا ۱۵ کیلومتر خطیِ نزولی
  }
  return clamp01(textOverlap)
}
// رفتار: شباهتِ برداریِ رفتارِ کاربر با ملک.
export function behaviorMatch(u: UserVector, p: PropertyVector): number { return cosine(u.embed, p.embed) }
// شدتِ نیت: تطبیقِ نیت با نوعِ معامله + قطعیتِ نیت.
export function intentStrength(intent: string | null, deal: string | null, engagement: number): number {
  if (!intent) return 0.4
  const map: Record<string, string> = { buy: 'sale', rent: 'rent', invest: 'sale' }
  const want = map[intent]
  const dealOk = !deal || !want || deal === want ? 1 : 0.3
  return clamp01(dealOk * (0.6 + 0.4 * engagement))
}
// تعاملِ تاریخی: آیا کاربر قبلاً با این ملک/مشابه تعامل داشته؟ (۰..۱ از بیرون تزریق می‌شود)
export function historicalInteraction(priorScore: number): number { return clamp01(priorScore) }

export function scoreUserProperty(
  u: UserVector, p: PropertyVector,
  opts: { textOverlap?: number; prior?: number } = {},
): ScoreBreakdown {
  const budgetMatchV = budgetMatch(u.budget, p.price)
  const locationMatchV = locationMatch(u.lat, u.lng, p.lat, p.lng, opts.textOverlap ?? 0)
  const behaviorMatchV = behaviorMatch(u, p)
  const intentStrengthV = intentStrength(u.intent, p.deal, u.engagement)
  const historicalV = historicalInteraction(opts.prior ?? 0)
  const marketDemandV = clamp01(p.demand)
  const final =
    WEIGHTS.budget * budgetMatchV +
    WEIGHTS.location * locationMatchV +
    WEIGHTS.behavior * behaviorMatchV +
    WEIGHTS.intent * intentStrengthV +
    WEIGHTS.historical * historicalV +
    WEIGHTS.demand * marketDemandV
  return {
    budgetMatch: r3(budgetMatchV), locationMatch: r3(locationMatchV), behaviorMatch: r3(behaviorMatchV),
    intentStrength: r3(intentStrengthV), historicalInteraction: r3(historicalV), marketDemand: r3(marketDemandV),
    final: r3(clamp01(final)),
  }
}

export function reasonsOf(b: ScoreBreakdown): string[] {
  const out: string[] = []
  if (b.budgetMatch >= 0.85) out.push('در بودجه')
  if (b.locationMatch >= 0.7) out.push('نزدیک به منطقهٔ موردنظر')
  if (b.behaviorMatch >= 0.5) out.push('هم‌راستا با سلیقهٔ کاربر')
  if (b.intentStrength >= 0.7) out.push('مطابقِ نیتِ خرید/اجاره')
  if (b.marketDemand >= 0.6) out.push('پرتقاضا')
  if (!out.length) out.push('گزینهٔ محتمل')
  return out
}

export function toMatch(targetId: string, b: ScoreBreakdown): Match {
  return { targetId, score: b.final, breakdown: b, reasons: reasonsOf(b) }
}

function r3(x: number): number { return Math.round(x * 1000) / 1000 }
