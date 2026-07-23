// فاز ۲۰۴ — خوشه‌بندیِ سرورسایدِ نقشه (معماریِ دیوار برای ۱۲هزار+ آگهی):
// مرورگر هرگز کلِ آگهی‌ها را نمی‌گیرد؛ فقط «چه چیزی در قابِ فعلی با این زوم دیده می‌شود» —
// حباب‌های شمارش برای زومِ پایین، پینِ تکی وقتی در سلول یک آگهی مانده باشد.
// همه‌چیز خالص و قطعی (تست‌پذیر): شبکه‌بندیِ سلولی، مرکزِ محله از میانهٔ آگهی‌های مختصات‌دار،
// jitterِ قطعی از هشِ id — هیچ سرویسِ خارجی (geocode) در مسیرِ نقشه صدا زده نمی‌شود.

import { hoodPartOf } from './map-pins'
import { seedNum } from './listing-search'

export type MapPoint = { id: string; lat: number; lng: number; deal: string; priceNum: number; exact: boolean }
export type MapCluster = { lat: number; lng: number; count: number }
export type MapSingle = { id: string; lat: number; lng: number; deal: string; priceNum: number }
export type BBox = { minLat: number; minLng: number; maxLat: number; maxLng: number }

const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)] }

/** مرکزِ هر محله = میانهٔ مختصاتِ آگهی‌های مختصات‌دارِ همان محله (بدونِ هیچ geocodeِ خارجی).
 *  میانه (نه میانگین) تا یک مختصاتِ خرابِ تکی مرکز را نکشد. */
export function hoodCentroidsOf(items: { location?: string; lat?: number; lng?: number }[], city: string): Record<string, { lat: number; lng: number }> {
  const acc: Record<string, { lats: number[]; lngs: number[] }> = {}
  for (const it of items) {
    if (!(it.lat && it.lng)) continue
    const h = hoodPartOf(it.location || '', city)
    if (!h) continue
    const a = (acc[h] ||= { lats: [], lngs: [] })
    a.lats.push(it.lat); a.lngs.push(it.lng)
  }
  const out: Record<string, { lat: number; lng: number }> = {}
  for (const [h, a] of Object.entries(acc)) out[h] = { lat: median(a.lats), lng: median(a.lngs) }
  return out
}

/** هر آگهی → یک نقطه: مختصاتِ واقعی، وگرنه مرکزِ محله + پراکندگیِ قطعیِ کوچک (هشِ id)؛ بی‌نشانی = حذف. */
export function resolveMapPoints(
  items: { id: string; location?: string; lat?: number; lng?: number; deal: string; priceNum: number }[],
  city: string,
  centroids: Record<string, { lat: number; lng: number }>,
): MapPoint[] {
  const out: MapPoint[] = []
  for (const it of items) {
    if (it.lat && it.lng) { out.push({ id: it.id, lat: it.lat, lng: it.lng, deal: it.deal, priceNum: it.priceNum, exact: true }); continue }
    const h = hoodPartOf(it.location || '', city)
    const c = h ? centroids[h] : undefined
    if (!c) continue
    const s = seedNum(it.id)
    out.push({
      id: it.id,
      lat: c.lat + (((s % 1000) / 1000 - 0.5) * 0.005),
      lng: c.lng + ((((s >> 10) % 1000) / 1000 - 0.5) * 0.005),
      deal: it.deal, priceNum: it.priceNum, exact: false,
    })
  }
  return out
}

/** ابعادِ سلولِ شبکه بر حسبِ درجه — ~۵۶ پیکسل در زومِ داده‌شده (همان شعاعِ بصریِ حباب). */
export const cellDegOf = (zoom: number) => (56 * 360) / (256 * Math.pow(2, Math.max(1, Math.min(18, zoom))))

const CLUSTER_CAP = 400
const SINGLE_CAP = 300

/** خوشه‌بندیِ شبکه‌ای: سلول‌های چندتایی → حبابِ شمارش (مرکز = میانگینِ اعضا)؛ تک‌ها → پینِ قیمت. */
export function clusterMapPoints(points: MapPoint[], zoom: number, bbox?: BBox | null): { total: number; clusters: MapCluster[]; singles: MapSingle[] } {
  const inBox = bbox
    ? points.filter(p => p.lat >= bbox.minLat && p.lat <= bbox.maxLat && p.lng >= bbox.minLng && p.lng <= bbox.maxLng)
    : points
  const cell = cellDegOf(zoom)
  const cells = new Map<string, { latSum: number; lngSum: number; count: number; first: MapPoint }>()
  for (const p of inBox) {
    const key = `${Math.floor(p.lat / cell)}:${Math.floor(p.lng / cell)}`
    const c = cells.get(key)
    if (c) { c.latSum += p.lat; c.lngSum += p.lng; c.count++ }
    else cells.set(key, { latSum: p.lat, lngSum: p.lng, count: 1, first: p })
  }
  const clusters: MapCluster[] = []
  const singles: MapSingle[] = []
  for (const c of cells.values()) {
    if (c.count > 1) clusters.push({ lat: c.latSum / c.count, lng: c.lngSum / c.count, count: c.count })
    else singles.push({ id: c.first.id, lat: c.first.lat, lng: c.first.lng, deal: c.first.deal, priceNum: c.first.priceNum })
  }
  clusters.sort((a, b) => b.count - a.count)
  return { total: inBox.length, clusters: clusters.slice(0, CLUSTER_CAP), singles: singles.slice(0, SINGLE_CAP) }
}

/** «minLat,minLng,maxLat,maxLng» → BBox (نامعتبر = null). */
export function parseBBox(s: string): BBox | null {
  const n = (s || '').split(',').map(Number)
  if (n.length !== 4 || n.some(x => !isFinite(x))) return null
  const [a, b, c, d] = n
  return { minLat: Math.min(a, c), minLng: Math.min(b, d), maxLat: Math.max(a, c), maxLng: Math.max(b, d) }
}
