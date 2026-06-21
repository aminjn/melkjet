import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// دستیار هوشمندِ مشترک برای همهٔ پنل‌ها — per (owner phone, panel).
// هر پنل مجموعهٔ گفتگوهای جداگانهٔ خودش را دارد تا کاربر بعداً مرور کند.
const FILE = join(process.cwd(), '.assistant-data.json')

export type AiRole = 'user' | 'assistant'
export interface AiMsg { id: string; role: AiRole; text: string; createdAt: number }
export interface AiChat { id: string; title: string; messages: AiMsg[]; createdAt: number; updatedAt: number }

// db[owner][panel] = AiChat[]
type DB = Record<string, Record<string, AiChat[]>>
function uid(p = '') { return p + randomBytes(5).toString('hex') }
function load(): DB { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return {} }
function save(db: DB) { writeFileSync(FILE, JSON.stringify(db, null, 2)) }

function bucket(db: DB, owner: string, panel: string): AiChat[] {
  if (!db[owner]) db[owner] = {}
  if (!Array.isArray(db[owner][panel])) db[owner][panel] = []
  return db[owner][panel]
}

export function listChats(owner: string, panel: string): AiChat[] {
  const db = load()
  return [...bucket(db, owner, panel)].sort((a, b) => b.updatedAt - a.updatedAt)
}
export function getChat(owner: string, panel: string, chatId: string): AiChat | null {
  return bucket(load(), owner, panel).find(c => c.id === chatId) || null
}
export function newChat(owner: string, panel: string): AiChat {
  const db = load(); const list = bucket(db, owner, panel)
  const now = Date.now()
  const c: AiChat = { id: uid('ac_'), title: 'گفتگوی جدید', messages: [], createdAt: now, updatedAt: now }
  list.unshift(c); save(db); return c
}
// اگر chatId نبود، گفتگوی جدید می‌سازد.
export function addMessage(owner: string, panel: string, chatId: string | undefined, role: AiRole, text: string): AiChat {
  const db = load(); const list = bucket(db, owner, panel)
  let c = chatId ? list.find(x => x.id === chatId) : undefined
  if (!c) { const now = Date.now(); c = { id: uid('ac_'), title: 'گفتگوی جدید', messages: [], createdAt: now, updatedAt: now }; list.unshift(c) }
  c.messages.push({ id: uid('m_'), role, text, createdAt: Date.now() })
  if (role === 'user' && (c.title === 'گفتگوی جدید' || !c.title)) c.title = text.trim().slice(0, 40) || 'گفتگوی جدید'
  c.updatedAt = Date.now(); save(db); return c
}
export function renameChat(owner: string, panel: string, chatId: string, title: string): AiChat | null {
  const db = load(); const c = bucket(db, owner, panel).find(x => x.id === chatId)
  if (!c) return null
  c.title = String(title).trim().slice(0, 60) || c.title; save(db); return c
}
export function deleteChat(owner: string, panel: string, chatId: string) {
  const db = load(); db[owner][panel] = bucket(db, owner, panel).filter(c => c.id !== chatId); save(db)
}
