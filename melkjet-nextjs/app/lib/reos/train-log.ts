// 🏋️ فاز ۱۸۹ — دفترِ ترینِ ML (فیدبک: «باید خودش رو هی ترین کنه که نمی‌شه و معلوم نیست کار می‌کنه یا نه»):
// هر اجرای آموزش (خودکارِ کرون یا دستیِ ادمین) با نتیجهٔ واقعی (n/auc/زمان) ثبت می‌شود و
// lastAt «پایدار» است (نه متغیرِ ماژول که با هر ری‌استارت صفر می‌شد) — گزارشِ ادمین از همین می‌خواند.
import { pgEnabled, pgTx } from '../db'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

export interface TrainRun { at: number; kind: string; ok: boolean; ms: number; n?: number; auc?: number; note?: string }
interface TrainLog { lastAt: number; runs: TrainRun[] }
const EMPTY: TrainLog = { lastAt: 0, runs: [] }
const FILE = join(process.cwd(), '.reos-train-log.json')
const CAP = 60

// خالص و تست‌پذیر: افزودنِ اجرا با سقفِ نگه‌داری (جدیدترین اول)
export function appendRun(log: TrainLog, run: TrainRun): TrainLog {
  return { lastAt: Math.max(log.lastAt || 0, run.at), runs: [run, ...(log.runs || [])].slice(0, CAP) }
}

async function loadLog(): Promise<TrainLog> {
  if (pgEnabled()) {
    try {
      await pgTx(c => c.query(`CREATE TABLE IF NOT EXISTS reos_train_log (id text PRIMARY KEY, data jsonb NOT NULL)`))
      const r = await pgTx(c => c.query(`SELECT data FROM reos_train_log WHERE id='main'`))
      return (r.rows[0]?.data as TrainLog) || EMPTY
    } catch { return EMPTY }
  }
  if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} }
  return EMPTY
}
async function saveLog(log: TrainLog): Promise<void> {
  if (pgEnabled()) {
    try {
      await pgTx(c => c.query(`CREATE TABLE IF NOT EXISTS reos_train_log (id text PRIMARY KEY, data jsonb NOT NULL)`))
      await pgTx(c => c.query(`INSERT INTO reos_train_log(id,data) VALUES('main',$1) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data`, [JSON.stringify(log)]))
    } catch {}
    return
  }
  try { writeFileSync(FILE, JSON.stringify(log)) } catch {}
}

export async function logTrainRun(run: TrainRun): Promise<void> {
  const log = await loadLog()
  await saveLog(appendRun(log, run))
}
export async function trainLog(): Promise<TrainLog> { return loadLog() }
export async function lastTrainAt(): Promise<number> { return (await loadLog()).lastAt || 0 }
