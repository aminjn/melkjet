import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'

// دستیار هوشمندِ مشترک برای همهٔ پنل‌ها — per (owner phone, panel).
// هر پنل مجموعهٔ گفتگوهای جداگانهٔ خودش را دارد تا کاربر بعداً مرور کند.
// دومَحاله: اگر DATABASE_URL ست باشد → Postgres (نوشتنِ اتمیک)، وگرنه فایل.
const FILE = join(process.cwd(), '.assistant-data.json')
const KV_KEY = 'assistant'

export type AiRole = 'user' | 'assistant'
export interface AiMsg { id: string; role: AiRole; text: string; createdAt: number }
export interface AiChat { id: string; title: string; messages: AiMsg[]; createdAt: number; updatedAt: number }

// db[owner][panel] = AiChat[]
type DB = Record<string, Record<string, AiChat[]>>
function uid(p = '') { return p + randomBytes(5).toString('hex') }
function fileLoad(): DB { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return {} }
function fileSave(db: DB) { writeFileSync(FILE, JSON.stringify(db, null, 2)) }

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, {}) : fileLoad() }
async function mutate<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, {}, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

function bucket(db: DB, owner: string, panel: string): AiChat[] {
  if (!db[owner]) db[owner] = {}
  if (!Array.isArray(db[owner][panel])) db[owner][panel] = []
  return db[owner][panel]
}

export async function listChats(owner: string, panel: string): Promise<AiChat[]> {
  const db = await load()
  return [...bucket(db, owner, panel)].sort((a, b) => b.updatedAt - a.updatedAt)
}
export async function getChat(owner: string, panel: string, chatId: string): Promise<AiChat | null> {
  return bucket(await load(), owner, panel).find(c => c.id === chatId) || null
}
export async function newChat(owner: string, panel: string): Promise<AiChat> {
  const now = Date.now()
  const c: AiChat = { id: uid('ac_'), title: 'گفتگوی جدید', messages: [], createdAt: now, updatedAt: now }
  await mutate(db => { bucket(db, owner, panel).unshift(c) })
  return c
}
// اگر chatId نبود، گفتگوی جدید می‌سازد.
export async function addMessage(owner: string, panel: string, chatId: string | undefined, role: AiRole, text: string): Promise<AiChat> {
  let res!: AiChat
  await mutate(db => {
    const list = bucket(db, owner, panel)
    let c = chatId ? list.find(x => x.id === chatId) : undefined
    if (!c) { const now = Date.now(); c = { id: uid('ac_'), title: 'گفتگوی جدید', messages: [], createdAt: now, updatedAt: now }; list.unshift(c) }
    c.messages.push({ id: uid('m_'), role, text, createdAt: Date.now() })
    if (role === 'user' && (c.title === 'گفتگوی جدید' || !c.title)) c.title = text.trim().slice(0, 40) || 'گفتگوی جدید'
    c.updatedAt = Date.now()
    res = c
  })
  return res
}
export async function renameChat(owner: string, panel: string, chatId: string, title: string): Promise<AiChat | null> {
  let res: AiChat | null = null
  await mutate(db => { const c = bucket(db, owner, panel).find(x => x.id === chatId); if (!c) return; c.title = String(title).trim().slice(0, 60) || c.title; res = c })
  return res
}
export async function deleteChat(owner: string, panel: string, chatId: string): Promise<void> {
  await mutate(db => { db[owner][panel] = bucket(db, owner, panel).filter(c => c.id !== chatId) })
}
