import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// استور پنل «مالک/فروشنده» — per-owner (مثل materials-store). هر کاربر فقط دادهٔ خودش.
const DATA_FILE = join(process.cwd(), '.owner-data.json')

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
function load(): DB {
  if (existsSync(DATA_FILE)) { try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {} }
  return { owners: {} }
}
function save(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

const PROP_STATUSES: PropStatus[] = ['active', 'sold', 'rented', 'draft']

function seed(): OwnerData {
  const now = Date.now(); const day = 86400000
  const p = (title: string, ptype: string, location: string, area: number, rooms: number, price: number, deal: DealType, status: PropStatus, views: number, ageDays: number): Property =>
    ({ id: id('p_'), title, ptype, location, area, rooms, price, deal, status, views, createdAt: now - ageDays * day })
  const properties: Property[] = [
    p('آپارتمان نوساز سعادت‌آباد', 'آپارتمان', 'تهران، سعادت‌آباد', 95, 2, 8500000000, 'sale', 'active', 142, 12),
    p('آپارتمان لوکس ولنجک', 'آپارتمان', 'تهران، ولنجک', 120, 3, 2000000000, 'rent', 'active', 88, 20),
    p('ویلا باغ لواسان', 'ویلا', 'لواسان', 250, 4, 25000000000, 'sale', 'active', 210, 30),
    p('مغازه تجاری تجریش', 'مغازه', 'تهران، تجریش', 40, 0, 6000000000, 'sale', 'sold', 320, 60),
  ]
  const pid = (i: number) => properties[i].id
  const inq = (i: number, name: string, phone: string, message: string, status: InquiryStatus, ageDays: number): Inquiry =>
    ({ id: id('q_'), propertyId: pid(i), name, phone, message, status, createdAt: now - ageDays * day })
  const inquiries: Inquiry[] = [
    inq(0, 'علی محمدی', '09120000001', 'امکان بازدید آخر هفته هست؟', 'new', 1),
    inq(2, 'سارا احمدی', '09120000002', 'قیمت قابل مذاکره است؟', 'new', 2),
    inq(0, 'رضا کریمی', '09120000003', 'سند تک‌برگ است؟', 'contacted', 4),
    inq(1, 'مریم حسینی', '09120000004', 'ودیعه به اجاره تبدیل می‌شود؟', 'new', 3),
  ]
  const vw = (i: number, visitor: string, phone: string, date: string, status: ViewingStatus, ageDays: number): Viewing =>
    ({ id: id('v_'), propertyId: pid(i), visitor, phone, date, status, createdAt: now - ageDays * day })
  const viewings: Viewing[] = [
    vw(0, 'علی محمدی', '09120000001', '۱۴۰۴/۰۴/۰۲', 'scheduled', 1),
    vw(2, 'خانوادهٔ نیک‌پور', '09120000010', '۱۴۰۴/۰۴/۰۳', 'scheduled', 1),
    vw(0, 'حسین رضوی', '09120000011', '۱۴۰۴/۰۳/۲۸', 'done', 6),
  ]
  const of = (i: number, buyer: string, phone: string, amount: number, status: OfferStatus, ageDays: number): Offer =>
    ({ id: id('o_'), propertyId: pid(i), buyer, phone, amount, status, createdAt: now - ageDays * day })
  const offers: Offer[] = [
    of(0, 'علی محمدی', '09120000001', 8200000000, 'pending', 1),
    of(2, 'گروه سرمایه‌گذاری آرتا', '09120000020', 24000000000, 'pending', 3),
    of(3, 'بازرگانی پارس', '09120000021', 5800000000, 'accepted', 55),
  ]
  const monthlyViews: MonthViews[] = [
    { month: 'آذر', count: 180 }, { month: 'دی', count: 220 }, { month: 'بهمن', count: 260 },
    { month: 'اسفند', count: 300 }, { month: 'فروردین', count: 280 }, { month: 'اردیبهشت', count: 360 },
  ]
  return { profile: { name: 'محمد رضایی' }, properties, inquiries, viewings, offers, monthlyViews, createdAt: now }
}

export function getOwner(owner: string): OwnerData {
  const db = load()
  if (!db.owners[owner]) { db.owners[owner] = seed(); save(db) }
  return db.owners[owner]
}
function mutate(owner: string, fn: (o: OwnerData) => void) {
  const db = load(); if (!db.owners[owner]) db.owners[owner] = seed(); fn(db.owners[owner]); save(db); return db.owners[owner]
}

export function ownerStats(owner: string) {
  const o = getOwner(owner)
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
export function propTitle(owner: string, propertyId: string) {
  return getOwner(owner).properties.find(p => p.id === propertyId)?.title || '—'
}

// ---- Properties ----
export function addProperty(owner: string, input: Partial<Property>): Property {
  let created!: Property
  mutate(owner, o => {
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
export function updateProperty(owner: string, pid: string, patch: Partial<Property>): Property | null {
  let res: Property | null = null
  mutate(owner, o => { const p = o.properties.find(x => x.id === pid); if (!p) return; Object.assign(p, patch); res = p })
  return res
}
export function deleteProperty(owner: string, pid: string) {
  mutate(owner, o => { o.properties = o.properties.filter(p => p.id !== pid) })
}

// ---- Inquiries ----
export function setInquiryStatus(owner: string, qid: string, status: InquiryStatus): Inquiry | null {
  let res: Inquiry | null = null
  mutate(owner, o => { const q = o.inquiries.find(x => x.id === qid); if (!q) return; q.status = status; res = q })
  return res
}
export function addInquiry(owner: string, input: { propertyId: string; name: string; phone?: string; message?: string }): Inquiry {
  let created!: Inquiry
  mutate(owner, o => { created = { id: id('q_'), propertyId: input.propertyId, name: input.name, phone: input.phone, message: input.message, status: 'new', createdAt: Date.now() }; o.inquiries.unshift(created) })
  return created
}

// ---- Viewings ----
export function setViewingStatus(owner: string, vid: string, status: ViewingStatus): Viewing | null {
  let res: Viewing | null = null
  mutate(owner, o => { const v = o.viewings.find(x => x.id === vid); if (!v) return; v.status = status; res = v })
  return res
}
export function addViewing(owner: string, input: { propertyId: string; visitor: string; phone?: string; date: string }): Viewing {
  let created!: Viewing
  mutate(owner, o => { created = { id: id('v_'), propertyId: input.propertyId, visitor: input.visitor, phone: input.phone, date: input.date, status: 'scheduled', createdAt: Date.now() }; o.viewings.unshift(created) })
  return created
}

// ---- Offers ----
export function setOfferStatus(owner: string, oid: string, status: OfferStatus): Offer | null {
  let res: Offer | null = null
  mutate(owner, o => { const of = o.offers.find(x => x.id === oid); if (!of) return; of.status = status; res = of })
  return res
}

export function listProperties(owner: string) { return getOwner(owner).properties }
export function listInquiries(owner: string) { return getOwner(owner).inquiries }
export function listViewings(owner: string) { return getOwner(owner).viewings }
export function listOffers(owner: string) { return getOwner(owner).offers }
export function updateOwnerProfile(owner: string, patch: Partial<OwnerData['profile']>) {
  return mutate(owner, o => { Object.assign(o.profile, patch) }).profile
}
