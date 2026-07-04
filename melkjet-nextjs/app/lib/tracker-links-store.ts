import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'

// لینک‌های ردیابیِ پیامکِ ترکر. آمارِ کلیک از خودِ nxal گرفته می‌شود (linkId)؛
// لینکِ ریدایرکتِ داخلی (/go/<code>) هم به‌عنوانِ پشتیبان نگه داشته می‌شود.
// دومَحاله: اگر DATABASE_URL ست باشد → Postgres (نوشتنِ اتمیک)، وگرنه فایل.
const FILE = join(process.cwd(), '.tracker-links-data.json')
const KV_KEY = 'tracker-links'

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

function fileLoad(): DB { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return { links: [] } }
function fileSave(db: DB) { writeFileSync(FILE, JSON.stringify(db)) }
function code() { return randomBytes(5).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 7) || randomBytes(4).toString('hex') }

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, { links: [] }) : fileLoad() }
async function mutate<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, { links: [] }, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

export async function createLink(input: { dest: string; title?: string; phone?: string; channel?: string }): Promise<TLink> {
  const l: TLink = { code: code(), dest: input.dest, title: input.title, phone: input.phone, channel: input.channel, clicks: 0, createdAt: Date.now() }
  await mutate(db => { db.links.unshift(l); db.links = db.links.slice(0, 5000) })
  return l
}
export async function setLinkMeta(code: string, meta: { shortUrl?: string; linkId?: string }): Promise<void> {
  await mutate(db => {
    const l = db.links.find(x => x.code === code); if (!l) return
    if (meta.shortUrl !== undefined) l.shortUrl = meta.shortUrl
    if (meta.linkId !== undefined) l.linkId = meta.linkId
  })
}
// آمارِ گرفته‌شده از nxal را روی رکورد می‌نشاند.
export async function applyStats(code: string, s: { clicks: number; uniqueClicks?: number; lastClickedAt?: string }): Promise<void> {
  await mutate(db => {
    const l = db.links.find(x => x.code === code); if (!l) return
    l.clicks = s.clicks; if (s.uniqueClicks !== undefined) l.uniqueClicks = s.uniqueClicks
    if (s.lastClickedAt) { const t = Date.parse(s.lastClickedAt); if (!Number.isNaN(t)) l.lastClickAt = t }
  })
}
// ریدایرکتِ داخلی (پشتیبان) — اگر کسی /go/<code> را باز کند.
export async function recordClick(code: string): Promise<string | null> {
  return mutate(db => {
    const l = db.links.find(x => x.code === code); if (!l) return null
    l.clicks++; l.lastClickAt = Date.now()
    return l.dest
  })
}
export async function listLinks(limit = 200): Promise<TLink[]> { return (await load()).links.slice(0, limit) }
export async function linkStats() {
  const ls = (await load()).links
  return { total: ls.length, clicked: ls.filter(l => l.clicks > 0).length, clicks: ls.reduce((s, l) => s + l.clicks, 0) }
}
