import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// استور پنل «آژانس املاک» — per-owner (هر کاربر فقط دادهٔ خودش).
const DATA_FILE = join(process.cwd(), '.agency-data.json')

export type Stage = 'new' | 'assigned' | 'visit' | 'negotiation' | 'closed' | 'lost'
export type ListingStatus = 'active' | 'sold' | 'rented'

export interface Agent { id: string; name: string; phone?: string; deals: number; leads: number; commission: number; active: boolean; createdAt: number }
export interface Listing { id: string; title: string; ptype: string; location: string; price: number; deal: 'sale' | 'rent'; status: ListingStatus; agent?: string; createdAt: number }
export interface Lead { id: string; name: string; phone?: string; need?: string; budget?: string; stage: Stage; assignedTo?: string; createdAt: number }
export interface Deal { id: string; title: string; amount: number; agent: string; date: string; createdAt: number }
export interface MonthSale { month: string; amount: number }

export interface AgencyData {
  profile: { name: string; branches?: string }
  agents: Agent[]
  listings: Listing[]
  leads: Lead[]
  deals: Deal[]
  monthlySales: MonthSale[]
  createdAt: number
}

interface DB { agencies: Record<string, AgencyData> }
function id(p = '') { return p + randomBytes(5).toString('hex') }
function load(): DB { if (existsSync(DATA_FILE)) { try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {} } return { agencies: {} } }
function save(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

export const STAGES: Stage[] = ['new', 'assigned', 'visit', 'negotiation', 'closed', 'lost']
const LISTING_STATUSES: ListingStatus[] = ['active', 'sold', 'rented']

function seed(): AgencyData {
  const now = Date.now(); const day = 86400000
  const ag = (name: string, phone: string, deals: number, leads: number, commission: number): Agent =>
    ({ id: id('a_'), name, phone, deals, leads, commission, active: true, createdAt: now })
  const agents: Agent[] = [
    ag('سمیرا نیک‌پور', '09120000010', 8, 24, 480000000),
    ag('رضا کریمی', '09120000011', 5, 18, 300000000),
    ag('مریم حسینی', '09120000012', 6, 21, 360000000),
    ag('علی موسوی', '09120000013', 3, 12, 180000000),
  ]
  const an = (i: number) => agents[i].name
  const li = (title: string, ptype: string, location: string, price: number, deal: 'sale' | 'rent', status: ListingStatus, agentIdx: number, ageDays: number): Listing =>
    ({ id: id('f_'), title, ptype, location, price, deal, status, agent: an(agentIdx), createdAt: now - ageDays * day })
  const listings: Listing[] = [
    li('آپارتمان نوساز سعادت‌آباد', 'آپارتمان', 'سعادت‌آباد', 8500000000, 'sale', 'active', 0, 10),
    li('ویلا باغ لواسان', 'ویلا', 'لواسان', 25000000000, 'sale', 'active', 1, 15),
    li('آپارتمان اجاره‌ای ونک', 'آپارتمان', 'ونک', 2000000000, 'rent', 'active', 2, 5),
    li('مغازه تجاری تجریش', 'مغازه', 'تجریش', 6000000000, 'sale', 'sold', 0, 40),
    li('پنت‌هاوس فرشته', 'آپارتمان', 'فرشته', 45000000000, 'sale', 'active', 1, 8),
  ]
  const ld = (name: string, phone: string, need: string, budget: string, stage: Stage, agentIdx: number, ageDays: number): Lead =>
    ({ id: id('l_'), name, phone, need, budget, stage, assignedTo: agentIdx >= 0 ? an(agentIdx) : undefined, createdAt: now - ageDays * day })
  const leads: Lead[] = [
    ld('کاربر اول', '09120000001', 'آپارتمان ۲ خوابه سعادت‌آباد', '۸ میلیارد', 'negotiation', 0, 1),
    ld('کاربر دوم', '09120000002', 'ویلا لواسان', '۲۵ میلیارد', 'visit', 1, 2),
    ld('کاربر سوم', '09120000003', 'اجاره ونک', 'رهن ۲ میلیارد', 'assigned', 2, 3),
    ld('کاربر چهارم', '09120000004', 'پنت‌هاوس فرشته', '۴۵ میلیارد', 'new', -1, 0),
  ]
  const dl = (title: string, amount: number, agentIdx: number, date: string, ageDays: number): Deal =>
    ({ id: id('d_'), title, amount, agent: an(agentIdx), date, createdAt: now - ageDays * day })
  const deals: Deal[] = [
    dl('فروش مغازه تجریش', 6000000000, 0, '۱۴۰۴/۰۲/۱۵', 40),
    dl('اجاره آپارتمان جردن', 1800000000, 2, '۱۴۰۴/۰۳/۱۰', 12),
    dl('فروش آپارتمان ولنجک', 12000000000, 1, '۱۴۰۴/۰۳/۲۰', 6),
  ]
  const monthlySales: MonthSale[] = [
    { month: 'آذر', amount: 8000000000 }, { month: 'دی', amount: 12000000000 }, { month: 'بهمن', amount: 9000000000 },
    { month: 'اسفند', amount: 15000000000 }, { month: 'فروردین', amount: 11000000000 }, { month: 'اردیبهشت', amount: 19800000000 },
  ]
  return { profile: { name: 'املاک برتر', branches: 'سعادت‌آباد، ونک' }, agents, listings, leads, deals, monthlySales, createdAt: now }
}

export function getAgency(o: string): AgencyData {
  const db = load(); if (!db.agencies[o]) { db.agencies[o] = seed(); save(db) } return db.agencies[o]
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
    profile: a.profile,
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
  return mutate(o, a => { Object.assign(a.profile, patch) }).profile
}
