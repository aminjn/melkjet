import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { getAccount } from './account-store'
import { getProfile } from './profile-store'

// Per-owner (per-profile) store for the «بازار مصالح» seller dashboard.
// Mirrors the file-based persistence style of builder-store.ts / crm-store.ts.
// Every shop is keyed by the owner's phone, so each profile sees only its own.
const DATA_FILE = join(process.cwd(), '.materials-data.json')

export type OrderStatus = 'pending' | 'preparing' | 'shipped' | 'delivered' | 'canceled'
export type InquiryStatus = 'new' | 'answered'

export interface ProductSpec { key: string; value: string }

export interface Product {
  id: string
  name: string
  category: string
  price: number      // تومان به‌ازای هر واحد
  unit: string       // تن / کیسه / متر / عدد / شاخه
  stock: number      // موجودی فعلی
  threshold: number  // آستانهٔ هشدار موجودی کم
  sold: number       // تعداد فروخته‌شده (برای دسته‌های پرفروش)
  active: boolean
  createdAt: number
  // ── مشخصاتِ کاملِ فروشگاهی (همه اختیاری، سازگار با دادهٔ قدیمی) ──
  brand?: string         // برند / تولیدکننده
  origin?: string        // کشور/محلِ ساخت
  description?: string    // توضیحاتِ کامل
  images?: string[]       // گالریِ تصاویر
  specs?: ProductSpec[]   // مشخصاتِ فنی (کلید/مقدار)
  tags?: string[]         // برچسب‌ها
  minOrder?: number       // حداقلِ سفارش (به واحد)
  discountPct?: number    // درصدِ تخفیف
  deliveryDays?: number   // زمانِ تحویل (روز)
  warranty?: string       // گارانتی/ضمانت
  featured?: boolean      // نمایشِ ویژه در ویترین
}

function cleanProductPatch(input: any): Partial<Product> {
  const out: any = {}
  if (input.name !== undefined) out.name = String(input.name).slice(0, 160)
  if (input.category !== undefined) out.category = String(input.category).slice(0, 80)
  if (input.unit !== undefined) out.unit = String(input.unit).slice(0, 24)
  if (input.price !== undefined) out.price = Math.max(0, Number(input.price) || 0)
  if (input.stock !== undefined) out.stock = Math.max(0, Number(input.stock) || 0)
  if (input.threshold !== undefined) out.threshold = Math.max(0, Number(input.threshold) || 0)
  if (input.minOrder !== undefined) out.minOrder = Math.max(0, Number(input.minOrder) || 0)
  if (input.discountPct !== undefined) out.discountPct = Math.max(0, Math.min(90, Number(input.discountPct) || 0))
  if (input.deliveryDays !== undefined) out.deliveryDays = Math.max(0, Number(input.deliveryDays) || 0)
  if (input.brand !== undefined) out.brand = String(input.brand).slice(0, 80)
  if (input.origin !== undefined) out.origin = String(input.origin).slice(0, 80)
  if (input.warranty !== undefined) out.warranty = String(input.warranty).slice(0, 120)
  if (input.description !== undefined) out.description = String(input.description).slice(0, 4000)
  if (input.featured !== undefined) out.featured = !!input.featured
  if (input.active !== undefined) out.active = !!input.active
  if (Array.isArray(input.images)) out.images = input.images.slice(0, 12).map((s: any) => String(s).slice(0, 100000))
  if (Array.isArray(input.tags)) out.tags = input.tags.slice(0, 20).map((s: any) => String(s).slice(0, 40)).filter(Boolean)
  if (Array.isArray(input.specs)) out.specs = input.specs.slice(0, 40).map((s: any) => ({ key: String(s.key || '').slice(0, 60), value: String(s.value || '').slice(0, 120) })).filter((s: ProductSpec) => s.key && s.value)
  return out
}

export interface Order {
  id: string         // ORD-xxxx
  customer: string
  items: number      // تعداد اقلام
  amount: number     // مبلغ کل (تومان)
  status: OrderStatus
  createdAt: number
}

export interface Inquiry {
  id: string
  customer: string
  product: string
  qty: string
  note?: string
  status: InquiryStatus
  reply?: string
  createdAt: number
}

export interface MonthSale { month: string; amount: number } // مبلغ تومان (محاسبه‌شده از سفارش‌ها)

export interface Shop {
  profile: { name: string; rating: number }
  products: Product[]
  orders: Order[]
  inquiries: Inquiry[]
  slug?: string        // شناسهٔ عمومیِ ویترین (/forushgah/[slug])
  createdAt: number
}

interface DB { shops: Record<string, Shop> }

function id(p = '') { return p + randomBytes(5).toString('hex') }
function orderId() { return 'ORD-' + randomBytes(3).toString('hex').toUpperCase() }

function load(): DB {
  if (existsSync(DATA_FILE)) {
    try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {}
  }
  return { shops: {} }
}
function save(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

const ORDER_STATUSES: OrderStatus[] = ['pending', 'preparing', 'shipped', 'delivered', 'canceled']

// فروشگاهِ خالی — بدونِ هیچ دادهٔ نمونه/فیک. نامِ فروشگاه از حسابِ کاربر خوانده می‌شود.
function emptyShop(owner: string): Shop {
  const acc = getAccount(owner)
  return { profile: { name: acc?.name || '', rating: 0 }, products: [], orders: [], inquiries: [], createdAt: Date.now() }
}

function makeSlug(owner: string, db: DB): string {
  const taken = new Set(Object.values(db.shops).map(x => x.slug).filter(Boolean) as string[])
  // پایه از نامِ فروشگاه (لاتین/فارسی) یا «shop»؛ در صورتِ تکراری‌بودن پسوندِ کوتاه.
  const base = 'shop'
  let slug = base + '-' + randomBytes(3).toString('hex')
  while (taken.has(slug)) slug = base + '-' + randomBytes(3).toString('hex')
  return slug
}

export function getShop(owner: string): Shop {
  const db = load()
  let changed = false
  if (!db.shops[owner]) { db.shops[owner] = emptyShop(owner); changed = true }
  const s = db.shops[owner]
  if (!s.slug) { s.slug = makeSlug(owner, db); changed = true }
  // نامِ فروشگاه اگر خالی بود از حسابِ کاربر پر شود (بدونِ ذخیرهٔ اجباری).
  if (!s.profile.name) { const acc = getAccount(owner); if (acc?.name) s.profile.name = acc.name }
  if (changed) save(db)
  return s
}

// یافتنِ فروشگاه از روی slug عمومی → مالک (شمارهٔ تلفن) و فروشگاه.
export function shopBySlug(slug: string): { owner: string; shop: Shop } | null {
  const db = load()
  for (const [owner, shop] of Object.entries(db.shops)) {
    if (shop.slug === slug) return { owner, shop }
  }
  return null
}

// دادهٔ عمومیِ ویترین: برندینگ از profile-store + محصولاتِ فعال + امتیاز. بدونِ شماره تلفن.
export function publicShop(slug: string) {
  const found = shopBySlug(slug)
  if (!found) return null
  const { owner, shop } = found
  const p = getProfile(owner)
  const name = p.businessName || shop.profile.name || p.displayName || 'فروشگاه مصالح'
  return {
    slug,
    name,
    tagline: p.tagline || '',
    about: p.about || '',
    logo: p.logo || '',
    cover: p.cover || '',
    rating: shop.profile.rating || 0,
    city: p.city || '',
    province: p.province || '',
    address: p.address || '',
    workHours: p.workHours || '',
    website: p.website || '',
    email: p.email || '',
    social: p.social || {},
    specialties: p.specialties || [],
    services: p.services || [],
    areas: p.areas || [],
    establishedYear: p.establishedYear || '',
    hasPhone: !!(p.contactPhone || p.landline || owner),
    productCount: shop.products.filter(x => x.active).length,
    products: shop.products.filter(x => x.active),
  }
}

// شمارهٔ تماسِ عمومیِ فروشنده (فقط پس از ورودِ کاربر فراخوانی می‌شود).
export function shopPhone(slug: string): string | null {
  const found = shopBySlug(slug)
  if (!found) return null
  const p = getProfile(found.owner)
  return p.contactPhone || p.landline || found.owner || null
}

// استعلامِ عمومی از سمتِ خریدار روی ویترین → به پنلِ فروشنده اضافه می‌شود.
export function addPublicInquiry(slug: string, input: { customer: string; product: string; qty: string; note?: string }): Inquiry | null {
  const found = shopBySlug(slug)
  if (!found) return null
  return addInquiry(found.owner, input)
}

function mutate(owner: string, fn: (s: Shop) => void) {
  const db = load()
  if (!db.shops[owner]) db.shops[owner] = emptyShop(owner)
  fn(db.shops[owner])
  save(db)
  return db.shops[owner]
}

// ماه/سالِ شمسیِ یک زمان‌مُهر (برای گروه‌بندیِ فروش بر اساسِ ماه).
const FA_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
function faYearMonth(ts: number): { y: number; m: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric' }).formatToParts(new Date(ts))
    return { y: Number(parts.find(p => p.type === 'year')?.value) || 0, m: Number(parts.find(p => p.type === 'month')?.value) || 1 }
  } catch { return { y: 0, m: 1 } }
}
// نمودارِ فروشِ ۶ ماهه — از مبلغِ واقعیِ سفارش‌ها (به‌جز لغوشده‌ها) گروه‌بندی‌شده بر اساسِ ماهِ شمسی.
function computeMonthlySales(orders: Order[]): MonthSale[] {
  const now = faYearMonth(Date.now())
  const buckets: MonthSale[] = []
  const keyOf = (y: number, m: number) => y * 12 + (m - 1)
  const sums: Record<number, number> = {}
  for (const o of orders) {
    if (o.status === 'canceled') continue
    const ym = faYearMonth(o.createdAt)
    if (!ym.y) continue
    sums[keyOf(ym.y, ym.m)] = (sums[keyOf(ym.y, ym.m)] || 0) + (o.amount || 0)
  }
  const curKey = keyOf(now.y, now.m)
  for (let off = 5; off >= 0; off--) {
    const k = curKey - off
    const m = ((k % 12) + 12) % 12
    buckets.push({ month: FA_MONTHS[m], amount: sums[k] || 0 })
  }
  return buckets
}

// ---- آمار داشبورد (محاسبه‌شده، نه ثابت) ----
export function shopStats(owner: string) {
  const s = getShop(owner)
  const activeProducts = s.products.filter(p => p.active)
  const lowStock = activeProducts.filter(p => p.stock <= p.threshold)
  const newInquiries = s.inquiries.filter(q => q.status === 'new')
  const activeOrders = s.orders.filter(o => o.status === 'pending' || o.status === 'preparing' || o.status === 'shipped')
  const awaitingShip = s.orders.filter(o => o.status === 'pending' || o.status === 'preparing')

  // دسته‌های پرفروش بر اساس درآمد (price × sold)
  const byCat: Record<string, number> = {}
  for (const p of s.products) byCat[p.category] = (byCat[p.category] || 0) + p.price * p.sold
  const totalCat = Object.values(byCat).reduce((a, b) => a + b, 0) || 1
  const categories = Object.entries(byCat)
    .map(([label, rev]) => ({ label, pct: Math.round((rev / totalCat) * 100) }))
    .sort((a, b) => b.pct - a.pct)

  const months = computeMonthlySales(s.orders)
  const thisMonth = months.length ? months[months.length - 1].amount : 0
  const prevMonth = months.length > 1 ? months[months.length - 2].amount : 0
  const monthChange = prevMonth ? Math.round(((thisMonth - prevMonth) / prevMonth) * 100) : 0
  const sixMonthTotal = months.reduce((a, m) => a + m.amount, 0)

  return {
    profile: s.profile,
    slug: s.slug || '',
    kpis: {
      activeProducts: activeProducts.length,
      lowStockCount: lowStock.length,
      newInquiries: newInquiries.length,
      activeOrders: activeOrders.length,
      awaitingShip: awaitingShip.length,
      thisMonthSales: thisMonth,
      monthChange,
    },
    categories,
    monthlySales: months,
    sixMonthTotal,
    lowStock: lowStock.map(p => ({ id: p.id, name: p.name, stock: p.stock, unit: p.unit })),
    recentOrders: [...s.orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6),
  }
}

// ---- محصولات ----
export function addProduct(owner: string, input: any): Product {
  let created!: Product
  mutate(owner, s => {
    const c = cleanProductPatch(input)
    const stock = c.stock ?? 0
    created = {
      id: id('p_'), name: c.name || '', category: c.category || 'سایر', price: c.price ?? 0,
      unit: c.unit || 'عدد', stock, threshold: c.threshold ?? Math.max(1, Math.round(stock * 0.15)),
      sold: 0, active: c.active ?? true, createdAt: Date.now(),
      brand: c.brand, origin: c.origin, description: c.description, images: c.images, specs: c.specs,
      tags: c.tags, minOrder: c.minOrder, discountPct: c.discountPct, deliveryDays: c.deliveryDays,
      warranty: c.warranty, featured: c.featured,
    }
    s.products.unshift(created)
  })
  return created
}
export function updateProduct(owner: string, productId: string, patch: any): Product | null {
  let result: Product | null = null
  mutate(owner, s => {
    const p = s.products.find(x => x.id === productId)
    if (!p) return
    Object.assign(p, cleanProductPatch(patch))
    result = p
  })
  return result
}
export function deleteProduct(owner: string, productId: string) {
  mutate(owner, s => { s.products = s.products.filter(p => p.id !== productId) })
}
export function restock(owner: string, productId: string, qty: number): Product | null {
  let result: Product | null = null
  mutate(owner, s => {
    const p = s.products.find(x => x.id === productId)
    if (!p) return
    p.stock += Math.max(0, qty)
    result = p
  })
  return result
}

// ---- سفارش‌ها ----
// ثبتِ سفارش. اگر «lines» (اقلامِ محصول) داده شود، موجودی کم و «فروخته‌شده» زیاد می‌شود
// و مبلغ از قیمتِ محصول×تعداد محاسبه می‌گردد — پس نمودارِ فروش/دسته‌ها همه واقعی می‌شوند.
export function addOrder(owner: string, input: { customer: string; items?: number; amount?: number; status?: OrderStatus; lines?: { productId: string; qty: number }[] }): Order {
  let created!: Order
  mutate(owner, s => {
    let amount = input.amount || 0
    let items = input.items || 0
    if (input.lines && input.lines.length) {
      amount = 0; items = 0
      for (const ln of input.lines) {
        const p = s.products.find(x => x.id === ln.productId)
        const qty = Math.max(0, Number(ln.qty) || 0)
        if (!p || qty <= 0) continue
        amount += p.price * qty
        items += 1
        p.stock = Math.max(0, p.stock - qty)
        p.sold += qty
      }
      if (input.amount) amount = input.amount   // اگر مبلغ دستی داده شده، همان ملاک است
    }
    created = { id: orderId(), customer: input.customer, items: items || 1, amount, status: input.status && ORDER_STATUSES.includes(input.status) ? input.status : 'pending', createdAt: Date.now() }
    s.orders.unshift(created)
  })
  return created
}
export function setOrderStatus(owner: string, orderId: string, status: OrderStatus): Order | null {
  if (!ORDER_STATUSES.includes(status)) return null
  let result: Order | null = null
  mutate(owner, s => {
    const o = s.orders.find(x => x.id === orderId)
    if (!o) return
    o.status = status
    result = o
  })
  return result
}

// ---- استعلام‌ها ----
export function addInquiry(owner: string, input: { customer: string; product: string; qty: string; note?: string }): Inquiry {
  let created!: Inquiry
  mutate(owner, s => {
    created = { id: id('q_'), customer: input.customer, product: input.product, qty: input.qty, note: input.note, status: 'new', createdAt: Date.now() }
    s.inquiries.unshift(created)
  })
  return created
}
export function answerInquiry(owner: string, inquiryId: string, reply: string): Inquiry | null {
  let result: Inquiry | null = null
  mutate(owner, s => {
    const q = s.inquiries.find(x => x.id === inquiryId)
    if (!q) return
    q.status = 'answered'; q.reply = reply
    result = q
  })
  return result
}

export function listProducts(owner: string) { return getShop(owner).products }
export function listOrders(owner: string) { return getShop(owner).orders }
export function listInquiries(owner: string) { return getShop(owner).inquiries }
export function updateProfile(owner: string, patch: Partial<Shop['profile']>) {
  return mutate(owner, s => { Object.assign(s.profile, patch) }).profile
}
