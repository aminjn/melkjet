// REOS v3 · Attribution Engine — منبعِ لید/کمپین + CAC/LTV/ROAS به‌تفکیکِ کانال.
// شمارنده‌ها در feature store (entity_type='attribution', entity_id=channel).
import { bumpFeatures, getFeatures, topFeatures } from './store'

export interface ChannelReport { channel: string; touches: number; conversions: number; spend: number; revenue: number; cac: number; roas: number; ltv: number }

export async function recordTouch(channel: string, n = 1): Promise<void> { if (channel) await bumpFeatures('attribution', channel, { touches: n }) }
export async function recordSpend(channel: string, amount: number): Promise<void> { if (channel && amount) await bumpFeatures('attribution', channel, { spend: amount }) }
export async function recordConversion(channel: string, revenue = 0): Promise<void> { if (channel) await bumpFeatures('attribution', channel, { conversions: 1, revenue }) }

function toReport(channel: string, f: Record<string, number>): ChannelReport {
  const touches = f.touches || 0, conversions = f.conversions || 0, spend = f.spend || 0, revenue = f.revenue || 0
  return {
    channel, touches, conversions, spend, revenue,
    cac: conversions ? Math.round(spend / conversions) : 0,
    roas: spend ? Math.round((revenue / spend) * 100) / 100 : 0,
    ltv: conversions ? Math.round(revenue / conversions) : 0,
  }
}
export async function channelReport(channel: string): Promise<ChannelReport> { return toReport(channel, await getFeatures('attribution', channel)) }
export async function allChannels(limit = 50): Promise<ChannelReport[]> {
  // بر اساسِ touches و spend هر دو جمع می‌کنیم (کانالی که فقط هزینه دارد هم بیاید).
  const [byTouch, bySpend] = await Promise.all([topFeatures('attribution', 'touches', limit), topFeatures('attribution', 'spend', limit)])
  const map = new Map<string, Record<string, number>>()
  for (const r of [...byTouch, ...bySpend]) if (!map.has(r.id)) map.set(r.id, r.features)
  return Array.from(map.entries()).map(([ch, f]) => toReport(ch, f)).sort((a, b) => b.revenue - a.revenue)
}
