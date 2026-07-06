// REOS · Global Matching Engine (CORE) — سه نوع تطبیق + فیدِ توصیه
import { type UserEntity, type PropertyEntity, type AgentEntity, type Match } from './types'
import { userVector, propertyVector, agentVector, tokenize, agentPerf } from './features'
import { scoreUserProperty, toMatch } from './scoring'

function textOverlap(a?: string, b?: string): number {
  const sa = new Set(tokenize(a)), sb = tokenize(b)
  if (!sa.size || !sb.length) return 0
  let hit = 0; for (const t of sb) if (sa.has(t)) hit++
  return Math.min(1, hit / Math.max(3, sb.length))
}

// ── ۱) User → Property : فیدِ پیشنهادِ شخصی‌سازی‌شده ──
export function matchUserToProperties(user: UserEntity, properties: PropertyEntity[], opts: { limit?: number; priors?: Record<string, number> } = {}): Match[] {
  const uv = userVector(user)
  const priors = opts.priors || {}
  const interacted = new Set(user.interactedPropertyIds || [])
  const matches = properties.map(p => {
    const pv = propertyVector(p)
    const prior = priors[p.id] ?? (interacted.has(p.id) ? 0.8 : 0)
    const b = scoreUserProperty(uv, pv, { textOverlap: textOverlap(user.locationText, p.locationText), prior })
    return toMatch(p.id, b)
  })
  matches.sort((a, b) => b.score - a.score)
  return matches.slice(0, opts.limit ?? 20)
}

// ── ۲) Property → Users : همهٔ کاربرانِ محتمل (برای پوش/کمپین) ──
export function matchPropertyToUsers(property: PropertyEntity, users: UserEntity[], opts: { limit?: number } = {}): Match[] {
  const pv = propertyVector(property)
  const matches = users.map(u => {
    const uv = userVector(u)
    const b = scoreUserProperty(uv, pv, { textOverlap: textOverlap(u.locationText, property.locationText), prior: (u.interactedPropertyIds || []).includes(property.id) ? 0.8 : 0 })
    return toMatch(u.id, b)
  })
  matches.sort((a, b) => b.score - a.score)
  return matches.slice(0, opts.limit ?? 50)
}

// ── ۳) Lead → Agent : بهترین مشاور (عملکرد + جغرافیا + ظرفیت + تخصص) ──
export interface LeadForMatch { need?: string; budget?: number; lat?: number; lng?: number; locationText?: string }
export function assignLeadToAgent(lead: LeadForMatch, agents: AgentEntity[]): Match[] {
  const active = agents.filter(a => a.active !== false)
  const wantToks = tokenize(lead.need).concat(tokenize(lead.locationText))
  const maxLoad = Math.max(1, ...active.map(a => a.openLoad || 0))
  const out = active.map(a => {
    const perf = agentPerf(a)                                       // ۰..۱ عملکرد
    const capacity = 1 - (a.openLoad || 0) / (maxLoad + 1)          // کم‌بارتر بهتر
    const spec = a.specialties?.length ? Math.min(1, wantToks.filter(t => a.specialties!.some(s => tokenize(s).includes(t))).length / Math.max(2, wantToks.length)) : 0
    const score = 0.5 * perf + 0.3 * capacity + 0.2 * spec
    const reasons: string[] = []
    if (perf >= 0.6) reasons.push('عملکردِ خوب')
    if (capacity >= 0.6) reasons.push('ظرفیتِ خالی')
    if (spec >= 0.4) reasons.push('تخصصِ منطقه/نوع')
    if (!reasons.length) reasons.push('گزینهٔ مناسب')
    return { targetId: a.id, score: Math.round(score * 1000) / 1000, breakdown: { budgetMatch: 0, locationMatch: spec, behaviorMatch: 0, intentStrength: 0, historicalInteraction: capacity, marketDemand: perf, final: score }, reasons }
  })
  out.sort((a, b) => b.score - a.score)
  return out
}

// ── فیدِ خانه (رتبه‌بندیِ پویا، TikTok-like): پیشنهاد + کمی تنوع/تازگی ──
export function homeFeed(user: UserEntity, properties: PropertyEntity[], opts: { limit?: number; priors?: Record<string, number> } = {}): Match[] {
  const ranked = matchUserToProperties(user, properties, { limit: (opts.limit ?? 20) * 2, priors: opts.priors })
  // تزریقِ تازگی: املاکِ خیلی جدید کمی بالا می‌آیند تا فید ایستا نشود.
  const now = Date.now()
  const byId = new Map(properties.map(p => [p.id, p]))
  for (const m of ranked) { const p = byId.get(m.targetId); if (p?.createdAt && now - p.createdAt < 3 * 864e5) m.score = Math.min(1, m.score + 0.03) }
  ranked.sort((a, b) => b.score - a.score)
  return ranked.slice(0, opts.limit ?? 20)
}
