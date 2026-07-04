import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'

// «آگهی جدید اومد خبرم کن» — جستجوهای ذخیره‌شدهٔ کاربر برای هشدارِ آگهیِ جدید.
// دومَحاله: اگر DATABASE_URL ست باشد → Postgres (نوشتنِ اتمیک)، وگرنه فایل.
const DATA_FILE = join(process.cwd(), '.saved-search-data.json')
const KV_KEY = 'saved-search'

export interface SavedSearch {
  id: string
  owner: string          // شمارهٔ کاربر
  sig: string            // امضای معیارها (برای تشخیصِ روشن/خاموش بودن)
  label: string
  city?: string
  area?: string
  deal: 'sale' | 'rent' | 'presale'
  kind?: string
  priceMax?: number      // میلیارد تومان
  createdAt: number
  lastCheck: number
}
interface DB { searches: SavedSearch[] }

function id() { return 's_' + randomBytes(6).toString('hex') }
function fileLoad(): DB { if (existsSync(DATA_FILE)) { try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {} } return { searches: [] } }
function fileSave(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, { searches: [] }) : fileLoad() }
async function mutate<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, { searches: [] }, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

export function sigOf(c: { city?: string; area?: string; deal: string; kind?: string; priceMax?: number }) {
  return [c.city || '', c.area || '', c.deal, c.kind || '', c.priceMax || 0].join('|')
}

export async function listForOwner(owner: string): Promise<SavedSearch[]> {
  return (await load()).searches.filter(s => s.owner === owner).sort((a, b) => b.createdAt - a.createdAt)
}

export async function addSearch(owner: string, c: { city?: string; area?: string; deal: 'sale' | 'rent' | 'presale'; kind?: string; priceMax?: number; label?: string }): Promise<SavedSearch> {
  return mutate((db) => {
    const sig = sigOf(c)
    let s = db.searches.find(x => x.owner === owner && x.sig === sig)
    if (s) return s
    s = { id: id(), owner, sig, label: c.label || [c.area, c.city].filter(Boolean).join('، ') || 'جستجوی من', city: c.city, area: c.area, deal: c.deal, kind: c.kind, priceMax: c.priceMax, createdAt: Date.now(), lastCheck: Date.now() }
    db.searches.unshift(s)
    return s
  })
}

export async function removeBySig(owner: string, sig: string): Promise<void> {
  await mutate((db) => {
    db.searches = db.searches.filter(s => !(s.owner === owner && s.sig === sig))
  })
}
export async function removeById(owner: string, sid: string): Promise<void> {
  await mutate((db) => {
    db.searches = db.searches.filter(s => !(s.owner === owner && s.id === sid))
  })
}

export async function listAll(): Promise<SavedSearch[]> { return (await load()).searches }
export async function setLastCheck(sid: string, ts: number): Promise<void> {
  await mutate((db) => { const s = db.searches.find(x => x.id === sid); if (s) { s.lastCheck = ts } })
}
