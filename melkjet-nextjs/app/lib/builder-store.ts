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
function load(): { projects: Project[] } {
  if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} }
  // بدونِ دیتای دمو — داشبورد از ابتدا خالی است تا کاربر پروژهٔ واقعیِ خودش را بسازد.
  const db = { projects: [] as Project[] }
  save(db); return db
}
function save(db: { projects: Project[] }) { writeFileSync(FILE, JSON.stringify(db, null, 2), 'utf-8') }

export function listProjects(): Project[] { return load().projects }
export function getProject(pid: string): Project | null { return load().projects.find(p => p.id === pid) || null }

export function addProject(name: string, location: string): Project {
  const db = load()
  const p: Project = { id: id(), name, location, phase: 'فاز ۱', progress: 0, units: [], investors: [], milestones: [], monthlySales: [], createdAt: Date.now() }
  db.projects.unshift(p); save(db); return p
}
export function updateProject(pid: string, patch: Partial<Pick<Project, 'name' | 'location' | 'phase' | 'progress'>>): Project | null {
  const db = load(); const p = db.projects.find(x => x.id === pid); if (!p) return null
  Object.assign(p, patch); save(db); return p
}

export function addUnit(pid: string, u: Omit<Unit, 'id'>): Unit | null {
  const db = load(); const p = db.projects.find(x => x.id === pid); if (!p) return null
  const unit: Unit = { ...u, id: id() }; p.units.push(unit); save(db); return unit
}
export function updateUnit(pid: string, uid: string, patch: Partial<Unit>): Unit | null {
  const db = load(); const p = db.projects.find(x => x.id === pid); if (!p) return null
  const u = p.units.find(x => x.id === uid); if (!u) return null
  Object.assign(u, patch); save(db); return u
}
export function deleteUnit(pid: string, uid: string) {
  const db = load(); const p = db.projects.find(x => x.id === pid); if (!p) return
  p.units = p.units.filter(x => x.id !== uid); save(db)
}

export function addInvestor(pid: string, inv: Omit<Investor, 'id'>): Investor | null {
  const db = load(); const p = db.projects.find(x => x.id === pid); if (!p) return null
  const v: Investor = { ...inv, id: id() }; p.investors.unshift(v); save(db); return v
}
export function deleteInvestor(pid: string, vid: string) {
  const db = load(); const p = db.projects.find(x => x.id === pid); if (!p) return
  p.investors = p.investors.filter(x => x.id !== vid); save(db)
}

export function updateMilestone(pid: string, mid: string, status: Milestone['status']) {
  const db = load(); const p = db.projects.find(x => x.id === pid); if (!p) return
  const m = p.milestones.find(x => x.id === mid); if (m) { m.status = status; save(db) }
}

// آمار محاسبه‌شده برای داشبورد
export function projectStats(p: Project) {
  const sold = p.units.filter(u => u.status === 'sold')
  const reserved = p.units.filter(u => u.status === 'reserved').length
  const available = p.units.filter(u => u.status === 'available').length
  const revenue = sold.reduce((a, u) => a + u.price, 0)
  return { total: p.units.length, sold: sold.length, reserved, available, revenue }
}
