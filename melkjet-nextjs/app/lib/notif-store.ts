import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'

// اعلان‌های درون‌برنامه‌ایِ هر کاربر (صندوقِ اعلان). دومَحاله (PG/فایل).
const FILE = join(process.cwd(), '.notif-data.json')
const KV_KEY = 'notif'

export interface Notif { id: string; owner: string; text: string; kind?: string; createdAt: number; read?: boolean }
interface NDB { rows: Notif[] }
const EMPTY: NDB = { rows: [] }

function fileLoad(): NDB { if (existsSync(FILE)) { try { const d = JSON.parse(readFileSync(FILE, 'utf-8')); return { rows: Array.isArray(d.rows) ? d.rows : [] } } catch {} } return { rows: [] } }
function fileSave(db: NDB) { writeFileSync(FILE, JSON.stringify(db, null, 2), 'utf-8') }
async function load(): Promise<NDB> { return pgEnabled() ? await kvGet<NDB>(KV_KEY, EMPTY) : fileLoad() }
async function mutate<R>(fn: (db: NDB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<NDB, R>(KV_KEY, EMPTY, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

const norm = (p: string) => String(p || '').replace(/\D/g, '')

export async function addNotif(owner: string, text: string, kind = 'info'): Promise<void> {
  const o = norm(owner); if (!o || !text) return
  await mutate(db => {
    db.rows.unshift({ id: randomBytes(6).toString('hex'), owner: o, text: String(text).slice(0, 400), kind, createdAt: Date.now(), read: false })
    // سقفِ ۲۰۰ اعلانِ اخیر برای هر کاربر تا بلاب کوچک بماند.
    const mine = db.rows.filter(n => n.owner === o)
    if (mine.length > 200) { const drop = new Set(mine.slice(200).map(n => n.id)); db.rows = db.rows.filter(n => !drop.has(n.id)) }
  })
}
export async function listNotifs(owner: string, limit = 30): Promise<Notif[]> {
  const o = norm(owner)
  return (await load()).rows.filter(n => n.owner === o).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit)
}
export async function unreadCount(owner: string): Promise<number> {
  const o = norm(owner)
  return (await load()).rows.filter(n => n.owner === o && !n.read).length
}
export async function markAllRead(owner: string): Promise<void> {
  const o = norm(owner)
  await mutate(db => { for (const n of db.rows) if (n.owner === o) n.read = true })
}
