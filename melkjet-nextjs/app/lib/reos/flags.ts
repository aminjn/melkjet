// REOS v8 · Feature Flags — فعال/غیرفعال‌سازیِ کنترل‌شدهٔ هر لایه (بدونِ دیپلوی).
// هر فلگ: enabled + درصدِ عرضهٔ تدریجی (rollout) + محدودسازی به شهر/پلن/نقش.
// «Dominance فقط تهران»، «Community فقط ۱۰٪ کاربران»، «Wallet فقط Pro» — همه ممکن.
// هستهٔ خالص (evalFlag/bucketOf) تست‌پذیر؛ ذخیره dual-mode. سنجشِ قطعی (کاربرِ ثابت همیشه یک نتیجه).
import { pgEnabled, pgTx } from '../db'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'

export interface Flag { key: string; label: string; enabled: boolean; rolloutPct: number; cities: string[]; plans: string[]; roles: string[]; at: number }
export interface FlagContext { userId?: string; city?: string; plan?: string; role?: string }

// فلگ‌های پیش‌فرضِ لایه‌های REOS (پیش‌فرض: روشن و ۱۰۰٪ تا رفتارِ فعلی حفظ شود؛ ادمین می‌تواند محدود کند).
export const DEFAULT_FLAGS: Record<string, Omit<Flag, 'at'>> = {
  dominance: { key: 'dominance', label: 'اقتدارِ بازار (Market Dominance)', enabled: true, rolloutPct: 100, cities: [], plans: [], roles: [] },
  economy: { key: 'economy', label: 'اقتصادِ پاداش + XP', enabled: true, rolloutPct: 100, cities: [], plans: [], roles: [] },
  community: { key: 'community', label: 'لایهٔ اجتماعی (Community)', enabled: true, rolloutPct: 100, cities: [], plans: [], roles: [] },
  wallet: { key: 'wallet', label: 'کیفِ پول', enabled: true, rolloutPct: 100, cities: [], plans: [], roles: [] },
  automl: { key: 'automl', label: 'ارتقای خودکارِ مدل (AutoML)', enabled: true, rolloutPct: 100, cities: [], plans: [], roles: [] },
}

// سطلِ قطعیِ ۰..۹۹ از کلید+کاربر (هش پایدار — همان کاربر همیشه همان سطل).
export function bucketOf(key: string, userId: string): number {
  const h = createHash('sha1').update(key + '|' + (userId || 'anon')).digest()
  return h.readUInt32BE(0) % 100
}

// ارزیابیِ خالصِ یک فلگ در یک زمینه (تست‌پذیر).
export function evalFlag(flag: Flag, ctx: FlagContext = {}): boolean {
  if (!flag.enabled) return false
  if (flag.cities.length && (!ctx.city || !flag.cities.includes(ctx.city))) return false
  if (flag.plans.length && (!ctx.plan || !flag.plans.includes(ctx.plan))) return false
  if (flag.roles.length && (!ctx.role || !flag.roles.includes(ctx.role))) return false
  if (flag.rolloutPct >= 100) return true
  if (flag.rolloutPct <= 0) return false
  return bucketOf(flag.key, ctx.userId || 'anon') < flag.rolloutPct
}

// ══════════ ذخیره (dual-mode) ══════════
const FILE = join(process.cwd(), '.reos-flags.json')
function fileLoad(): Record<string, Flag> { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return {} }
function fileSave(d: unknown) { try { writeFileSync(FILE, JSON.stringify(d)) } catch {} }
let ready = false
async function ensure() { if (ready) return; await pgTx(c => c.query(`CREATE TABLE IF NOT EXISTS reos_flags (key text PRIMARY KEY, data jsonb NOT NULL, at bigint NOT NULL)`)); ready = true }

function withDefaults(stored: Record<string, Flag>): Flag[] {
  const out: Record<string, Flag> = {}
  for (const k in DEFAULT_FLAGS) out[k] = { ...DEFAULT_FLAGS[k], at: 0 }
  for (const k in stored) out[k] = stored[k]   // ذخیره‌شده روی پیش‌فرض غلبه می‌کند
  return Object.values(out)
}

export async function listFlags(): Promise<Flag[]> {
  let stored: Record<string, Flag> = {}
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT key,data FROM reos_flags`)); for (const x of r.rows) stored[x.key] = x.data as Flag }
  else stored = fileLoad()
  return withDefaults(stored).sort((a, b) => a.key.localeCompare(b.key))
}

export async function getFlag(key: string): Promise<Flag> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT data FROM reos_flags WHERE key=$1`, [key])); if (r.rows[0]) return r.rows[0].data as Flag }
  else { const f = fileLoad()[key]; if (f) return f }
  const d = DEFAULT_FLAGS[key]
  return d ? { ...d, at: 0 } : { key, label: key, enabled: true, rolloutPct: 100, cities: [], plans: [], roles: [], at: 0 }
}

export async function setFlag(key: string, patch: Partial<Flag>): Promise<Flag> {
  const cur = await getFlag(key)
  const next: Flag = { ...cur, ...patch, key, at: Date.now() }
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`INSERT INTO reos_flags(key,data,at) VALUES($1,$2,$3) ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data, at=EXCLUDED.at`, [key, JSON.stringify(next), next.at])) }
  else { const db = fileLoad(); db[key] = next; fileSave(db) }
  return next
}

// سنجشِ زندهٔ یک فلگ در یک زمینه (لود + eval). مسیرهای داغ می‌توانند نتیجه را کش کنند.
export async function flagEnabled(key: string, ctx: FlagContext = {}): Promise<boolean> {
  return evalFlag(await getFlag(key), ctx)
}
