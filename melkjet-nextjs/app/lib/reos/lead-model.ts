// REOS · Lead Conversion Model — مدلِ آموزش‌دیدهٔ واقعی (نه وزنِ هاردکد).
// Logistic Regression با Gradient Descent روی نتیجهٔ واقعیِ لیدها (won/lost) از CRM.
// ویژگی‌ها عمداً «مرحله» را شامل نمی‌شوند (نشتِ برچسب) — از سیگنال‌های اولیه یاد می‌گیرد.
import { getFeatures, bumpFeatures } from './store'
import { parseFaNum } from './features'
// crm به‌صورتِ پویا بار می‌شود (جلوگیری از importِ حلقوی: ml → lead-model → crm → ml).

export interface LeadWeights { bias: number; hasPhone: number; hasEmail: number; hasBudget: number; activity: number; recency: number; n: number; auc: number; logloss: number; usedDefault: boolean; trainedAt: number }
export const DEFAULT_LEAD: LeadWeights = { bias: -0.8, hasPhone: 1.1, hasEmail: 0.3, hasBudget: 0.9, activity: 1.0, recency: 0.7, n: 0, auc: 0, logloss: 0, usedDefault: true, trainedAt: 0 }
const KEYS = ['hasPhone', 'hasEmail', 'hasBudget', 'activity', 'recency'] as const
export type LeadFeat = Record<(typeof KEYS)[number], number>

function sigmoid(z: number) { return 1 / (1 + Math.exp(-z)) }
function clamp01(x: number) { return Math.max(0, Math.min(1, x)) }

// ویژگی‌های اولیهٔ لید (بدونِ مرحله تا برچسب نشت نکند).
export function leadFeatures(l: { phone?: string; email?: string; budget?: string | number; value?: number; activityCount?: number; ageDays?: number }): LeadFeat {
  return {
    hasPhone: l.phone ? 1 : 0,
    hasEmail: l.email ? 1 : 0,
    hasBudget: (parseFaNum(l.budget as string) || l.value || 0) > 0 ? 1 : 0,
    activity: clamp01((l.activityCount || 0) / 6),
    recency: clamp01(1 - Math.min(1, (l.ageDays || 0) / 30)),
  }
}

export interface LeadExample extends LeadFeat { y: 0 | 1 }
export function fitLeadLogistic(data: LeadExample[], opts: { epochs?: number; lr?: number; l2?: number } = {}): LeadWeights {
  const epochs = opts.epochs ?? 400, lr = opts.lr ?? 0.3, l2 = opts.l2 ?? 1e-3
  let { bias, hasPhone, hasEmail, hasBudget, activity, recency } = DEFAULT_LEAD
  const n = data.length, pos = data.filter(d => d.y === 1).length
  if (n < 20 || pos < 5 || pos === n) { const m = evaluate({ bias, hasPhone, hasEmail, hasBudget, activity, recency }, data); return { bias, hasPhone, hasEmail, hasBudget, activity, recency, n, auc: m.auc, logloss: m.logloss, usedDefault: true, trainedAt: Date.now() } }
  const wPos = n / (2 * pos), wNeg = n / (2 * (n - pos))
  for (let e = 0; e < epochs; e++) {
    let gB = 0, gP = 0, gE = 0, gBu = 0, gA = 0, gR = 0, wSum = 0
    for (const d of data) {
      const z = bias + hasPhone * d.hasPhone + hasEmail * d.hasEmail + hasBudget * d.hasBudget + activity * d.activity + recency * d.recency
      const w = d.y === 1 ? wPos : wNeg, err = (sigmoid(z) - d.y) * w
      gB += err; gP += err * d.hasPhone; gE += err * d.hasEmail; gBu += err * d.hasBudget; gA += err * d.activity; gR += err * d.recency; wSum += w
    }
    const N = wSum || n
    bias -= lr * (gB / N); hasPhone -= lr * (gP / N + l2 * hasPhone); hasEmail -= lr * (gE / N + l2 * hasEmail); hasBudget -= lr * (gBu / N + l2 * hasBudget); activity -= lr * (gA / N + l2 * activity); recency -= lr * (gR / N + l2 * recency)
  }
  const m = evaluate({ bias, hasPhone, hasEmail, hasBudget, activity, recency }, data)
  return { bias, hasPhone, hasEmail, hasBudget, activity, recency, n, auc: m.auc, logloss: m.logloss, usedDefault: false, trainedAt: Date.now() }
}

export function scoreLead(w: Omit<LeadWeights, 'n' | 'auc' | 'logloss' | 'usedDefault' | 'trainedAt'>, f: LeadFeat): number {
  return sigmoid(w.bias + w.hasPhone * f.hasPhone + w.hasEmail * f.hasEmail + w.hasBudget * f.hasBudget + w.activity * f.activity + w.recency * f.recency)
}
function evaluate(w: Omit<LeadWeights, 'n' | 'auc' | 'logloss' | 'usedDefault' | 'trainedAt'>, data: LeadExample[]) {
  if (!data.length) return { auc: 0, logloss: 0 }
  let ll = 0; const sc = data.map(d => { const p = scoreLead(w, d); ll += -(d.y * Math.log(Math.max(1e-9, p)) + (1 - d.y) * Math.log(Math.max(1e-9, 1 - p))); return { p, y: d.y } })
  const pos = sc.filter(s => s.y === 1), neg = sc.filter(s => s.y === 0); let auc = 0.5
  if (pos.length && neg.length) { let wins = 0; for (const a of pos) for (const b of neg) wins += a.p > b.p ? 1 : a.p === b.p ? 0.5 : 0; auc = wins / (pos.length * neg.length) }
  return { auc: Math.round(auc * 1000) / 1000, logloss: Math.round((ll / data.length) * 1000) / 1000 }
}

// دیتاست از لیدهای واقعیِ CRM (won=1، lost=0).
export async function buildLeadDataset(): Promise<LeadExample[]> {
  const { allLeads } = await import('./crm')
  const leads = await allLeads()
  const now = Date.now(), out: LeadExample[] = []
  for (const l of leads) {
    if (l.stage !== 'won' && l.stage !== 'lost') continue
    const f = leadFeatures({ phone: l.phone, email: l.email, value: l.value, activityCount: undefined, ageDays: (now - l.at) / 864e5 })
    out.push({ ...f, y: l.stage === 'won' ? 1 : 0 })
  }
  return out
}

export async function trainLeadModel(opts: { epochs?: number; lr?: number } = {}): Promise<LeadWeights> {
  const data = await buildLeadDataset()
  const w = fitLeadLogistic(data, opts)
  await bumpFeatures('model', 'lead_v1', {}, { ...w } as unknown as Record<string, number>).catch(() => {})
  try { const { registerModel } = await import('./model-registry'); await registerModel('lead', { bias: w.bias, hasPhone: w.hasPhone, hasBudget: w.hasBudget, activity: w.activity }, { auc: w.auc, logloss: w.logloss, n: w.n }) } catch {}
  LEARNED = w; LEARNED_AT = Date.now()
  return w
}

// ── استنتاجِ همگام (برای ml.ts) ──
let LEARNED: LeadWeights | null = null
let LEARNED_AT = 0
export async function primeLeadModel(): Promise<LeadWeights> {
  if (LEARNED && Date.now() - LEARNED_AT < 5 * 60 * 1000) return LEARNED
  try { const f = await getFeatures('model', 'lead_v1'); if (f && f.trainedAt) { LEARNED = { ...DEFAULT_LEAD, ...(f as unknown as LeadWeights) }; LEARNED_AT = Date.now(); return LEARNED } } catch {}
  LEARNED = DEFAULT_LEAD; LEARNED_AT = Date.now(); return LEARNED
}
export function learnedLeadWeights(): LeadWeights { return LEARNED || DEFAULT_LEAD }
export function predictLeadLearned(f: LeadFeat): number { return Math.round(scoreLead(learnedLeadWeights(), f) * 1000) / 1000 }
