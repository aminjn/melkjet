import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'

const DATA_FILE = join(process.cwd(), '.builder-data.json')
const KV_KEY = 'builder'

// available=موجود برای فروش، reserved=رزرو، sold=فروخته‌شده (داخل/خارجِ سایت)،
// owner=سهمِ مالکِ زمین/مشارکت (فروشِ سازنده نیست و در پابلیک غیرقابلِ‌فروش است).
export type UnitStatus = 'sold' | 'reserved' | 'available' | 'owner'
// مرحلهٔ پرداخت (پیش‌فروش): قسط/مرحله با مبلغ و وضعیتِ پرداخت.
export interface PaymentStage { id: string; label: string; amount: number; due?: string; paid: boolean }
export interface Unit { id: string; number: string; floor: number; area: number; price: number; status: UnitStatus; buyer?: string; soldVia?: 'site' | 'offline'; plan?: PaymentStage[] }
export interface Investor { id: string; name: string; phone?: string; amount: number; units?: number }
export interface Milestone { id: string; name: string; status: 'done' | 'active' | 'pending'; date?: string }
// متادیتای واقعیِ پرشین سازه (عکس‌ها، آدرس، مختصات…) که روی پروژهٔ واردشده می‌نشیند.
export interface ProjectSource {
  hashId?: string; photos?: string[]; address?: string; region?: string; phase?: string
  lat?: number; lng?: number; groundArea?: number; residentialArea?: number; floors?: number; totalUnits?: number
}
// هزینه‌های پروژه (برای محاسبهٔ سود)
export interface ProjectFinance { landCost?: number; buildCost?: number; otherCost?: number }
export interface Project {
  id: string; name: string; location: string; phase: string; progress: number
  units: Unit[]; investors: Investor[]; milestones: Milestone[]
  monthlySales: { month: string; count: number }[]
  finance?: ProjectFinance
  createdAt: number
  source?: ProjectSource
}

function id() { return randomBytes(6).toString('hex') }

// per-owner: هر سازنده پروژه‌های خودش را دارد (کلید = شمارهٔ مالک). بدونِ دیتای دمو.
// با هر تغییرِ منطقِ واردکردن، IMPORT_VERSION را بالا ببر تا همه خودکار دوباره وارد شوند (بدونِ rmِ دستی).
const IMPORT_VERSION = 5
type OwnerData = { projects: Project[]; imported?: boolean; importVersion?: number }
type DB = Record<string, OwnerData>
// دومَحاله: اگر DATABASE_URL ست باشد → Postgres (نوشتنِ اتمیک)، وگرنه فایل.
function fileLoad(): DB { if (existsSync(DATA_FILE)) { try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {} } return {} }
function fileSave(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db), 'utf-8') }

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, {}) : fileLoad() }
// wrapperِ عمومیِ خواندن-تغییر-نوشتن (نامش withDb تا با mutate(owner) استورهای per-owner تداخل نکند)
async function withDb<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, {}, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}
function ownerOf(db: DB, owner: string): OwnerData { if (!db[owner]) db[owner] = { projects: [] }; return db[owner] }

export async function listProjects(owner: string): Promise<Project[]> { return (await load())[owner]?.projects || [] }
export async function getProject(owner: string, pid: string): Promise<Project | null> { return ((await load())[owner]?.projects || []).find(p => p.id === pid) || null }

// واحدهای واقعیِ یک پروژهٔ پابلیک (بر اساسِ hashIdِ پرشین سازه) — از موجودیِ سازنده، اگر ثبت کرده باشد.
// خروجی: نگاشتِ «شمارهٔ واحد» → وضعیت، تا صفحهٔ عمومی موجود/رزرو/فروخته/مشارکت را درست نشان دهد.
export async function unitStatusesForHash(hashId: string): Promise<{ byNumber: Record<string, UnitStatus>; counts: Record<UnitStatus, number> } | null> {
  const db = await load()
  for (const owner of Object.keys(db)) {
    const p = (db[owner].projects || []).find(x => x.source?.hashId === hashId)
    if (p && p.units.length) {
      const byNumber: Record<string, UnitStatus> = {}
      const counts: Record<UnitStatus, number> = { available: 0, reserved: 0, sold: 0, owner: 0 }
      for (const u of p.units) { byNumber[u.number] = u.status; counts[u.status]++ }
      return { byNumber, counts }
    }
  }
  return null
}
// واحدِ یک پروژه را با hashId + شمارهٔ واحد، «رزرو» می‌کند (درخواستِ خریدِ داخلِ سایت).
export async function reserveUnitByHash(hashId: string, unitNumber: string, buyer?: string): Promise<boolean> {
  return withDb(db => {
    for (const owner of Object.keys(db)) {
      const p = (db[owner].projects || []).find(x => x.source?.hashId === hashId)
      if (p) { const u = p.units.find(x => x.number === unitNumber); if (u && u.status === 'available') { u.status = 'reserved'; if (buyer) u.buyer = buyer; u.soldVia = 'site'; return true } return false }
    }
    return false
  })
}

export async function addProject(owner: string, name: string, location: string): Promise<Project> {
  const p: Project = { id: id(), name, location, phase: 'فاز ۱', progress: 0, units: [], investors: [], milestones: [], monthlySales: [], createdAt: Date.now() }
  return withDb(db => { const o = ownerOf(db, owner); o.projects.unshift(p); return p })
}
export async function updateProject(owner: string, pid: string, patch: Partial<Pick<Project, 'name' | 'location' | 'phase' | 'progress'>>): Promise<Project | null> {
  return withDb(db => { const p = (db[owner]?.projects || []).find(x => x.id === pid); if (!p) return null; Object.assign(p, patch); return p })
}
export async function addUnit(owner: string, pid: string, u: Omit<Unit, 'id'>): Promise<Unit | null> {
  return withDb(db => { const p = (db[owner]?.projects || []).find(x => x.id === pid); if (!p) return null; const unit: Unit = { ...u, id: id() }; p.units.push(unit); return unit })
}
export async function updateUnit(owner: string, pid: string, uid: string, patch: Partial<Unit>): Promise<Unit | null> {
  return withDb(db => {
    const p = (db[owner]?.projects || []).find(x => x.id === pid); if (!p) return null
    const u = p.units.find(x => x.id === uid); if (!u) return null
    Object.assign(u, patch); return u
  })
}
export async function deleteUnit(owner: string, pid: string, uid: string): Promise<void> {
  await withDb(db => { const p = (db[owner]?.projects || []).find(x => x.id === pid); if (!p) return; p.units = p.units.filter(x => x.id !== uid) })
}
export async function addInvestor(owner: string, pid: string, inv: Omit<Investor, 'id'>): Promise<Investor | null> {
  return withDb(db => { const p = (db[owner]?.projects || []).find(x => x.id === pid); if (!p) return null; const v: Investor = { ...inv, id: id() }; p.investors.unshift(v); return v })
}
export async function deleteInvestor(owner: string, pid: string, vid: string): Promise<void> {
  await withDb(db => { const p = (db[owner]?.projects || []).find(x => x.id === pid); if (!p) return; p.investors = p.investors.filter(x => x.id !== vid) })
}
export async function updateMilestone(owner: string, pid: string, mid: string, status: Milestone['status']): Promise<void> {
  await withDb(db => { const p = (db[owner]?.projects || []).find(x => x.id === pid); if (!p) return; const m = p.milestones.find(x => x.id === mid); if (m) { m.status = status } })
}

// نردبانِ مراحلِ ساخت (مطابقِ مراحلِ پرشین سازه). مرحلهٔ فعلیِ پروژه = «در حال انجام».
const PHASE_LADDER = ['پی و اسکلت', 'سفت‌کاری', 'گچ و خاک', 'نازک‌کاری', 'تأسیسات', 'تحویل']
function milestonesForPhase(label: string): { milestones: Milestone[]; progress: number } {
  let idx = PHASE_LADDER.findIndex(s => label && (label.includes(s) || s.includes(label)))
  if (idx < 0) {
    if (/اسکلت|پی|فونداسیون|گود/.test(label)) idx = 0
    else if (/سفت/.test(label)) idx = 1
    else if (/گچ|خاک/.test(label)) idx = 2
    else if (/نازک/.test(label)) idx = 3
    else if (/تأسیسات|تاسیسات|مکانیک|برق/.test(label)) idx = 4
    else if (/تحویل|نما|پایان|اتمام/.test(label)) idx = 5
    else idx = 2
  }
  const milestones: Milestone[] = PHASE_LADDER.map((name, i) => ({ id: id(), name, status: i < idx ? 'done' : i === idx ? 'active' : 'pending' }))
  const progress = Math.round((idx / (PHASE_LADDER.length - 1)) * 100)
  return { milestones, progress }
}

// یک‌بار: پروژه‌های پرشین سازهٔ این سازنده (مطابقتِ شماره) را به پنلِ خودش وارد می‌کند.
// واحدها از تعدادِ طبقه/واحدِ واقعی ساخته می‌شوند (همه «موجود»، بدونِ خریدارِ فیک) تا
// سازنده خودش بفروشد. اگر سازنده‌ای در پرشین سازه نباشد، خالی می‌ماند.
export async function ensureImported(owner: string): Promise<void> {
  const db = await load()
  // اگر با نسخهٔ فعلیِ منطقِ import واردشده، رد کن؛ وگرنه دوباره وارد کن (خودکار، بدونِ rm).
  if (db[owner]?.importVersion === IMPORT_VERSION) return
  let projects: Project[] = []
  try {
    const { getProfiles, regionLabel, phaseLabel } = await import('./persiansaze-store')
    const norm = String(owner).replace(/\D/g, '')
    const prof = Object.values(getProfiles()).find(p => (p.phones || []).some(ph => String(ph).replace(/\D/g, '') === norm))
    if (prof) {
      for (const pr of prof.projects || []) {
        const label = phaseLabel(pr)
        const { milestones, progress } = milestonesForPhase(label)
        // واحدها از تعدادِ طبقه/واحدِ واقعیِ ساختمان ساخته می‌شوند (همه «موجود»، بدونِ خریدارِ ساختگی) تا سازنده بفروشد.
        const totalUnits = Math.max(0, Math.min(500, Number(pr.units) || 0))
        const floors = Math.max(1, Number(pr.floors) || 1)
        const avgArea = totalUnits ? Math.round((Number(pr.residentialArea) || 0) / totalUnits) : 0
        // واحدها را روی طبقاتِ واقعی پخش کن (هیچ‌وقت بیشتر از تعدادِ طبقاتِ ساختمان نشود).
        const units: Unit[] = []
        const perFloorCount: Record<number, number> = {}
        for (let i = 0; i < totalUnits; i++) {
          const fl = (i % floors) + 1
          perFloorCount[fl] = (perFloorCount[fl] || 0) + 1
          units.push({ id: id(), number: `${fl}-${perFloorCount[fl]}`, floor: fl, area: avgArea, price: 0, status: 'available' })
        }
        // همهٔ عکس‌ها: اگر در reveal جمع شده (photos)، همان؛ وگرنه عکسِ لیست.
        const photos: string[] = (pr as any).photos?.length ? (pr as any).photos : (pr.photo?.imageUrl ? [pr.photo.imageUrl] : (pr.photo?.imageThumbnailUrl ? [pr.photo.imageThumbnailUrl] : []))
        const source: ProjectSource = {
          hashId: pr.hashId, photos,
          address: pr.address, region: regionLabel(pr), phase: label,
          lat: pr.latitude, lng: pr.longitude, groundArea: pr.groundArea, residentialArea: pr.residentialArea, floors: pr.floors, totalUnits: pr.units,
        }
        projects.push({ id: id(), name: (pr.address || 'پروژه').slice(0, 70), location: regionLabel(pr) || '', phase: label || '—', progress, units, investors: [], milestones, monthlySales: [], createdAt: Date.now(), source })
      }
    }
  } catch { /* اگر پرشین سازه در دسترس نبود، خالی */ }
  await withDb(db => { db[owner] = { projects, imported: true, importVersion: IMPORT_VERSION } })
}

// آمار محاسبه‌شده برای داشبورد
export async function projectStats(p: Project) {
  const sold = p.units.filter(u => u.status === 'sold')
  const reserved = p.units.filter(u => u.status === 'reserved').length
  const available = p.units.filter(u => u.status === 'available').length
  const revenue = sold.reduce((a, u) => a + u.price, 0)
  // مالی: هزینهٔ کل، سودِ ناخالص، حاشیهٔ سود، و مبلغِ وصول‌شده از اقساط.
  const f = p.finance || {}
  const totalCost = (f.landCost || 0) + (f.buildCost || 0) + (f.otherCost || 0)
  const profit = revenue - totalCost
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0
  const collected = p.units.reduce((a, u) => a + (u.plan || []).filter(s => s.paid).reduce((x, s) => x + s.amount, 0), 0)
  const pendingInstallments = p.units.reduce((a, u) => a + (u.plan || []).filter(s => !s.paid).reduce((x, s) => x + s.amount, 0), 0)
  return { total: p.units.length, sold: sold.length, reserved, available, revenue, totalCost, profit, margin, collected, pendingInstallments }
}

// تنظیمِ هزینه‌های پروژه (Financial Tracking)
export async function setProjectFinance(owner: string, pid: string, patch: ProjectFinance): Promise<Project | null> {
  return withDb(db => {
    const p = (db[owner]?.projects || []).find(x => x.id === pid); if (!p) return null
    const cur = p.finance || {}
    p.finance = {
      landCost: patch.landCost !== undefined ? Math.max(0, Number(patch.landCost) || 0) : cur.landCost,
      buildCost: patch.buildCost !== undefined ? Math.max(0, Number(patch.buildCost) || 0) : cur.buildCost,
      otherCost: patch.otherCost !== undefined ? Math.max(0, Number(patch.otherCost) || 0) : cur.otherCost,
    }
    return p
  })
}

// تنظیمِ برنامهٔ پرداختِ مرحله‌ایِ یک واحد (پیش‌فروش)
export async function setUnitPlan(owner: string, pid: string, uid: string, stages: Omit<PaymentStage, 'id'>[]): Promise<Unit | null> {
  return withDb(db => {
    const p = (db[owner]?.projects || []).find(x => x.id === pid); if (!p) return null
    const u = p.units.find(x => x.id === uid); if (!u) return null
    u.plan = stages.map(s => ({ id: id(), label: String(s.label || 'قسط'), amount: Math.max(0, Number(s.amount) || 0), due: s.due, paid: !!s.paid }))
    return u
  })
}
export async function toggleUnitStage(owner: string, pid: string, uid: string, stageId: string): Promise<Unit | null> {
  return withDb(db => {
    const p = (db[owner]?.projects || []).find(x => x.id === pid); if (!p) return null
    const u = p.units.find(x => x.id === uid); if (!u || !u.plan) return null
    const s = u.plan.find(x => x.id === stageId); if (s) s.paid = !s.paid
    return u
  })
}
