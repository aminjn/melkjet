import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// گفتگوی واقعیِ کاربر-به-کاربر بین «خریدار» و «صاحبِ آگهی» (نه هوش مصنوعی).
// مشترک بین دو طرف: هر طرف از پنل خودش همان گفتگو را می‌بیند و پاسخ می‌دهد.
const DATA_FILE = join(process.cwd(), '.messages-data.json')

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
function load(): DB { if (existsSync(DATA_FILE)) { try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {} } return { conversations: [] } }
function save(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

// گفتگوی همان (آگهی + خریدار + صاحب) را پیدا یا می‌سازد و پیام خریدار را اضافه می‌کند.
export function startConversation(input: {
  listingId: string; listingTitle: string
  buyerPhone: string; buyerName: string
  ownerPhone: string; ownerName: string
  text: string
}): Conversation {
  const db = load()
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
  save(db)
  return conv
}

// پاسخ در یک گفتگوی موجود از سمتِ مشخص؛ شمارهٔ ارسال‌کننده برای اعتبارسنجی.
export function replyTo(convId: string, fromPhone: string, text: string): Conversation | null {
  const db = load()
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
  save(db)
  return conv
}

export function getConv(convId: string): Conversation | null {
  return load().conversations.find(c => c.id === convId) || null
}

export function listForBuyer(phone: string): Conversation[] {
  return load().conversations.filter(c => c.buyerPhone === phone).sort((a, b) => b.updatedAt - a.updatedAt)
}
export function listForOwner(phone: string): Conversation[] {
  return load().conversations.filter(c => c.ownerPhone === phone).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function markRead(convId: string, phone: string) {
  const db = load()
  const conv = db.conversations.find(c => c.id === convId)
  if (!conv) return
  if (phone === conv.ownerPhone) conv.ownerUnread = 0
  else if (phone === conv.buyerPhone) conv.buyerUnread = 0
  save(db)
}

export function unreadForBuyer(phone: string): number { return listForBuyer(phone).reduce((s, c) => s + c.buyerUnread, 0) }
export function unreadForOwner(phone: string): number { return listForOwner(phone).reduce((s, c) => s + c.ownerUnread, 0) }
