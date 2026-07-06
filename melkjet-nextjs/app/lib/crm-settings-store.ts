import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { pgEnabled, kvGet, kvMutate } from './db'

// ── تنظیماتِ اتوماسیونِ CRM هر کاربر (owner = phone) ──
// دومَحاله: Postgres (اگر DATABASE_URL) وگرنه فایل.
const DATA_FILE = join(process.cwd(), '.crm-settings-data.json')
const KV_KEY = 'crm_settings'

export interface CrmSettings {
  autoWelcomeSms: boolean          // لیدِ جدید با شماره → پیامکِ خوش‌آمدِ خودکار
  welcomeTemplate: string          // متنِ پیامک ({name} → نامِ لید)
  followUpHours: number            // آستانهٔ «پیگیریِ لازم» (پیش‌فرض ۲۴)
}
const DEFAULTS: CrmSettings = {
  autoWelcomeSms: false,
  welcomeTemplate: 'سلام {name} عزیز، از تماس‌تان سپاسگزارم. به‌زودی بهترین گزینه‌ها را برایتان می‌فرستم. — مشاور شما',
  followUpHours: 24,
}

type DB = Record<string, CrmSettings>
function fileLoad(): DB { if (existsSync(DATA_FILE)) { try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {} } return {} }
function fileSave(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8') }
async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, {}) : fileLoad() }
async function mutate<R>(fn: (db: DB) => R): Promise<R> { if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, {}, fn); const db = fileLoad(); const r = fn(db); fileSave(db); return r }

export async function getCrmSettings(owner: string): Promise<CrmSettings> {
  return { ...DEFAULTS, ...((await load())[owner] || {}) }
}
export async function setCrmSettings(owner: string, patch: Partial<CrmSettings>): Promise<CrmSettings> {
  return mutate(db => {
    const cur = { ...DEFAULTS, ...(db[owner] || {}) }
    if (patch.autoWelcomeSms !== undefined) cur.autoWelcomeSms = !!patch.autoWelcomeSms
    if (patch.welcomeTemplate !== undefined) cur.welcomeTemplate = String(patch.welcomeTemplate).slice(0, 400)
    if (patch.followUpHours !== undefined) { const n = Number(patch.followUpHours); if (n >= 1 && n <= 720) cur.followUpHours = Math.round(n) }
    db[owner] = cur
    return cur
  })
}
