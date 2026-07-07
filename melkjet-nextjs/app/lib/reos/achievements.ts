// REOS · Market Dominance — نشان‌های دستاورد + زنجیرهٔ فعالیت (Streak) + هشدارِ ترسِ‌از‌دست‌دادن (FOMO).
// دستاوردها فقط از اقدامِ واقعیِ کسب‌وکار باز می‌شوند (نه از بازی‌گونگیِ توخالی). Streak = روزهای فعالیتِ پیاپی.
// هستهٔ خالص (checkAchievements/streakStatus/fomoAlerts) تست‌پذیر؛ ذخیرهٔ streak dual-mode.
import { pgEnabled, pgTx } from '../db'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// ── دستاوردها (نشان‌های اعتبار) ──
export interface AgentStats {
  transactions?: number     // معاملاتِ بسته‌شده
  ownedTerritories?: number // قلمروهایِ تحتِ مالکیت
  activeDays?: number       // روزهای فعالیتِ پیاپی
  avgRating?: number        // میانگینِ امتیازِ رضایت (۰..۵)
  leadsConverted?: number   // لیدهایِ تبدیل‌شده
  contentPieces?: number    // محتوای منتشرشده
  battlesWon?: number       // نبردهایِ بردهٔ قلمرو
  responseRate?: number     // نرخِ پاسخ (۰..۱)
}
export interface Badge { key: string; name: string; desc: string; tier: 'برنز' | 'نقره' | 'طلا' | 'الماس' }

const CATALOG: Array<Badge & { met: (s: AgentStats) => boolean }> = [
  { key: 'first_deal', name: 'اولین معامله', desc: 'نخستین معاملهٔ ثبت‌شده', tier: 'برنز', met: s => (s.transactions || 0) >= 1 },
  { key: 'deal_10', name: 'معامله‌گر', desc: '۱۰ معاملهٔ موفق', tier: 'نقره', met: s => (s.transactions || 0) >= 10 },
  { key: 'deal_50', name: 'استادِ معامله', desc: '۵۰ معاملهٔ موفق', tier: 'طلا', met: s => (s.transactions || 0) >= 50 },
  { key: 'deal_200', name: 'افسانهٔ بازار', desc: '۲۰۰ معاملهٔ موفق', tier: 'الماس', met: s => (s.transactions || 0) >= 200 },
  { key: 'territory_1', name: 'مالکِ قلمرو', desc: 'مالکیتِ یک قلمرو', tier: 'نقره', met: s => (s.ownedTerritories || 0) >= 1 },
  { key: 'territory_5', name: 'فرمانروا', desc: 'مالکیتِ ۵ قلمرو', tier: 'طلا', met: s => (s.ownedTerritories || 0) >= 5 },
  { key: 'streak_7', name: 'هفتهٔ پیوسته', desc: '۷ روز فعالیتِ پیاپی', tier: 'برنز', met: s => (s.activeDays || 0) >= 7 },
  { key: 'streak_30', name: 'ماهِ آهنین', desc: '۳۰ روز فعالیتِ پیاپی', tier: 'طلا', met: s => (s.activeDays || 0) >= 30 },
  { key: 'rating_star', name: 'محبوبِ مشتری', desc: 'میانگینِ امتیازِ ۴.۵ به‌بالا', tier: 'طلا', met: s => (s.avgRating || 0) >= 4.5 },
  { key: 'converter', name: 'قهرمانِ تبدیل', desc: '۲۵ لیدِ تبدیل‌شده', tier: 'نقره', met: s => (s.leadsConverted || 0) >= 25 },
  { key: 'creator', name: 'تولیدکنندهٔ محتوا', desc: '۱۰ محتوای منتشرشده', tier: 'برنز', met: s => (s.contentPieces || 0) >= 10 },
  { key: 'warrior', name: 'جنگجویِ قلمرو', desc: '۵ نبردِ بردهٔ قلمرو', tier: 'طلا', met: s => (s.battlesWon || 0) >= 5 },
  { key: 'responsive', name: 'همیشه پاسخگو', desc: 'نرخِ پاسخِ ۹۰٪ به‌بالا', tier: 'نقره', met: s => (s.responseRate || 0) >= 0.9 },
]

export function checkAchievements(s: AgentStats): Badge[] {
  return CATALOG.filter(b => b.met(s)).map(({ met, ...b }) => b)
}
export function nextAchievements(s: AgentStats, limit = 3): Array<Badge & { hint: string }> {
  const unmet = CATALOG.filter(b => !b.met(s))
  return unmet.slice(0, limit).map(({ met, ...b }) => ({ ...b, hint: b.desc }))
}

// ── زنجیرهٔ فعالیت (Streak) ──
// فعالیت در روزهای پیاپی زنجیره را بلند می‌کند؛ یک روز غیبت → صفر. پاداشِ ضربی برای انگیزه.
export function streakBonus(days: number): number {
  if (days <= 0) return 0
  return Math.round(Math.min(0.5, days * 0.02) * 100) / 100   // تا سقفِ +۵۰٪
}
export function streakStatus(lastActiveDay: number, currentStreak: number, todayDay: number): { streak: number; alive: boolean; bonus: number } {
  const gap = todayDay - lastActiveDay
  if (gap === 0) return { streak: currentStreak, alive: true, bonus: streakBonus(currentStreak) }
  if (gap === 1) return { streak: currentStreak + 1, alive: true, bonus: streakBonus(currentStreak + 1) }
  return { streak: 1, alive: false, bonus: streakBonus(1) }   // زنجیره شکست
}
export function dayNumber(ts: number): number { return Math.floor(ts / 864e5) }

// ── هشدارِ ترسِ‌از‌دست‌دادن (FOMO) — از وضعیتِ رقابتیِ واقعی، نه اعلانِ توخالی ──
export interface FomoInput { isOwner: boolean; rank: number; toNext: number; contested: boolean; runnerUpName?: string; nextName?: string; streakAtRisk?: boolean; daysToStreakLoss?: number }
export function fomoAlerts(i: FomoInput): Array<{ level: 'high' | 'medium' | 'low'; text: string }> {
  const out: Array<{ level: 'high' | 'medium' | 'low'; text: string }> = []
  if (i.isOwner && i.contested) out.push({ level: 'high', text: `مالکیتِ قلمروِ شما در خطر است — ${i.runnerUpName || 'رقیب'} بسیار نزدیک شده. فعال بمانید.` })
  if (!i.isOwner && i.toNext > 0 && i.toNext <= 10) out.push({ level: 'medium', text: `تنها ${i.toNext.toLocaleString('fa-IR')} امتیاز تا پیشی‌گرفتن از ${i.nextName || 'رتبهٔ بالاتر'} فاصله دارید.` })
  if (i.streakAtRisk) out.push({ level: 'medium', text: `زنجیرهٔ فعالیتِ شما امروز می‌شکند اگر فعالیتی ثبت نکنید.` })
  if (i.rank > 3 && i.rank <= 10) out.push({ level: 'low', text: `شما رتبهٔ ${i.rank.toLocaleString('fa-IR')} این قلمرو هستید — با چند اقدامِ بیشتر وارد جمعِ برترین‌ها شوید.` })
  return out
}

// ══════════ ذخیرهٔ streak (dual-mode) ══════════
const FILE = join(process.cwd(), '.reos-streak.json')
interface StreakRow { agentId: string; streak: number; lastActiveDay: number; longest: number; at: number }
function fileLoad(): Record<string, StreakRow> { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return {} }
function fileSave(d: unknown) { try { writeFileSync(FILE, JSON.stringify(d)) } catch {} }
let ready = false
async function ensure() { if (ready) return; await pgTx(c => c.query(`CREATE TABLE IF NOT EXISTS reos_streaks (agent_id text PRIMARY KEY, streak integer NOT NULL DEFAULT 0, last_active_day bigint NOT NULL DEFAULT 0, longest integer NOT NULL DEFAULT 0, at bigint NOT NULL)`)); ready = true }

// ثبتِ فعالیتِ امروز → به‌روزرسانیِ زنجیره (idempotent در همان روز).
export async function touchStreak(agentId: string, now = Date.now()): Promise<StreakRow> {
  const today = dayNumber(now)
  let cur: StreakRow
  if (pgEnabled()) {
    await ensure()
    const r = await pgTx(c => c.query(`SELECT * FROM reos_streaks WHERE agent_id=$1`, [agentId]))
    const x = r.rows[0]; cur = x ? { agentId, streak: x.streak, lastActiveDay: Number(x.last_active_day), longest: x.longest, at: Number(x.at) } : { agentId, streak: 0, lastActiveDay: 0, longest: 0, at: 0 }
  } else {
    cur = fileLoad()[agentId] || { agentId, streak: 0, lastActiveDay: 0, longest: 0, at: 0 }
  }
  const s = streakStatus(cur.lastActiveDay, cur.streak, today)
  const next: StreakRow = { agentId, streak: s.streak, lastActiveDay: today, longest: Math.max(cur.longest, s.streak), at: now }
  if (pgEnabled()) {
    await pgTx(c => c.query(`INSERT INTO reos_streaks(agent_id,streak,last_active_day,longest,at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(agent_id) DO UPDATE SET streak=EXCLUDED.streak, last_active_day=EXCLUDED.last_active_day, longest=EXCLUDED.longest, at=EXCLUDED.at`, [agentId, next.streak, next.lastActiveDay, next.longest, now]))
  } else {
    const db = fileLoad(); db[agentId] = next; fileSave(db)
  }
  return next
}
export async function getStreak(agentId: string, now = Date.now()): Promise<{ streak: number; longest: number; alive: boolean; bonus: number; atRisk: boolean }> {
  let cur: StreakRow
  if (pgEnabled()) {
    await ensure()
    const r = await pgTx(c => c.query(`SELECT * FROM reos_streaks WHERE agent_id=$1`, [agentId]))
    const x = r.rows[0]; cur = x ? { agentId, streak: x.streak, lastActiveDay: Number(x.last_active_day), longest: x.longest, at: Number(x.at) } : { agentId, streak: 0, lastActiveDay: 0, longest: 0, at: 0 }
  } else {
    cur = fileLoad()[agentId] || { agentId, streak: 0, lastActiveDay: 0, longest: 0, at: 0 }
  }
  const today = dayNumber(now)
  const gap = today - cur.lastActiveDay
  const alive = gap <= 1 && cur.streak > 0
  return { streak: alive ? cur.streak : 0, longest: cur.longest, alive, bonus: alive ? streakBonus(cur.streak) : 0, atRisk: gap === 1 }
}
