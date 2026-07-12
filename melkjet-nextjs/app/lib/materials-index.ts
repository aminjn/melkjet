import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { materialPriceIndex } from './materials-store'

// فاز ۱۰۰ (جلد ۴۳ — شاخصِ قیمتِ مصالح): سریِ زمانیِ روزانه از قیمت‌های «واقعیِ»
// محصولاتِ فعالِ فروشگاه‌های بازارِ مصالح (همان منبعِ «نرخِ روز»). هیچ عددی ساختگی
// نیست: اگر پوشش (تعدادِ کالا) کافی نباشد، شاخص «دادهٔ کافی نیست» می‌گوید و
// ضریبِ ساخت ۱ می‌ماند. اسنپ‌شات فقط روی instance-0 (کرانِ روزانه) نوشته می‌شود.
const DATA_FILE = join(process.cwd(), '.materials-index-data.json')

export interface MatSnapshot {
  day: number                     // dayNumber (قانون ۱۰)
  overall: number                 // مدینِ مدین‌قیمتِ کالاها (تومان)
  items: number                   // چند کالای متمایز
  sellers: number                 // بیشترین شمارِ فروشندهٔ یک کالا (عمقِ بازار)
  cats: Record<string, number>    // مدینِ هر دسته
}
interface MatDb { base?: { day: number; overall: number }; snapshots: MatSnapshot[] }

export const dayNumberOf = (now: number) => Math.floor(now / 86400000)

function load(): MatDb {
  if (existsSync(DATA_FILE)) { try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {} }
  return { snapshots: [] }
}
function save(db: MatDb) { writeFileSync(DATA_FILE, JSON.stringify(db), 'utf-8') }

export function medianOf(nums: number[]): number {
  const s = nums.filter(n => Number.isFinite(n) && n > 0).sort((a, b) => a - b)
  if (!s.length) return 0
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

/** خالص: از ردیف‌های materialPriceIndex یک اسنپ‌شاتِ روز می‌سازد. */
export function computeMaterialsSnapshot(rows: { category: string; median: number; sellers: number }[], day: number): MatSnapshot {
  const byCat = new Map<string, number[]>()
  for (const r of rows) {
    if (!(r.median > 0)) continue
    const c = r.category || 'سایر'
    if (!byCat.has(c)) byCat.set(c, [])
    byCat.get(c)!.push(r.median)
  }
  const cats: Record<string, number> = {}
  for (const [c, arr] of byCat) cats[c] = medianOf(arr)
  const all = rows.map(r => r.median)
  return {
    day, overall: medianOf(all), items: all.filter(n => n > 0).length,
    sellers: rows.reduce((m, r) => Math.max(m, r.sellers || 0), 0), cats,
  }
}

/** ثبتِ اسنپ‌شات (ایدمپوتنت روی روز — همان روز = تازه‌سازی). پایه = اولین روزِ با پوششِ کافی. */
export function recordMaterialsSnapshot(snap: MatSnapshot, minItems: number): MatDb {
  const db = load()
  const i = db.snapshots.findIndex(s => s.day === snap.day)
  if (i >= 0) db.snapshots[i] = snap
  else db.snapshots.push(snap)
  db.snapshots.sort((a, b) => a.day - b.day)
  if (db.snapshots.length > 400) db.snapshots = db.snapshots.slice(-400)
  if (!db.base && snap.items >= minItems && snap.overall > 0) db.base = { day: snap.day, overall: snap.overall }
  save(db)
  return db
}

/** کرانِ روزانه (instance-0): یک اسنپ‌شات از قیمت‌های واقعیِ همین لحظه. */
export async function maybeSnapshotMaterialsIndex(now: number, minItems: number): Promise<MatSnapshot | null> {
  const day = dayNumberOf(now)
  const db = load()
  const last = db.snapshots[db.snapshots.length - 1]
  if (last && last.day === day) return null    // امروز ثبت شده
  const { rows } = await materialPriceIndex()
  const snap = computeMaterialsSnapshot(rows, day)
  recordMaterialsSnapshot(snap, minItems)
  return snap
}

export interface MatIndexState {
  ok: boolean                 // پوششِ کافی + پایه ثبت شده
  index: number               // پایه = ۱۰۰
  overall: number             // تومانِ مدینِ فعلی
  items: number
  sellers: number
  weekDeltaPct: number | null
  monthDeltaPct: number | null
  cats: { name: string; median: number }[]
  spark: { day: number; index: number }[]
  baseDay: number | null
}

function idxOf(overall: number, base: number): number { return base > 0 ? Math.round((overall / base) * 1000) / 10 : 0 }

export function materialsIndexState(minItems: number): MatIndexState {
  const db = load()
  const last = db.snapshots[db.snapshots.length - 1]
  const base = db.base
  const ok = !!(last && base && last.items >= minItems && last.overall > 0)
  const at = (daysBack: number) => {
    if (!last) return null
    const target = last.day - daysBack
    let best: MatSnapshot | null = null
    for (const s of db.snapshots) if (s.day <= target && (!best || s.day > best.day)) best = s
    return best
  }
  const pct = (from: MatSnapshot | null) => (from && from.overall > 0 && last) ? Math.round(((last.overall - from.overall) / from.overall) * 1000) / 10 : null
  return {
    ok,
    index: ok ? idxOf(last!.overall, base!.overall) : 0,
    overall: last?.overall || 0,
    items: last?.items || 0,
    sellers: last?.sellers || 0,
    weekDeltaPct: pct(at(7)),
    monthDeltaPct: pct(at(30)),
    cats: last ? Object.entries(last.cats).map(([name, median]) => ({ name, median })).sort((a, b) => b.median - a.median).slice(0, 8) : [],
    spark: base ? db.snapshots.slice(-30).map(s => ({ day: s.day, index: idxOf(s.overall, base.overall) })) : [],
    baseDay: base?.day ?? null,
  }
}

/** ضریبِ هزینهٔ ساختِ امپراتوری از شاخص — با سقف/کفِ knobدار؛ بدونِ پوششِ کافی = ۱ (بی‌اثر). */
export function materialsFactorOf(state: Pick<MatIndexState, 'ok' | 'index'>, cfg: { enabled: boolean; clampMin: number; clampMax: number }): number {
  if (!cfg.enabled || !state.ok || !(state.index > 0)) return 1
  const f = state.index / 100
  return Math.round(Math.min(Math.max(f, cfg.clampMin), cfg.clampMax) * 1000) / 1000
}
