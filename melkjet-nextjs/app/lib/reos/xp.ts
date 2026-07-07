// REOS v6 · XP + Levels + Seasons — پیشرفتِ حرفه‌ای از اقدامِ واقعیِ بازار.
// XP فقط از کارِ واقعی (ثبتِ آگهی، بستنِ معامله، پاسخ به لید، دریافتِ نظر، محتوا، بردِ نبرد) می‌آید.
// سطح‌بندی + لیگِ فصلی (هر فصل ریست، رقابتِ تازه). هستهٔ خالص (levelForXp/xpForAction) تست‌پذیر؛ ذخیره dual-mode.
import { pgEnabled, pgTx } from '../db'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { config } from './reos-config'

export const LIFETIME = '∞'

// XP هر اقدام (از تنظیماتِ سوپرادمین). اقدامِ ناشناخته → ۰ (بدونِ تورمِ امتیاز).
export function xpForAction(action: string, count = 1): number {
  const a = config().xp.actions || {}
  return Math.max(0, Math.round((a[action] || 0) * count))
}

const TITLES = ['تازه‌وارد', 'فعال', 'حرفه‌ای', 'کهنه‌کار', 'خبره', 'استاد', 'افسانه']
// سطح از XPِ تجمعی. منحنیِ نمایی: XPِ لازم برای رسیدن به سطح L = base * (L^exp).
export function levelForXp(xp: number): { level: number; title: string; xpInLevel: number; xpForNext: number; progress: number; total: number } {
  const base = config().xp.levelBase || 100, exp = config().xp.levelExp || 1.6
  const cum = (L: number) => Math.round(base * Math.pow(L, exp))   // XPِ تجمعیِ لازم تا شروعِ سطحِ L
  let level = 1
  while (xp >= cum(level + 1) && level < 999) level++
  const start = cum(level), next = cum(level + 1)
  const xpInLevel = Math.max(0, xp - start), span = Math.max(1, next - start)
  const title = TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 5))]
  return { level, title, xpInLevel, xpForNext: Math.max(0, next - xp), progress: Math.round((xpInLevel / span) * 100) / 100, total: xp }
}

// کلیدِ فصل (سه‌ماهه). ts از بیرون داده می‌شود تا تست‌پذیر و resume-safe باشد.
export function seasonKey(ts: number): string { const d = new Date(ts); return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}` }

// ══════════ ذخیره (dual-mode) ══════════
const FILE = join(process.cwd(), '.reos-xp.json')
interface XpRow { agentId: string; season: string; xp: number; at: number }
function fileLoad(): Record<string, XpRow> { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return {} }
function fileSave(d: unknown) { try { writeFileSync(FILE, JSON.stringify(d)) } catch {} }
const key = (a: string, s: string) => a + '|' + s
let ready = false
async function ensure() { if (ready) return; await pgTx(async c => { await c.query(`CREATE TABLE IF NOT EXISTS reos_xp (agent_id text NOT NULL, season text NOT NULL, xp bigint NOT NULL DEFAULT 0, at bigint NOT NULL, PRIMARY KEY (agent_id, season))`); await c.query(`CREATE INDEX IF NOT EXISTS reos_xp_season ON reos_xp(season, xp DESC)`) }); ready = true }

// اعطای XP برای یک اقدامِ واقعی → هم به مجموعِ کل، هم به فصلِ جاری اضافه می‌شود.
export async function awardXp(agentId: string, action: string, count = 1, now = Date.now()): Promise<{ awarded: number; lifetime: number; season: number }> {
  const amt = xpForAction(action, count)
  if (!agentId || amt <= 0) return { awarded: 0, lifetime: await lifetimeXp(agentId), season: 0 }
  const s = seasonKey(now)
  if (pgEnabled()) {
    await ensure()
    const [life, seas] = await pgTx(async c => {
      const a = await c.query(`INSERT INTO reos_xp(agent_id,season,xp,at) VALUES($1,$2,$3,$4) ON CONFLICT(agent_id,season) DO UPDATE SET xp=reos_xp.xp+$3, at=$4 RETURNING xp`, [agentId, LIFETIME, amt, now])
      const b = await c.query(`INSERT INTO reos_xp(agent_id,season,xp,at) VALUES($1,$2,$3,$4) ON CONFLICT(agent_id,season) DO UPDATE SET xp=reos_xp.xp+$3, at=$4 RETURNING xp`, [agentId, s, amt, now])
      return [Number(a.rows[0].xp), Number(b.rows[0].xp)]
    })
    return { awarded: amt, lifetime: life, season: seas }
  }
  const db = fileLoad()
  const lk = key(agentId, LIFETIME), sk = key(agentId, s)
  db[lk] = { agentId, season: LIFETIME, xp: (db[lk]?.xp || 0) + amt, at: now }
  db[sk] = { agentId, season: s, xp: (db[sk]?.xp || 0) + amt, at: now }
  fileSave(db)
  return { awarded: amt, lifetime: db[lk].xp, season: db[sk].xp }
}

// اعطای XPِ خام (برای پاداشِ مأموریت/فصل که «اقدام» نیست) → مجموعِ کل + فصلِ جاری.
export async function grantXp(agentId: string, amount: number, now = Date.now()): Promise<void> {
  if (!agentId || amount <= 0) return
  const s = seasonKey(now)
  if (pgEnabled()) {
    await ensure()
    await pgTx(async c => {
      await c.query(`INSERT INTO reos_xp(agent_id,season,xp,at) VALUES($1,$2,$3,$4) ON CONFLICT(agent_id,season) DO UPDATE SET xp=reos_xp.xp+$3, at=$4`, [agentId, LIFETIME, amount, now])
      await c.query(`INSERT INTO reos_xp(agent_id,season,xp,at) VALUES($1,$2,$3,$4) ON CONFLICT(agent_id,season) DO UPDATE SET xp=reos_xp.xp+$3, at=$4`, [agentId, s, amount, now])
    })
    return
  }
  const db = fileLoad()
  const lk = key(agentId, LIFETIME), sk = key(agentId, s)
  db[lk] = { agentId, season: LIFETIME, xp: (db[lk]?.xp || 0) + amount, at: now }
  db[sk] = { agentId, season: s, xp: (db[sk]?.xp || 0) + amount, at: now }
  fileSave(db)
}

export async function lifetimeXp(agentId: string): Promise<number> {
  if (!agentId) return 0
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT xp FROM reos_xp WHERE agent_id=$1 AND season=$2`, [agentId, LIFETIME])); return Number(r.rows[0]?.xp || 0) }
  return fileLoad()[key(agentId, LIFETIME)]?.xp || 0
}

export async function xpStatus(agentId: string, now = Date.now()): Promise<{ lifetime: ReturnType<typeof levelForXp>; seasonXp: number; season: string; rank: number }> {
  const s = seasonKey(now)
  const [life, seasonXp, rank] = await Promise.all([lifetimeXp(agentId), seasonXpOf(agentId, s), seasonRank(agentId, s)])
  return { lifetime: levelForXp(life), seasonXp, season: s, rank }
}

async function seasonXpOf(agentId: string, season: string): Promise<number> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT xp FROM reos_xp WHERE agent_id=$1 AND season=$2`, [agentId, season])); return Number(r.rows[0]?.xp || 0) }
  return fileLoad()[key(agentId, season)]?.xp || 0
}
async function seasonRank(agentId: string, season: string): Promise<number> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT count(*)::int AS n FROM reos_xp a WHERE a.season=$1 AND a.xp > (SELECT xp FROM reos_xp WHERE agent_id=$2 AND season=$1)`, [season, agentId])); return (r.rows[0]?.n || 0) + 1 }
  const rows = Object.values(fileLoad()).filter(r => r.season === season).sort((a, b) => b.xp - a.xp)
  const idx = rows.findIndex(r => r.agentId === agentId); return idx < 0 ? rows.length + 1 : idx + 1
}

// لیگِ فصلی (جدولِ رتبه). season پیش‌فرض = فصلِ جاری.
export async function seasonLeaderboard(season: string, limit = 20): Promise<Array<{ agentId: string; xp: number; rank: number; level: number }>> {
  let rows: XpRow[]
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT agent_id, xp FROM reos_xp WHERE season=$1 ORDER BY xp DESC LIMIT $2`, [season, limit])); rows = r.rows.map(x => ({ agentId: x.agent_id, season, xp: Number(x.xp), at: 0 })) }
  else rows = Object.values(fileLoad()).filter(r => r.season === season).sort((a, b) => b.xp - a.xp).slice(0, limit)
  return rows.map((r, i) => ({ agentId: r.agentId, xp: r.xp, rank: i + 1, level: levelForXp(r.xp).level }))
}
