import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// وضعیتِ کارِ همگام‌سازیِ دیوار (پس‌زمینه) — تا UI پیشرفت را بپاید و با ترکِ صفحه متوقف نشود.
const FILE = join(process.cwd(), '.advisor-divar-jobs.json')

export interface DivarJob {
  running: boolean; total: number; done: number
  imported: number; updated: number; skipped: number; failed: number; sold: number
  label?: string; error?: string; startedAt?: number; finishedAt?: number; lastProgressAt?: number
}
const EMPTY: DivarJob = { running: false, total: 0, done: 0, imported: 0, updated: 0, skipped: 0, failed: 0, sold: 0 }

type DB = Record<string, DivarJob>
function load(): DB { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return {} }
function save(db: DB) { try { writeFileSync(FILE, JSON.stringify(db), 'utf-8') } catch {} }

export function getJob(o: string): DivarJob { return { ...EMPTY, ...(load()[o] || {}) } }
export function setJob(o: string, patch: Partial<DivarJob>): DivarJob {
  const db = load(); const cur = { ...EMPTY, ...(db[o] || {}) }; const next = { ...cur, ...patch }; db[o] = next; save(db); return next
}
// اگر بیش از ۳ دقیقه هیچ پیشرفتی نشده، کار هنگ کرده یا ورکر ری‌استارت شده — کهنه حساب می‌شود.
export function isStale(j: DivarJob): boolean {
  if (!j.running) return false
  const last = j.lastProgressAt || j.startedAt || 0
  if (!last) return true   // «در حال اجرا» ولی بدونِ هیچ زمان = حتماً کهنه
  return Date.now() - last > 3 * 60 * 1000
}
// توقفِ دستیِ کار (دکمهٔ «توقف» یا شروعِ مجدد).
export function stopJob(o: string): DivarJob {
  return setJob(o, { running: false, finishedAt: Date.now(), error: 'به‌صورتِ دستی متوقف شد.' })
}
// نسخهٔ نرمال‌شده برای نمایش/تصمیم: کارِ کهنه را «متوقف» اعلام می‌کند.
export function getJobNormalized(o: string): DivarJob {
  const j = getJob(o)
  if (isStale(j)) { return setJob(o, { running: false, error: j.error || 'همگام‌سازی متوقف شد (هنگِ پروکسی یا ری‌استارتِ سرور) — دوباره شروع کنید.' }) }
  return j
}
