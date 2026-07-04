import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { getAccount } from './account-store'
import { getProfile } from './profile-store'
import { getProduct as getCatalogProduct, listCategories as listCatalogCategories } from './catalog-store'
import { pgEnabled, kvGet, kvMutate } from './db'

// Per-owner (per-profile) store for the «بازار مصالح» seller dashboard.
// دومَحاله: اگر DATABASE_URL ست باشد → Postgres (نوشتنِ اتمیک)، وگرنه فایل.
// Every shop is keyed by the owner's phone, so each profile sees only its own.
const DATA_FILE = join(process.cwd(), '.materials-data.json')
const KV_KEY = 'materials'

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
  catalogId?: string      // ارجاع به کالای مرجعِ کاتالوگ (برای یکدستیِ نام/دسته)
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

function fileLoad(): DB {
  if (existsSync(DATA_FILE)) {
    try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {}
  }
  return { shops: {} }
}
function fileSave(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, { shops: {} }) : fileLoad() }
// wrapperِ عمومیِ خواندن-تغییر-نوشتن (نامش withDb تا با mutate(owner) پایین تداخل نکند)
async function withDb<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, { shops: {} }, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

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

// seed/backfill را روی db برای مالکِ owner اعمال می‌کند؛ برمی‌گرداند که آیا چیزی تغییر کرد (نیاز به ذخیره).
function applyShop(db: DB, owner: string): boolean {
  let changed = false
  if (!db.shops[owner]) { db.shops[owner] = emptyShop(owner); changed = true }
  const s = db.shops[owner]
  if (!s.slug) { s.slug = makeSlug(owner, db); changed = true }
  // نامِ فروشگاه اگر خالی بود از حسابِ کاربر پر شود (بدونِ ذخیرهٔ اجباری).
  if (!s.profile.name) { const acc = getAccount(owner); if (acc?.name) s.profile.name = acc.name }
  return changed
}

export async function getShop(owner: string): Promise<Shop> {
  const db = await load()
  // اگر seed/backfill لازم نبود، بدونِ نوشتن برگردان (مثلِ قبل که فقط وقتی changed بود ذخیره می‌شد).
  if (!applyShop(db, owner)) return db.shops[owner]
  return withDb(d => { applyShop(d, owner); return d.shops[owner] })
}

// خواندنیِ فقط‌خواندنی برای سایتِ منتشرشده (بدونِ ساختِ فروشگاهِ جدید).
export async function shopProductsOf(owner: string): Promise<{ products: Product[]; slug: string; name: string } | null> {
  const db = await load()
  const shop = db.shops[owner]
  if (!shop) return null
  const p = getProfile(owner)
  return { products: shop.products.filter(x => x.active), slug: shop.slug || '', name: p.businessName || shop.profile.name || 'فروشگاه مصالح' }
}

// یافتنِ فروشگاه از روی slug عمومی → مالک (شمارهٔ تلفن) و فروشگاه.
export async function shopBySlug(slug: string): Promise<{ owner: string; shop: Shop } | null> {
  const db = await load()
  for (const [owner, shop] of Object.entries(db.shops)) {
    if (shop.slug === slug) return { owner, shop }
  }
  return null
}

// دادهٔ عمومیِ ویترین: برندینگ از profile-store + محصولاتِ فعال + امتیاز. بدونِ شماره تلفن.
export async function publicShop(slug: string) {
  const found = await shopBySlug(slug)
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
export async function shopPhone(slug: string): Promise<string | null> {
  const found = await shopBySlug(slug)
  if (!found) return null
  const p = getProfile(found.owner)
  return p.contactPhone || p.landline || found.owner || null
}

// استعلامِ عمومی از سمتِ خریدار روی ویترین → به پنلِ فروشنده اضافه می‌شود.
export async function addPublicInquiry(slug: string, input: { customer: string; product: string; qty: string; note?: string }): Promise<Inquiry | null> {
  const found = await shopBySlug(slug)
  if (!found) return null
  const q = await addInquiry(found.owner, input)
  // استعلامِ عمومیِ خریدار روی ویترینِ مصالح → لیدِ خودکار در CRMِ فروشنده (منطبق با پروفایلش).
  try {
    const { createAutoLead } = require('./auto-lead') as typeof import('./auto-lead')
    await createAutoLead(found.owner, {
      name: input.customer || 'مشتری',
      need: input.product,
      note: `استعلامِ «${input.product}»${input.qty ? ` — تعداد: ${input.qty}` : ''}${input.note ? ` — ${input.note}` : ''}`,
      source: 'استعلامِ ویترین',
    })
  } catch { /* ساختِ لید نباید مسیرِ اصلی را بشکند */ }
  return q
}

function normName(s: string): string { return (s || '').replace(/‌/g, '').replace(/\s+/g, ' ').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim() }

// تعدادِ فروشندهٔ هر کالای مرجع (برای نشانِ «بدون فروشنده / N فروشنده» در نرخِ روز).
export async function sellerCountsByCatalog(): Promise<Record<string, number>> {
  const db = await load(); const out: Record<string, number> = {}
  for (const shop of Object.values(db.shops)) if (shop.slug) for (const p of shop.products) if (p.active && p.catalogId) out[p.catalogId] = (out[p.catalogId] || 0) + 1
  return out
}

// فروشندگانِ یک کالای مرجع (کاتالوگ) — برای صفحهٔ محصولِ عمومی و مقایسهٔ قیمت.
export async function sellersOfCatalog(catalogId: string) {
  const db = await load()
  const out: { slug: string; name: string; logo: string; city: string; rating: number; price: number; discountPct: number; stock: number; unit: string }[] = []
  for (const [owner, shop] of Object.entries(db.shops)) {
    if (!shop.slug) continue
    for (const p of shop.products) {
      if (!p.active || p.catalogId !== catalogId) continue
      const prof = getProfile(owner)
      out.push({
        slug: shop.slug, name: prof.businessName || shop.profile.name || 'فروشگاه مصالح',
        logo: prof.logo || '', city: prof.city || '', rating: shop.profile.rating || 0,
        price: Math.round(p.price * (1 - (p.discountPct || 0) / 100)), discountPct: p.discountPct || 0,
        stock: p.stock, unit: p.unit,
      })
    }
  }
  return out.sort((a, b) => a.price - b.price)
}

// ── دایرکتوریِ عمومیِ همهٔ فروشگاه‌های مصالح (برای دیده‌شدنِ کامل) ──
export async function listPublicShops(opts?: { city?: string; category?: string; search?: string }) {
  const db = await load()
  const out: any[] = []
  for (const [owner, shop] of Object.entries(db.shops)) {
    if (!shop.slug) continue
    const active = shop.products.filter(p => p.active)
    const prof = getProfile(owner)
    const name = prof.businessName || shop.profile.name || prof.displayName || ''
    if (active.length === 0 && !name) continue   // فروشگاهِ کاملاً خالی را نشان نده
    const categories = Array.from(new Set(active.map(x => x.category).filter(Boolean)))
    out.push({
      slug: shop.slug, name: name || 'فروشگاه مصالح', tagline: prof.tagline || '',
      logo: prof.logo || '', cover: prof.cover || '', city: prof.city || '', province: prof.province || '',
      rating: shop.profile.rating || 0, productCount: active.length, categories,
      minPrice: active.length ? Math.min(...active.map(p => Math.round(p.price * (1 - (p.discountPct || 0) / 100))).filter(Boolean)) : 0,
    })
  }
  let rows = out
  if (opts?.city) { const c = normName(opts.city); rows = rows.filter(r => normName(r.city).includes(c) || c.includes(normName(r.city))) }
  if (opts?.category) { const g = normName(opts.category); rows = rows.filter(r => r.categories.some((x: string) => normName(x).includes(g))) }
  if (opts?.search) { const q = normName(opts.search); rows = rows.filter(r => normName(r.name).includes(q) || r.categories.some((x: string) => normName(x).includes(q))) }
  return rows.sort((a, b) => b.productCount - a.productCount || b.rating - a.rating)
}

export async function publicShopFacets() {
  const rows = await listPublicShops()
  const cities = Array.from(new Set(rows.map(r => r.city).filter(Boolean)))
  const cats = new Map<string, number>()
  for (const r of rows) for (const c of r.categories) cats.set(c, (cats.get(c) || 0) + 1)
  return { cities, categories: [...cats.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })), shopCount: rows.length }
}

// ── نرخِ روزِ مصالح: تجمیعِ قیمتِ محصولاتِ فعالِ همهٔ فروشگاه‌ها بر اساسِ نامِ کالا ──
export async function materialPriceIndex(opts?: { category?: string; search?: string }) {
  const db = await load()
  const byKey = new Map<string, { name: string; category: string; unit: string; prices: number[]; sellers: Set<string>; lastAt: number }>()
  for (const [owner, shop] of Object.entries(db.shops)) {
    for (const p of shop.products) {
      const price = Math.round(p.price * (1 - (p.discountPct || 0) / 100))
      if (!p.active || price <= 0) continue
      const key = normName(p.name) + '|' + normName(p.unit)
      const e = byKey.get(key) || { name: p.name, category: p.category || 'سایر', unit: p.unit || '', prices: [], sellers: new Set<string>(), lastAt: 0 }
      e.prices.push(price); e.sellers.add(owner); e.lastAt = Math.max(e.lastAt, p.createdAt || 0)
      byKey.set(key, e)
    }
  }
  let rows = [...byKey.values()].map(e => {
    const sorted = [...e.prices].sort((a, b) => a - b)
    return {
      name: e.name, category: e.category, unit: e.unit,
      min: sorted[0], max: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)],
      avg: Math.round(e.prices.reduce((a, b) => a + b, 0) / e.prices.length),
      sellers: e.sellers.size, count: e.prices.length, lastAt: e.lastAt,
    }
  })
  if (opts?.category && opts.category !== 'همه') { const g = normName(opts.category); rows = rows.filter(r => normName(r.category).includes(g)) }
  if (opts?.search) { const q = normName(opts.search); rows = rows.filter(r => normName(r.name).includes(q)) }
  rows.sort((a, b) => b.sellers - a.sellers || b.count - a.count)
  const categories = Array.from(new Set([...byKey.values()].map(e => e.category)))
  return { rows, categories, updatedAt: rows.reduce((m, r) => Math.max(m, r.lastAt), 0) }
}

async function mutate(owner: string, fn: (s: Shop) => void): Promise<Shop> {
  return withDb(db => { if (!db.shops[owner]) db.shops[owner] = emptyShop(owner); fn(db.shops[owner]); return db.shops[owner] })
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
export async function shopStats(owner: string) {
  const s = await getShop(owner)
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
export async function addProduct(owner: string, input: any): Promise<Product> {
  let created!: Product
  await mutate(owner, s => {
    const c = cleanProductPatch(input)
    // اگر از کاتالوگِ مرجع انتخاب شده، مشخصاتِ پایه (نام/دسته/برند/مشخصات/توضیح/عکس) از همان
    // کالای مرجع می‌آید تا نام و دسته یکدست بماند؛ فروشنده فقط قیمت/موجودی/تخفیف را می‌دهد.
    let catalogId: string | undefined
    let base: Partial<Product> = {}
    if (input.catalogId) {
      const cp = getCatalogProduct(String(input.catalogId))
      if (cp) {
        catalogId = cp.id
        base = {
          name: cp.name, category: catNameOf(cp.categoryId), unit: cp.unit || c.unit || 'عدد',
          brand: cp.brand, description: cp.description, specs: cp.specs, tags: cp.tags,
          images: (c.images && c.images.length) ? c.images : (cp.image ? [cp.image] : []),
        }
      }
    }
    const stock = c.stock ?? 0
    created = {
      id: id('p_'),
      name: base.name || c.name || '', category: base.category || c.category || 'سایر', price: c.price ?? 0,
      unit: base.unit || c.unit || 'عدد', stock, threshold: c.threshold ?? Math.max(1, Math.round(stock * 0.15)),
      sold: 0, active: c.active ?? true, createdAt: Date.now(),
      brand: base.brand ?? c.brand, origin: c.origin, description: base.description ?? c.description,
      images: base.images ?? c.images, specs: base.specs ?? c.specs, tags: base.tags ?? c.tags,
      minOrder: c.minOrder, discountPct: c.discountPct, deliveryDays: c.deliveryDays,
      warranty: c.warranty, featured: c.featured, catalogId,
    }
    s.products.unshift(created)
  })
  return created
}
function catNameOf(categoryId: string): string {
  return listCatalogCategories().find(c => c.id === categoryId)?.name || 'سایر'
}
export async function updateProduct(owner: string, productId: string, patch: any): Promise<Product | null> {
  let result: Product | null = null
  await mutate(owner, s => {
    const p = s.products.find(x => x.id === productId)
    if (!p) return
    Object.assign(p, cleanProductPatch(patch))
    result = p
  })
  return result
}
export async function deleteProduct(owner: string, productId: string): Promise<void> {
  await mutate(owner, s => { s.products = s.products.filter(p => p.id !== productId) })
}
export async function restock(owner: string, productId: string, qty: number): Promise<Product | null> {
  let result: Product | null = null
  await mutate(owner, s => {
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
export async function addOrder(owner: string, input: { customer: string; items?: number; amount?: number; status?: OrderStatus; lines?: { productId: string; qty: number }[] }): Promise<Order> {
  let created!: Order
  await mutate(owner, s => {
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
export async function setOrderStatus(owner: string, orderId: string, status: OrderStatus): Promise<Order | null> {
  if (!ORDER_STATUSES.includes(status)) return null
  let result: Order | null = null
  await mutate(owner, s => {
    const o = s.orders.find(x => x.id === orderId)
    if (!o) return
    o.status = status
    result = o
  })
  return result
}

// ---- استعلام‌ها ----
export async function addInquiry(owner: string, input: { customer: string; product: string; qty: string; note?: string }): Promise<Inquiry> {
  let created!: Inquiry
  await mutate(owner, s => {
    created = { id: id('q_'), customer: input.customer, product: input.product, qty: input.qty, note: input.note, status: 'new', createdAt: Date.now() }
    s.inquiries.unshift(created)
  })
  return created
}
export async function answerInquiry(owner: string, inquiryId: string, reply: string): Promise<Inquiry | null> {
  let result: Inquiry | null = null
  await mutate(owner, s => {
    const q = s.inquiries.find(x => x.id === inquiryId)
    if (!q) return
    q.status = 'answered'; q.reply = reply
    result = q
  })
  return result
}

export async function listProducts(owner: string) { return (await getShop(owner)).products }
export async function listOrders(owner: string) { return (await getShop(owner)).orders }
export async function listInquiries(owner: string) { return (await getShop(owner)).inquiries }
export async function updateProfile(owner: string, patch: Partial<Shop['profile']>) {
  return (await mutate(owner, s => { Object.assign(s.profile, patch) })).profile
}
