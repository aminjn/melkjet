import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const FILE = join(process.cwd(), '.account-data.json')

export interface Account { phone: string; name?: string; role?: string; onboarded: boolean; createdAt: number; lastLogin?: number }
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

export function listAccounts(): Account[] {
  return Object.values(load()).sort((a, b) => (b.lastLogin || b.createdAt) - (a.lastLogin || a.createdAt))
}

// نقش کاربر → مسیر داشبورد
export const ROLE_OPTIONS: { id: string; label: string; dash: string }[] = [
  { id: 'buyer', label: 'خریدار / مستأجر', dash: '/buyer' },
  { id: 'seller', label: 'فروشنده / مالک', dash: '/owner' },
  { id: 'investor', label: 'سرمایه‌گذار', dash: '/owner' },
  { id: 'advisor', label: 'مشاور املاک', dash: '/pros' },
  { id: 'agency', label: 'آژانس املاک', dash: '/agency' },
  { id: 'builder', label: 'سازنده / انبوه‌ساز', dash: '/builder' },
  { id: 'materials', label: 'تأمین‌کنندهٔ مصالح', dash: '/materials' },
  { id: 'legal', label: 'مشاور حقوقی', dash: '/legal' },
]
export function dashForRole(role?: string): string {
  return ROLE_OPTIONS.find(r => r.id === role)?.dash || '/buyer'
}
