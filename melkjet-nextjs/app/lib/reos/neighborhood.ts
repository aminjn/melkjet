// REOS v4 · Neighborhood Intelligence — پروفایلِ محله از سیگنال‌های داخلی.
// قیمت/عرضه/تقاضا/نقدشوندگی/روند از market-intel + market-features + گراف.
// crime/school/transit/walkability نیازمندِ دیتاست/سرویسِ بیرونی‌اند (فعلاً pending).
import { getMarketIntel } from './market-intel'
import { getMarketFeature } from './market-features'
import { areaListingCount, topActiveInArea } from './market-graph'

export interface NeighborhoodProfile {
  area: string; listings: number
  medianPricePerM: number; avgPrice: number
  demandIndex: number; supplyIndex: number; liquidityIndex: number
  trend: 'up' | 'down' | 'flat'; healthScore: number
  priceLevel: 'اقتصادی' | 'متوسط' | 'لوکس' | 'نامشخص'
  topAgents: { id: string; label?: string; listings: number }[]
  external: { walkability: null; transit: null; school: null; crime: null }   // pending — دادهٔ بیرونی
}

export async function neighborhoodProfile(area: string): Promise<NeighborhoodProfile | null> {
  const [intel, feat, count, agents] = await Promise.all([
    getMarketIntel(area).catch(() => null),
    getMarketFeature(area).catch(() => null),
    areaListingCount(area).catch(() => 0),
    topActiveInArea(area, 5).catch(() => []),
  ])
  if (!intel && !feat && !count) return null
  const perM = feat?.medianPricePerM || 0
  // سطحِ قیمت (نسبت به بازهٔ عرفیِ تهران؛ تقریبی): <۴۰م اقتصادی، ۴۰..۹۰م متوسط، >۹۰م لوکس.
  const priceLevel = perM ? (perM < 40_000_000 ? 'اقتصادی' : perM <= 90_000_000 ? 'متوسط' : 'لوکس') : 'نامشخص'
  return {
    area, listings: count || feat?.count || 0,
    medianPricePerM: perM, avgPrice: feat?.avgPrice || 0,
    demandIndex: intel?.demandIndex || 0, supplyIndex: intel?.supplyIndex || 0, liquidityIndex: intel?.liquidityIndex || 0,
    trend: intel?.trend || 'flat', healthScore: intel?.healthScore || 0,
    priceLevel, topAgents: agents,
    external: { walkability: null, transit: null, school: null, crime: null },
  }
}
