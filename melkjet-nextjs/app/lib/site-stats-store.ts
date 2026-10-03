import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from './fs-atomic'
import { pgEnabled, kvGet, kvMutate, kvGetPrefix } from './db'

// ─── فاز ۲۹۶ب — آمارِ سایت‌های اختصاصی (بازدید/جستجو) ───────────────────────────
// هر سایت ردیفِ kv خودش را دارد (الگوی شاردِ فاز ۲۵۹/۲۹۱ — هیچ بلابِ مشترکی):
//   sstat:{slug} → { days: {YYYY-MM-DD: {v,s}}, totalV, totalS, lastAt, queries[] }
// بازدید از بیکنِ کلاینتی می‌آید (مرورگرِ واقعی؛ بات‌های بدونِ JS شمرده نمی‌شوند) و
// جستجو از فیلترِ آگهی‌های خودِ سایت. فقط ۴۵ روزِ اخیر و ۳۰ جستجوی آخر نگه داشته می‌شود.

const FILE = join(process.cwd(), '.site-stats.json')
const KEY = (slug: string) => 'sstat:' + slug
const DAYS_KEEP = 45
const QUERIES_KEEP = 30

export interface SiteStats {
  days: Record<string, { v: number; s: number }>
  totalV: number
  totalS: number
  lastAt: number
  queries: { q: string; at: number }[]
}
const EMPTY: SiteStats = { days: {}, totalV: 0, totalS: 0, lastAt: 0, queries: [] }

const dayKey = (ts = Date.now()) => new Date(ts).toISOString().slice(0, 10)

function trim(st: SiteStats) {
  const keys = Object.keys(st.days).sort()
  while (keys.length > DAYS_KEEP) { delete st.days[keys.shift()!] }
  if (st.queries.length > QUERIES_KEEP) st.queries = st.queries.slice(0, QUERIES_KEEP)
}

type FileDB = Record<string, SiteStats>
function fileLoad(): FileDB { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return {} }
function fileSave(db: FileDB) { writeFileSync(FILE, JSON.stringify(db), 'utf-8') }

/** ثبتِ یک رخداد (بازدید یا جستجو) برای یک سایت. */
export async function recordSiteHit(slug: string, kind: 'view' | 'search', q?: string): Promise<void> {
  const apply = (st: SiteStats) => {
    const d = (st.days[dayKey()] = st.days[dayKey()] || { v: 0, s: 0 })
    if (kind === 'view') { d.v++; st.totalV++ } else { d.s++; st.totalS++ }
    st.lastAt = Date.now()
    const qq = String(q || '').trim().slice(0, 60)
    if (kind === 'search' && qq.length >= 2) st.queries.unshift({ q: qq, at: Date.now() })
    trim(st)
  }
  if (!pgEnabled()) { const db = fileLoad(); const st = (db[slug] = db[slug] || JSON.parse(JSON.stringify(EMPTY))); apply(st); fileSave(db); return }
  await kvMutate<SiteStats, void>(KEY(slug), JSON.parse(JSON.stringify(EMPTY)), st => { st.days = st.days || {}; st.queries = st.queries || []; apply(st) })
}

/** فاز ۲۹۷ق — آمارِ «یک» سایت (نشانِ بازدید روی هیروی خودِ سایت): یک ردیفِ کوچک، نه کلِ ناوگان. */
export async function getSiteStats(slug: string): Promise<SiteStats | null> {
  if (!pgEnabled()) return fileLoad()[slug] || null
  const row = await kvGet<SiteStats | null>(KEY(slug), null)
  return row ? { ...EMPTY, ...row, days: row.days || {}, queries: row.queries || [] } : null
}

/** همهٔ آمارها یکجا (برای پنلِ ادمین) — کلید: slug. */
export async function allSiteStats(): Promise<Map<string, SiteStats>> {
  const out = new Map<string, SiteStats>()
  if (!pgEnabled()) { for (const [slug, st] of Object.entries(fileLoad())) out.set(slug, st); return out }
  for (const row of await kvGetPrefix<SiteStats>('sstat:')) {
    out.set(row.key.slice('sstat:'.length), { ...EMPTY, ...row.data, days: row.data?.days || {}, queries: row.data?.queries || [] })
  }
  return out
}

/** جمعِ بازه‌ای برای نمایش: امروز / ۷ روز / کل. */
export function summarize(st: SiteStats | undefined, now = Date.now()) {
  if (!st) return { today: 0, d7v: 0, d7s: 0, totalV: 0, totalS: 0, lastAt: 0 }
  const today = st.days[dayKey(now)]?.v || 0
  let d7v = 0, d7s = 0
  for (let i = 0; i < 7; i++) { const d = st.days[dayKey(now - i * 864e5)]; if (d) { d7v += d.v; d7s += d.s } }
  return { today, d7v, d7s, totalV: st.totalV || 0, totalS: st.totalS || 0, lastAt: st.lastAt || 0 }
}
