import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// ─── گزارشِ تماس‌ها: هر بار کاربرِ واردشده شمارهٔ یک سازنده را «نمایش» می‌دهد، این‌جا
// ثبت می‌شود تا سازنده در پنلش لیدها/تماس‌ها را ببیند. کلید = builderId (constructor.id).
const FILE = join(process.cwd(), '.contact-log-data.json')

export interface Contact { viewerPhone: string; viewerName?: string; projectHashId?: string; projectName?: string; at: number }
type DB = Record<string, Contact[]>

function load(): DB { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return {} }
function save(db: DB) { try { writeFileSync(FILE, JSON.stringify(db), 'utf-8') } catch {} }

// یک تماس را ثبت می‌کند؛ اگر همان بیننده برای همان پروژه قبلاً ثبت شده، فقط زمان را تازه می‌کند.
export function addContact(builderId: string, c: Contact) {
  const db = load(); const k = String(builderId); const list = db[k] || (db[k] = [])
  const existing = list.find(x => x.viewerPhone === c.viewerPhone && x.projectHashId === c.projectHashId)
  if (existing) { existing.at = c.at; if (c.viewerName) existing.viewerName = c.viewerName; if (c.projectName) existing.projectName = c.projectName }
  else list.unshift(c)
  save(db)
}
export function getContacts(builderId: string): Contact[] {
  return (load()[String(builderId)] || []).slice().sort((a, b) => b.at - a.at)
}
export function contactCount(builderId: string): number { return (load()[String(builderId)] || []).length }
