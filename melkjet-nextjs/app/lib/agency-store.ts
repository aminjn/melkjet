import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { getProfile, saveProfile } from './profile-store'
import { getAccount } from './account-store'
import { pgEnabled, kvGet, kvMutate } from './db'
import { chatCompleteSafe, agentModel, agentProvider } from './gapgpt'

// استور پنل «آژانس املاک» — per-owner (هر کاربر فقط دادهٔ خودش).
// دومَحاله: اگر DATABASE_URL ست باشد → Postgres (نوشتنِ اتمیک)، وگرنه فایل.
const DATA_FILE = join(process.cwd(), '.agency-data.json')
const KV_KEY = 'agency'

// نامِ نمایشیِ آژانس: نامِ کسب‌وکار (پروفایل) → نامِ تنظیماتِ آژانس → نامِ حساب (شخصی، آخرین چاره)
export async function resolveAgencyName(phone: string, storedName?: string): Promise<string> {
  try { const bp = getProfile(phone); const n = (bp.businessName || bp.displayName || '').trim(); if (n) return n } catch {}
  const s = (storedName || '').trim(); if (s) return s
  return getAccount(phone)?.name || ''
}

export type Stage = 'new' | 'assigned' | 'visit' | 'negotiation' | 'closed' | 'lost'
export type ListingStatus = 'active' | 'sold' | 'rented'

export interface Agent { id: string; name: string; phone?: string; deals: number; leads: number; commission: number; active: boolean; createdAt: number }
export interface Listing {
  id: string; title: string; ptype: string; location: string; price: number; deal: 'sale' | 'rent'; status: ListingStatus; agent?: string; createdAt: number
  // مشخصاتِ کاملِ فایل (مثلِ پنل مشاور) — همه اختیاری
  province?: string; city?: string; district?: string; neighborhood?: string; address?: string
  rentMonthly?: number; area?: number; rooms?: number; floor?: number; totalFloors?: number; yearBuilt?: number
  facing?: string; docType?: string; phone?: string; description?: string
  parking?: boolean; elevator?: boolean; storage?: boolean; balcony?: boolean; furnished?: boolean
  amenities?: string[]; images?: string[]
}
export type ActivityType = 'created' | 'call' | 'visit' | 'meeting' | 'sms' | 'whatsapp' | 'email' | 'note' | 'stage' | 'assign'
export interface Activity { id: string; type: ActivityType; at: number; note?: string }
export interface Lead { id: string; name: string; phone?: string; email?: string; need?: string; budget?: string; stage: Stage; assignedTo?: string; createdAt: number; activities?: Activity[]; score?: number; tags?: string[]; lastActivityAt?: number; reminderAt?: number }
export interface Deal { id: string; title: string; amount: number; agent: string; date: string; createdAt: number }
export interface MonthSale { month: string; amount: number }
export type CommMode = 'percent' | 'amount'
export interface CommissionConfig { defaultMode: CommMode; defaultValue: number; perAgent: Record<string, { mode: CommMode; value: number }> }

export interface AgencyData {
  profile: { name: string; branches?: string }
  agents: Agent[]
  listings: Listing[]
  leads: Lead[]
  deals: Deal[]
  monthlySales: MonthSale[]
  commission?: CommissionConfig   // سهمِ آژانس از کمیسیونِ مشاوران (پیش‌فرض + per-advisor)
  createdAt: number
}

interface DB { agencies: Record<string, AgencyData> }
function id(p = '') { return p + randomBytes(5).toString('hex') }

function fileLoad(): DB { if (existsSync(DATA_FILE)) { try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {} } return { agencies: {} } }
function fileSave(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, { agencies: {} }) : fileLoad() }
// wrapperِ عمومیِ خواندن-تغییر-نوشتن (نامش withDb تا با mutate(owner) پایین تداخل نکند)
async function withDb<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, { agencies: {} }, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

export const STAGES: Stage[] = ['new', 'assigned', 'visit', 'negotiation', 'closed', 'lost']
const LISTING_STATUSES: ListingStatus[] = ['active', 'sold', 'rented']

function seed(): AgencyData {
  // حسابِ آژانس خالی شروع می‌شود — هیچ دادهٔ نمونه‌ای نیست؛ همه‌چیز واقعی است.
  return { profile: { name: '', branches: '' }, agents: [], listings: [], leads: [], deals: [], monthlySales: [], commission: { defaultMode: 'percent', defaultValue: 30, perAgent: {} }, createdAt: Date.now() }
}

// ── پیکربندیِ کمیسیونِ آژانس از مشاوران ──────────────────────────────────────
export async function getCommissionConfig(o: string): Promise<CommissionConfig> {
  const c = (await getAgency(o)).commission
  return { defaultMode: c?.defaultMode || 'percent', defaultValue: c?.defaultValue ?? 30, perAgent: c?.perAgent || {} }
}
export async function setDefaultCommission(o: string, mode: CommMode, value: number): Promise<CommissionConfig> {
  const m: CommMode = mode === 'amount' ? 'amount' : 'percent'
  const v = Math.max(0, Number(value) || 0)
  const cur = await getCommissionConfig(o)
  return (await mutate(o, a => { a.commission = { ...cur, defaultMode: m, defaultValue: v } })).commission!
}
export async function setAgentCommission(o: string, advisorPhone: string, mode: CommMode, value: number): Promise<CommissionConfig> {
  const m: CommMode = mode === 'amount' ? 'amount' : 'percent'
  const v = Math.max(0, Number(value) || 0)
  const cur = await getCommissionConfig(o)
  return (await mutate(o, a => { a.commission = { ...cur, perAgent: { ...cur.perAgent, [String(advisorPhone)]: { mode: m, value: v } } } })).commission!
}
export async function clearAgentCommission(o: string, advisorPhone: string): Promise<CommissionConfig> {
  const cur = await getCommissionConfig(o)
  return (await mutate(o, a => { const pa = { ...cur.perAgent }; delete pa[String(advisorPhone)]; a.commission = { ...cur, perAgent: pa } })).commission!
}
// آیا این دادهٔ ذخیره‌شده همان نمونهٔ قدیمیِ دست‌نخورده است؟ (برای پاک‌سازیِ خودکار)
function isLegacyDemo(d: AgencyData): boolean {
  return d?.profile?.name === 'املاک برتر' && (d.agents || []).some(a => a.name === 'سمیرا نیک‌پور')
}

// seed/پاک‌سازیِ خودکار را روی db برای مالکِ o اعمال می‌کند؛ برمی‌گرداند که آیا چیزی تغییر کرد (نیاز به ذخیره).
function applyAgency(db: DB, o: string): boolean {
  if (!db.agencies[o]) { db.agencies[o] = seed(); return true }
  if (isLegacyDemo(db.agencies[o])) { db.agencies[o] = seed(); return true }   // پاک‌سازیِ خودکارِ دادهٔ نمونهٔ قدیمی
  return false
}

export async function getAgency(o: string): Promise<AgencyData> {
  const db = await load()
  // اگر seed/پاک‌سازی لازم نبود، بدونِ نوشتن برگردان (مثلِ قبل که فقط وقتی تغییر بود ذخیره می‌شد).
  if (!applyAgency(db, o)) return db.agencies[o]
  return withDb(d => { applyAgency(d, o); return d.agencies[o] })
}
async function mutate(o: string, fn: (a: AgencyData) => void): Promise<AgencyData> {
  return withDb(db => { if (!db.agencies[o]) db.agencies[o] = seed(); fn(db.agencies[o]); return db.agencies[o] })
}

export async function agencyStats(o: string) {
  const a = await getAgency(o)
  const activeAgents = a.agents.filter(g => g.active)
  const activeListings = a.listings.filter(l => l.status === 'active')
  const openLeads = a.leads.filter(l => l.stage !== 'closed' && l.stage !== 'lost')
  const totalCommission = a.agents.reduce((s, g) => s + g.commission, 0)
  const months = a.monthlySales
  const thisMonth = months.length ? months[months.length - 1].amount : 0
  const prev = months.length > 1 ? months[months.length - 2].amount : 0
  const monthChange = prev ? Math.round(((thisMonth - prev) / prev) * 100) : 0
  const dealsThisMonth = a.deals.filter(d => Date.now() - d.createdAt < 31 * 86400000).length
  const topAgents = [...a.agents].sort((x, y) => y.deals - x.deals).slice(0, 4)
  const name = await resolveAgencyName(o, a.profile.name)
  return {
    profile: { ...a.profile, name },
    kpis: {
      activeAgents: activeAgents.length, totalAgents: a.agents.length, activeListings: activeListings.length,
      openLeads: openLeads.length, dealsThisMonth, monthSales: thisMonth, monthChange, totalCommission,
    },
    monthlySales: months,
    topAgents,
    recentLeads: [...a.leads].sort((x, y) => y.createdAt - x.createdAt).slice(0, 6),
    recentDeals: [...a.deals].sort((x, y) => y.createdAt - x.createdAt).slice(0, 6),
  }
}

// ---- Agents ----
export async function addAgent(o: string, input: { name: string; phone?: string }): Promise<Agent> {
  let c!: Agent
  await mutate(o, a => { c = { id: id('a_'), name: input.name, phone: input.phone, deals: 0, leads: 0, commission: 0, active: true, createdAt: Date.now() }; a.agents.unshift(c) })
  return c
}
export async function toggleAgent(o: string, gid: string): Promise<Agent | null> {
  let res: Agent | null = null
  await mutate(o, a => { const g = a.agents.find(x => x.id === gid); if (!g) return; g.active = !g.active; res = g })
  return res
}
export async function deleteAgent(o: string, gid: string): Promise<void> { await mutate(o, a => { a.agents = a.agents.filter(g => g.id !== gid) }) }

// ---- Listings ----
const num = (v: any) => (v === undefined || v === null || v === '') ? undefined : (Number(v) || undefined)
export async function addListing(o: string, input: Partial<Listing>): Promise<Listing> {
  let c!: Listing
  // موقعیتِ خوانا را از استان/شهر/محله می‌سازد اگر location خالی باشد.
  const loc = String(input.location || '') || [input.neighborhood, input.district, input.city].filter(Boolean).join('، ')
  await mutate(o, a => {
    c = {
      id: id('f_'), title: String(input.title || 'فایل'), ptype: String(input.ptype || 'آپارتمان'), location: loc,
      price: Number(input.price) || 0, deal: input.deal === 'rent' ? 'rent' : 'sale', status: 'active', agent: input.agent, createdAt: Date.now(),
      province: input.province || undefined, city: input.city || undefined, district: input.district || undefined, neighborhood: input.neighborhood || undefined, address: input.address || undefined,
      rentMonthly: num(input.rentMonthly), area: num(input.area), rooms: num(input.rooms), floor: num(input.floor), totalFloors: num(input.totalFloors), yearBuilt: num(input.yearBuilt),
      facing: input.facing || undefined, docType: input.docType || undefined, phone: input.phone || undefined, description: input.description || undefined,
      parking: !!input.parking, elevator: !!input.elevator, storage: !!input.storage, balcony: !!input.balcony, furnished: !!input.furnished,
      amenities: Array.isArray(input.amenities) ? input.amenities : undefined, images: Array.isArray(input.images) ? input.images : undefined,
    }
    a.listings.unshift(c)
  })
  return c
}
export async function setListingStatus(o: string, fid: string, status: ListingStatus): Promise<Listing | null> {
  if (!LISTING_STATUSES.includes(status)) return null
  let res: Listing | null = null
  await mutate(o, a => { const l = a.listings.find(x => x.id === fid); if (!l) return; l.status = status; res = l })
  return res
}
export async function assignListing(o: string, fid: string, agent: string): Promise<Listing | null> {
  let res: Listing | null = null
  await mutate(o, a => { const l = a.listings.find(x => x.id === fid); if (!l) return; l.agent = agent; res = l })
  return res
}
export async function deleteListing(o: string, fid: string): Promise<void> { await mutate(o, a => { a.listings = a.listings.filter(l => l.id !== fid) }) }

// ---- Leads ----
// امتیازِ خودکارِ لید (۰..۱۰۰) — کاملیِ اطلاعات + پیشرفتِ مرحله + تازگیِ فعالیت + تخصیص.
export function leadScore(l: Lead): number {
  if (l.stage === 'closed') return 92; if (l.stage === 'lost') return 5
  let s = 12 + Math.max(0, STAGES.indexOf(l.stage)) * 6
  if (l.phone) s += 14; if (l.budget) s += 10; if (l.need) s += 6; if (l.assignedTo) s += 6
  const acts = (l.activities || []).filter(a => a.type !== 'created' && a.type !== 'stage')
  s += Math.min(12, acts.length * 3)
  const last = l.lastActivityAt || l.createdAt
  const ageH = (Date.now() - last) / 36e5
  if (ageH <= 24) s += 10; else if (ageH <= 24 * 7) s += 5
  return Math.max(0, Math.min(100, Math.round(s)))
}
export async function addLead(o: string, input: Partial<Lead>): Promise<Lead> {
  let c!: Lead
  await mutate(o, a => {
    const now = Date.now()
    c = { id: id('l_'), name: String(input.name || 'لید'), phone: input.phone, email: input.email, need: input.need, budget: input.budget, stage: STAGES.includes(input.stage as Stage) ? input.stage as Stage : 'new', assignedTo: input.assignedTo, createdAt: now, lastActivityAt: now, tags: [], activities: [{ id: id('ac_'), type: 'created', at: now, note: 'ثبتِ لید' }] }
    c.score = leadScore(c)
    a.leads.unshift(c)
  })
  return c
}
export async function assignLead(o: string, lid: string, agent: string): Promise<Lead | null> {
  let res: Lead | null = null
  await mutate(o, a => {
    const l = a.leads.find(x => x.id === lid); if (!l) return
    l.assignedTo = agent; if (l.stage === 'new') l.stage = 'assigned'
    l.activities = [...(l.activities || []), { id: id('ac_'), type: 'assign', at: Date.now(), note: agent ? `تخصیص به ${agent}` : 'لغوِ تخصیص' }]
    l.lastActivityAt = Date.now(); l.score = leadScore(l); res = l
  })
  return res
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
// ثبتِ فعالیت روی تایم‌لاینِ لیدِ آژانس + اتوماسیونِ سبکِ مرحله.
export async function addLeadActivity(o: string, lid: string, act: { type: ActivityType; note?: string }): Promise<Lead | null> {
  let res: Lead | null = null
  await mutate(o, a => {
    const l = a.leads.find(x => x.id === lid); if (!l) return
    const now = Date.now()
    l.activities = [...(l.activities || []), { id: id('ac_'), type: act.type, at: now, note: act.note }]
    l.lastActivityAt = now
    if (l.stage === 'new' && (act.type === 'call' || act.type === 'sms')) l.stage = 'assigned'
    if (act.type === 'visit' && (l.stage === 'new' || l.stage === 'assigned')) l.stage = 'visit'
    l.score = leadScore(l); res = l
  })
  return res
}
// یادآورِ پیگیری (Task & Reminder)
export async function setLeadReminder(o: string, lid: string, at: number | null): Promise<Lead | null> {
  let res: Lead | null = null
  await mutate(o, a => {
    const l = a.leads.find(x => x.id === lid); if (!l) return
    l.reminderAt = at && at > 0 ? at : undefined
    l.activities = [...(l.activities || []), { id: id('ac_'), type: 'note', at: Date.now(), note: at ? 'یادآورِ پیگیری تنظیم شد' : 'یادآور حذف شد' }]
    l.lastActivityAt = Date.now(); res = l
  })
  return res
}
export async function deleteLead(o: string, lid: string): Promise<void> { await mutate(o, a => { a.leads = a.leads.filter(l => l.id !== lid) }) }

// ---- Deals ----
export async function addDeal(o: string, input: { title: string; amount: number; agent: string; date: string }): Promise<Deal> {
  let c!: Deal
  await mutate(o, a => { c = { id: id('d_'), title: input.title, amount: Number(input.amount) || 0, agent: input.agent, date: input.date, createdAt: Date.now() }; a.deals.unshift(c); const g = a.agents.find(x => x.name === input.agent); if (g) g.deals += 1 })
  return c
}

export async function listAgents(o: string): Promise<Agent[]> { return (await getAgency(o)).agents }
export async function listListings(o: string): Promise<Listing[]> { return (await getAgency(o)).listings }
export async function listLeads(o: string): Promise<Lead[]> { return (await getAgency(o)).leads }
export async function listDeals(o: string): Promise<Deal[]> { return (await getAgency(o)).deals }
export async function updateAgencyProfile(o: string, patch: Partial<AgencyData['profile']>): Promise<AgencyData['profile']> {
  const res = (await mutate(o, a => { Object.assign(a.profile, patch) })).profile
  // نامِ آژانس را با نامِ کسب‌وکارِ پروفایل هم‌گام کن تا همه‌جا (لینکِ مشاوران، پروفایلِ عمومی) یکی باشد
  if (patch.name !== undefined && String(patch.name).trim()) { try { saveProfile(o, { businessName: String(patch.name).trim() }) } catch {} }
  return res
}

// ═══════════ هوشِ CRM آژانس (Sales OS) ═══════════
const STAGE_FA: Record<Stage, string> = { new: 'لید جدید', assigned: 'تخصیص‌یافته', visit: 'بازدید', negotiation: 'مذاکره', closed: 'قرارداد', lost: 'ازدست‌رفته' }

// «با کی تماس بگیرم» + سلامتِ پایپ‌لاینِ آژانس (قاعده‌مند؛ اگر AI بود، تحلیلِ متنی هم اضافه می‌شود).
export async function agencyAiInsights(o: string): Promise<{ callNow: { id: string; name: string; phone?: string; score: number; why: string; assignedTo?: string }[]; health: string; tips: string[] }> {
  const a = await getAgency(o)
  const open = a.leads.filter(l => l.stage !== 'closed' && l.stage !== 'lost')
  const now = Date.now()
  const ranked = open.map(l => {
    const sc = leadScore(l)
    const ageH = (now - (l.lastActivityAt || l.createdAt)) / 36e5
    let why = ''
    if (!l.assignedTo) why = 'تخصیص‌نیافته — به یک مشاور بده'
    else if (ageH >= 72) why = `${Math.round(ageH / 24)} روز بی‌فعالیت`
    else if (l.stage === 'negotiation') why = 'در مذاکره — نزدیکِ بستن'
    else if (sc >= 70) why = 'امتیازِ بالا'
    else why = 'پیگیریِ عادی'
    return { id: l.id, name: l.name, phone: l.phone, score: sc, why, assignedTo: l.assignedTo, ageH, unassigned: !l.assignedTo }
  }).filter(x => x.unassigned || x.ageH >= 24 || x.score >= 60)
    .sort((x, y) => (x.unassigned === y.unassigned ? y.score - x.score : x.unassigned ? -1 : 1)).slice(0, 8)
  const callNow = ranked.map(({ id, name, phone, score, why, assignedTo }) => ({ id, name, phone, score, why, assignedTo }))

  const won = a.leads.filter(l => l.stage === 'closed').length
  const conv = a.leads.length ? Math.round((won / a.leads.length) * 100) : 0
  const unassigned = open.filter(l => !l.assignedTo).length
  const stale = open.filter(l => (now - (l.lastActivityAt || l.createdAt)) / 36e5 >= 72).length
  const tips: string[] = []
  if (unassigned > 0) tips.push(`${unassigned} لیدِ تخصیص‌نیافته — با «تقسیمِ هوشمند» بین مشاوران پخش کن.`)
  if (stale > 0) tips.push(`${stale} لید بیش از ۳ روز بی‌پیگیری — به مشاورِ مربوط یادآوری کن.`)
  const negC = a.leads.filter(l => l.stage === 'negotiation').length
  if (negC > 0) tips.push(`${negC} لید در مذاکره — نزدیک به بستنِ قرارداد؛ اولویت بده.`)
  if (!tips.length) tips.push('پایپ‌لاینِ آژانس سالم است — لیدهای جدید را سریع تخصیص بده.')
  let health = `از ${a.leads.length} لید، ${won} به قرارداد رسیده (نرخِ تبدیل ${conv}٪). ${open.length} لیدِ باز، ${unassigned} تخصیص‌نیافته.`

  try {
    const model = agentModel('chat', 'text')
    if (model) {
      const provider = agentProvider('chat', 'text')
      const byStage = STAGES.map(s => `${STAGE_FA[s]}: ${a.leads.filter(l => l.stage === s).length}`).join('، ')
      const txt = await chatCompleteSafe(model, [
        { role: 'system', content: 'تو مدیرِ فروشِ آژانسِ املاک هستی. خیلی کوتاه (حداکثر ۲ جمله)، فارسی و عملی تحلیل کن. بدون مقدمه.' },
        { role: 'user', content: `پایپ‌لاینِ آژانس: ${byStage}. نرخِ تبدیل ${conv}٪. ${unassigned} لیدِ تخصیص‌نیافته، ${stale} عقب‌افتاده. تحلیلِ کوتاه + یک توصیهٔ کلیدی.` },
      ], { temperature: 0.4, max_tokens: 220 }, provider)
      if (txt && txt.trim()) health = txt.trim()
    }
  } catch {}
  return { callNow, health, tips }
}

// پیشنهادِ اقدامِ بعدی برای یک لیدِ آژانس (AI با fallbackِ قاعده‌مند).
export async function agencyLeadAdvice(o: string, lid: string): Promise<string> {
  const a = await getAgency(o)
  const l = a.leads.find(x => x.id === lid)
  if (!l) return 'لید یافت نشد.'
  const acts = (l.activities || []).slice(-5).map(x => x.type).join('، ') || 'بدونِ فعالیت'
  const rel = a.listings.filter(x => x.status === 'active').slice(0, 20)
  const needTxt = (l.need || '').toLowerCase()
  const budgetNum = Number(String(l.budget || '').replace(/[^\d۰-۹]/g, '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))) || 0
  const match = rel.filter(x => (!budgetNum || x.price <= budgetNum * 1.15) && (!needTxt || needTxt.split(/\s+/).some(w => w.length > 2 && (x.ptype.includes(w) || (x.neighborhood || '').includes(w) || (x.city || '').includes(w))))).slice(0, 3)
  const matchLine = match.length ? `\nفایل‌های پیشنهادی:\n${match.map(x => `• ${x.title} — ${x.price.toLocaleString('fa-IR')} تومان`).join('\n')}` : ''
  try {
    const model = agentModel('chat', 'text')
    if (model) {
      const provider = agentProvider('chat', 'text')
      const txt = await chatCompleteSafe(model, [
        { role: 'system', content: 'تو مدیرِ فروشِ آژانسِ املاک هستی. فارسی، کوتاه و عملی. ۲ تا ۴ گامِ مشخصِ بعدی برای این لید بده (شماره‌دار). بدون مقدمه.' },
        { role: 'user', content: `لید: ${l.name}. مرحله: ${STAGE_FA[l.stage]}. مشاورِ مسئول: ${l.assignedTo || 'تخصیص‌نیافته'}. نیاز: ${l.need || '—'}. بودجه: ${l.budget || '—'}. آخرین فعالیت‌ها: ${acts}. اقدامِ بعدی؟` },
      ], { temperature: 0.5, max_tokens: 320 }, provider)
      if (txt && txt.trim()) return txt.trim() + matchLine
    }
  } catch {}
  const base: Record<Stage, string> = {
    new: '۱) لید را به مناسب‌ترین مشاور تخصیص بده.\n۲) اولین تماس را همین امروز هماهنگ کن.',
    assigned: '۱) مطمئن شو مشاور تماس گرفته.\n۲) فایلِ متناسب را برایش بفرست و بازدید بگذار.',
    visit: '۱) بازخوردِ بازدید را از مشاور بگیر.\n۲) اگر مثبت بود وارد مذاکره شوید.',
    negotiation: '۱) روی قیمتِ نهایی و شرایط با مشاور هماهنگ شو.\n۲) برای قرارداد وقت بگذار.',
    closed: 'قرارداد بسته شد ✓ — کمیسیون را ثبت و برای ریفرال پیگیری کن.',
    lost: 'اگر شرایط عوض شد دوباره فعالش کن؛ فعلاً روی لیدهای فعال تمرکز کن.',
  }
  return base[l.stage] + matchLine
}
