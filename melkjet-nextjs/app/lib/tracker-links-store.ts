import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// لینک‌های ردیابیِ پیامکِ ترکر. آمارِ کلیک از خودِ nxal گرفته می‌شود (linkId)؛
// لینکِ ریدایرکتِ داخلی (/go/<code>) هم به‌عنوانِ پشتیبان نگه داشته می‌شود.
const FILE = join(process.cwd(), '.tracker-links-data.json')

export interface TLink {
  code: string
  dest: string          // مقصدِ واقعی (آگهی)
  title?: string
  phone?: string        // گیرندهٔ پیامک
  channel?: string      // کانال: tracker | automation | outreach | alert | …
  shortUrl?: string     // لینکِ کوتاهِ nxal
  linkId?: string       // شناسهٔ لینک در nxal (برای دریافتِ آمار)
  clicks: number
  uniqueClicks?: number
  lastClickAt?: number
  createdAt: number
}
interface DB { links: TLink[] }

function load(): DB { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return { links: [] } }
function save(db: DB) { writeFileSync(FILE, JSON.stringify(db)) }
function code() { return randomBytes(5).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 7) || randomBytes(4).toString('hex') }

export function createLink(input: { dest: string; title?: string; phone?: string; channel?: string }): TLink {
  const db = load()
  const l: TLink = { code: code(), dest: input.dest, title: input.title, phone: input.phone, channel: input.channel, clicks: 0, createdAt: Date.now() }
  db.links.unshift(l)
  db.links = db.links.slice(0, 5000)
  save(db)
  return l
}
export function setLinkMeta(code: string, meta: { shortUrl?: string; linkId?: string }) {
  const db = load(); const l = db.links.find(x => x.code === code); if (!l) return
  if (meta.shortUrl !== undefined) l.shortUrl = meta.shortUrl
  if (meta.linkId !== undefined) l.linkId = meta.linkId
  save(db)
}
// آمارِ گرفته‌شده از nxal را روی رکورد می‌نشاند.
export function applyStats(code: string, s: { clicks: number; uniqueClicks?: number; lastClickedAt?: string }) {
  const db = load(); const l = db.links.find(x => x.code === code); if (!l) return
  l.clicks = s.clicks; if (s.uniqueClicks !== undefined) l.uniqueClicks = s.uniqueClicks
  if (s.lastClickedAt) { const t = Date.parse(s.lastClickedAt); if (!Number.isNaN(t)) l.lastClickAt = t }
  save(db)
}
// ریدایرکتِ داخلی (پشتیبان) — اگر کسی /go/<code> را باز کند.
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
