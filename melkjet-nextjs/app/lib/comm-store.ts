import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// استورِ ارتباطات (پیامک/ایمیل): پکیج‌های شارژ + اعتبارِ هر کاربر + سفارش‌ها.
// پکیج‌ها سراسری‌اند و سوپرادمین می‌سازد؛ اعتبار و سفارش‌ها per-owner (شمارهٔ کاربر).
const DATA_FILE = join(process.cwd(), '.comm-data.json')

export type Channel = 'sms' | 'email'
export interface CommPackage { id: string; channel: Channel; name: string; credits: number; price: number; active: boolean; createdAt: number }
export interface Credit { sms: number; email: number }
export type OrderStatus = 'pending' | 'paid' | 'rejected'
export interface CommOrder { id: string; owner: string; packageId: string; name: string; channel: Channel; credits: number; price: number; status: OrderStatus; createdAt: number; paidAt?: number }

interface DB { packages: CommPackage[]; credits: Record<string, Credit>; orders: CommOrder[] }

function id(p = '') { return p + randomBytes(5).toString('hex') }
function load(): DB { if (existsSync(DATA_FILE)) { try { const d = JSON.parse(readFileSync(DATA_FILE, 'utf-8')); return { packages: d.packages || [], credits: d.credits || {}, orders: d.orders || [] } } catch {} } return { packages: [], credits: {}, orders: [] } }
function save(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8') }

// ---- Packages (super-admin) ----
export function listPackages(activeOnly = false): CommPackage[] {
  const db = load()
  const ps = [...db.packages].sort((a, b) => a.price - b.price)
  return activeOnly ? ps.filter(p => p.active) : ps
}
export function setPackages(rows: Partial<CommPackage>[]): CommPackage[] {
  const db = load()
  db.packages = (rows || []).map(r => ({
    id: r.id && String(r.id).startsWith('pk_') ? String(r.id) : id('pk_'),
    channel: r.channel === 'email' ? 'email' : 'sms',
    name: String(r.name || '').trim() || 'پکیج',
    credits: Math.max(0, Math.round(Number(r.credits) || 0)),
    price: Math.max(0, Math.round(Number(r.price) || 0)),
    active: r.active !== false,
    createdAt: Number(r.createdAt) || Date.now(),
  }))
  save(db)
  return db.packages
}

// آیا کسب‌وکارِ پکیج روشن است؟ (اگر هیچ پکیجِ فعالی نباشد، ارسال محدود نمی‌شود)
export function monetizationOn(channel: Channel): boolean {
  return load().packages.some(p => p.active && p.channel === channel)
}

// ---- Credit ----
export function getCredit(owner: string): Credit {
  const c = load().credits[owner]
  return { sms: Number(c?.sms) || 0, email: Number(c?.email) || 0 }
}
export function grantCredit(owner: string, channel: Channel, amount: number) {
  const db = load()
  const c = db.credits[owner] || { sms: 0, email: 0 }
  c[channel] = Math.max(0, (Number(c[channel]) || 0) + Math.round(amount))
  db.credits[owner] = c
  save(db)
  return c
}

// هزینهٔ ارسال: super_admin معاف؛ اگر پکیجِ فعالی نباشد آزاد؛ وگرنه از اعتبار کم می‌کند.
export function chargeSend(owner: string, role: string, channel: Channel, count: number): { ok: boolean; error?: string; remaining?: number } {
  if (role === 'super_admin') return { ok: true }
  if (!monetizationOn(channel)) return { ok: true }
  const db = load()
  const c = db.credits[owner] || { sms: 0, email: 0 }
  const have = Number(c[channel]) || 0
  if (have < count) return { ok: false, error: `اعتبارِ ${channel === 'sms' ? 'پیامک' : 'ایمیل'} کافی نیست (${have} باقی‌مانده، ${count} نیاز). از همین صفحه پکیج تهیه کنید.`, remaining: have }
  c[channel] = have - count
  db.credits[owner] = c
  save(db)
  return { ok: true, remaining: c[channel] }
}

// ---- Orders ----
export function createOrder(owner: string, packageId: string): { ok: boolean; error?: string; order?: CommOrder } {
  const db = load()
  const pk = db.packages.find(p => p.id === packageId && p.active)
  if (!pk) return { ok: false, error: 'پکیج یافت نشد' }
  const order: CommOrder = { id: id('ord_'), owner, packageId: pk.id, name: pk.name, channel: pk.channel, credits: pk.credits, price: pk.price, status: 'pending', createdAt: Date.now() }
  db.orders.unshift(order)
  save(db)
  return { ok: true, order }
}
export function listOrders(owner?: string): CommOrder[] {
  const db = load()
  const os = owner ? db.orders.filter(o => o.owner === owner) : db.orders
  return [...os].sort((a, b) => b.createdAt - a.createdAt)
}
export function approveOrder(orderId: string): { ok: boolean; error?: string } {
  const db = load()
  const o = db.orders.find(x => x.id === orderId)
  if (!o) return { ok: false, error: 'سفارش یافت نشد' }
  if (o.status === 'paid') return { ok: true }
  o.status = 'paid'; o.paidAt = Date.now()
  const c = db.credits[o.owner] || { sms: 0, email: 0 }
  c[o.channel] = (Number(c[o.channel]) || 0) + o.credits
  db.credits[o.owner] = c
  save(db)
  return { ok: true }
}
export function rejectOrder(orderId: string): { ok: boolean } {
  const db = load()
  const o = db.orders.find(x => x.id === orderId)
  if (o && o.status === 'pending') { o.status = 'rejected'; save(db) }
  return { ok: true }
}
