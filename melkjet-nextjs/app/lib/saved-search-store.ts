import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// «آگهی جدید اومد خبرم کن» — جستجوهای ذخیره‌شدهٔ کاربر برای هشدارِ آگهیِ جدید.
const DATA_FILE = join(process.cwd(), '.saved-search-data.json')

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
function load(): DB { if (existsSync(DATA_FILE)) { try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {} } return { searches: [] } }
function save(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

export function sigOf(c: { city?: string; area?: string; deal: string; kind?: string; priceMax?: number }) {
  return [c.city || '', c.area || '', c.deal, c.kind || '', c.priceMax || 0].join('|')
}

export function listForOwner(owner: string): SavedSearch[] {
  return load().searches.filter(s => s.owner === owner).sort((a, b) => b.createdAt - a.createdAt)
}

export function addSearch(owner: string, c: { city?: string; area?: string; deal: 'sale' | 'rent' | 'presale'; kind?: string; priceMax?: number; label?: string }): SavedSearch {
  const db = load()
  const sig = sigOf(c)
  let s = db.searches.find(x => x.owner === owner && x.sig === sig)
  if (s) return s
  s = { id: id(), owner, sig, label: c.label || [c.area, c.city].filter(Boolean).join('، ') || 'جستجوی من', city: c.city, area: c.area, deal: c.deal, kind: c.kind, priceMax: c.priceMax, createdAt: Date.now(), lastCheck: Date.now() }
  db.searches.unshift(s)
  save(db)
  return s
}

export function removeBySig(owner: string, sig: string) {
  const db = load()
  db.searches = db.searches.filter(s => !(s.owner === owner && s.sig === sig))
  save(db)
}
export function removeById(owner: string, sid: string) {
  const db = load()
  db.searches = db.searches.filter(s => !(s.owner === owner && s.id === sid))
  save(db)
}

export function listAll(): SavedSearch[] { return load().searches }
export function setLastCheck(sid: string, ts: number) {
  const db = load(); const s = db.searches.find(x => x.id === sid); if (s) { s.lastCheck = ts; save(db) }
}
