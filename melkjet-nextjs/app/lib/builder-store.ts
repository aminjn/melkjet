import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

const FILE = join(process.cwd(), '.builder-data.json')

export type UnitStatus = 'sold' | 'reserved' | 'available'
export interface Unit { id: string; number: string; floor: number; area: number; price: number; status: UnitStatus; buyer?: string }
export interface Investor { id: string; name: string; phone?: string; amount: number; units?: number }
export interface Milestone { id: string; name: string; status: 'done' | 'active' | 'pending'; date?: string }
export interface Project {
  id: string; name: string; location: string; phase: string; progress: number
  units: Unit[]; investors: Investor[]; milestones: Milestone[]
  monthlySales: { month: string; count: number }[]
  createdAt: number
}

function id() { return randomBytes(6).toString('hex') }

// per-owner: هر سازنده پروژه‌های خودش را دارد (کلید = شمارهٔ مالک). بدونِ دیتای دمو.
type OwnerData = { projects: Project[]; imported?: boolean }
type DB = Record<string, OwnerData>
function load(): DB { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return {} }
function save(db: DB) { writeFileSync(FILE, JSON.stringify(db), 'utf-8') }
function ownerOf(db: DB, owner: string): OwnerData { if (!db[owner]) db[owner] = { projects: [] }; return db[owner] }

export function listProjects(owner: string): Project[] { return load()[owner]?.projects || [] }
export function getProject(owner: string, pid: string): Project | null { return (load()[owner]?.projects || []).find(p => p.id === pid) || null }

export function addProject(owner: string, name: string, location: string): Project {
  const db = load(); const o = ownerOf(db, owner)
  const p: Project = { id: id(), name, location, phase: 'فاز ۱', progress: 0, units: [], investors: [], milestones: [], monthlySales: [], createdAt: Date.now() }
  o.projects.unshift(p); save(db); return p
}
export function updateProject(owner: string, pid: string, patch: Partial<Pick<Project, 'name' | 'location' | 'phase' | 'progress'>>): Project | null {
  const db = load(); const p = (db[owner]?.projects || []).find(x => x.id === pid); if (!p) return null
  Object.assign(p, patch); save(db); return p
}
export function addUnit(owner: string, pid: string, u: Omit<Unit, 'id'>): Unit | null {
  const db = load(); const p = (db[owner]?.projects || []).find(x => x.id === pid); if (!p) return null
  const unit: Unit = { ...u, id: id() }; p.units.push(unit); save(db); return unit
}
export function updateUnit(owner: string, pid: string, uid: string, patch: Partial<Unit>): Unit | null {
  const db = load(); const p = (db[owner]?.projects || []).find(x => x.id === pid); if (!p) return null
  const u = p.units.find(x => x.id === uid); if (!u) return null
  Object.assign(u, patch); save(db); return u
}
export function deleteUnit(owner: string, pid: string, uid: string) {
  const db = load(); const p = (db[owner]?.projects || []).find(x => x.id === pid); if (!p) return
  p.units = p.units.filter(x => x.id !== uid); save(db)
}
export function addInvestor(owner: string, pid: string, inv: Omit<Investor, 'id'>): Investor | null {
  const db = load(); const p = (db[owner]?.projects || []).find(x => x.id === pid); if (!p) return null
  const v: Investor = { ...inv, id: id() }; p.investors.unshift(v); save(db); return v
}
export function deleteInvestor(owner: string, pid: string, vid: string) {
  const db = load(); const p = (db[owner]?.projects || []).find(x => x.id === pid); if (!p) return
  p.investors = p.investors.filter(x => x.id !== vid); save(db)
}
export function updateMilestone(owner: string, pid: string, mid: string, status: Milestone['status']) {
  const db = load(); const p = (db[owner]?.projects || []).find(x => x.id === pid); if (!p) return
  const m = p.milestones.find(x => x.id === mid); if (m) { m.status = status; save(db) }
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
  const db = load()
  if (db[owner]?.imported) return
  let projects: Project[] = []
  try {
    const { getProfiles, regionLabel, phaseLabel } = await import('./persiansaze-store')
    const norm = String(owner).replace(/\D/g, '')
    const prof = Object.values(getProfiles()).find(p => (p.phones || []).some(ph => String(ph).replace(/\D/g, '') === norm))
    if (prof) {
      for (const pr of prof.projects || []) {
        const totalUnits = Math.max(0, Math.min(500, Number(pr.units) || 0))
        const floors = Math.max(1, Number(pr.floors) || 1)
        const perFloor = Math.max(1, Math.round(totalUnits / floors) || 1)
        const avgArea = totalUnits ? Math.round((Number(pr.residentialArea) || 0) / totalUnits) : 0
        const units: Unit[] = []
        for (let i = 0; i < totalUnits; i++) { const fl = Math.floor(i / perFloor) + 1; units.push({ id: id(), number: `${fl}-${(i % perFloor) + 1}`, floor: fl, area: avgArea, price: 0, status: 'available' }) }
        const label = phaseLabel(pr)
        const { milestones, progress } = milestonesForPhase(label)
        projects.push({ id: id(), name: (pr.address || 'پروژه').slice(0, 70), location: regionLabel(pr) || '', phase: label || '—', progress, units, investors: [], milestones, monthlySales: [], createdAt: Date.now() })
      }
    }
  } catch { /* اگر پرشین سازه در دسترس نبود، خالی */ }
  db[owner] = { projects, imported: true }
  save(db)
}

// آمار محاسبه‌شده برای داشبورد
export function projectStats(p: Project) {
  const sold = p.units.filter(u => u.status === 'sold')
  const reserved = p.units.filter(u => u.status === 'reserved').length
  const available = p.units.filter(u => u.status === 'available').length
  const revenue = sold.reduce((a, u) => a + u.price, 0)
  return { total: p.units.length, sold: sold.length, reserved, available, revenue }
}
