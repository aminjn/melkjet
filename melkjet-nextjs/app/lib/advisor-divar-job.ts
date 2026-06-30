import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// وضعیتِ کارِ همگام‌سازیِ دیوار (پس‌زمینه) — تا UI پیشرفت را بپاید و با ترکِ صفحه متوقف نشود.
const FILE = join(process.cwd(), '.advisor-divar-jobs.json')

export interface DivarJob {
  running: boolean; total: number; done: number
  imported: number; updated: number; skipped: number; failed: number; sold: number
  label?: string; error?: string; startedAt?: number; finishedAt?: number
}
const EMPTY: DivarJob = { running: false, total: 0, done: 0, imported: 0, updated: 0, skipped: 0, failed: 0, sold: 0 }

type DB = Record<string, DivarJob>
function load(): DB { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return {} }
function save(db: DB) { try { writeFileSync(FILE, JSON.stringify(db), 'utf-8') } catch {} }

export function getJob(o: string): DivarJob { return { ...EMPTY, ...(load()[o] || {}) } }
export function setJob(o: string, patch: Partial<DivarJob>): DivarJob {
  const db = load(); const cur = { ...EMPTY, ...(db[o] || {}) }; const next = { ...cur, ...patch }; db[o] = next; save(db); return next
}
// اگر کاری بیش از ۱۵ دقیقه «در حال اجرا» مانده، احتمالاً ورکر ری‌استارت شده — آزادش کن.
export function isStale(j: DivarJob): boolean { return j.running && !!j.startedAt && Date.now() - j.startedAt > 15 * 60 * 1000 }
