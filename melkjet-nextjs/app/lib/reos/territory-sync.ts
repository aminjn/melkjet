// REOS · Market Dominance — همگام‌سازیِ امتیازِ اقتدار از دادهٔ واقعیِ اپ.
// سیگنال‌ها فقط از منابعِ واقعی: آگهی‌های آژانس (کیفیت/بازدید/تازگی)، قیف CRM (معامله/تبدیل)، اعتماد (رضایت/AI).
// قلمرو = محلهٔ آگهی. اقدامِ واقعی → امتیازِ اندازه‌گیری‌شده؛ با ضدِتقلب پالایش می‌شود.
import { listItems } from '../scraper-store'
import { forIds } from '../listing-stats-store'
import { itemToProperty } from './data'
import { funnel } from './crm'
import { getTrust } from './trust'
import { clamp01 } from './features'
import { recordDominance, territoryKeyFromName, type DominanceSignals, type FraudSignals } from './territory'
import type { PropertyEntity } from './types'

// کیفیتِ آگهی (۰..۱): کاملیِ اطلاعات (هم‌راستا با feed.quality).
function listingQuality(p: PropertyEntity): number {
  let q = 0
  if ((p as { image?: string }).image || (p.tokens && p.tokens.length)) q += 0.15
  if (p.area) q += 0.2; if (p.rooms) q += 0.15; if (p.price || p.rentMonthly) q += 0.2
  if (p.locationText) q += 0.15; if ((p.features || []).length) q += 0.15
  return clamp01(q)
}

interface AgentTerr { phone: string; name: string; territory: string; listings: PropertyEntity[]; views: number; contacts: number; qualitySum: number }

// همگام‌سازیِ کامل: آگهی‌ها را بر اساسِ (مالک × محله) گروه می‌کند و برای هر گروه امتیازِ اقتدار ثبت می‌کند.
export async function syncTerritories(opts: { limit?: number } = {}): Promise<{ agents: number; territories: number; records: number }> {
  const items = await listItems('listing')
  const withPhone = items.filter(it => it.phone && it.location)
  if (!withPhone.length) return { agents: 0, territories: 0, records: 0 }

  const stats = await forIds(withPhone.map(it => it.id)).catch(() => ({} as Record<string, { views: number; contacts: number }>))
  // گروه‌بندی: کلید = phone|territory
  const groups = new Map<string, AgentTerr>()
  const agentSet = new Set<string>()
  const agentTotalListings = new Map<string, number>()
  for (const it of withPhone) {
    const phone = String(it.phone).replace(/\D/g, '')
    if (!phone) continue
    agentSet.add(phone)
    agentTotalListings.set(phone, (agentTotalListings.get(phone) || 0) + 1)
    const p = itemToProperty(it, stats[it.id])
    const territory = territoryKeyFromName(p.locationText || it.location || 'نامشخص')
    const key = phone + '|' + territory
    const g = groups.get(key) || { phone, name: it.owner || 'آژانس', territory, listings: [], views: 0, contacts: 0, qualitySum: 0 }
    g.listings.push(p); g.views += p.views || 0; g.contacts += p.contacts || 0; g.qualitySum += listingQuality(p)
    groups.set(key, g)
  }

  // سیگنال‌های سطحِ آژانس (یک‌بار per phone): قیف CRM + اعتماد.
  const agentBiz = new Map<string, { won: number; conv: number; rating: number; trust: number }>()
  for (const phone of agentSet) {
    const [f, t] = await Promise.all([
      funnel(phone).catch(() => ({ won: 0, conversionRate: 0 })),
      getTrust(phone).catch(() => ({ score: 50, parts: {} as Record<string, number> })),
    ])
    agentBiz.set(phone, { won: f.won || 0, conv: (f.conversionRate || 0) / 100, rating: (t.parts.rating ?? 50) / 20, trust: t.score })
  }

  let records = 0
  const territories = new Set<string>()
  for (const g of groups.values()) {
    territories.add(g.territory)
    const biz = agentBiz.get(g.phone) || { won: 0, conv: 0, rating: 2.5, trust: 50 }
    const totalListings = agentTotalListings.get(g.phone) || 1
    const share = g.listings.length / totalListings   // سهمِ این قلمرو از فعالیتِ آژانس
    const nOld = g.listings.filter(p => p.createdAt && (Date.now() - p.createdAt) > 90 * 864e5).length
    const activity = clamp01(1 - nOld / Math.max(1, g.listings.length))   // نسبتِ آگهیِ تازه
    const signals: DominanceSignals = {
      transactions: biz.won * share,                       // معاملاتِ منتسب به این قلمرو (سهمِ آگهی)
      listingQuality: g.qualitySum / g.listings.length,    // میانگینِ کیفیتِ آگهی‌ها (واقعی)
      leadConversion: biz.conv,
      satisfaction: biz.rating,
      contentPieces: 0,                                    // محتوا: منبعِ بیرونی — فعلاً ۰
      activity,
      aiTrust: biz.trust,
    }
    const fraud: FraudSignals = {
      listings: g.listings.length, listingViews: g.views,
      contacts: g.contacts, selfContacts: 0,
      transactions: Math.round(biz.won * share), leads: biz.won > 0 ? 1 : 0,
    }
    await recordDominance(g.territory, g.phone, g.name, signals, fraud)
    records++
  }
  return { agents: agentSet.size, territories: territories.size, records }
}
