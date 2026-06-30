import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// ─── سیستمِ تیکتِ پشتیبانی — یک‌جا برای همهٔ پنل‌ها و سوپرادمین ─────────────────
const FILE = join(process.cwd(), '.ticket-data.json')
function id() { return randomBytes(6).toString('hex') }

export type TicketStatus = 'open' | 'answered' | 'closed'
export const STATUS_LABEL: Record<TicketStatus, string> = { open: 'باز', answered: 'پاسخ داده‌شده', closed: 'بسته' }
export interface TicketMsg { id: string; from: 'user' | 'admin'; text: string; at: number }
export interface Ticket {
  id: string; owner: string; name?: string; phone?: string; panel?: string
  subject: string; category?: string; status: TicketStatus
  messages: TicketMsg[]; createdAt: number; updatedAt: number
  adminUnread: boolean; userUnread: boolean
}

type DB = { tickets: Ticket[] }
function load(): DB { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return { tickets: [] } }
function save(db: DB) { try { writeFileSync(FILE, JSON.stringify(db), 'utf-8') } catch {} }

export function createTicket(owner: string, d: { subject: string; category?: string; text: string; name?: string; phone?: string; panel?: string }): Ticket {
  const db = load()
  const t: Ticket = {
    id: id(), owner, name: d.name, phone: d.phone, panel: d.panel,
    subject: String(d.subject || 'تیکت').slice(0, 120), category: d.category,
    status: 'open', messages: [{ id: id(), from: 'user', text: String(d.text || '').slice(0, 4000), at: Date.now() }],
    createdAt: Date.now(), updatedAt: Date.now(), adminUnread: true, userUnread: false,
  }
  db.tickets.unshift(t); save(db); return t
}
export function listByOwner(owner: string): Ticket[] {
  return load().tickets.filter(t => t.owner === owner).sort((a, b) => b.updatedAt - a.updatedAt)
}
export function getTicket(tid: string): Ticket | null { return load().tickets.find(t => t.id === tid) || null }

export function userReply(tid: string, owner: string, text: string): Ticket | null {
  const db = load(); const t = db.tickets.find(x => x.id === tid && x.owner === owner); if (!t) return null
  t.messages.push({ id: id(), from: 'user', text: String(text || '').slice(0, 4000), at: Date.now() })
  t.updatedAt = Date.now(); t.adminUnread = true; t.status = 'open'; save(db); return t
}
export function adminReply(tid: string, text: string): Ticket | null {
  const db = load(); const t = db.tickets.find(x => x.id === tid); if (!t) return null
  t.messages.push({ id: id(), from: 'admin', text: String(text || '').slice(0, 4000), at: Date.now() })
  t.updatedAt = Date.now(); t.userUnread = true; t.status = 'answered'; save(db); return t
}
export function setStatus(tid: string, status: TicketStatus): Ticket | null {
  const db = load(); const t = db.tickets.find(x => x.id === tid); if (!t) return null
  t.status = status; t.updatedAt = Date.now(); save(db); return t
}
export function markReadByUser(tid: string, owner: string) { const db = load(); const t = db.tickets.find(x => x.id === tid && x.owner === owner); if (t && t.userUnread) { t.userUnread = false; save(db) } }
export function markReadByAdmin(tid: string) { const db = load(); const t = db.tickets.find(x => x.id === tid); if (t && t.adminUnread) { t.adminUnread = false; save(db) } }

export function listAll(): Ticket[] { return load().tickets.slice().sort((a, b) => b.updatedAt - a.updatedAt) }
export function adminUnreadCount(): number { return load().tickets.filter(t => t.adminUnread).length }
export function userUnreadCount(owner: string): number { return load().tickets.filter(t => t.owner === owner && t.userUnread).length }
