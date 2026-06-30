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
  phaseId?: number; usageTypeId?: number; structureTypeId?: number
  groundArea?: number; residentialArea?: number
  floors?: number; subFloors?: number; units?: number
  latitude?: number; longitude?: number
  lastUpdateDate?: string; phaseLastUpdateDate?: string
  photo?: { imageUrl?: string; imageThumbnailUrl?: string }
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
  items?: Record<string, { constructorId: number; name?: string; phones?: string[]; hasDup?: boolean; receptor?: string; revealedAt?: string }>
}
export function getReveals(): PSReveals {
  try { return JSON.parse(fs.readFileSync(REVEALS_FILE, 'utf8')) } catch { return { meta: {}, items: {} } }
}

// ─── خواندن/نوشتنِ کانفیگ ───────────────────────────────────────────────────
const DEFAULT_CONFIG: PSConfig = { user: '', pass: '', enabled: false, channel: 'chrome', limit: 20, weeklyQuota: 500 }

export function getConfig(): PSConfig {
  try { return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) } }
  catch { return { ...DEFAULT_CONFIG } }
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
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) } catch { return {} }
}

// متادیتای سبک (شمارش‌ها) — بدونِ پارسِ فایلِ بزرگ. اگر نبود، یک‌بار از دیتا ساخته و کش می‌شود.
export function getMeta(): { lastSync?: string; totalProjects: number; totalBuilders: number } {
  try { const m = JSON.parse(fs.readFileSync(META_FILE, 'utf8')); if (typeof m.totalProjects === 'number') return m } catch {}
  // self-heal: یک‌بار از فایلِ بزرگ بخوان و متای کوچک را بنویس
  const d = getData()
  const meta = { lastSync: d.lastSync, totalProjects: (d.projects || []).length || d.totalProjects || 0, totalBuilders: (d.builders || []).length || d.totalBuilders || 0 }
  try { fs.writeFileSync(META_FILE, JSON.stringify(meta)) } catch {}
  return meta
}

// ─── کمک‌ها: نامِ منطقه/مرحله ───────────────────────────────────────────────
export function regionLabel(p: { cityId?: number; regionId?: number }): string {
  if (p.cityId === 1 && p.regionId && p.regionId > 100 && p.regionId < 123) return `تهران، منطقه ${p.regionId - 100}`
  if (p.regionId) return `منطقه ${p.regionId}`
  return ''
}
// نگاشتِ مرحله‌های ساخت (از روی UIِ پرشین سازه؛ قابلِ تکمیل).
export const PHASE_NAMES: Record<number, string> = {
  2006: 'گچ و خاک', 2007: 'سفت‌کاری', 2008: 'ابتدای نازک‌کاری', 2016: 'نازک‌کاری',
}
export function phaseLabel(p: { phaseId?: number }): string {
  return (p.phaseId && PHASE_NAMES[p.phaseId]) || (p.phaseId ? `مرحله ${p.phaseId}` : '')
}

// ─── پروفایلِ سازنده‌ها (کلید: constructor.id) ──────────────────────────────
// پروفایل‌ها را موتورِ reveal در .persiansaze-profiles.json می‌نویسد. این‌جا فقط می‌خوانیم.
export function getProfiles(): Record<string, PSProfile> {
  const raw: Record<string, any> = (() => { try { return JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8')) } catch { return {} } })()
  const out: Record<string, PSProfile> = {}
  for (const [id, p] of Object.entries(raw)) {
    out[id] = { id, name: p.name || '', phones: p.phones || (p.phone ? [p.phone] : []), phone: (p.phones && p.phones[0]) || p.phone, projectCount: p.projectCount || (p.projects || []).length, projects: p.projects || [], regions: p.regions || [], revealedAt: p.revealedAt }
  }
  return out
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
    if (proj) { b.projects.push(proj); if (proj.regionId) b.regions.add(proj.regionId) }
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

// ─── دادهٔ صفحاتِ عمومی (فهرستِ پروژه‌ها به تفکیکِ منطقه + صفحهٔ هر پروژه) ──────
export interface PublicProject extends PSProject { builderId: string; builderName: string }

// همهٔ پروژه‌های سازنده‌های شماره‌دار، گروه‌بندی‌شده بر اساسِ منطقه.
export function publicProjectsByRegion(perRegion = 120): { region: string; count: number; projects: PublicProject[] }[] {
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
}

// یک پروژه (بر اساسِ hashId) + سازنده‌اش + سایرِ پروژه‌های همان سازنده.
export function publicProject(hashId: string): { project: PSProject; builder: PSProfile; others: PSProject[] } | null {
  for (const b of Object.values(getProfiles())) {
    const project = (b.projects || []).find(p => p.hashId === hashId)
    if (project) return { project, builder: b, others: (b.projects || []).filter(p => p.hashId !== hashId) }
  }
  return null
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
