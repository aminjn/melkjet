import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { setPlan } from './account-store'
import { getPlan } from './plan-store'
import { getPaymentConfig } from './payment-store'
import { pgEnabled, kvGet, kvMutate } from './db'

// استورِ ارتباطات/خرید: پکیج‌های شارژ (پیامک/ایمیل/توکن) + اشتراکِ پلن + اعتبارِ هر کاربر + سفارش‌ها.
// پکیج‌ها سراسری‌اند و سوپرادمین می‌سازد؛ اعتبار و سفارش‌ها per-owner (شمارهٔ کاربر).
// دومَحاله: اگر DATABASE_URL ست باشد → Postgres (نوشتنِ اتمیک)، وگرنه فایل.
const DATA_FILE = join(process.cwd(), '.comm-data.json')
const KV_KEY = 'comm'

export type Channel = 'sms' | 'email' | 'token'
export interface CommPackage { id: string; channel: Channel; name: string; credits: number; price: number; active: boolean; createdAt: number }
export interface Credit { sms: number; email: number; token: number }
export type OrderStatus = 'pending' | 'paid' | 'rejected'
export type OrderKind = 'package' | 'plan' | 'promo'
export interface CommOrder { id: string; owner: string; kind: OrderKind; name: string; price: number; status: OrderStatus; createdAt: number; paidAt?: number; packageId?: string; channel?: Channel; credits?: number; planId?: string; gateway?: string; receipt?: string; period?: string; slot?: string; targetId?: string; days?: number; targetName?: string; promoTarget?: 'profile' | 'listing'; bundleId?: string }

interface DB { packages: CommPackage[]; credits: Record<string, Credit>; orders: CommOrder[]; usage?: Record<string, { token: number }>; pkgSeeded?: boolean; seedV?: number }
const PKG_SEED_V = 3
const EMPTY: DB = { packages: [], credits: {}, orders: [], usage: {} }

function id(p = '') { return p + randomBytes(5).toString('hex') }
// هر «عملیاتِ هوش مصنوعی» (تولیدِ متن، تحلیل، بازنویسی و…) ≈ این تعداد توکن. اعتبار به‌شکلِ
// «عملیات» به کاربر نشان داده می‌شود (نه توکنِ خام) چون برای کاربر معنادارتر است.
export const TOKENS_PER_OP = 2000
export const toOps = (tokens: number) => Math.max(0, Math.floor((Number(tokens) || 0) / TOKENS_PER_OP))

// بسته‌های پیش‌فرض. کانالِ «token» حالا بسته‌های «عملیاتِ هوش مصنوعی» است (credits = عملیات × TOKENS_PER_OP).
function seedPackages(): CommPackage[] {
  const now = Date.now()
  const mk = (channel: Channel, name: string, credits: number, price: number): CommPackage => ({ id: id('pk_'), channel, name, credits, price, active: true, createdAt: now })
  const op = (name: string, ops: number, price: number) => mk('token', name, ops * TOKENS_PER_OP, price)
  return [
    op('بستهٔ AI پایه — ۵۰ عملیات', 50, 29000),
    op('بستهٔ AI استاندارد — ۲۰۰ عملیات', 200, 79000),
    op('بستهٔ AI حرفه‌ای — ۵۰۰ عملیات', 500, 179000),
    op('بستهٔ AI کسب‌وکار — ۱۵۰۰ عملیات', 1500, 399000),
    mk('sms', '۵۰۰ پیامک', 500, 45000), mk('sms', '۱٬۰۰۰ پیامک', 1000, 85000), mk('sms', '۲٬۰۰۰ پیامک', 2000, 160000), mk('sms', '۱۰٬۰۰۰ پیامک', 10000, 750000),
    mk('email', '۱٬۰۰۰ ایمیل', 1000, 29000), mk('email', '۵٬۰۰۰ ایمیل', 5000, 120000), mk('email', '۱۰٬۰۰۰ ایمیل', 10000, 220000), mk('email', '۵۰٬۰۰۰ ایمیل', 50000, 990000),
  ]
}

function fileLoad(): DB {
  let db: DB = { packages: [], credits: {}, orders: [], usage: {} }
  if (existsSync(DATA_FILE)) { try { const d = JSON.parse(readFileSync(DATA_FILE, 'utf-8')); db = { packages: d.packages || [], credits: d.credits || {}, orders: d.orders || [], usage: d.usage || {}, pkgSeeded: d.pkgSeeded, seedV: d.seedV } } catch {} }
  return db
}
function fileSave(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8') }

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, { packages: [], credits: {}, orders: [], usage: {} }) : fileLoad() }
async function withDb<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, { packages: [], credits: {}, orders: [], usage: {} }, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}
void EMPTY

// seed/backfillِ بسته‌های پیش‌فرض را روی db اعمال می‌کند؛ برمی‌گرداند که آیا چیزی تغییر کرد (نیاز به ذخیره).
// برای هر کانالی که هیچ بسته‌ای ندارد، پیش‌فرض‌ها را اضافه کن (بدونِ دست‌زدن به بسته‌های موجود).
function applySeed(db: DB): boolean {
  if ((db.seedV || 0) < PKG_SEED_V) {
    const seeds = seedPackages()
    // نسخهٔ ۳: بسته‌های توکنِ قدیمی با بسته‌های «عملیات» جایگزین می‌شوند (یک‌بار).
    if ((db.seedV || 0) < 3) db.packages = db.packages.filter(p => p.channel !== 'token')
    for (const ch of ['token', 'sms', 'email'] as Channel[]) if (!db.packages.some(p => p.channel === ch)) db.packages.push(...seeds.filter(s => s.channel === ch))
    db.seedV = PKG_SEED_V; db.pkgSeeded = true
    return true
  }
  return false
}
// خواندنِ seed-شده با تکنیکِ dirty-flag: فقط وقتی seed لازم بود می‌نویسد (مثلِ load قدیمی).
async function loadSeeded(): Promise<DB> {
  const db = await load()
  if (!applySeed(db)) return db
  return withDb(d => { applySeed(d); return d })
}

// آیا مصرفِ این کانال محدود/پولی است؟ (نسخهٔ همگام روی db در دست — برای استفادهٔ اتمیک داخلِ withDb)
function monetizationForDb(db: DB, channel: Channel): boolean {
  let mode = 'startup'
  try { mode = getPaymentConfig().pricingMode } catch {}
  if (mode !== 'scale' && mode !== 'enterprise') return false
  return db.packages.some(p => p.active && p.channel === channel)
}

// ---- Packages (super-admin) ----
export async function listPackages(activeOnly = false): Promise<CommPackage[]> {
  const db = await loadSeeded()
  const ps = [...db.packages].sort((a, b) => a.price - b.price)
  return activeOnly ? ps.filter(p => p.active) : ps
}
export async function setPackages(rows: Partial<CommPackage>[]): Promise<CommPackage[]> {
  return withDb(db => {
    applySeed(db)
    db.packages = (rows || []).map(r => ({
      id: r.id && String(r.id).startsWith('pk_') ? String(r.id) : id('pk_'),
      channel: (r.channel === 'email' || r.channel === 'token') ? r.channel : 'sms',
      name: String(r.name || '').trim() || 'پکیج',
      credits: Math.max(0, Math.round(Number(r.credits) || 0)),
      price: Math.max(0, Math.round(Number(r.price) || 0)),
      active: r.active !== false,
      createdAt: Number(r.createdAt) || Date.now(),
    }))
    return db.packages
  })
}
// قیمت‌گذاریِ خودکارِ بسته‌ها از نرخِ فروشِ هر واحد (تومان) + گِردکردن.
async function repriceChannel(channel: Channel, pricePerUnit: number, roundTo: number): Promise<number> {
  if (!(pricePerUnit > 0)) return 0
  return withDb(db => {
    applySeed(db)
    let n = 0
    for (const p of db.packages) {
      if (p.channel !== channel) continue
      const rounded = Math.max(roundTo, Math.round((p.credits * pricePerUnit) / roundTo) * roundTo)
      if (p.price !== rounded) { p.price = rounded; n++ }
    }
    return n
  })
}
export async function repriceTokenPackages(pricePerToken: number, roundTo = 1000): Promise<number> { return repriceChannel('token', pricePerToken, roundTo) }
export async function repriceSmsPackages(pricePerSms: number, roundTo = 1000): Promise<number> { return repriceChannel('sms', pricePerSms, roundTo) }

// آیا مصرفِ این کانال محدود/پولی است؟ فقط در حالتِ درآمدی (scale/enterprise) اعمال می‌شود؛
// در حالتِ استارتاپ/رشد بسته‌ها فقط «قابلِ خرید» هستند ولی مصرفِ رایگان محدود نمی‌شود.
export async function monetizationOn(channel: Channel): Promise<boolean> {
  return monetizationForDb(await loadSeeded(), channel)
}

// ---- Credit ----
export async function getCredit(owner: string): Promise<Credit> {
  const c = (await loadSeeded()).credits[owner]
  return { sms: Number(c?.sms) || 0, email: Number(c?.email) || 0, token: Number(c?.token) || 0 }
}
export async function grantCredit(owner: string, channel: Channel, amount: number): Promise<Credit> {
  return withDb(db => {
    applySeed(db)
    const c = db.credits[owner] || { sms: 0, email: 0, token: 0 }
    c[channel] = Math.max(0, (Number(c[channel]) || 0) + Math.round(amount))
    db.credits[owner] = c
    return c
  })
}

// هزینهٔ ارسال: super_admin معاف؛ اگر پکیجِ فعالی نباشد آزاد؛ وگرنه از اعتبار کم می‌کند (اتمیک).
export async function chargeSend(owner: string, role: string, channel: Channel, count: number): Promise<{ ok: boolean; error?: string; remaining?: number }> {
  if (role === 'super_admin') return { ok: true }
  return withDb(db => {
    applySeed(db)
    if (!monetizationForDb(db, channel)) return { ok: true }
    const c = db.credits[owner] || { sms: 0, email: 0, token: 0 }
    const have = Number(c[channel]) || 0
    if (have < count) return { ok: false, error: `اعتبارِ ${channel === 'sms' ? 'پیامک' : 'ایمیل'} کافی نیست (${have} باقی‌مانده، ${count} نیاز). از همین صفحه پکیج تهیه کنید.`, remaining: have }
    c[channel] = have - count
    db.credits[owner] = c
    return { ok: true, remaining: c[channel] }
  })
}

// ---- Token usage (مصرفِ توکنِ AI per-user) ----
export async function getTokenUsage(owner: string): Promise<number> { return Number((await loadSeeded()).usage?.[owner]?.token) || 0 }
// آیا کاربر می‌تواند از AI استفاده کند؟ (اگر بستهٔ توکن فعال باشد و اعتبارش صفر باشد، نه)
export async function canUseToken(owner: string, role: string): Promise<boolean> {
  if (role === 'super_admin') return true
  if (!(await monetizationOn('token'))) return true
  return (await getCredit(owner)).token >= TOKENS_PER_OP   // حداقل یک «عملیات» اعتبار
}
// ثبتِ یک (یا چند) «عملیاتِ هوش مصنوعی» — هر عملیات = TOKENS_PER_OP توکن (کسرِ ثابت و قابل‌پیش‌بینی).
export async function recordOp(owner: string, role: string, ops = 1): Promise<void> {
  await recordToken(owner, role, Math.max(1, Math.round(ops)) * TOKENS_PER_OP)
}
// ثبتِ مصرف + کسر از اعتبار (اگر بستهٔ توکن فعال باشد) — اتمیک (read-modify-write زیرِ یک قفل).
export async function recordToken(owner: string, role: string, tokens: number): Promise<void> {
  const n = Math.max(0, Math.round(tokens))
  if (!owner || !n) return
  await withDb(db => {
    applySeed(db)
    if (!db.usage) db.usage = {}
    db.usage[owner] = { token: (Number(db.usage[owner]?.token) || 0) + n }
    if (role !== 'super_admin' && monetizationForDb(db, 'token')) {
      const c = db.credits[owner] || { sms: 0, email: 0, token: 0 }
      c.token = Math.max(0, (Number(c.token) || 0) - n)
      db.credits[owner] = c
    }
  })
}

// ---- Orders ----
export async function createOrder(owner: string, packageId: string, pay?: { gateway?: string; receipt?: string }): Promise<{ ok: boolean; error?: string; order?: CommOrder }> {
  return withDb(db => {
    applySeed(db)
    const pk = db.packages.find(p => p.id === packageId && p.active)
    if (!pk) return { ok: false, error: 'پکیج یافت نشد' }
    const order: CommOrder = { id: id('ord_'), owner, kind: 'package', packageId: pk.id, name: pk.name, channel: pk.channel, credits: pk.credits, price: pk.price, status: 'pending', createdAt: Date.now(), gateway: pay?.gateway, receipt: pay?.receipt }
    db.orders.unshift(order)
    return { ok: true, order }
  })
}
// سفارشِ پروموت/تبلیغات — پس از تأییدِ سوپرادمین، آیتم/پروفایل در جایگاهِ موردنظر ویژه می‌شود.
export async function createPromoOrder(owner: string, input: { tierId: string; targetId: string; targetName?: string; discountPct?: number }, pay?: { gateway?: string; receipt?: string }): Promise<{ ok: boolean; error?: string; order?: CommOrder }> {
  const { promoTierOf } = await import('./promotion-store')
  const t = promoTierOf(input.tierId)
  if (!t) return { ok: false, error: 'بستهٔ پروموت یافت نشد' }
  if (!input.targetId) return { ok: false, error: 'موردِ پروموت مشخص نیست' }
  const disc = Math.min(90, Math.max(0, Number(input.discountPct) || 0))
  const price = Math.round(t.price * (1 - disc / 100))
  return withDb(db => {
    applySeed(db)
    const order: CommOrder = { id: id('ord_'), owner, kind: 'promo', name: t.name, price, status: 'pending', createdAt: Date.now(), slot: t.slot, targetId: String(input.targetId), days: t.days, targetName: input.targetName, promoTarget: t.target as 'profile' | 'listing', gateway: pay?.gateway, receipt: pay?.receipt }
    db.orders.unshift(order)
    return { ok: true, order }
  })
}
// سفارشِ باندلِ پروموت — یک سفارش که پس از تأیید، همهٔ بسته‌های پروفایلیِ باندل را فعال می‌کند.
export async function createBundleOrder(owner: string, input: { bundleId: string; discountPct?: number; targetName?: string }, pay?: { gateway?: string; receipt?: string }): Promise<{ ok: boolean; error?: string; order?: CommOrder }> {
  const { bundleOf } = await import('./promotion-store')
  const bundle = bundleOf(input.bundleId)
  if (!bundle) return { ok: false, error: 'باندلِ پروموت یافت نشد' }
  const disc = Math.min(90, Math.max(0, Number(input.discountPct) || 0))
  const price = Math.round(bundle.price * (1 - disc / 100))
  return withDb(db => {
    applySeed(db)
    const order: CommOrder = { id: id('ord_'), owner, kind: 'promo', name: bundle.name, price, status: 'pending', createdAt: Date.now(), bundleId: bundle.id, targetId: owner, targetName: input.targetName, promoTarget: 'profile', gateway: pay?.gateway, receipt: pay?.receipt }
    db.orders.unshift(order)
    return { ok: true, order }
  })
}
// سفارشِ اشتراکِ پلن — پس از تأییدِ سوپرادمین، پلنِ حساب تنظیم می‌شود.
export async function createPlanOrder(owner: string, planId: string, planName: string, price: number, pay?: { gateway?: string; receipt?: string; period?: string }): Promise<{ ok: boolean; order?: CommOrder }> {
  return withDb(db => {
    applySeed(db)
    const order: CommOrder = { id: id('ord_'), owner, kind: 'plan', planId, name: planName || 'اشتراک', price: Math.max(0, Math.round(Number(price) || 0)), status: 'pending', createdAt: Date.now(), gateway: pay?.gateway, receipt: pay?.receipt, period: pay?.period }
    db.orders.unshift(order)
    return { ok: true, order }
  })
}
export async function listOrders(owner?: string): Promise<CommOrder[]> {
  const db = await loadSeeded()
  const os = owner ? db.orders.filter(o => o.owner === owner) : db.orders
  return [...os].sort((a, b) => b.createdAt - a.createdAt)
}
export async function approveOrder(orderId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await withDb(db => {
    applySeed(db)
    const o = db.orders.find(x => x.id === orderId)
    if (!o) return { ok: false as const, error: 'سفارش یافت نشد' }
    if (o.status === 'paid') return { ok: true as const }
    o.status = 'paid'; o.paidAt = Date.now()
    if (o.kind === 'plan') {
      // اشتراک: پلنِ حسابِ کاربر را تنظیم کن + اعتبارِ AIِ پلن را شارژ کن
      if (o.planId) {
        try { setPlan(o.owner, o.planId) } catch {}
        try { const pl = getPlan(o.planId); const ai = Number(pl?.aiCredits) || 0; if (ai > 0) { const c = db.credits[o.owner] || { sms: 0, email: 0, token: 0 }; c.token = (Number(c.token) || 0) + ai; db.credits[o.owner] = c } } catch {}
      }
    } else if (o.kind === 'promo') {
      // بیرون از تراکنش فعال می‌شود (promotion-store جداست + پروموتِ آگهی async است).
      return { ok: true as const, promo: { slot: o.slot, targetId: o.targetId, days: o.days, targetName: o.targetName, target: o.promoTarget, bundleId: o.bundleId, owner: o.owner } }
    } else if (o.channel) {
      const c = db.credits[o.owner] || { sms: 0, email: 0, token: 0 }
      c[o.channel] = (Number(c[o.channel]) || 0) + (Number(o.credits) || 0)
      db.credits[o.owner] = c
    }
    return { ok: true as const }
  })
  // فعال‌سازیِ پروموت پس از تراکنش.
  const pr = (res as any).promo
  if (pr && pr.bundleId) {
    // باندل: همهٔ بسته‌های (پروفایلیِ) باندل را روی پروفایلِ صاحبِ سفارش فعال کن.
    try {
      const ps = await import('./promotion-store')
      const bundle = ps.bundleOf(pr.bundleId)
      const now = Date.now()
      for (const tid of bundle?.tierIds || []) {
        const t = ps.promoTierOf(tid)
        if (t) ps.addProfilePromotion(t.slot, pr.owner, pr.targetName || 'متخصص', undefined, now + (Number(t.days) || 30) * 86400000)
      }
    } catch {}
  } else if (pr && pr.slot && pr.targetId) {
    const exp = Date.now() + (Number(pr.days) || 30) * 86400000
    try {
      const ps = await import('./promotion-store')
      if (pr.target === 'listing') await ps.addPromotion(pr.slot, pr.targetId, exp)
      else ps.addProfilePromotion(pr.slot, pr.targetId, pr.targetName || 'متخصص', undefined, exp)
    } catch {}
  }
  return { ok: res.ok, error: (res as any).error }
}
export async function rejectOrder(orderId: string): Promise<{ ok: boolean }> {
  return withDb(db => {
    applySeed(db)
    const o = db.orders.find(x => x.id === orderId)
    if (o && o.status === 'pending') { o.status = 'rejected' }
    return { ok: true }
  })
}
