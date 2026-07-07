// REOS v6 · Missions / Challenges — مأموریت‌های روزانه/هفتگی از اقدامِ واقعیِ کاری.
// پیشرفت فقط با کارِ واقعی بالا می‌رود؛ با تکمیل، پاداشِ XP + اعتبارِ کیف پول قابلِ دریافت است.
// هستهٔ خالص (missionState/periodKey) تست‌پذیر؛ ذخیرهٔ پیشرفت dual-mode، کلیدخوردهٔ دوره (روز/هفته).
import { pgEnabled, pgTx } from '../db'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { config } from './reos-config'
import { grantXp } from './xp'
import { creditBucket } from './wallet'

export type Cadence = 'daily' | 'weekly'
export interface Mission { key: string; title: string; action: string; target: number; cadence: Cadence; rewardXp: number; rewardCredit: number }

// کاتالوگِ مأموریت (پاداشِ پایه از تنظیماتِ سوپرادمین؛ سختی ضرب می‌شود).
export function missionCatalog(): Mission[] {
  const rx = config().economy.missionRewardXp, rc = config().economy.missionRewardCredit
  return [
    { key: 'daily_respond', title: 'پاسخ به ۳ لید', action: 'respond_lead', target: 3, cadence: 'daily', rewardXp: rx, rewardCredit: rc },
    { key: 'daily_list', title: 'ثبتِ ۱ آگهیِ باکیفیت', action: 'list_property', target: 1, cadence: 'daily', rewardXp: rx, rewardCredit: rc },
    { key: 'weekly_deal', title: 'بستنِ ۱ معامله', action: 'close_deal', target: 1, cadence: 'weekly', rewardXp: rx * 4, rewardCredit: rc * 4 },
    { key: 'weekly_content', title: 'انتشارِ ۲ محتوا', action: 'publish_content', target: 2, cadence: 'weekly', rewardXp: rx * 2, rewardCredit: rc * 2 },
    { key: 'weekly_reviews', title: 'دریافتِ ۳ نظرِ مشتری', action: 'get_review', target: 3, cadence: 'weekly', rewardXp: rx * 2, rewardCredit: rc * 2 },
  ]
}

export function dayNumber(ts: number): number { return Math.floor(ts / 864e5) }
export function weekNumber(ts: number): number { return Math.floor(ts / (7 * 864e5)) }
// کلیدِ دورهٔ یک مأموریت (روزانه = شمارهٔ روز، هفتگی = شمارهٔ هفته).
export function periodKey(cadence: Cadence, ts: number): string { return cadence === 'daily' ? 'd' + dayNumber(ts) : 'w' + weekNumber(ts) }

// وضعیتِ خالصِ یک مأموریت از پیشرفت (تست‌پذیر).
export function missionState(m: Mission, progress: number, claimed: boolean): { complete: boolean; claimable: boolean; pct: number } {
  const complete = progress >= m.target
  return { complete, claimable: complete && !claimed, pct: Math.min(1, Math.round((progress / m.target) * 100) / 100) }
}

// ══════════ ذخیرهٔ پیشرفت (dual-mode) ══════════
const FILE = join(process.cwd(), '.reos-missions.json')
interface MRow { agentId: string; missionKey: string; period: string; progress: number; claimed: boolean; at: number }
function fileLoad(): Record<string, MRow> { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return {} }
function fileSave(d: unknown) { try { writeFileSync(FILE, JSON.stringify(d)) } catch {} }
const rk = (a: string, m: string, p: string) => [a, m, p].join('|')
let ready = false
async function ensure() { if (ready) return; await pgTx(c => c.query(`CREATE TABLE IF NOT EXISTS reos_missions (agent_id text NOT NULL, mission_key text NOT NULL, period text NOT NULL, progress integer NOT NULL DEFAULT 0, claimed boolean NOT NULL DEFAULT false, at bigint NOT NULL, PRIMARY KEY (agent_id, mission_key, period))`)); ready = true }

async function getRow(agentId: string, m: Mission, now: number): Promise<MRow> {
  const period = periodKey(m.cadence, now)
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT * FROM reos_missions WHERE agent_id=$1 AND mission_key=$2 AND period=$3`, [agentId, m.key, period])); const x = r.rows[0]; return x ? { agentId, missionKey: m.key, period, progress: x.progress, claimed: x.claimed, at: Number(x.at) } : { agentId, missionKey: m.key, period, progress: 0, claimed: false, at: 0 } }
  return fileLoad()[rk(agentId, m.key, period)] || { agentId, missionKey: m.key, period, progress: 0, claimed: false, at: 0 }
}
async function putRow(row: MRow): Promise<void> {
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`INSERT INTO reos_missions(agent_id,mission_key,period,progress,claimed,at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(agent_id,mission_key,period) DO UPDATE SET progress=EXCLUDED.progress, claimed=EXCLUDED.claimed, at=EXCLUDED.at`, [row.agentId, row.missionKey, row.period, row.progress, row.claimed, row.at])) }
  else { const db = fileLoad(); db[rk(row.agentId, row.missionKey, row.period)] = row; fileSave(db) }
}

// افزایشِ پیشرفتِ همهٔ مأموریت‌هایِ متناظر با یک اقدامِ واقعی.
export async function bumpMissions(agentId: string, action: string, n = 1, now = Date.now()): Promise<void> {
  if (!agentId) return
  for (const m of missionCatalog()) {
    if (m.action !== action) continue
    const row = await getRow(agentId, m, now)
    await putRow({ ...row, progress: Math.min(m.target, row.progress + n), at: now })
  }
}

// فهرستِ مأموریت‌های کاربر با وضعیت (برای UI).
export async function listMissions(agentId: string, now = Date.now()): Promise<Array<Mission & { progress: number; claimed: boolean; complete: boolean; claimable: boolean; pct: number }>> {
  const out = []
  for (const m of missionCatalog()) {
    const row = await getRow(agentId, m, now)
    const st = missionState(m, row.progress, row.claimed)
    out.push({ ...m, progress: row.progress, claimed: row.claimed, ...st })
  }
  return out
}

// دریافتِ پاداشِ یک مأموریتِ کامل‌شده (اتمیک: فقط یک‌بار). پاداش → XP + اعتبارِ کیف پول.
export async function claimMission(agentId: string, missionKey: string, now = Date.now()): Promise<{ ok: boolean; reason?: string; rewardXp?: number; rewardCredit?: number }> {
  const m = missionCatalog().find(x => x.key === missionKey)
  if (!m) return { ok: false, reason: 'مأموریت یافت نشد' }
  const row = await getRow(agentId, m, now)
  const st = missionState(m, row.progress, row.claimed)
  if (!st.complete) return { ok: false, reason: 'هنوز کامل نشده' }
  if (row.claimed) return { ok: false, reason: 'قبلاً دریافت شده' }
  await putRow({ ...row, claimed: true, at: now })   // علامتِ claimed قبل از پاداش (idempotent)
  await grantXp(agentId, m.rewardXp, now).catch(() => {})
  await creditBucket(agentId, 'reward', m.rewardCredit, `پاداشِ مأموریت: ${m.title}`).catch(() => {})
  return { ok: true, rewardXp: m.rewardXp, rewardCredit: m.rewardCredit }
}
