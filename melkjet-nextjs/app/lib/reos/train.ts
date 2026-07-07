// REOS · In-stack ML training — یادگیریِ وزن‌ها از رویدادهای واقعی (Logistic Regression / SGD).
// این جایگزینِ صادقانهٔ «مدلِ آموزش‌دیده» است: به‌جای وزنِ ثابتِ دستی، وزن‌ها با Gradient Descent
// روی دیتاستِ ساخته‌شده از رویدادهای واقعی (کلیک/سیو/تماس) fit می‌شوند و در feature store ذخیره.
// مسیرِ ارتقا به XGBoost/سرویسِ مدل: همین API (fit→persist→predict) بدونِ تغییرِ مصرف‌کننده.
import { recentEvents, getFeatures, bumpFeatures } from './store'
import { demandScore, clamp01 } from './features'
import type { PropertyEntity } from './types'

// ── مدلِ Engagement/Conversion propensity ──
// ویژگی‌ها عمداً از سیگنال‌هایی انتخاب شده‌اند که هم در «زمانِ آموزش» (feature store) و هم در
// «زمانِ استنتاج» (رتبه‌بندی) در دسترس‌اند → سازگاریِ train/serve (بدونِ نشتِ ویژگی).
export interface EngageWeights { bias: number; demand: number; pop: number; saves: number; userEng: number; n: number; auc: number; logloss: number; usedDefault: boolean; trainedAt: number }
export const DEFAULT_ENGAGE: EngageWeights = { bias: -1.2, demand: 1.8, pop: 0.6, saves: 1.0, userEng: 0.7, n: 0, auc: 0, logloss: 0, usedDefault: true, trainedAt: 0 }
export const ENGAGE_KEYS = ['demand', 'pop', 'saves', 'userEng'] as const
export type EngageFeat = Record<(typeof ENGAGE_KEYS)[number], number>

export function sigmoid(z: number): number { return 1 / (1 + Math.exp(-z)) }

// استخراجِ ویژگیِ مشترکِ train/serve از شمارنده‌های یک ملک + تعاملِ کاربر.
export function engageFeatures(counts: { views?: number; contacts?: number; saves?: number }, userEng: number): EngageFeat {
  const p: PropertyEntity = { id: '', views: counts.views || 0, contacts: counts.contacts || 0, saves: counts.saves || 0 }
  return {
    demand: clamp01(demandScore(p)),
    pop: clamp01(Math.log1p(counts.views || 0) / 5),
    saves: clamp01(Math.log1p(counts.saves || 0) / 4),
    userEng: clamp01(userEng),
  }
}

export interface Example extends EngageFeat { y: 0 | 1 }

// ── Logistic Regression via batch Gradient Descent (خالص، بدونِ وابستگی، قابلِ تست) ──
export function fitLogistic(
  data: Example[],
  opts: { epochs?: number; lr?: number; l2?: number; init?: Partial<EngageWeights> } = {},
): EngageWeights {
  const epochs = opts.epochs ?? 400, lr = opts.lr ?? 0.3, l2 = opts.l2 ?? 1e-3
  const base = { ...DEFAULT_ENGAGE, ...(opts.init || {}) }
  let { bias, demand, pop, saves, userEng } = base
  const n = data.length
  const pos = data.filter(d => d.y === 1).length
  // دیتاستِ خیلی کوچک یا تک‌کلاسه → آموزش نکن، پیش‌فرض را نگه دار (جلوگیری از overfit).
  if (n < 20 || pos < 5 || pos === n) {
    const m = evaluate({ bias, demand, pop, saves, userEng }, data)
    return { bias, demand, pop, saves, userEng, n, auc: m.auc, logloss: m.logloss, usedDefault: true, trainedAt: Date.now() }
  }
  // وزنِ کلاسیِ متعادل‌سازی (چون مثبت‌ها کم‌اند)
  const wPos = n / (2 * pos), wNeg = n / (2 * (n - pos))
  for (let e = 0; e < epochs; e++) {
    let gB = 0, gD = 0, gP = 0, gS = 0, gU = 0, wSum = 0
    for (const d of data) {
      const z = bias + demand * d.demand + pop * d.pop + saves * d.saves + userEng * d.userEng
      const pr = sigmoid(z)
      const w = d.y === 1 ? wPos : wNeg
      const err = (pr - d.y) * w
      gB += err; gD += err * d.demand; gP += err * d.pop; gS += err * d.saves; gU += err * d.userEng; wSum += w
    }
    const N = wSum || n
    bias -= lr * (gB / N)
    demand -= lr * (gD / N + l2 * demand)
    pop -= lr * (gP / N + l2 * pop)
    saves -= lr * (gS / N + l2 * saves)
    userEng -= lr * (gU / N + l2 * userEng)
  }
  const m = evaluate({ bias, demand, pop, saves, userEng }, data)
  return { bias, demand, pop, saves, userEng, n, auc: m.auc, logloss: m.logloss, usedDefault: false, trainedAt: Date.now() }
}

// پیش‌بینیِ خام از وزن‌ها.
export function scoreWith(w: Pick<EngageWeights, 'bias' | 'demand' | 'pop' | 'saves' | 'userEng'>, f: EngageFeat): number {
  return sigmoid(w.bias + w.demand * f.demand + w.pop * f.pop + w.saves * f.saves + w.userEng * f.userEng)
}

// ارزیابی: AUC (رتبه‌ایِ Mann–Whitney) + logloss.
export function evaluate(w: Pick<EngageWeights, 'bias' | 'demand' | 'pop' | 'saves' | 'userEng'>, data: Example[]): { auc: number; logloss: number } {
  if (!data.length) return { auc: 0, logloss: 0 }
  let ll = 0
  const scored = data.map(d => { const p = scoreWith(w, d); ll += -(d.y * Math.log(Math.max(1e-9, p)) + (1 - d.y) * Math.log(Math.max(1e-9, 1 - p))); return { p, y: d.y } })
  const pos = scored.filter(s => s.y === 1), neg = scored.filter(s => s.y === 0)
  let auc = 0.5
  if (pos.length && neg.length) {
    let wins = 0
    for (const a of pos) for (const b of neg) wins += a.p > b.p ? 1 : a.p === b.p ? 0.5 : 0
    auc = wins / (pos.length * neg.length)
  }
  return { auc: Math.round(auc * 1000) / 1000, logloss: Math.round((ll / data.length) * 1000) / 1000 }
}

// ═══ اتصال به دادهٔ واقعی (node-safe: فقط store.ts) ═══
// دیتاستِ آموزش را از رویدادهای واقعی می‌سازد: هر جفتِ (کاربر، ملک) که کلیک شده یک نمونه است؛
// اگر بعداً تماس/سیو شده باشد y=1 (مثبت)، وگرنه y=0. ویژگی‌ها از شمارنده‌های ملک + نیتِ کاربر.
export async function buildTrainingSet(limit = 4000): Promise<Example[]> {
  const events = await recentEvents({ limit })
  // گروه‌بندیِ نتیجه به‌ازای جفتِ (user, property)
  const pair = new Map<string, { clicked: boolean; engaged: boolean; userId: string; propertyId: string }>()
  for (const e of events) {
    if (!e.propertyId || !e.userId) continue
    const k = e.userId + '|' + e.propertyId
    const cur = pair.get(k) || { clicked: false, engaged: false, userId: e.userId, propertyId: e.propertyId }
    if (e.type === 'user_clicked_property') cur.clicked = true
    if (e.type === 'user_saved_property' || e.type === 'contact_made') cur.engaged = true
    pair.set(k, cur)
  }
  const propFeat = new Map<string, Record<string, number>>()
  const userFeat = new Map<string, Record<string, number>>()
  const out: Example[] = []
  for (const p of pair.values()) {
    if (!p.clicked && !p.engaged) continue
    if (!propFeat.has(p.propertyId)) propFeat.set(p.propertyId, await getFeatures('property', p.propertyId).catch(() => ({})))
    if (!userFeat.has(p.userId)) userFeat.set(p.userId, await getFeatures('user', p.userId).catch(() => ({})))
    const pf = propFeat.get(p.propertyId)!, uf = userFeat.get(p.userId)!
    const f = engageFeatures(
      { views: pf.click_count || 0, contacts: pf.contact_count || 0, saves: pf.save_count || 0 },
      Math.min(1, (Number(uf.intent_score) || 0) / 50),
    )
    out.push({ ...f, y: p.engaged ? 1 : 0 })
  }
  return out
}

// آموزش + ذخیرهٔ وزن‌ها در feature store (entity: model/engage_v1).
export async function trainEngageModel(opts: { epochs?: number; lr?: number } = {}): Promise<EngageWeights> {
  const data = await buildTrainingSet()
  const w = fitLogistic(data, opts)
  await bumpFeatures('model', 'engage_v1', {}, { ...w } as unknown as Record<string, number>).catch(() => {})
  // ثبتِ نسخه در Model Registry (نسخه‌بندی + متریک؛ best-effort).
  try { const { registerModel } = await import('./model-registry'); await registerModel('engage', { bias: w.bias, demand: w.demand, pop: w.pop, saves: w.saves, userEng: w.userEng }, { auc: w.auc, logloss: w.logloss, n: w.n }) } catch {}
  LEARNED = w; LEARNED_AT = Date.now()
  return w
}

// ── لایهٔ استنتاجِ همگام (برای رتبه‌بندیِ pure/sync در feed.ts) ──
let LEARNED: EngageWeights | null = null
let LEARNED_AT = 0
const PRIME_TTL = 5 * 60 * 1000

// وزنِ آموزش‌دیده را از feature store به حافظه می‌آورد (کش‌شده). قبل از رتبه‌بندی صدا زده می‌شود.
export async function primeEngageModel(): Promise<EngageWeights> {
  if (LEARNED && Date.now() - LEARNED_AT < PRIME_TTL) return LEARNED
  try {
    const f = await getFeatures('model', 'engage_v1')
    if (f && f.trainedAt) { LEARNED = { ...DEFAULT_ENGAGE, ...(f as unknown as EngageWeights) }; LEARNED_AT = Date.now(); return LEARNED }
  } catch {}
  LEARNED = DEFAULT_ENGAGE; LEARNED_AT = Date.now()
  return LEARNED
}

export function learnedEngageWeights(): EngageWeights { return LEARNED || DEFAULT_ENGAGE }

// پیش‌بینیِ engagement propensity برای یک ملک (۰..۱) با وزنِ آموزش‌دیده — همگام.
export function predictEngage(p: { views?: number; contacts?: number; saves?: number }, userEng = 0.3): number {
  const w = learnedEngageWeights()
  return Math.round(scoreWith(w, engageFeatures(p, userEng)) * 1000) / 1000
}
