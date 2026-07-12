import { join } from 'path'
import { randomBytes } from 'crypto'
import { readJsonCached, writeJsonCached } from './json-file'

const FILE = join(process.cwd(), '.role-data.json')

export interface Role {
  id: string
  name: string
  dashboard: string          // مسیر داشبورد پیش‌فرض این نقش
  planId?: string            // پلنی که این نقش/دسترسی را باز می‌کند (خالی = رایگان/پیش‌فرض)
  permissions: string[]      // کلید قابلیت‌های مجاز (برای گیت آینده)
  builtin?: boolean          // نقش‌های پایه قابل حذف نیستند
  active: boolean
  createdAt: number
}

type DB = { roles: Role[] }
function id() { return randomBytes(5).toString('hex') }
function load(): DB {
  const existing = readJsonCached<DB | null>(FILE, null)
  if (existing && existing.roles) {
    {
      const db = existing
      let migrated = false
      // تغییر نام نقشِ «خریدار / مستأجر» به «کاربر عادی»
      for (const r of db.roles || []) {
        if (r.name === 'خریدار / مستأجر') { r.name = 'کاربر عادی'; migrated = true }
      }
      // ادغام: نقش‌های «فروشنده / مالک»، «سرمایه‌گذار» و «مالک» حذف می‌شوند —
      // همه با «کاربر عادی» (/buyer) یکپارچه شده‌اند؛ کاربرانِ قدیمی به /buyer برمی‌گردند.
      const before = (db.roles || []).length
      db.roles = (db.roles || []).filter(r => !(r.builtin && (r.name === 'فروشنده / مالک' || r.name === 'سرمایه‌گذار' || r.name === 'مالک' || r.dashboard === '/owner')))
      if (db.roles.length !== before) migrated = true
      // اطمینان از وجود نقشِ «کاربر عادی» با امکاناتِ یکپارچه
      const buyerRole = db.roles.find(r => r.name === 'کاربر عادی')
      if (buyerRole) {
        for (const p of ['listings', 'analytics']) if (!buyerRole.permissions.includes(p)) { buyerRole.permissions.push(p); migrated = true }
        if (buyerRole.dashboard !== '/buyer') { buyerRole.dashboard = '/buyer'; migrated = true }
      }
      // اطمینان از وجودِ نقش‌های متخصصِ خدماتی روی نصب‌های قدیمی (اگر نبودند، اضافه کن).
      for (const seed of proDefaults()) {
        if (!db.roles.some(r => r.dashboard === seed.dashboard || r.name === seed.name)) { db.roles.push(seed); migrated = true }
      }
      if (migrated) save(db)
      return db
    }
  }
  const db: DB = { roles: defaults() }; save(db); return db
}
function save(db: DB) { writeJsonCached(FILE, db, true) }

// قابلیت‌های قابل‌اعطا (برای گیت دسترسی هر نقش/پلن)
export const PERMISSIONS: { id: string; label: string }[] = [
  { id: 'listings', label: 'مدیریت آگهی‌ها' },
  { id: 'crm', label: 'CRM و لیدها' },
  { id: 'marketing', label: 'بازاریابی و کمپین' },
  { id: 'automation', label: 'اتوماسیون' },
  { id: 'website', label: 'سایت‌ساز' },
  { id: 'content', label: 'تولید محتوا و بلاگ' },
  { id: 'analytics', label: 'گزارش‌ها و تحلیل' },
  { id: 'units', label: 'مدیریت واحدها (سازنده)' },
  { id: 'investors', label: 'سرمایه‌گذاران' },
  { id: 'store', label: 'فروشگاه/مصالح' },
  { id: 'ai_studio', label: 'استودیو AI (پلان/سه‌بعدی)' },
  { id: 'vip', label: 'حسابِ حرفه‌ای (VIP — هوشِ بازار)' },
  { id: 'club', label: 'باشگاهِ کسب‌وکار (Business Club)' },
  { id: 'season_pass', label: 'گذرنامهٔ فصل (CEO Pass)' },   // فاز ۱۰۶: «اطلاعاتِ بهتر، نه قدرت» — سند ۲۲
]

function mkRole(name: string, dashboard: string, permissions: string[]): Role {
  return { id: id(), name, dashboard, permissions, builtin: true, active: true, createdAt: Date.now() }
}

// نقش‌های متخصصِ خدماتی — هر کدام پنلِ اختصاصیِ خودش را دارد (میزِ کارِ متخصص).
// این‌ها هم در ثبت‌نام/سوپرادمین دیده می‌شوند و هم به دایرکتوری وصل‌اند.
function proDefaults(): Role[] {
  return [
    mkRole('معمار و طراح داخلی', '/architect', ['crm', 'content', 'website', 'analytics']),
    mkRole('پیمانکار', '/contractor', ['crm', 'content', 'website', 'analytics']),
    mkRole('کارشناس رسمی', '/appraiser', ['crm', 'analytics']),
    mkRole('دفتر حقوقی', '/lawfirm', ['crm', 'content', 'website']),
    mkRole('بانک و بیمه', '/finance', ['crm', 'marketing', 'analytics']),
    mkRole('دفترخانه', '/notary', ['crm', 'analytics']),
  ]
}

function defaults(): Role[] {
  return [
    mkRole('کاربر عادی', '/buyer', ['listings', 'content', 'analytics']),
    mkRole('مشاور املاک', '/pros', ['listings', 'crm', 'content', 'website']),
    mkRole('آژانس املاک', '/agency', ['listings', 'crm', 'marketing', 'website', 'content', 'analytics']),
    mkRole('سازنده / انبوه‌ساز', '/builder', ['units', 'investors', 'crm', 'marketing', 'website', 'analytics']),
    mkRole('تأمین‌کنندهٔ مصالح', '/materials', ['store', 'marketing', 'website']),
    mkRole('مشاور حقوقی', '/legal', ['content', 'website']),
    ...proDefaults(),
  ]
}

export function listRoles(activeOnly = false): Role[] {
  return load().roles.filter(r => !activeOnly || r.active)
}
export function getRole(rid: string): Role | null { return load().roles.find(r => r.id === rid) || null }
export function roleByDashboard(dash: string): Role | null { return load().roles.find(r => r.dashboard === dash) || null }

export function addRole(input: { name: string; dashboard: string; planId?: string; permissions?: string[] }): Role {
  const db = load()
  const r: Role = { id: id(), name: input.name, dashboard: input.dashboard || '/buyer', planId: input.planId || undefined, permissions: input.permissions || [], active: true, createdAt: Date.now() }
  db.roles.push(r); save(db); return r
}
export function updateRole(rid: string, patch: Partial<Pick<Role, 'name' | 'dashboard' | 'planId' | 'permissions' | 'active'>>): Role | null {
  const db = load(); const r = db.roles.find(x => x.id === rid); if (!r) return null
  Object.assign(r, patch); save(db); return r
}
export function deleteRole(rid: string): boolean {
  const db = load(); const r = db.roles.find(x => x.id === rid)
  if (!r || r.builtin) return false
  db.roles = db.roles.filter(x => x.id !== rid); save(db); return true
}

// نقش (با شناسه یا نام) → مسیر داشبورد
export function dashForRoleId(roleIdOrName?: string): string {
  if (!roleIdOrName) return '/buyer'
  const roles = load().roles
  const r = roles.find(x => x.id === roleIdOrName) || roles.find(x => x.name === roleIdOrName)
  return r?.dashboard || '/buyer'
}
