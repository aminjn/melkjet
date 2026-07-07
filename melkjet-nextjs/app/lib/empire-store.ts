// Empire · هستهٔ «امپراتوری» (سندِ Empire Bible، جلد۲ فصل ۱–۶) — مسیرِ رشدِ کاربرِ عادی.
// قانونِ ۲ سند: هیچ دادهٔ جعلی — دارایی‌ها آگهی‌های واقعیِ سایت‌اند و ارزششان زنده محاسبه می‌شود.
// چهار نوع ارزش (فصل ۶): XP (غیرقابل‌خرید)، Melk Coin (ارزِ داخلی)، Real Asset (تومان)، Reputation (از REOS trust).
// ذخیره dual-mode: PG (جدولِ reos_empire، هر کاربر یک ردیف) یا فایلِ ‎.empire-data.json‎.
import { pgEnabled, pgTx } from './db'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes, createHash } from 'crypto'
import { config } from './reos/reos-config'

export type AssetKind = 'apartment' | 'villa' | 'commercial' | 'land'
export type AssetAction = 'renovate' | 'rent' | 'hold'
export const MENTORS = ['ملک‌جت'] as const
export type Mentor = typeof MENTORS[number]

export type LandPlan = 'sell' | 'build' | 'partner'
export interface EmpireAsset {
  id: string
  listingId: string           // آگهیِ واقعیِ سایت — ارزشِ روز از همان خوانده می‌شود
  title: string
  hood: string
  kind: AssetKind
  buyPrice: number            // تومان در لحظهٔ خرید
  boughtAt: number
  action?: AssetAction        // تصمیمِ معنادارِ بعد از خرید (بازسازی/اجاره/نگه‌داشتن)
  actionAt?: number
  landPlan?: LandPlan         // سیستمِ زمین (§6.7): فروشِ فوری / ساخت / مشارکت
  business?: string           // لایهٔ کسب‌وکارِ تجاری (§6.9): کافه/فروشگاه/…
  businessProb?: number       // ٪ موفقیت — از دادهٔ واقعی (رقابت + استقبالِ محله)
  income?: number             // درآمدِ جمع‌شدهٔ اجاره/کسب‌وکار (برآورد از بازارِ واقعی)
  lastAccrualAt?: number
}
export interface TimelineDot { at: number; icon: string; title: string; detail?: string }
export interface JournalEntry { at: number; text: string }

export interface EmpireData {
  userId: string
  no: number                  // Empire #N — شمارهٔ تولد
  name: string                // نامِ امپراتوری (مثل «Amin Capital»)
  createdAt: number
  persona: string             // آواتار/پرسونای انتخابی
  mentor: Mentor              // دستیارِ هوشمندِ همراه — همیشه «ملک‌جت»
  answers: { city: string; tenB: string; risk: number; ptype: string; goal: string }
  dream: { picks: string[]; sentence: string }        // Dream Board (فصل ۳)
  identity: Record<string, number>                    // امتیازهای هویتی ۰..۱۰۰ (Identity Engine)
  dna: string                                         // Digital DNA (Explorer/Investor/…)
  profile: { title: string; confidence: number }      // «Investor Profile / Confidence 82%»
  capital: number             // تومان — قدرتِ خریدِ شبیه‌سازی (هدیهٔ شروع، فصل ۲)
  coins: number               // Melk Coin (فصل ۶.۲)
  xp: number                  // XPِ امپراتوری (سطح‌ها: Citizen/Explorer/Investor/Builder — §6.2)
  aiTokens: number            // ژتونِ تحلیل AI (بستهٔ خوش‌آمد ×۵ — §6.3)
  badges: string[]            // Founder / First Owner / …
  assets: EmpireAsset[]
  timeline: TimelineDot[]     // تایم‌لاینِ زندگی (اولین نقطه: «به ملک‌جت پیوست»)
  journal: JournalEntry[]     // AI Journal (فصل ۳)
  guess: { tries: number; correct: number }           // Beat AI (مأموریت M3)
  stylePicks?: string[]                               // مأموریت M2 «سبکِ خودت را پیدا کن» (انتخابِ تصویری)
  hunter?: { a: string; b: string; better: string; at: number }   // جفتِ فعالِ Property Hunter (§6.4)
  claims: Record<string, number>                      // پاداش‌های یک‌بارمصرفِ دریافت‌شده (missionKey → ts)
  realized: number            // سود/زیانِ تحقق‌یافته از فروشِ دارایی‌ها (چرخهٔ عمر — فصل ۵)
  rejects: number             // ردِ پیشنهادِ AI در خریدِ اول (۲ بار → کنترلِ آزاد)
  suspense?: { text: string; dueAt: number }          // «Never End A Session» (فصل ۴)
  updatedAt: number
}

// ══════════ هسته‌های خالص (تست‌پذیر، بدونِ I/O) ══════════

// سطح از XPِ امپراتوری — آستانه‌ها از تنظیماتِ سوپرادمین (§6.2: 500/1500/5000).
export function empireLevel(xp: number, lv = config().empire.levelXp): { level: number; title: string; titleFa: string; next: number | null; progress: number } {
  const steps: Array<[number, string, string]> = [[0, 'Citizen', 'شهروند'], [lv.explorer, 'Explorer', 'کاوشگر'], [lv.investor, 'Investor', 'سرمایه‌گذار'], [lv.builder, 'Builder', 'سازنده']]
  let i = 0
  while (i + 1 < steps.length && xp >= steps[i + 1][0]) i++
  const next = i + 1 < steps.length ? steps[i + 1][0] : null
  const start = steps[i][0], span = next ? next - start : 1
  return { level: i + 1, title: steps[i][1], titleFa: steps[i][2], next, progress: next ? Math.min(1, Math.round(((xp - start) / span) * 100) / 100) : 1 }
}

// Identity Engine (فصل ۲): امتیازهای هویتی ۰..۱۰۰ از پاسخ‌های ۵گانه — قطعی و شفاف.
export function identityFromAnswers(a: { tenB?: string; risk?: number; ptype?: string; goal?: string }): Record<string, number> {
  const risk = Math.max(0, Math.min(100, Number(a.risk) || 50))
  const s: Record<string, number> = { investor: 30, builder: 20, commercial: 20, luxury: 20, agency: 10, risk, negotiation: 40 }
  const tenB = a.tenB || ''
  if (/سرمایه|invest/.test(tenB)) s.investor += 40
  if (/ساخت|build|کلنگی/.test(tenB)) s.builder += 40
  if (/کسب|تجاری|مغازه|business/.test(tenB)) s.commercial += 40
  if (/خانه|home|زندگی/.test(tenB)) { s.investor += 10; s.negotiation += 10 }
  const p = a.ptype || ''
  if (/ویلا/.test(p)) s.luxury += 25
  if (/تجاری|مغازه/.test(p)) s.commercial += 20
  if (/زمین|کلنگی/.test(p)) s.builder += 20
  if (/آپارتمان/.test(p)) s.investor += 10
  const g = a.goal || ''
  if (/درآمد|اجاره/.test(g)) s.commercial += 15
  if (/رشد|سود/.test(g)) s.investor += 15
  if (/ساخت/.test(g)) s.builder += 15
  if (/اولین|خانه/.test(g)) s.negotiation += 10
  for (const k in s) s[k] = Math.max(0, Math.min(100, Math.round(s[k])))
  return s
}

// حکمِ هویتی («Investor Profile / Confidence 82%») + DNA — از امتیازها، قطعی.
export function identityVerdict(scores: Record<string, number>): { title: string; confidence: number; dna: string; mentor: Mentor } {
  const order: Array<[string, string, string, Mentor]> = [
    ['investor', 'Investor Profile', 'Investor', 'ملک‌جت'],
    ['builder', 'Builder Profile', 'Builder', 'ملک‌جت'],
    ['commercial', 'Commercial Profile', 'Trader', 'ملک‌جت'],
    ['luxury', 'Luxury Profile', 'Collector', 'ملک‌جت'],
  ]
  const ranked = order.map(([k, t, d, m]) => ({ k, t, d, m, v: scores[k] || 0 })).sort((x, y) => y.v - x.v)
  const top = ranked[0], second = ranked[1]
  // اطمینان = پایه + فاصلهٔ نفرِ اول از دوم (هرچه تمایزِ رفتاری بیشتر، اطمینان بالاتر) — سقف ۹۵.
  const confidence = Math.max(55, Math.min(95, 60 + (top.v - second.v)))
  const dna = (scores.risk || 0) >= 70 ? 'Explorer' : top.d
  return { title: top.t, confidence, dna, mentor: top.m }
}

// دسته‌بندیِ نوعِ دارایی از نوعِ ملکِ آگهیِ واقعی.
export function assetKindOf(ptype: string): AssetKind {
  const p = ptype || ''
  if (/ویلا/.test(p)) return 'villa'
  if (/تجاری|مغازه|اداری/.test(p)) return 'commercial'
  if (/زمین|کلنگی|باغ/.test(p)) return 'land'
  return 'apartment'
}

// Beat AI (M3): حدسِ قیمت — در بازهٔ تلورانس = درست.
export function guessOutcome(actual: number, guess: number, tolerancePct = config().empire.guessTolerancePct): { correct: boolean; deltaPct: number } {
  if (!actual || !guess) return { correct: false, deltaPct: 100 }
  const deltaPct = Math.round(Math.abs(guess - actual) / actual * 100)
  return { correct: deltaPct <= tolerancePct, deltaPct }
}

// برآوردِ سه‌گزینه‌ایِ زمین (§6.7-6.8): فروشِ فوری / ساخت / مشارکت — از قیمتِ واقعی + پارامترهای شفافِ ادمین.
export function landProjection(price: number, cfg = config().empire.land): Array<{ plan: LandPlan; label: string; gainPct: number; months: number; risk: string; projected: number }> {
  return [
    { plan: 'sell', label: 'فروشِ فوری', gainPct: 0, months: 0, risk: 'کم', projected: price },
    { plan: 'build', label: 'ساخت', gainPct: cfg.buildGainPct, months: cfg.buildMonths, risk: 'بالا', projected: Math.round(price * (1 + cfg.buildGainPct / 100)) },
    { plan: 'partner', label: 'مشارکت', gainPct: cfg.partnerGainPct, months: Math.round(cfg.buildMonths / 2), risk: 'متوسط', projected: Math.round(price * (1 + cfg.partnerGainPct / 100)) },
  ]
}

// صندوقچهٔ روزانهٔ متغیر (فصل ۴ «Variable Rewards») — قطعی از هش، همان کاربر/روز همیشه همان جایزه.
export function chestRewardOf(userId: string, day: number, cfg = config().empire.chest): { kind: 'coins' | 'xp' | 'token'; amount: number } {
  const h = createHash('sha1').update(userId + '|chest|' + day).digest()
  const r = h.readUInt32BE(0) % 100
  if (r < 10) return { kind: 'token', amount: 1 }
  if (r < 45) return { kind: 'xp', amount: 10 + (h.readUInt32BE(4) % Math.max(1, cfg.maxXp - 9)) }
  return { kind: 'coins', amount: 20 + (h.readUInt32BE(8) % Math.max(1, cfg.maxCoins - 19)) }
}

// Empire Score (فصل ۵): دارایی + رشد + دانش (دقتِ حدس) + تجربه (XP) + نشان‌ها + تصمیم‌ها — ۰..۱۰۰۰.
export function empireScoreOf(e: Pick<EmpireData, 'assets' | 'capital' | 'guess' | 'xp' | 'badges' | 'claims'>, livePrices: Record<string, number> = {}): number {
  const nw = netWorthOf(e as EmpireData, livePrices)
  const assetsPts = Math.min(300, e.assets.length * 60)
  const growthPts = Math.max(0, Math.min(200, Math.round(nw.growth * 10)))
  const accuracy = e.guess.tries ? e.guess.correct / e.guess.tries : 0
  const knowledgePts = Math.round(accuracy * 150)
  const xpPts = Math.min(200, Math.round(e.xp / 10))
  const badgePts = Math.min(100, e.badges.length * 25)
  const decisionPts = Math.min(50, Object.keys(e.claims).length * 10)
  return assetsPts + growthPts + knowledgePts + xpPts + badgePts + decisionPts
}

// جملهٔ AI Dream Engine از انتخاب‌های Dream Board (فصل ۳) — قطعی.
export function dreamSentence(picks: string[]): string {
  const p = new Set(picks)
  const parts: string[] = []
  if (p.has('home')) parts.push('خانه‌ای که مالِ خودت باشد')
  if (p.has('company')) parts.push('شرکتی که خودت ساخته‌ای')
  if (p.has('lifestyle')) parts.push('سبکِ زندگیِ دلخواهت')
  if (p.has('income')) parts.push('درآمدی که آزادت کند')
  if (p.has('city')) parts.push('زندگی در شهری که دوستش داری')
  if (!parts.length) return 'رؤیای تو، نقطهٔ شروعِ امپراتوریِ توست.'
  return `رؤیای تو: ${parts.join('، ')} — از همین‌جا مسیرش را با هم می‌سازیم.`
}

// ══════════ ذخیره (dual-mode) ══════════
const FILE = join(process.cwd(), '.empire-data.json')
function fileLoad(): Record<string, EmpireData> { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return {} }
function fileSave(d: unknown) { try { writeFileSync(FILE, JSON.stringify(d)) } catch {} }
let ready = false
async function ensure() { if (ready) return; await pgTx(c => c.query(`CREATE TABLE IF NOT EXISTS reos_empire (user_id text PRIMARY KEY, no integer NOT NULL, data jsonb NOT NULL, at bigint NOT NULL)`)); ready = true }

export async function getEmpire(userId: string): Promise<EmpireData | null> {
  if (!userId) return null
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT data FROM reos_empire WHERE user_id=$1`, [userId])); return (r.rows[0]?.data as EmpireData) || null }
  return fileLoad()[userId] || null
}

async function putEmpire(e: EmpireData): Promise<EmpireData> {
  e.updatedAt = Date.now()
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`INSERT INTO reos_empire(user_id,no,data,at) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET data=EXCLUDED.data, at=EXCLUDED.at`, [e.userId, e.no, JSON.stringify(e), e.updatedAt])) }
  else { const db = fileLoad(); db[e.userId] = e; fileSave(db) }
  return e
}

// جهش اتمیک: خواندن، اعمالِ fn، نوشتن — روی PG با قفلِ ردیف (FOR UPDATE) تا دو درخواستِ همزمان سکه/سرمایه را دوبار خرج نکنند.
async function mutateEmpire(userId: string, fn: (e: EmpireData) => void | string): Promise<{ ok: boolean; reason?: string; empire?: EmpireData }> {
  if (pgEnabled()) {
    await ensure()
    return pgTx(async c => {
      const r = await c.query(`SELECT data FROM reos_empire WHERE user_id=$1 FOR UPDATE`, [userId])
      const e = r.rows[0]?.data as EmpireData | undefined
      if (!e) return { ok: false, reason: 'امپراتوری یافت نشد' }
      const err = fn(e)
      if (err) return { ok: false, reason: err, empire: e }
      e.updatedAt = Date.now()
      await c.query(`UPDATE reos_empire SET data=$2, at=$3 WHERE user_id=$1`, [userId, JSON.stringify(e), e.updatedAt])
      return { ok: true, empire: e }
    })
  }
  const db = fileLoad()
  const e = db[userId]
  if (!e) return { ok: false, reason: 'امپراتوری یافت نشد' }
  const err = fn(e)
  if (err) return { ok: false, reason: err, empire: e }
  e.updatedAt = Date.now()
  fileSave(db)
  return { ok: true, empire: e }
}

// ══════════ تولد (فصل ۲): سؤال‌ها → هویت → نام → بستهٔ خوش‌آمد → اولین نقطهٔ تایم‌لاین ══════════
export async function createEmpire(userId: string, input: {
  name?: string; persona?: string
  answers: { city?: string; tenB?: string; risk?: number; ptype?: string; goal?: string }
  dreamPicks?: string[]
}, now = Date.now()): Promise<EmpireData> {
  const existing = await getEmpire(userId)
  if (existing) return existing
  const cfg = config().empire
  const answers = {
    city: String(input.answers.city || '').slice(0, 40),
    tenB: String(input.answers.tenB || '').slice(0, 80),
    risk: Math.max(0, Math.min(100, Number(input.answers.risk) || 50)),
    ptype: String(input.answers.ptype || '').slice(0, 40),
    goal: String(input.answers.goal || '').slice(0, 80),
  }
  const identity = identityFromAnswers(answers)
  const v = identityVerdict(identity)
  const picks = (input.dreamPicks || []).map(String).slice(0, 5)
  // شمارهٔ تولد (Empire #N) — در PG داخلِ همان تراکنشِ درج تا مسابقهٔ همزمانی شماره‌ی تکراری نسازد.
  let no = 1
  if (pgEnabled()) {
    await ensure()
    no = await pgTx(async c => {
      const r = await c.query(`SELECT coalesce(max(no),0)+1 AS n FROM reos_empire`)
      return Number(r.rows[0].n)
    })
  } else no = Object.keys(fileLoad()).length + 1
  const e: EmpireData = {
    userId, no,
    name: String(input.name || '').slice(0, 60) || `امپراتوری #${no}`,
    createdAt: now,
    persona: String(input.persona || '').slice(0, 30),
    mentor: v.mentor,
    answers,
    dream: { picks, sentence: dreamSentence(picks) },
    identity, dna: v.dna,
    profile: { title: v.title, confidence: v.confidence },
    capital: cfg.giftToman,
    coins: cfg.welcomeCoins,
    xp: cfg.welcomeXp,
    aiTokens: cfg.welcomeAiTokens,
    badges: ['Founder'],
    assets: [],
    timeline: [{ at: now, icon: '🌱', title: 'به ملک‌جت پیوست', detail: `تولدِ امپراتوری #${no}` }],
    journal: [],
    guess: { tries: 0, correct: 0 },
    claims: {}, realized: 0, rejects: 0,
    updatedAt: now,
  }
  return putEmpire(e)
}

export async function renameEmpire(userId: string, name: string) {
  return mutateEmpire(userId, e => { const n = String(name || '').trim().slice(0, 60); if (!n) return 'نام خالی است'; e.name = n })
}

// خریدِ دارایی = انتخابِ یک آگهیِ واقعی با قیمتِ واقعی؛ سرمایهٔ شبیه‌سازی کم می‌شود (فصل ۳ + §6.5).
export async function buyAsset(userId: string, listing: { id: string; title: string; hood: string; price: number; ptype?: string }, now = Date.now()) {
  const cfg = config().empire
  return mutateEmpire(userId, e => {
    if (!listing.id || !(listing.price > 0)) return 'آگهیِ نامعتبر'
    if (e.assets.some(a => a.listingId === listing.id)) return 'این ملک از قبل در امپراتوریِ توست'
    if (e.capital < listing.price) return 'سرمایهٔ کافی نیست'
    const first = e.assets.length === 0
    e.capital -= listing.price
    e.assets.push({ id: 'ast_' + randomBytes(5).toString('hex'), listingId: listing.id, title: String(listing.title).slice(0, 120), hood: String(listing.hood || '').slice(0, 60), kind: assetKindOf(listing.ptype || ''), buyPrice: listing.price, boughtAt: now })
    // پاداشِ سند (فصل ۳): ‎+100 XP + Founder + First Owner + Builder Potential +2 + Investor Confidence +1‎
    e.xp += cfg.buyRewardXp
    if (first) {
      if (!e.badges.includes('First Owner')) e.badges.push('First Owner')
      e.identity.builder = Math.min(100, (e.identity.builder || 0) + 2)
      e.identity.investor = Math.min(100, (e.identity.investor || 0) + 1)
      e.timeline.push({ at: now, icon: '🏠', title: 'اولین مالکیت', detail: listing.title.slice(0, 80) })
      e.journal.push({ at: now, text: `امروز اولین ملکِ مسیرت را انتخاب کردی: «${listing.title.slice(0, 60)}». از امروز تو فقط بازدیدکننده نیستی — تو مالک هستی.` })
    } else {
      e.timeline.push({ at: now, icon: '🏘', title: 'داراییِ جدید', detail: listing.title.slice(0, 80) })
    }
  })
}

// تصمیمِ معنادار بعد از خرید (فصل ۳): بازسازی / اجاره دادن / نگه داشتن — شاخهٔ مأموریت و سیگنالِ هویتی.
export async function chooseAssetAction(userId: string, assetId: string, action: AssetAction, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    if (!a) return 'دارایی یافت نشد'
    a.action = action; a.actionAt = now
    const lbl = action === 'renovate' ? 'بازسازی' : action === 'rent' ? 'اجاره دادن' : 'نگه داشتن'
    if (action === 'renovate') e.identity.builder = Math.min(100, (e.identity.builder || 0) + 3)
    if (action === 'rent') e.identity.commercial = Math.min(100, (e.identity.commercial || 0) + 3)
    if (action === 'hold') e.identity.investor = Math.min(100, (e.identity.investor || 0) + 3)
    e.timeline.push({ at: now, icon: action === 'renovate' ? '🛠' : action === 'rent' ? '💰' : '📈', title: `تصمیم: ${lbl}`, detail: a.title.slice(0, 80) })
  })
}

// Beat AI (M3): حدسِ قیمتِ آگهیِ واقعی — درست/غلط + پاداش + خوراکِ مدلِ AVM (دقتِ کاربر ذخیره می‌شود).
export async function recordGuess(userId: string, actual: number, guess: number, now = Date.now()): Promise<{ ok: boolean; reason?: string; correct?: boolean; deltaPct?: number; rewardXp?: number; rewardCoins?: number }> {
  const cfg = config().empire
  const out = guessOutcome(actual, guess, cfg.guessTolerancePct)
  const r = await mutateEmpire(userId, e => {
    e.guess.tries += 1
    if (out.correct) { e.guess.correct += 1; e.xp += cfg.guessRewardXp; e.coins += cfg.guessRewardCoins }
  })
  if (!r.ok) return { ok: false, reason: r.reason }
  return { ok: true, correct: out.correct, deltaPct: out.deltaPct, rewardXp: out.correct ? cfg.guessRewardXp : 0, rewardCoins: out.correct ? cfg.guessRewardCoins : 0 }
}

// دریافتِ پاداشِ مأموریت (M1/M2/Property Hunter) — یک‌بارمصرف به‌ازای هر کلید.
export async function claimEmpireMission(userId: string, missionKey: string, rewardXp: number, rewardCoins: number, now = Date.now()) {
  return mutateEmpire(userId, e => {
    if (e.claims[missionKey]) return 'قبلاً دریافت شده'
    e.claims[missionKey] = now
    e.xp += Math.max(0, rewardXp)
    e.coins += Math.max(0, rewardCoins)
  })
}

// مصرفِ یک ژتونِ تحلیل AI (بستهٔ خوش‌آمد ×۵ — §6.3).
export async function spendAiToken(userId: string) {
  return mutateEmpire(userId, e => { if (e.aiTokens <= 0) return 'ژتونِ تحلیل تمام شده'; e.aiTokens -= 1 })
}

export async function setSuspense(userId: string, text: string, dueAt: number) {
  return mutateEmpire(userId, e => { e.suspense = { text: String(text).slice(0, 200), dueAt } })
}
export async function addJournal(userId: string, text: string, now = Date.now()) {
  return mutateEmpire(userId, e => { e.journal.push({ at: now, text: String(text).slice(0, 400) }); if (e.journal.length > 120) e.journal = e.journal.slice(-120) })
}
export async function bumpRejects(userId: string) {
  return mutateEmpire(userId, e => { e.rejects += 1 })
}
export async function setPersona(userId: string, persona: string) {
  return mutateEmpire(userId, e => { e.persona = String(persona || '').slice(0, 30) })
}
export async function setMentor(userId: string, mentor: string) {
  return mutateEmpire(userId, e => { if (!MENTORS.includes(mentor as Mentor)) return 'منتورِ نامعتبر'; e.mentor = mentor as Mentor })
}

// مأموریت M2 «سبکِ خودت را پیدا کن»: انتخابِ تصویریِ سبک — سیگنالِ هویتی هم می‌دهد.
export async function setStylePicks(userId: string, picks: string[]) {
  return mutateEmpire(userId, e => {
    e.stylePicks = picks.map(String).slice(0, 6)
    if (e.stylePicks.some(p => /لوکس|luxury/.test(p))) e.identity.luxury = Math.min(100, (e.identity.luxury || 0) + 2)
    if (e.stylePicks.some(p => /مدرن|modern/.test(p))) e.identity.investor = Math.min(100, (e.identity.investor || 0) + 1)
  })
}

// Property Hunter (§6.4): ثبتِ جفتِ فعالِ مقایسه (a/b آگهی‌های واقعی؛ better از دادهٔ واقعی محاسبه شده).
export async function setHunterPair(userId: string, a: string, b: string, better: string, now = Date.now()) {
  return mutateEmpire(userId, e => { e.hunter = { a, b, better, at: now } })
}
// پاسخِ Property Hunter: درست → پاداشِ §6.4 (یک‌بار)؛ جفت پاک می‌شود.
export async function answerHunter(userId: string, pick: string, now = Date.now()): Promise<{ ok: boolean; reason?: string; correct?: boolean; better?: string; rewardXp?: number; rewardCoins?: number }> {
  const cfg = config().empire
  let correct = false, better = '', rewarded = false
  const r = await mutateEmpire(userId, e => {
    if (!e.hunter) return 'مقایسه‌ای فعال نیست'
    better = e.hunter.better
    correct = pick === e.hunter.better
    e.hunter = undefined
    if (correct && !e.claims['property_hunter']) {
      e.claims['property_hunter'] = now
      e.xp += cfg.missionRewardXp
      e.coins += cfg.missionRewardCoins
      rewarded = true
    }
  })
  if (!r.ok) return { ok: false, reason: r.reason }
  return { ok: true, correct, better, rewardXp: rewarded ? cfg.missionRewardXp : 0, rewardCoins: rewarded ? cfg.missionRewardCoins : 0 }
}

// فروشِ دارایی (چرخهٔ عمر — فصل ۵): به قیمتِ روزِ واقعی؛ سود/زیان تحقق می‌یابد؛ سود → XP.
export async function sellAsset(userId: string, assetId: string, livePrice: number, now = Date.now()): Promise<{ ok: boolean; reason?: string; profit?: number; salePrice?: number; empire?: EmpireData }> {
  const cfg = config().empire
  let profit = 0, salePrice = 0
  const r = await mutateEmpire(userId, e => {
    const i = e.assets.findIndex(x => x.id === assetId)
    if (i < 0) return 'دارایی یافت نشد'
    const a = e.assets[i]
    salePrice = livePrice > 0 ? livePrice : a.buyPrice
    profit = salePrice - a.buyPrice
    e.capital += salePrice
    e.realized = (e.realized || 0) + profit
    if (profit > 0) e.xp += cfg.sellProfitXp
    e.assets.splice(i, 1)
    const sign = profit > 0 ? 'سود' : profit < 0 ? 'زیان' : 'سربه‌سر'
    e.timeline.push({ at: now, icon: '💸', title: `فروش: ${a.title.slice(0, 50)}`, detail: `${sign} ${Math.abs(Math.round(profit / 1e6)).toLocaleString('fa-IR')} میلیون تومان` })
    if (profit < 0 && !e.claims['first_loss']) {
      // اولین شکستِ آموزشی (فصل ۳): همهٔ سرمایه‌گذارها اشتباه می‌کنند — درس، نه تنبیه.
      e.claims['first_loss'] = now
      e.journal.push({ at: now, text: 'اولین فروشِ با زیان — همهٔ سرمایه‌گذارهای بزرگ از همین‌جا شروع کرده‌اند. مهم این است که دلیلش را بفهمی: قیمتِ خرید، زمان، یا محله؟' })
    }
  })
  if (!r.ok) return { ok: false, reason: r.reason }
  return { ok: true, profit, salePrice, empire: r.empire }
}

// سیستمِ زمین (§6.7): انتخابِ مسیرِ فروشِ فوری / ساخت / مشارکت — سیگنالِ هویتی + تایم‌لاین.
export async function setLandPlan(userId: string, assetId: string, plan: LandPlan, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    if (!a) return 'دارایی یافت نشد'
    if (a.kind !== 'land') return 'این دارایی زمین نیست'
    a.landPlan = plan; a.actionAt = now
    if (plan === 'build') e.identity.builder = Math.min(100, (e.identity.builder || 0) + 4)
    if (plan === 'partner') e.identity.investor = Math.min(100, (e.identity.investor || 0) + 2)
    if (plan === 'sell') e.identity.negotiation = Math.min(100, (e.identity.negotiation || 0) + 2)
    const lbl = plan === 'build' ? 'ساخت' : plan === 'partner' ? 'مشارکت' : 'فروشِ فوری'
    e.timeline.push({ at: now, icon: '🏗', title: `برنامهٔ زمین: ${lbl}`, detail: a.title.slice(0, 70) })
  })
}

// لایهٔ کسب‌وکارِ تجاری (§6.9): انتخابِ کسب‌وکار برای ملکِ تجاری با ٪ موفقیتِ محاسبه‌شده از دادهٔ واقعی.
export async function chooseBusiness(userId: string, assetId: string, business: string, prob: number, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    if (!a) return 'دارایی یافت نشد'
    if (a.kind !== 'commercial') return 'این دارایی تجاری نیست'
    a.business = String(business).slice(0, 40); a.businessProb = Math.max(0, Math.min(100, Math.round(prob))); a.actionAt = now
    e.identity.commercial = Math.min(100, (e.identity.commercial || 0) + 3)
    e.timeline.push({ at: now, icon: '🏪', title: `راه‌اندازیِ ${a.business}`, detail: `${a.title.slice(0, 50)} · احتمالِ موفقیت ${a.businessProb.toLocaleString('fa-IR')}٪` })
  })
}

// واریزِ درآمدِ اجاره/کسب‌وکار (برآورد از بازارِ واقعی — محاسبه در لایهٔ API، اعمالِ اتمیک اینجا).
export async function accrueIncome(userId: string, accruals: Array<{ assetId: string; amount: number }>, now = Date.now()) {
  return mutateEmpire(userId, e => {
    let total = 0
    for (const { assetId, amount } of accruals) {
      if (!(amount > 0)) continue
      const a = e.assets.find(x => x.id === assetId)
      if (!a) continue
      a.income = (a.income || 0) + Math.round(amount)
      a.lastAccrualAt = now
      total += Math.round(amount)
    }
    if (total > 0) e.capital += total
  })
}

// دریافتِ صندوقچهٔ روزانه (پاداشِ متغیرِ فصل ۴) — یک‌بار در روز؛ جایزه قطعی از هش.
export async function claimDailyChest(userId: string, day: number, now = Date.now()): Promise<{ ok: boolean; reason?: string; reward?: ReturnType<typeof chestRewardOf> }> {
  const reward = chestRewardOf(userId, day)
  const r = await mutateEmpire(userId, e => {
    const key = 'chest_' + day
    if (e.claims[key]) return 'صندوقچهٔ امروز باز شده — فردا دوباره بیا'
    e.claims[key] = now
    if (reward.kind === 'coins') e.coins += reward.amount
    else if (reward.kind === 'xp') e.xp += reward.amount
    else e.aiTokens += reward.amount
  })
  if (!r.ok) return { ok: false, reason: r.reason }
  return { ok: true, reward }
}

// همهٔ امپراتوری‌ها برای جدول‌های رتبه (فصل ۵: ۵ لیدربرد) — نمایشِ عمومی فقط نام/نشان، بدونِ شماره‌تلفن.
export async function listEmpiresPublic(limit = 300): Promise<EmpireData[]> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT data FROM reos_empire ORDER BY at DESC LIMIT $1`, [limit])); return r.rows.map(x => x.data as EmpireData) }
  return Object.values(fileLoad()).slice(0, limit)
}

// ارزشِ خالص (Real Asset Value، §6.2-3): سرمایهٔ نقد + ارزشِ روزِ دارایی‌ها از قیمتِ زندهٔ آگهیِ واقعی.
export function netWorthOf(e: EmpireData, livePrices: Record<string, number>): { netWorth: number; assetsValue: number; growth: number } {
  let assetsValue = 0, cost = 0
  for (const a of e.assets) { assetsValue += livePrices[a.listingId] || a.buyPrice; cost += a.buyPrice }
  const growth = cost ? Math.round(((assetsValue - cost) / cost) * 1000) / 10 : 0
  return { netWorth: e.capital + assetsValue, assetsValue, growth }
}

// شمارِ کلِ امپراتوری‌ها (برای «N نفر دیگر هم در حال ساخت‌اند» — فصل ۳، Neighbourhood Discovery).
export async function empireCount(): Promise<number> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT count(*)::int AS n FROM reos_empire`)); return r.rows[0]?.n || 0 }
  return Object.keys(fileLoad()).length
}

// همهٔ کاربرانِ صاحبِ امپراتوری (برای تولیدِ نامهٔ روزانه در cron).
export async function listEmpireUsers(): Promise<string[]> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT user_id FROM reos_empire`)); return r.rows.map(x => x.user_id) }
  return Object.keys(fileLoad())
}

// ══════════ نامهٔ روزانهٔ ملک‌جت — Daily Brief (سند فصل ۴: AI Overnight + جدولِ daily_brief) ══════════
// طرحِ سند: id / user_id / summary / priority / created_at / opened_at — یکی به‌ازای هر کاربر در هر روز.
export interface DailyBrief { id: string; userId: string; day: number; summary: string; items: Array<{ icon: string; text: string }>; priority: number; createdAt: number; openedAt?: number }
export const dayNumberOf = (ts: number) => Math.floor(ts / 864e5)
const BRIEF_FILE = join(process.cwd(), '.empire-briefs.json')
function briefLoad(): Record<string, DailyBrief> { if (existsSync(BRIEF_FILE)) { try { return JSON.parse(readFileSync(BRIEF_FILE, 'utf-8')) } catch {} } return {} }
function briefSave(d: unknown) { try { writeFileSync(BRIEF_FILE, JSON.stringify(d)) } catch {} }
const briefKey = (u: string, day: number) => u + '|' + day
let briefReady = false
async function ensureBrief() { if (briefReady) return; await pgTx(c => c.query(`CREATE TABLE IF NOT EXISTS reos_daily_brief (user_id text NOT NULL, day integer NOT NULL, data jsonb NOT NULL, at bigint NOT NULL, PRIMARY KEY (user_id, day))`)); briefReady = true }

export async function saveBrief(b: Omit<DailyBrief, 'id' | 'createdAt'> & { createdAt?: number }): Promise<DailyBrief> {
  const full: DailyBrief = { id: 'brf_' + randomBytes(5).toString('hex'), createdAt: b.createdAt || Date.now(), ...b }
  if (pgEnabled()) { await ensureBrief(); await pgTx(c => c.query(`INSERT INTO reos_daily_brief(user_id,day,data,at) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,day) DO NOTHING`, [full.userId, full.day, JSON.stringify(full), full.createdAt])) }
  else { const db = briefLoad(); if (!db[briefKey(full.userId, full.day)]) { db[briefKey(full.userId, full.day)] = full; briefSave(db) } }
  return full
}
export async function getBrief(userId: string, day: number): Promise<DailyBrief | null> {
  if (pgEnabled()) { await ensureBrief(); const r = await pgTx(c => c.query(`SELECT data FROM reos_daily_brief WHERE user_id=$1 AND day=$2`, [userId, day])); return (r.rows[0]?.data as DailyBrief) || null }
  return briefLoad()[briefKey(userId, day)] || null
}
export async function markBriefOpened(userId: string, day: number, now = Date.now()): Promise<void> {
  if (pgEnabled()) { await ensureBrief(); await pgTx(c => c.query(`UPDATE reos_daily_brief SET data = data || jsonb_build_object('openedAt', $3::bigint) WHERE user_id=$1 AND day=$2`, [userId, day, now])) }
  else { const db = briefLoad(); const b = db[briefKey(userId, day)]; if (b && !b.openedAt) { b.openedAt = now; briefSave(db) } }
}
