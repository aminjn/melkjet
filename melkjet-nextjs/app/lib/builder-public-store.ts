import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// ─── پروفایلِ عمومیِ سازنده (آنچه سازنده در پنلِ خودش پر می‌کند) ────────────────
// کلید = شناسهٔ سازندهٔ پرشین سازه (constructor.id) — همان که صفحهٔ عمومی /sazande/[id]
// با آن باز می‌شود. هیچ دادهٔ فیکی نیست: یا واقعیِ پرشین سازه است یا واردشده توسطِ خودِ سازنده.
const FILE = join(process.cwd(), '.builder-public-data.json')
function id() { return randomBytes(6).toString('hex') }

export type ProjStatus = 'presale' | 'building' | 'delivered'
export const STATUS_LABEL: Record<ProjStatus, string> = { presale: 'پیش‌فروش', building: 'در حال ساخت', delivered: 'تحویل‌شده' }

// متادیتای عمومیِ یک پروژهٔ پرشین سازه (روی hashId می‌نشیند).
export interface ProjMeta {
  status?: ProjStatus; deliveryDate?: string; priceText?: string
  salesProgress?: number; description?: string; areaRange?: string
  published?: boolean; isPast?: boolean
}
// پروژه‌ای که سازنده دستی تعریف می‌کند (خارج از پرشین سازه).
export interface ManualProject {
  id: string; name: string; location: string; status: ProjStatus
  deliveryDate?: string; units?: number; areaRange?: string; priceText?: string
  salesProgress?: number; description?: string; photos?: string[]
  published?: boolean; isPast?: boolean; createdAt: number
}
export interface Review { id: string; name: string; rating: number; text: string; projectName?: string; phone?: string; at: number }

export interface BuilderPublic {
  tagline?: string; sinceYear?: string; about?: string; website?: string
  officeAddress?: string; phonePublic?: string; tags?: string[]; activeRegionsText?: string
  verified?: boolean
  projMeta?: Record<string, ProjMeta>
  manual?: ManualProject[]
  reviews?: Review[]
  followers?: string[]
}

type DB = Record<string, BuilderPublic>
function load(): DB { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return {} }
function save(db: DB) { writeFileSync(FILE, JSON.stringify(db), 'utf-8') }
function ent(db: DB, k: string): BuilderPublic { if (!db[k]) db[k] = {}; return db[k] }

export function getPublic(builderId: string): BuilderPublic { return load()[String(builderId)] || {} }

const SCALAR_KEYS = ['tagline', 'sinceYear', 'about', 'website', 'officeAddress', 'phonePublic', 'activeRegionsText'] as const
export function patchPublic(builderId: string, patch: Partial<BuilderPublic>): BuilderPublic {
  const db = load(); const e = ent(db, String(builderId))
  for (const k of SCALAR_KEYS) if (k in patch) (e as any)[k] = (patch as any)[k]
  if (Array.isArray(patch.tags)) e.tags = patch.tags.map(t => String(t).slice(0, 24)).slice(0, 10)
  save(db); return e
}
// فقط ادمین: نشانِ «تأییدشده».
export function setVerified(builderId: string, v: boolean) { const db = load(); ent(db, String(builderId)).verified = v; save(db) }

export function setProjMeta(builderId: string, hashId: string, patch: ProjMeta): ProjMeta {
  const db = load(); const e = ent(db, String(builderId))
  if (!e.projMeta) e.projMeta = {}
  e.projMeta[hashId] = { ...e.projMeta[hashId], ...patch }
  save(db); return e.projMeta[hashId]
}

export function addManual(builderId: string, data: Partial<ManualProject>): ManualProject {
  const db = load(); const e = ent(db, String(builderId)); if (!e.manual) e.manual = []
  const m: ManualProject = {
    id: id(), name: String(data.name || 'پروژهٔ جدید').slice(0, 80), location: String(data.location || '').slice(0, 80),
    status: (data.status as ProjStatus) || 'building', deliveryDate: data.deliveryDate, units: Number(data.units) || undefined,
    areaRange: data.areaRange, priceText: data.priceText, salesProgress: data.salesProgress != null ? Math.max(0, Math.min(100, Number(data.salesProgress))) : undefined,
    description: data.description, photos: Array.isArray(data.photos) ? data.photos.slice(0, 12) : [], published: data.published !== false,
    isPast: !!data.isPast, createdAt: Date.now(),
  }
  e.manual.unshift(m); save(db); return m
}
export function updateManual(builderId: string, mid: string, patch: Partial<ManualProject>): ManualProject | null {
  const db = load(); const e = ent(db, String(builderId)); const m = (e.manual || []).find(x => x.id === mid); if (!m) return null
  for (const k of ['name', 'location', 'status', 'deliveryDate', 'units', 'areaRange', 'priceText', 'description', 'published', 'isPast', 'photos'] as const) {
    if (k in patch) (m as any)[k] = (patch as any)[k]
  }
  if (patch.salesProgress != null) m.salesProgress = Math.max(0, Math.min(100, Number(patch.salesProgress)))
  save(db); return m
}
export function deleteManual(builderId: string, mid: string) { const db = load(); const e = ent(db, String(builderId)); if (e.manual) { e.manual = e.manual.filter(x => x.id !== mid); save(db) } }

// نظرات (عمومی — توسطِ کاربرانِ واردشده).
export function addReview(builderId: string, r: { name: string; rating: number; text: string; projectName?: string; phone?: string }): Review {
  const db = load(); const e = ent(db, String(builderId)); if (!e.reviews) e.reviews = []
  const rev: Review = { id: id(), name: String(r.name || 'کاربر').slice(0, 40), rating: Math.max(1, Math.min(5, Number(r.rating) || 5)), text: String(r.text || '').slice(0, 600), projectName: r.projectName?.slice(0, 60), phone: r.phone, at: Date.now() }
  e.reviews.unshift(rev); save(db); return rev
}
export function reviewStats(builderId: string): { avg: number; count: number } {
  const rs = getPublic(builderId).reviews || []
  if (!rs.length) return { avg: 0, count: 0 }
  return { avg: Math.round((rs.reduce((s, r) => s + r.rating, 0) / rs.length) * 10) / 10, count: rs.length }
}

// دنبال‌کردن.
export function follow(builderId: string, phone: string) { const db = load(); const e = ent(db, String(builderId)); const set = new Set(e.followers || []); set.add(phone); e.followers = [...set]; save(db) }
export function unfollow(builderId: string, phone: string) { const db = load(); const e = ent(db, String(builderId)); e.followers = (e.followers || []).filter(p => p !== phone); save(db) }
export function isFollowing(builderId: string, phone: string): boolean { return (getPublic(builderId).followers || []).includes(phone) }
export function followerCount(builderId: string): number { return (getPublic(builderId).followers || []).length }
