import { readJsonCached, writeJsonCached } from './json-file'
import { join } from 'path'
import { randomBytes } from 'crypto'

const DATA_FILE = join(process.cwd(), '.market-data.json')

// A single structured market data point (from documents / AI / manual / scrape).
export interface DataPoint {
  id: string
  city?: string
  district?: string
  period?: string        // e.g. "1403" or "1403-06"
  metric: string         // e.g. "میانگین قیمت هر متر", "تعداد معاملات", "نرخ رشد"
  value: number
  unit?: string          // e.g. "تومان", "معامله", "٪"
  source: string         // document name / "AI" / "دستی" / "اسکرپ"
  note?: string
  addedAt: number
}

interface DB { points: DataPoint[] }

function load(): DB {
  return readJsonCached<DB>(DATA_FILE, { points: [] })
}
function save(db: DB) { writeJsonCached(DATA_FILE, db) }
function id() { return randomBytes(6).toString('hex') }

export function listPoints(filter?: { city?: string; district?: string; metric?: string }): DataPoint[] {
  let pts = [...load().points]   // کپی تا sortِ درجا کش را جابه‌جا نکند
  if (filter?.city) pts = pts.filter(p => p.city === filter.city)
  if (filter?.district) pts = pts.filter(p => p.district === filter.district)
  if (filter?.metric) pts = pts.filter(p => p.metric.includes(filter.metric!))
  return pts.sort((a, b) => b.addedAt - a.addedAt)
}

export function addPoints(raw: Omit<DataPoint, 'id' | 'addedAt'>[]): number {
  const db = load()
  let n = 0
  for (const r of raw) {
    if (!r.metric || typeof r.value !== 'number' || !isFinite(r.value)) continue
    db.points.unshift({ ...r, id: id(), addedAt: Date.now() })
    n++
  }
  if (db.points.length > 5000) db.points = db.points.slice(0, 5000)
  save(db)
  return n
}

export function deletePoint(pid: string) {
  const db = load(); db.points = db.points.filter(p => p.id !== pid); save(db)
}
export function clearPoints(source?: string) {
  const db = load(); db.points = source ? db.points.filter(p => p.source !== source) : []; save(db)
}

// Relevant context for a neighbourhood, fed to the AI when analysing a listing.
export function knowledgeFor(city: string, district: string, limit = 12): DataPoint[] {
  const pts = load().points
  const scored = pts.map(p => {
    let s = 0
    if (district && p.district === district) s += 3
    if (city && p.city === city) s += 1
    if (!p.district && !p.city) s += 0.2   // general national data
    return { p, s }
  }).filter(x => x.s > 0).sort((a, b) => b.s - a.s || b.p.addedAt - a.p.addedAt)
  return scored.slice(0, limit).map(x => x.p)
}

export function dataStats() {
  const pts = load().points
  const sources = Array.from(new Set(pts.map(p => p.source)))
  const metrics = Array.from(new Set(pts.map(p => p.metric)))
  return { total: pts.length, sources: sources.length, metrics, sourceList: sources }
}

// "Train" a market model from the dataset: per (city, district) build a price
// index, growth rate, and a next-period forecast from the time-ordered points.
export function buildModel() {
  const pts = load().points.filter(p => /قیمت/.test(p.metric))
  const groups: Record<string, { city?: string; district?: string; series: { period: string; value: number }[] }> = {}
  for (const p of pts) {
    const k = `${p.district || '—'}|${p.city || '—'}`
    const g = groups[k] || (groups[k] = { city: p.city, district: p.district, series: [] })
    g.series.push({ period: p.period || '', value: p.value })
  }
  const indices = Object.values(groups).map(g => {
    const s = g.series.sort((a, b) => a.period.localeCompare(b.period))
    const first = s[0]?.value || 0, latest = s[s.length - 1]?.value || 0
    const growth = first ? (latest - first) / first : 0
    const perStep = s.length > 1 ? growth / (s.length - 1) : growth
    const forecast = Math.round(latest * (1 + perStep))
    return {
      district: g.district || '—', city: g.city || '—', points: s.length,
      latest: Math.round(latest), growth: Math.round(growth * 100),
      forecast, series: s,
    }
  }).sort((a, b) => b.latest - a.latest)
  return { trainedOn: pts.length, totalPoints: load().points.length, indices, trainedAt: Date.now() }
}

