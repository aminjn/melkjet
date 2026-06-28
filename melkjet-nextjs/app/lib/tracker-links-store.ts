import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// لینک‌های ردیابیِ پیامکِ ترکر: هر لینک به ریدایرکتِ خودمان (/go/<code>) اشاره می‌کند
// تا کلیک شمرده شود؛ سپس به مقصدِ واقعی می‌رود. nxal فقط نمایشِ کوتاه را می‌دهد.
const FILE = join(process.cwd(), '.tracker-links-data.json')

export interface TLink {
  code: string
  dest: string          // مقصدِ واقعی (آگهی)
  title?: string
  phone?: string        // گیرندهٔ پیامک
  shortUrl?: string     // لینکِ کوتاهِ nxal
  clicks: number
  lastClickAt?: number
  createdAt: number
}
interface DB { links: TLink[] }

function load(): DB { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return { links: [] } }
function save(db: DB) { writeFileSync(FILE, JSON.stringify(db)) }
function code() { return randomBytes(5).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 7) || randomBytes(4).toString('hex') }

export function createLink(input: { dest: string; title?: string; phone?: string }): TLink {
  const db = load()
  const l: TLink = { code: code(), dest: input.dest, title: input.title, phone: input.phone, clicks: 0, createdAt: Date.now() }
  db.links.unshift(l)
  db.links = db.links.slice(0, 5000)
  save(db)
  return l
}
export function setShort(code: string, shortUrl: string) {
  const db = load(); const l = db.links.find(x => x.code === code); if (l) { l.shortUrl = shortUrl; save(db) }
}
export function recordClick(code: string): string | null {
  const db = load(); const l = db.links.find(x => x.code === code); if (!l) return null
  l.clicks++; l.lastClickAt = Date.now(); save(db)
  return l.dest
}
export function listLinks(limit = 200): TLink[] { return load().links.slice(0, limit) }
export function linkStats() {
  const ls = load().links
  return { total: ls.length, clicked: ls.filter(l => l.clicks > 0).length, clicks: ls.reduce((s, l) => s + l.clicks, 0) }
}
