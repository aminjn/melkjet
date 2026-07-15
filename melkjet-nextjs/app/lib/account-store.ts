import { join } from 'path'
import { dashForRoleId, listRoles } from './role-store'
import { readJsonCached, writeJsonCached } from './json-file'

const FILE = join(process.cwd(), '.account-data.json')

export interface Account {
  phone: string; name?: string; role?: string; plan?: string; onboarded: boolean; createdAt: number; lastLogin?: number
  // اشتراک: زمانِ شروع/پایانِ پلنِ فعال (برای جلوگیری از خریدِ دوباره تا پایان)
  planStartedAt?: number; planExpiresAt?: number
  adminSections?: string[]   // فاز ۱۱۵ (پرسنل): بخش‌های مجازِ پنلِ ادمین — اعطا فقط توسطِ سوپرادمین
  // هویتِ تأییدشدهٔ شاهکار (پس از تأیید غیرقابلِ‌تغییر است)
  nationalId?: string; firstName?: string; lastName?: string; gender?: string; fatherName?: string; birthDate?: string; birthPlace?: string; idNumber?: string; idSerial?: string; birthPlaceCode?: string; fullName?: string; issuancePlace?: string; issuancePlaceCode?: string; officeCode?: string; identityVerifiedAt?: number
  // کلِ پاسخِ هویتیِ شاهکار — تا هیچ فیلدی از دست نرود
  identityRaw?: Record<string, unknown>
  // تعلیقِ پنل به‌خاطرِ پروفایلِ ناقص (بدونِ reason) یا تعلیقِ ضدتقلب/ادمین (با reason → ورود مسدود)
  suspended?: boolean; profileWarnAt?: number; suspendReason?: string; suspendedAt?: number
  // فاز ۱۲۷ (فیدبک: «رفع تعلیق می‌کنم دوباره تعلیق می‌شود»): رفعِ تعلیقِ دستیِ ادمین = معافیتِ ماندگار از تعلیقِ خودکار
  gateExempt?: boolean
  // پرچمِ بررسیِ ضدتقلب (هنوز معلق نشده — در صفِ بازبینیِ سوپرادمین)
  flagged?: boolean; flagReason?: string; flaggedAt?: number
  // دسترسی‌های ویژه که سوپرادمین می‌دهد (مثلِ 'catalog' برای مدیریتِ کاتالوگ و اسکرپِ هایپرساز)
  caps?: string[]
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

function load(): DB { return readJsonCached<DB>(FILE, {}) }
function save(db: DB) { writeJsonCached(FILE, db, true) }

export function getAccount(phone: string): Account | null { return load()[phone] || null }

// فاز ۱۴۲ (فیدبک: «دیوار احراز نمی‌کند؛ یک نفر دو شماره/دو حساب دارد — امکانِ مرج لازم است»)
// ادغامِ حسابِ secondary در primary: هویتِ احرازشده/نام/نقش/پلنِ بهتر به اصلی می‌رود؛ حسابِ دوم
// تعلیق می‌شود (با دلیلِ روشن) تا تاریخچه بماند ولی دیگر واردِ چرخه نشود. adminSections هرگز منتقل نمی‌شود.
export function mergeAccounts(primary: string, secondary: string): { ok: boolean; error?: string } {
  const db = load()
  const p = db[primary]; const s = db[secondary]
  if (!p || !s) return { ok: false, error: 'یکی از دو حساب پیدا نشد' }
  if (primary === secondary) return { ok: false, error: 'دو حساب یکی هستند' }
  if (!p.name && s.name) p.name = s.name
  if (!p.role && s.role) p.role = s.role
  // هویتِ احرازشدهٔ شاهکار: اگر اصلی احراز نشده و دومی شده، همهٔ فیلدهای هویتی منتقل می‌شوند
  if (!p.identityVerifiedAt && s.identityVerifiedAt) {
    for (const k of ['nationalId', 'firstName', 'lastName', 'gender', 'fatherName', 'birthDate', 'birthPlace', 'idNumber', 'idSerial', 'birthPlaceCode', 'fullName', 'issuancePlace', 'issuancePlaceCode', 'officeCode', 'identityVerifiedAt', 'identityRaw'] as const) {
      if (s[k] !== undefined) (p as any)[k] = s[k]
    }
  }
  // پلن: اگر دومی پلنِ فعالِ دیرپاتری دارد، به اصلی می‌رود (هیچ پلنی از دست نرود)
  const sActive = s.plan && (!s.planExpiresAt || s.planExpiresAt > Date.now())
  if (sActive && (!p.plan || (p.planExpiresAt || 0) < (s.planExpiresAt || Infinity))) {
    p.plan = s.plan; p.planStartedAt = s.planStartedAt; p.planExpiresAt = s.planExpiresAt
  }
  s.suspended = true; s.suspendedAt = Date.now(); s.gateExempt = false
  s.suspendReason = `ادغام‌شده در حسابِ ${primary} — این حساب دیگر استفاده نمی‌شود`
  delete s.adminSections
  save(db)
  return { ok: true }
}

// دسترسی‌های ویژه (caps) که سوپرادمین به کاربر می‌دهد.
export function hasCap(phone: string, cap: string): boolean {
  const a = load()[phone]
  return !!a?.caps?.includes(cap)
}
export function setCap(phone: string, cap: string, on: boolean): Account | null {
  const db = load(); const a = db[phone]; if (!a) return null
  const caps = new Set(a.caps || [])
  if (on) caps.add(cap); else caps.delete(cap)
  a.caps = [...caps]; save(db); return a
}

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
export function setPlan(phone: string, plan: string, durationMs?: number): Account {
  const db = load()
  if (!db[phone]) db[phone] = { phone, onboarded: false, createdAt: Date.now() }
  db[phone].plan = plan || undefined
  if (durationMs && durationMs > 0) {
    const now = Date.now()
    db[phone].planStartedAt = now
    db[phone].planExpiresAt = now + durationMs
  } else if (!plan) {
    db[phone].planStartedAt = undefined; db[phone].planExpiresAt = undefined
  }
  save(db); return db[phone]
}

// پلنِ فعالِ کاربر (اگر منقضی نشده باشد) — برای گِیتِ خریدِ دوباره.
export function activePlan(phone: string): { plan: string; expiresAt?: number } | null {
  const a = load()[phone]
  if (!a?.plan) return null
  if (a.planExpiresAt && a.planExpiresAt <= Date.now()) return null   // منقضی شده
  return { plan: a.plan, expiresAt: a.planExpiresAt }
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

// ساختِ دسته‌ایِ حساب‌ها (یک‌بار خواندن/نوشتن) — برای واردکردنِ انبوه (مثلِ سازنده‌های پرشین سازه).
export function bulkCreate(rows: { phone: string; name?: string; role?: string }[]): { created: number; skipped: number; invalid: number } {
  const db = load()
  let created = 0, skipped = 0, invalid = 0
  for (const r of rows) {
    const p = String(r.phone).replace(/\D/g, '')
    if (!/^09\d{9}$/.test(p)) { invalid++; continue }
    if (db[p]) { skipped++; continue }
    db[p] = { phone: p, name: r.name ? String(r.name).slice(0, 60) : undefined, role: r.role || undefined, onboarded: !!r.role, createdAt: Date.now() }
    created++
  }
  if (created) save(db)
  return { created, skipped, invalid }
}
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
export function setSuspended(phone: string, val: boolean, reason?: string) {
  const db = load(); const a = db[phone]; if (!a) return
  a.suspended = val || undefined
  a.suspendReason = val ? (reason || a.suspendReason) : undefined
  a.suspendedAt = val ? Date.now() : undefined
  if (!val) a.profileWarnAt = undefined
  if (val) { a.flagged = undefined; a.flagReason = undefined; a.flaggedAt = undefined }   // تعلیق پرچم را می‌بلعد
  save(db)
}
// فاز ۱۲۷ — معافیت از تعلیقِ خودکار: وقتی ادمین دستی رفعِ تعلیق می‌کند، موتورِ گیتِ پروفایل دیگر سراغش نمی‌رود.
export function setGateExempt(phone: string, on: boolean) {
  const db = load(); const a = db[phone]; if (!a) return
  a.gateExempt = on || undefined
  save(db)
}
// پرچمِ بازبینیِ ضدتقلب (تعلیق نیست؛ فقط در صفِ بررسیِ سوپرادمین می‌نشیند).
export function setFlagged(phone: string, val: boolean, reason?: string) {
  const db = load(); const a = db[phone]; if (!a) return
  a.flagged = val || undefined
  a.flagReason = val ? (reason || a.flagReason) : undefined
  a.flaggedAt = val ? Date.now() : undefined
  save(db)
}
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
  // فاز ۱۱۹: نقش‌های مخفی (کارمندان) از مسیرِ عمومیِ پروفایل قابلِ‌انتخاب نیستند — فقط سوپرادمین می‌دهد
  return listRoles(true).some(r => (r.id === role || r.name === role) && !r.hidden)
}

// فاز ۱۲۴ — حسابِ محافظت‌شده: سوپرادمین یا هر دارندهٔ دسترسیِ پنل (پرسنل).
// پرسنل هرگز نمی‌تواند این حساب‌ها را ویرایش/تعلیق/حذف کند — جلوی خراب‌کاری/ارتقای اختیار.
export const SUPER_ADMIN_PHONE = '09122862184'
export function isProtectedAccount(phone: string): boolean {
  if (phone === SUPER_ADMIN_PHONE) return true
  const a = load()[phone]
  return !!(a && (a.adminSections || []).length)
}

// فاز ۱۱۵ — اعطا/لغوِ دسترسیِ پرسنل به بخش‌های پنلِ ادمین (فقط سوپرادمین صدا می‌زند؛ گارد در API)
export function setAdminSections(phone: string, sections: string[]): Account | null {
  const db = load()
  const a = db[phone]
  if (!a) return null
  const clean = [...new Set(sections.map(x => String(x).trim()).filter(Boolean))].slice(0, 40)
  if (clean.length) a.adminSections = clean; else delete a.adminSections
  save(db)
  return a
}
