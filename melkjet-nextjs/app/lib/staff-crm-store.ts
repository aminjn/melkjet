// 📞 فاز ۱۱۶ — CRM مرکزیِ پرسنل (درخواستِ مستقیم: «پرسنلم تماس‌ها و پیگیری‌ها با مشتریانِ داخلِ سایت
// را ثبت و پیگیری کنند»). مشتری = اکانتِ واقعیِ سایت (هیچ لیستِ جدا/ساختگی)؛ این استور فقط لایهٔ
// تعاملاتِ پرسنل روی آن‌هاست. dual-mode (kv اتمیک روی PG، وگرنه فایل) — چند پرسنلِ همزمان امن است.
import fs from 'fs'
import path from 'path'
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
  kind: 'call' | 'follow' | 'note' | 'sms'
  text: string
  dueAt?: number             // یادآوریِ پیگیریِ بعدی
  done?: boolean
}
export interface StaffCrmEntry { status: StaffCrmStatus; assignedTo?: string; acts: StaffCrmAct[] }
type Db = Record<string, StaffCrmEntry>   // کلید = شمارهٔ مشتری (اکانتِ واقعی)

async function load(): Promise<Db> {
  if (pgEnabled()) return kvGet<Db>(KEY, {}).catch(() => ({}))
  try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')) } catch { return {} }
}
async function mutate<R>(fn: (d: Db) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<Db, R>(KEY, {}, fn)
  let d: Db = {}
  try { d = JSON.parse(fs.readFileSync(FILE, 'utf-8')) } catch {}
  const r = fn(d)
  try { fs.writeFileSync(FILE, JSON.stringify(d)) } catch {}
  return r
}

export async function staffCrmAll(): Promise<Db> { return load() }

export async function addStaffAct(phone: string, act: Omit<StaffCrmAct, 'at'>, now = Date.now()): Promise<StaffCrmEntry> {
  return mutate(db => {
    const e = db[phone] || (db[phone] = { status: 'new', acts: [] })
    e.acts.push({ ...act, text: String(act.text || '').slice(0, 500), at: now })
    if (e.acts.length > 200) e.acts = e.acts.slice(-200)
    if (e.status === 'new') e.status = 'follow'   // اولین تعامل = واردِ پیگیری
    return e
  })
}

export async function setStaffStatus(phone: string, status: StaffCrmStatus): Promise<StaffCrmEntry> {
  return mutate(db => {
    const e = db[phone] || (db[phone] = { status: 'new', acts: [] })
    e.status = status
    return e
  })
}

export async function assignStaff(phone: string, to: string): Promise<StaffCrmEntry> {
  return mutate(db => {
    const e = db[phone] || (db[phone] = { status: 'new', acts: [] })
    if (to) e.assignedTo = String(to).slice(0, 40); else delete e.assignedTo
    return e
  })
}

// انجام‌شدنِ یادآوری: idx از انتهای acts نیست — ایندکسِ مطلق در همان آرایه
export async function markActDone(phone: string, actAt: number): Promise<void> {
  await mutate(db => {
    const a = db[phone]?.acts.find(x => x.at === actAt && x.dueAt)
    if (a) a.done = true
  })
}
