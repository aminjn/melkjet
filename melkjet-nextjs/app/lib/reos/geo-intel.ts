// REOS v3 · Geospatial Intelligence — نقشهٔ حرارتیِ عرضه/قیمت/تقاضا از مختصاتِ آگهی‌ها.
// هستهٔ خالص (buildHeatmap) تست‌پذیر؛ heatmap از دادهٔ واقعی می‌سازد. (POI/walkability = بعداً، دادهٔ بیرونی)
import { candidateListings } from '../scraper-store'
import { parseFaNum } from './features'

export interface GeoPoint { lat: number; lng: number; price?: number; demand?: number }
export interface HeatCell { lat: number; lng: number; count: number; avgPrice: number; avgDemand: number; intensity: number }

export function cellKey(lat: number, lng: number, precision = 2): string { const f = Math.pow(10, precision); return `${Math.round(lat * f) / f}|${Math.round(lng * f) / f}` }

export function buildHeatmap(points: GeoPoint[], precision = 2): HeatCell[] {
  const cells = new Map<string, { lat: number; lng: number; count: number; priceSum: number; priceN: number; demandSum: number }>()
  for (const p of points) {
    if (!p.lat || !p.lng) continue
    const k = cellKey(p.lat, p.lng, precision)
    const [clat, clng] = k.split('|').map(Number)
    const c = cells.get(k) || { lat: clat, lng: clng, count: 0, priceSum: 0, priceN: 0, demandSum: 0 }
    c.count++
    if (p.price) { c.priceSum += p.price; c.priceN++ }
    c.demandSum += p.demand || 0
    cells.set(k, c)
  }
  const arr = Array.from(cells.values())
  const maxCount = Math.max(1, ...arr.map(c => c.count))
  return arr.map(c => ({
    lat: c.lat, lng: c.lng, count: c.count,
    avgPrice: c.priceN ? Math.round(c.priceSum / c.priceN) : 0,
    avgDemand: c.count ? Math.round((c.demandSum / c.count) * 1000) / 1000 : 0,
    intensity: Math.round((c.count / maxCount) * 1000) / 1000,
  })).sort((a, b) => b.count - a.count)
}

// نقشهٔ حرارتیِ واقعی از آگهی‌های دارای مختصات.
export async function heatmap(limit = 1500, precision = 2): Promise<HeatCell[]> {
  const items = await candidateListings(limit)
  const points: GeoPoint[] = []
  for (const it of items) {
    const lat = Number(it.meta?.['__lat']), lng = Number(it.meta?.['__lng'])
    if (!lat || !lng) continue
    points.push({ lat, lng, price: parseFaNum(it.price) || undefined })
  }
  return buildHeatmap(points, precision)
}
