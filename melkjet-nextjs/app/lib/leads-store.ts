import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'

// ── استورِ لیدهای CRM (Sales OS) ──
// دومَحاله: اگر DATABASE_URL ست باشد → Postgres (نوشتنِ اتمیک)، وگرنه فایل.
// مدلِ کامل: وضعیتِ سلامت (status) + مرحلهٔ فروش (stage/pipeline) + امتیازِ خودکار (score) +
// تایم‌لاینِ فعالیت (activities) + تگ (tags) + آگهی‌های متصل (listingIds).
const DATA_FILE = join(process.cwd(), '.leads-data.json')
const KV_KEY = 'leads'

// مرحلهٔ pipeline فروش (Drag & Drop). سوپرمجموعهٔ شناسه‌ها: نقشِ املاک از pipelineِ ۷مرحله‌ای
// (contacted/sent/visited/negotiation/won) استفاده می‌کند و بقیهٔ نقش‌ها از ۵ شناسهٔ کلاسیک
// (review/offered/…). همه معتبرند تا هیچ پنلی نشکند؛ برچسبِ نمایشی در UI نقش‌محور است.
export type Stage = 'new' | 'contacted' | 'sent' | 'visited' | 'negotiation' | 'review' | 'offered' | 'contract' | 'won' | 'lost'
export const STAGES: Stage[] = ['new', 'contacted', 'review', 'sent', 'offered', 'visited', 'negotiation', 'contract', 'won', 'lost']
export const STAGE_LABEL: Record<Stage, string> = {
  new: 'لید جدید', contacted: 'تماس', sent: 'ارسال فایل', visited: 'بازدید', negotiation: 'مذاکره',
  review: 'در حال بررسی', offered: 'پیشنهاد', contract: 'قرارداد', won: 'فروش', lost: 'ازدست‌رفته',
}
const normStage = (s: any): Stage => { const v = String(s || 'new'); return (STAGES as string[]).includes(v) ? v as Stage : 'new' }
// «بسته‌شدهٔ موفق»: هم قرارداد (۵مرحله‌ای) و هم فروش (۷مرحله‌ای).
const isWon = (st: Stage) => st === 'contract' || st === 'won'

// وضعیتِ سلامتِ لید (blueprint).
export type LeadStatus = 'new' | 'hot' | 'cold' | 'lost' | 'converted'
export const STATUSES: LeadStatus[] = ['new', 'hot', 'cold', 'lost', 'converted']
export const STATUS_LABEL: Record<LeadStatus, string> = { new: 'جدید', hot: 'داغ', cold: 'سرد', lost: 'ازدست‌رفته', converted: 'تبدیل‌شده' }

// نوعِ فعالیت در تایم‌لاین.
export type ActivityType = 'created' | 'call' | 'visit' | 'message' | 'sms' | 'email' | 'whatsapp' | 'click' | 'note' | 'stage' | 'match'
export interface Activity { id: string; type: ActivityType; at: number; note?: string; meta?: Record<string, any> }

export interface Lead {
  id: string
  name: string
  phone?: string
  need?: string
  budget?: number          // بودجه (تومان) — برای Matching
  budgetText?: string      // متنِ خامِ بودجه (نمایش)
  area?: number            // متراژِ موردنظر
  region?: string          // منطقه/محلهٔ موردنظر
  dealType?: 'sale' | 'rent' | ''
  stage: Stage
  status: LeadStatus
  score: number            // ۰..۱۰۰ خودکار
  tags: string[]
  autoTags?: string[]      // تگِ هوشمندِ قانون‌محور (مشتق، ذخیره نمی‌شود)
  listingIds: string[]     // آگهی‌های متصل/پیشنهادشده
  activities: Activity[]
  source?: string
  note?: string
  owner?: string
  createdAt: number
  updatedAt: number
  lastActivityAt?: number
}

interface DB { leads: Lead[] }
function id() { return randomBytes(6).toString('hex') }
const num = (v: any): number | undefined => { const n = Number(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) && n > 0 ? n : undefined }

function fileLoad(): DB {
  if (existsSync(DATA_FILE)) {
    try { const raw = JSON.parse(readFileSync(DATA_FILE, 'utf-8')); return { leads: Array.isArray(raw.leads) ? raw.leads : [] } } catch {}
  }
  return { leads: [] }
}
function fileSave(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8') }

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, { leads: [] }) : fileLoad() }
async function mutate<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, { leads: [] }, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

// دادهٔ خام (قدیمی یا جدید) → شکلِ کاملِ Lead.
function migrate(raw: any): Lead {
  const stage = normStage(raw?.stage)
  const activities: Activity[] = Array.isArray(raw?.activities) ? raw.activities : []
  const lastActivityAt = raw?.lastActivityAt || (activities.length ? Math.max(...activities.map((a: Activity) => a.at || 0)) : (raw?.updatedAt || raw?.createdAt))
  let status: LeadStatus = STATUSES.includes(raw?.status) ? raw.status
    : isWon(stage) ? 'converted' : stage === 'lost' ? 'lost' : 'new'
  const lead: Lead = {
    id: String(raw?.id || id()),
    name: String(raw?.name || '').trim(),
    phone: raw?.phone ? String(raw.phone) : undefined,
    need: raw?.need ? String(raw.need) : undefined,
    budget: typeof raw?.budget === 'number' ? raw.budget : num(raw?.budget),
    budgetText: raw?.budgetText ? String(raw.budgetText) : (typeof raw?.budget === 'string' ? raw.budget : undefined),
    area: typeof raw?.area === 'number' ? raw.area : num(raw?.area),
    region: raw?.region ? String(raw.region) : undefined,
    dealType: raw?.dealType === 'sale' || raw?.dealType === 'rent' ? raw.dealType : '',
    stage, status,
    score: typeof raw?.score === 'number' ? raw.score : 0,
    tags: Array.isArray(raw?.tags) ? raw.tags.map(String) : [],
    listingIds: Array.isArray(raw?.listingIds) ? raw.listingIds.map(String) : [],
    activities,
    source: raw?.source ? String(raw.source) : undefined,
    note: raw?.note ? String(raw.note) : undefined,
    owner: raw?.owner ? String(raw.owner) : undefined,
    createdAt: Number(raw?.createdAt) || Date.now(),
    updatedAt: Number(raw?.updatedAt) || Date.now(),
    lastActivityAt: lastActivityAt || undefined,
  }
  lead.score = scoreOf(lead)
  lead.autoTags = autoTags(lead)
  return lead
}

// ── تگ‌گذاریِ هوشمند (قانون‌محور) — روی خواندن محاسبه می‌شود، جدا از تگِ دستیِ کاربر ──
export function autoTags(l: Lead): string[] {
  const t: string[] = []
  if (l.status === 'hot') t.push('داغ')
  if ((l.budget || 0) >= 10_000_000_000) t.push('بودجه‌بالا')
  if (!l.phone) t.push('بدونِ‌شماره')
  const ageH = (l.lastActivityAt || l.createdAt) ? (Date.now() - (l.lastActivityAt || l.createdAt)) / 36e5 : 0
  if (ageH > 24 * 7 && l.stage !== 'contract' && l.stage !== 'lost') t.push('راکد')
  if (l.stage === 'offered' || l.stage === 'contract') t.push('نزدیکِ‌قرارداد')
  if ((l.score || 0) >= 70) t.push('اولویت‌بالا')
  return t
}

// ── امتیازدهیِ خودکارِ لید (Lead Scoring) ۰..۱۰۰ ──
export function scoreOf(l: Lead): number {
  let s = 0
  // وضعیتِ سلامت
  s += l.status === 'converted' ? 45 : l.status === 'hot' ? 38 : l.status === 'new' ? 14 : l.status === 'cold' ? 6 : 0
  // کاملیِ اطلاعات
  if (l.phone) s += 12
  if (l.budget) s += 10
  if (l.region || l.area) s += 6
  // پیشرفتِ pipeline
  const idx = STAGES.indexOf(l.stage)
  if (l.stage !== 'lost') s += Math.min(14, idx * 2)
  // فعالیت و تازگی
  const acts = (l.activities || []).filter(a => a.type !== 'created' && a.type !== 'stage')
  s += Math.min(12, acts.length * 3)
  const last = l.lastActivityAt || 0
  const ageH = last ? (Date.now() - last) / 36e5 : 1e9
  if (ageH <= 24) s += 12; else if (ageH <= 24 * 7) s += 6
  if (isWon(l.stage)) s = Math.max(s, 92)
  if (l.stage === 'lost' || l.status === 'lost') s = Math.min(s, 8)
  return Math.max(0, Math.min(100, Math.round(s)))
}

export async function listLeads(owner: string): Promise<Lead[]> {
  return (await load()).leads.filter(l => l.owner === owner).map(migrate).sort((a, b) => (b.score - a.score) || (b.updatedAt - a.updatedAt))
}

export async function getLead(owner: string, leadId: string): Promise<Lead | null> {
  const l = (await load()).leads.find(x => x.id === leadId && x.owner === owner)
  return l ? migrate(l) : null
}

export interface LeadInput {
  name: string
  phone?: string
  need?: string
  budget?: number | string
  area?: number | string
  region?: string
  dealType?: 'sale' | 'rent' | ''
  stage?: Stage | string
  status?: LeadStatus
  tags?: string[]
  note?: string
  source?: string
  score?: number
  owner?: string
}

export async function addLead(owner: string, input: LeadInput): Promise<Lead> {
  return mutate((db) => {
    const now = Date.now()
    const lead: Lead = migrate({
      id: id(), name: input.name, phone: input.phone, need: input.need,
      budget: input.budget, budgetText: typeof input.budget === 'string' ? input.budget : undefined,
      area: input.area, region: input.region, dealType: input.dealType,
      stage: normStage(input.stage), status: input.status || 'new',
      tags: input.tags || [], note: input.note, source: input.source, owner,
      activities: [{ id: id(), type: 'created', at: now, note: input.source ? `ثبت از ${input.source}` : 'ثبتِ لید' }],
      createdAt: now, updatedAt: now, lastActivityAt: now,
    })
    db.leads.unshift(lead)
    return lead
  })
}

export type LeadPatch = Partial<Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'activities'>> & { budget?: number | string; area?: number | string }

export async function updateLead(owner: string, leadId: string, patch: LeadPatch): Promise<Lead | null> {
  return mutate((db) => {
    const raw = db.leads.find(x => x.id === leadId && x.owner === owner)
    if (!raw) return null
    const lead = migrate(raw)
    if (patch.name !== undefined) lead.name = String(patch.name).trim()
    if (patch.phone !== undefined) lead.phone = patch.phone || undefined
    if (patch.need !== undefined) lead.need = patch.need
    if (patch.budget !== undefined) { lead.budget = num(patch.budget); lead.budgetText = typeof patch.budget === 'string' ? patch.budget : lead.budgetText }
    if (patch.area !== undefined) lead.area = num(patch.area)
    if (patch.region !== undefined) lead.region = patch.region
    if (patch.dealType !== undefined) lead.dealType = patch.dealType
    if (patch.note !== undefined) lead.note = patch.note
    if (patch.tags !== undefined && Array.isArray(patch.tags)) lead.tags = patch.tags.map(String)
    if (patch.listingIds !== undefined && Array.isArray(patch.listingIds)) lead.listingIds = patch.listingIds.map(String)
    if (patch.stage !== undefined) {
      const ns = normStage(patch.stage)
      if (ns !== lead.stage) {
        lead.activities.push({ id: id(), type: 'stage', at: Date.now(), note: `مرحله → ${STAGE_LABEL[ns]}` })
        lead.stage = ns
        if (isWon(ns)) lead.status = 'converted'
        else if (ns === 'lost') lead.status = 'lost'
        else if (lead.status === 'new') lead.status = 'hot'
      }
    }
    if (patch.status !== undefined && STATUSES.includes(patch.status)) lead.status = patch.status
    lead.updatedAt = Date.now()
    lead.score = scoreOf(lead)
    Object.assign(raw, lead)
    return lead
  })
}

// افزودنِ یک فعالیت به تایم‌لاین (تماس/بازدید/پیام/کلیک/…) + به‌روزرسانیِ score/status.
export async function addActivity(owner: string, leadId: string, act: { type: ActivityType; note?: string; meta?: Record<string, any> }): Promise<Lead | null> {
  return mutate((db) => {
    const raw = db.leads.find(x => x.id === leadId && x.owner === owner)
    if (!raw) return null
    const lead = migrate(raw)
    const now = Date.now()
    lead.activities.push({ id: id(), type: act.type, at: now, note: act.note, meta: act.meta })
    lead.lastActivityAt = now
    // تماس/بازدید/پاسخ → لید داغ می‌شود (اگر ازدست‌رفته/تبدیل نشده).
    if (['call', 'visit', 'whatsapp', 'message'].includes(act.type) && lead.status !== 'converted' && lead.status !== 'lost') lead.status = 'hot'
    lead.updatedAt = now
    lead.score = scoreOf(lead)
    Object.assign(raw, lead)
    return lead
  })
}

export async function setTags(owner: string, leadId: string, tags: string[]): Promise<Lead | null> {
  return updateLead(owner, leadId, { tags })
}

export async function linkListing(owner: string, leadId: string, listingId: string, add = true): Promise<Lead | null> {
  return mutate((db) => {
    const raw = db.leads.find(x => x.id === leadId && x.owner === owner)
    if (!raw) return null
    const lead = migrate(raw)
    const set = new Set(lead.listingIds)
    if (add) { set.add(String(listingId)); lead.activities.push({ id: id(), type: 'match', at: Date.now(), note: 'آگهی متصل شد', meta: { listingId } }) }
    else set.delete(String(listingId))
    lead.listingIds = [...set]
    lead.updatedAt = Date.now()
    lead.score = scoreOf(lead)
    Object.assign(raw, lead)
    return lead
  })
}

export async function deleteLead(owner: string, leadId: string): Promise<void> {
  await mutate((db) => { db.leads = db.leads.filter(x => !(x.id === leadId && x.owner === owner)) })
}

// لیدهایی که ≥ N ساعت پیگیری نشده‌اند و هنوز باز (نه فروش/ازدست‌رفته) — برای یادآوریِ خودکار.
export async function followUpNeeded(owner: string, hours = 24): Promise<Lead[]> {
  const cut = Date.now() - hours * 36e5
  return (await listLeads(owner)).filter(l => !isWon(l.stage) && l.stage !== 'lost' && (l.lastActivityAt || l.createdAt) < cut)
}

export interface LeadAnalytics {
  total: number
  byStage: Record<Stage, number>
  byStatus: Record<LeadStatus, number>
  conversionRate: number       // won / (کل غیرِ باز)
  revenue: number              // مجموعِ بودجهٔ فروش‌ها (won)
  activities7d: number
  needFollowUp: number
  avgScore: number
}
export async function leadAnalytics(owner: string): Promise<LeadAnalytics> {
  const leads = await listLeads(owner)
  const byStage = Object.fromEntries(STAGES.map(s => [s, 0])) as Record<Stage, number>
  const byStatus = Object.fromEntries(STATUSES.map(s => [s, 0])) as Record<LeadStatus, number>
  let revenue = 0, act7 = 0, scoreSum = 0
  const wk = Date.now() - 7 * 24 * 36e5
  for (const l of leads) {
    byStage[l.stage]++; byStatus[l.status]++
    if (isWon(l.stage)) revenue += l.budget || 0
    act7 += (l.activities || []).filter(a => a.at >= wk).length
    scoreSum += l.score
  }
  const wonCount = byStage.contract + byStage.won
  const closed = wonCount + byStage.lost
  const conversionRate = closed ? Math.round((wonCount / closed) * 100) : 0
  const need = (await followUpNeeded(owner)).length
  return { total: leads.length, byStage, byStatus, conversionRate, revenue, activities7d: act7, needFollowUp: need, avgScore: leads.length ? Math.round(scoreSum / leads.length) : 0 }
}
