import { pgEnabled, kvGet, kvMutate } from './db'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// ضربانِ کرون: هر تیکِ queueTick (اینستنسِ ۰) این را می‌زند. یک اسکریپتِ بیرونی می‌تواند بخواند و
// ثابت کند کرون واقعاً زنده است و کِی آخرین بار اسکرپِ رُسترِ سررسیده را دید/اجرا کرد.
export interface CronBeat {
  at?: number             // آخرین تیکِ queueTick
  ticks?: number          // شمارندهٔ تیک
  instance?: string       // NODE_APP_INSTANCE (باید ۰ باشد)
  lastRosterDueAt?: number  // آخرین باری که «اسکرپِ سررسیده» دیده شد
  lastRosterSyncAt?: number // آخرین باری که syncRoster از کرون شروع شد
  lastRosterSyncSlug?: string
  enrichPending?: number   // فاز ۱۹۱ — چند آگهیِ عمومی هنوز تحلیلِ هوشمند ندارند (جارو در حالِ پرکردن)
}
const KV = 'cron_heartbeat'
const FILE = join(process.cwd(), '.cron-heartbeat.json')
const empty = (): CronBeat => ({})
function fileLoad(): CronBeat { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return empty() }

export async function touchCron(patch: Partial<CronBeat> = {}): Promise<void> {
  const apply = (b: CronBeat) => { b.at = Date.now(); b.ticks = (b.ticks || 0) + 1; Object.assign(b, patch) }
  if (pgEnabled()) { await kvMutate<CronBeat, void>(KV, empty(), apply); return }
  const b = fileLoad(); apply(b); try { writeFileSync(FILE, JSON.stringify(b), 'utf-8') } catch {}
}
export async function getCronBeat(): Promise<CronBeat> {
  return pgEnabled() ? await kvGet<CronBeat>(KV, empty()) : fileLoad()
}
