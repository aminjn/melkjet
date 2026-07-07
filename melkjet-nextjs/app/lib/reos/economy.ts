// REOS v6 · Reward / Marketplace Economy — کمیسیون، پاداشِ وفاداری، پورسانتِ معرف (affiliate).
// معاملهٔ واقعی → پاداشِ وفاداری به مشاور + کمیسیونِ پلتفرم (تحلیل) + پورسانت به معرف. همه config-driven.
// هستهٔ خالص (commissionOn/affiliateCut/loyaltyBonus) تست‌پذیر.
import { config } from './reos-config'
import { creditBucket } from './wallet'
import { awardXp, grantXp } from './xp'
import { bumpMissions } from './missions'

export function commissionOn(value: number, pct = config().economy.commissionPct): number { return Math.max(0, Math.round((value || 0) * pct)) }
export function affiliateCut(value: number, pct = config().economy.affiliatePct): number { return Math.max(0, Math.round((value || 0) * pct)) }
export function loyaltyBonus(value: number, pct = config().economy.loyaltyBonusPct): number { return Math.max(0, Math.round((value || 0) * pct)) }

// قلّابِ یکپارچهٔ «اقدامِ بازار»: XP می‌دهد + مأموریت‌ها را پیش می‌برد. از مسیرهای واقعی صدا زده می‌شود.
export async function onMarketAction(agentId: string, action: string, count = 1, now = Date.now()): Promise<{ xp: number }> {
  if (!agentId) return { xp: 0 }
  const [x] = await Promise.all([
    awardXp(agentId, action, count, now).catch(() => ({ awarded: 0 })),
    bumpMissions(agentId, action, count, now).catch(() => {}),
  ])
  return { xp: x.awarded }
}

// ثبتِ معاملهٔ بسته‌شده: پاداشِ وفاداری (سطلِ reward) + XP + مأموریتِ معامله + پورسانتِ معرف (اگر باشد).
export interface DealResult { commission: number; loyalty: number; affiliate: number; xp: number }
export async function recordDeal(agentId: string, dealValue: number, opts: { referrerId?: string; now?: number } = {}): Promise<DealResult> {
  const now = opts.now ?? Date.now()
  const commission = commissionOn(dealValue)
  const loyalty = loyaltyBonus(dealValue)
  const affiliate = opts.referrerId ? affiliateCut(commission) : 0   // پورسانت از کمیسیونِ پلتفرم (نه از کلِ معامله)
  // پاداشِ وفاداریِ مشاور → اعتبارِ قابلِ‌استفاده
  if (loyalty > 0) await creditBucket(agentId, 'reward', loyalty, 'پاداشِ وفاداریِ معامله').catch(() => {})
  // XP + مأموریتِ معامله
  const x = await onMarketAction(agentId, 'close_deal', 1, now)
  // پورسانتِ معرف
  if (opts.referrerId && affiliate > 0) {
    await creditBucket(opts.referrerId, 'reward', affiliate, `پورسانتِ معرفی (معاملهٔ ${agentId})`).catch(() => {})
    await grantXp(opts.referrerId, config().xp.actions.refer_convert || 0, now).catch(() => {})
  }
  return { commission, loyalty, affiliate, xp: x.xp }
}
