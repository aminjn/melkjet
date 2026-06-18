import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// Per-owner (per-profile) store for the «بازار مصالح» seller dashboard.
// Mirrors the file-based persistence style of builder-store.ts / crm-store.ts.
// Every shop is keyed by the owner's phone, so each profile sees only its own.
const DATA_FILE = join(process.cwd(), '.materials-data.json')

export type OrderStatus = 'pending' | 'preparing' | 'shipped' | 'delivered' | 'canceled'
export type InquiryStatus = 'new' | 'answered'

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

export interface MonthSale { month: string; amount: number } // مبلغ تومان

export interface Shop {
  profile: { name: string; rating: number }
  products: Product[]
  orders: Order[]
  inquiries: Inquiry[]
  monthlySales: MonthSale[]
  createdAt: number
}

interface DB { shops: Record<string, Shop> }

function id(p = '') { return p + randomBytes(5).toString('hex') }
function orderId() { return 'ORD-' + (8400 + Math.floor(Math.random() * 600)) }

function load(): DB {
  if (existsSync(DATA_FILE)) {
    try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {}
  }
  return { shops: {} }
}
function save(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

const ORDER_STATUSES: OrderStatus[] = ['pending', 'preparing', 'shipped', 'delivered', 'canceled']

// دادهٔ نمونهٔ اولیه برای هر فروشگاه جدید تا داشبورد خالی نباشد (مثل seed سازنده).
function seedShop(): Shop {
  const now = Date.now()
  const day = 86400000
  const p = (name: string, category: string, price: number, unit: string, stock: number, threshold: number, sold: number): Product =>
    ({ id: id('p_'), name, category, price, unit, stock, threshold, sold, active: true, createdAt: now })
  const products: Product[] = [
    p('میلگرد آجدار ۱۶', 'آهن و میلگرد', 38000000, 'تن', 1.2, 5, 142),
    p('تیرآهن ۱۴', 'آهن و میلگرد', 42000000, 'شاخه', 64, 20, 88),
    p('نبشی ۱۰', 'آهن و میلگرد', 31000000, 'تن', 18, 8, 51),
    p('سیمان تیپ ۲ کیسه‌ای', 'سیمان و گچ', 95000, 'کیسه', 80, 200, 4200),
    p('گچ سفیدکاری', 'سیمان و گچ', 60000, 'کیسه', 540, 150, 1600),
    p('پودر سنگ', 'سیمان و گچ', 45000, 'کیسه', 320, 100, 900),
    p('کاشی ۶۰×۶۰ کرم', 'کاشی و سرامیک', 320000, 'متر', 40, 100, 920),
    p('سرامیک کف طوسی', 'کاشی و سرامیک', 280000, 'متر', 760, 200, 680),
    p('کاشی دیوار سفید', 'کاشی و سرامیک', 240000, 'متر', 410, 150, 530),
    p('شیر اهرمی روشویی', 'شیرآلات', 1800000, 'عدد', 120, 40, 310),
    p('شیر مخلوط آشپزخانه', 'شیرآلات', 2400000, 'عدد', 86, 30, 240),
    p('شیر توالت', 'شیرآلات', 1500000, 'عدد', 150, 40, 180),
  ]
  const o = (cust: string, items: number, amount: number, status: OrderStatus, ageDays: number): Order =>
    ({ id: orderId(), customer: cust, items, amount, status, createdAt: now - ageDays * day })
  const orders: Order[] = [
    o('گروه آرین', 3, 84000000, 'shipped', 1),
    o('پیمانکاری دلتا', 7, 142000000, 'preparing', 2),
    o('مجتمع نگین', 2, 36000000, 'delivered', 4),
    o('ساختمانی پارس', 5, 98000000, 'pending', 6),
    o('عمران شهر', 4, 61000000, 'shipped', 8),
    o('برج‌سازان البرز', 6, 120000000, 'delivered', 11),
    o('پیمانکاری دلتا', 2, 28000000, 'preparing', 13),
  ]
  const inq = (cust: string, product: string, qty: string): Inquiry =>
    ({ id: id('q_'), customer: cust, product, qty, status: 'new', createdAt: now })
  const inquiries: Inquiry[] = [
    inq('شرکت عمران پارس', 'سیمان تیپ ۲', '۵۰۰ تن'),
    inq('پیمانکاری دلتا', 'میلگرد آجدار ۱۶', '۲۰ تن'),
    inq('مجتمع نگین', 'کاشی ۶۰×۶۰', '۳۰۰ متر'),
    inq('ساختمانی پارس', 'شیرآلات', '۴۰ عدد'),
    inq('گروه آرین', 'گچ سفیدکاری', '۲۰۰ کیسه'),
  ]
  const monthlySales: MonthSale[] = [
    { month: 'آذر', amount: 480000000 },
    { month: 'دی', amount: 500000000 },
    { month: 'بهمن', amount: 520000000 },
    { month: 'اسفند', amount: 560000000 },
    { month: 'فروردین', amount: 517000000 },
    { month: 'اردیبهشت', amount: 610000000 },
  ]
  return { profile: { name: 'بازار مصالح کیان', rating: 4.8 }, products, orders, inquiries, monthlySales, createdAt: now }
}

export function getShop(owner: string): Shop {
  const db = load()
  if (!db.shops[owner]) { db.shops[owner] = seedShop(); save(db) }
  return db.shops[owner]
}

function mutate(owner: string, fn: (s: Shop) => void) {
  const db = load()
  if (!db.shops[owner]) db.shops[owner] = seedShop()
  fn(db.shops[owner])
  save(db)
  return db.shops[owner]
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

  const months = s.monthlySales
  const thisMonth = months.length ? months[months.length - 1].amount : 0
  const prevMonth = months.length > 1 ? months[months.length - 2].amount : 0
  const monthChange = prevMonth ? Math.round(((thisMonth - prevMonth) / prevMonth) * 100) : 0
  const sixMonthTotal = months.reduce((a, m) => a + m.amount, 0)

  return {
    profile: s.profile,
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
export function addProduct(owner: string, input: { name: string; category: string; price: number; unit: string; stock: number; threshold?: number }): Product {
  let created!: Product
  mutate(owner, s => {
    created = { id: id('p_'), name: input.name, category: input.category, price: input.price, unit: input.unit, stock: input.stock, threshold: input.threshold ?? Math.max(1, Math.round(input.stock * 0.15)), sold: 0, active: true, createdAt: Date.now() }
    s.products.unshift(created)
  })
  return created
}
export function updateProduct(owner: string, productId: string, patch: Partial<Omit<Product, 'id' | 'createdAt'>>): Product | null {
  let result: Product | null = null
  mutate(owner, s => {
    const p = s.products.find(x => x.id === productId)
    if (!p) return
    Object.assign(p, patch)
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
export function addOrder(owner: string, input: { customer: string; items: number; amount: number; status?: OrderStatus }): Order {
  let created!: Order
  mutate(owner, s => {
    created = { id: orderId(), customer: input.customer, items: input.items, amount: input.amount, status: input.status && ORDER_STATUSES.includes(input.status) ? input.status : 'pending', createdAt: Date.now() }
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
