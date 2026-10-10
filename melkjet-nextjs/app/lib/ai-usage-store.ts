// دفترِ مصرفِ AI (فاز ۵۴ — فیدبک: «مصرفِ توکن بالا رفته؛ جزءبه‌جز بگو کجاست»).
// هر فراخوانیِ واقعیِ مدل (متن/بینایی/تصویر) در «یک» نقطهٔ خفگی (gapgpt) ثبت می‌شود:
// روز × منبعِ صدازننده (فایلِ کد، خودکار از stack) × مدل × نوع → تعدادِ تماس/توکن/خطا/مدت.
// dual-mode مثلِ بقیه (kv «ai_usage» / فایل)؛ روزهای قدیمی‌تر از ۴۵ روز هرس می‌شوند.
import fs from './fs-atomic'
import path from 'path'
import { pgEnabled, kvGet, kvMutate } from './db'

export interface AiCell { calls: number; tokens: number; errors: number; ms: number }
export interface AiRecent { at: number; src: string; model: string; kind: string; tokens: number; ok: boolean; ms: number; err?: string }   // فاز ۷۸: متنِ خطا هم ثبت می‌شود — «چرا qwen کار نمی‌کند» باید از خودِ دفتر معلوم باشد
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

// ── کوالسِ‌کنندهٔ درون‌حافظه‌ای (فاز ۲۹۸ی۱۷) ───────────────────────────────────
// ریشهٔ «سینک‌ها ابدی در صف با timeout exceeded when trying to connect»: هر فراخوانِ AI
// یک kvMutate کاملِ read-modify-write روی «یک» کلیدِ ai_usage می‌زد. وقتی چیزی (ممیزیِ
// دسته‌ای/غنی‌سازی/ترافیک) ناگهان ~۲۷ فراخوان با هم می‌فرستد — که با مرگِ سهمیهٔ گپ سریع هم
// شکست می‌خورند — ۲۷ نویسنده روی قفلِ همان ردیف سریال می‌شوند و استخرِ اتصال را می‌بلعند
// (lockkey.sql: ai_usage | waiters=27). راهِ درست: افزایش‌ها در حافظه جمع و هر چند ثانیه
// در «یک» نوشتن flush شوند → نوشتن روی ai_usage از ده‌ها در ثانیه به حداکثر ~یکی در ثانیه.
let pendingDays: Record<string, Record<string, AiCell>> = {}
let pendingRecent: AiRecent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let flushing = false
const FLUSH_MS = 4000      // flushِ زمان‌دار
const FLUSH_MAX = 100      // اگر بافر بزرگ شد زودتر flush کن

function scheduleFlush() { if (!flushTimer) flushTimer = setTimeout(() => { flushTimer = null; void flushAiUsage() }, FLUSH_MS) }
function addDelta(dst: Record<string, Record<string, AiCell>>, day: string, key: string, c: AiCell) {
  dst[day] = dst[day] || {}
  const t = dst[day][key] || { calls: 0, tokens: 0, errors: 0, ms: 0 }
  t.calls += c.calls; t.tokens += c.tokens; t.errors += c.errors; t.ms += c.ms
  dst[day][key] = t
}

// flushِ بافر در «یک» نوشتنِ اتمیک. افزایشی است (delta += موجود) پس نوشتنِ اینستنس‌های دیگر
// گم نمی‌شود. شکست → بافر برمی‌گردد تا دورِ بعد دوباره تلاش شود (قانونِ شمارهٔ یک).
export async function flushAiUsage(): Promise<void> {
  if (flushing) return
  if (!pendingRecent.length && !Object.keys(pendingDays).length) return
  flushing = true
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
  const days = pendingDays; const recent = pendingRecent
  pendingDays = {}; pendingRecent = []   // بافرِ تازه برای فراخوان‌های حینِ flush
  try {
    await mutate(d => {
      for (const [day, cells] of Object.entries(days)) for (const [key, c] of Object.entries(cells)) addDelta(d.days, day, key, c)
      if (recent.length) d.recent = recent.concat(d.recent).slice(0, 200)
    })
  } catch {
    for (const [day, cells] of Object.entries(days)) for (const [key, c] of Object.entries(cells)) addDelta(pendingDays, day, key, c)
    pendingRecent = pendingRecent.concat(recent).slice(0, 300)
  } finally {
    flushing = false
    if (pendingRecent.length || Object.keys(pendingDays).length) scheduleFlush()
  }
}

// ثبتِ یک فراخوانی — فقط بافرِ درون‌حافظه را به‌روز می‌کند (بدونِ IO/قفل)؛ flush دسته‌ای می‌شود.
export async function recordAiUse(e: { src?: string; model: string; kind: 'text' | 'vision' | 'image'; tokens: number; ok: boolean; ms: number; err?: string }): Promise<void> {
  const src = (e.src || 'ناشناخته').slice(0, 80)
  const tokens = Math.max(0, Math.round(e.tokens) || 0)
  const ms = Math.max(0, Math.round(e.ms) || 0)
  addDelta(pendingDays, dayOf(), `${src}|${e.model}|${e.kind}`, { calls: 1, tokens, errors: e.ok ? 0 : 1, ms })
  pendingRecent.unshift({ at: Date.now(), src, model: e.model, kind: e.kind, tokens, ok: e.ok, ms, err: e.ok ? undefined : String(e.err || '').slice(0, 160) || undefined })
  if (pendingRecent.length > 300) pendingRecent = pendingRecent.slice(0, 300)
  if (pendingRecent.length >= FLUSH_MAX) void flushAiUsage()
  else scheduleFlush()
}

// فاز ۷۸ — مدارشکنِ مدل: مدلی که N بارِ پیاپی شکست خورده تا مدتی «خراب» شمرده می‌شود و chatCompleteSafe
// مستقیم سراغِ مدلِ جایگزین می‌رود — نه تماسِ سوخته، نه تأخیرِ اضافه. درون-حافظه‌ای per-instance (سبک و بدونِ IO).
const FAIL_TRIP = 4            // چند شکستِ پیاپی تا قطعِ مدار
const DOWN_MS = 10 * 60_000    // مدتِ کنارگذاشتن
const health78 = new Map<string, { fails: number; downUntil: number }>()
export function noteModelResult(model: string, ok: boolean): void {
  const h = health78.get(model) || { fails: 0, downUntil: 0 }
  if (ok) { h.fails = 0; h.downUntil = 0 } else { h.fails++; if (h.fails >= FAIL_TRIP) h.downUntil = Date.now() + DOWN_MS }
  health78.set(model, h)
}
export function modelDown(model: string): boolean {
  const h = health78.get(model)
  return !!h && h.downUntil > Date.now()
}

// خلاصهٔ جزءبه‌جز برای پنلِ ادمین: به تفکیکِ منبع (کدام فیچر)، مدل، و روز — همه از دادهٔ ثبت‌شدهٔ واقعی.
export async function aiUsageSummary(days = 30) {
  await flushAiUsage().catch(() => {})   // بافرِ درون‌حافظه را پیش از خواندن خالی کن تا آمار کهنه نباشد
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
