import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { addUserListing, updateUserListing, deleteItem, getItemById, setItemDealStatus } from './scraper-store'
import { pgEnabled, kvGet, kvMutate } from './db'
import { aiFor, agentModel, agentProvider } from './gapgpt'
const { chatCompleteSafe } = aiFor('پنلِ مشاور')   // فاز ۵۷: منبعِ صریح در دفترِ مصرفِ AI

// استور پنل «مشاور املاک» — per-owner (هر کاربر فقط دادهٔ خودش).
// دومَحاله: اگر DATABASE_URL ست باشد → Postgres (نوشتنِ اتمیک)، وگرنه فایل.
const DATA_FILE = join(process.cwd(), '.advisor-data.json')
const KV_KEY = 'advisor'

export type Stage = 'new' | 'contacted' | 'visit' | 'negotiation' | 'closed' | 'lost'
export type ListingStatus = 'active' | 'sold' | 'rented'
export type ApptType = 'visit' | 'meeting' | 'call'
export type ApptStatus = 'scheduled' | 'done' | 'canceled'
export type CommStatus = 'pending' | 'paid' | 'canceled'

export type ActivityType = 'created' | 'call' | 'visit' | 'meeting' | 'sms' | 'whatsapp' | 'email' | 'note' | 'stage' | 'appt'
export interface Activity { id: string; type: ActivityType; at: number; note?: string }
export interface Lead {
  id: string; name: string; phone?: string; email?: string; need?: string; budget?: string; stage: Stage; source?: string; note?: string; createdAt: number
  // Sales OS: تایم‌لاین فعالیت + امتیازِ خودکار + تگ + آخرین فعالیت + یادآورِ پیگیری
  activities?: Activity[]; score?: number; tags?: string[]; lastActivityAt?: number; reminderAt?: number
}
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
export interface Appt { id: string; client: string; leadId?: string; listingTitle?: string; date: string; type: ApptType; status: ApptStatus; createdAt: number }
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

// فاز ۱۳۲ (پرفِ دایرکتوری): کلِ دیتابیسِ مشاوران با «یک» خواندن — به‌جای getAdvisor در حلقه
// که روی PG برای هر مشاور یک رفت‌وبرگشت می‌شد و /api/directory را چند ثانیه‌ای می‌کرد.
export async function allAdvisorProfiles(): Promise<Record<string, AdvisorData>> {
  return (await load()).advisors || {}
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
// امتیازِ خودکارِ لید (۰..۱۰۰) — کاملیِ اطلاعات + پیشرفتِ مرحله + تازگیِ فعالیت.
export function leadScore(l: Lead): number {
  let s = 0
  const idx = STAGES.indexOf(l.stage)
  if (l.stage === 'closed') return 92
  if (l.stage === 'lost') return 5
  s += 12 + Math.min(20, Math.max(0, idx) * 6)
  if (l.phone) s += 14
  if (l.budget) s += 10
  if (l.need) s += 6
  const acts = (l.activities || []).filter(a => a.type !== 'created' && a.type !== 'stage')
  s += Math.min(14, acts.length * 3)
  const last = l.lastActivityAt || l.createdAt
  const ageH = (Date.now() - last) / 36e5
  if (ageH <= 24) s += 12; else if (ageH <= 24 * 7) s += 6
  return Math.max(0, Math.min(100, Math.round(s)))
}

export async function addLead(o: string, input: Partial<Lead>): Promise<Lead> {
  let c!: Lead
  await mutate(o, a => {
    const now = Date.now()
    c = { id: id('l_'), name: String(input.name || 'لید جدید'), phone: input.phone, email: input.email, need: input.need, budget: input.budget, stage: STAGES.includes(input.stage as Stage) ? input.stage as Stage : 'new', source: input.source, note: input.note, createdAt: now, lastActivityAt: now, tags: [], activities: [{ id: id('ac_'), type: 'created', at: now, note: input.source ? `ثبت از ${input.source}` : 'ثبتِ لید' }] }
    c.score = leadScore(c)
    a.leads.unshift(c)
  })
  return c
}
export async function setLeadStage(o: string, lid: string, stage: Stage): Promise<Lead | null> {
  if (!STAGES.includes(stage)) return null
  let res: Lead | null = null
  await mutate(o, a => {
    const l = a.leads.find(x => x.id === lid); if (!l) return
    if (l.stage !== stage) { l.activities = [...(l.activities || []), { id: id('ac_'), type: 'stage', at: Date.now(), note: `مرحله → ${stage}` }]; l.lastActivityAt = Date.now() }
    l.stage = stage; l.score = leadScore(l); res = l
  })
  return res
}
// ثبتِ فعالیت روی تایم‌لاینِ لید (تماس/بازدید/یادداشت/…).
export async function addLeadActivity(o: string, lid: string, act: { type: ActivityType; note?: string }): Promise<Lead | null> {
  let res: Lead | null = null
  await mutate(o, a => {
    const l = a.leads.find(x => x.id === lid); if (!l) return
    const now = Date.now()
    l.activities = [...(l.activities || []), { id: id('ac_'), type: act.type, at: now, note: act.note }]
    l.lastActivityAt = now
    // تماس/بازدید/جلسه روی لیدِ «جدید» → به «تماس‌گرفته/بازدید» ارتقا (اتوماسیونِ سبک)
    if (l.stage === 'new' && (act.type === 'call' || act.type === 'sms')) l.stage = 'contacted'
    if (act.type === 'visit' && (l.stage === 'new' || l.stage === 'contacted')) l.stage = 'visit'
    l.score = leadScore(l); res = l
  })
  return res
}
export async function updateLead(o: string, lid: string, patch: Partial<Lead>): Promise<Lead | null> {
  let res: Lead | null = null
  await mutate(o, a => {
    const l = a.leads.find(x => x.id === lid); if (!l) return
    const allow: (keyof Lead)[] = ['name', 'phone', 'email', 'need', 'budget', 'source', 'note', 'stage']
    for (const k of allow) if (k in patch) (l as unknown as Record<string, unknown>)[k] = (patch as Record<string, unknown>)[k]
    res = l
  })
  return res
}
// یادآورِ پیگیری (Task & Reminder): زمانِ آینده‌ای که باید لید را پیگیری کرد.
export async function setLeadReminder(o: string, lid: string, at: number | null): Promise<Lead | null> {
  let res: Lead | null = null
  await mutate(o, a => {
    const l = a.leads.find(x => x.id === lid); if (!l) return
    l.reminderAt = at && at > 0 ? at : undefined
    l.activities = [...(l.activities || []), { id: id('ac_'), type: 'note', at: Date.now(), note: at ? `یادآورِ پیگیری تنظیم شد` : 'یادآور حذف شد' }]
    l.lastActivityAt = Date.now(); res = l
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
  if (pubId) await setItemDealStatus(pubId, status === 'sold' ? 'sold' : status === 'rented' ? 'rented' : '')
  return res
}
export async function deleteListing(o: string, fid: string): Promise<void> { let pub = ''; await mutate(o, a => { const l = a.listings.find(x => x.id === fid); if (l?.publicId) pub = l.publicId; a.listings = a.listings.filter(x => x.id !== fid) }); if (pub) await deleteItem(pub) }

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
  const a0 = await getAdvisor(o)
  const l0 = a0.listings.find(x => x.id === fid)
  if (!l0) return null
  const payload = publicPayload(l0, a0.profile.name || 'مشاور', o)
  // فاز ۱۴۰ (فیدبک: «تأیید می‌کنم دوباره خودش برمی‌گردد»): بازانتشار قبلاً حذف+ساختِ دوباره بود —
  // هر سینکِ دیوار (autoPublish) حکمِ ممیزی و تأیید/ردِ دستیِ ادمین را پاک می‌کرد و آگهی دوباره
  // pending می‌شد. حالا آیتمِ موجود «درجا» به‌روزرسانی می‌شود و حکم می‌ماند؛ فقط اگر متنِ
  // ممیزی‌شونده (عنوان/توضیح) واقعاً عوض شده باشد، دوباره به صفِ ممیزی می‌رود.
  const prev = l0.publicId ? await getItemById(l0.publicId) : null
  let item = null as Awaited<ReturnType<typeof addUserListing>> | null
  if (prev && prev.type === 'listing') {
    const textChanged = prev.title !== payload.title || (prev.excerpt || '') !== (payload.excerpt || '')
    item = await updateUserListing(prev.id, payload, { remoderate: textChanged })
  }
  if (!item) item = await addUserListing(payload)
  const itemId = item.id
  let res: Listing | null = null
  await mutate(o, a => {
    const l = a.listings.find(x => x.id === fid); if (!l) return
    l.publicId = itemId; l.published = true; res = l
  })
  return res
}
export async function unpublishListing(o: string, fid: string): Promise<Listing | null> {
  let res: Listing | null = null
  let pub = ''
  await mutate(o, a => {
    const l = a.listings.find(x => x.id === fid); if (!l) return
    if (l.publicId) pub = l.publicId
    l.publicId = undefined; l.published = false; res = l
  })
  if (pub) await deleteItem(pub)
  return res
}

// ---- Appointments ----
export async function addAppt(o: string, input: { client: string; leadId?: string; listingTitle?: string; date: string; type?: ApptType }): Promise<Appt> {
  let c!: Appt
  await mutate(o, a => {
    const t = (['visit', 'meeting', 'call'].includes(input.type as ApptType) ? input.type : 'visit') as ApptType
    c = { id: id('a_'), client: input.client, leadId: input.leadId, listingTitle: input.listingTitle, date: input.date, type: t, status: 'scheduled', createdAt: Date.now() }
    a.appts.unshift(c)
    // اتصال به لید: فعالیتِ «قرار» روی تایم‌لاینِ لید ثبت می‌شود.
    if (input.leadId) {
      const l = a.leads.find(x => x.id === input.leadId)
      if (l) { l.activities = [...(l.activities || []), { id: id('ac_'), type: 'appt', at: Date.now(), note: `${t === 'visit' ? 'بازدید' : t === 'call' ? 'تماس' : 'جلسه'} — ${input.date}${input.listingTitle ? ' · ' + input.listingTitle : ''}` }]; l.lastActivityAt = Date.now(); if (l.stage === 'new') l.stage = 'contacted'; l.score = leadScore(l) }
    }
  })
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

// فاز ۱۲۲ — نظارتِ سوپرادمین: خلاصهٔ کارِ همهٔ مشاوران (owner → شمارِ لید/فایل/قرار)
export async function advisorWorkSummary(): Promise<Record<string, { leads: number; listings: number; appts: number }>> {
  const db = await load()
  const out: Record<string, { leads: number; listings: number; appts: number }> = {}
  for (const [o, a] of Object.entries(db.advisors)) out[o] = { leads: (a.leads || []).length, listings: (a.listings || []).length, appts: (a.appts || []).length }
  return out
}

export async function listLeads(o: string): Promise<Lead[]> { return (await getAdvisor(o)).leads }
export async function listListings(o: string): Promise<Listing[]> { return (await getAdvisor(o)).listings }
export async function listAppts(o: string): Promise<Appt[]> { return (await getAdvisor(o)).appts }
export async function listCommissions(o: string): Promise<Commission[]> { return (await getAdvisor(o)).commissions }
export async function updateAdvisorProfile(o: string, patch: Partial<AdvisorData['profile']>): Promise<AdvisorData['profile']> {
  return (await mutate(o, a => { Object.assign(a.profile, patch) })).profile
}

// ═══════════ هوشِ CRM (Sales OS) ═══════════
const STAGE_FA: Record<Stage, string> = { new: 'لید جدید', contacted: 'تماس‌گرفته', visit: 'بازدید', negotiation: 'مذاکره', closed: 'قرارداد', lost: 'ازدست‌رفته' }

// «با کی تماس بگیرم» + سلامتِ پایپ‌لاین. قاعده‌مند (همیشه‌کار)؛ اگر AI در دسترس بود، تحلیلِ متنی هم اضافه می‌شود.
export async function advisorAiInsights(o: string): Promise<{ callNow: { id: string; name: string; phone?: string; score: number; why: string }[]; health: string; tips: string[] }> {
  const a = await getAdvisor(o)
  const open = a.leads.filter(l => l.stage !== 'closed' && l.stage !== 'lost')
  const now = Date.now()
  const ranked = open.map(l => {
    const sc = leadScore(l)
    const ageH = (now - (l.lastActivityAt || l.createdAt)) / 36e5
    let why = ''
    if (ageH >= 72) why = `${Math.round(ageH / 24)} روز بی‌فعالیت`
    else if (l.stage === 'negotiation') why = 'در مذاکره — نزدیکِ بستن'
    else if (l.stage === 'visit') why = 'بعد از بازدید، پیگیری کن'
    else if (sc >= 70) why = 'امتیازِ بالا'
    else why = 'پیگیریِ عادی'
    return { id: l.id, name: l.name, phone: l.phone, score: sc, why, ageH }
  }).filter(x => x.ageH >= 24 || x.score >= 60 || false)
    .sort((x, y) => y.score - x.score).slice(0, 8)
  const callNow = ranked.map(({ id, name, phone, score, why }) => ({ id, name, phone, score, why }))

  // خلاصهٔ وضعیت برای تحلیل
  const byStage = STAGES.map(s => ({ s, n: a.leads.filter(l => l.stage === s).length }))
  const won = a.leads.filter(l => l.stage === 'closed').length
  const conv = a.leads.length ? Math.round((won / a.leads.length) * 100) : 0
  const noPhone = open.filter(l => !l.phone).length
  const stale = open.filter(l => (now - (l.lastActivityAt || l.createdAt)) / 36e5 >= 72).length

  // تحلیلِ قاعده‌مند (پیش‌فرض)
  const tips: string[] = []
  if (stale > 0) tips.push(`${stale} لید بیش از ۳ روز بی‌پیگیری مانده — امروز تماس بگیر.`)
  if (noPhone > 0) tips.push(`${noPhone} لید شمارهٔ تماس ندارد — شماره‌شان را کامل کن.`)
  const negC = a.leads.filter(l => l.stage === 'negotiation').length
  if (negC > 0) tips.push(`${negC} لید در مذاکره است — نزدیک‌ترین‌ها به بستنِ قرارداد؛ اولویت بده.`)
  if (!tips.length) tips.push('پایپ‌لاین سالم است — لیدهای جدید را سریع وارد چرخه کن.')
  let health = `از ${a.leads.length} لید، ${won} به قرارداد رسیده (نرخِ تبدیل ${conv}٪). ${open.length} لیدِ باز داری.`

  // اگر AI فعال بود، یک تحلیلِ کوتاهِ حرفه‌ای جایگزینِ health می‌شود (اختیاری، با fallback).
  try {
    const model = agentModel('chat', 'text')
    if (model) {
      const provider = agentProvider('chat', 'text')
      const summary = byStage.map(x => `${STAGE_FA[x.s]}: ${x.n}`).join('، ')
      const txt = await chatCompleteSafe(model, [
        { role: 'system', content: 'تو مشاورِ فروشِ املاک هستی. خیلی کوتاه (حداکثر ۲ جمله)، فارسی و عملی تحلیل کن. بدون مقدمه.' },
        { role: 'user', content: `وضعیتِ پایپ‌لاینِ من: ${summary}. نرخِ تبدیل ${conv}٪. ${stale} لیدِ عقب‌افتاده. تحلیلِ کوتاه و یک توصیهٔ کلیدی بده.` },
      ], { temperature: 0.4, max_tokens: 220, ...(provider ? {} : {}) }, provider)
      if (txt && txt.trim()) health = txt.trim()
    }
  } catch {}
  return { callNow, health, tips }
}

// پیشنهادِ اقدامِ بعدی برای یک لیدِ خاص (AI با fallbackِ قاعده‌مند).
export async function advisorLeadAdvice(o: string, lid: string): Promise<string> {
  const a = await getAdvisor(o)
  const l = a.leads.find(x => x.id === lid)
  if (!l) return 'لید یافت نشد.'
  const acts = (l.activities || []).slice(-5).map(x => x.type).join('، ') || 'بدونِ فعالیت'
  const rel = a.listings.filter(x => x.status === 'active').slice(0, 20)
  // پیشنهادِ فایلِ متناسب (قاعده‌مند): تطبیقِ نوع/بودجه از متنِ نیاز
  const needTxt = (l.need || '').toLowerCase()
  const budgetNum = Number(String(l.budget || '').replace(/[^\d۰-۹]/g, '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))) || 0
  const match = rel.filter(x => (!budgetNum || (x.price <= budgetNum * 1.15)) && (!needTxt || needTxt.split(/\s+/).some(w => w.length > 2 && (x.ptype.includes(w) || (x.neighborhood || '').includes(w) || (x.city || '').includes(w))))).slice(0, 3)
  const matchLine = match.length ? `\nفایل‌های پیشنهادی برای این لید:\n${match.map(x => `• ${x.title} — ${x.price.toLocaleString('fa-IR')} تومان`).join('\n')}` : ''

  try {
    const model = agentModel('chat', 'text')
    if (model) {
      const provider = agentProvider('chat', 'text')
      const txt = await chatCompleteSafe(model, [
        { role: 'system', content: 'تو مشاورِ ارشدِ فروشِ املاک هستی. فارسی، کوتاه و عملی. ۲ تا ۴ گامِ مشخصِ بعدی برای این لید بده (شماره‌دار). بدون مقدمهٔ اضافه.' },
        { role: 'user', content: `لید: ${l.name}. مرحله: ${STAGE_FA[l.stage]}. نیاز: ${l.need || '—'}. بودجه: ${l.budget || '—'}. آخرین فعالیت‌ها: ${acts}. اقدامِ بعدی چه باشد؟` },
      ], { temperature: 0.5, max_tokens: 320 }, provider)
      if (txt && txt.trim()) return txt.trim() + matchLine
    }
  } catch {}
  // fallback قاعده‌مند
  const base: Record<Stage, string> = {
    new: '۱) همین امروز اولین تماس را بگیر و نیاز را دقیق کن.\n۲) بودجه و بازهٔ زمانی را مشخص کن.',
    contacted: '۱) دو تا سه فایلِ متناسب بفرست.\n۲) برای بازدید وقت بگیر.',
    visit: '۱) بعد از بازدید بازخورد بگیر.\n۲) اگر مثبت بود، وارد مذاکرهٔ قیمت شو.',
    negotiation: '۱) پیشنهادِ نهاییِ قیمت را جمع‌بندی کن.\n۲) برای امضای قرارداد وقت بگذار.',
    closed: 'مشتری شد ✓ — برای معرفیِ مشتریِ جدید (ریفرال) پیگیری کن.',
    lost: 'اگر شرایطش عوض شد دوباره فعالش کن؛ فعلاً روی لیدهای فعال تمرکز کن.',
  }
  return base[l.stage] + matchLine
}
