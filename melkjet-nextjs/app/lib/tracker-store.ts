import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// ترکرِ بازدیدکننده‌ها (per-visitor، با کوکیِ دائمیِ mj_vid).
// هر بازدیدکننده — چه لاگین چه نه — ثبت می‌شود؛ پس از لاگین، شماره به همان کوکی وصل می‌شود.
// رویدادهای بازدید نگه داشته می‌شوند و برای «پیامکِ هدفمند» (بازاریابی مجدد) استفاده می‌شوند.
const DATA_FILE = join(process.cwd(), '.tracker-data.json')

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

const MAX_EVENTS = 50
function load(): DB { if (existsSync(DATA_FILE)) { try { const d = JSON.parse(readFileSync(DATA_FILE, 'utf-8')); return { visitors: d.visitors || {} } } catch {} } return { visitors: {} } }
function save(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8') }

export function newVid(): string { return randomBytes(16).toString('hex') }

export function ensureVisitor(vid: string): Visitor {
  const db = load()
  if (!db.visitors[vid]) { db.visitors[vid] = { vid, firstSeen: Date.now(), lastSeen: Date.now(), events: [] }; save(db) }
  return db.visitors[vid]
}

export function recordEvent(vid: string, ev: TrackEvent): Visitor {
  const db = load()
  const v = db.visitors[vid] || { vid, firstSeen: Date.now(), lastSeen: Date.now(), events: [] }
  v.events.unshift(ev)
  if (v.events.length > MAX_EVENTS) v.events = v.events.slice(0, MAX_EVENTS)
  v.lastSeen = Date.now()
  db.visitors[vid] = v
  save(db)
  return v
}

export function linkPhone(vid: string, phone: string): Visitor {
  const db = load()
  const v = db.visitors[vid] || { vid, firstSeen: Date.now(), lastSeen: Date.now(), events: [] }
  v.phone = phone
  v.lastSeen = Date.now()
  db.visitors[vid] = v
  save(db)
  return v
}

export function getVisitor(vid: string): Visitor | null { return load().visitors[vid] || null }

// آیا می‌توان برای این بازدیدکننده پیامک فرستاد؟ (محدودیتِ زمانی)
export function canSend(vid: string, throttleMs: number): boolean {
  const v = load().visitors[vid]
  if (!v || !v.phone) return false
  if (v.pending) return false
  if (v.lastSentAt && Date.now() - v.lastSentAt < throttleMs) return false
  return true
}

export function enqueuePending(vid: string, p: Pending) {
  const db = load(); const v = db.visitors[vid]; if (!v) return
  v.pending = p; db.visitors[vid] = v; save(db)
}

// بازدیدکننده‌هایی که پیامکِ آماده‌ی ارسال دارند (موعدشان رسیده و شماره دارند).
export function listDuePending(now: number): { vid: string; phone: string; pending: Pending }[] {
  const db = load()
  const out: { vid: string; phone: string; pending: Pending }[] = []
  for (const v of Object.values(db.visitors)) {
    if (v.pending && v.phone && v.pending.dueAt <= now) out.push({ vid: v.vid, phone: v.phone, pending: v.pending })
  }
  return out
}

export function markSent(vid: string, ok: boolean) {
  const db = load(); const v = db.visitors[vid]; if (!v) return
  v.pending = undefined
  if (ok) { v.lastSentAt = Date.now(); v.sentCount = (v.sentCount || 0) + 1 }
  db.visitors[vid] = v; save(db)
}

export function stats() {
  const db = load()
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
