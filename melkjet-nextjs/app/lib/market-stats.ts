import { listItems, type Item } from './scraper-store'

// ── Persian number / price / area parsing ──────────────────────────────────
function faToEn(s: string): string {
  return (s || '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
}

export function parsePrice(s: string): number {
  const e = faToEn(s || '')
  const m = e.match(/(\d[\d,]*\.?\d*)/)
  if (!m) return 0
  let n = parseFloat(m[1].replace(/,/g, ''))
  if (!isFinite(n)) return 0
  if (/میلیارد/.test(e)) n *= 1e9
  else if (/میلیون/.test(e)) n *= 1e6
  else if (/هزار/.test(e)) n *= 1e3
  return n
}

export function parseArea(s: string): number {
  const e = faToEn(s || '')
  const m = e.match(/(\d{2,4})\s*متر/) || e.match(/(\d{2,4})\s*m/i)
  return m ? parseInt(m[1], 10) : 0
}

function isSale(it: Item): boolean {
  const cat = it.meta?.['category'] || ''
  if (/sell/.test(cat)) return true
  if (/rent/.test(cat)) return false
  const t = `${it.price || ''} ${it.title || ''} ${it.meta?.['نوع معامله'] || ''}`
  if (/ودیعه|اجاره|رهن/.test(t)) return false
  return /فروش|خرید|قیمت کل|میلیارد/.test(t)
}

interface Rec { city: string; district: string; ppm: number; t: number }

function records(): Rec[] {
  const out: Rec[] = []
  for (const it of listItems('listing')) {
    if (!isSale(it)) continue
    const area = parseArea(it.title) || parseArea(it.excerpt || '')
    const price = parsePrice(it.price || '')
    if (area < 15 || price < 1e8) continue
    const ppm = price / area
    if (ppm < 1e6 || ppm > 5e9) continue   // sanity bounds (toman/m²)
    const city = it.meta?.['شهر'] || (it.location || '').split('،').slice(-1)[0]?.trim() || ''
    const district = it.meta?.['محله'] || (it.location || '').split('،')[0]?.trim() || ''
    out.push({ city, district, ppm, t: it.scrapedAt })
  }
  return out
}

function agg(vals: number[]) {
  if (!vals.length) return null
  const sorted = [...vals].sort((a, b) => a - b)
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length
  const median = sorted[Math.floor(sorted.length / 2)]
  return { count: vals.length, avg: Math.round(avg), median: Math.round(median), min: Math.round(sorted[0]), max: Math.round(sorted[sorted.length - 1]) }
}

// Stats for one neighbourhood (+ monthly trend) for the sale market.
export function neighbourhoodStats(city: string, district: string) {
  const recs = records().filter(r => (!district || r.district === district) && (!city || r.city === city))
  const base = agg(recs.map(r => r.ppm))
  if (!base) return null
  // monthly trend (last 12 months by scrape date)
  const byMonth: Record<string, number[]> = {}
  for (const r of recs) {
    const d = new Date(r.t)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    ;(byMonth[key] = byMonth[key] || []).push(r.ppm)
  }
  const months = Object.keys(byMonth).sort()
  const trend = months.map(k => ({ month: k, avg: Math.round(byMonth[k].reduce((a, b) => a + b, 0) / byMonth[k].length) }))
  return { ...base, trend }
}

// Value score 0-10: cheaper than the neighbourhood average → higher score.
export function valueScore(thisPpm: number, avgPpm: number): number {
  if (!avgPpm || !thisPpm) return 0
  const ratio = thisPpm / avgPpm           // <1 cheaper, >1 pricier
  const score = 7.5 + (1 - ratio) * 10      // 1.0→7.5, 0.85→9, 1.15→6
  return Math.max(1, Math.min(10, Math.round(score * 10) / 10))
}

// Market overview: top neighbourhoods by avg price/m² and listing counts.
function normCity(s: string): string { return (s || '').replace(/‌/g, '').replace(/\s+/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim() }
export function marketOverview(city?: string) {
  let recs = records()
  if (city) { const c = normCity(city); recs = recs.filter(r => { const rc = normCity(r.city); return rc === c || rc.includes(c) || c.includes(rc) }) }
  const byKey: Record<string, number[]> = {}
  for (const r of recs) {
    const k = `${r.district || '—'}|${r.city || '—'}`
    ;(byKey[k] = byKey[k] || []).push(r.ppm)
  }
  const rows = Object.entries(byKey).map(([k, vals]) => {
    const [district, c] = k.split('|')
    const a = agg(vals)!
    return { district, city: c, count: a.count, avg: a.avg, median: a.median, min: a.min, max: a.max }
  }).sort((a, b) => b.count - a.count)
  const cityAvg = recs.length ? Math.round(recs.reduce((s, r) => s + r.ppm, 0) / recs.length) : 0
  return { totalSaleListings: recs.length, neighbourhoods: rows.length, cityAvg, rows: rows.slice(0, 80) }
}
