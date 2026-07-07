// REOS v2 · Feature Store v2 — market_features. تجمیعِ آماریِ بازار به‌تفکیکِ منطقه
// (میانهٔ قیمتِ هر متر، میانگینِ قیمت، تعداد، شاخصِ تقاضا) از آگهی‌ها + feature store.
// در reos_feature_store(entity_type='market') ذخیره و از ویوِ reos_market_features خوانده می‌شود.
import { candidateListings } from '../scraper-store'
import { bumpFeatures, getFeatures, topFeatures } from './store'
import { parseFaNum } from './features'

export interface MarketFeature { area: string; count: number; medianPricePerM: number; avgPrice: number; demandIndex: number }
const median = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }

// محاسبه + ذخیرهٔ ویژگی‌های بازار برای همهٔ مناطق. برمی‌گرداند: تعدادِ منطقهٔ به‌روزشده.
export async function computeMarketFeatures(limit = 2000): Promise<number> {
  const items = await candidateListings(limit)
  const byArea = new Map<string, { perM: number[]; prices: number[]; eng: number }>()
  for (const it of items) {
    const m = it.meta || {}
    const city = String(m['شهر'] || '').trim()
    const dist = String(m['محله'] || it.location || '').trim()
    const area = [city, dist].filter(Boolean).join('|')
    if (!area) continue
    const price = parseFaNum(it.price), meters = parseFaNum(String(m['متراژ'] || ''))
    const g = byArea.get(area) || { perM: [], prices: [], eng: 0 }
    if (price) g.prices.push(price)
    if (price && meters) g.perM.push(price / meters)
    byArea.set(area, g)
  }
  let n = 0
  for (const [area, g] of byArea) {
    if (g.prices.length < 2) continue
    const demandIndex = Math.min(1, Math.log1p(g.prices.length) / Math.log1p(80))   // مناطقِ پرعرضه = فعال‌تر
    await bumpFeatures('market', area, {}, {
      count: g.prices.length, median_price_per_m: Math.round(median(g.perM)),
      avg_price: Math.round(g.prices.reduce((a, b) => a + b, 0) / g.prices.length), demand_index: Math.round(demandIndex * 1000) / 1000,
    })
    n++
  }
  return n
}

export async function getMarketFeature(area: string): Promise<MarketFeature | null> {
  const f = await getFeatures('market', area)
  if (!f || !f.count) return null
  return { area, count: f.count, medianPricePerM: f.median_price_per_m || 0, avgPrice: f.avg_price || 0, demandIndex: f.demand_index || 0 }
}

export async function topMarkets(limit = 25): Promise<MarketFeature[]> {
  const rows = await topFeatures('market', 'count', limit)
  return rows.map(r => ({ area: r.id, count: r.features.count || 0, medianPricePerM: r.features.median_price_per_m || 0, avgPrice: r.features.avg_price || 0, demandIndex: r.features.demand_index || 0 }))
}
