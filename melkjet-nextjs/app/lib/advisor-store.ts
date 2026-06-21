import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { addUserListing, deleteItem, getItemById } from './scraper-store'

// استور پنل «مشاور املاک» — per-owner (هر کاربر فقط دادهٔ خودش).
const DATA_FILE = join(process.cwd(), '.advisor-data.json')

export type Stage = 'new' | 'contacted' | 'visit' | 'negotiation' | 'closed' | 'lost'
export type ListingStatus = 'active' | 'sold' | 'rented'
export type ApptType = 'visit' | 'meeting' | 'call'
export type ApptStatus = 'scheduled' | 'done' | 'canceled'
export type CommStatus = 'pending' | 'paid'

export interface Lead { id: string; name: string; phone?: string; need?: string; budget?: string; stage: Stage; source?: string; note?: string; createdAt: number }
export interface Listing {
  id: string; title: string; ptype: string; location: string; price: number; deal: 'sale' | 'rent'; status: ListingStatus; createdAt: number
  // جزئیات کامل فایل (همه اختیاری برای سازگاری با دادهٔ قبلی)
  city?: string; neighborhood?: string; facing?: string
  province?: string; district?: string; lat?: number; lng?: number
  rentMonthly?: number; area?: number; rooms?: number; floor?: number; totalFloors?: number; yearBuilt?: number
  parking?: boolean; elevator?: boolean; storage?: boolean; balcony?: boolean; furnished?: boolean
  amenities?: string[]
  docType?: string; address?: string; phone?: string; description?: string; images?: string[]
  published?: boolean; publicId?: string
}
export interface Appt { id: string; client: string; listingTitle?: string; date: string; type: ApptType; status: ApptStatus; createdAt: number }
export interface Commission { id: string; dealTitle: string; amount: number; status: CommStatus; date: string; createdAt: number }
export interface MonthDeals { month: string; count: number }

export interface AdvisorData {
  profile: { name: string; agency?: string }
  leads: Lead[]
  listings: Listing[]
  appts: Appt[]
  commissions: Commission[]
  monthlyDeals: MonthDeals[]
  createdAt: number
}

interface DB { advisors: Record<string, AdvisorData> }
function id(p = '') { return p + randomBytes(5).toString('hex') }
function load(): DB { if (existsSync(DATA_FILE)) { try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {} } return { advisors: {} } }
function save(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

export const STAGES: Stage[] = ['new', 'contacted', 'visit', 'negotiation', 'closed', 'lost']
const LISTING_STATUSES: ListingStatus[] = ['active', 'sold', 'rented']
const APPT_STATUSES: ApptStatus[] = ['scheduled', 'done', 'canceled']

function seed(): AdvisorData {
  const now = Date.now(); const day = 86400000
  const lead = (name: string, phone: string, need: string, budget: string, stage: Stage, source: string, ageDays: number): Lead =>
    ({ id: id('l_'), name, phone, need, budget, stage, source, createdAt: now - ageDays * day })
  const leads: Lead[] = [
    lead('علی محمدی', '09120000001', 'آپارتمان ۲ خوابه سعادت‌آباد', '۸ میلیارد', 'negotiation', 'سایت', 1),
    lead('سارا احمدی', '09120000002', 'ویلا لواسان', '۲۵ میلیارد', 'visit', 'معرفی', 2),
    lead('رضا کریمی', '09120000003', 'اجاره ونک', 'رهن ۲ میلیارد', 'contacted', 'دیوار', 3),
    lead('مریم حسینی', '09120000004', 'آپارتمان جردن', '۱۱ میلیارد', 'new', 'سایت', 0),
    lead('حسین رضوی', '09120000005', 'مغازه تجریش', '۶ میلیارد', 'new', 'تماس', 1),
    lead('گروه آرتا', '09120000006', 'سرمایه‌گذاری برج', '۵۰ میلیارد', 'closed', 'معرفی', 20),
  ]
  const li = (title: string, ptype: string, location: string, price: number, deal: 'sale' | 'rent', status: ListingStatus, ageDays: number): Listing =>
    ({ id: id('f_'), title, ptype, location, price, deal, status, createdAt: now - ageDays * day })
  const listings: Listing[] = [
    li('آپارتمان نوساز سعادت‌آباد', 'آپارتمان', 'سعادت‌آباد', 8500000000, 'sale', 'active', 10),
    li('ویلا باغ لواسان', 'ویلا', 'لواسان', 25000000000, 'sale', 'active', 15),
    li('آپارتمان اجاره‌ای ونک', 'آپارتمان', 'ونک', 2000000000, 'rent', 'active', 5),
    li('مغازه تجاری تجریش', 'مغازه', 'تجریش', 6000000000, 'sale', 'sold', 40),
  ]
  const ap = (client: string, listingTitle: string, date: string, type: ApptType, status: ApptStatus, ageDays: number): Appt =>
    ({ id: id('a_'), client, listingTitle, date, type, status, createdAt: now - ageDays * day })
  const appts: Appt[] = [
    ap('علی محمدی', 'آپارتمان نوساز سعادت‌آباد', '۱۴۰۴/۰۴/۰۲', 'visit', 'scheduled', 1),
    ap('سارا احمدی', 'ویلا باغ لواسان', '۱۴۰۴/۰۴/۰۳', 'visit', 'scheduled', 1),
    ap('رضا کریمی', 'آپارتمان اجاره‌ای ونک', '۱۴۰۴/۰۳/۲۹', 'meeting', 'done', 4),
  ]
  const cm = (dealTitle: string, amount: number, status: CommStatus, date: string, ageDays: number): Commission =>
    ({ id: id('c_'), dealTitle, amount, status, date, createdAt: now - ageDays * day })
  const commissions: Commission[] = [
    cm('فروش مغازه تجریش', 120000000, 'paid', '۱۴۰۴/۰۲/۱۵', 40),
    cm('فروش برج (گروه آرتا)', 500000000, 'pending', '۱۴۰۴/۰۳/۲۰', 10),
  ]
  const monthlyDeals: MonthDeals[] = [
    { month: 'آذر', count: 2 }, { month: 'دی', count: 3 }, { month: 'بهمن', count: 2 },
    { month: 'اسفند', count: 4 }, { month: 'فروردین', count: 3 }, { month: 'اردیبهشت', count: 5 },
  ]
  return { profile: { name: 'سمیرا نیک‌پور', agency: 'املاک برتر' }, leads, listings, appts, commissions, monthlyDeals, createdAt: now }
}

export function getAdvisor(o: string): AdvisorData {
  const db = load(); if (!db.advisors[o]) { db.advisors[o] = seed(); save(db) } return db.advisors[o]
}
function mutate(o: string, fn: (a: AdvisorData) => void) { const db = load(); if (!db.advisors[o]) db.advisors[o] = seed(); fn(db.advisors[o]); save(db); return db.advisors[o] }

export function advisorStats(o: string) {
  const a = getAdvisor(o)
  const activeLeads = a.leads.filter(l => l.stage !== 'closed' && l.stage !== 'lost')
  const hot = a.leads.filter(l => l.stage === 'negotiation' || l.stage === 'visit')
  const activeListings = a.listings.filter(l => l.status === 'active')
  const upcoming = a.appts.filter(x => x.status === 'scheduled')
  const monthCommission = a.commissions.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0)
  const paidCommission = a.commissions.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0)
  const pipeline = STAGES.map(s => ({ stage: s, count: a.leads.filter(l => l.stage === s).length }))
  const months = a.monthlyDeals
  const thisMonth = months.length ? months[months.length - 1].count : 0
  return {
    profile: a.profile,
    kpis: {
      activeLeads: activeLeads.length, hotLeads: hot.length, activeListings: activeListings.length,
      upcomingAppts: upcoming.length, pendingCommission: monthCommission, paidCommission, dealsThisMonth: thisMonth,
    },
    pipeline,
    monthlyDeals: months,
    recentLeads: [...a.leads].sort((x, y) => y.createdAt - x.createdAt).slice(0, 6),
    upcoming: upcoming.slice(0, 6),
  }
}

// ---- Leads ----
export function addLead(o: string, input: Partial<Lead>): Lead {
  let c!: Lead
  mutate(o, a => { c = { id: id('l_'), name: String(input.name || 'لید جدید'), phone: input.phone, need: input.need, budget: input.budget, stage: STAGES.includes(input.stage as Stage) ? input.stage as Stage : 'new', source: input.source, note: input.note, createdAt: Date.now() }; a.leads.unshift(c) })
  return c
}
export function setLeadStage(o: string, lid: string, stage: Stage): Lead | null {
  if (!STAGES.includes(stage)) return null
  let res: Lead | null = null
  mutate(o, a => { const l = a.leads.find(x => x.id === lid); if (!l) return; l.stage = stage; res = l })
  return res
}
export function deleteLead(o: string, lid: string) { mutate(o, a => { a.leads = a.leads.filter(l => l.id !== lid) }) }

// ---- Listings ----
export function addListing(o: string, input: Partial<Listing>): Listing {
  let c!: Listing
  mutate(o, a => {
    c = {
      id: id('f_'), title: String(input.title || 'فایل جدید'), ptype: String(input.ptype || 'آپارتمان'),
      location: String(input.location || ''), price: Number(input.price) || 0,
      deal: input.deal === 'rent' ? 'rent' : 'sale', status: 'active', createdAt: Date.now(),
      city: input.city ? String(input.city) : undefined,
      neighborhood: input.neighborhood ? String(input.neighborhood) : undefined,
      province: input.province ? String(input.province) : undefined,
      district: input.district ? String(input.district) : undefined,
      lat: typeof input.lat === 'number' ? input.lat : undefined,
      lng: typeof input.lng === 'number' ? input.lng : undefined,
      facing: input.facing ? String(input.facing) : undefined,
      rentMonthly: input.rentMonthly ? Number(input.rentMonthly) : undefined,
      area: input.area ? Number(input.area) : undefined,
      rooms: input.rooms !== undefined ? Number(input.rooms) : undefined,
      floor: input.floor ? Number(input.floor) : undefined,
      totalFloors: input.totalFloors ? Number(input.totalFloors) : undefined,
      yearBuilt: input.yearBuilt ? Number(input.yearBuilt) : undefined,
      parking: !!input.parking, elevator: !!input.elevator, storage: !!input.storage, balcony: !!input.balcony, furnished: !!input.furnished,
      amenities: Array.isArray(input.amenities) ? input.amenities.slice(0, 40).map(String) : [],
      docType: input.docType ? String(input.docType) : undefined,
      address: input.address ? String(input.address) : undefined,
      phone: input.phone ? String(input.phone) : undefined,
      description: input.description ? String(input.description) : undefined,
      images: Array.isArray(input.images) ? input.images.slice(0, 12).map(String) : [],
    }
    a.listings.unshift(c)
  })
  return c
}
export function updateListing(o: string, fid: string, patch: Partial<Listing>): Listing | null {
  let res: Listing | null = null
  mutate(o, a => {
    const l = a.listings.find(x => x.id === fid); if (!l) return
    const allow: (keyof Listing)[] = ['title', 'ptype', 'location', 'price', 'deal', 'city', 'neighborhood', 'province', 'district', 'lat', 'lng', 'facing', 'rentMonthly', 'area', 'rooms', 'floor', 'totalFloors', 'yearBuilt', 'parking', 'elevator', 'storage', 'balcony', 'furnished', 'amenities', 'docType', 'address', 'phone', 'description', 'images']
    for (const k of allow) if (k in patch) (l as unknown as Record<string, unknown>)[k] = (patch as Record<string, unknown>)[k]
    res = l
  })
  return res
}
export function setListingStatus(o: string, fid: string, status: ListingStatus): Listing | null {
  if (!LISTING_STATUSES.includes(status)) return null
  let res: Listing | null = null
  mutate(o, a => { const l = a.listings.find(x => x.id === fid); if (!l) return; l.status = status; res = l })
  return res
}
export function deleteListing(o: string, fid: string) { mutate(o, a => { const l = a.listings.find(x => x.id === fid); if (l?.publicId) deleteItem(l.publicId); a.listings = a.listings.filter(x => x.id !== fid) }) }

// ---- انتشار عمومی روی سایت (آگهی پابلیک) ----
function faNum(n?: number): string { return n ? n.toLocaleString('fa-IR') : '' }
function publicPayload(l: Listing, advisorName: string) {
  const price = l.deal === 'rent'
    ? `ودیعه ${faNum(l.price)} تومان${l.rentMonthly ? ` · اجارهٔ ماهانه ${faNum(l.rentMonthly)} تومان` : ''}`
    : `${faNum(l.price)} تومان`
  const loc = [l.city, l.neighborhood].filter(Boolean).join('، ') || l.location || ''
  const meta: Record<string, string> = {}
  const put = (k: string, v?: string | number) => { if (v !== undefined && v !== '' && v !== 0) meta[k] = String(v) }
  put('استان', l.province); put('شهر', l.city); put('منطقه', l.district); put('محله', l.neighborhood)
  put('نوع معامله', l.deal === 'rent' ? 'اجاره' : 'فروش')
  put('نوع ملک', l.ptype); put('متراژ', l.area ? `${faNum(l.area)} متر` : ''); put('اتاق خواب', faNum(l.rooms))
  put('طبقه', faNum(l.floor)); put('تعداد طبقات', faNum(l.totalFloors)); put('سال ساخت', faNum(l.yearBuilt))
  put('جهت', l.facing); put('سند', l.docType)
  if (l.amenities && l.amenities.length) meta['امکانات'] = l.amenities.join('، ')
  if (l.images && l.images.length) meta['__gallery'] = l.images.join('\n')
  if (typeof l.lat === 'number' && typeof l.lng === 'number') { meta['__lat'] = String(l.lat); meta['__lng'] = String(l.lng) }
  return { title: l.title, price, location: loc, image: l.images?.[0], excerpt: l.description, phone: l.phone, owner: advisorName, meta }
}
export function publishListing(o: string, fid: string): Listing | null {
  let res: Listing | null = null
  mutate(o, a => {
    const l = a.listings.find(x => x.id === fid); if (!l) return
    if (l.publicId && getItemById(l.publicId)) deleteItem(l.publicId) // بازسازی برای اعمالِ تغییرات
    const item = addUserListing(publicPayload(l, a.profile.name || 'مشاور'))
    l.publicId = item.id; l.published = true; res = l
  })
  return res
}
export function unpublishListing(o: string, fid: string): Listing | null {
  let res: Listing | null = null
  mutate(o, a => {
    const l = a.listings.find(x => x.id === fid); if (!l) return
    if (l.publicId) deleteItem(l.publicId)
    l.publicId = undefined; l.published = false; res = l
  })
  return res
}

// ---- Appointments ----
export function addAppt(o: string, input: { client: string; listingTitle?: string; date: string; type?: ApptType }): Appt {
  let c!: Appt
  mutate(o, a => { c = { id: id('a_'), client: input.client, listingTitle: input.listingTitle, date: input.date, type: (['visit', 'meeting', 'call'].includes(input.type as ApptType) ? input.type : 'visit') as ApptType, status: 'scheduled', createdAt: Date.now() }; a.appts.unshift(c) })
  return c
}
export function setApptStatus(o: string, aid: string, status: ApptStatus): Appt | null {
  if (!APPT_STATUSES.includes(status)) return null
  let res: Appt | null = null
  mutate(o, a => { const x = a.appts.find(y => y.id === aid); if (!x) return; x.status = status; res = x })
  return res
}

// ---- Commissions ----
export function addCommission(o: string, input: { dealTitle: string; amount: number; date?: string }): Commission {
  let c!: Commission
  mutate(o, a => { c = { id: id('cm_'), dealTitle: String(input.dealTitle || 'معامله'), amount: Number(input.amount) || 0, status: 'pending', date: input.date || new Date().toLocaleDateString('fa-IR'), createdAt: Date.now() }; a.commissions.unshift(c) })
  return c
}
export function deleteCommission(o: string, cid: string) { mutate(o, a => { a.commissions = a.commissions.filter(c => c.id !== cid) }) }
export function setCommissionStatus(o: string, cid: string, status: CommStatus): Commission | null {
  let res: Commission | null = null
  mutate(o, a => { const c = a.commissions.find(x => x.id === cid); if (!c) return; c.status = status; res = c })
  return res
}

export function listLeads(o: string) { return getAdvisor(o).leads }
export function listListings(o: string) { return getAdvisor(o).listings }
export function listAppts(o: string) { return getAdvisor(o).appts }
export function listCommissions(o: string) { return getAdvisor(o).commissions }
export function updateAdvisorProfile(o: string, patch: Partial<AdvisorData['profile']>) {
  return mutate(o, a => { Object.assign(a.profile, patch) }).profile
}
