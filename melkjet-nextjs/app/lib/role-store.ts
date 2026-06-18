import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

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
  if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} }
  const db: DB = { roles: defaults() }; save(db); return db
}
function save(db: DB) { writeFileSync(FILE, JSON.stringify(db, null, 2), 'utf-8') }

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
]

function defaults(): Role[] {
  const t = Date.now()
  const mk = (name: string, dashboard: string, permissions: string[]): Role =>
    ({ id: id(), name, dashboard, permissions, builtin: true, active: true, createdAt: t })
  return [
    mk('خریدار / مستأجر', '/buyer', ['content']),
    mk('فروشنده / مالک', '/owner', ['listings', 'analytics']),
    mk('سرمایه‌گذار', '/owner', ['analytics']),
    mk('مشاور املاک', '/pros', ['listings', 'crm', 'content', 'website']),
    mk('آژانس املاک', '/agency', ['listings', 'crm', 'marketing', 'website', 'content', 'analytics']),
    mk('سازنده / انبوه‌ساز', '/builder', ['units', 'investors', 'crm', 'marketing', 'website', 'analytics']),
    mk('تأمین‌کنندهٔ مصالح', '/materials', ['store', 'marketing', 'website']),
    mk('مشاور حقوقی', '/legal', ['content', 'website']),
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
