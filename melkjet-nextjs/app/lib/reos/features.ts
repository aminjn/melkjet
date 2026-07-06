// REOS · Feature Engineering + Embedding layer
// همهٔ موجودیت‌ها → بردارِ ویژگی. embeddingِ متنی (token-hash)، جغرافیایی، و رفتاری.
import { EMBED_DIM, type Vector, type UserEntity, type PropertyEntity, type AgentEntity, type UserVector, type PropertyVector, type AgentVector, type DealType, type Intent } from './types'

// ── ابزارِ عددی ──
export function parseFaNum(s?: string | number): number {
  if (typeof s === 'number') return s
  const t = String(s || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[^\d]/g, '')
  return Number(t) || 0
}
export function tokenize(s?: string): string[] {
  return String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(t => t.length > 1).slice(0, 40)
}
// hash پایدار (djb2) → ایندکسِ بُعد
function hidx(tok: string): number { let h = 5381; for (let i = 0; i < tok.length; i++) h = ((h << 5) + h + tok.charCodeAt(i)) | 0; return Math.abs(h) % EMBED_DIM }

// embeddingِ متنی: بردارِ token-hash نرمال‌شده (مدلِ سبکِ bag-of-hashed-tokens؛ مسیرِ ارتقا: مدلِ برداریِ واقعی).
export function embedTokens(tokens: string[]): Vector {
  const v = new Array(EMBED_DIM).fill(0)
  for (const t of tokens) v[hidx(t)] += 1
  return l2norm(v)
}
export function l2norm(v: Vector): Vector {
  let s = 0; for (const x of v) s += x * x
  const n = Math.sqrt(s) || 1
  return v.map(x => x / n)
}
export function cosine(a: Vector, b: Vector): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0
  let dot = 0; for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return Math.max(0, Math.min(1, dot))   // بردارها نرمال‌اند → dot = cosine
}
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

// ── بردارسازی ──
export function userVector(u: UserEntity): UserVector {
  const toks = [...(u.behaviorTokens || []), ...tokenize(u.locationText)]
  return {
    id: u.id, embed: embedTokens(toks.length ? toks : ['user']),
    budget: u.budget || 0, intent: (u.intent as Intent) || null,
    lat: u.lat ?? null, lng: u.lng ?? null, engagement: clamp01(u.engagementScore ?? 0.3),
  }
}
export function propertyVector(p: PropertyEntity): PropertyVector {
  const toks = p.tokens || [...tokenize(p.ptype), ...tokenize(p.locationText), ...(p.features || []).flatMap(tokenize)]
  const demand = demandScore(p)
  return {
    id: p.id, embed: embedTokens(toks.length ? toks : ['property']),
    price: p.deal === 'rent' ? (p.rentMonthly || p.price || 0) : (p.price || 0),
    deal: (p.deal as DealType) || null, lat: p.lat ?? null, lng: p.lng ?? null, demand,
  }
}
export function agentVector(a: AgentEntity): AgentVector {
  return { id: a.id, embed: embedTokens((a.specialties || []).flatMap(tokenize).concat(['agent'])), perf: agentPerf(a), load: a.openLoad || 0 }
}

// ── امتیازِ تقاضای ملک (۰..۱): بازدید/تماس/سیو + تازگی ──
export function demandScore(p: PropertyEntity): number {
  const v = p.views || 0, c = p.contacts || 0, s = p.saves || 0
  // تماس و سیو سیگنالِ قوی‌تر از بازدید
  const raw = Math.log1p(v) * 0.4 + Math.log1p(c) * 1.2 + Math.log1p(s) * 1.0
  let d = 1 - Math.exp(-raw / 3)      // اشباع نرم
  if (p.createdAt) { const ageDays = (Date.now() - p.createdAt) / 864e5; if (ageDays > 60) d *= 0.7; else if (ageDays < 7) d *= 1.1 }
  return clamp01(d)
}
// ── عملکردِ مشاور (۰..۱): نرخِ تبدیل + سرعتِ پاسخ + امتیاز + معاملات ──
export function agentPerf(a: AgentEntity): number {
  const conv = clamp01(a.conversionRate ?? 0)
  const resp = a.responseMinutes != null ? clamp01(1 - Math.min(1, a.responseMinutes / 120)) : 0.5
  const rate = a.rating != null ? clamp01(a.rating / 5) : 0.6
  const dealBonus = clamp01(Math.log1p(a.deals || 0) / 3)
  return clamp01(0.45 * conv + 0.2 * resp + 0.2 * rate + 0.15 * dealBonus)
}

export function clamp01(x: number): number { return Math.max(0, Math.min(1, x)) }
