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
  const db = { projects: [seedProject()] }
  save(db); return db
}
function save(db: { projects: Project[] }) { writeFileSync(FILE, JSON.stringify(db, null, 2), 'utf-8') }

// پروژهٔ نمونهٔ واقعی تا داشبورد از ابتدا مثل طرح پر باشد
function seedProject(): Project {
  const units: Unit[] = []
  const total = 182, sold = 142, reserved = 24
  const buyers = ['احمدی', 'رضایی', 'کریمی', 'موسوی', 'حیدری', 'صادقی', 'اسدی', 'رشیدی', 'نوری', 'کاظمی']
  for (let i = 0; i < total; i++) {
    const floor = Math.floor(i / 6) + 1
    const area = 95 + (i % 5) * 25
    const price = Math.round((area * (90 + floor * 1.5)) * 1e6)
    const status: UnitStatus = i < sold ? 'sold' : i < sold + reserved ? 'reserved' : 'available'
    units.push({ id: id(), number: `${floor}-${(i % 6) + 1}`, floor, area, price, status, buyer: status === 'sold' ? buyers[i % buyers.length] : undefined })
  }
  return {
    id: id(), name: 'برج آرین', location: 'تهران، سعادت‌آباد', phase: 'فاز ۲', progress: 68,
    units,
    investors: [
      { id: id(), name: 'گروه سرمایه‌گذاری پاسارگاد', phone: '۰۲۱۸۸۸۸', amount: 480e9, units: 24 },
      { id: id(), name: 'هلدینگ ساختمانی مهستان', phone: '۰۲۱۷۷۷۷', amount: 320e9, units: 16 },
      { id: id(), name: 'صندوق زمین و ساختمان آرمان', amount: 210e9, units: 10 },
    ],
    milestones: [
      { id: id(), name: 'پی و اسکلت', status: 'done', date: 'بهار ۱۴۰۴' },
      { id: id(), name: 'سفت‌کاری', status: 'done', date: 'تکمیل' },
      { id: id(), name: 'نازک‌کاری', status: 'active', date: 'در حال انجام' },
      { id: id(), name: 'تأسیسات', status: 'pending', date: 'تابستان ۱۴۰۵' },
      { id: id(), name: 'تحویل', status: 'pending', date: 'پاییز ۱۴۰۵' },
    ],
    monthlySales: [
      { month: 'مهر', count: 18 }, { month: 'آبان', count: 22 }, { month: 'آذر', count: 16 },
      { month: 'دی', count: 28 }, { month: 'بهمن', count: 34 }, { month: 'اسفند', count: 24 },
    ],
    createdAt: Date.now(),
  }
}

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
