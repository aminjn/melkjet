import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'

// استور پنل «مالک/فروشنده» — per-owner (مثل materials-store). هر کاربر فقط دادهٔ خودش.
// دومَحاله: اگر DATABASE_URL ست باشد → Postgres (نوشتنِ اتمیک)، وگرنه فایل.
const DATA_FILE = join(process.cwd(), '.owner-data.json')
const KV_KEY = 'owner'

export type DealType = 'sale' | 'rent'
export type PropStatus = 'active' | 'sold' | 'rented' | 'draft'
export type InquiryStatus = 'new' | 'contacted' | 'closed'
export type ViewingStatus = 'scheduled' | 'done' | 'canceled'
export type OfferStatus = 'pending' | 'accepted' | 'rejected'

export interface Property {
  id: string
  title: string
  ptype: string        // آپارتمان / ویلا / زمین / مغازه …
  location: string
  area: number         // متر
  rooms: number
  price: number        // تومان (برای اجاره: ودیعه)
  deal: DealType
  status: PropStatus
  views: number
  createdAt: number
}
export interface Inquiry {
  id: string; propertyId: string; name: string; phone?: string; message?: string
  status: InquiryStatus; createdAt: number
}
export interface Viewing {
  id: string; propertyId: string; visitor: string; phone?: string; date: string
  status: ViewingStatus; createdAt: number
}
export interface Offer {
  id: string; propertyId: string; buyer: string; phone?: string; amount: number
  status: OfferStatus; createdAt: number
}
export interface MonthViews { month: string; count: number }

export interface OwnerData {
  profile: { name: string }
  properties: Property[]
  inquiries: Inquiry[]
  viewings: Viewing[]
  offers: Offer[]
  monthlyViews: MonthViews[]
  createdAt: number
}

interface DB { owners: Record<string, OwnerData> }

function id(p = '') { return p + randomBytes(5).toString('hex') }
function fileLoad(): DB {
  if (existsSync(DATA_FILE)) { try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {} }
  return { owners: {} }
}
function fileSave(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, { owners: {} }) : fileLoad() }
// wrapperِ عمومیِ خواندن-تغییر-نوشتن (نامش withDb تا با mutate(owner) پایین تداخل نکند)
async function withDb<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, { owners: {} }, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

const PROP_STATUSES: PropStatus[] = ['active', 'sold', 'rented', 'draft']

// حسابِ مالک خالی شروع می‌شود — هیچ دادهٔ نمونه/فیک نیست؛ همه‌چیز همان است که خودِ مالک ثبت می‌کند.
function seed(): OwnerData {
  return { profile: { name: '' }, properties: [], inquiries: [], viewings: [], offers: [], monthlyViews: [], createdAt: Date.now() }
}

// آیا این دادهٔ ذخیره‌شده همان نمونهٔ قدیمیِ دست‌نخورده است؟ (برای پاک‌سازیِ خودکار)
function isLegacyDemo(d: OwnerData): boolean {
  return d?.profile?.name === 'محمد رضایی' && (d.properties || []).some(p => p.title === 'آپارتمان نوساز سعادت‌آباد') && (d.inquiries || []).some(q => q.phone === '09120000001')
}
function applyOwner(db: DB, o: string): boolean {
  if (!db.owners[o]) { db.owners[o] = seed(); return true }
  if (isLegacyDemo(db.owners[o])) { db.owners[o] = seed(); return true }   // پاک‌سازیِ خودکارِ دادهٔ نمونهٔ قدیمی
  return false
}

export async function getOwner(owner: string): Promise<OwnerData> {
  const db = await load()
  // اگر seed/پاک‌سازی لازم نبود، بدونِ نوشتن برگردان (مثلِ قبل که فقط وقتی جدید بود ذخیره می‌شد).
  if (!applyOwner(db, owner)) return db.owners[owner]
  return withDb(d => { applyOwner(d, owner); return d.owners[owner] })
}
async function mutate(owner: string, fn: (o: OwnerData) => void): Promise<OwnerData> {
  return withDb(db => { if (!db.owners[owner]) db.owners[owner] = seed(); fn(db.owners[owner]); return db.owners[owner] })
}

export async function ownerStats(owner: string) {
  const o = await getOwner(owner)
  const active = o.properties.filter(p => p.status === 'active')
  const newInquiries = o.inquiries.filter(q => q.status === 'new')
  const upcomingViewings = o.viewings.filter(v => v.status === 'scheduled')
  const pendingOffers = o.offers.filter(x => x.status === 'pending')
  const totalViews = o.properties.reduce((a, p) => a + p.views, 0)
  const months = o.monthlyViews
  const thisMonth = months.length ? months[months.length - 1].count : 0
  const prev = months.length > 1 ? months[months.length - 2].count : 0
  const monthChange = prev ? Math.round(((thisMonth - prev) / prev) * 100) : 0
  // ارزش پورتفوی (مجموع قیمتِ ملک‌های فعالِ فروشی)
  const portfolio = o.properties.filter(p => p.deal === 'sale').reduce((a, p) => a + p.price, 0)
  return {
    profile: o.profile,
    kpis: {
      activeCount: active.length,
      totalProps: o.properties.length,
      newInquiries: newInquiries.length,
      upcomingViewings: upcomingViewings.length,
      pendingOffers: pendingOffers.length,
      monthViews: thisMonth, monthChange, totalViews,
      portfolio,
    },
    monthlyViews: months,
    recentInquiries: [...o.inquiries].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6),
    upcoming: [...upcomingViewings].slice(0, 6),
  }
}

// عنوانِ ملک از روی id (برای نمایش در لیست‌ها)
export async function propTitle(owner: string, propertyId: string) {
  return (await getOwner(owner)).properties.find(p => p.id === propertyId)?.title || '—'
}

// ---- Properties ----
export async function addProperty(owner: string, input: Partial<Property>): Promise<Property> {
  let created!: Property
  await mutate(owner, o => {
    created = {
      id: id('p_'), title: String(input.title || 'ملک جدید'), ptype: String(input.ptype || 'آپارتمان'),
      location: String(input.location || ''), area: Number(input.area) || 0, rooms: Number(input.rooms) || 0,
      price: Number(input.price) || 0, deal: input.deal === 'rent' ? 'rent' : 'sale',
      status: PROP_STATUSES.includes(input.status as PropStatus) ? input.status as PropStatus : 'active',
      views: 0, createdAt: Date.now(),
    }
    o.properties.unshift(created)
  })
  return created
}
export async function updateProperty(owner: string, pid: string, patch: Partial<Property>): Promise<Property | null> {
  let res: Property | null = null
  await mutate(owner, o => { const p = o.properties.find(x => x.id === pid); if (!p) return; Object.assign(p, patch); res = p })
  return res
}
export async function deleteProperty(owner: string, pid: string): Promise<void> {
  await mutate(owner, o => { o.properties = o.properties.filter(p => p.id !== pid) })
}

// ---- Inquiries ----
export async function setInquiryStatus(owner: string, qid: string, status: InquiryStatus): Promise<Inquiry | null> {
  let res: Inquiry | null = null
  await mutate(owner, o => { const q = o.inquiries.find(x => x.id === qid); if (!q) return; q.status = status; res = q })
  return res
}
export async function addInquiry(owner: string, input: { propertyId: string; name: string; phone?: string; message?: string }): Promise<Inquiry> {
  let created!: Inquiry
  await mutate(owner, o => { created = { id: id('q_'), propertyId: input.propertyId, name: input.name, phone: input.phone, message: input.message, status: 'new', createdAt: Date.now() }; o.inquiries.unshift(created) })
  return created
}

// ---- Viewings ----
export async function setViewingStatus(owner: string, vid: string, status: ViewingStatus): Promise<Viewing | null> {
  let res: Viewing | null = null
  await mutate(owner, o => { const v = o.viewings.find(x => x.id === vid); if (!v) return; v.status = status; res = v })
  return res
}
export async function addViewing(owner: string, input: { propertyId: string; visitor: string; phone?: string; date: string }): Promise<Viewing> {
  let created!: Viewing
  await mutate(owner, o => { created = { id: id('v_'), propertyId: input.propertyId, visitor: input.visitor, phone: input.phone, date: input.date, status: 'scheduled', createdAt: Date.now() }; o.viewings.unshift(created) })
  return created
}

// ---- Offers ----
export async function setOfferStatus(owner: string, oid: string, status: OfferStatus): Promise<Offer | null> {
  let res: Offer | null = null
  await mutate(owner, o => { const of = o.offers.find(x => x.id === oid); if (!of) return; of.status = status; res = of })
  return res
}

export async function listProperties(owner: string): Promise<Property[]> { return (await getOwner(owner)).properties }
export async function listInquiries(owner: string): Promise<Inquiry[]> { return (await getOwner(owner)).inquiries }
export async function listViewings(owner: string): Promise<Viewing[]> { return (await getOwner(owner)).viewings }
export async function listOffers(owner: string): Promise<Offer[]> { return (await getOwner(owner)).offers }
export async function updateOwnerProfile(owner: string, patch: Partial<OwnerData['profile']>): Promise<OwnerData['profile']> {
  return (await mutate(owner, o => { Object.assign(o.profile, patch) })).profile
}
