import type { Shop, Product, Order } from './materials-store'

// ── موتورِ AI فروشندهٔ مصالح (heuristic-first) ──
// پیش‌بینیِ تقاضا + پیشنهادِ قیمت (بر اساسِ میانگینِ دستهٔ خودِ فروشگاه).

function monthlyAmounts(orders: Order[]): number[] {
  const by = new Map<string, number>()
  for (const o of orders) {
    const d = new Date(o.createdAt)
    const k = `${d.getFullYear()}-${d.getMonth()}`
    by.set(k, (by.get(k) || 0) + (o.amount || 0))
  }
  return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(e => e[1])
}

export interface DemandForecast {
  trendPct: number
  nextMonth: number
  topProducts: { name: string; sold: number; stock: number }[]
  restock: { name: string; stock: number; threshold: number; reason: string }[]
}
export function demandForecast(shop: Shop): DemandForecast {
  const amts = monthlyAmounts(shop.orders || [])
  const recent = amts.slice(-3)
  const base = recent.length ? recent.reduce((s, v) => s + v, 0) / recent.length : 0
  let trendPct = 0
  if (recent.length >= 2) { const f = recent[0] || 1, l = recent[recent.length - 1]; trendPct = f ? Math.round(((l - f) / f) * 100) : 0 }
  const nextMonth = Math.round(base * (1 + trendPct / 100))
  const active = (shop.products || []).filter(p => p.active)
  const topProducts = [...active].sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 5).map(p => ({ name: p.name, sold: p.sold || 0, stock: p.stock }))
  const restock = active.filter(p => p.stock <= (p.threshold || 0) || ((p.sold || 0) >= 5 && p.stock <= (p.threshold || 0) * 2))
    .slice(0, 8)
    .map(p => ({ name: p.name, stock: p.stock, threshold: p.threshold || 0, reason: p.stock <= (p.threshold || 0) ? 'زیرِ آستانهٔ موجودی' : 'پرفروش و رو به اتمام' }))
  return { trendPct, nextMonth, topProducts, restock }
}

export interface PriceRow { name: string; price: number; catAvg: number; delta: number; hint: string }
export function priceInsights(shop: Shop): PriceRow[] {
  const active = (shop.products || []).filter(p => p.active && p.price > 0)
  const byCat = new Map<string, number[]>()
  for (const p of active) { const a = byCat.get(p.category) || []; a.push(p.price); byCat.set(p.category, a) }
  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0
  return active.map((p: Product) => {
    const catAvg = avg(byCat.get(p.category) || [])
    const delta = catAvg > 0 ? Math.round(((p.price - catAvg) / catAvg) * 100) : 0
    const hint = catAvg === 0 ? '—' : delta > 12 ? 'گران‌تر از میانگینِ دسته' : delta < -12 ? 'ارزان‌تر از میانگینِ دسته (فرصتِ افزایش)' : 'نزدیک به میانگینِ دسته'
    return { name: p.name, price: p.price, catAvg, delta, hint }
  }).filter(r => r.catAvg > 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 8)
}
