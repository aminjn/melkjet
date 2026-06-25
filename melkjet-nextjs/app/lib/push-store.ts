import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// ذخیرهٔ ماندگارِ subscriptionهای پوش — کلید: endpoint. به شماره و کوکیِ بازدیدکننده وصل می‌شود
// تا حتی اگر PWA بسته باشد یا قبلاً در مرورگر باز شده باشد، نوتیفیکیشن برسد.
const DATA_FILE = join(process.cwd(), '.push-data.json')

export interface StoredSub { endpoint: string; keys: { p256dh: string; auth: string }; phone?: string; vid?: string; createdAt: number; lastSeen: number }
interface DB { subs: StoredSub[] }

function load(): DB { if (existsSync(DATA_FILE)) { try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {} } return { subs: [] } }
function save(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

export function saveSub(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, phone?: string, vid?: string): StoredSub {
  const db = load()
  let s = db.subs.find(x => x.endpoint === sub.endpoint)
  const now = Date.now()
  if (!s) { s = { endpoint: sub.endpoint, keys: sub.keys, createdAt: now, lastSeen: now }; db.subs.unshift(s) }
  s.keys = sub.keys
  if (phone) s.phone = phone
  if (vid) s.vid = vid
  s.lastSeen = now
  save(db)
  return s
}
export function removeByEndpoint(endpoint: string) { const db = load(); db.subs = db.subs.filter(s => s.endpoint !== endpoint); save(db) }
export function listForPhone(phone: string): StoredSub[] { return load().subs.filter(s => s.phone === phone) }
export function attachPhone(vid: string, phone: string) { const db = load(); let ch = false; for (const s of db.subs) if (s.vid === vid && !s.phone) { s.phone = phone; ch = true } if (ch) save(db) }
export function countAll(): number { return load().subs.length }
