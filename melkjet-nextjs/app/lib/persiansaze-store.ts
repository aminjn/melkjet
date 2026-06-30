import fs from 'fs'
import path from 'path'

// ─── پرشین سازه: کانفیگِ اسکرپ + دادهٔ اسکرپ‌شده + پروفایلِ سازنده‌ها ───────────
// دو فایلِ gitignore در ریشهٔ اپ:
//   .persiansaze-config.json  → یوزر/پسورد/زمان‌بندی (اسکریپتِ اسکرپ هم همین را می‌خواند)
//   .persiansaze-data.json    → خروجیِ اسکرپ (پروژه‌ها + سازنده‌های یکتا) که اسکریپت می‌نویسد

const CONFIG_FILE = path.join(process.cwd(), '.persiansaze-config.json')
const DATA_FILE = path.join(process.cwd(), '.persiansaze-data.json')
const PROFILES_FILE = path.join(process.cwd(), '.persiansaze-profiles.json')

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

// پروفایلِ سازنده که در ملک‌جت ساخته/نگه‌داری می‌شود (با شماره و پروژه‌ها).
export interface PSProfile {
  id: string              // برابرِ نامِ سازنده (نرمال‌شده)
  name: string
  phone?: string          // پس از گرفتنِ شماره پر می‌شود
  phoneRevealedAt?: string
  projectCount: number
  projects: PSProject[]   // همهٔ پروژه‌های این سازنده
  regions: number[]
  createdAt: string
  updatedAt: string
}

// ─── خواندن/نوشتنِ کانفیگ ───────────────────────────────────────────────────
const DEFAULT_CONFIG: PSConfig = { user: '', pass: '', enabled: false, channel: 'chrome', limit: 100, weeklyQuota: 500 }

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
export function getData(): PSData {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) } catch { return {} }
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

// ─── پروفایلِ سازنده‌ها ──────────────────────────────────────────────────────
function normId(name: string) { return name.trim().replace(/\s+/g, ' ') }

export function getProfiles(): Record<string, PSProfile> {
  try { return JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8')) } catch { return {} }
}
function saveProfiles(p: Record<string, PSProfile>) { fs.writeFileSync(PROFILES_FILE, JSON.stringify(p)) }

// از دادهٔ اسکرپ‌شده، پروفایلِ هر سازنده را می‌سازد/به‌روزرسانی می‌کند (شماره را حفظ می‌کند).
export function rebuildProfiles(): { created: number; updated: number; total: number } {
  const data = getData()
  const projects = data.projects || []
  const byBuilder = new Map<string, PSProject[]>()
  for (const p of projects) {
    const name = normId(p.receptor || '')
    if (!name) continue
    if (!byBuilder.has(name)) byBuilder.set(name, [])
    byBuilder.get(name)!.push(p)
  }
  const existing = getProfiles()
  const now = new Date().toISOString()
  let created = 0, updated = 0
  for (const [name, projs] of byBuilder) {
    const id = name
    const regions = [...new Set(projs.map(p => p.regionId).filter(Boolean) as number[])]
    if (existing[id]) {
      existing[id] = { ...existing[id], name, projectCount: projs.length, projects: projs, regions, updatedAt: now }
      updated++
    } else {
      existing[id] = { id, name, projectCount: projs.length, projects: projs, regions, createdAt: now, updatedAt: now }
      created++
    }
  }
  saveProfiles(existing)
  return { created, updated, total: Object.keys(existing).length }
}

// شمارهٔ یک سازنده را ثبت می‌کند (پس از گرفتن از پرشین سازه).
export function setProfilePhone(id: string, phone: string) {
  const all = getProfiles()
  if (all[normId(id)]) { all[normId(id)].phone = phone; all[normId(id)].phoneRevealedAt = new Date().toISOString(); saveProfiles(all) }
}

// لیستِ پروفایل‌ها با جستجو/صفحه‌بندی برای UI.
export function listProfiles(opts: { search?: string; withPhone?: boolean; page?: number; pageSize?: number } = {}) {
  const all = Object.values(getProfiles())
  const q = (opts.search || '').trim()
  let rows = all
  if (q) rows = rows.filter(p => p.name.includes(q))
  if (opts.withPhone) rows = rows.filter(p => !!p.phone)
  rows.sort((a, b) => b.projectCount - a.projectCount)
  const total = rows.length
  const page = Math.max(1, opts.page || 1), pageSize = opts.pageSize || 30
  return { total, page, pageSize, rows: rows.slice((page - 1) * pageSize, page * pageSize) }
}

export function getProfile(id: string): PSProfile | null { return getProfiles()[normId(id)] || null }

export function profileStats() {
  const all = Object.values(getProfiles())
  return {
    builders: all.length,
    withPhone: all.filter(p => p.phone).length,
    projects: all.reduce((s, p) => s + p.projectCount, 0),
  }
}
