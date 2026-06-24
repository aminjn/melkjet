import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// تنظیمات و تاریخچهٔ «ایمپورت از دیوار» برای هر مشاور (per-owner، کلید = شمارهٔ حساب).
const DATA_FILE = join(process.cwd(), '.advisor-divar-data.json')

export type DivarSchedule = 'off' | 'hourly' | '6h' | 'daily'

export interface ImportedPost {
  token: string
  listingId: string   // شناسهٔ فایل در advisor-store
  title: string
  url: string
  at: number
  published: boolean
}

export interface AdvisorDivar {
  divarName: string        // نام/آژانسِ مشاور همان‌گونه که روی دیوار نمایش داده می‌شود (برای فیلترِ سینک)
  searchUrl: string        // لینکِ جستجو/نقشهٔ دیوارِ منطقهٔ مشاور (برای سینکِ خودکار)
  schedule: DivarSchedule
  autoPublish: boolean     // پس از ایمپورت، آگهی خودکار روی سایت منتشر شود
  autoNeighborhood: boolean// محلهٔ آگهی‌ها خودکار در لیستِ محله‌های سایت ساخته شود
  lastRun?: number
  lastCount?: number
  lastError?: string
  imports: ImportedPost[]
}

interface DB { advisors: Record<string, AdvisorDivar> }

function load(): DB { if (existsSync(DATA_FILE)) { try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {} } return { advisors: {} } }
function save(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

function seed(): AdvisorDivar {
  return { divarName: '', searchUrl: '', schedule: 'off', autoPublish: true, autoNeighborhood: true, imports: [] }
}

export function getDivar(o: string): AdvisorDivar {
  const db = load()
  if (!db.advisors[o]) { db.advisors[o] = seed(); save(db) }
  return { ...seed(), ...db.advisors[o] }
}

export function updateDivarConfig(o: string, patch: Partial<Pick<AdvisorDivar, 'divarName' | 'searchUrl' | 'schedule' | 'autoPublish' | 'autoNeighborhood'>>): AdvisorDivar {
  const db = load()
  const cur = db.advisors[o] || seed()
  if (patch.divarName !== undefined) cur.divarName = String(patch.divarName).trim()
  if (patch.searchUrl !== undefined) cur.searchUrl = String(patch.searchUrl).trim()
  if (patch.schedule !== undefined && ['off', 'hourly', '6h', 'daily'].includes(patch.schedule)) cur.schedule = patch.schedule
  if (patch.autoPublish !== undefined) cur.autoPublish = !!patch.autoPublish
  if (patch.autoNeighborhood !== undefined) cur.autoNeighborhood = !!patch.autoNeighborhood
  db.advisors[o] = cur; save(db)
  return cur
}

export function hasToken(o: string, token: string): boolean {
  return getDivar(o).imports.some(i => i.token === token)
}

export function recordImport(o: string, post: ImportedPost) {
  const db = load()
  const cur = db.advisors[o] || seed()
  cur.imports = [post, ...cur.imports.filter(i => i.token !== post.token)].slice(0, 200)
  db.advisors[o] = cur; save(db)
}

export function removeImport(o: string, token: string) {
  const db = load()
  const cur = db.advisors[o]; if (!cur) return
  cur.imports = cur.imports.filter(i => i.token !== token)
  db.advisors[o] = cur; save(db)
}

export function markRun(o: string, count: number, error?: string) {
  const db = load()
  const cur = db.advisors[o] || seed()
  cur.lastRun = Date.now(); cur.lastCount = count; cur.lastError = error || ''
  db.advisors[o] = cur; save(db)
}

const SCHEDULE_MS: Record<DivarSchedule, number> = { off: 0, hourly: 3600_000, '6h': 6 * 3600_000, daily: 24 * 3600_000 }

// همهٔ مشاورانی که سینکِ خودکارشان فعال است و زمانش رسیده (برای کران).
export function listDueAdvisors(now: number): { phone: string; cfg: AdvisorDivar }[] {
  const db = load()
  const out: { phone: string; cfg: AdvisorDivar }[] = []
  for (const phone of Object.keys(db.advisors)) {
    const cfg = { ...seed(), ...db.advisors[phone] }
    const period = SCHEDULE_MS[cfg.schedule]
    if (!period || !cfg.searchUrl) continue
    if (!cfg.lastRun || now - cfg.lastRun >= period) out.push({ phone, cfg })
  }
  return out
}
