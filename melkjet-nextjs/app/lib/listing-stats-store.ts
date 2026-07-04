import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { pgEnabled, kvGet, kvMutate } from './db'

// آمارِ هر آگهی: تعدادِ بازدید (باز شدن) و تعدادِ کلیکِ «اطلاعات تماس».
// دومَحاله: اگر DATABASE_URL ست باشد → Postgres (نوشتنِ اتمیک)، وگرنه فایل.
const DATA_FILE = join(process.cwd(), '.listing-stats-data.json')
const KV_KEY = 'listing-stats'

export interface LStat { views: number; contacts: number; lastView?: number; lastContact?: number }
interface DB { stats: Record<string, LStat> }
const EMPTY: DB = { stats: {} }

function fileLoad(): DB { if (existsSync(DATA_FILE)) { try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {} } return { stats: {} } }
function fileSave(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, { stats: {} }) : fileLoad() }
async function mutate<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, { stats: {} }, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}
void EMPTY

export async function recordView(id: string): Promise<void> { await mutate((db) => { const s = db.stats[id] || { views: 0, contacts: 0 }; s.views++; s.lastView = Date.now(); db.stats[id] = s }) }
export async function recordContact(id: string): Promise<void> { await mutate((db) => { const s = db.stats[id] || { views: 0, contacts: 0 }; s.contacts++; s.lastContact = Date.now(); db.stats[id] = s }) }
export async function getStat(id: string): Promise<LStat> { const s = (await load()).stats[id]; return { views: s?.views || 0, contacts: s?.contacts || 0, lastView: s?.lastView, lastContact: s?.lastContact } }
export async function forIds(ids: string[]): Promise<Record<string, LStat>> { const db = await load(); const out: Record<string, LStat> = {}; for (const id of ids) out[id] = db.stats[id] || { views: 0, contacts: 0 }; return out }
