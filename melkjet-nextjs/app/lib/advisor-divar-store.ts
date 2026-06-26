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

// یک «اسکرپ» (منبع) — کاربر می‌تواند چند منبعِ مستقل بسازد، هرکدام ذخیره و جدا.
export interface DivarSource {
  id: string
  name: string             // برچسبِ دلخواه (مثلاً «دفتر سعادت‌آباد»)
  searchUrl: string        // لینکِ پروفایلِ پرو یا جستجو/نقشهٔ دیوار
  divarName: string        // نامِ نمایشیِ روی دیوار (برای فیلترِ جستجو)
  schedule: DivarSchedule
  autoPublish: boolean
  autoNeighborhood: boolean
  lastRun?: number
  lastCount?: number
  lastError?: string
  createdAt: number
}

export interface AdvisorDivar {
  divarName: string        // (legacy — اولین منبع)
  searchUrl: string        // (legacy)
  schedule: DivarSchedule
  autoPublish: boolean
  autoNeighborhood: boolean
  lastRun?: number
  lastCount?: number
  lastError?: string
  sources: DivarSource[]   // منابعِ متعددِ اسکرپ
  imports: ImportedPost[]
}

interface DB { advisors: Record<string, AdvisorDivar> }

function load(): DB { if (existsSync(DATA_FILE)) { try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {} } return { advisors: {} } }
function save(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }
function sid() { return 'src_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4) }

function seed(): AdvisorDivar {
  return { divarName: '', searchUrl: '', schedule: 'off', autoPublish: true, autoNeighborhood: true, sources: [], imports: [] }
}

// مهاجرتِ تنظیماتِ تک‌منبعهٔ قدیمی به فهرستِ منابع.
function migrate(cur: AdvisorDivar): AdvisorDivar {
  if (!Array.isArray(cur.sources)) cur.sources = []
  if (cur.sources.length === 0 && (cur.searchUrl || cur.divarName)) {
    cur.sources = [{ id: sid(), name: 'منبعِ اصلی', searchUrl: cur.searchUrl || '', divarName: cur.divarName || '', schedule: cur.schedule || 'off', autoPublish: cur.autoPublish !== false, autoNeighborhood: cur.autoNeighborhood !== false, lastRun: cur.lastRun, lastCount: cur.lastCount, lastError: cur.lastError, createdAt: Date.now() }]
  }
  return cur
}

export function getDivar(o: string): AdvisorDivar {
  const db = load()
  if (!db.advisors[o]) { db.advisors[o] = seed(); save(db) }
  const cur = migrate({ ...seed(), ...db.advisors[o] })
  db.advisors[o] = cur; save(db)
  return cur
}

// ── مدیریتِ منابعِ اسکرپ ──
export function addSource(o: string, input: Partial<DivarSource>): DivarSource {
  const db = load(); const cur = migrate(db.advisors[o] || seed())
  const src: DivarSource = {
    id: sid(), name: String(input.name || '').trim() || 'اسکرپِ جدید', searchUrl: String(input.searchUrl || '').trim(), divarName: String(input.divarName || '').trim(),
    schedule: (['off', 'hourly', '6h', 'daily'].includes(input.schedule as string) ? input.schedule : 'off') as DivarSchedule,
    autoPublish: input.autoPublish !== false, autoNeighborhood: input.autoNeighborhood !== false, createdAt: Date.now(),
  }
  cur.sources = [...cur.sources, src]; db.advisors[o] = cur; save(db); return src
}
export function updateSource(o: string, id: string, patch: Partial<DivarSource>): DivarSource | null {
  const db = load(); const cur = migrate(db.advisors[o] || seed())
  const s = cur.sources.find(x => x.id === id); if (!s) return null
  if (patch.name !== undefined) s.name = String(patch.name).trim() || s.name
  if (patch.searchUrl !== undefined) s.searchUrl = String(patch.searchUrl).trim()
  if (patch.divarName !== undefined) s.divarName = String(patch.divarName).trim()
  if (patch.schedule !== undefined && ['off', 'hourly', '6h', 'daily'].includes(patch.schedule)) s.schedule = patch.schedule
  if (patch.autoPublish !== undefined) s.autoPublish = !!patch.autoPublish
  if (patch.autoNeighborhood !== undefined) s.autoNeighborhood = !!patch.autoNeighborhood
  db.advisors[o] = cur; save(db); return s
}
export function removeSource(o: string, id: string) {
  const db = load(); const cur = migrate(db.advisors[o] || seed())
  cur.sources = cur.sources.filter(x => x.id !== id); db.advisors[o] = cur; save(db)
}
export function getSource(o: string, id: string): DivarSource | null { return getDivar(o).sources.find(x => x.id === id) || null }
export function markSourceRun(o: string, id: string, count: number, error?: string) {
  const db = load(); const cur = migrate(db.advisors[o] || seed())
  const s = cur.sources.find(x => x.id === id); if (s) { s.lastRun = Date.now(); s.lastCount = count; s.lastError = error || '' }
  db.advisors[o] = cur; save(db)
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

export function clearImports(o: string) {
  const db = load()
  const cur = db.advisors[o]; if (!cur) return
  cur.imports = []
  db.advisors[o] = cur; save(db)
}

export function markRun(o: string, count: number, error?: string) {
  const db = load()
  const cur = db.advisors[o] || seed()
  cur.lastRun = Date.now(); cur.lastCount = count; cur.lastError = error || ''
  db.advisors[o] = cur; save(db)
}

const SCHEDULE_MS: Record<DivarSchedule, number> = { off: 0, hourly: 3600_000, '6h': 6 * 3600_000, daily: 24 * 3600_000 }

// همهٔ منابعی که سینکِ خودکارشان فعال است و زمانش رسیده (برای کران).
export function listDueSources(now: number): { phone: string; source: DivarSource }[] {
  const db = load()
  const out: { phone: string; source: DivarSource }[] = []
  for (const phone of Object.keys(db.advisors)) {
    const cur = migrate({ ...seed(), ...db.advisors[phone] })
    for (const s of cur.sources) {
      const period = SCHEDULE_MS[s.schedule]
      if (!period || !s.searchUrl) continue
      if (!s.lastRun || now - s.lastRun >= period) out.push({ phone, source: s })
    }
  }
  return out
}
