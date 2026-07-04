import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { pgEnabled, kvGet, kvMutate } from './db'

// ─── گزارشِ تماس‌ها: هر بار کاربرِ واردشده شمارهٔ یک سازنده را «نمایش» می‌دهد، این‌جا
// ثبت می‌شود تا سازنده در پنلش لیدها/تماس‌ها را ببیند. کلید = builderId (constructor.id).
// دومَحاله: اگر DATABASE_URL ست باشد → Postgres (نوشتنِ اتمیک)، وگرنه فایل.
const FILE = join(process.cwd(), '.contact-log-data.json')
const KV_KEY = 'contact-log'

export interface Contact { viewerPhone: string; viewerName?: string; projectHashId?: string; projectName?: string; at: number }
type DB = Record<string, Contact[]>

function fileLoad(): DB { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return {} }
function fileSave(db: DB) { try { writeFileSync(FILE, JSON.stringify(db), 'utf-8') } catch {} }

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, {}) : fileLoad() }
async function mutate<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, {}, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

// یک تماس را ثبت می‌کند؛ اگر همان بیننده برای همان پروژه قبلاً ثبت شده، فقط زمان را تازه می‌کند.
export async function addContact(builderId: string, c: Contact): Promise<void> {
  await mutate((db) => {
    const k = String(builderId); const list = db[k] || (db[k] = [])
    const existing = list.find(x => x.viewerPhone === c.viewerPhone && x.projectHashId === c.projectHashId)
    if (existing) { existing.at = c.at; if (c.viewerName) existing.viewerName = c.viewerName; if (c.projectName) existing.projectName = c.projectName }
    else list.unshift(c)
  })
}
export async function getContacts(builderId: string): Promise<Contact[]> {
  return ((await load())[String(builderId)] || []).slice().sort((a, b) => b.at - a.at)
}
export async function contactCount(builderId: string): Promise<number> { return ((await load())[String(builderId)] || []).length }
