import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// وضعیتِ کارِ همگام‌سازیِ دیوار (پس‌زمینه) — تا UI پیشرفت را بپاید و با ترکِ صفحه متوقف نشود.
const FILE = join(process.cwd(), '.advisor-divar-jobs.json')

export interface DivarJob {
  running: boolean; paused?: boolean; total: number; done: number
  imported: number; updated: number; skipped: number; failed: number; sold: number
  label?: string; error?: string; note?: string; startedAt?: number; finishedAt?: number; lastProgressAt?: number
  pausedAt?: number   // فاز ۱۳۴: زمانِ هولد — برای کول‌داون تا هولدهای پرتکرار صف را قفل نکنند
  // وضعیتِ ازسرگیری (resume): آگهی‌های باقی‌مانده + دادهٔ لازم برای ادامه/پایان.
  pending?: any[]; gone?: any[]; liveTokens?: string[]; sourceId?: string   // liveTokens: توکن‌های زندهٔ این اجرا — ضدِ مهرِ اشتباهِ «فروخته» روی بازنشرها
  // صف: کاربر فقط «در صف» می‌گذارد؛ کارگرِ اینستنسِ ۰ آن را برمی‌دارد و اجرا می‌کند.
  queued?: boolean; cfg?: any; queuedAt?: number
  // فاز ۱۳۱ — ژورنالِ زندهٔ مراحل (برای پنلِ «لایو» مشاور): هر مرحله/خطا با ساعت ثبت می‌شود.
  log?: string[]
}
const EMPTY: DivarJob = { running: false, total: 0, done: 0, imported: 0, updated: 0, skipped: 0, failed: 0, sold: 0 }

type DB = Record<string, DivarJob>
function load(): DB { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return {} }
function save(db: DB) { try { writeFileSync(FILE, JSON.stringify(db), 'utf-8') } catch {} }

// فهرستِ کارهای «هولدشده» که آگهیِ باقی‌مانده دارند — برای ادامهٔ خودکار توسطِ کرون.
// فاز ۱۳۴: کول‌داونِ ۶۰ثانیه‌ای — هولدی که همین الان هولد شده، تیکِ بعدی دوباره اسلات نگیرد.
export function listPausedJobs(): string[] {
  const db = load()
  return Object.keys(db).filter(p => {
    const j = db[p]
    if (!(j && j.paused && !j.running && Array.isArray(j.pending) && j.pending.length)) return false
    return Date.now() - (j.pausedAt || 0) >= 60_000
  })
}

// فاز ۱۳۴ — ترتیبِ منصفانهٔ صف (FIFO سراسری): هولدشده‌ها و در-صف‌ها با هم بر اساسِ زمان،
// نه «همیشه اول هولدها» — وگرنه چند هولدِ پرتکرار، کارِ تازهٔ کاربر را برای همیشه گرسنه می‌گذاشت.
export function queueOrder(): string[] {
  const db = load()
  const rows: { phone: string; at: number }[] = []
  for (const phone of Object.keys(db)) {
    const j = db[phone]
    if (!j || j.running) continue
    if (j.queued) rows.push({ phone, at: j.queuedAt || 0 })
    else if (j.paused && Array.isArray(j.pending) && j.pending.length && Date.now() - (j.pausedAt || 0) >= 60_000)
      rows.push({ phone, at: j.startedAt || j.queuedAt || 0 })
  }
  return rows.sort((a, b) => a.at - b.at).map(r => r.phone)
}

// فهرستِ کارهای «در صف» (FIFO) — کاربر ثبت کرده ولی هنوز کارگر برنداشته.
export function listQueuedJobs(): string[] {
  const db = load()
  return Object.keys(db)
    .filter(p => { const j = db[p]; return !!(j && j.queued && !j.running) })
    .sort((a, b) => (db[a].queuedAt || 0) - (db[b].queuedAt || 0))
}

// تعدادِ کارهایِ واقعاً در حالِ اجرا (نه کهنه) — برای سقفِ همزمانیِ سراسری.
export function countActiveJobs(): number {
  const db = load()
  return Object.values(db).filter(j => j.running && !isStale(j)).length
}

export function getJob(o: string): DivarJob { return { ...EMPTY, ...(load()[o] || {}) } }

// فاز ۱۳۱ — یک خطِ ژورنال با ساعتِ محلیِ سرور؛ سقفِ ۴۰ خط تا فایل سبک بماند.
export function appendJobLog(o: string, line: string): void {
  const db = load(); const cur = { ...EMPTY, ...(db[o] || {}) }
  const t = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  cur.log = [...(cur.log || []), `${t} — ${line}`].slice(-40)
  db[o] = cur; save(db)
}

// فاز ۱۳۱ — ضربانِ کارگرِ صف (اینستنسِ ۰): هر تیکِ queueTick این را می‌زند؛
// پنلِ تشخیص از رویش می‌فهمد کارگر زنده است یا نه (ریشهٔ رایجِ «هیچ اتفاقی نمی‌افتد»).
const HEARTBEAT_FILE = join(process.cwd(), '.cron-heartbeat.json')
export function touchQueueHeartbeat(): void {
  try { writeFileSync(HEARTBEAT_FILE, JSON.stringify({ queueTickAt: Date.now(), instance: process.env.NODE_APP_INSTANCE ?? '' }), 'utf-8') } catch {}
}
export function queueHeartbeat(): { at: number; instance: string } | null {
  try { if (existsSync(HEARTBEAT_FILE)) { const d = JSON.parse(readFileSync(HEARTBEAT_FILE, 'utf-8')); return { at: Number(d.queueTickAt) || 0, instance: String(d.instance ?? '') } } } catch {}
  return null
}
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
  // pending/paused را هم پاک کن تا کرون این کارِ متوقف‌شده را دوباره ادامه ندهد.
  return setJob(o, { running: false, paused: false, pending: [], finishedAt: Date.now(), error: 'به‌صورتِ دستی متوقف شد.', note: '' })
}
// نسخهٔ نرمال‌شده برای نمایش/تصمیم: کارِ کهنه را «متوقف» اعلام می‌کند.
export function getJobNormalized(o: string): DivarJob {
  const j = getJob(o)
  if (isStale(j)) {
    // ورکر ری‌استارت شد یا هنگ کرد؛ اگر آگهیِ باقی‌مانده هست، «هولد» کن تا کرون ادامه دهد (نه fail).
    if (Array.isArray(j.pending) && j.pending.length) {
      return setJob(o, { running: false, paused: true, pausedAt: Date.now(), note: 'ادامه پس از وقفه…' })
    }
    return setJob(o, { running: false, error: j.error || 'همگام‌سازی متوقف شد — دوباره شروع کنید.' })
  }
  return j
}
