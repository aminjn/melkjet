// REOS · AI Orchestrator + Agent tools — نقش‌ها را به هم وصل می‌کند (Marketplace Network).
// خریدار → تطبیق → مشاور → مالی (توانِ وام) → بیمه/حقوقی → هر معامله چند درآمد.
import type { UserEntity, PropertyEntity, AgentEntity } from './types'
import { matchUserToProperties, assignLeadToAgent } from './engine'
import { predictLeadConversion } from './ml'
import { leadValue } from './monetization'
import { clamp01, parseFaNum } from './features'

export interface OrchestratedJourney {
  intent: string
  topProperties: { id: string; score: number; matchPct: number; reasons: string[] }[]
  bestAgent: { id: string; name?: string; score: number; reasons: string[] } | null
  finance: { affordable: boolean; maxLoan: number; note: string } | null
  crossSell: string[]        // خدماتِ متصل (بیمه/حقوقی/…)
  leadValueToman: number     // ارزشِ این کاربر به‌عنوان لید (Lead Marketplace)
}

// توانِ بازپرداخت/وام (ساده، قابلِ ارتقا): وام ≈ ۴۰٪ درآمدِ ماهانه × اقساطِ ۲۴۰ماهه با نرخِ فرضی.
function financeCapacity(monthlyIncome: number, propertyPrice: number): { affordable: boolean; maxLoan: number; note: string } {
  if (!monthlyIncome) return { affordable: propertyPrice > 0, maxLoan: 0, note: 'درآمدِ ماهانه نامشخص است' }
  const installment = monthlyIncome * 0.4
  const rate = 0.18 / 12, n = 240
  const maxLoan = Math.round(installment * (1 - Math.pow(1 + rate, -n)) / rate)
  const affordable = maxLoan >= propertyPrice * 0.6   // حداقل ۶۰٪ با وام
  return { affordable, maxLoan, note: affordable ? 'با ترکیبِ وام و آورده قابلِ تأمین است' : 'به آوردهٔ نقدیِ بیشتری نیاز است' }
}

export function orchestrateBuyerJourney(
  user: UserEntity,
  properties: PropertyEntity[],
  agents: AgentEntity[],
  ctx: { monthlyIncome?: number; regionDemand?: number } = {},
): OrchestratedJourney {
  // ۱) تطبیقِ کاربر↔ملک
  const matches = matchUserToProperties(user, properties, { limit: 5 })
  const byId = new Map(properties.map(p => [p.id, p]))
  const topProperties = matches.map(m => ({ id: m.targetId, score: m.score, matchPct: Math.round(m.breakdown.final * 100), reasons: m.reasons }))

  // ۲) بهترین مشاور برای این کاربر (به‌عنوان لید)
  const leadForMatch = { need: user.behaviorTokens?.join(' ') || '', budget: user.budget, lat: user.lat ?? undefined, lng: user.lng ?? undefined, locationText: user.locationText }
  const agentMatches = agents.length ? assignLeadToAgent(leadForMatch, agents) : []
  const top = agentMatches[0]
  const bestAgent = top ? { id: top.targetId, name: agents.find(a => a.id === top.targetId)?.name, score: top.score, reasons: top.reasons } : null

  // ۳) مالی: توانِ خرید نسبت به بهترین ملک
  const topProp = matches[0] ? byId.get(matches[0].targetId) : undefined
  const finance = topProp ? financeCapacity(ctx.monthlyIncome || 0, topProp.price || 0) : null

  // ۴) Cross-sell (اتصالِ نقش‌ها → درآمدهای چندگانه)
  const crossSell: string[] = []
  if (finance && !finance.affordable) crossSell.push('مشاورهٔ وامِ مسکن (بانک/بیمه)')
  if (user.intent === 'invest') crossSell.push('مشاورهٔ سرمایه‌گذاری و پروژه‌های سازنده')
  crossSell.push('بررسیِ حقوقیِ قرارداد (دفترِ حقوقی)')
  crossSell.push('بیمهٔ آتش‌سوزی/عمر (پس از معامله)')

  // ۵) ارزشِ لید (Monetization)
  const conv = predictLeadConversion({ phone: user.id, budget: user.budget, stage: 'new', activityCount: (user.interactedPropertyIds || []).length })
  const lv = leadValue({ intentScore: clamp01(conv.value), budget: user.budget || 0, regionDemand: ctx.regionDemand ?? 0.5, exclusive: true })

  return { intent: user.intent || 'buy', topProperties, bestAgent, finance, crossSell, leadValueToman: lv.price }
}

export { parseFaNum }
