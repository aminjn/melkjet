import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { pgEnabled, kvGet, kvMutate } from './db'

// ردگیریِ دعوتِ صاحبانِ آگهیِ اسکرپ‌شده (برای جلوگیری از ارسالِ دوباره).
// دومَحاله: اگر DATABASE_URL ست باشد → Postgres (نوشتنِ اتمیک)، وگرنه فایل.
const FILE = join(process.cwd(), '.outreach-data.json')
const KV_KEY = 'outreach'

interface DB { invited: Record<string, number>; total: number }   // phone → زمانِ ارسال

function fileLoad(): DB { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return { invited: {}, total: 0 } }
function fileSave(db: DB) { writeFileSync(FILE, JSON.stringify(db)) }

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, { invited: {}, total: 0 }) : fileLoad() }
async function mutate<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, { invited: {}, total: 0 }, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

export async function wasInvited(phone: string): Promise<boolean> { return !!(await load()).invited[phone] }
export async function markInvited(phone: string): Promise<void> { await mutate((db) => { if (!db.invited[phone]) { db.invited[phone] = Date.now(); db.total++ } }) }
export async function invitedCount(): Promise<number> { return (await load()).total }
export async function invitedSet(): Promise<Set<string>> { return new Set(Object.keys((await load()).invited)) }
