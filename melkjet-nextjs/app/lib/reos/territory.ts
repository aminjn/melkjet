// REOS · Market Dominance Engine — لایهٔ هوشِ رقابتیِ بازارِ املاک.
// «قلمرو» = یک محدودهٔ بازار (محله یا سلولِ جغرافیایی). هر اقدامِ واقعیِ بازار (معامله، لید، آگهیِ باکیفیت،
// محتوا، رضایتِ مشتری) امتیازِ قابل‌اندازه‌گیری تولید می‌کند. مالکِ قلمرو = بالاترین «امتیازِ اقتدار».
// این یک بازی نیست: امتیاز فقط از سیگنالِ واقعیِ کسب‌وکار می‌آید و با ضدِتقلب پالایش می‌شود.
//
// هستهٔ خالص (dominanceScore/fraudScore/battleWinner) تست‌پذیر؛ ذخیره dual-mode (PG/فایل).
import { pgEnabled, pgTx } from '../db'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { config } from './reos-config'

function clamp01(x: number) { return Math.max(0, Math.min(1, x)) }
function r2(x: number) { return Math.round(x * 100) / 100 }

// ── هستهٔ خالص: امتیازِ اقتدار (۰..۱۰۰) ──
// سیگنال‌های خام؛ داخل نرمال‌سازی می‌شوند (مثلِ trustScore). لگاریتمی تا انبوهِ ضعیف بر معدودِ قوی نچربد.
export interface DominanceSignals {
  transactions?: number   // شمارِ معاملاتِ بسته‌شده در قلمرو
  listingQuality?: number // میانگینِ کیفیتِ آگهی‌ها (۰..۱)
  leadConversion?: number // نرخِ تبدیلِ لید (۰..۱)
  satisfaction?: number   // میانگینِ امتیازِ رضایت (۰..۵ یا ۰..۱)
  contentPieces?: number  // شمارِ محتوا/مقاله در قلمرو
  activity?: number       // فعالیتِ اخیر (۰..۱)
  aiTrust?: number        // امتیازِ اعتمادِ AI (۰..۱۰۰)
}
export type DomTier = 'امپراتور' | 'سلطان' | 'قهرمان' | 'رقیب' | 'تازه‌وارد'
export interface Dominance { score: number; tier: DomTier; parts: Record<string, number> }

// نرمال‌سازیِ هر سیگنال به ۰..۱ (روشِ آماریِ قطعی — عمداً فرمول، نه ML).
function normSignals(s: DominanceSignals) {
  const sat = s.satisfaction == null ? 0.5 : s.satisfaction > 1 ? clamp01(s.satisfaction / 5) : clamp01(s.satisfaction)
  return {
    transactions: clamp01(Math.log1p(Math.max(0, s.transactions || 0)) / Math.log1p(30)),
    listingQuality: clamp01(s.listingQuality ?? 0),
    leadConversion: clamp01(s.leadConversion ?? 0),
    satisfaction: sat,
    content: clamp01(Math.log1p(Math.max(0, s.contentPieces || 0)) / Math.log1p(20)),
    activity: clamp01(s.activity ?? 0),
    aiTrust: clamp01((s.aiTrust ?? 50) / 100),
  }
}

function tierOf(score: number): DomTier {
  return score >= 85 ? 'امپراتور' : score >= 70 ? 'سلطان' : score >= 50 ? 'قهرمان' : score >= 30 ? 'رقیب' : 'تازه‌وارد'
}

// امتیازِ اقتدارِ یک آژانس/مشاور در یک قلمرو (وزن‌ها از تنظیماتِ سوپرادمین).
export function dominanceScore(signals: DominanceSignals): Dominance {
  const n = normSignals(signals)
  const w = config().territory.weights
  const raw = w.transactions * n.transactions + w.listingQuality * n.listingQuality + w.leadConversion * n.leadConversion +
    w.satisfaction * n.satisfaction + w.content * n.content + w.activity * n.activity + w.aiTrust * n.aiTrust
  const score = Math.round(clamp01(raw) * 100)
  const parts = Object.fromEntries(Object.entries(n).map(([k, v]) => [k, Math.round(v * 100)]))
  return { score, tier: tierOf(score), parts }
}

// ── ضدِتقلب: امتیازِ تقلب (۰..۱) ──
// الگوهای مشکوک که امتیاز را باید بی‌اعتبار کنند: آگهیِ انبوهِ بدونِ بازدید، تماسِ با خود،
// جهشِ ناگهانی، محتوای تکراری، معامله بدونِ هیچ لیدِ ثبت‌شده.
export interface FraudSignals {
  listings?: number; listingViews?: number   // آگهیِ زیاد با بازدیدِ صفر = مشکوک
  selfContacts?: number; contacts?: number    // نسبتِ تماسِ با شمارهٔ خود
  spikeRatio?: number                          // امتیازِ امروز / میانگینِ ۷ روز (جهش)
  dupContentRatio?: number                     // نسبتِ محتوای تکراری (۰..۱)
  transactions?: number; leads?: number        // معامله بدونِ لیدِ متناظر = جعلی
}
export function fraudScore(s: FraudSignals): { score: number; flags: string[] } {
  const flags: string[] = []
  let f = 0
  const listings = s.listings || 0
  if (listings >= 8 && (s.listingViews || 0) / Math.max(1, listings) < 0.5) { f += 0.3; flags.push('آگهیِ انبوهِ بدونِ بازدید') }
  const selfRatio = (s.contacts || 0) > 0 ? (s.selfContacts || 0) / (s.contacts || 1) : 0
  if (selfRatio > 0.3) { f += 0.3; flags.push('تماسِ مشکوک با شمارهٔ خود') }
  if ((s.spikeRatio || 0) > 6) { f += 0.2; flags.push('جهشِ ناگهانیِ امتیاز') }
  if ((s.dupContentRatio || 0) > 0.5) { f += 0.15; flags.push('محتوای تکراری') }
  if ((s.transactions || 0) > 3 && (s.leads || 0) === 0) { f += 0.25; flags.push('معامله بدونِ لیدِ ثبت‌شده') }
  return { score: r2(clamp01(f)), flags }
}

// نبردِ قلمرو: برندهٔ چالشِ ۷ روزه = بیشترین رشدِ امتیاز (delta) در بازه؛ مساوی → امتیازِ نهاییِ بالاتر.
export function battleWinner(a: { agentId: string; startScore: number; endScore: number }, b: { agentId: string; startScore: number; endScore: number }): { winner: string | null; gainA: number; gainB: number } {
  const gainA = a.endScore - a.startScore, gainB = b.endScore - b.startScore
  let winner: string | null
  if (gainA > gainB) winner = a.agentId
  else if (gainB > gainA) winner = b.agentId
  else winner = a.endScore === b.endScore ? null : (a.endScore > b.endScore ? a.agentId : b.agentId)
  return { winner, gainA, gainB }
}

// ── درآمدزایی (Monetization): ارزشِ پریمیومِ قلمرو از رقابتی‌بودنِ واقعیِ آن ──
// قلمروِ پررقابت (رقبای زیاد + امتیازِ بالا) ارزشِ اشتراکِ بیشتری دارد. قیمتِ پایه × ضریبِ رقابت.
export function territoryValue(input: { competitors: number; topScore: number; avgScore: number; basePrice?: number }): { monthlyToman: number; competitiveness: number } {
  const base = input.basePrice ?? 200000
  const compFactor = clamp01(Math.log1p(Math.max(0, input.competitors)) / Math.log1p(20))   // رقبای بیشتر = باارزش‌تر
  const scoreFactor = clamp01(input.topScore / 100)
  const competitiveness = r2(0.6 * compFactor + 0.4 * scoreFactor)
  const monthlyToman = Math.round((base * (1 + competitiveness * 2)) / 1000) * 1000   // ۱x..۳x پایه
  return { monthlyToman, competitiveness }
}

// ── قلمروسازی از مختصات (سلولِ ~۱کیلومتری در precision=2) یا نامِ محله ──
export function territoryKeyFromGeo(lat: number, lng: number, precision = 2): string { const f = Math.pow(10, precision); return `geo:${Math.round(lat * f) / f}|${Math.round(lng * f) / f}` }
export function territoryKeyFromName(name: string): string { return 'area:' + name.trim().replace(/\s+/g, '_') }

// ══════════════════ ذخیرهٔ dual-mode ══════════════════
const FILE = join(process.cwd(), '.reos-territory.json')
export interface ScoreRow { territory: string; agentId: string; agentName: string; signals: DominanceSignals; score: number; fraud: number; at: number }
export interface OwnerRow { territory: string; ownerId: string; ownerName: string; ownerScore: number; contested: boolean; runnerUpId?: string; at: number }
export interface Battle { id: string; territory: string; challengerId: string; defenderId: string; startAt: number; endAt: number; startScores: Record<string, number>; status: 'open' | 'resolved'; winnerId?: string; resolvedAt?: number }
interface FileDb { scores: Record<string, ScoreRow>; owners: Record<string, OwnerRow>; battles: Record<string, Battle> }

function fileLoad(): FileDb { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return { scores: {}, owners: {}, battles: {} } }
function fileSave(d: FileDb) { try { writeFileSync(FILE, JSON.stringify(d)) } catch {} }
const skey = (t: string, a: string) => t + ' ' + a

let ready = false
async function ensure() {
  if (ready) return
  await pgTx(async c => {
    await c.query(`CREATE TABLE IF NOT EXISTS reos_territory_scores (territory text NOT NULL, agent_id text NOT NULL, agent_name text NOT NULL DEFAULT '', signals jsonb NOT NULL DEFAULT '{}'::jsonb, score integer NOT NULL DEFAULT 0, fraud real NOT NULL DEFAULT 0, at bigint NOT NULL, PRIMARY KEY (territory, agent_id))`)
    await c.query(`CREATE INDEX IF NOT EXISTS reos_terr_scores_t ON reos_territory_scores(territory, score DESC)`)
    await c.query(`CREATE INDEX IF NOT EXISTS reos_terr_scores_a ON reos_territory_scores(agent_id)`)
    await c.query(`CREATE TABLE IF NOT EXISTS reos_territories (territory text PRIMARY KEY, owner_id text NOT NULL DEFAULT '', owner_name text NOT NULL DEFAULT '', owner_score integer NOT NULL DEFAULT 0, contested boolean NOT NULL DEFAULT false, runner_up_id text, at bigint NOT NULL)`)
    await c.query(`CREATE TABLE IF NOT EXISTS reos_territory_battles (id text PRIMARY KEY, territory text NOT NULL, challenger_id text NOT NULL, defender_id text NOT NULL, start_at bigint NOT NULL, end_at bigint NOT NULL, start_scores jsonb NOT NULL DEFAULT '{}'::jsonb, status text NOT NULL DEFAULT 'open', winner_id text, resolved_at bigint)`)
    await c.query(`CREATE INDEX IF NOT EXISTS reos_terr_battles_t ON reos_territory_battles(territory)`)
    await c.query(`CREATE INDEX IF NOT EXISTS reos_terr_battles_s ON reos_territory_battles(status)`)
  })
  ready = true
}

// ثبت/به‌روزرسانیِ امتیازِ اقتدارِ یک آژانس در یک قلمرو (سیگنال‌های واقعی → امتیاز + ضدِتقلب).
export async function recordDominance(territory: string, agentId: string, agentName: string, signals: DominanceSignals, fraudSig: FraudSignals = {}): Promise<ScoreRow> {
  const dom = dominanceScore(signals)
  const fraud = fraudScore(fraudSig)
  // تقلبِ بالاتر از آستانه → امتیاز به‌شدت کاهش می‌یابد (بی‌اعتبارسازی، نه حذف).
  const th = config().territory.fraudThreshold
  const finalScore = fraud.score >= th ? Math.round(dom.score * (1 - fraud.score)) : dom.score
  const row: ScoreRow = { territory, agentId, agentName, signals, score: finalScore, fraud: fraud.score, at: Date.now() }
  if (pgEnabled()) {
    await ensure()
    await pgTx(c => c.query(`INSERT INTO reos_territory_scores(territory,agent_id,agent_name,signals,score,fraud,at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(territory,agent_id) DO UPDATE SET agent_name=EXCLUDED.agent_name, signals=EXCLUDED.signals, score=EXCLUDED.score, fraud=EXCLUDED.fraud, at=EXCLUDED.at`, [territory, agentId, agentName, JSON.stringify(signals), finalScore, fraud.score, row.at]))
  } else {
    const db = fileLoad(); db.scores[skey(territory, agentId)] = row; fileSave(db)
  }
  await recomputeOwner(territory)
  return row
}

async function territoryScores(territory: string): Promise<ScoreRow[]> {
  if (pgEnabled()) {
    await ensure()
    const r = await pgTx(c => c.query(`SELECT * FROM reos_territory_scores WHERE territory=$1 ORDER BY score DESC`, [territory]))
    return r.rows.map(x => ({ territory: x.territory, agentId: x.agent_id, agentName: x.agent_name, signals: x.signals || {}, score: x.score, fraud: Number(x.fraud), at: Number(x.at) }))
  }
  const db = fileLoad()
  return Object.values(db.scores).filter(s => s.territory === territory).sort((a, b) => b.score - a.score)
}

// بازمحاسبهٔ مالکِ قلمرو: بالاترین امتیاز = مالک؛ اگر فاصله با نفرِ دوم کم باشد → «در حالِ رقابت».
async function recomputeOwner(territory: string): Promise<OwnerRow | null> {
  const scores = await territoryScores(territory)
  if (!scores.length) return null
  const top = scores[0], second = scores[1]
  const gap = config().territory.contestGap
  const contested = !!second && (top.score - second.score) < gap
  const row: OwnerRow = { territory, ownerId: top.agentId, ownerName: top.agentName, ownerScore: top.score, contested, runnerUpId: second?.agentId, at: Date.now() }
  if (pgEnabled()) {
    await pgTx(c => c.query(`INSERT INTO reos_territories(territory,owner_id,owner_name,owner_score,contested,runner_up_id,at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(territory) DO UPDATE SET owner_id=EXCLUDED.owner_id, owner_name=EXCLUDED.owner_name, owner_score=EXCLUDED.owner_score, contested=EXCLUDED.contested, runner_up_id=EXCLUDED.runner_up_id, at=EXCLUDED.at`, [territory, row.ownerId, row.ownerName, row.ownerScore, contested, row.runnerUpId || null, row.at]))
  } else {
    const db = fileLoad(); db.owners[territory] = row; fileSave(db)
  }
  return row
}

export async function getOwner(territory: string): Promise<OwnerRow | null> {
  if (pgEnabled()) {
    await ensure()
    const r = await pgTx(c => c.query(`SELECT * FROM reos_territories WHERE territory=$1`, [territory]))
    const x = r.rows[0]; return x ? { territory, ownerId: x.owner_id, ownerName: x.owner_name, ownerScore: x.owner_score, contested: x.contested, runnerUpId: x.runner_up_id || undefined, at: Number(x.at) } : null
  }
  return fileLoad().owners[territory] || null
}

// جدولِ ردهٔ یک قلمرو (رتبه‌بندیِ آژانس‌ها + برچسبِ اقتدار).
export async function leaderboard(territory: string, limit = 20): Promise<Array<ScoreRow & { rank: number; tier: DomTier }>> {
  const scores = await territoryScores(territory)
  return scores.slice(0, limit).map((s, i) => ({ ...s, rank: i + 1, tier: tierOf(s.score) }))
}

// جایگاهِ یک آژانس در یک قلمرو (رتبه + فاصله تا نفرِ بالاتر — سوختِ «ترسِ از دست‌دادن»).
export async function standing(territory: string, agentId: string): Promise<{ rank: number; total: number; score: number; tier: DomTier; toNext: number; nextName?: string; isOwner: boolean } | null> {
  const scores = await territoryScores(territory)
  const idx = scores.findIndex(s => s.agentId === agentId)
  if (idx < 0) return null
  const me = scores[idx], above = scores[idx - 1]
  return { rank: idx + 1, total: scores.length, score: me.score, tier: tierOf(me.score), toNext: above ? above.score - me.score : 0, nextName: above?.agentName, isOwner: idx === 0 }
}

// همهٔ قلمروهایِ یک آژانس (پروفایلِ اعتبارِ عمومی).
export async function agentTerritories(agentId: string): Promise<Array<{ territory: string; score: number; rank: number; total: number; tier: DomTier; isOwner: boolean }>> {
  let rows: ScoreRow[]
  if (pgEnabled()) {
    await ensure()
    const r = await pgTx(c => c.query(`SELECT territory FROM reos_territory_scores WHERE agent_id=$1`, [agentId]))
    rows = r.rows.map(x => ({ territory: x.territory } as ScoreRow))
  } else {
    rows = Object.values(fileLoad().scores).filter(s => s.agentId === agentId)
  }
  const out: Array<{ territory: string; score: number; rank: number; total: number; tier: DomTier; isOwner: boolean }> = []
  for (const t of rows) {
    const st = await standing(t.territory, agentId)
    if (st) out.push({ territory: t.territory, score: st.score, rank: st.rank, total: st.total, tier: st.tier, isOwner: st.isOwner })
  }
  return out.sort((a, b) => b.score - a.score)
}

// نقشهٔ اقتدار: مالکِ همهٔ قلمروها (برای نمایشِ نقشه).
export async function dominanceMap(limit = 200): Promise<OwnerRow[]> {
  if (pgEnabled()) {
    await ensure()
    const r = await pgTx(c => c.query(`SELECT * FROM reos_territories ORDER BY owner_score DESC LIMIT $1`, [limit]))
    return r.rows.map(x => ({ territory: x.territory, ownerId: x.owner_id, ownerName: x.owner_name, ownerScore: x.owner_score, contested: x.contested, runnerUpId: x.runner_up_id || undefined, at: Number(x.at) }))
  }
  return Object.values(fileLoad().owners).sort((a, b) => b.ownerScore - a.ownerScore).slice(0, limit)
}

// آمارِ رقابتیِ یک قلمرو (برای قیمت‌گذاریِ پریمیوم + نمایش).
export async function territoryStats(territory: string): Promise<{ competitors: number; topScore: number; avgScore: number; value: ReturnType<typeof territoryValue> }> {
  const scores = await territoryScores(territory)
  const competitors = scores.length
  const topScore = scores[0]?.score || 0
  const avgScore = competitors ? Math.round(scores.reduce((s, x) => s + x.score, 0) / competitors) : 0
  return { competitors, topScore, avgScore, value: territoryValue({ competitors, topScore, avgScore }) }
}

// ── نبردِ قلمرو (چالشِ ۷ روزه) ──
export async function startBattle(territory: string, challengerId: string, defenderId: string): Promise<Battle> {
  const scores = await territoryScores(territory)
  const sc = (id: string) => scores.find(s => s.agentId === id)?.score || 0
  const days = config().territory.battleDays
  const now = Date.now()
  const b: Battle = { id: 'btl_' + territory.replace(/[^a-z0-9]/gi, '').slice(0, 8) + '_' + challengerId.slice(0, 6) + '_' + now.toString(36), territory, challengerId, defenderId, startAt: now, endAt: now + days * 864e5, startScores: { [challengerId]: sc(challengerId), [defenderId]: sc(defenderId) }, status: 'open' }
  if (pgEnabled()) {
    await ensure()
    await pgTx(c => c.query(`INSERT INTO reos_territory_battles(id,territory,challenger_id,defender_id,start_at,end_at,start_scores,status) VALUES($1,$2,$3,$4,$5,$6,$7,'open')`, [b.id, territory, challengerId, defenderId, b.startAt, b.endAt, JSON.stringify(b.startScores)]))
  } else {
    const db = fileLoad(); db.battles[b.id] = b; fileSave(db)
  }
  return b
}

export async function resolveBattle(id: string, now = Date.now()): Promise<Battle | null> {
  let b: Battle | null = null
  if (pgEnabled()) {
    await ensure()
    const r = await pgTx(c => c.query(`SELECT * FROM reos_territory_battles WHERE id=$1`, [id]))
    const x = r.rows[0]; if (x) b = { id: x.id, territory: x.territory, challengerId: x.challenger_id, defenderId: x.defender_id, startAt: Number(x.start_at), endAt: Number(x.end_at), startScores: x.start_scores || {}, status: x.status, winnerId: x.winner_id || undefined, resolvedAt: x.resolved_at ? Number(x.resolved_at) : undefined }
  } else {
    b = fileLoad().battles[id] || null
  }
  if (!b || b.status === 'resolved') return b
  if (now < b.endAt) return b   // هنوز تمام نشده
  const scores = await territoryScores(b.territory)
  const sc = (id2: string) => scores.find(s => s.agentId === id2)?.score || 0
  const { winner } = battleWinner(
    { agentId: b.challengerId, startScore: b.startScores[b.challengerId] || 0, endScore: sc(b.challengerId) },
    { agentId: b.defenderId, startScore: b.startScores[b.defenderId] || 0, endScore: sc(b.defenderId) },
  )
  b.status = 'resolved'; b.winnerId = winner || undefined; b.resolvedAt = now
  if (b.winnerId) import('./economy').then(m => m.onMarketAction(b!.winnerId!, 'win_battle', 1, now)).catch(() => {})
  if (pgEnabled()) {
    await pgTx(c => c.query(`UPDATE reos_territory_battles SET status='resolved', winner_id=$2, resolved_at=$3 WHERE id=$1`, [id, b.winnerId || null, now]))
  } else {
    const db = fileLoad(); db.battles[id] = b; fileSave(db)
  }
  return b
}

export async function openBattles(territory?: string): Promise<Battle[]> {
  if (pgEnabled()) {
    await ensure()
    const r = territory
      ? await pgTx(c => c.query(`SELECT * FROM reos_territory_battles WHERE status='open' AND territory=$1`, [territory]))
      : await pgTx(c => c.query(`SELECT * FROM reos_territory_battles WHERE status='open'`))
    return r.rows.map(x => ({ id: x.id, territory: x.territory, challengerId: x.challenger_id, defenderId: x.defender_id, startAt: Number(x.start_at), endAt: Number(x.end_at), startScores: x.start_scores || {}, status: x.status, winnerId: x.winner_id || undefined, resolvedAt: x.resolved_at ? Number(x.resolved_at) : undefined }))
  }
  return Object.values(fileLoad().battles).filter(b => b.status === 'open' && (!territory || b.territory === territory))
}

// شمارِ نبردهایِ بردهٔ یک آژانس (برای نشان‌ها).
export async function battlesWonBy(agentId: string): Promise<number> {
  if (pgEnabled()) {
    await ensure()
    const r = await pgTx(c => c.query(`SELECT count(*)::int AS n FROM reos_territory_battles WHERE status='resolved' AND winner_id=$1`, [agentId]))
    return r.rows[0]?.n || 0
  }
  return Object.values(fileLoad().battles).filter(b => b.status === 'resolved' && b.winnerId === agentId).length
}

// صفِ نبردهایِ سررسیدشده را حل می‌کند (cron).
export async function resolveDueBattles(now = Date.now()): Promise<number> {
  const open = await openBattles()
  let n = 0
  for (const b of open) if (now >= b.endAt) { await resolveBattle(b.id, now); n++ }
  return n
}
