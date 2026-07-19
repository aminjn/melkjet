// 📞 فاز ۱۱۶/۱۲۳ — CRM مرکزیِ پرسنل: پرونده‌های مشتریان (اکانت‌های واقعیِ سایت) + وظایفِ تیمی.
// dual-mode (kv اتمیک روی PG، وگرنه فایل) — چند پرسنلِ همزمان امن. مهاجرتِ خودکار از شکلِ قدیمی (flat).
import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'

const FILE = path.join(process.cwd(), '.staff-crm-data.json')
const KEY = 'staff_crm'

export type StaffCrmStatus = 'new' | 'follow' | 'customer' | 'lost'
export const STAFF_CRM_STATUS_FA: Record<StaffCrmStatus, string> = {
  new: 'جدید', follow: 'در حالِ پیگیری', customer: 'مشتری شد', lost: 'از دست رفت',
}
export interface StaffCrmAct {
  at: number
  by: string                 // نام/شمارهٔ پرسنلِ ثبت‌کننده — پاسخ‌گویی
  byPhone?: string           // فاز ۱۷۳ — شمارهٔ پرسنل: مقصدِ یادآورِ خودکار (پیامک/نوتیف)
  kind: 'call' | 'follow' | 'note' | 'sms'
  text: string
  dueAt?: number             // یادآوریِ پیگیریِ بعدی
  done?: boolean
  remindedAt?: number        // فاز ۱۷۳ — یادآورِ خودکار یک‌بار رفته (ایدمپوتنت)
}
export interface StaffCrmEntry { status: StaffCrmStatus; assignedTo?: string; acts: StaffCrmAct[] }
// فاز ۱۲۳ — وظیفهٔ تیمی: مستقل یا متصل به یک مشتری؛ با مسئول و سررسید
export interface StaffTask {
  id: string
  title: string
  by: string                 // سازنده
  assignedTo?: string        // مسئولِ انجام (نامِ همکار)
  forPhone?: string          // مشتریِ مرتبط (اختیاری)
  forName?: string
  dueAt?: number
  done?: boolean
  doneBy?: string
  at: number
  doneAt?: number
  byPhone?: string           // فاز ۱۷۳ — مقصدِ یادآورِ خودکارِ وظیفه
  remindedAt?: number
}
interface Db { customers: Record<string, StaffCrmEntry>; tasks: StaffTask[] }
const EMPTY: Db = { customers: {}, tasks: [] }

// مهاجرت از شکلِ قدیمی (Record<phone, entry> بدونِ customers/tasks)
function normalize(raw: unknown): Db {
  const r = (raw || {}) as Record<string, unknown>
  if (r.customers || r.tasks) return { customers: (r.customers as Db['customers']) || {}, tasks: (r.tasks as StaffTask[]) || [] }
  const customers: Db['customers'] = {}
  for (const [k, v] of Object.entries(r)) {
    if (v && typeof v === 'object' && Array.isArray((v as StaffCrmEntry).acts)) customers[k] = v as StaffCrmEntry
  }
  return { customers, tasks: [] }
}

async function load(): Promise<Db> {
  if (pgEnabled()) return normalize(await kvGet<unknown>(KEY, EMPTY).catch(() => EMPTY))
  try { return normalize(JSON.parse(fs.readFileSync(FILE, 'utf-8'))) } catch { return { customers: {}, tasks: [] } }
}
async function mutate<R>(fn: (d: Db) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<Record<string, unknown>, R>(KEY, EMPTY as unknown as Record<string, unknown>, raw => {
    const d = normalize(raw)
    const r = fn(d)
    // شکلِ جدید جایگزینِ کامل می‌شود (کلیدهای flatِ قدیمی حذف)
    for (const k of Object.keys(raw)) delete raw[k]
    raw.customers = d.customers; raw.tasks = d.tasks
    return r
  })
  let d: Db = { customers: {}, tasks: [] }
  try { d = normalize(JSON.parse(fs.readFileSync(FILE, 'utf-8'))) } catch {}
  const r = fn(d)
  try { fs.writeFileSync(FILE, JSON.stringify(d)) } catch {}
  return r
}

export async function staffCrmAll(): Promise<Record<string, StaffCrmEntry>> { return (await load()).customers }

export async function addStaffAct(phone: string, act: Omit<StaffCrmAct, 'at'>, now = Date.now()): Promise<StaffCrmEntry> {
  return mutate(db => {
    const e = db.customers[phone] || (db.customers[phone] = { status: 'new', acts: [] })
    e.acts.push({ ...act, text: String(act.text || '').slice(0, 500), at: now })
    if (e.acts.length > 200) e.acts = e.acts.slice(-200)
    if (e.status === 'new') e.status = 'follow'   // اولین تعامل = واردِ پیگیری
    return e
  })
}

export async function setStaffStatus(phone: string, status: StaffCrmStatus): Promise<StaffCrmEntry> {
  return mutate(db => {
    const e = db.customers[phone] || (db.customers[phone] = { status: 'new', acts: [] })
    e.status = status
    return e
  })
}

export async function assignStaff(phone: string, to: string): Promise<StaffCrmEntry> {
  return mutate(db => {
    const e = db.customers[phone] || (db.customers[phone] = { status: 'new', acts: [] })
    if (to) e.assignedTo = String(to).slice(0, 40); else delete e.assignedTo
    return e
  })
}

export async function markActDone(phone: string, actAt: number): Promise<void> {
  await mutate(db => {
    const a = db.customers[phone]?.acts.find(x => x.at === actAt && x.dueAt)
    if (a) a.done = true
  })
}

// ── فاز ۱۷۳ — CRM واقعی برای پرسنل: ویرایش/حذف/تعویقِ پیگیری + یادآورِ خودکار ──
export async function updateStaffAct(phone: string, actAt: number, patch: { text?: string; dueAt?: number | null }): Promise<StaffCrmAct | null> {
  return mutate(db => {
    const a = db.customers[phone]?.acts.find(x => x.at === actAt)
    if (!a) return null
    if (patch.text !== undefined) a.text = String(patch.text).slice(0, 500)
    if (patch.dueAt !== undefined) {
      if (patch.dueAt === null) { delete a.dueAt; delete a.done; delete a.remindedAt }
      else { a.dueAt = patch.dueAt; a.done = false; delete a.remindedAt }   // سررسیدِ نو = یادآورِ نو
    }
    return a
  })
}

export async function deleteStaffAct(phone: string, actAt: number): Promise<boolean> {
  return mutate(db => {
    const e = db.customers[phone]
    if (!e) return false
    const n = e.acts.length
    e.acts = e.acts.filter(x => x.at !== actAt)
    return e.acts.length < n
  })
}

// یادآورهای سررسیدشده را «اتمیک» برمی‌دارد و همان‌جا نشانِ remindedAt می‌زند —
// حتی با چند اینستنس، هر یادآور فقط یک‌بار ارسال می‌شود (کرون فقط روی اینستنسِ صفر است).
export interface DueReminder { source: 'act' | 'task'; customerPhone?: string; staffPhone: string; text: string; dueAt: number }
export async function claimDueReminders(now = Date.now()): Promise<DueReminder[]> {
  return mutate(db => {
    const out: DueReminder[] = []
    for (const [phone, e] of Object.entries(db.customers)) {
      for (const a of e.acts) {
        if (a.dueAt && !a.done && !a.remindedAt && a.dueAt <= now && a.byPhone) {
          a.remindedAt = now
          out.push({ source: 'act', customerPhone: phone, staffPhone: a.byPhone, text: a.text, dueAt: a.dueAt })
        }
      }
    }
    for (const t of db.tasks) {
      if (t.dueAt && !t.done && !t.remindedAt && t.dueAt <= now && t.byPhone) {
        t.remindedAt = now
        out.push({ source: 'task', customerPhone: t.forPhone, staffPhone: t.byPhone, text: t.title, dueAt: t.dueAt })
      }
    }
    return out
  })
}

// ── فاز ۱۲۳: وظایفِ تیمی ──
export async function listStaffTasks(): Promise<StaffTask[]> {
  return (await load()).tasks.sort((a, b) => (!!a.done === !!b.done ? (a.dueAt || a.at) - (b.dueAt || b.at) : a.done ? 1 : -1))
}

export async function addStaffTask(t: Omit<StaffTask, 'id' | 'at' | 'done'>, now = Date.now()): Promise<StaffTask> {
  return mutate(db => {
    const task: StaffTask = { ...t, title: String(t.title || '').slice(0, 160), id: randomBytes(4).toString('hex'), at: now, done: false }
    db.tasks.unshift(task)
    if (db.tasks.length > 500) db.tasks = db.tasks.slice(0, 500)
    return task
  })
}

export async function toggleStaffTask(id: string, doneBy: string, now = Date.now()): Promise<StaffTask | null> {
  return mutate(db => {
    const t = db.tasks.find(x => x.id === id)
    if (!t) return null
    t.done = !t.done
    if (t.done) { t.doneBy = doneBy; t.doneAt = now } else { delete t.doneBy; delete t.doneAt }
    return t
  })
}

export async function deleteStaffTask(id: string): Promise<void> {
  await mutate(db => { db.tasks = db.tasks.filter(x => x.id !== id) })
}
