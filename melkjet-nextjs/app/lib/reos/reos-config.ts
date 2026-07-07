// REOS · Config Center — تنظیماتِ قابل‌ویرایشِ سوپرادمین برای همهٔ موتورها.
// پیش‌فرض‌ها = ثابت‌های فعلیِ کد؛ سوپرادمین می‌تواند override کند. کشِ همگام تا مسیرهای داغ بخوانند.
import { pgEnabled, pgTx } from '../db'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

export interface ReosConfig {
  gateway: { cacheTtlMin: number; rates: Record<string, number> }
  rl: { lr: number; epsilon: number; rewards: { click: number; save: number; contact: number; visit: number; contract: number } }
  promotion: { boost: number; featured: number; vip: number; trustGate: boolean }
  trust: { weights: { verified: number; profile: number; response: number; deals: number; rating: number; tenure: number } }
  training: { autoHours: number; enabled: boolean }
  feed: { rankWeights: { userMatch: number; quality: number; engagement: number; freshness: number; demand: number; promotion: number } }
}

export const DEFAULT_CONFIG: ReosConfig = {
  gateway: { cacheTtlMin: 10, rates: { 'gpt-4o': 3000, 'gpt-4o-mini': 300, default: 800 } },
  rl: { lr: 0.05, epsilon: 0.1, rewards: { click: 1, save: 5, contact: 20, visit: 40, contract: 100 } },
  promotion: { boost: 0.5, featured: 0.75, vip: 1, trustGate: true },
  trust: { weights: { verified: 0.28, profile: 0.16, response: 0.16, deals: 0.16, rating: 0.16, tenure: 0.08 } },
  training: { autoHours: 6, enabled: true },
  feed: { rankWeights: { userMatch: 0.35, quality: 0.20, engagement: 0.15, freshness: 0.10, demand: 0.10, promotion: 0.10 } },
}

const FILE = join(process.cwd(), '.reos-config-settings.json')
let ready = false
async function ensure() { if (ready) return; await pgTx(c => c.query(`CREATE TABLE IF NOT EXISTS reos_config (id text PRIMARY KEY, data jsonb NOT NULL, at bigint NOT NULL)`)); ready = true }

// ادغامِ عمیقِ ساده (یک سطح تودرتو).
function merge(base: ReosConfig, over: Record<string, unknown>): ReosConfig {
  const out = JSON.parse(JSON.stringify(base)) as Record<string, Record<string, unknown>>
  for (const k in over) {
    const v = over[k]
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k]) {
      for (const kk in v as Record<string, unknown>) {
        const vv = (v as Record<string, unknown>)[kk]
        if (vv && typeof vv === 'object' && !Array.isArray(vv) && out[k][kk]) Object.assign(out[k][kk] as object, vv)
        else (out[k] as Record<string, unknown>)[kk] = vv
      }
    } else out[k] = v as Record<string, unknown>
  }
  return out as unknown as ReosConfig
}

async function loadStored(): Promise<Record<string, unknown>> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT data FROM reos_config WHERE id='main'`)); return (r.rows[0]?.data as Record<string, unknown>) || {} }
  if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} }
  return {}
}

// ── کشِ همگام (مسیرهای داغ) ──
let CFG: ReosConfig = DEFAULT_CONFIG
let primedAt = 0
export function config(): ReosConfig { return CFG }              // همگام
export async function primeConfig(): Promise<ReosConfig> {
  if (Date.now() - primedAt < 60_000) return CFG
  try { CFG = merge(DEFAULT_CONFIG, await loadStored()); primedAt = Date.now() } catch { CFG = DEFAULT_CONFIG }
  return CFG
}
export async function getConfig(): Promise<ReosConfig> { return merge(DEFAULT_CONFIG, await loadStored()) }
export async function setConfig(patch: Record<string, unknown>): Promise<ReosConfig> {
  const stored = await loadStored()
  const next = merge(merge(DEFAULT_CONFIG, stored), patch)
  // فقط delta نسبت به پیش‌فرض را ذخیره نمی‌کنیم؛ کلِ merged را ذخیره می‌کنیم (ساده و قابلِ‌بازگردانی).
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`INSERT INTO reos_config(id,data,at) VALUES('main',$1,$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data, at=EXCLUDED.at`, [JSON.stringify(next), Date.now()])) }
  else { try { writeFileSync(FILE, JSON.stringify(next)) } catch {} }
  CFG = next; primedAt = Date.now()
  return next
}
export async function resetConfig(): Promise<ReosConfig> {
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`DELETE FROM reos_config WHERE id='main'`)) }
  else { try { if (existsSync(FILE)) writeFileSync(FILE, '{}') } catch {} }
  CFG = DEFAULT_CONFIG; primedAt = Date.now()
  return DEFAULT_CONFIG
}
