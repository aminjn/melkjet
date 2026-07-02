import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { setPlan } from './account-store'
import { getPlan } from './plan-store'

// استورِ ارتباطات/خرید: پکیج‌های شارژ (پیامک/ایمیل/توکن) + اشتراکِ پلن + اعتبارِ هر کاربر + سفارش‌ها.
// پکیج‌ها سراسری‌اند و سوپرادمین می‌سازد؛ اعتبار و سفارش‌ها per-owner (شمارهٔ کاربر).
const DATA_FILE = join(process.cwd(), '.comm-data.json')

export type Channel = 'sms' | 'email' | 'token'
export interface CommPackage { id: string; channel: Channel; name: string; credits: number; price: number; active: boolean; createdAt: number }
export interface Credit { sms: number; email: number; token: number }
export type OrderStatus = 'pending' | 'paid' | 'rejected'
export type OrderKind = 'package' | 'plan'
export interface CommOrder { id: string; owner: string; kind: OrderKind; name: string; price: number; status: OrderStatus; createdAt: number; paidAt?: number; packageId?: string; channel?: Channel; credits?: number; planId?: string; gateway?: string; receipt?: string; period?: string }

interface DB { packages: CommPackage[]; credits: Record<string, Credit>; orders: CommOrder[]; usage?: Record<string, { token: number }> }

function id(p = '') { return p + randomBytes(5).toString('hex') }
function load(): DB { if (existsSync(DATA_FILE)) { try { const d = JSON.parse(readFileSync(DATA_FILE, 'utf-8')); return { packages: d.packages || [], credits: d.credits || {}, orders: d.orders || [], usage: d.usage || {} } } catch {} } return { packages: [], credits: {}, orders: [], usage: {} } }
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
    channel: (r.channel === 'email' || r.channel === 'token') ? r.channel : 'sms',
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
  return { sms: Number(c?.sms) || 0, email: Number(c?.email) || 0, token: Number(c?.token) || 0 }
}
export function grantCredit(owner: string, channel: Channel, amount: number) {
  const db = load()
  const c = db.credits[owner] || { sms: 0, email: 0, token: 0 }
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
  const c = db.credits[owner] || { sms: 0, email: 0, token: 0 }
  const have = Number(c[channel]) || 0
  if (have < count) return { ok: false, error: `اعتبارِ ${channel === 'sms' ? 'پیامک' : 'ایمیل'} کافی نیست (${have} باقی‌مانده، ${count} نیاز). از همین صفحه پکیج تهیه کنید.`, remaining: have }
  c[channel] = have - count
  db.credits[owner] = c
  save(db)
  return { ok: true, remaining: c[channel] }
}

// ---- Token usage (مصرفِ توکنِ AI per-user) ----
export function getTokenUsage(owner: string): number { return Number(load().usage?.[owner]?.token) || 0 }
// آیا کاربر می‌تواند از AI استفاده کند؟ (اگر بستهٔ توکن فعال باشد و اعتبارش صفر باشد، نه)
export function canUseToken(owner: string, role: string): boolean {
  if (role === 'super_admin') return true
  if (!monetizationOn('token')) return true
  return getCredit(owner).token > 0
}
// ثبتِ مصرف + کسر از اعتبار (اگر بستهٔ توکن فعال باشد)
export function recordToken(owner: string, role: string, tokens: number) {
  const n = Math.max(0, Math.round(tokens))
  if (!owner || !n) return
  const db = load()
  if (!db.usage) db.usage = {}
  db.usage[owner] = { token: (Number(db.usage[owner]?.token) || 0) + n }
  if (role !== 'super_admin' && monetizationOn('token')) {
    const c = db.credits[owner] || { sms: 0, email: 0, token: 0 }
    c.token = Math.max(0, (Number(c.token) || 0) - n)
    db.credits[owner] = c
  }
  save(db)
}

// ---- Orders ----
export function createOrder(owner: string, packageId: string, pay?: { gateway?: string; receipt?: string }): { ok: boolean; error?: string; order?: CommOrder } {
  const db = load()
  const pk = db.packages.find(p => p.id === packageId && p.active)
  if (!pk) return { ok: false, error: 'پکیج یافت نشد' }
  const order: CommOrder = { id: id('ord_'), owner, kind: 'package', packageId: pk.id, name: pk.name, channel: pk.channel, credits: pk.credits, price: pk.price, status: 'pending', createdAt: Date.now(), gateway: pay?.gateway, receipt: pay?.receipt }
  db.orders.unshift(order)
  save(db)
  return { ok: true, order }
}
// سفارشِ اشتراکِ پلن — پس از تأییدِ سوپرادمین، پلنِ حساب تنظیم می‌شود.
export function createPlanOrder(owner: string, planId: string, planName: string, price: number, pay?: { gateway?: string; receipt?: string; period?: string }): { ok: boolean; order?: CommOrder } {
  const db = load()
  const order: CommOrder = { id: id('ord_'), owner, kind: 'plan', planId, name: planName || 'اشتراک', price: Math.max(0, Math.round(Number(price) || 0)), status: 'pending', createdAt: Date.now(), gateway: pay?.gateway, receipt: pay?.receipt, period: pay?.period }
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
  if (o.kind === 'plan') {
    // اشتراک: پلنِ حسابِ کاربر را تنظیم کن + اعتبارِ AIِ پلن را شارژ کن
    if (o.planId) {
      try { setPlan(o.owner, o.planId) } catch {}
      try { const pl = getPlan(o.planId); const ai = Number(pl?.aiCredits) || 0; if (ai > 0) { const c = db.credits[o.owner] || { sms: 0, email: 0, token: 0 }; c.token = (Number(c.token) || 0) + ai; db.credits[o.owner] = c } } catch {}
    }
  } else if (o.channel) {
    const c = db.credits[o.owner] || { sms: 0, email: 0, token: 0 }
    c[o.channel] = (Number(c[o.channel]) || 0) + (Number(o.credits) || 0)
    db.credits[o.owner] = c
  }
  save(db)
  return { ok: true }
}
export function rejectOrder(orderId: string): { ok: boolean } {
  const db = load()
  const o = db.orders.find(x => x.id === orderId)
  if (o && o.status === 'pending') { o.status = 'rejected'; save(db) }
  return { ok: true }
}
