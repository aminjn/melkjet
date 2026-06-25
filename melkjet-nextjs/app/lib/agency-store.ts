import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { getProfile, saveProfile } from './profile-store'
import { getAccount } from './account-store'

// استور پنل «آژانس املاک» — per-owner (هر کاربر فقط دادهٔ خودش).
const DATA_FILE = join(process.cwd(), '.agency-data.json')

// نامِ نمایشیِ آژانس: نامِ کسب‌وکار (پروفایل) → نامِ تنظیماتِ آژانس → نامِ حساب (شخصی، آخرین چاره)
export function resolveAgencyName(phone: string, storedName?: string): string {
  try { const bp = getProfile(phone); const n = (bp.businessName || bp.displayName || '').trim(); if (n) return n } catch {}
  const s = (storedName || '').trim(); if (s) return s
  return getAccount(phone)?.name || ''
}

export type Stage = 'new' | 'assigned' | 'visit' | 'negotiation' | 'closed' | 'lost'
export type ListingStatus = 'active' | 'sold' | 'rented'

export interface Agent { id: string; name: string; phone?: string; deals: number; leads: number; commission: number; active: boolean; createdAt: number }
export interface Listing { id: string; title: string; ptype: string; location: string; price: number; deal: 'sale' | 'rent'; status: ListingStatus; agent?: string; createdAt: number }
export interface Lead { id: string; name: string; phone?: string; need?: string; budget?: string; stage: Stage; assignedTo?: string; createdAt: number }
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
function load(): DB { if (existsSync(DATA_FILE)) { try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {} } return { agencies: {} } }
function save(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

export const STAGES: Stage[] = ['new', 'assigned', 'visit', 'negotiation', 'closed', 'lost']
const LISTING_STATUSES: ListingStatus[] = ['active', 'sold', 'rented']

function seed(): AgencyData {
  // حسابِ آژانس خالی شروع می‌شود — هیچ دادهٔ نمونه‌ای نیست؛ همه‌چیز واقعی است.
  return { profile: { name: '', branches: '' }, agents: [], listings: [], leads: [], deals: [], monthlySales: [], commission: { defaultMode: 'percent', defaultValue: 30, perAgent: {} }, createdAt: Date.now() }
}

// ── پیکربندیِ کمیسیونِ آژانس از مشاوران ──────────────────────────────────────
export function getCommissionConfig(o: string): CommissionConfig {
  const c = getAgency(o).commission
  return { defaultMode: c?.defaultMode || 'percent', defaultValue: c?.defaultValue ?? 30, perAgent: c?.perAgent || {} }
}
export function setDefaultCommission(o: string, mode: CommMode, value: number): CommissionConfig {
  const m: CommMode = mode === 'amount' ? 'amount' : 'percent'
  const v = Math.max(0, Number(value) || 0)
  return mutate(o, a => { a.commission = { ...getCommissionConfig(o), defaultMode: m, defaultValue: v } }).commission!
}
export function setAgentCommission(o: string, advisorPhone: string, mode: CommMode, value: number): CommissionConfig {
  const m: CommMode = mode === 'amount' ? 'amount' : 'percent'
  const v = Math.max(0, Number(value) || 0)
  return mutate(o, a => { const cur = getCommissionConfig(o); a.commission = { ...cur, perAgent: { ...cur.perAgent, [String(advisorPhone)]: { mode: m, value: v } } } }).commission!
}
export function clearAgentCommission(o: string, advisorPhone: string): CommissionConfig {
  return mutate(o, a => { const cur = getCommissionConfig(o); const pa = { ...cur.perAgent }; delete pa[String(advisorPhone)]; a.commission = { ...cur, perAgent: pa } }).commission!
}
// آیا این دادهٔ ذخیره‌شده همان نمونهٔ قدیمیِ دست‌نخورده است؟ (برای پاک‌سازیِ خودکار)
function isLegacyDemo(d: AgencyData): boolean {
  return d?.profile?.name === 'املاک برتر' && (d.agents || []).some(a => a.name === 'سمیرا نیک‌پور')
}

export function getAgency(o: string): AgencyData {
  const db = load()
  if (!db.agencies[o]) { db.agencies[o] = seed(); save(db) }
  else if (isLegacyDemo(db.agencies[o])) { db.agencies[o] = seed(); save(db) }   // پاک‌سازیِ خودکارِ دادهٔ نمونهٔ قدیمی
  return db.agencies[o]
}
function mutate(o: string, fn: (a: AgencyData) => void) { const db = load(); if (!db.agencies[o]) db.agencies[o] = seed(); fn(db.agencies[o]); save(db); return db.agencies[o] }

export function agencyStats(o: string) {
  const a = getAgency(o)
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
  return {
    profile: { ...a.profile, name: resolveAgencyName(o, a.profile.name) },
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
export function addAgent(o: string, input: { name: string; phone?: string }): Agent {
  let c!: Agent
  mutate(o, a => { c = { id: id('a_'), name: input.name, phone: input.phone, deals: 0, leads: 0, commission: 0, active: true, createdAt: Date.now() }; a.agents.unshift(c) })
  return c
}
export function toggleAgent(o: string, gid: string): Agent | null {
  let res: Agent | null = null
  mutate(o, a => { const g = a.agents.find(x => x.id === gid); if (!g) return; g.active = !g.active; res = g })
  return res
}
export function deleteAgent(o: string, gid: string) { mutate(o, a => { a.agents = a.agents.filter(g => g.id !== gid) }) }

// ---- Listings ----
export function addListing(o: string, input: Partial<Listing>): Listing {
  let c!: Listing
  mutate(o, a => { c = { id: id('f_'), title: String(input.title || 'فایل'), ptype: String(input.ptype || 'آپارتمان'), location: String(input.location || ''), price: Number(input.price) || 0, deal: input.deal === 'rent' ? 'rent' : 'sale', status: 'active', agent: input.agent, createdAt: Date.now() }; a.listings.unshift(c) })
  return c
}
export function setListingStatus(o: string, fid: string, status: ListingStatus): Listing | null {
  if (!LISTING_STATUSES.includes(status)) return null
  let res: Listing | null = null
  mutate(o, a => { const l = a.listings.find(x => x.id === fid); if (!l) return; l.status = status; res = l })
  return res
}
export function assignListing(o: string, fid: string, agent: string): Listing | null {
  let res: Listing | null = null
  mutate(o, a => { const l = a.listings.find(x => x.id === fid); if (!l) return; l.agent = agent; res = l })
  return res
}
export function deleteListing(o: string, fid: string) { mutate(o, a => { a.listings = a.listings.filter(l => l.id !== fid) }) }

// ---- Leads ----
export function addLead(o: string, input: Partial<Lead>): Lead {
  let c!: Lead
  mutate(o, a => { c = { id: id('l_'), name: String(input.name || 'لید'), phone: input.phone, need: input.need, budget: input.budget, stage: STAGES.includes(input.stage as Stage) ? input.stage as Stage : 'new', assignedTo: input.assignedTo, createdAt: Date.now() }; a.leads.unshift(c) })
  return c
}
export function assignLead(o: string, lid: string, agent: string): Lead | null {
  let res: Lead | null = null
  mutate(o, a => { const l = a.leads.find(x => x.id === lid); if (!l) return; l.assignedTo = agent; if (l.stage === 'new') l.stage = 'assigned'; res = l })
  return res
}
export function setLeadStage(o: string, lid: string, stage: Stage): Lead | null {
  if (!STAGES.includes(stage)) return null
  let res: Lead | null = null
  mutate(o, a => { const l = a.leads.find(x => x.id === lid); if (!l) return; l.stage = stage; res = l })
  return res
}
export function deleteLead(o: string, lid: string) { mutate(o, a => { a.leads = a.leads.filter(l => l.id !== lid) }) }

// ---- Deals ----
export function addDeal(o: string, input: { title: string; amount: number; agent: string; date: string }): Deal {
  let c!: Deal
  mutate(o, a => { c = { id: id('d_'), title: input.title, amount: Number(input.amount) || 0, agent: input.agent, date: input.date, createdAt: Date.now() }; a.deals.unshift(c); const g = a.agents.find(x => x.name === input.agent); if (g) g.deals += 1 })
  return c
}

export function listAgents(o: string) { return getAgency(o).agents }
export function listListings(o: string) { return getAgency(o).listings }
export function listLeads(o: string) { return getAgency(o).leads }
export function listDeals(o: string) { return getAgency(o).deals }
export function updateAgencyProfile(o: string, patch: Partial<AgencyData['profile']>) {
  const res = mutate(o, a => { Object.assign(a.profile, patch) }).profile
  // نامِ آژانس را با نامِ کسب‌وکارِ پروفایل هم‌گام کن تا همه‌جا (لینکِ مشاوران، پروفایلِ عمومی) یکی باشد
  if (patch.name !== undefined && String(patch.name).trim()) { try { saveProfile(o, { businessName: String(patch.name).trim() }) } catch {} }
  return res
}
