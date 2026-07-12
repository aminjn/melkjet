import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'

// ترکرِ بازدیدکننده‌ها (per-visitor، با کوکیِ دائمیِ mj_vid).
// هر بازدیدکننده — چه لاگین چه نه — ثبت می‌شود؛ پس از لاگین، شماره به همان کوکی وصل می‌شود.
// رویدادهای بازدید نگه داشته می‌شوند و برای «پیامکِ هدفمند» (بازاریابی مجدد) استفاده می‌شوند.
// دومَحاله: اگر DATABASE_URL ست باشد → Postgres (نوشتنِ اتمیک)، وگرنه فایل.
const DATA_FILE = join(process.cwd(), '.tracker-data.json')
const KV_KEY = 'tracker'

export interface TrackEvent { url: string; title?: string; at: number }
export interface Pending { message: string; title: string; url: string; dueAt: number }
export interface Visitor {
  vid: string
  phone?: string
  firstSeen: number
  lastSeen: number
  events: TrackEvent[]
  pending?: Pending
  lastSentAt?: number
  sentCount?: number
}
interface DB { visitors: Record<string, Visitor> }

const MAX_EVENTS = 200   // فاز ۹۱: سقفِ ۵۰ برای کاربرِ فعال کم بود
function fileLoad(): DB { if (existsSync(DATA_FILE)) { try { const d = JSON.parse(readFileSync(DATA_FILE, 'utf-8')); return { visitors: d.visitors || {} } } catch {} } return { visitors: {} } }
function fileSave(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8') }

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, { visitors: {} }) : fileLoad() }
async function mutate<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, { visitors: {} }, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

export function newVid(): string { return randomBytes(16).toString('hex') }

export async function ensureVisitor(vid: string): Promise<Visitor> {
  const db = await load()
  // اگر از قبل باشد، بدونِ نوشتن برگردان (مثلِ قبل که فقط وقتی نبود ذخیره می‌شد).
  if (db.visitors[vid]) return db.visitors[vid]
  return mutate(d => {
    if (!d.visitors[vid]) d.visitors[vid] = { vid, firstSeen: Date.now(), lastSeen: Date.now(), events: [] }
    return d.visitors[vid]
  })
}

export async function recordEvent(vid: string, ev: TrackEvent): Promise<Visitor> {
  return mutate(db => {
    const v = db.visitors[vid] || { vid, firstSeen: Date.now(), lastSeen: Date.now(), events: [] }
    v.events.unshift(ev)
    if (v.events.length > MAX_EVENTS) v.events = v.events.slice(0, MAX_EVENTS)
    v.lastSeen = Date.now()
    db.visitors[vid] = v
    return v
  })
}

export async function linkPhone(vid: string, phone: string): Promise<Visitor> {
  return mutate(db => {
    const v = db.visitors[vid] || { vid, firstSeen: Date.now(), lastSeen: Date.now(), events: [] }
    v.phone = phone
    v.lastSeen = Date.now()
    db.visitors[vid] = v
    return v
  })
}

export async function getVisitor(vid: string): Promise<Visitor | null> { return (await load()).visitors[vid] || null }

// آیا می‌توان برای این بازدیدکننده پیامک فرستاد؟ (محدودیتِ زمانی)
export async function canSend(vid: string, throttleMs: number): Promise<boolean> {
  const v = (await load()).visitors[vid]
  if (!v || !v.phone) return false
  if (v.pending) return false
  if (v.lastSentAt && Date.now() - v.lastSentAt < throttleMs) return false
  return true
}

export async function enqueuePending(vid: string, p: Pending): Promise<void> {
  await mutate(db => { const v = db.visitors[vid]; if (!v) return; v.pending = p; db.visitors[vid] = v })
}

// بازدیدکننده‌هایی که پیامکِ آماده‌ی ارسال دارند (موعدشان رسیده و شماره دارند).
export async function listDuePending(now: number): Promise<{ vid: string; phone: string; pending: Pending }[]> {
  const db = await load()
  const out: { vid: string; phone: string; pending: Pending }[] = []
  for (const v of Object.values(db.visitors)) {
    if (v.pending && v.phone && v.pending.dueAt <= now) out.push({ vid: v.vid, phone: v.phone, pending: v.pending })
  }
  return out
}

export async function markSent(vid: string, ok: boolean): Promise<void> {
  await mutate(db => {
    const v = db.visitors[vid]; if (!v) return
    v.pending = undefined
    if (ok) { v.lastSentAt = Date.now(); v.sentCount = (v.sentCount || 0) + 1 }
    db.visitors[vid] = v
  })
}

// فاز ۸۸ (فیدبک: «ترکر جایی نشان نمی‌دهد کدام کاربر کدام صفحه‌ها رفته»): فهرستِ بازدیدکننده‌های اخیر
// با تاریخچهٔ صفحه‌هایشان — برای نمای ادمین. مرتب بر اساسِ آخرین بازدید؛ رویدادها از انتها (تازه‌ترین‌ها).
// فاز ۹۱ (فیدبک: «هر کاربر چند ردیفِ تکراری دارد»): کاربرِ شناخته‌شده با «همهٔ» کوکی‌هایش یک ردیف می‌شود
// (کلید = شماره؛ ناشناس‌ها همچنان per-vid). رویدادهای تکراریِ پشتِ‌سرِهمِ همان URL ادغام می‌شوند.
export async function recentVisitors(limit = 60, eventsTail = 40): Promise<Array<{ vid: string; phone?: string; devices: number; firstSeen: number; lastSeen: number; total: number; events: TrackEvent[] }>> {
  const db = await load()
  const byKey = new Map<string, { vid: string; phone?: string; devices: number; firstSeen: number; lastSeen: number; total: number; events: TrackEvent[] }>()
  for (const v of Object.values(db.visitors)) {
    const key = v.phone || `vid:${v.vid}`
    const ex = byKey.get(key)
    if (ex) {
      ex.devices++
      ex.firstSeen = Math.min(ex.firstSeen, v.firstSeen)
      ex.lastSeen = Math.max(ex.lastSeen, v.lastSeen)
      ex.total += v.events.length
      ex.events.push(...v.events)
    } else {
      byKey.set(key, { vid: v.vid.slice(0, 10), phone: v.phone, devices: 1, firstSeen: v.firstSeen, lastSeen: v.lastSeen, total: v.events.length, events: [...v.events] })
    }
  }
  return [...byKey.values()]
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, Math.max(1, limit))
    .map(g => {
      const sorted = g.events.sort((a, b) => b.at - a.at)
      // ادغامِ بازدیدهای پیاپیِ همان مسیر (رفرش/برگشت) — سیرِ حرکت خوانا می‌شود
      const dedup: TrackEvent[] = []
      for (const e of sorted) { const prev = dedup[dedup.length - 1]; if (!prev || prev.url !== e.url) dedup.push(e); if (dedup.length >= eventsTail) break }
      return { ...g, events: dedup }
    })
}

// تاریخچهٔ بازدیدِ یک کاربرِ مشخص (همهٔ vidهای وصل‌شده به این شماره) — برای کشوی کاربر.
export async function visitsOfPhone(phone: string, eventsTail = 40): Promise<{ total: number; lastSeen: number | null; events: Array<TrackEvent & { vid: string }> }> {
  const db = await load()
  const mine = Object.values(db.visitors).filter(v => v.phone === phone)
  const events = mine.flatMap(v => v.events.map(e => ({ ...e, vid: v.vid.slice(0, 8) }))).sort((a, b) => b.at - a.at).slice(0, eventsTail)
  return { total: mine.reduce((s2, v) => s2 + v.events.length, 0), lastSeen: mine.length ? Math.max(...mine.map(v => v.lastSeen)) : null, events }
}

export async function stats() {
  const db = await load()
  const vs = Object.values(db.visitors)
  return {
    total: vs.length,
    identified: vs.filter(v => v.phone).length,
    pending: vs.filter(v => v.pending).length,
    sent: vs.reduce((s, v) => s + (v.sentCount || 0), 0),
    recent: [...vs].sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 30).map(v => ({
      vid: v.vid.slice(0, 8), phone: v.phone || '', lastSeen: v.lastSeen, events: v.events.length,
      lastTitle: v.events[0]?.title || v.events[0]?.url || '', sentCount: v.sentCount || 0,
    })),
  }
}
