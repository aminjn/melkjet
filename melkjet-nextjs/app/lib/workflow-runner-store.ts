import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// وضعیتِ اجرایِ هر گردش‌کار (جدا از تعریفِ آن): آخرین اجرا + شناسهٔ رویدادهای پردازش‌شده.
const FILE = join(process.cwd(), '.workflow-runner-data.json')

interface WfState { lastRun: number; done: string[] }
interface DB { [workflowId: string]: WfState }

function load(): DB { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return {} }
function save(db: DB) { writeFileSync(FILE, JSON.stringify(db)) }

export function getWfState(id: string): WfState { return load()[id] || { lastRun: 0, done: [] } }
export function setWfState(id: string, st: WfState) {
  const db = load()
  db[id] = { lastRun: st.lastRun, done: (st.done || []).slice(-1000) }   // سقفِ تاریخچه
  save(db)
}
// با فعال‌سازیِ مجدد، وضعیت ریست می‌شود تا رویدادهای قدیمی دوباره شلیک نشوند.
export function resetWfState(id: string, now: number) { setWfState(id, { lastRun: now, done: [] }) }
