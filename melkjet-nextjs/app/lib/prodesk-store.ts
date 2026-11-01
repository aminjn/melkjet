import { readFileSync, writeFileSync, existsSync } from './fs-atomic'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate, kvGetPrefix, pgTx } from './db'
import { FA_DIGITS, faDigit } from '../lib/digits'
import { getProfile } from './profile-store'

// میزِ کارِ متخصص — بک‌اندِ مشترکِ داشبوردهای معمار/پیمانکار/کارشناس/دفتر حقوقی/بانک‌وبیمه/دفترخانه.
// هر پنل نمای اختصاصیِ خودش را دارد، اما داده در دو مجموعهٔ منعطف ذخیره می‌شود:
//   requests = درخواست/استعلامِ ورودی (متقاضی → متخصص)
//   records  = رکوردِ کاری (نمونه‌کار/پرونده/گزارش/محصول/سند — بسته به شغل)
// هر رکورد با (owner=تلفنِ متخصص, role=مسیرِ داشبورد) جدا می‌شود؛ ایزوله per-profile.
// دومَحاله: DATABASE_URL ست باشد → Postgres (نوشتنِ اتمیک)، وگرنه فایل.
const DATA_FILE = join(process.cwd(), '.prodesk-data.json')
const KV_KEY = 'prodesk'

export type ReqStatus = 'new' | 'in_progress' | 'done' | 'canceled' | 'answered'
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
  // استعلامِ واقعیِ دوطرفه: customerPhone پرسنده را به یک حساب گره می‌زند
  // (clientPhone متنِ آزادی است که خودِ متخصص تایپ می‌کند و به حسابی بند نیست).
  customerPhone?: string
  reply?: string
  repliedAt?: number
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
const norm = (p: string) => String(p || '').replace(FA_DIGITS, faDigit).replace(/\D/g, '')

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

// ── فاز ۳۴۵ج — «هر متخصص ردیفِ خودش» ───────────────────────────────────────────────────────────────
// همهٔ درخواست‌ها/رکوردهای «هفت صنف و همهٔ متخصصان» در یک ردیفِ kv('prodesk') بود؛ هر بازکردنِ پنل ۳ بار کلش را
// می‌خواند و هر ثبت کلش را زیرِ FOR UPDATE بازنویسی می‌کرد. حالا `ush:prodesk:{تلفن}` = {requests, records}ِ همان
// متخصص (همهٔ صنف‌هایش). بلابِ قدیمی یخ‌زده (rollback)، مهاجرتِ یک‌باره و ایدمپوتنت. حالتِ فایل دست‌نخورده.
const PD_PREFIX = 'ush:prodesk:'
const PD_MARK = 'prodesk_shard_v1'
let pdMigrated = false
let pdAll: { at: number; db: DB } | null = null
let pdMigrating: Promise<void> | null = null
async function pdEnsureMigrated(): Promise<void> {
  if (pdMigrated) return
  if (pdMigrating) return pdMigrating
  pdMigrating = (async () => {
    try { if ((await kvGet<{ done?: boolean }>(PD_MARK, {})).done) { pdMigrated = true; return } } catch { return }
    await pgTx(async (client) => {
      await client.query(`SET LOCAL statement_timeout = '180s'`)
      await client.query(`INSERT INTO kv(key, data) VALUES($1, '{}'::jsonb) ON CONFLICT(key) DO NOTHING`, [PD_MARK])
      const m = await client.query('SELECT data FROM kv WHERE key = $1 FOR UPDATE', [PD_MARK])
      if (m.rows[0]?.data?.done) return
      const lb = await client.query('SELECT data FROM kv WHERE key = $1', [KV_KEY])
      const legacy = (lb.rows[0]?.data || {}) as Partial<DB>
      const by: Record<string, DB> = {}
      for (const r of legacy.requests || []) { const o = norm(r.owner); if (o) (by[o] ||= { requests: [], records: [] }).requests.push(r) }
      for (const r of legacy.records || []) { const o = norm(r.owner); if (o) (by[o] ||= { requests: [], records: [] }).records.push(r) }
      for (const [o, d] of Object.entries(by)) await client.query(`INSERT INTO kv(key, data) VALUES($1, $2) ON CONFLICT(key) DO NOTHING`, [PD_PREFIX + o, JSON.stringify(d)])
      await client.query('UPDATE kv SET data = $2, updated_at = now() WHERE key = $1', [PD_MARK, JSON.stringify({ done: true, at: Date.now(), n: Object.keys(by).length })])
      console.log(`[prodesk] per-owner migration: ${Object.keys(by).length} owners split from legacy blob`)
    })
    pdMigrated = true
  })().finally(() => { pdMigrating = null })
  return pdMigrating
}
const fixDb = (d: any): DB => ({ requests: Array.isArray(d?.requests) ? d.requests : [], records: Array.isArray(d?.records) ? d.records : [] })
async function loadOwner(owner: string): Promise<DB> {
  if (!pgEnabled()) return fileLoad()
  await pdEnsureMigrated()
  return fixDb(await kvGet<DB | null>(PD_PREFIX + norm(owner), null))
}
async function mutateOwner<R>(owner: string, fn: (db: DB) => R): Promise<R> {
  if (!pgEnabled()) return mutate(fn)
  await pdEnsureMigrated()
  const r = await kvMutate<DB, R>(PD_PREFIX + norm(owner), { requests: [], records: [] }, d => { const f = fixDb(d); d.requests = f.requests; d.records = f.records; return fn(d) })
  pdAll = null   // نوشتنِ خودی ⇒ کشِ «همه» کهنه است
  return r
}
async function loadAllOwners(): Promise<DB> {
  if (!pgEnabled()) return fileLoad()
  await pdEnsureMigrated()
  if (pdAll && Date.now() - pdAll.at < 20_000) return pdAll.db
  const out: DB = { requests: [], records: [] }
  for (const { data } of await kvGetPrefix<DB>(PD_PREFIX)) { const f = fixDb(data); out.requests.push(...f.requests); out.records.push(...f.records) }
  pdAll = { at: Date.now(), db: out }
  return out
}

const owns = (owner: string, role: string) => (x: { owner: string; role: string }) => norm(x.owner) === norm(owner) && x.role === role

// ── درخواست‌ها ──────────────────────────────────────────────────────────────
export async function listRequests(owner: string, role: string): Promise<ProRequest[]> {
  return (await loadOwner(owner)).requests.filter(owns(owner, role)).sort((a, b) => b.createdAt - a.createdAt)
}
export interface RequestInput { clientName: string; clientPhone?: string; customerPhone?: string; kind?: string; detail?: string; status?: ReqStatus; amount?: number; meta?: Record<string, any> }
export async function addRequest(owner: string, role: string, input: RequestInput): Promise<ProRequest> {
  const now = Date.now()
  const r: ProRequest = { id: id(), owner, role, clientName: input.clientName || 'بدون‌نام', clientPhone: input.clientPhone, customerPhone: input.customerPhone, kind: input.kind, detail: input.detail, status: input.status || 'new', amount: input.amount, meta: input.meta, createdAt: now, updatedAt: now }
  await mutateOwner(owner, db => { db.requests.push(r) })
  return r
}
export async function updateRequest(owner: string, role: string, rid: string, patch: Partial<RequestInput & { status: ReqStatus }>): Promise<ProRequest | null> {
  return mutateOwner(owner, db => {
    const r = db.requests.find(x => x.id === rid && norm(x.owner) === norm(owner) && x.role === role)
    if (!r) return null
    Object.assign(r, patch, { updatedAt: Date.now() })
    return r
  })
}
export async function deleteRequest(owner: string, role: string, rid: string): Promise<boolean> {
  return mutateOwner(owner, db => { const n = db.requests.length; db.requests = db.requests.filter(x => !(x.id === rid && norm(x.owner) === norm(owner) && x.role === role)); return db.requests.length !== n })
}

// Two-way inquiry.
//
// Until now `requests` was only the professional's own manual notebook: no
// public entry point, no reply field, no notification -- while the menu of all
// seven ProDesk panels advertised an inquiry inbox. customerPhone binds the
// asker to a real account; clientPhone is free text the professional types and
// is bound to nothing.
export const PRO_ROLE_LABEL: Record<string, string> = {
  '/architect': 'معمار',
  '/contractor': 'پیمانکار',
  '/appraiser': 'کارشناس رسمی',
  '/lawfirm': 'دفتر حقوقی',
  '/finance': 'بانک و بیمه',
  '/notary': 'دفترخانه',
  '/legal': 'حقوقی',
}
const proName = (owner: string) => {
  try { return getProfile(owner).businessName || 'متخصص' } catch { return 'متخصص' }
}

// Sent by a signed-in visitor from the professional's public page.
export async function addPublicRequest(owner: string, role: string, input: RequestInput): Promise<ProRequest> {
  const r = await addRequest(owner, role, input)
  const msg = '📩 استعلامِ تازه از ' + r.clientName + (r.kind ? ' — ' + r.kind : '')
  import('./notif-store').then(m => m.addNotif(owner, msg, 'inquiry')).catch(() => {})
  return r
}

export async function answerRequest(owner: string, role: string, rid: string, reply: string): Promise<ProRequest | null> {
  const r = await mutateOwner(owner, db => {
    const x = db.requests.find(q => q.id === rid && norm(q.owner) === norm(owner) && q.role === role)
    if (!x) return null
    x.reply = reply; x.repliedAt = Date.now(); x.status = 'answered'; x.updatedAt = Date.now()
    return x
  })
  if (r && r.customerPhone) {
    const txt = '✅ پاسخِ استعلامِ شما از ' + proName(owner) + ': ' + reply
      + '\nهمهٔ استعلام‌های تو: melkjet.com/inquiries'
    import('./notif-store').then(m => m.addNotif(r.customerPhone as string, txt, 'inquiry')).catch(() => {})
  }
  return r
}

export type MyProRequest = ProRequest & { proName: string; roleLabel: string }
export async function listMyProRequests(phone: string): Promise<MyProRequest[]> {
  const me = norm(phone)
  if (!me) return []
  const db = await loadAllOwners()
  return db.requests
    .filter(r => norm(r.customerPhone || '') === me)
    .map(r => ({ ...r, proName: proName(r.owner), roleLabel: PRO_ROLE_LABEL[r.role] || 'متخصص' }))
    .sort((a, b) => b.createdAt - a.createdAt)
}

// Everything this professional received, across every role they hold.
export async function listReceivedProRequests(phone: string): Promise<Array<ProRequest & { roleLabel: string }>> {
  const me = norm(phone)
  if (!me) return []
  const db = await loadOwner(phone)
  return db.requests
    .filter(r => norm(r.owner) === me && !!r.customerPhone)
    .map(r => ({ ...r, roleLabel: PRO_ROLE_LABEL[r.role] || 'متخصص' }))
    .sort((a, b) => b.createdAt - a.createdAt)
}


// ── رکوردهای کاری ────────────────────────────────────────────────────────────
export async function listRecords(owner: string, role: string): Promise<ProRecord[]> {
  return (await loadOwner(owner)).records.filter(owns(owner, role)).sort((a, b) => b.createdAt - a.createdAt)
}
export interface RecordInput { title: string; subtitle?: string; kind?: string; status?: RecStatus; amount?: number; tags?: string[]; cover?: string; meta?: Record<string, any> }
export async function addRecord(owner: string, role: string, input: RecordInput): Promise<ProRecord> {
  const now = Date.now()
  const r: ProRecord = { id: id(), owner, role, title: input.title || 'بدون‌عنوان', subtitle: input.subtitle, kind: input.kind, status: input.status || 'active', amount: input.amount, tags: input.tags || [], cover: input.cover, meta: input.meta, createdAt: now, updatedAt: now }
  await mutateOwner(owner, db => { db.records.push(r) })
  return r
}
export async function updateRecord(owner: string, role: string, rid: string, patch: Partial<RecordInput & { status: RecStatus }>): Promise<ProRecord | null> {
  return mutateOwner(owner, db => {
    const r = db.records.find(x => x.id === rid && norm(x.owner) === norm(owner) && x.role === role)
    if (!r) return null
    Object.assign(r, patch, { updatedAt: Date.now() })
    return r
  })
}
export async function deleteRecord(owner: string, role: string, rid: string): Promise<boolean> {
  return mutateOwner(owner, db => { const n = db.records.length; db.records = db.records.filter(x => !(x.id === rid && norm(x.owner) === norm(owner) && x.role === role)); return db.records.length !== n })
}

// ── آمارِ داشبورد ─────────────────────────────────────────────────────────────
export interface ProStats { total: number; open: number; done: number; records: number; revenue: number; recent: ProRequest[] }
export async function proStats(owner: string, role: string): Promise<ProStats> {
  const db = await loadOwner(owner)
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
