import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'

// میزِ کارِ متخصص — بک‌اندِ مشترکِ داشبوردهای معمار/پیمانکار/کارشناس/دفتر حقوقی/بانک‌وبیمه/دفترخانه.
// هر پنل نمای اختصاصیِ خودش را دارد، اما داده در دو مجموعهٔ منعطف ذخیره می‌شود:
//   requests = درخواست/استعلامِ ورودی (متقاضی → متخصص)
//   records  = رکوردِ کاری (نمونه‌کار/پرونده/گزارش/محصول/سند — بسته به شغل)
// هر رکورد با (owner=تلفنِ متخصص, role=مسیرِ داشبورد) جدا می‌شود؛ ایزوله per-profile.
// دومَحاله: DATABASE_URL ست باشد → Postgres (نوشتنِ اتمیک)، وگرنه فایل.
const DATA_FILE = join(process.cwd(), '.prodesk-data.json')
const KV_KEY = 'prodesk'

export type ReqStatus = 'new' | 'in_progress' | 'done' | 'canceled'
export type RecStatus = 'active' | 'pending' | 'archived'

export interface ProRequest {
  id: string
  owner: string          // تلفنِ متخصص
  role: string           // مسیرِ داشبورد (/architect …)
  clientName: string
  clientPhone?: string
  kind?: string          // نوعِ درخواست (برچسبِ شغلی: ارزیابی/وام/تنظیم سند …)
  detail?: string
  status: ReqStatus
  amount?: number        // مبلغِ برآورد/حق‌الزحمه (تومان)
  meta?: Record<string, any>   // فیلدهای اختصاصیِ شغل (متراژ/سبک/بودجه …)
  createdAt: number
  updatedAt: number
}

export interface ProRecord {
  id: string
  owner: string
  role: string
  title: string
  subtitle?: string
  kind?: string          // دستهٔ رکورد (نمونه‌کار/پرونده/محصول …)
  status: RecStatus
  amount?: number
  tags?: string[]
  cover?: string         // تصویرِ شاخص (برای نمونه‌کارِ تصویری)
  meta?: Record<string, any>   // فیلدهای اختصاصیِ شغل (متراژ/سبک/مرحله …)
  createdAt: number
  updatedAt: number
}

interface DB { requests: ProRequest[]; records: ProRecord[] }
const EMPTY: DB = { requests: [], records: [] }
function id() { return randomBytes(6).toString('hex') }
const norm = (p: string) => String(p || '').replace(/\D/g, '')

function fileLoad(): DB {
  if (existsSync(DATA_FILE)) {
    try { const raw = JSON.parse(readFileSync(DATA_FILE, 'utf-8')); return { requests: Array.isArray(raw.requests) ? raw.requests : [], records: Array.isArray(raw.records) ? raw.records : [] } } catch {}
  }
  return { requests: [], records: [] }
}
function fileSave(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8') }

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, EMPTY) : fileLoad() }
async function mutate<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, EMPTY, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

const owns = (owner: string, role: string) => (x: { owner: string; role: string }) => norm(x.owner) === norm(owner) && x.role === role

// ── درخواست‌ها ──────────────────────────────────────────────────────────────
export async function listRequests(owner: string, role: string): Promise<ProRequest[]> {
  return (await load()).requests.filter(owns(owner, role)).sort((a, b) => b.createdAt - a.createdAt)
}
export interface RequestInput { clientName: string; clientPhone?: string; kind?: string; detail?: string; status?: ReqStatus; amount?: number; meta?: Record<string, any> }
export async function addRequest(owner: string, role: string, input: RequestInput): Promise<ProRequest> {
  const now = Date.now()
  const r: ProRequest = { id: id(), owner, role, clientName: input.clientName || 'بدون‌نام', clientPhone: input.clientPhone, kind: input.kind, detail: input.detail, status: input.status || 'new', amount: input.amount, meta: input.meta, createdAt: now, updatedAt: now }
  await mutate(db => { db.requests.push(r) })
  return r
}
export async function updateRequest(owner: string, role: string, rid: string, patch: Partial<RequestInput & { status: ReqStatus }>): Promise<ProRequest | null> {
  return mutate(db => {
    const r = db.requests.find(x => x.id === rid && norm(x.owner) === norm(owner) && x.role === role)
    if (!r) return null
    Object.assign(r, patch, { updatedAt: Date.now() })
    return r
  })
}
export async function deleteRequest(owner: string, role: string, rid: string): Promise<boolean> {
  return mutate(db => { const n = db.requests.length; db.requests = db.requests.filter(x => !(x.id === rid && norm(x.owner) === norm(owner) && x.role === role)); return db.requests.length !== n })
}

// ── رکوردهای کاری ────────────────────────────────────────────────────────────
export async function listRecords(owner: string, role: string): Promise<ProRecord[]> {
  return (await load()).records.filter(owns(owner, role)).sort((a, b) => b.createdAt - a.createdAt)
}
export interface RecordInput { title: string; subtitle?: string; kind?: string; status?: RecStatus; amount?: number; tags?: string[]; cover?: string; meta?: Record<string, any> }
export async function addRecord(owner: string, role: string, input: RecordInput): Promise<ProRecord> {
  const now = Date.now()
  const r: ProRecord = { id: id(), owner, role, title: input.title || 'بدون‌عنوان', subtitle: input.subtitle, kind: input.kind, status: input.status || 'active', amount: input.amount, tags: input.tags || [], cover: input.cover, meta: input.meta, createdAt: now, updatedAt: now }
  await mutate(db => { db.records.push(r) })
  return r
}
export async function updateRecord(owner: string, role: string, rid: string, patch: Partial<RecordInput & { status: RecStatus }>): Promise<ProRecord | null> {
  return mutate(db => {
    const r = db.records.find(x => x.id === rid && norm(x.owner) === norm(owner) && x.role === role)
    if (!r) return null
    Object.assign(r, patch, { updatedAt: Date.now() })
    return r
  })
}
export async function deleteRecord(owner: string, role: string, rid: string): Promise<boolean> {
  return mutate(db => { const n = db.records.length; db.records = db.records.filter(x => !(x.id === rid && norm(x.owner) === norm(owner) && x.role === role)); return db.records.length !== n })
}

// ── آمارِ داشبورد ─────────────────────────────────────────────────────────────
export interface ProStats { total: number; open: number; done: number; records: number; revenue: number; recent: ProRequest[] }
export async function proStats(owner: string, role: string): Promise<ProStats> {
  const db = await load()
  const reqs = db.requests.filter(owns(owner, role))
  const recs = db.records.filter(owns(owner, role))
  const done = reqs.filter(r => r.status === 'done')
  return {
    total: reqs.length,
    open: reqs.filter(r => r.status === 'new' || r.status === 'in_progress').length,
    done: done.length,
    records: recs.length,
    revenue: done.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    recent: reqs.sort((a, b) => b.createdAt - a.createdAt).slice(0, 6),
  }
}
