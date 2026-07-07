// REOS v3 · Market Intelligence — شاخص‌های سلامتِ بازار به‌تفکیکِ منطقه (بزرگ‌ترین مزیتِ رقابتی).
// Demand/Supply/Liquidity/Competition/Trend/HealthScore از آگهی‌ها (عرضه) + تعامل (تقاضا) + تازگی.
// در feature store (entity_type='market_intel') ذخیره؛ هر ۶ ساعت بازمحاسبه (cron).
import { candidateListings } from '../scraper-store'
import { bumpFeatures, getFeatures, topFeatures } from './store'
import { clamp01 } from './features'

export interface MarketIntel { area: string; demandIndex: number; supplyIndex: number; liquidityIndex: number; competition: number; trend: 'up' | 'down' | 'flat'; healthScore: number; listings: number }

export async function computeMarketIntel(limit = 800): Promise<number> {
  const items = await candidateListings(limit)
  // تعاملِ هر ملک از feature store در یک کوئری.
  const engRows = await topFeatures('property', 'engagement_score', 5000).catch(() => [])
  const engOf = new Map(engRows.map(r => [r.id, r.value]))

  const now = Date.now()
  const areas = new Map<string, { count: number; demand: number; fresh: number }>()
  for (const it of items) {
    const m = it.meta || {}
    const area = [String(m['شهر'] || '').trim(), String(m['محله'] || it.location || '').trim()].filter(Boolean).join('|')
    if (!area) continue
    const g = areas.get(area) || { count: 0, demand: 0, fresh: 0 }
    g.count++
    g.demand += engOf.get(it.id) || 0
    if (it.scrapedAt && now - it.scrapedAt < 30 * 864e5) g.fresh++
    areas.set(area, g)
  }
  if (!areas.size) return 0

  const maxCount = Math.max(...Array.from(areas.values()).map(a => a.count))
  const maxDemand = Math.max(1, ...Array.from(areas.values()).map(a => a.demand))
  let n = 0
  for (const [area, g] of areas) {
    if (g.count < 2) continue
    const supplyIndex = clamp01(Math.log1p(g.count) / Math.log1p(maxCount))
    const demandIndex = clamp01(g.demand / maxDemand)
    const liquidityIndex = clamp01((g.demand / (g.count + 1)) / (maxDemand / (maxCount + 1) || 1))
    const competition = clamp01(g.count / (g.demand + 1) / (maxCount / 1))   // عرضهٔ زیاد نسبت به تقاضا = رقابتِ بالا
    const freshRatio = g.fresh / g.count
    const trend: MarketIntel['trend'] = freshRatio > 0.5 ? 'up' : freshRatio < 0.2 ? 'down' : 'flat'
    const healthScore = Math.round((0.4 * demandIndex + 0.3 * liquidityIndex + 0.3 * (1 - competition)) * 100)
    await bumpFeatures('market_intel', area, {}, {
      demand_index: Math.round(demandIndex * 1000) / 1000, supply_index: Math.round(supplyIndex * 1000) / 1000,
      liquidity_index: Math.round(liquidityIndex * 1000) / 1000, competition: Math.round(competition * 1000) / 1000,
      trend_up: trend === 'up' ? 1 : trend === 'down' ? -1 : 0, health_score: healthScore, listings: g.count,
    })
    n++
  }
  return n
}

export async function getMarketIntel(area: string): Promise<MarketIntel | null> {
  const f = await getFeatures('market_intel', area)
  if (!f || f.listings === undefined) return null
  return {
    area, demandIndex: f.demand_index || 0, supplyIndex: f.supply_index || 0, liquidityIndex: f.liquidity_index || 0,
    competition: f.competition || 0, trend: f.trend_up > 0 ? 'up' : f.trend_up < 0 ? 'down' : 'flat', healthScore: f.health_score || 0, listings: f.listings || 0,
  }
}

export async function topMarketIntel(limit = 25): Promise<MarketIntel[]> {
  const rows = await topFeatures('market_intel', 'health_score', limit)
  return rows.map(r => ({
    area: r.id, demandIndex: r.features.demand_index || 0, supplyIndex: r.features.supply_index || 0,
    liquidityIndex: r.features.liquidity_index || 0, competition: r.features.competition || 0,
    trend: r.features.trend_up > 0 ? 'up' : r.features.trend_up < 0 ? 'down' : 'flat', healthScore: r.features.health_score || 0, listings: r.features.listings || 0,
  }))
}
