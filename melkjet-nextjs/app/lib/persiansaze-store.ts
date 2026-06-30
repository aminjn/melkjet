import fs from 'fs'
import path from 'path'
import { bulkCreate, listAccounts } from './account-store'
import { listRoles } from './role-store'

// ─── پرشین سازه: کانفیگِ اسکرپ + دادهٔ اسکرپ‌شده + پروفایلِ سازنده‌ها ───────────
// دو فایلِ gitignore در ریشهٔ اپ:
//   .persiansaze-config.json  → یوزر/پسورد/زمان‌بندی (اسکریپتِ اسکرپ هم همین را می‌خواند)
//   .persiansaze-data.json    → خروجیِ اسکرپ (پروژه‌ها + سازنده‌های یکتا) که اسکریپت می‌نویسد

const CONFIG_FILE = path.join(process.cwd(), '.persiansaze-config.json')
const DATA_FILE = path.join(process.cwd(), '.persiansaze-data.json')
const META_FILE = path.join(process.cwd(), '.persiansaze-meta.json')
const PROFILES_FILE = path.join(process.cwd(), '.persiansaze-profiles.json')
const REVEALS_FILE = path.join(process.cwd(), '.persiansaze-reveals.json')

// ─── کشِ مبتنی‌بر mtime: فایل فقط وقتی روی دیسک تغییر کند دوباره پارس می‌شود ──────
// (statSync ارزان است؛ پارسِ JSON فقط یک‌بار به‌ازای هر نسخهٔ فایل). برای مقیاسِ بالا حیاتی.
const _fileCache = new Map<string, { mtime: number; data: unknown }>()
function readCached<T>(file: string, fallback: T): T {
  try {
    const mtime = fs.statSync(file).mtimeMs
    const hit = _fileCache.get(file)
    if (hit && hit.mtime === mtime) return hit.data as T
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    _fileCache.set(file, { mtime, data })
    return data as T
  } catch { return fallback }
}
// کشِ نتایجِ مشتق (مثلِ پروفایلِ ترنسفورم‌شده یا گروه‌بندیِ منطقه‌ها) به‌ازای mtimeِ منبع.
const _derivedCache = new Map<string, { key: string; data: unknown }>()
function derived<T>(name: string, file: string, compute: () => T): T {
  let mtime = 0; try { mtime = fs.statSync(file).mtimeMs } catch {}
  const key = String(mtime)
  const hit = _derivedCache.get(name)
  if (hit && hit.key === key) return hit.data as T
  const data = compute()
  _derivedCache.set(name, { key, data })
  return data
}

export interface PSConfig {
  user: string
  pass: string
  enabled: boolean
  channel: string      // 'chrome' برای Google Chromeِ سیستمی
  limit: number        // اندازهٔ هر صفحه (پیش‌فرض ۱۰۰)
  weeklyQuota: number  // سقفِ گرفتنِ شماره در هفته (پیش‌فرض ۵۰۰)
  lastScrapeAt?: string
  lastError?: string
}

export interface PSProject {
  hashId: string
  address?: string
  receptor?: string        // نامِ سازنده/کارفرما
  cityId?: number; regionId?: number; subRegionId?: number
  regionName?: string; subRegionName?: string
  phaseId?: number; phaseName?: string; usageTypeId?: number; structureTypeId?: number
  groundArea?: number; residentialArea?: number
  floors?: number; subFloors?: number; units?: number
  latitude?: number; longitude?: number
  lastUpdateDate?: string; phaseLastUpdateDate?: string
  photo?: { imageUrl?: string; imageThumbnailUrl?: string }
  photos?: string[]
  hasAvailableConstructor?: boolean
}

export interface PSBuilder { name: string; projectCount: number; hashIds: string[]; regions: number[] }

export interface PSData {
  lastSync?: string
  totalProjects?: number
  totalBuilders?: number
  projects?: PSProject[]
  builders?: PSBuilder[]
}

// پروفایلِ سازنده — کلید: constructor.id (سازندهٔ واقعی که شماره با او می‌آید).
export interface PSProfile {
  id: string              // constructor.id
  name: string            // نامِ واقعیِ سازنده
  phones: string[]        // شماره‌های موبایل
  phone?: string          // شمارهٔ اول (برای UI)
  projectCount: number
  projects: PSProject[]   // همهٔ پروژه‌های این سازنده
  regions: number[]
  revealedAt?: string
}

export interface PSReveals {
  meta?: { availableCount?: number | null; lastRevealAt?: string; revealedTotal?: number }
  items?: Record<string, { constructorId: number; name?: string; phones?: string[]; hasDup?: boolean; receptor?: string; revealedAt?: string; photos?: string[]; detail?: { address?: string; latitude?: number; longitude?: number; floors?: number; subFloors?: number; units?: number; groundArea?: number; residentialArea?: number; phaseId?: number; phaseName?: string; regionId?: number; regionName?: string; subRegionName?: string } }>
}
export function getReveals(): PSReveals {
  return readCached<PSReveals>(REVEALS_FILE, { meta: {}, items: {} })
}

// ─── خواندن/نوشتنِ کانفیگ ───────────────────────────────────────────────────
const DEFAULT_CONFIG: PSConfig = { user: '', pass: '', enabled: false, channel: 'chrome', limit: 20, weeklyQuota: 500 }

export function getConfig(): PSConfig {
  return { ...DEFAULT_CONFIG, ...readCached<Partial<PSConfig>>(CONFIG_FILE, {}) }
}
export function saveConfig(patch: Partial<PSConfig>): PSConfig {
  const next = { ...getConfig(), ...patch }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2))
  return next
}
// کانفیگِ ماسک‌شده برای UI (پسورد نشان داده نمی‌شود).
export function getConfigMasked() {
  const c = getConfig()
  return { ...c, pass: c.pass ? '********' : '', hasPass: !!c.pass }
}

// ─── خواندنِ دادهٔ اسکرپ‌شده ─────────────────────────────────────────────────
// هشدار: فایلِ بزرگ (ده‌ها مگابایت). فقط در موتورِ reveal/rebuild استفاده شود، نه مسیرهای پرتکرار.
export function getData(): PSData {
  return readCached<PSData>(DATA_FILE, {})
}

// متادیتای سبک (شمارش‌ها) — بدونِ پارسِ فایلِ بزرگ. اگر نبود، یک‌بار از دیتا ساخته و کش می‌شود.
export function getMeta(): { lastSync?: string; totalProjects: number; totalBuilders: number } {
  const m = readCached<any>(META_FILE, null)
  if (m && typeof m.totalProjects === 'number') return m
  // self-heal: یک‌بار از فایلِ بزرگ بخوان و متای کوچک را بنویس
  const d = getData()
  const meta = { lastSync: d.lastSync, totalProjects: (d.projects || []).length || d.totalProjects || 0, totalBuilders: (d.builders || []).length || d.totalBuilders || 0 }
  try { fs.writeFileSync(META_FILE, JSON.stringify(meta)) } catch {}
  return meta
}

// ─── کمک‌ها: نامِ منطقه/مرحله ───────────────────────────────────────────────
const REGIONS_FILE = path.join(process.cwd(), '.persiansaze-regions.json')
// نگاشتِ regionId→name که worker از پرشین سازه ذخیره کرده (کشِ mtime).
function regionNames(): Record<number, string> {
  const file = readCached<Record<string, string>>(REGIONS_FILE, {})
  const out: Record<number, string> = {}
  for (const [k, v] of Object.entries(file || {})) if (v) out[Number(k)] = String(v)
  return out
}
export function regionLabel(p: { cityId?: number; regionId?: number; regionName?: string }): string {
  const nm = p.regionName || (p.regionId ? regionNames()[p.regionId] : '')
  if (nm) return /تهران/.test(nm) || p.cityId !== 1 ? nm : `تهران، ${nm}`
  // مناطقِ شهرداریِ تهران: regionId 101..122 = منطقه ۱..۲۲ (قطعی).
  if (p.cityId === 1 && p.regionId && p.regionId > 100 && p.regionId <= 122) return `تهران، منطقه ${p.regionId - 100}`
  // ناشناخته: کدِ خام را نشان نده. تهران → «تهران»؛ بقیه → خالی (تا re-revealِ بعدی نام بیاید).
  if (p.cityId === 1) return 'تهران'
  return ''
}
// نگاشتِ مرحله‌های ساخت (از روی UIِ پرشین سازه؛ قابلِ تکمیل).
const PHASE_NAMES_STATIC: Record<number, string> = {
  2006: 'گچ و خاک', 2007: 'سفت‌کاری', 2008: 'ابتدای نازک‌کاری', 2016: 'نازک‌کاری',
}
const PHASES_FILE = path.join(process.cwd(), '.persiansaze-phases.json')
// نگاشتِ کاملِ مرحله‌ها: ثابت + هرچه از فایلِ phases (که probe/worker می‌نویسد) آمده.
export function phaseNames(): Record<number, string> {
  const file = readCached<Record<string, string>>(PHASES_FILE, {})
  const out: Record<number, string> = { ...PHASE_NAMES_STATIC }
  for (const [k, v] of Object.entries(file || {})) if (v) out[Number(k)] = String(v)
  return out
}
export const PHASE_NAMES = PHASE_NAMES_STATIC
// نامِ مرحله: اول نامِ ذخیره‌شدهٔ خودِ پروژه، سپس نگاشت. اگر ناشناخته بود «خالی»
// برمی‌گردانیم (کدِ خامِ «مرحله ۲۰۰۵» هرگز به کاربر نشان داده نمی‌شود).
export function phaseLabel(p: { phaseId?: number; phaseName?: string }): string {
  if (p.phaseName) return p.phaseName
  return (p.phaseId && phaseNames()[p.phaseId]) || ''
}

// ─── پروفایلِ سازنده‌ها (کلید: constructor.id) ──────────────────────────────
// پروفایل‌ها را موتورِ reveal در .persiansaze-profiles.json می‌نویسد. این‌جا فقط می‌خوانیم.
export function getProfiles(): Record<string, PSProfile> {
  // ترنسفورمِ پروفایل‌ها فقط وقتی فایل تغییر کند انجام می‌شود (کشِ mtime).
  return derived('profiles', PROFILES_FILE, () => {
    const raw = readCached<Record<string, any>>(PROFILES_FILE, {})
    const out: Record<string, PSProfile> = {}
    for (const [id, p] of Object.entries(raw)) {
      out[id] = { id, name: p.name || '', phones: p.phones || (p.phone ? [p.phone] : []), phone: (p.phones && p.phones[0]) || p.phone, projectCount: p.projectCount || (p.projects || []).length, projects: p.projects || [], regions: p.regions || [], revealedAt: p.revealedAt }
    }
    return out
  })
}

// از reveals (که موتور نوشته) پروفایل‌ها را بازسازی می‌کند — کلید: constructor.id.
export function rebuildProfiles(): { created: number; updated: number; total: number } {
  const projects = getData().projects || []
  const byHash = new Map(projects.map(p => [p.hashId, p]))
  const reveals = getReveals()
  const byCons = new Map<string, { id: string; name: string; phones: Set<string>; projects: PSProject[]; regions: Set<number>; revealedAt?: string }>()
  for (const [hash, rv] of Object.entries(reveals.items || {})) {
    const cid = String(rv.constructorId)
    if (!byCons.has(cid)) byCons.set(cid, { id: cid, name: rv.name || '', phones: new Set(), projects: [], regions: new Set(), revealedAt: rv.revealedAt })
    const b = byCons.get(cid)!
    for (const ph of rv.phones || []) b.phones.add(ph)
    if (rv.name && !b.name) b.name = rv.name
    const proj = byHash.get(hash)
    if (proj) {
      if (rv.photos?.length) proj.photos = rv.photos
      const d = rv.detail
      if (d) {
        if (d.address) proj.address = d.address
        if (d.latitude != null) proj.latitude = d.latitude
        if (d.longitude != null) proj.longitude = d.longitude
        if (d.floors != null) proj.floors = d.floors
        if (d.subFloors != null) proj.subFloors = d.subFloors
        if (d.units != null) proj.units = d.units
        if (d.groundArea != null) proj.groundArea = d.groundArea
        if (d.residentialArea != null) proj.residentialArea = d.residentialArea
        if (d.phaseId != null) proj.phaseId = d.phaseId
        if (d.phaseName) proj.phaseName = d.phaseName
        if (d.regionName) proj.regionName = d.regionName
        if (d.subRegionName) proj.subRegionName = d.subRegionName
      }
      b.projects.push(proj); if (proj.regionId) b.regions.add(proj.regionId)
    }
  }
  const out: Record<string, any> = {}
  for (const b of byCons.values()) out[b.id] = { id: b.id, name: b.name, phones: [...b.phones], projects: b.projects, regions: [...b.regions], projectCount: b.projects.length, revealedAt: b.revealedAt }
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(out))
  return { created: Object.keys(out).length, updated: 0, total: Object.keys(out).length }
}

// لیستِ پروفایل‌ها با جستجو (نام یا شماره) و صفحه‌بندی برای UI.
export function listProfiles(opts: { search?: string; withPhone?: boolean; page?: number; pageSize?: number } = {}) {
  const all = Object.values(getProfiles())
  const q = (opts.search || '').trim()
  let rows = all
  if (q) rows = rows.filter(p => p.name.includes(q) || (p.phones || []).some(ph => ph.includes(q)))
  if (opts.withPhone) rows = rows.filter(p => (p.phones || []).length > 0)
  rows.sort((a, b) => b.projectCount - a.projectCount)
  const total = rows.length
  const page = Math.max(1, opts.page || 1), pageSize = opts.pageSize || 30
  return { total, page, pageSize, rows: rows.slice((page - 1) * pageSize, page * pageSize) }
}

export function getProfile(id: string): PSProfile | null { return getProfiles()[String(id)] || null }

// شناسهٔ سازنده (constructor.id) را از روی شمارهٔ حسابِ ملک‌جت پیدا می‌کند — پلِ بینِ
// حسابِ سازنده (login phone) و پروفایلِ عمومیِ پرشین سازه.
export function builderIdForPhone(phone: string): string | null {
  const norm = String(phone).replace(/\D/g, '')
  if (!norm) return null
  const prof = Object.values(getProfiles()).find(p => (p.phones || []).some(ph => String(ph).replace(/\D/g, '') === norm))
  return prof?.id || null
}

// ─── دادهٔ صفحاتِ عمومی (فهرستِ پروژه‌ها به تفکیکِ منطقه + صفحهٔ هر پروژه) ──────
export interface PublicProject extends PSProject { builderId: string; builderName: string }

// همهٔ پروژه‌های سازنده‌های شماره‌دار، گروه‌بندی‌شده بر اساسِ منطقه (کش‌شده بر mtime).
export function publicProjectsByRegion(perRegion = 120): { region: string; count: number; projects: PublicProject[] }[] {
  return derived('byRegion', PROFILES_FILE, () => {
    const groups = new Map<string, PublicProject[]>()
    for (const b of Object.values(getProfiles())) {
      for (const pr of b.projects || []) {
        const region = regionLabel(pr) || 'سایر'
        if (!groups.has(region)) groups.set(region, [])
        groups.get(region)!.push({ ...pr, builderId: b.id, builderName: b.name })
      }
    }
    return [...groups.entries()]
      .map(([region, projects]) => ({ region, count: projects.length, projects: projects.slice(0, perRegion) }))
      .sort((a, b) => b.count - a.count)
  })
}

// یک پروژه (بر اساسِ hashId) + سازنده‌اش + سایرِ پروژه‌های همان سازنده.
export function publicProject(hashId: string): { project: PSProject; builder: PSProfile; others: PSProject[] } | null {
  for (const b of Object.values(getProfiles())) {
    const project = (b.projects || []).find(p => p.hashId === hashId)
    if (project) return { project, builder: b, others: (b.projects || []).filter(p => p.hashId !== hashId) }
  }
  return null
}

// ─── فهرستِ تختِ همهٔ پروژه‌های عمومی (با سازنده) — کش‌شده بر mtimeِ پروفایل‌ها ──
function publicFlat(): PublicProject[] {
  return derived('publicFlat', PROFILES_FILE, () => {
    const out: PublicProject[] = []
    for (const b of Object.values(getProfiles())) {
      for (const pr of b.projects || []) out.push({ ...pr, builderId: b.id, builderName: b.name })
    }
    return out
  })
}

// نقطهٔ نقشه برای یک پروژه (یا null اگر مختصاتِ معتبر نداشت).
function toPoint(p: PublicProject): { id: string; lat: number; lng: number; title?: string; price?: string } | null {
  const lat = Number(p.latitude), lng = Number(p.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) < 0.1 || Math.abs(lng) < 0.1) return null
  return { id: p.hashId, lat, lng, title: p.address || p.builderName || '', price: regionLabel(p) || undefined }
}

export interface PublicFacets {
  regions: { value: string; count: number }[]
  phases: { value: number; label: string; count: number }[]
  area: { min: number; max: number }
  total: number
}
// فاستِ فیلترها از کلِ مجموعه (همیشه همهٔ گزینه‌ها نشان داده می‌شوند).
export function publicFacets(): PublicFacets {
  return derived('publicFacets', PROFILES_FILE, () => {
    const all = publicFlat()
    const regions = new Map<string, number>()
    const phases = new Map<number, number>()
    let amin = Infinity, amax = 0
    for (const p of all) {
      const r = regionLabel(p) || 'سایر'
      regions.set(r, (regions.get(r) || 0) + 1)
      if (p.phaseId) phases.set(p.phaseId, (phases.get(p.phaseId) || 0) + 1)
      const a = Number(p.residentialArea) || 0
      if (a > 0) { amin = Math.min(amin, a); amax = Math.max(amax, a) }
    }
    return {
      regions: [...regions.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
      // فقط مرحله‌هایی که نامِ واقعی دارند در فیلتر می‌آیند (کدِ خام نمایش داده نمی‌شود).
      phases: [...phases.entries()].map(([value, count]) => ({ value, label: phaseLabel({ phaseId: value }), count })).filter(p => p.label).sort((a, b) => b.count - a.count),
      area: { min: Number.isFinite(amin) ? Math.floor(amin) : 0, max: Math.ceil(amax) },
      total: all.length,
    }
  })
}

export interface PublicQueryOpts {
  region?: string; phase?: number; floorsMin?: number; unitsMin?: number
  areaMin?: number; areaMax?: number; search?: string; withPhoto?: boolean
  sort?: 'area' | 'units' | 'recent'; page?: number; pageSize?: number
}
// فیلترِ کاملِ پروژه‌های عمومی: منطقه/مرحله/طبقات/واحد/متراژ/جستجو + مرتب‌سازی + صفحه‌بندی.
// همراهِ نقاطِ نقشهٔ کلِ نتیجهٔ فیلتر (سقف‌دار) تا پین‌ها با لیست هماهنگ باشند.
export function publicQuery(opts: PublicQueryOpts = {}) {
  const all = publicFlat()
  const q = (opts.search || '').trim()
  let rows = all.filter(p => {
    if (opts.region && (regionLabel(p) || 'سایر') !== opts.region) return false
    if (opts.phase && p.phaseId !== opts.phase) return false
    if (opts.floorsMin && (Number(p.floors) || 0) < opts.floorsMin) return false
    if (opts.unitsMin && (Number(p.units) || 0) < opts.unitsMin) return false
    const area = Number(p.residentialArea) || 0
    if (opts.areaMin && area < opts.areaMin) return false
    if (opts.areaMax && area > 0 && area > opts.areaMax) return false
    if (opts.withPhoto && !(p.photo?.imageThumbnailUrl || p.photo?.imageUrl || (p.photos && p.photos.length))) return false
    if (q && !((p.address || '').includes(q) || (p.builderName || '').includes(q))) return false
    return true
  })
  const hasPhoto = (p: PublicProject) => !!(p.photo?.imageThumbnailUrl || p.photo?.imageUrl || (p.photos && p.photos.length))
  if (opts.sort === 'area') rows.sort((a, b) => (Number(b.residentialArea) || 0) - (Number(a.residentialArea) || 0))
  else if (opts.sort === 'units') rows.sort((a, b) => (Number(b.units) || 0) - (Number(a.units) || 0))
  else if (opts.sort === 'recent') rows.sort((a, b) => String(b.lastUpdateDate || '').localeCompare(String(a.lastUpdateDate || '')))
  else rows.sort((a, b) => (hasPhoto(b) ? 1 : 0) - (hasPhoto(a) ? 1 : 0) || (Number(b.residentialArea) || 0) - (Number(a.residentialArea) || 0))

  const total = rows.length
  const page = Math.max(1, opts.page || 1), pageSize = Math.min(120, opts.pageSize || 24)
  const items = rows.slice((page - 1) * pageSize, page * pageSize)
  // نقاطِ نقشه برای کلِ نتیجهٔ فیلتر (سقفِ ۳۰۰۰ برای کارایی).
  const points: { id: string; lat: number; lng: number; title?: string; price?: string }[] = []
  for (const p of rows) { const pt = toPoint(p); if (pt) { points.push(pt); if (points.length >= 3000) break } }
  return { total, page, pageSize, items, points }
}

export function profileStats() {
  const all = Object.values(getProfiles())
  const reveals = getReveals()
  const revealedProjects = Object.keys(reveals.items || {}).length
  const totalProjects = getMeta().totalProjects
  return {
    builders: all.length,
    withPhone: all.filter(p => (p.phones || []).length > 0).length,
    projects: all.reduce((s, p) => s + p.projectCount, 0),
    revealedProjects,
    pendingProjects: Math.max(0, totalProjects - revealedProjects),
    quotaAvailable: reveals.meta?.availableCount ?? null,
    lastRevealAt: reveals.meta?.lastRevealAt,
    accounts: builderAccountCount(),
  }
}

// ─── ساختِ حسابِ سازنده در ملک‌جت از پروفایل‌های شماره‌دار ───────────────────
export function builderRoleId(): string | null {
  const r = listRoles(true).find(r => r.dashboard === '/builder')
  return r?.id || null
}
// شمارهٔ تلفنِ معتبرِ موبایلِ یک پروفایل (اولین ۰۹...).
function profilePhone(p: PSProfile): string | null {
  for (const ph of p.phones || []) { const n = String(ph).replace(/\D/g, ''); if (/^09\d{9}$/.test(n)) return n }
  return null
}
// چند حسابِ سازنده از پروفایل‌ها ساخته شده (با یک‌بار خواندنِ حساب‌ها).
export function builderAccountCount(): number {
  const phones = new Set(listAccounts().map(a => a.phone))
  let exist = 0
  for (const p of Object.values(getProfiles())) { const ph = profilePhone(p); if (ph && phones.has(ph)) exist++ }
  return exist
}
// برای هر سازندهٔ شماره‌دار، یک حسابِ ملک‌جت (نقشِ سازنده) می‌سازد — تکراری‌ها رد می‌شوند (دسته‌ای).
export function createBuilderAccounts(): { created: number; skipped: number; noPhone: number; total: number } {
  const roleId = builderRoleId() || undefined
  const profiles = Object.values(getProfiles())
  const rows: { phone: string; name?: string; role?: string }[] = []
  let noPhone = 0
  for (const p of profiles) { const phone = profilePhone(p); if (!phone) { noPhone++; continue } rows.push({ phone, name: p.name || undefined, role: roleId }) }
  const r = bulkCreate(rows)
  return { created: r.created, skipped: r.skipped + r.invalid, noPhone, total: profiles.length }
}
