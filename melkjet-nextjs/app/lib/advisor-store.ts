import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { addUserListing, deleteItem, getItemById, setItemDealStatus } from './scraper-store'
import { pgEnabled, kvGet, kvMutate } from './db'

// استور پنل «مشاور املاک» — per-owner (هر کاربر فقط دادهٔ خودش).
// دومَحاله: اگر DATABASE_URL ست باشد → Postgres (نوشتنِ اتمیک)، وگرنه فایل.
const DATA_FILE = join(process.cwd(), '.advisor-data.json')
const KV_KEY = 'advisor'

export type Stage = 'new' | 'contacted' | 'visit' | 'negotiation' | 'closed' | 'lost'
export type ListingStatus = 'active' | 'sold' | 'rented'
export type ApptType = 'visit' | 'meeting' | 'call'
export type ApptStatus = 'scheduled' | 'done' | 'canceled'
export type CommStatus = 'pending' | 'paid' | 'canceled'

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
  // اتصال فایل به لیدها: یک لیدِ فروشنده + چند لیدِ خریدار (برای CRM)
  sellerLeadId?: string; buyerLeadIds?: string[]
}
export interface Appt { id: string; client: string; listingTitle?: string; date: string; type: ApptType; status: ApptStatus; createdAt: number }
export interface Commission { id: string; dealTitle: string; amount: number; status: CommStatus; date: string; createdAt: number; percent?: number; dealAmount?: number }
export interface MonthDeals { month: string; count: number }

export interface AdvisorData {
  profile: { name: string; agency?: string; title?: string; bio?: string; phone?: string; areas?: string; experience?: string; photo?: string; specialties?: string[] }
  leads: Lead[]
  listings: Listing[]
  appts: Appt[]
  commissions: Commission[]
  monthlyDeals: MonthDeals[]
  createdAt: number
}

interface DB { advisors: Record<string, AdvisorData> }
function id(p = '') { return p + randomBytes(5).toString('hex') }
function fileLoad(): DB { if (existsSync(DATA_FILE)) { try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {} } return { advisors: {} } }
function fileSave(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, { advisors: {} }) : fileLoad() }
// wrapperِ عمومیِ خواندن-تغییر-نوشتن (نامش withDb تا با mutate(owner) پایین تداخل نکند)
async function withDb<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, { advisors: {} }, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

export const STAGES: Stage[] = ['new', 'contacted', 'visit', 'negotiation', 'closed', 'lost']
const LISTING_STATUSES: ListingStatus[] = ['active', 'sold', 'rented']
const APPT_STATUSES: ApptStatus[] = ['scheduled', 'done', 'canceled']

// حسابِ مشاور به‌صورت خالی شروع می‌شود — هیچ دادهٔ نمونه‌ای نیست؛ همه‌چیز واقعی و
// همان است که مشاور خودش ثبت می‌کند.
function seed(): AdvisorData {
  return { profile: { name: '', agency: '' }, leads: [], listings: [], appts: [], commissions: [], monthlyDeals: [], createdAt: Date.now() }
}
// آیا این دادهٔ ذخیره‌شده همان دادهٔ نمونهٔ قدیمیِ دست‌نخورده است؟ (برای پاک‌سازی خودکار)
function isLegacyDemo(d: AdvisorData): boolean {
  return d?.profile?.name === 'سمیرا نیک‌پور' && d?.profile?.agency === 'املاک برتر'
}

// seed/پاک‌سازیِ دادهٔ نمونهٔ قدیمی را روی db برای مالکِ o اعمال می‌کند؛
// برمی‌گرداند که آیا چیزی تغییر کرد (نیاز به ذخیره).
function applyAdvisor(db: DB, o: string): boolean {
  if (!db.advisors[o]) { db.advisors[o] = seed(); return true }
  // پاک‌سازی خودکارِ دادهٔ نمونهٔ قدیمی (دست‌نخورده) → همه‌چیز واقعی شود
  if (isLegacyDemo(db.advisors[o])) { db.advisors[o] = seed(); return true }
  return false
}

export async function getAdvisor(o: string): Promise<AdvisorData> {
  const db = await load()
  // اگر seed/پاک‌سازی لازم نبود، بدونِ نوشتن برگردان (مثلِ قبل که فقط وقتی dirty بود ذخیره می‌شد).
  if (!applyAdvisor(db, o)) return db.advisors[o]
  return withDb(d => { applyAdvisor(d, o); return d.advisors[o] })
}
async function mutate(o: string, fn: (a: AdvisorData) => void): Promise<AdvisorData> {
  return withDb(db => { if (!db.advisors[o]) db.advisors[o] = seed(); fn(db.advisors[o]); return db.advisors[o] })
}

export async function advisorStats(o: string) {
  const a = await getAdvisor(o)
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
export async function addLead(o: string, input: Partial<Lead>): Promise<Lead> {
  let c!: Lead
  await mutate(o, a => { c = { id: id('l_'), name: String(input.name || 'لید جدید'), phone: input.phone, need: input.need, budget: input.budget, stage: STAGES.includes(input.stage as Stage) ? input.stage as Stage : 'new', source: input.source, note: input.note, createdAt: Date.now() }; a.leads.unshift(c) })
  return c
}
export async function setLeadStage(o: string, lid: string, stage: Stage): Promise<Lead | null> {
  if (!STAGES.includes(stage)) return null
  let res: Lead | null = null
  await mutate(o, a => { const l = a.leads.find(x => x.id === lid); if (!l) return; l.stage = stage; res = l })
  return res
}
export async function updateLead(o: string, lid: string, patch: Partial<Lead>): Promise<Lead | null> {
  let res: Lead | null = null
  await mutate(o, a => {
    const l = a.leads.find(x => x.id === lid); if (!l) return
    const allow: (keyof Lead)[] = ['name', 'phone', 'need', 'budget', 'source', 'note', 'stage']
    for (const k of allow) if (k in patch) (l as unknown as Record<string, unknown>)[k] = (patch as Record<string, unknown>)[k]
    res = l
  })
  return res
}
export async function deleteLead(o: string, lid: string): Promise<void> { await mutate(o, a => { a.leads = a.leads.filter(l => l.id !== lid) }) }

// ---- Listings ----
export async function addListing(o: string, input: Partial<Listing>): Promise<Listing> {
  let c!: Listing
  await mutate(o, a => {
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
export async function updateListing(o: string, fid: string, patch: Partial<Listing>): Promise<Listing | null> {
  let res: Listing | null = null
  await mutate(o, a => {
    const l = a.listings.find(x => x.id === fid); if (!l) return
    const allow: (keyof Listing)[] = ['title', 'ptype', 'location', 'price', 'deal', 'city', 'neighborhood', 'province', 'district', 'lat', 'lng', 'facing', 'rentMonthly', 'area', 'rooms', 'floor', 'totalFloors', 'yearBuilt', 'parking', 'elevator', 'storage', 'balcony', 'furnished', 'amenities', 'docType', 'address', 'phone', 'description', 'images', 'sellerLeadId', 'buyerLeadIds']
    for (const k of allow) if (k in patch) (l as unknown as Record<string, unknown>)[k] = (patch as Record<string, unknown>)[k]
    res = l
  })
  return res
}
export async function setListingStatus(o: string, fid: string, status: ListingStatus): Promise<Listing | null> {
  if (!LISTING_STATUSES.includes(status)) return null
  let res: Listing | null = null
  let pubId = ''
  await mutate(o, a => { const l = a.listings.find(x => x.id === fid); if (!l) return; l.status = status; res = l; pubId = l.publicId || '' })
  // مهرِ «فروخته شد / اجاره رفت» روی آگهیِ عمومی هم اعمال شود (اگر منتشر شده).
  if (pubId) setItemDealStatus(pubId, status === 'sold' ? 'sold' : status === 'rented' ? 'rented' : '')
  return res
}
export async function deleteListing(o: string, fid: string): Promise<void> { await mutate(o, a => { const l = a.listings.find(x => x.id === fid); if (l?.publicId) deleteItem(l.publicId); a.listings = a.listings.filter(x => x.id !== fid) }) }

// ---- انتشار عمومی روی سایت (آگهی پابلیک) ----
function faNum(n?: number): string { return n ? n.toLocaleString('fa-IR') : '' }
function publicPayload(l: Listing, advisorName: string, ownerPhone?: string) {
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
  if (l.status === 'sold') meta['__dealStatus'] = 'sold'; else if (l.status === 'rented') meta['__dealStatus'] = 'rented'
  if (l.images && l.images.length) meta['__gallery'] = l.images.join('\n')
  if (typeof l.lat === 'number' && typeof l.lng === 'number') { meta['__lat'] = String(l.lat); meta['__lng'] = String(l.lng) }
  // شناسهٔ مالک (شمارهٔ حساب) برای تطبیقِ مطمئنِ «آگهی‌های من» در سایت‌ساز — مستقل از نام
  if (ownerPhone) meta['__ownerPhone'] = ownerPhone
  return { title: l.title, price, location: loc, image: l.images?.[0], excerpt: l.description, phone: l.phone, owner: advisorName, meta }
}
export async function publishListing(o: string, fid: string): Promise<Listing | null> {
  let res: Listing | null = null
  await mutate(o, a => {
    const l = a.listings.find(x => x.id === fid); if (!l) return
    if (l.publicId && getItemById(l.publicId)) deleteItem(l.publicId) // بازسازی برای اعمالِ تغییرات
    const item = addUserListing(publicPayload(l, a.profile.name || 'مشاور', o))
    l.publicId = item.id; l.published = true; res = l
  })
  return res
}
export async function unpublishListing(o: string, fid: string): Promise<Listing | null> {
  let res: Listing | null = null
  await mutate(o, a => {
    const l = a.listings.find(x => x.id === fid); if (!l) return
    if (l.publicId) deleteItem(l.publicId)
    l.publicId = undefined; l.published = false; res = l
  })
  return res
}

// ---- Appointments ----
export async function addAppt(o: string, input: { client: string; listingTitle?: string; date: string; type?: ApptType }): Promise<Appt> {
  let c!: Appt
  await mutate(o, a => { c = { id: id('a_'), client: input.client, listingTitle: input.listingTitle, date: input.date, type: (['visit', 'meeting', 'call'].includes(input.type as ApptType) ? input.type : 'visit') as ApptType, status: 'scheduled', createdAt: Date.now() }; a.appts.unshift(c) })
  return c
}
export async function setApptStatus(o: string, aid: string, status: ApptStatus): Promise<Appt | null> {
  if (!APPT_STATUSES.includes(status)) return null
  let res: Appt | null = null
  await mutate(o, a => { const x = a.appts.find(y => y.id === aid); if (!x) return; x.status = status; res = x })
  return res
}

// ---- Commissions ----
export async function addCommission(o: string, input: { dealTitle: string; amount: number; date?: string; percent?: number; dealAmount?: number }): Promise<Commission> {
  let c!: Commission
  await mutate(o, a => {
    const percent = input.percent ? Number(input.percent) : undefined
    const dealAmount = input.dealAmount ? Number(input.dealAmount) : undefined
    // اگر درصد و مبلغ معامله داده شده باشد، خودِ کمیسیون محاسبه می‌شود
    const amount = (percent && dealAmount) ? Math.round(dealAmount * percent / 100) : (Number(input.amount) || 0)
    c = { id: id('cm_'), dealTitle: String(input.dealTitle || 'معامله'), amount, status: 'pending', date: input.date || new Date().toLocaleDateString('fa-IR'), createdAt: Date.now(), percent, dealAmount }
    a.commissions.unshift(c)
  })
  return c
}
export async function deleteCommission(o: string, cid: string): Promise<void> { await mutate(o, a => { a.commissions = a.commissions.filter(c => c.id !== cid) }) }
// مبلغِ نهاییِ کمیسیون را ویرایش می‌کند (مثلاً وقتی معامله محقق شد و مبلغِ واقعی مشخص شد).
export async function setCommissionAmount(o: string, cid: string, amount: number): Promise<Commission | null> {
  let res: Commission | null = null
  await mutate(o, a => { const c = a.commissions.find(x => x.id === cid); if (!c) return; c.amount = Math.max(0, Math.round(Number(amount) || 0)); res = c })
  return res
}
export async function setCommissionStatus(o: string, cid: string, status: CommStatus): Promise<Commission | null> {
  let res: Commission | null = null
  await mutate(o, a => { const c = a.commissions.find(x => x.id === cid); if (!c) return; c.status = status; res = c })
  return res
}

export async function listLeads(o: string): Promise<Lead[]> { return (await getAdvisor(o)).leads }
export async function listListings(o: string): Promise<Listing[]> { return (await getAdvisor(o)).listings }
export async function listAppts(o: string): Promise<Appt[]> { return (await getAdvisor(o)).appts }
export async function listCommissions(o: string): Promise<Commission[]> { return (await getAdvisor(o)).commissions }
export async function updateAdvisorProfile(o: string, patch: Partial<AdvisorData['profile']>): Promise<AdvisorData['profile']> {
  return (await mutate(o, a => { Object.assign(a.profile, patch) })).profile
}
