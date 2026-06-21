import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { dashForRoleId, listRoles } from './role-store'

const FILE = join(process.cwd(), '.account-data.json')

export interface Account { phone: string; name?: string; role?: string; plan?: string; onboarded: boolean; createdAt: number; lastLogin?: number }
type DB = Record<string, Account>

function load(): DB { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return {} }
function save(db: DB) { writeFileSync(FILE, JSON.stringify(db, null, 2), 'utf-8') }

export function getAccount(phone: string): Account | null { return load()[phone] || null }

// اولین ورود → حساب ساخته می‌شود (onboarded:false تا نقش/نام تکمیل شود)
export function ensureAccount(phone: string): { account: Account; isNew: boolean } {
  const db = load()
  let isNew = false
  if (!db[phone]) { db[phone] = { phone, onboarded: false, createdAt: Date.now() }; isNew = true }
  db[phone].lastLogin = Date.now()
  save(db)
  return { account: db[phone], isNew }
}

export function setProfile(phone: string, patch: { name?: string; role?: string }): Account {
  const db = load()
  const a = db[phone] || { phone, onboarded: false, createdAt: Date.now() }
  if (patch.name !== undefined) a.name = String(patch.name).slice(0, 60)
  if (patch.role !== undefined) a.role = String(patch.role)
  a.onboarded = true
  db[phone] = a; save(db)
  return a
}

// ── مدیریت کاربران از سوپرادمین ──
// پلنِ کاربر را پس از پرداخت موفق تنظیم می‌کند (حساب را در صورت نبود می‌سازد).
export function setPlan(phone: string, plan: string): Account {
  const db = load()
  if (!db[phone]) db[phone] = { phone, onboarded: false, createdAt: Date.now() }
  db[phone].plan = plan || undefined
  save(db); return db[phone]
}

export function adminUpdate(phone: string, patch: { name?: string; role?: string; plan?: string }): Account | null {
  const db = load(); const a = db[phone]; if (!a) return null
  if (patch.name !== undefined) a.name = String(patch.name).slice(0, 60)
  if (patch.role !== undefined) { a.role = String(patch.role); a.onboarded = true }
  if (patch.plan !== undefined) a.plan = String(patch.plan) || undefined
  save(db); return a
}
export function deleteAccount(phone: string) { const db = load(); delete db[phone]; save(db) }
export function bulkUpdate(phones: string[], patch: { role?: string; plan?: string }) {
  const db = load()
  for (const p of phones) { const a = db[p]; if (!a) continue; if (patch.role !== undefined) { a.role = patch.role; a.onboarded = true }; if (patch.plan !== undefined) a.plan = patch.plan || undefined }
  save(db)
}
export function bulkDelete(phones: string[]) { const db = load(); for (const p of phones) delete db[p]; save(db) }

export function listAccounts(): Account[] {
  return Object.values(load()).sort((a, b) => (b.lastLogin || b.createdAt) - (a.lastLogin || a.createdAt))
}

// نقش کاربر (شناسه یا نام نقش از role-store) → مسیر داشبورد
export function dashForRole(role?: string): string { return dashForRoleId(role) }

// آیا این نقش معتبر است؟ (برای آنبوردینگ)
export function isValidRole(role: string): boolean {
  return listRoles(true).some(r => r.id === role || r.name === role)
}
