import { listItems, type Item } from './scraper-store'
import { dealOf } from './listing-filter'
import { getAll as geoAll, findNeighborhoodInGeo } from './geo-store'

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

interface Rec { city: string; district: string; ppm: number; t: number }

// فاز ۱۵۵ (فیدبکِ prod: «کلی آگهی داری چرا فقط شهران؟») — استخراجِ مقاوم:
// (۱) فروش با منطقِ مشترکِ dealOf (قیمتِ «۴٬۵۰۰٬۰۰۰٬۰۰۰ تومان» بدونِ واژهٔ میلیارد/فروش هم فروش است)،
// (۲) متراژ اول از متای «متراژ» بعد عنوان/چکیده، (۳) شهر از متا → بخش‌های لوکیشن با فهرستِ واقعیِ
// شهرهای geo → و اگر فقط نامِ محله بود (مثلِ «شهران»)، شهرش از خودِ نقشهٔ geo پیدا می‌شود.
function metaArea(s?: string): number {
  const n = parseInt(faToEn(s || '').replace(/[^\d]/g, ''), 10) || 0
  return n >= 15 && n <= 3000 ? n : 0
}

async function records(): Promise<Rec[]> {
  const cityNames = new Set<string>()
  try { for (const p of geoAll()) for (const c of p.cities) cityNames.add(normCity(c.name)) } catch {}
  const out: Rec[] = []
  for (const it of await listItems('listing')) {
    if (dealOf(it) !== 'sale') continue
    const area = metaArea(it.meta?.['متراژ']) || parseArea(it.title) || parseArea(it.excerpt || '')
    const price = parsePrice(it.price || '')
    if (area < 15 || price < 1e8) continue
    const ppm = price / area
    if (ppm < 1e6 || ppm > 5e9) continue   // sanity bounds (toman/m²)
    let city = (it.meta?.['شهر'] || '').trim()
    let district = (it.meta?.['محله'] || '').trim()
    const parts = (it.location || '').split(/[،,]/).map(s => s.trim()).filter(Boolean)
    if (!city) city = parts.find(p => cityNames.has(normCity(p))) || ''
    if (!district) district = parts.find(p => normCity(p) !== normCity(city)) || ''
    if (!city && district) { try { city = findNeighborhoodInGeo('', district)?.city || '' } catch {} }
    if (district && normCity(district) === normCity(city)) district = ''
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
export async function neighbourhoodStats(city: string, district: string) {
  const recs = (await records()).filter(r => (!district || r.district === district) && (!city || r.city === city))
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

// فاز ۱۵۳ — آمارِ معامله‌های واقعاً ثبت‌شده («فروخته شد/اجاره رفت» + مهرِ __soldAt).
// کمتر از minSamples نمونهٔ مهردار → null؛ کارتِ مربوط اصلاً رندر نمی‌شود (نه عددِ ساختگی).
export async function soldStats(city?: string, district?: string, minSamples = 5) {
  const now = Date.now()
  const rows: { soldAt: number; days: number | null }[] = []
  for (const it of await listItems('listing')) {
    const soldAt = Number(it.meta?.['__soldAt']) || 0
    if (!it.meta?.['__dealStatus'] || !soldAt) continue
    const c = it.meta?.['شهر'] || (it.location || '').split('،').slice(-1)[0]?.trim() || ''
    const d = it.meta?.['محله'] || (it.location || '').split('،')[0]?.trim() || ''
    if (city && normCity(c) !== normCity(city) && !normCity(c).includes(normCity(city))) continue
    if (district && d !== district) continue
    const days = it.scrapedAt && soldAt > it.scrapedAt ? Math.round((soldAt - it.scrapedAt) / 86_400_000) : null
    rows.push({ soldAt, days })
  }
  if (rows.length < minSamples) return null
  const last30 = rows.filter(r => now - r.soldAt <= 30 * 86_400_000).length
  const withDays = rows.map(r => r.days).filter((v): v is number => v !== null && v >= 0)
  const avgDays = withDays.length >= minSamples ? Math.round(withDays.reduce((a, b) => a + b, 0) / withDays.length) : null
  return { total: rows.length, last30, avgDays }
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
export async function marketOverview(city?: string) {
  let recs = await records()
  if (city) { const c = normCity(city); recs = recs.filter(r => { const rc = normCity(r.city); return rc === c || rc.includes(c) || c.includes(rc) }) }
  const byKey: Record<string, Rec[]> = {}
  for (const r of recs) {
    const k = `${r.district || '—'}|${r.city || '—'}`
    ;(byKey[k] = byKey[k] || []).push(r)
  }
  const rows = Object.entries(byKey).map(([k, rs]) => {
    const [district, c] = k.split('|')
    const a = agg(rs.map(r => r.ppm))!
    // فاز ۱۵۳ — رشدِ واقعیِ مشاهده‌شده: میانگینِ اولین ماهِ ثبت‌شده → آخرین ماه. فقط وقتی
    // دست‌کم ۲ ماهِ متمایز داده داریم؛ وگرنه null (هیچ درصدِ ساختگی نمایش داده نمی‌شود).
    const byM: Record<string, number[]> = {}
    for (const r of rs) { const d = new Date(r.t); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; (byM[key] = byM[key] || []).push(r.ppm) }
    const ms = Object.keys(byM).sort()
    let growthPct: number | null = null
    if (ms.length >= 2) {
      const avgOf = (key: string) => byM[key].reduce((s, v) => s + v, 0) / byM[key].length
      const first = avgOf(ms[0]); const last = avgOf(ms[ms.length - 1])
      if (first > 0) growthPct = Math.round((last / first - 1) * 100)
    }
    return { district, city: c, count: a.count, avg: a.avg, median: a.median, min: a.min, max: a.max, growthPct }
  }).sort((a, b) => b.count - a.count)
  const cityAvg = recs.length ? Math.round(recs.reduce((s, r) => s + r.ppm, 0) / recs.length) : 0
  return { totalSaleListings: recs.length, neighbourhoods: rows.length, cityAvg, rows: rows.slice(0, 80) }
}
