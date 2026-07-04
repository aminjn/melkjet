import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'

// ─── سیستمِ تیکتِ پشتیبانی — یک‌جا برای همهٔ پنل‌ها و سوپرادمین ─────────────────
// دومَحاله: اگر DATABASE_URL ست باشد → Postgres (نوشتنِ اتمیک)، وگرنه فایل.
const FILE = join(process.cwd(), '.ticket-data.json')
const KV_KEY = 'ticket'
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
function fileLoad(): DB { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return { tickets: [] } }
function fileSave(db: DB) { try { writeFileSync(FILE, JSON.stringify(db), 'utf-8') } catch {} }

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, { tickets: [] }) : fileLoad() }
async function mutate<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, { tickets: [] }, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

export async function createTicket(owner: string, d: { subject: string; category?: string; text: string; name?: string; phone?: string; panel?: string }): Promise<Ticket> {
  return mutate((db) => {
    const t: Ticket = {
      id: id(), owner, name: d.name, phone: d.phone, panel: d.panel,
      subject: String(d.subject || 'تیکت').slice(0, 120), category: d.category,
      status: 'open', messages: [{ id: id(), from: 'user', text: String(d.text || '').slice(0, 4000), at: Date.now() }],
      createdAt: Date.now(), updatedAt: Date.now(), adminUnread: true, userUnread: false,
    }
    db.tickets.unshift(t); return t
  })
}
export async function listByOwner(owner: string): Promise<Ticket[]> {
  return (await load()).tickets.filter(t => t.owner === owner).sort((a, b) => b.updatedAt - a.updatedAt)
}
export async function getTicket(tid: string): Promise<Ticket | null> { return (await load()).tickets.find(t => t.id === tid) || null }

export async function userReply(tid: string, owner: string, text: string): Promise<Ticket | null> {
  return mutate((db) => {
    const t = db.tickets.find(x => x.id === tid && x.owner === owner); if (!t) return null
    t.messages.push({ id: id(), from: 'user', text: String(text || '').slice(0, 4000), at: Date.now() })
    t.updatedAt = Date.now(); t.adminUnread = true; t.status = 'open'; return t
  })
}
export async function adminReply(tid: string, text: string): Promise<Ticket | null> {
  return mutate((db) => {
    const t = db.tickets.find(x => x.id === tid); if (!t) return null
    t.messages.push({ id: id(), from: 'admin', text: String(text || '').slice(0, 4000), at: Date.now() })
    t.updatedAt = Date.now(); t.userUnread = true; t.status = 'answered'; return t
  })
}
export async function setStatus(tid: string, status: TicketStatus): Promise<Ticket | null> {
  return mutate((db) => {
    const t = db.tickets.find(x => x.id === tid); if (!t) return null
    t.status = status; t.updatedAt = Date.now(); return t
  })
}
export async function markReadByUser(tid: string, owner: string): Promise<void> { await mutate((db) => { const t = db.tickets.find(x => x.id === tid && x.owner === owner); if (t && t.userUnread) { t.userUnread = false } }) }
export async function markReadByAdmin(tid: string): Promise<void> { await mutate((db) => { const t = db.tickets.find(x => x.id === tid); if (t && t.adminUnread) { t.adminUnread = false } }) }

export async function listAll(): Promise<Ticket[]> { return (await load()).tickets.slice().sort((a, b) => b.updatedAt - a.updatedAt) }
export async function adminUnreadCount(): Promise<number> { return (await load()).tickets.filter(t => t.adminUnread).length }
export async function userUnreadCount(owner: string): Promise<number> { return (await load()).tickets.filter(t => t.owner === owner && t.userUnread).length }
