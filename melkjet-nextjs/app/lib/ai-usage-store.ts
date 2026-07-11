// دفترِ مصرفِ AI (فاز ۵۴ — فیدبک: «مصرفِ توکن بالا رفته؛ جزءبه‌جز بگو کجاست»).
// هر فراخوانیِ واقعیِ مدل (متن/بینایی/تصویر) در «یک» نقطهٔ خفگی (gapgpt) ثبت می‌شود:
// روز × منبعِ صدازننده (فایلِ کد، خودکار از stack) × مدل × نوع → تعدادِ تماس/توکن/خطا/مدت.
// dual-mode مثلِ بقیه (kv «ai_usage» / فایل)؛ روزهای قدیمی‌تر از ۴۵ روز هرس می‌شوند.
import fs from 'fs'
import path from 'path'
import { pgEnabled, kvGet, kvMutate } from './db'

export interface AiCell { calls: number; tokens: number; errors: number; ms: number }
export interface AiRecent { at: number; src: string; model: string; kind: string; tokens: number; ok: boolean; ms: number }
interface AiDb { days: Record<string, Record<string, AiCell>>; recent: AiRecent[] }

const FILE = path.join(process.cwd(), '.ai-usage-data.json')
const KV = 'ai_usage'
const KEEP_DAYS = 45
const EMPTY: AiDb = { days: {}, recent: [] }

const dayOf = (ts = Date.now()) => new Date(ts).toISOString().slice(0, 10)

// منبعِ صدازننده از stack — اولین فریمِ داخلِ app/ که خودِ لایهٔ AI نباشد؛ در build هم مسیرِ chunk برمی‌گردد
// که باز از «ناشناخته» بهتر است. هر جا src صریح پاس شود، مقدم است.
export function callerSrcOf(stack?: string): string {
  const lines = (stack || new Error().stack || '').split('\n')
  for (const l of lines) {
    if (/gapgpt|ai-usage-store/.test(l)) continue
    const m = l.match(/(app[\\/][\w\\/.\-\[\]]+?)(?:\.tsx?|\.js)?[):\s]/) || l.match(/\(([^)]*app[\\/][^):]+)/)
    if (m) return m[1].replace(/\\/g, '/').replace(/^.*?(app\/)/, '$1').slice(0, 80)
  }
  return 'ناشناخته'
}

async function loadAll(): Promise<AiDb> {
  if (pgEnabled()) { const d = await kvGet<AiDb>(KV, EMPTY).catch(() => EMPTY); return { days: d.days || {}, recent: d.recent || [] } }
  try { const d = JSON.parse(fs.readFileSync(FILE, 'utf-8')); return { days: d.days || {}, recent: d.recent || [] } } catch { return { days: {}, recent: [] } }
}
function prune(d: AiDb): AiDb {
  const cutoff = dayOf(Date.now() - KEEP_DAYS * 864e5)
  for (const k of Object.keys(d.days)) if (k < cutoff) delete d.days[k]
  d.recent = (d.recent || []).slice(0, 200)
  return d
}
async function mutate<R>(fn: (d: AiDb) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<AiDb, R>(KV, EMPTY, raw => { const d = prune({ days: raw.days || {}, recent: raw.recent || [] }); const out = fn(d); Object.assign(raw as AiDb, d); return out })
  const d = prune(await loadAll())
  const out = fn(d)
  fs.writeFileSync(FILE, JSON.stringify(d))
  return out
}

// ثبتِ یک فراخوانی — fire-and-forget از gapgpt (خطای ثبت هرگز خودِ فیچر را خراب نمی‌کند).
export async function recordAiUse(e: { src?: string; model: string; kind: 'text' | 'vision' | 'image'; tokens: number; ok: boolean; ms: number }): Promise<void> {
  const src = (e.src || 'ناشناخته').slice(0, 80)
  await mutate(d => {
    const day = dayOf()
    d.days[day] = d.days[day] || {}
    const key = `${src}|${e.model}|${e.kind}`
    const c = d.days[day][key] || { calls: 0, tokens: 0, errors: 0, ms: 0 }
    c.calls++; c.tokens += Math.max(0, Math.round(e.tokens) || 0); c.ms += Math.max(0, Math.round(e.ms) || 0)
    if (!e.ok) c.errors++
    d.days[day][key] = c
    d.recent.unshift({ at: Date.now(), src, model: e.model, kind: e.kind, tokens: Math.max(0, Math.round(e.tokens) || 0), ok: e.ok, ms: Math.round(e.ms) || 0 })
    d.recent = d.recent.slice(0, 200)
  })
}

// خلاصهٔ جزءبه‌جز برای پنلِ ادمین: به تفکیکِ منبع (کدام فیچر)، مدل، و روز — همه از دادهٔ ثبت‌شدهٔ واقعی.
export async function aiUsageSummary(days = 30) {
  const d = await loadAll()
  const cutoff = dayOf(Date.now() - Math.max(1, days) * 864e5)
  const bySrc: Record<string, AiCell> = {}
  const byModel: Record<string, AiCell> = {}
  const byDay: Array<{ day: string; calls: number; tokens: number; errors: number }> = []
  let total: AiCell = { calls: 0, tokens: 0, errors: 0, ms: 0 }
  const add = (t: AiCell, c: AiCell) => { t.calls += c.calls; t.tokens += c.tokens; t.errors += c.errors; t.ms += c.ms }
  for (const [day, cells] of Object.entries(d.days).sort()) {
    if (day < cutoff) continue
    const dayAgg = { day, calls: 0, tokens: 0, errors: 0 }
    for (const [key, c] of Object.entries(cells)) {
      const [src, model] = key.split('|')
      bySrc[src] = bySrc[src] || { calls: 0, tokens: 0, errors: 0, ms: 0 }; add(bySrc[src], c)
      byModel[model] = byModel[model] || { calls: 0, tokens: 0, errors: 0, ms: 0 }; add(byModel[model], c)
      add(total, c); dayAgg.calls += c.calls; dayAgg.tokens += c.tokens; dayAgg.errors += c.errors
    }
    byDay.push(dayAgg)
  }
  const today = d.days[dayOf()] || {}
  const todayAgg = Object.values(today).reduce((t, c) => ({ calls: t.calls + c.calls, tokens: t.tokens + c.tokens, errors: t.errors + c.errors, ms: 0 }), { calls: 0, tokens: 0, errors: 0, ms: 0 })
  return {
    total, today: todayAgg,
    bySrc: Object.entries(bySrc).map(([src, c]) => ({ src, ...c })).sort((a, b) => b.tokens - a.tokens),
    byModel: Object.entries(byModel).map(([model, c]) => ({ model, ...c })).sort((a, b) => b.tokens - a.tokens),
    byDay: byDay.slice(-30),
    recent: d.recent.slice(0, 60),
  }
}
