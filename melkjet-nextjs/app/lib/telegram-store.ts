// فاز ۲۵۳ — انبارِ آلارم‌های تلگرام + پیش‌نویسِ گفت‌وگو. فایل‌محور، کلید=chatId.
import { promises as fs } from 'fs'
import { join } from 'path'

const FILE = join(process.cwd(), '.telegram-data.json')

export interface Sub { id: string; chatId: number; deal: string; city: string; region: string; hood: string; createdAt: number }
export interface Draft {
  step: 'deal' | 'city' | 'cityText' | 'region' | 'regionText' | 'hood'
  deal?: string; city?: string; region?: string; regions?: string[]; hoods?: string[]
}
interface DB { subs: Sub[]; drafts: Record<string, Draft> }

async function load(): Promise<DB> {
  try { const d = JSON.parse(await fs.readFile(FILE, 'utf8')); return { subs: d.subs || [], drafts: d.drafts || {} } }
  catch { return { subs: [], drafts: {} } }
}
async function save(db: DB) { await fs.writeFile(FILE, JSON.stringify(db), 'utf8') }
const rid = () => Math.random().toString(36).slice(2, 10)

export async function getDraft(chatId: number) { return (await load()).drafts[String(chatId)] }
export async function setDraft(chatId: number, draft: Draft) { const db = await load(); db.drafts[String(chatId)] = draft; await save(db) }
export async function clearDraft(chatId: number) { const db = await load(); delete db.drafts[String(chatId)]; await save(db) }

export async function addSub(s: Omit<Sub, 'id' | 'createdAt'>): Promise<Sub> {
  const db = await load(); const sub: Sub = { ...s, id: rid(), createdAt: Date.now() }
  db.subs.unshift(sub); await save(db); return sub
}
export async function listSubs(chatId: number): Promise<Sub[]> { return (await load()).subs.filter(s => s.chatId === chatId) }
export async function removeSub(chatId: number, id: string): Promise<boolean> {
  const db = await load(); const before = db.subs.length
  db.subs = db.subs.filter(s => !(s.chatId === chatId && s.id === id)); await save(db); return db.subs.length < before
}
export async function allSubs(): Promise<Sub[]> { return (await load()).subs }
