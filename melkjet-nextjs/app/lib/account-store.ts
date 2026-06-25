import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { dashForRoleId, listRoles } from './role-store'

const FILE = join(process.cwd(), '.account-data.json')

export interface Account {
  phone: string; name?: string; role?: string; plan?: string; onboarded: boolean; createdAt: number; lastLogin?: number
  // هویتِ تأییدشدهٔ شاهکار (پس از تأیید غیرقابلِ‌تغییر است)
  nationalId?: string; firstName?: string; lastName?: string; gender?: string; fatherName?: string; birthDate?: string; birthPlace?: string; idNumber?: string; idSerial?: string; birthPlaceCode?: string; fullName?: string; issuancePlace?: string; issuancePlaceCode?: string; officeCode?: string; identityVerifiedAt?: number
  // کلِ پاسخِ هویتیِ شاهکار — تا هیچ فیلدی از دست نرود
  identityRaw?: Record<string, unknown>
  // تعلیقِ پنل به‌خاطرِ پروفایلِ ناقص
  suspended?: boolean; profileWarnAt?: number
}
type Idy = { nationalId: string; firstName?: string; lastName?: string; gender?: string; fatherName?: string; birthDate?: string; birthPlace?: string; idNumber?: string; idSerial?: string; birthPlaceCode?: string; fullName?: string; issuancePlace?: string; issuancePlaceCode?: string; officeCode?: string; raw?: Record<string, unknown> }

// همهٔ فیلدهای هویتی را روی یک حساب می‌نشاند (مشترک بینِ ساخت/اعمال)
function assignIdentity(a: Account, idy: Idy) {
  a.nationalId = idy.nationalId; a.firstName = idy.firstName; a.lastName = idy.lastName; a.gender = idy.gender
  a.fatherName = idy.fatherName; a.birthDate = idy.birthDate; a.birthPlace = idy.birthPlace
  a.idNumber = idy.idNumber; a.idSerial = idy.idSerial; a.birthPlaceCode = idy.birthPlaceCode
  a.fullName = idy.fullName; a.issuancePlace = idy.issuancePlace; a.issuancePlaceCode = idy.issuancePlaceCode; a.officeCode = idy.officeCode
  if (idy.raw && typeof idy.raw === 'object') a.identityRaw = idy.raw
}
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

// ساختِ کاربر توسطِ سوپرادمین (دستی) — با هویتِ شاهکار (اختیاری) و وضعیتِ تأیید
export function createAccount(phone: string, patch: { name?: string; role?: string; plan?: string; identity?: Idy; verified?: boolean }): { ok: boolean; error?: string; account?: Account } {
  const p = String(phone).replace(/\D/g, '')
  if (!/^09\d{9}$/.test(p)) return { ok: false, error: 'شمارهٔ موبایل معتبر نیست (۰۹...)' }
  const db = load()
  if (db[p]) return { ok: false, error: 'این کاربر از قبل وجود دارد' }
  const idy = patch.identity
  const full = idy ? `${idy.firstName || ''} ${idy.lastName || ''}`.trim() : ''
  const nm = full || (patch.name ? String(patch.name).slice(0, 60) : '')
  const a: Account = { phone: p, name: nm || undefined, role: patch.role || undefined, plan: patch.plan || undefined, onboarded: !!patch.role, createdAt: Date.now() }
  if (idy) { assignIdentity(a, idy); if (patch.verified) a.identityVerifiedAt = Date.now() }
  db[p] = a
  save(db)
  return { ok: true, account: db[p] }
}

export function accountExists(phone: string): boolean { return !!load()[phone] }
export function accountByNationalId(nid: string): Account | null { if (!nid) return null; return Object.values(load()).find(a => a.nationalId === nid) || null }
export function touchLogin(phone: string) { const db = load(); if (db[phone]) { db[phone].lastLogin = Date.now(); save(db) } }

// ساختِ حساب با هویتِ تأییدشدهٔ شاهکار (نام از ثبت‌احوال؛ نقش هنوز انتخاب نشده ⇒ onboarded:false)
export function createVerifiedAccount(phone: string, idy: Idy): Account {
  const db = load()
  const full = `${idy.firstName || ''} ${idy.lastName || ''}`.trim()
  const a: Account = { phone, name: full || undefined, onboarded: false, createdAt: Date.now(), lastLogin: Date.now(), identityVerifiedAt: Date.now() }
  assignIdentity(a, idy)
  db[phone] = a; save(db)
  return a
}

// اعمالِ هویتِ تأییدشده روی حسابِ موجود (مثلاً حسابی که سوپرادمین ساخته و کاربر در اولین ورود احراز می‌کند)
export function applyIdentity(phone: string, idy: Idy): Account | null {
  const db = load(); const a = db[phone]; if (!a) return null
  const full = `${idy.firstName || ''} ${idy.lastName || ''}`.trim()
  if (full) a.name = full
  assignIdentity(a, idy)
  a.identityVerifiedAt = Date.now(); a.lastLogin = Date.now()
  save(db); return a
}

// بازخوانیِ هویت از شاهکار برای حسابِ احرازشدهٔ موجود (پُرکردنِ همهٔ فیلدها بدونِ تغییرِ نقش/نام).
export function refreshIdentity(phone: string, idy: Idy): Account | null {
  const db = load(); const a = db[phone]; if (!a) return null
  assignIdentity(a, idy)
  if (!a.identityVerifiedAt) a.identityVerifiedAt = Date.now()
  save(db); return a
}

export function adminUpdate(phone: string, patch: { name?: string; role?: string; plan?: string }): Account | null {
  const db = load(); const a = db[phone]; if (!a) return null
  if (patch.name !== undefined) a.name = String(patch.name).slice(0, 60)
  if (patch.role !== undefined) { a.role = String(patch.role); a.onboarded = true }
  if (patch.plan !== undefined) a.plan = String(patch.plan) || undefined
  save(db); return a
}
export function setSuspended(phone: string, val: boolean) { const db = load(); const a = db[phone]; if (a) { a.suspended = val || undefined; if (!val) a.profileWarnAt = undefined; save(db) } }
export function setProfileWarn(phone: string, ts: number | undefined) { const db = load(); const a = db[phone]; if (a) { a.profileWarnAt = ts; save(db) } }
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
