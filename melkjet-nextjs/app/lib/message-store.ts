import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'

// گفتگوی واقعیِ کاربر-به-کاربر بین «خریدار» و «صاحبِ آگهی» (نه هوش مصنوعی).
// اولین استوری که به PostgreSQL منتقل شد (به‌عنوان الگو): اگر DATABASE_URL ست باشد → Postgres
// با نوشتنِ اتمیک (بدونِ گم‌شدنِ پیامِ همزمان)، وگرنه دقیقاً مثلِ قبل روی فایل.
const DATA_FILE = join(process.cwd(), '.messages-data.json')
const KV_KEY = 'messages'

export type Side = 'buyer' | 'owner'
export interface Msg { from: Side; text: string; at: number }
export interface Conversation {
  id: string
  listingId: string
  listingTitle: string
  buyerPhone: string
  buyerName: string
  ownerPhone: string     // شمارهٔ حسابِ صاحبِ آگهی (از meta.__ownerPhone)
  ownerName: string
  messages: Msg[]
  buyerUnread: number
  ownerUnread: number
  createdAt: number
  updatedAt: number
}

interface DB { conversations: Conversation[] }
function id() { return 'c_' + randomBytes(6).toString('hex') }

// ── لایهٔ ذخیره‌سازی (Postgres یا فایل) ──────────────────────────────────────
function fileLoad(): DB { if (existsSync(DATA_FILE)) { try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {} } return { conversations: [] } }
function fileSave(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, { conversations: [] }) : fileLoad() }
// خواندن-تغییر-نوشتنِ اتمیک: در Postgres با قفلِ ردیف (بدونِ گم‌شدنِ نوشتنِ همزمان)، در فایل مثلِ قبل.
async function mutate<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, { conversations: [] }, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

// گفتگوی همان (آگهی + خریدار + صاحب) را پیدا یا می‌سازد و پیام خریدار را اضافه می‌کند.
export async function startConversation(input: {
  listingId: string; listingTitle: string
  buyerPhone: string; buyerName: string
  ownerPhone: string; ownerName: string
  text: string
}): Promise<Conversation> {
  return mutate((db) => {
    let conv = db.conversations.find(c => c.listingId === input.listingId && c.buyerPhone === input.buyerPhone && c.ownerPhone === input.ownerPhone)
    const now = Date.now()
    if (!conv) {
      conv = {
        id: id(), listingId: input.listingId, listingTitle: input.listingTitle,
        buyerPhone: input.buyerPhone, buyerName: input.buyerName,
        ownerPhone: input.ownerPhone, ownerName: input.ownerName,
        messages: [], buyerUnread: 0, ownerUnread: 0, createdAt: now, updatedAt: now,
      }
      db.conversations.unshift(conv)
    }
    conv.messages.push({ from: 'buyer', text: input.text, at: now })
    conv.ownerUnread += 1
    conv.updatedAt = now
    return conv
  })
}

// پاسخ در یک گفتگوی موجود از سمتِ مشخص؛ شمارهٔ ارسال‌کننده برای اعتبارسنجی.
export async function replyTo(convId: string, fromPhone: string, text: string): Promise<Conversation | null> {
  return mutate((db) => {
    const conv = db.conversations.find(c => c.id === convId)
    if (!conv) return null
    let from: Side | null = null
    if (fromPhone === conv.ownerPhone) from = 'owner'
    else if (fromPhone === conv.buyerPhone) from = 'buyer'
    if (!from) return null
    const now = Date.now()
    conv.messages.push({ from, text, at: now })
    if (from === 'owner') conv.buyerUnread += 1; else conv.ownerUnread += 1
    conv.updatedAt = now
    return conv
  })
}

export async function getConv(convId: string): Promise<Conversation | null> {
  return (await load()).conversations.find(c => c.id === convId) || null
}

export async function listForBuyer(phone: string): Promise<Conversation[]> {
  return (await load()).conversations.filter(c => c.buyerPhone === phone).sort((a, b) => b.updatedAt - a.updatedAt)
}
export async function listForOwner(phone: string): Promise<Conversation[]> {
  return (await load()).conversations.filter(c => c.ownerPhone === phone).sort((a, b) => b.updatedAt - a.updatedAt)
}

// پیامِ سیستمی از «ملک‌جت» به کاربر (مثلِ هشدارِ آگهیِ جدید). کاربر آن را در گفتگوها می‌بیند.
const SYS_PHONE = 'melkjet-system'
export async function pushSystemMessage(buyerPhone: string, buyerName: string, text: string): Promise<Conversation> {
  return mutate((db) => {
    let conv = db.conversations.find(c => c.buyerPhone === buyerPhone && c.ownerPhone === SYS_PHONE)
    const now = Date.now()
    if (!conv) {
      conv = { id: id(), listingId: '__alerts__', listingTitle: 'اعلان‌های ملک‌جت', buyerPhone, buyerName, ownerPhone: SYS_PHONE, ownerName: 'ملک‌جت', messages: [], buyerUnread: 0, ownerUnread: 0, createdAt: now, updatedAt: now }
      db.conversations.unshift(conv)
    }
    conv.messages.push({ from: 'owner', text, at: now })
    conv.buyerUnread += 1
    conv.updatedAt = now
    return conv
  })
}

export async function markRead(convId: string, phone: string): Promise<void> {
  await mutate((db) => {
    const conv = db.conversations.find(c => c.id === convId)
    if (!conv) return
    if (phone === conv.ownerPhone) conv.ownerUnread = 0
    else if (phone === conv.buyerPhone) conv.buyerUnread = 0
  })
}

export async function unreadForBuyer(phone: string): Promise<number> { return (await listForBuyer(phone)).reduce((s, c) => s + c.buyerUnread, 0) }
export async function unreadForOwner(phone: string): Promise<number> { return (await listForOwner(phone)).reduce((s, c) => s + c.ownerUnread, 0) }
