// REOS v5 · Self-learning Feed (RL) — یادگیریِ آنلاین از پاداشِ رفتار + اکتشافِ epsilon-greedy.
// Click→Save→Contact→Visit→Contract → Reward → به‌روزرسانیِ سیاستِ رتبه‌بندی (بدونِ آموزشِ دسته‌ای).
import { getFeatures, bumpFeatures } from './store'

// پاداشِ هر رویداد (شدتِ سیگنال).
export const EVENT_REWARD: Record<string, number> = { click: 1, save: 5, contact: 20, visit: 40, contract: 100 }

// به‌روزرسانیِ آنلاینِ وزن‌ها (SGD روی خطای پیش‌بینیِ پاداش). خالص و تست‌پذیر.
export function banditUpdate(weights: number[], context: number[], reward: number, lr = 0.05): number[] {
  const predicted = weights.reduce((s, w, i) => s + w * (context[i] || 0), 0)
  const err = reward - predicted
  return weights.map((w, i) => w + lr * err * (context[i] || 0))
}

// اکتشاف/بهره‌برداری: با احتمالِ epsilon یک گزینهٔ تصادفی (اکتشاف)، وگرنه بهترین امتیاز.
export function epsilonGreedy(scores: number[], epsilon: number, rand: number, randIdx = 0): number {
  if (!scores.length) return -1
  if (rand < epsilon) return Math.min(scores.length - 1, Math.max(0, Math.floor(randIdx * scores.length)))
  let best = 0; for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i
  return best
}

// نرمال‌سازیِ پاداش به [0,1] (برای هدفِ رگرسیون).
export function normReward(rewardRaw: number): number { return Math.min(1, rewardRaw / EVENT_REWARD.contract) }

// ── سیاستِ آنلاینِ ذخیره‌شده (feature store: entity 'policy'/'feed') ──
const POLICY_KEYS = ['w_demand', 'w_quality', 'w_fresh', 'w_price', 'bias']
export interface Policy { w: number[]; updates: number }
export async function getPolicy(): Promise<Policy> {
  const f = await getFeatures('policy', 'feed').catch(() => ({} as Record<string, number>))
  const w = POLICY_KEYS.map(k => (f[k] !== undefined ? f[k] : (k === 'bias' ? 0 : 0.2)))
  return { w, updates: f.updates || 0 }
}
// اعمالِ پاداشِ یک تعامل روی سیاست (آنلاین).
export async function applyOnlineReward(context: number[], eventType: keyof typeof EVENT_REWARD, lr = 0.05): Promise<Policy> {
  const { w } = await getPolicy()
  const reward = normReward(EVENT_REWARD[eventType] || 0)
  const nw = banditUpdate(w, context, reward, lr)
  const set: Record<string, number> = {}
  POLICY_KEYS.forEach((k, i) => { set[k] = Math.round(nw[i] * 1e4) / 1e4 })
  await bumpFeatures('policy', 'feed', { updates: 1 }, set)
  return { w: nw, updates: 0 }
}
