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
  // پروانهٔ ساخت (جلد ۶۳): درخواست → بررسی (مهلتِ قطعی از هش) → اعتراضِ احتمالی → صدور. عوارض → خزانه.
  permit?: { requestedAt: number; days: number; fee: number; status: 'pending' | 'granted'; grantedAt?: number; objection?: { text: string; extraDays: number; settleCost: number; settled?: boolean } }
  // موتورِ ساخت (جلد ۶۴–۷۲): هزینهٔ روزشمار (بی‌پولی = توقف — جلد ۷۱)، رویدادهای قطعی، پیش‌فروش، فروشِ واحدها.
  construction?: Construction
  business?: string           // لایهٔ کسب‌وکارِ تجاری (§6.9): کافه/فروشگاه/…
  businessProb?: number       // ٪ موفقیت — از دادهٔ واقعی (رقابت + استقبالِ محله)
  income?: number             // درآمدِ جمع‌شدهٔ اجاره/کسب‌وکار (برآورد از بازارِ واقعی)
  lastAccrualAt?: number
}
export interface TimelineDot { at: number; icon: string; title: string; detail?: string }
export interface JournalEntry { at: number; text: string }

// بازار سرمایه (جلد ۴۰): واحدِ صندوق = «یک مترِ مجازی» از بازارِ واقعی؛ مشارکت = مالکیتِ کسریِ آگهیِ واقعی.
export interface FundHolding { fundId: string; name: string; units: number; cost: number; boughtAt: number; lastDivAt?: number }
export interface CrowdHolding { listingId: string; title: string; hood: string; units: number; cost: number; boughtAt: number }

// شرکتِ ساختمانی (جلد ۶۱): مهندس‌ها شخصیت‌های مسیرِ رشدند (قطعی از هش)؛ حقوقشان جریانِ واقعیِ پول است.
export interface Engineer { id: string; name: string; persona: string; skill: number; salaryMonthly: number; hiredAt: number; lastPaidAt: number }
export interface Company { name: string; kind: string; color: string; foundedAt: number; engineers: Engineer[] }

// پروژهٔ ساخت (جلد ۶۴–۷۲): پیشرفت = روزهای «پرداخت‌شده» — پول نباشد، کارگاه می‌ایستد (جلد ۷۱).
export interface Construction {
  startedAt: number
  days: number                 // کلِ روزهای ساخت (رویدادِ «صبر» اضافه‌اش می‌کند)
  days0?: number               // روزهای برنامهٔ اولیه — برای «تحلیلِ پس از پروژه» (GDD فصل ۴)
  goal?: string                // هدفِ پروژه (GDD فصل ۴ بخش ۸): fast / profit / rep — روی قیمت و پیش‌فروش اثرِ شفاف دارد
  structure: string; quality: string; qualityFactor: number
  builtArea: number; unitArea: number; totalUnits: number
  costTotal: number; paid: number; paidDays: number; lastPayAt: number
  presold: number; sold: number; presaleRevenue: number
  salesRevenue?: number        // عایدیِ فروشِ واحدها بعد از تکمیل (بعد از مالیات) — خوراکِ کارنامهٔ پروژه
  amenities?: string[]         // امکاناتِ میان‌ساخت (GDD فصل ۴ بخش ۴): استخر/روف‌گاردن/… — هزینهٔ واقعی، ارزشِ شفاف
  rented?: number              // واحدهای اجاره‌داده‌شده بعد از تکمیل («نگه‌دار و اجاره بده») — درآمد از میانهٔ واقعیِ محله
  rentStartAt?: number
  eventsFired: number
  pendingEvent?: { text: string; payCost: number; extraDays: number; at: number }
  done?: boolean; doneAt?: number
}

// کارنامهٔ پروژهٔ تحویل‌شده (GDD فصل ۴: «هر پروژه یک درس است») — همه از اعدادِ واقعیِ همان پروژه.
export interface ProjectReport {
  at: number; title: string; hood: string
  goal?: string; structure: string; quality: string; amenities: string[]
  units: number; presold: number; events: number
  landCost: number; buildCost: number; revenue: number; pnl: number
  daysPlanned: number; daysReal: number
}

export interface EmpireData {
  userId: string
  no: number                  // Empire #N — شمارهٔ تولد
  name: string                // نامِ امپراتوری (مثل «Amin Capital»)
  createdAt: number
  persona: string             // آواتار/پرسونای انتخابی
  path?: string               // مسیرِ شخصیتِ شروع (GDD جلد۱): hunter/investor/builder/negotiator/entrepreneur/trader
  lastUpkeepAt?: number       // آخرین کسرِ هزینهٔ مالکیت (GDD جلد۵)
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
  loan?: { amount: number; balance: number; ratePctYear: number; startedAt: number; dueAt: number; lastInterestAt: number }   // بانک (جلد ۱۶) — یک وامِ فعال
  creditHist?: { taken: number; repaid: number; lateDays: number }   // سابقهٔ بازپرداخت — خوراکِ امتیازِ اعتباری
  taxPaid?: number            // مالیاتِ نقل‌وانتقالِ پرداختی → خزانهٔ بازی (جلد ۵/۱۶)
  refBy?: number              // شمارهٔ امپراتوریِ دعوت‌کننده (§7.4 دعوتِ شراکتی)
  funds?: FundHolding[]       // واحدهای صندوق‌های شاخصیِ املاک (جلد ۴۰ فصل ۸)
  crowd?: CrowdHolding[]      // سهم‌های سرمایه‌گذاریِ جمعی روی آگهی‌های واقعی (جلد ۴۰ فصل ۷)
  company?: Company           // شرکتِ ساختمانی (جلد ۶۱) — «از یک اتاقِ کوچک تا امپراتوری»
  wagesPaid?: number          // حقوقِ پرداختی به مهندس‌ها (مصرفِ شفافِ پول — قانون ۶)
  stats?: { sellsProfitable: number; negoWins: number; negoTries?: number; projectsDelivered?: number; repProjects?: number }   // شمارنده‌های واقعیِ رفتار (جلد ۲۶/۷۲)
  projectHist?: ProjectReport[]   // کارنامهٔ پروژه‌های تحویل‌شده (GDD فصل ۴) — درسِ هر پروژه از اعدادِ واقعیِ خودش
  snap?: { day: number; netWorth: number; prev: number }   // اسنپ‌شاتِ روزانه — «سود/زیانِ دیروز» (جلد ۲۶)
  weekSnap?: { week: number; netWorth: number }   // اسنپ‌شاتِ هفتگی — لیدربوردِ «رشدِ این هفته» (سند ۱۶: شانسِ بازیکنِ جدید)
  lastLevel?: number          // آخرین سطحِ پاداش‌گرفته — پاداشِ Level Up (سند ۱۶ فصل ۶ بخش ۱)
  title?: string              // عنوانِ (Title) فعال — فقط از نشان‌های واقعاً کسب‌شده (سند ۱۶ بخش ۹)
  pendingComeback?: number    // هدیهٔ بازگشت (Comeback Engine جلد ۲۶) — روزِ کشفِ غیبت
  stylePicks?: string[]                               // مأموریت M2 «سبکِ خودت را پیدا کن» (انتخابِ تصویری)
  hunter?: { a: string; b: string; better: string; at: number }   // جفتِ فعالِ Property Hunter (§6.4)
  claims: Record<string, number>                      // پاداش‌های یک‌بارمصرفِ دریافت‌شده (missionKey → ts)
  realized: number            // سود/زیانِ تحقق‌یافته از فروشِ دارایی‌ها (چرخهٔ عمر — فصل ۵)
  rejects: number             // ردِ پیشنهادِ AI در خریدِ اول (۲ بار → کنترلِ آزاد)
  suspense?: { text: string; dueAt: number }          // «Never End A Session» (فصل ۴)
  updatedAt: number
}

// ══════════ هسته‌های خالص (تست‌پذیر، بدونِ I/O) ══════════

// سطح‌بندیِ GDD (جلد ۳ Empire Progression): سطحِ عددی از منحنیِ XP + مرحلهٔ هویتی.
// «هیچ بازیکنی نباید به سقف برسد» — بعد از ۱۰۰ مرحلهٔ Empire ادامه دارد (Prestige در فازهای بعد).
const STAGES: Array<[number, string, string]> = [
  [1, 'Rookie', 'تازه‌وارد'], [2, 'Explorer', 'کاوشگر'], [10, 'Investor', 'سرمایه‌گذار'],
  [25, 'Broker', 'مشاور'], [40, 'Agency', 'آژانس'], [60, 'Developer', 'سازنده'],
  [80, 'Corporation', 'هلدینگ'], [100, 'Empire', 'امپراتور'],
]
export function empireLevel(xp: number, curve = config().empire.levelCurve): { level: number; title: string; titleFa: string; next: number | null; progress: number } {
  const base = Math.max(1, curve.base), exp = Math.max(1, curve.exp)
  const cum = (L: number) => Math.round(base * Math.pow(L - 1, exp))   // XPِ تجمعی برای رسیدن به سطحِ L (سطح ۱ = صفر)
  let level = 1
  while (xp >= cum(level + 1) && level < 999) level++
  let si = 0
  while (si + 1 < STAGES.length && level >= STAGES[si + 1][0]) si++
  const start = cum(level), next = cum(level + 1), span = Math.max(1, next - start)
  return { level, title: STAGES[si][1], titleFa: STAGES[si][2], next, progress: Math.min(1, Math.round(((xp - start) / span) * 100) / 100) }
}

// مسیرهای شخصیتِ شروع (GDD جلد ۱): «این فقط ظاهر نیست — رفتارِ بازی تغییر می‌کند» → سیگنالِ هویتیِ اولیه.
export const PATHS: Record<string, { icon: string; label: string; bumps: Record<string, number> }> = {
  hunter: { icon: '🏠', label: 'شکارچیِ فرصت', bumps: { investor: 10, risk: 15 } },
  investor: { icon: '💰', label: 'سرمایه‌گذار', bumps: { investor: 20 } },
  builder: { icon: '🏗', label: 'سازنده', bumps: { builder: 20 } },
  negotiator: { icon: '🤝', label: 'مذاکره‌کننده', bumps: { negotiation: 20 } },
  entrepreneur: { icon: '📈', label: 'کارآفرین', bumps: { commercial: 15, builder: 5 } },
  trader: { icon: '🎯', label: 'تاجر', bumps: { commercial: 20 } },
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

// امتیازِ اعتباری (GDD جلد ۱۶) ۰..۱۰۰۰ — فقط از رفتارِ واقعی: بازپرداخت، نظمِ حضور، سودِ تحقق‌یافته،
// درآمد، دانشِ بازار (دقتِ حدس) و اهرمِ بدهی. باندها طبق سند: ۰-۳۰۰ پرریسک … ۸۰۱-۱۰۰۰ ممتاز.
export function creditScoreOf(e: Pick<EmpireData, 'capital' | 'assets' | 'guess' | 'realized' | 'loan' | 'creditHist'>, streakDays = 0): { score: number; band: string } {
  const h = e.creditHist || { taken: 0, repaid: 0, lateDays: 0 }
  let s = 400                                                          // پایه: معمولی
  s += Math.min(200, h.repaid * 50)                                    // هر بازپرداختِ کامل +۵۰ (سقف ۲۰۰)
  s -= Math.min(300, h.lateDays * 10)                                  // هر روزِ دیرکرد −۱۰
  s += Math.min(100, streakDays * 4)                                   // نظمِ حضور
  const income = e.assets.reduce((x, a) => x + (a.income || 0), 0)
  if ((e.realized || 0) + income > 0) s += Math.min(120, Math.round(((e.realized || 0) + income) / 100_000_000) * 10)   // هر ۱۰۰مِ سود/درآمد +۱۰
  const acc = e.guess.tries ? e.guess.correct / e.guess.tries : 0
  s += Math.round(acc * 80)                                            // دانشِ بازار
  const assetsValue = e.assets.reduce((x, a) => x + a.buyPrice, 0)
  const debt = e.loan?.balance || 0
  if (debt > 0 && assetsValue + e.capital > 0) s -= Math.min(150, Math.round(debt / (assetsValue + e.capital) * 200))   // اهرمِ سنگین
  const score = Math.max(0, Math.min(1000, Math.round(s)))
  const band = score <= 300 ? 'ریسکِ بالا' : score <= 600 ? 'معمولی' : score <= 800 ? 'معتبر' : 'سرمایه‌گذارِ ممتاز'
  return { score, band }
}

// شرایطِ وام از امتیازِ اعتباری — نرخِ بهتر برای اعتبارِ بالاتر (قطعی، تست‌پذیر).
export function loanTermsFor(score: number, netWorth: number, cfg = config().empire.bank, rep?: { stars: number; cutPctPerStar: number }): { maxLoan: number; ratePctYear: number; termDays: number; eligible: boolean; repCutPct?: number } {
  const mult = score > 800 ? 0.75 : score > 600 ? 0.9 : score > 300 ? 1 : 1.4   // ضریبِ نرخ بر اساسِ باند
  const capMult = score > 800 ? 1.2 : score > 600 ? 1 : score > 300 ? 0.7 : 0.3 // سقفِ وام بر اساسِ باند
  const maxLoan = Math.max(0, Math.round(netWorth * (cfg.maxLoanPctOfNetWorth / 100) * capMult))
  let rate = cfg.baseRatePctYear * mult
  // اعتبارِ برند اثرِ واقعی دارد (سند ۱۴ / GDD فصل ۴ بخش ۱۵): هر ⭐ بالای ۱، ٪ کاهشِ نرخ — کفِ نصفِ نرخِ باند.
  const repCutPct = rep && rep.stars > 1 ? Math.max(0, rep.stars - 1) * Math.max(0, rep.cutPctPerStar) : 0
  if (repCutPct > 0) rate = Math.max(cfg.baseRatePctYear * mult * 0.5, rate * (1 - repCutPct / 100))
  return { maxLoan, ratePctYear: Math.round(rate * 10) / 10, termDays: cfg.termDays, eligible: cfg.enabled && maxLoan > 0, repCutPct: repCutPct > 0 ? repCutPct : undefined }
}

// مذاکره (GDD جلد۱، مرحلهٔ ۵ «تولد یک امپراتور») — قطعی از هش تا قابلِ‌سوءاستفاده نباشد:
// شانسِ موفقیت با مهارتِ مذاکره بالا می‌رود؛ تخفیف ۲ تا ۶٪. همان کاربر/آگهی همیشه همان نتیجه.
export function negotiationOutcome(userId: string, listingId: string, negotiationSkill: number): { success: boolean; discountPct: number } {
  const h = createHash('sha1').update(userId + '|nego|' + listingId).digest()
  const roll = h.readUInt32BE(0) % 100
  const chance = 25 + Math.round(Math.max(0, Math.min(100, negotiationSkill)) / 2)   // ۲۵٪ پایه تا ۷۵٪
  if (roll >= chance) return { success: false, discountPct: 0 }
  return { success: true, discountPct: 2 + (h.readUInt32BE(4) % 5) }                  // ۲..۶٪
}

// حافظهٔ مذاکره (سند ۱۴ / GDD فصل ۴ بخش ۹): «هر شخصیت حافظه دارد» — نسخهٔ ۱ از رفتارِ ثبت‌شدهٔ خودِ بازیکن.
// چانه‌زنِ ناموفقِ همیشگی → مالک‌ها محتاط‌تر؛ خوش‌معامله → اعتمادِ سریع‌تر. قطعی و شفاف.
export function negoMemoryOf(stats?: { negoWins: number; negoTries?: number }): { mod: number; note: string | null } {
  const tries = stats?.negoTries || 0
  if (tries < 4) return { mod: 0, note: null }
  const rate = (stats?.negoWins || 0) / tries
  if (rate < 1 / 3) return { mod: -5, note: 'بازار می‌شناسدت — مالک‌ها می‌دانند سخت چانه می‌زنی و محتاط‌تر شده‌اند' }
  if (rate >= 2 / 3) return { mod: 3, note: 'خوش‌معامله‌ای — سابقهٔ معامله‌های موفقت مالک‌ها را زودتر قانع می‌کند' }
  return { mod: 0, note: null }
}

// ثبتِ تلاشِ مذاکره (هر آگهی فقط یک بار — کلیکِ تکراری حافظه را خراب نمی‌کند)؛ بردها هنگامِ خریدِ با تخفیف ثبت می‌شوند (buyAsset).
export async function bumpNegoTries(userId: string, listingId: string) {
  return mutateEmpire(userId, e => {
    const key = 'negoT_' + listingId
    if (e.claims[key]) return 'قبلاً ثبت شده'
    e.claims[key] = Date.now()
    e.stats = e.stats || { sellsProfitable: 0, negoWins: 0 }
    e.stats.negoTries = (e.stats.negoTries || 0) + 1
  })
}

// فرصت‌های طلاییِ امروز (سند ۱۴ — Hook): انتخابِ قطعی از هشِ کاربر+روز روی آگهی‌های «واقعی».
// بعضی واقعاً زیرِ میانهٔ محله‌اند و بعضی نه — بازی قضاوت نمی‌کند؛ فکرکردن (یا ژتونِ تحلیل) کارِ بازیکن است.
export function dailyDealPickOf(userId: string, day: number, ids: string[], count: number): string[] {
  const n = Math.max(1, Math.floor(count))
  return ids
    .map(id => ({ id, r: createHash('sha1').update(`${userId}|deal|${day}|${id}`).digest().readUInt32BE(0) }))
    .sort((a, b) => a.r - b.r)
    .slice(0, n)
    .map(x => x.id)
}

// کوئستِ روزانه/هفتگیِ شخصی (GDD جلد۲): چرخشِ قطعی از هشِ کاربر+دوره — «هیچ دو کاربری کوئستِ یکسان نمی‌گیرند».
// همه از رویدادهای واقعیِ REOS قابلِ‌اندازه‌گیری‌اند (بازدید/محله/ذخیره/جستجو).
export const DAILY_QUESTS = [
  { key: 'views3', title: '۳ آگهیِ واقعی ببین', metric: 'views' as const, target: 3 },
  { key: 'views5', title: '۵ آگهیِ واقعی ببین', metric: 'views' as const, target: 5 },
  { key: 'hoods2', title: '۲ محلهٔ متفاوت را بگرد', metric: 'hoods' as const, target: 2 },
  { key: 'save1', title: '۱ آگهی ذخیره کن', metric: 'saves' as const, target: 1 },
  { key: 'search2', title: '۲ جستجوی هدفمند بزن', metric: 'searches' as const, target: 2 },
]
export const WEEKLY_QUESTS = [
  { key: 'views15', title: 'این هفته ۱۵ آگهی بررسی کن', metric: 'views' as const, target: 15 },
  { key: 'saves3', title: 'این هفته ۳ آگهی ذخیره کن', metric: 'saves' as const, target: 3 },
  { key: 'hoods5', title: 'این هفته ۵ محلهٔ متفاوت را بشناس', metric: 'hoods' as const, target: 5 },
]
export function questOf(userId: string, period: number, cadence: 'daily' | 'weekly') {
  const list = cadence === 'daily' ? DAILY_QUESTS : WEEKLY_QUESTS
  const h = createHash('sha1').update(userId + '|q|' + cadence + '|' + period).digest()
  return list[h.readUInt32BE(0) % list.length]
}

// نردبانِ رؤیا (GDD جلد۳ «Dream Ladder»): همیشه یک رؤیای بزرگ‌ترِ بعدی جلوی چشم — قطعی از وضعیتِ واقعی.
export function nextDreamOf(e: Pick<EmpireData, 'assets' | 'realized' | 'creditHist' | 'badges'>): string {
  if (!e.assets.length && !(e.realized || 0)) return '🏠 رؤیای بعدی: اولین ملکِ مسیرت را انتخاب کن.'
  const hasIncome = e.assets.some(a => (a.income || 0) > 0)
  if (!hasIncome && e.assets.length) return '💰 رؤیای بعدی: اولین درآمدِ اجاره/کسب‌وکارت را بساز.'
  if (!(e.realized || 0)) return '📈 رؤیای بعدی: اولین فروشِ سودده — بخر، رشد بده، بفروش.'
  if (!(e.creditHist?.repaid)) return '🏦 رؤیای بعدی: اولین وام را بگیر و خوش‌حساب تسویه کن.'
  if (e.assets.length < 3) return '🏘 رؤیای بعدی: پرتفوی ۳ملکی — در محله‌های متفاوت.'
  if (e.assets.length < 5) return '🗺 رؤیای بعدی: نفوذ در ۲ محله — پایه‌های امپراتوری.'
  return '👑 رؤیای بعدی: صدرِ جدولِ محله‌ات — نامت در تاریخِ ملک‌جت.'
}

// مأموریت‌های مخفی (GDD جلد ۲۶ «بازی همه مأموریت‌ها را نشان نمی‌دهد»): نشانِ داستان‌دار،
// فقط با رفتارِ واقعی کشف می‌شوند؛ تا کشف نشده‌اند نامشان هم دیده نمی‌شود.
export const HIDDEN_BADGES: Array<{ key: string; fa: string; earned: (e: EmpireData) => boolean }> = [
  { key: 'Elite Seller', fa: 'فروشندهٔ نخبه — ۳ فروشِ سودده', earned: e => (e.stats?.sellsProfitable || 0) >= 3 },
  { key: 'Master Negotiator', fa: 'استادِ مذاکره — ۳ خریدِ با تخفیف', earned: e => (e.stats?.negoWins || 0) >= 3 },
  { key: 'Collector', fa: 'کلکسیونر — مالکِ هر ۴ نوع دارایی', earned: e => new Set(e.assets.map(a => a.kind)).size >= 4 },
  { key: 'Landlord', fa: 'مالکِ درآمدساز — ۱۰۰ میلیون درآمدِ اجاره', earned: e => e.assets.reduce((s, a) => s + (a.income || 0), 0) >= 100_000_000 },
  { key: 'Trusted Borrower', fa: 'خوش‌حسابِ افسانه‌ای — ۲ تسویه بدونِ دیرکرد', earned: e => (e.creditHist?.repaid || 0) >= 2 && (e.creditHist?.lateDays || 0) === 0 },
]
export function earnedHiddenBadges(e: EmpireData): string[] {
  return HIDDEN_BADGES.filter(b => !e.badges.includes(b.key) && b.earned(e)).map(b => b.key)
}
// اعمالِ نشان‌های مخفیِ تازه‌کشف‌شده — با ثبتِ داستانی در تایم‌لاین.
export async function applyHiddenBadges(userId: string, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const fresh = earnedHiddenBadges(e)
    if (!fresh.length) return 'چیزی کشف نشد'
    for (const k of fresh) {
      e.badges.push(k)
      const def = HIDDEN_BADGES.find(b => b.key === k)!
      e.timeline.push({ at: now, icon: '🎖', title: 'مأموریتِ مخفی کشف شد', detail: def.fa })
    }
  })
}

// اسنپ‌شاتِ روزانهٔ ارزشِ خالص (جلد ۲۶ «سودِ دیروز») — اولین بازدیدِ هر روز ثبت می‌شود.
export async function snapshotNetWorth(userId: string, day: number, netWorth: number) {
  return mutateEmpire(userId, e => {
    if (e.snap && e.snap.day >= day) return 'امروز ثبت شده'
    e.snap = { day, netWorth, prev: e.snap?.netWorth ?? netWorth }
  })
}

// هدیهٔ بازگشت (Comeback Engine): غیبت کشف شد → پرچم؛ دریافت یک‌بار، «نه اینکه تنبیه شود».
export async function markComeback(userId: string, day: number) {
  return mutateEmpire(userId, e => { if (e.pendingComeback) return 'از قبل هست'; e.pendingComeback = day })
}
export async function claimComeback(userId: string, coins: number, now = Date.now()) {
  return mutateEmpire(userId, e => {
    if (!e.pendingComeback) return 'هدیهٔ بازگشتی در انتظار نیست'
    e.pendingComeback = undefined
    e.coins += Math.max(0, Math.round(coins))
    e.timeline.push({ at: now, icon: '🎁', title: 'هدیهٔ بازگشت', detail: 'خوش برگشتی — دنیا بدونِ تو کامل نبود' })
  })
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
  name?: string; persona?: string; path?: string; ref?: number
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
  // مسیرِ شخصیت (GDD جلد۱): سیگنالِ هویتیِ اولیه — رفتارِ بازی از همان اول تغییر می‌کند.
  const path = PATHS[String(input.path || '')] ? String(input.path) : ''
  if (path) for (const [k, v] of Object.entries(PATHS[path].bumps)) identity[k] = Math.min(100, (identity[k] || 0) + v)
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
    path,
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
  // دعوتِ شراکتی (§7.4): اگر با لینکِ یک امپراتوریِ دیگر آمده، هر دو طرف پاداش می‌گیرند — «قراردادِ همکاری».
  const refNo = Number(input.ref) || 0
  if (refNo > 0 && refNo !== no) {
    const referrer = (await listEmpiresPublic(500)).find(x => x.no === refNo)
    if (referrer) {
      e.refBy = refNo
      e.coins += cfg.referralCoins
      e.timeline.push({ at: now, icon: '🤝', title: 'قراردادِ همکاری', detail: `با دعوتِ «${referrer.name}» وارد شدی — ${cfg.referralCoins.toLocaleString('fa-IR')} کوینِ شراکت` })
      await mutateEmpire(referrer.userId, r => {
        r.coins += cfg.referralCoins
        r.timeline.push({ at: now, icon: '🤝', title: 'شریکِ جدید وارد شد', detail: `«${e.name}» با دعوتِ تو شروع کرد — ${cfg.referralCoins.toLocaleString('fa-IR')} کوینِ شراکت` })
      }).catch(() => {})
    }
  }
  return putEmpire(e)
}

export async function renameEmpire(userId: string, name: string) {
  return mutateEmpire(userId, e => { const n = String(name || '').trim().slice(0, 60); if (!n) return 'نام خالی است'; e.name = n })
}

// خریدِ دارایی = انتخابِ یک آگهیِ واقعی با قیمتِ واقعی؛ سرمایهٔ شبیه‌سازی کم می‌شود (فصل ۳ + §6.5).
export async function buyAsset(userId: string, listing: { id: string; title: string; hood: string; price: number; ptype?: string }, opts: { negotiated?: boolean } = {}, now = Date.now()) {
  const cfg = config().empire
  return mutateEmpire(userId, e => {
    if (!listing.id || !(listing.price > 0)) return 'آگهیِ نامعتبر'
    if (e.assets.some(a => a.listingId === listing.id)) return 'این ملک از قبل در امپراتوریِ توست'
    // مالیاتِ نقل‌وانتقال (جلد ۵/۱۶): خرید = قیمت + مالیات؛ مالیات به خزانه می‌رود.
    const tax = Math.round(listing.price * (cfg.transferTaxPct / 100))
    if (e.capital < listing.price + tax) return tax > 0 ? `سرمایه کافی نیست (قیمت + ${cfg.transferTaxPct.toLocaleString('fa-IR')}٪ مالیاتِ انتقال)` : 'سرمایهٔ کافی نیست'
    const first = e.assets.length === 0
    e.capital -= listing.price + tax
    e.taxPaid = (e.taxPaid || 0) + tax
    if (opts.negotiated) { e.stats = e.stats || { sellsProfitable: 0, negoWins: 0 }; e.stats.negoWins += 1 }
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
    const tax = Math.round(salePrice * (config().empire.transferTaxPct / 100))
    e.capital += salePrice - tax
    e.taxPaid = (e.taxPaid || 0) + tax
    e.realized = (e.realized || 0) + profit
    if (profit > 0) { e.xp += cfg.sellProfitXp; e.stats = e.stats || { sellsProfitable: 0, negoWins: 0 }; e.stats.sellsProfitable += 1 }
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

// هزینهٔ مالکیت (GDD جلد۵ «Cost of Ownership»): نگهداری/مالیاتِ سالانه — پول از هیچ‌جا تولید و در هیچ‌جا حبس نمی‌شود.
// کسر تا کفِ صفرِ سرمایه؛ خروجی، مبلغِ کسرشده است تا در UI شفاف نمایش داده شود.
export async function applyUpkeep(userId: string, cost: number, now = Date.now()): Promise<{ ok: boolean; reason?: string; charged?: number; empire?: EmpireData }> {
  let charged = 0
  const r = await mutateEmpire(userId, e => {
    charged = Math.min(e.capital, Math.max(0, Math.round(cost)))
    e.capital -= charged
    e.lastUpkeepAt = now
  })
  if (!r.ok) return { ok: false, reason: r.reason }
  return { ok: true, charged, empire: r.empire }
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

// ══════════ بانک (GDD جلد ۱۶): وام با نرخِ اعتباری، بهرهٔ روزشمار، جریمهٔ دیرکرد ══════════
// گرفتنِ وام — فقط یک وامِ فعال؛ سقف و نرخ از loanTermsFor (لایهٔ API محاسبه و پاس می‌دهد).
export async function takeLoan(userId: string, amount: number, ratePctYear: number, termDays: number, now = Date.now()) {
  return mutateEmpire(userId, e => {
    if (e.loan) return 'یک وامِ فعال داری — اول تسویه کن'
    if (!(amount > 0)) return 'مبلغِ نامعتبر'
    e.capital += Math.round(amount)
    e.loan = { amount: Math.round(amount), balance: Math.round(amount), ratePctYear, startedAt: now, dueAt: now + termDays * 864e5, lastInterestAt: now }
    e.creditHist = e.creditHist || { taken: 0, repaid: 0, lateDays: 0 }
    e.creditHist.taken += 1
    e.timeline.push({ at: now, icon: '🏦', title: 'دریافتِ وام', detail: `${Math.round(amount / 1e6).toLocaleString('fa-IR')}م تومان · نرخ ${ratePctYear.toLocaleString('fa-IR')}٪ سالانه` })
  })
}

// بهرهٔ روزشمار (بعد از سررسید ×۱.۵ + ثبتِ روزهای دیرکرد در سابقهٔ اعتباری). خروجی: بهرهٔ افزوده.
export async function accrueLoanInterest(userId: string, now = Date.now()): Promise<{ ok: boolean; added?: number; empire?: EmpireData }> {
  let added = 0
  const r = await mutateEmpire(userId, e => {
    if (!e.loan) return 'وامی نیست'
    const days = Math.floor((now - e.loan.lastInterestAt) / 864e5)
    if (days < 1) return 'زود است'
    const overdueDays = Math.max(0, Math.floor((now - Math.max(e.loan.dueAt, e.loan.lastInterestAt)) / 864e5))
    const normalDays = days - Math.min(days, overdueDays)
    const daily = e.loan.ratePctYear / 100 / 365
    added = Math.round(e.loan.balance * daily * normalDays + e.loan.balance * daily * 1.5 * Math.min(days, overdueDays))
    e.loan.balance += added
    e.loan.lastInterestAt = now
    if (overdueDays > 0) { e.creditHist = e.creditHist || { taken: 0, repaid: 0, lateDays: 0 }; e.creditHist.lateDays += Math.min(days, overdueDays) }
  })
  if (!r.ok) return { ok: false }
  return { ok: true, added, empire: r.empire }
}

// بازپرداخت از سرمایهٔ نقد — تسویهٔ کامل: پاداشِ XP + بهبودِ سابقهٔ اعتباری.
export async function repayLoan(userId: string, amount: number, now = Date.now()): Promise<{ ok: boolean; reason?: string; paid?: number; settled?: boolean; empire?: EmpireData }> {
  const cfg = config().empire.bank
  let paid = 0, settled = false
  const r = await mutateEmpire(userId, e => {
    if (!e.loan) return 'وامی برای بازپرداخت نیست'
    paid = Math.min(Math.max(0, Math.round(amount)), e.loan.balance, e.capital)
    if (!(paid > 0)) return 'سرمایهٔ نقدِ کافی نیست'
    e.capital -= paid
    e.loan.balance -= paid
    if (e.loan.balance <= 0) {
      settled = true
      e.loan = undefined
      e.creditHist = e.creditHist || { taken: 0, repaid: 0, lateDays: 0 }
      e.creditHist.repaid += 1
      e.xp += cfg.repayXp
      e.timeline.push({ at: now, icon: '✅', title: 'تسویهٔ کاملِ وام', detail: 'خوش‌حسابی در سابقهٔ اعتباری‌ات ثبت شد' })
    }
  })
  if (!r.ok) return { ok: false, reason: r.reason }
  return { ok: true, paid, settled, empire: r.empire }
}

// ══════════ شرکتِ ساختمانی (جلد ۶۱) + مالکِ زمین (جلد ۶۲) + پروانه (جلد ۶۳) ══════════
// اعتبارِ ستاره‌ای شرکت (جلد ۶۱ «شرکت Level ندارد؛ اعتبار دارد») — فقط از رفتارِ واقعیِ ثبت‌شده.
export function companyReputationOf(e: Pick<EmpireData, 'stats' | 'creditHist' | 'assets' | 'guess'>, repProjectScore = 10): { stars: number; score: number; factors: string[] } {
  const factors: string[] = []
  let score = 0
  const sells = e.stats?.sellsProfitable || 0
  if (sells) { score += Math.min(30, sells * 10); factors.push(`${sells.toLocaleString('fa-IR')} فروشِ سودده`) }
  const nego = e.stats?.negoWins || 0
  if (nego) { score += Math.min(20, nego * 7); factors.push(`${nego.toLocaleString('fa-IR')} مذاکرهٔ برنده`) }
  const repaid = e.creditHist?.repaid || 0
  if (repaid) { score += Math.min(20, repaid * 10); factors.push('خوش‌حسابی با بانک') }
  const permits = e.assets.filter(a => a.permit?.status === 'granted').length
  if (permits) { score += Math.min(20, permits * 10); factors.push(`${permits.toLocaleString('fa-IR')} پروانهٔ صادرشده`) }
  const delivered = e.stats?.projectsDelivered || 0
  if (delivered) { score += Math.min(30, delivered * 15); factors.push(`${delivered.toLocaleString('fa-IR')} پروژهٔ تحویل‌شده`) }
  const rep = e.stats?.repProjects || 0   // هدفِ «اعتبارِ برند» (GDD فصل ۴): ارزان‌تر فروختی، برند ساختی
  if (rep) { score += Math.min(20, rep * Math.max(0, repProjectScore)); factors.push(`${rep.toLocaleString('fa-IR')} پروژهٔ اعتبارساز (هدفِ برند)`) }
  if (e.assets.length) { score += Math.min(10, e.assets.length * 3); factors.push('پرتفوی فعال') }
  const lateDays = e.creditHist?.lateDays || 0
  if (lateDays) { score -= Math.min(30, lateDays * 3); factors.push('دیرکردِ بانکی (منفی)') }
  score = Math.max(0, Math.min(100, Math.round(score)))
  return { stars: 1 + Math.min(4, Math.floor(score / 20)), score, factors: factors.length ? factors : ['شرکتِ تازه‌کار — اعتبار با پروژه‌های واقعی ساخته می‌شود'] }
}

// نامزدهای استخدام (جلد ۶۱): هر هفته ۳ نامزدِ قطعی از هشِ کاربر+هفته — «رزومه، حقوق، شخصیت».
const ENG_NAMES = ['مهندس رضایی', 'مهندس کریمی', 'مهندس احمدی', 'مهندس موسوی', 'مهندس شریفی', 'مهندس نادری', 'مهندس توکلی', 'مهندس صادقی', 'مهندس عظیمی', 'مهندس یوسفی', 'مهندس قاسمی', 'مهندس جعفری']
const ENG_PERSONAS: Array<[string, string]> = [['دقیق', 'خطای پروژه را کم می‌کند'], ['خلاق', 'طرح‌های بهتر پیشنهاد می‌دهد'], ['باتجربه', 'کارهای اداری را سریع‌تر می‌کند'], ['جاه‌طلب', 'سریع رشد می‌کند']]
export function hireCandidatesOf(userId: string, week: number, salaryBase: number): Array<Omit<Engineer, 'hiredAt' | 'lastPaidAt'>> {
  return [0, 1, 2].map(i => {
    const h = createHash('sha1').update(`${userId}|hire|${week}|${i}`).digest()
    const skill = 35 + (h.readUInt32BE(0) % 56)                       // ۳۵..۹۰
    const p = ENG_PERSONAS[h.readUInt32BE(4) % ENG_PERSONAS.length]
    return {
      id: `eng_${week}_${i}`,
      name: ENG_NAMES[h.readUInt32BE(8) % ENG_NAMES.length],
      persona: `${p[0]} — ${p[1]}`,
      skill,
      salaryMonthly: Math.round(salaryBase * (0.6 + skill / 100)),    // حقوق تابعِ مهارت — شفاف
    }
  })
}
// بیشترین مهارتِ تیم — پاداشِ واقعیِ استخدام: مذاکرهٔ قوی‌تر و پروانهٔ سریع‌تر.
export const teamSkillOf = (e: Pick<EmpireData, 'company'>) => Math.max(0, ...(e.company?.engineers || []).map(x => x.skill))

// اثرِ مشخصِ هر نامزد روی کارتِ استخدام (GDD فصل ۴ بخش ۳: «کارت با اثرِ عددی، نه رزومهٔ خشک»).
// هر سطر یک اثرِ واقعیِ موتور است: مذاکره (negotiationOutcome)، پروانه (permitTermsOf)، رویدادِ کارگاه (progressBuild).
export function engineerEffectsOf(skill: number, eventCutPct = 20, permitSpeedupDays = 1): string[] {
  const fx = [`شانسِ مذاکره +${Math.round(skill / 10).toLocaleString('fa-IR')}٪`]
  if (skill >= 50) fx.push(`هزینهٔ اتفاقِ کارگاه −${Math.round(eventCutPct).toLocaleString('fa-IR')}٪`)
  if (skill >= 60) fx.push(`بررسیِ پروانه −${Math.max(1, Math.round(permitSpeedupDays)).toLocaleString('fa-IR')} روز`)
  return fx
}

// شخصیتِ مالکِ زمین (جلد ۶۲ «زمین قیمتِ ثابت ندارد؛ مالک دارد») — قطعی از هشِ آگهی؛ روی شانسِ مذاکره اثر دارد.
const OWNER_NAMES = ['حاج رضا', 'آقای توکل', 'خانم صبوری', 'آرش', 'آقای معتمد', 'خانم فرهی', 'حاج قاسم', 'مهندس بهرامی']
const OWNER_TYPES: Array<[string, string, number]> = [
  ['محافظه‌کار', 'اهلِ ریسک نیست — سخت کوتاه می‌آید', -10],
  ['منصف', 'دنبالِ معاملهٔ منطقی است', 5],
  ['قیمت‌بالا', 'دنبالِ بالاترین قیمت است', -5],
]
export function ownerPersonaOf(listingId: string): { name: string; age: number; type: string; desc: string; mod: number } {
  const h = createHash('sha1').update(listingId + '|owner').digest()
  const t = OWNER_TYPES[h.readUInt32BE(0) % OWNER_TYPES.length]
  return { name: OWNER_NAMES[h.readUInt32BE(4) % OWNER_NAMES.length], age: 32 + (h.readUInt32BE(8) % 40), type: t[0], desc: t[1], mod: t[2] }
}

// مهلتِ بررسیِ پروانه (جلد ۶۳): قطعی از هش در بازهٔ ادمین؛ مهندسِ ماهر روند را سریع‌تر می‌کند.
export function permitTermsOf(userId: string, assetId: string, cfg: { baseDays: number; extraDaysMax: number; feePct: number; objectionPct: number; engineerSpeedupDays: number }, teamSkill: number, landValue: number): { days: number; fee: number; objection: { text: string; extraDays: number; settleCost: number } | null } {
  const h = createHash('sha1').update(`${userId}|permit|${assetId}`).digest()
  let days = cfg.baseDays + (h.readUInt32BE(0) % (cfg.extraDaysMax + 1))
  if (teamSkill >= 60) days = Math.max(1, days - cfg.engineerSpeedupDays)
  const fee = Math.max(1, Math.round(landValue * (cfg.feePct / 100)))
  const objection = (h.readUInt32BE(4) % 100) < cfg.objectionPct
    ? {
        text: ['همسایه: «نورِ خانهٔ من گرفته می‌شود»', 'همسایه: «کوچه شلوغ می‌شود»', 'کارشناس: «کمبودِ پارکینگ»'][h.readUInt32BE(8) % 3],
        extraDays: 1 + (h.readUInt32BE(12) % 3),
        settleCost: Math.max(1, Math.round(fee / 2)),
      }
    : null
  return { days, fee, objection }
}
export const permitDueAt = (p: NonNullable<EmpireAsset['permit']>) =>
  p.requestedAt + (p.days + (p.objection && !p.objection.settled ? p.objection.extraDays : 0)) * 864e5

// ثبتِ شرکت (جلد ۶۱): نام/برند/نوعِ فعالیت — هزینهٔ ثبت → خزانه؛ نشانِ CEO؛ نقطهٔ تایم‌لاین.
export async function foundCompany(userId: string, input: { name: string; kind: string; color: string }, regFee: number, now = Date.now()) {
  return mutateEmpire(userId, e => {
    if (e.company) return 'شرکتت از قبل ثبت شده'
    const name = String(input.name || '').trim().slice(0, 50)
    if (!name) return 'نامِ شرکت خالی است'
    const fee = Math.max(0, Math.round(regFee))
    if (e.capital < fee) return 'سرمایهٔ کافی برای هزینهٔ ثبت نیست'
    e.capital -= fee
    e.taxPaid = (e.taxPaid || 0) + fee
    e.company = { name, kind: String(input.kind || 'مسکونی').slice(0, 20), color: String(input.color || '#c9a84c').slice(0, 12), foundedAt: now, engineers: [] }
    if (!e.badges.includes('CEO')) e.badges.push('CEO')
    e.timeline.push({ at: now, icon: '🏗', title: 'شرکت تأسیس شد', detail: `«${name}» — ${e.company.kind}` })
    e.journal.push({ at: now, text: `امروز «${name}» را ثبت کردی. از یک دفترِ کوچک شروع می‌شود — مثلِ همهٔ امپراتوری‌های بزرگ.` })
  })
}

// استخدامِ مهندس (جلد ۶۱): نامزد همان لحظه واردِ شرکت می‌شود؛ حقوقش از این به بعد جریانِ واقعیِ پول است.
export async function hireEngineer(userId: string, cand: Omit<Engineer, 'hiredAt' | 'lastPaidAt'>, maxEngineers: number, now = Date.now()) {
  return mutateEmpire(userId, e => {
    if (!e.company) return 'اول شرکتت را ثبت کن'
    if (e.company.engineers.length >= maxEngineers) return `سقفِ تیم ${maxEngineers.toLocaleString('fa-IR')} نفر است`
    if (e.company.engineers.some(x => x.id === cand.id)) return 'این مهندس از قبل در تیمِ توست'
    e.company.engineers.push({ ...cand, hiredAt: now, lastPaidAt: now })
    e.timeline.push({ at: now, icon: '👷', title: `استخدام: ${cand.name}`, detail: `مهارت ${cand.skill.toLocaleString('fa-IR')} · حقوق ${Math.round(cand.salaryMonthly / 1e6).toLocaleString('fa-IR')}م/ماه` })
  })
}

// پرداختِ حقوقِ تیم (روزشمار) — مثلِ هزینهٔ مالکیت: کسر تا کفِ صفر، ثبت در wagesPaid (قانون ۶).
export async function applyWages(userId: string, now = Date.now()): Promise<{ ok: boolean; charged?: number; empire?: EmpireData }> {
  let charged = 0
  const r = await mutateEmpire(userId, e => {
    if (!e.company?.engineers.length) return 'تیمی نیست'
    let due = 0
    for (const eng of e.company.engineers) {
      const days = Math.floor((now - eng.lastPaidAt) / 864e5)
      if (days < 1) continue
      due += Math.round(eng.salaryMonthly * days / 30)
      eng.lastPaidAt = now
    }
    if (!(due > 0)) return 'هنوز زود است'
    charged = Math.min(e.capital, due)
    e.capital -= charged
    e.wagesPaid = (e.wagesPaid || 0) + charged
  })
  if (!r.ok) return { ok: false }
  return { ok: true, charged, empire: r.empire }
}

// درخواستِ پروانه (جلد ۶۳): فقط زمینِ با برنامهٔ «ساخت»؛ عوارض → خزانه؛ مهلت/اعتراض قطعی از هش.
export async function requestPermit(userId: string, assetId: string, terms: { days: number; fee: number; objection: { text: string; extraDays: number; settleCost: number } | null }, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    if (!a) return 'دارایی یافت نشد'
    if (a.kind !== 'land') return 'پروانه فقط برای زمین است'
    if (a.landPlan !== 'build') return 'اول برنامهٔ زمین را «ساخت» انتخاب کن'
    if (a.permit) return a.permit.status === 'granted' ? 'پروانهٔ این زمین صادر شده' : 'درخواستِ پروانه در حالِ بررسی است'
    if (e.capital < terms.fee) return 'سرمایهٔ کافی برای عوارضِ پروانه نیست'
    e.capital -= terms.fee
    e.taxPaid = (e.taxPaid || 0) + terms.fee
    a.permit = { requestedAt: now, days: terms.days, fee: terms.fee, status: 'pending', objection: terms.objection || undefined }
    e.timeline.push({ at: now, icon: '🏛', title: 'درخواستِ پروانهٔ ساخت ثبت شد', detail: `${a.title.slice(0, 50)} · بررسی تا ${terms.days.toLocaleString('fa-IR')} روز` })
    if (terms.objection) e.timeline.push({ at: now, icon: '⚠️', title: 'اعتراض به پروانه', detail: terms.objection.text })
  })
}

// حلِ اعتراض با پرداختِ غرامت (جلد ۶۳) — یا صبر برای دفاع در کمیسیون (روزهای اضافه).
export async function settleObjection(userId: string, assetId: string, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    const ob = a?.permit?.objection
    if (!a || !a.permit || !ob) return 'اعتراضی در کار نیست'
    if (ob.settled) return 'اعتراض قبلاً حل شده'
    if (e.capital < ob.settleCost) return 'سرمایهٔ کافی برای غرامت نیست'
    e.capital -= ob.settleCost
    e.taxPaid = (e.taxPaid || 0) + ob.settleCost
    ob.settled = true
    e.timeline.push({ at: now, icon: '🤝', title: 'اعتراضِ پروانه با توافق حل شد', detail: `${Math.round(ob.settleCost / 1e6).toLocaleString('fa-IR')}م تومان غرامت` })
  })
}

// ══════════ موتورِ ساخت (جلد ۶۴–۷۲) — یک Engine، رویدادها = دادهٔ قطعی از هش ══════════
// نقشهٔ ساخت: سازه/کیفیت با ضرایبِ شفاف (مثلِ buildGainPct) — روزها و هزینه از knobهای ادمین.
export const BUILD_STRUCTURES: Record<string, { label: string; daysMul: number; costMul: number }> = {
  concrete: { label: 'بتنی', daysMul: 1, costMul: 1 },
  steel: { label: 'فلزی', daysMul: 0.75, costMul: 1.15 },
  hybrid: { label: 'ترکیبی', daysMul: 0.9, costMul: 1.05 },
}
export const BUILD_QUALITIES: Record<string, { label: string; costMul: number; qualityFactor: number }> = {
  economy: { label: 'اقتصادی', costMul: 0.85, qualityFactor: 0.93 },
  standard: { label: 'استاندارد', costMul: 1, qualityFactor: 1 },
  luxury: { label: 'لوکس', costMul: 1.25, qualityFactor: 1.08 },
}
export function buildPlanOf(structure: string, quality: string, landArea: number, cfg: { buildFactor: number; unitArea: number; costPerM: number; buildDays: number }): { days: number; builtArea: number; unitArea: number; totalUnits: number; costTotal: number; qualityFactor: number } | null {
  const s = BUILD_STRUCTURES[structure], q = BUILD_QUALITIES[quality]
  if (!s || !q || !(landArea > 0)) return null
  const builtArea = Math.round(landArea * cfg.buildFactor)
  const totalUnits = Math.max(1, Math.floor(builtArea / Math.max(30, cfg.unitArea)))
  return {
    days: Math.max(3, Math.round(cfg.buildDays * s.daysMul)),
    builtArea, unitArea: Math.max(30, cfg.unitArea), totalUnits,
    costTotal: Math.round(builtArea * cfg.costPerM * s.costMul * q.costMul),
    qualityFactor: q.qualityFactor,
  }
}
// هدفِ پروژه (GDD فصل ۴ بخش ۸): یک تصمیمِ استراتژیکِ سرِ کلنگ — اثرش شفاف و برگشت‌ناپذیر.
export const PROJECT_GOALS: Record<string, { label: string; icon: string; desc: string }> = {
  fast: { label: 'فروشِ سریع', icon: '⚡', desc: 'کمی ارزان‌تر از میانهٔ واقعیِ محله می‌فروشی، اما سقفِ پیش‌فروش بالاتر است — نقدینگی زودتر برمی‌گردد' },
  profit: { label: 'حداکثرِ سود', icon: '💰', desc: 'قیمتِ کاملِ میانهٔ واقعیِ محله — حاشیهٔ بیشتر، فروشِ صبورانه‌تر' },
  rep: { label: 'اعتبارِ برند', icon: '⭐', desc: 'کمی ارزان‌تر می‌فروشی، اما تحویلِ این پروژه اعتبارِ شرکتت را بیشتر بالا می‌برد' },
}
// ضریبِ قیمتِ هدف — همیشه روی میانهٔ متریِ «واقعی» اعمال می‌شود؛ هیچ قیمتی از هوا نمی‌آید.
export const goalPricePct = (goal: string | undefined, cfg: { goalFastPricePct: number; goalRepPricePct: number }): number =>
  goal === 'fast' ? Math.max(50, Math.min(100, cfg.goalFastPricePct)) : goal === 'rep' ? Math.max(50, Math.min(100, cfg.goalRepPricePct)) : 100

// امکاناتِ میان‌ساخت (GDD فصل ۴ بخش ۴): تصمیمِ وسطِ ساخت — هزینهٔ واقعیِ الان، ارزشِ شفافِ بعداً.
export const AMENITY_LABELS: Record<string, { label: string; icon: string }> = {
  pool: { label: 'استخر و سونا', icon: '🏊' },
  roof: { label: 'روف‌گاردن', icon: '🌿' },
  gym: { label: 'باشگاهِ ورزشی', icon: '🏋️' },
  parking: { label: 'پارکینگِ اضافه', icon: '🅿️' },
}
export function amenityValueFactorOf(c: Pick<Construction, 'amenities'>, amenCfg: Record<string, { costPct: number; valuePct: number }>): number {
  let f = 1
  for (const k of c.amenities || []) { const a = amenCfg[k]; if (a) f *= 1 + Math.max(0, a.valuePct) / 100 }
  return f
}

// فروشِ عمده (GDD فصل ۴ بخش ۵ «بازار به رفتارِ بازیکن واکنش نشان می‌دهد»): عرضهٔ یکجای خودت بازارِ خودت را اشباع می‌کند —
// از واحدِ freeUnits+1 به بعد هر واحد stepPct٪ ارزان‌تر (کفِ ۸۰٪). تصمیم: همه را یکجا بفروش (سریع) یا کم‌کم (گران‌تر).
export function bulkPriceOf(unitPrice: number, units: number, freeUnits: number, stepPct: number): { total: number; avgUnit: number; discounted: number } {
  let total = 0, discounted = 0
  for (let i = 0; i < Math.max(0, Math.floor(units)); i++) {
    const over = Math.max(0, i + 1 - Math.max(0, Math.floor(freeUnits)))
    const mul = Math.max(0.8, 1 - over * Math.max(0, stepPct) / 100)
    if (over > 0 && mul < 1) discounted++
    total += unitPrice * mul
  }
  total = Math.round(total)
  return { total, avgUnit: units > 0 ? Math.round(total / units) : 0, discounted }
}

// کارنامهٔ پروژه (GDD فصل ۴: «تحلیلِ پس از تحویل — یادگیری، نه فقط جشن») — فقط از اعدادِ واقعیِ همان پروژه.
export function projectReportOf(a: Pick<EmpireAsset, 'title' | 'hood' | 'buyPrice'>, c: Construction, now: number): ProjectReport {
  return {
    at: now, title: a.title.slice(0, 60), hood: a.hood,
    goal: c.goal, structure: c.structure, quality: c.quality, amenities: [...(c.amenities || [])],
    units: c.totalUnits, presold: c.presold, events: c.eventsFired,
    landCost: a.buyPrice, buildCost: c.paid,
    revenue: c.presaleRevenue + (c.salesRevenue || 0),
    pnl: c.presaleRevenue + (c.salesRevenue || 0) - (a.buyPrice + c.paid),
    daysPlanned: c.days0 || c.days,
    daysReal: Math.max(1, Math.round(((c.doneAt || now) - c.startedAt) / 864e5)),
  }
}
export function projectLessonsOf(r: ProjectReport): string[] {
  const out: string[] = []
  const cost = r.landCost + r.buildCost
  const retPct = cost > 0 ? Math.round((r.pnl / cost) * 100) : 0
  out.push(r.pnl >= 0
    ? `سودِ خالص ${Math.round(r.pnl / 1e6).toLocaleString('fa-IR')}م تومان (بازدهِ ${retPct.toLocaleString('fa-IR')}٪ روی کلِ هزینه)`
    : `زیانِ ${Math.abs(Math.round(r.pnl / 1e6)).toLocaleString('fa-IR')}م تومان — قیمتِ تمام‌شده از فروشِ واقعیِ محله بالاتر درآمد`)
  out.push(r.daysReal > r.daysPlanned
    ? `${(r.daysReal - r.daysPlanned).toLocaleString('fa-IR')} روز بیش از برنامه طول کشید (اتفاق‌های کارگاه یا توقفِ نقدینگی)`
    : 'سرِ برنامه تمام شد — مدیریتِ نقدینگی درست بود')
  if (r.presold > 0) out.push(`${r.presold.toLocaleString('fa-IR')} واحد پیش‌فروش شد — نقدینگیِ ساخت را داد اما ارزان‌تر از فروشِ نهایی بود`)
  if (r.events > 0) out.push(`${r.events.toLocaleString('fa-IR')} اتفاقِ کارگاهی مدیریت شد`)
  if (r.amenities.length) out.push(`${r.amenities.length.toLocaleString('fa-IR')} امکاناتِ رفاهی ارزشِ فروشِ هر واحد را بالا برد`)
  if (r.goal && PROJECT_GOALS[r.goal]) out.push(`استراتژی: ${PROJECT_GOALS[r.goal].label}`)
  return out
}

// رویدادِ کارگاه (Project Event Engine نسخهٔ ۱): قطعی از هش — «پرداخت» یا «صبر»؛ هیچ‌کدام بی‌هزینه نیست.
const BUILD_EVENTS = [
  'بارانِ شدید — کارگاه گِل شد', 'جرثقیل خراب شد', 'در حفاری سنگِ بزرگ پیدا شد',
  'بتن دیر رسید و کیفیتش مرزی است', 'بازرسِ نظام‌مهندسی ایراد گرفت', 'کمبودِ موقتِ میلگرد در بازار',
]
export function buildEventOf(userId: string, assetId: string, idx: number, costTotal: number): { text: string; payCost: number; extraDays: number } {
  const h = createHash('sha1').update(`${userId}|bev|${assetId}|${idx}`).digest()
  return {
    text: BUILD_EVENTS[h.readUInt32BE(0) % BUILD_EVENTS.length],
    payCost: Math.max(1, Math.round(costTotal * (1 + (h.readUInt32BE(4) % 2)) / 100)),   // ۱ تا ۲٪ هزینهٔ کل
    extraDays: 1 + (h.readUInt32BE(8) % 3),
  }
}
export const BUILD_STAGES = ['تجهیزِ کارگاه', 'خاکبرداری', 'فونداسیون', 'اسکلت', 'دیوار و تأسیسات', 'سقف و نما', 'نازک‌کاری']
export const buildStageOf = (c: Pick<Construction, 'paidDays' | 'days'>) =>
  BUILD_STAGES[Math.min(BUILD_STAGES.length - 1, Math.floor((c.paidDays / Math.max(1, c.days)) * BUILD_STAGES.length))]

// کلنگ‌زنی (جلد ۶۴): فقط زمینِ دارای پروانهٔ صادرشده.
export async function startBuild(userId: string, assetId: string, plan: NonNullable<ReturnType<typeof buildPlanOf>>, meta: { structure: string; quality: string; goal?: string }, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    if (!a) return 'دارایی یافت نشد'
    if (a.permit?.status !== 'granted') return 'اول پروانهٔ ساخت را بگیر'
    if (a.construction) return 'ساختِ این پروژه شروع شده'
    const goal = meta.goal && PROJECT_GOALS[meta.goal] ? meta.goal : undefined
    a.construction = {
      startedAt: now, days: plan.days, days0: plan.days, goal,
      structure: meta.structure, quality: meta.quality, qualityFactor: plan.qualityFactor,
      builtArea: plan.builtArea, unitArea: plan.unitArea, totalUnits: plan.totalUnits,
      costTotal: plan.costTotal, paid: 0, paidDays: 0, lastPayAt: now,
      presold: 0, sold: 0, presaleRevenue: 0, eventsFired: 0,
    }
    e.timeline.push({ at: now, icon: '⛏', title: 'کلنگ‌زنی — ساخت آغاز شد', detail: `${a.title.slice(0, 45)} · ${plan.builtArea.toLocaleString('fa-IR')} مترِ بنا · ${plan.totalUnits.toLocaleString('fa-IR')} واحد${goal ? ` · هدف: ${PROJECT_GOALS[goal].label}` : ''}` })
    e.journal.push({ at: now, text: 'اولین کلنگِ پروژه زده شد. از امروز کارگاه هر روز هزینه دارد — مدیریتِ پول، خودِ ساخت است.' })
  })
}

// پیشرفتِ روزشمار (جلد ۷۱ «Cash Flow Crisis»): هر روزِ ساخت باید «پرداخت» شود؛ بی‌پولی = توقفِ کارگاه.
// در ایستگاه‌های ۳۰٪ و ۷۰٪ رویدادِ قطعی رخ می‌دهد و تا تصمیمِ بازیکن، پیشرفت می‌ایستد.
export async function progressBuild(userId: string, now = Date.now()): Promise<{ ok: boolean; paid?: number; completedTitles?: string[]; empire?: EmpireData }> {
  let paidTotal = 0
  const completedTitles: string[] = []
  const r = await mutateEmpire(userId, e => {
    let touched = false
    for (const a of e.assets) {
      const c = a.construction
      if (!c || c.done || c.pendingEvent) continue
      const days = Math.floor((now - c.lastPayAt) / 864e5)
      if (days < 1) continue
      touched = true
      c.lastPayAt = now   // روزهای بی‌پول از دست می‌روند (توقفِ واقعی، نه بدهیِ پنهان)
      const dailyCost = Math.max(1, Math.round(c.costTotal / c.days))
      const checkpoints = [Math.ceil(c.days * 0.3), Math.ceil(c.days * 0.7)]
      for (let d = 0; d < days && c.paidDays < c.days; d++) {
        if (e.capital < dailyCost) break                      // بحرانِ نقدینگی — کارگاه می‌ایستد
        e.capital -= dailyCost
        c.paid += dailyCost
        c.paidDays += 1
        paidTotal += dailyCost
        const idx = checkpoints.indexOf(c.paidDays)
        if (idx >= 0 && c.eventsFired <= idx) {
          c.eventsFired = idx + 1
          const ev = buildEventOf(e.userId, a.id, idx, c.costTotal)
          // تیمِ ماهر (مهارت ≥۵۰) هزینهٔ رویداد را کم می‌کند — همان اثری که روی کارتِ استخدام نوشته شده (GDD فصل ۴).
          const cut = teamSkillOf(e) >= 50 ? Math.max(0, Math.min(90, config().empire.build.eventSkillCutPct)) : 0
          c.pendingEvent = { ...ev, payCost: Math.max(1, Math.round(ev.payCost * (1 - cut / 100))), at: now }
          e.timeline.push({ at: now, icon: '⚠️', title: 'اتفاق در کارگاه', detail: c.pendingEvent.text })
          break                                               // تا تصمیمِ بازیکن، کار می‌ایستد
        }
      }
      if (c.paidDays >= c.days && !c.done) {
        c.done = true; c.doneAt = now
        completedTitles.push(a.title)
        // تحویلِ پیش‌فروش‌ها: سود/زیانشان همین‌جا تحقق می‌یابد (درآمدش قبلاً واردِ نقد شده بود).
        if (c.presold > 0) {
          const costShare = Math.round((a.buyPrice + c.paid) / c.totalUnits)
          e.realized = (e.realized || 0) + (c.presaleRevenue - costShare * c.presold)
        }
        e.stats = e.stats || { sellsProfitable: 0, negoWins: 0 }
        e.stats.projectsDelivered = (e.stats.projectsDelivered || 0) + 1
        if (c.goal === 'rep') e.stats.repProjects = (e.stats.repProjects || 0) + 1   // هدفِ «اعتبارِ برند» → امتیازِ اعتبارِ شرکت
        if (!e.badges.includes('First Tower')) e.badges.push('First Tower')
        e.timeline.push({ at: now, icon: '🏙', title: 'ساختمان تکمیل شد', detail: `${a.title.slice(0, 45)} — ${c.totalUnits.toLocaleString('fa-IR')} واحد آمادهٔ عرضه` })
        e.journal.push({ at: now, text: 'خطِ آسمانِ شهر عوض شد — ساختمانِ تو حالا واقعی است. وقتِ فروش است.' })
      }
    }
    if (!touched && !paidTotal) return 'ساختِ فعالی نیست'
  })
  if (!r.ok) return { ok: false }
  return { ok: true, paid: paidTotal, completedTitles, empire: r.empire }
}

// تصمیم دربارهٔ رویدادِ کارگاه: «پرداخت» (هزینه به بهای تمام‌شدهٔ پروژه) یا «صبر» (روزهای بیشتر).
export async function resolveBuildEvent(userId: string, assetId: string, choice: 'pay' | 'wait', now = Date.now()) {
  return mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    const ev = a?.construction?.pendingEvent
    if (!a || !a.construction || !ev) return 'اتفاقِ منتظری نیست'
    if (choice === 'pay') {
      if (e.capital < ev.payCost) return 'سرمایهٔ کافی برای حلِ فوری نیست — گزینهٔ صبر را انتخاب کن'
      e.capital -= ev.payCost
      a.construction.paid += ev.payCost
      e.timeline.push({ at: now, icon: '🛠', title: 'مشکلِ کارگاه فوری حل شد', detail: `${Math.round(ev.payCost / 1e6).toLocaleString('fa-IR')}م تومان هزینه` })
    } else {
      a.construction.days += ev.extraDays
      e.timeline.push({ at: now, icon: '⏳', title: 'کارگاه با صبر از مشکل عبور کرد', detail: `${ev.extraDays.toLocaleString('fa-IR')} روز به ساخت اضافه شد` })
    }
    a.construction.pendingEvent = undefined
  })
}

// پیش‌فروش (جلد ۷۱): از ۳۰٪ پیشرفت، تا سقفِ مجاز — نقدینگیِ فوری با قیمتِ واقعیِ محله منهای تخفیفِ شفاف.
export async function presellUnits(userId: string, assetId: string, units: number, unitPrice: number, minProgressPct: number, maxPct: number, now = Date.now()): Promise<{ ok: boolean; reason?: string; revenue?: number; empire?: EmpireData }> {
  let revenue = 0
  const r = await mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    const c = a?.construction
    if (!a || !c) return 'ساختی در جریان نیست'
    if (c.done) return 'ساختمان تکمیل شده — از فروشِ واحد استفاده کن'
    if ((c.paidDays / c.days) * 100 < minProgressPct) return `پیش‌فروش از ${minProgressPct.toLocaleString('fa-IR')}٪ پیشرفت باز می‌شود`
    const maxPresell = Math.floor(c.totalUnits * maxPct / 100)
    if (!(units >= 1) || c.presold + units > maxPresell) return `سقفِ پیش‌فروش ${maxPresell.toLocaleString('fa-IR')} واحد است`
    if (!(unitPrice > 0)) return 'برای قیمت‌گذاری، نمونهٔ واقعیِ هم‌محله در دسترس نیست'
    revenue = Math.round(units * unitPrice)
    e.capital += revenue
    c.presold += units
    c.presaleRevenue += revenue
    e.timeline.push({ at: now, icon: '📝', title: `پیش‌فروشِ ${units.toLocaleString('fa-IR')} واحد`, detail: `${Math.round(revenue / 1e6).toLocaleString('fa-IR')}م تومان نقدینگی — تعهدِ تحویل ثبت شد` })
  })
  if (!r.ok) return { ok: false, reason: r.reason }
  return { ok: true, revenue, empire: r.empire }
}

// فروشِ واحد بعد از تکمیل (جلد ۷۲): قیمت از میانهٔ متریِ واقعیِ محله؛ مالیات → خزانه؛ اتمامِ همهٔ واحدها = تحویلِ پروژه.
export async function sellUnits(userId: string, assetId: string, units: number, unitPrice: number, taxPct: number, now = Date.now()): Promise<{ ok: boolean; reason?: string; proceeds?: number; pnl?: number; completed?: boolean; empire?: EmpireData }> {
  let proceeds = 0, pnl = 0, completed = false
  const r = await mutateEmpire(userId, e => {
    const i = e.assets.findIndex(x => x.id === assetId)
    const a = e.assets[i]
    const c = a?.construction
    if (!a || !c) return 'پروژه‌ای یافت نشد'
    if (!c.done) return 'ساختمان هنوز تکمیل نشده'
    const left = c.totalUnits - c.presold - c.sold - (c.rented || 0)
    if (!(units >= 1) || units > left) return (c.rented || 0) > 0
      ? `فقط ${Math.max(0, left).toLocaleString('fa-IR')} واحدِ آزاد مانده — ${(c.rented || 0).toLocaleString('fa-IR')} واحد اجاره است (اول اجاره را فسخ کن)`
      : `فقط ${Math.max(0, left).toLocaleString('fa-IR')} واحد باقی مانده`
    if (!(unitPrice > 0)) return 'برای قیمت‌گذاری، نمونهٔ واقعیِ هم‌محله در دسترس نیست'
    const value = Math.round(units * unitPrice)
    const tax = Math.round(value * (Math.max(0, taxPct) / 100))
    proceeds = value - tax
    const costShare = Math.round((a.buyPrice + c.paid) / c.totalUnits) * units
    pnl = proceeds - costShare
    e.capital += proceeds
    e.taxPaid = (e.taxPaid || 0) + tax
    e.realized = (e.realized || 0) + pnl
    if (pnl > 0) { e.stats = e.stats || { sellsProfitable: 0, negoWins: 0 }; e.stats.sellsProfitable += 1; e.xp += config().empire.sellProfitXp }
    c.sold += units
    c.salesRevenue = (c.salesRevenue || 0) + proceeds
    const sign = pnl > 0 ? 'سود' : pnl < 0 ? 'زیان' : 'سربه‌سر'
    e.timeline.push({ at: now, icon: '🔑', title: `فروشِ ${units.toLocaleString('fa-IR')} واحد`, detail: `${sign} ${Math.abs(Math.round(pnl / 1e6)).toLocaleString('fa-IR')}م تومان` })
    if (c.presold + c.sold >= c.totalUnits) {
      completed = true
      // کارنامهٔ پروژه (GDD فصل ۴): درسِ این پروژه از اعدادِ واقعیِ خودش — قبل از حذفِ دارایی ثبت می‌شود.
      e.projectHist = e.projectHist || []
      e.projectHist.push(projectReportOf(a, c, now))
      if (e.projectHist.length > 20) e.projectHist.splice(0, e.projectHist.length - 20)
      e.assets.splice(i, 1)   // پروژه تحویل شد — زمین/بنا دیگر در پرتفوی نیست، سودش تحقق یافته
      if (!e.badges.includes('Project Delivered')) e.badges.push('Project Delivered')
      e.timeline.push({ at: now, icon: '🎉', title: 'تحویلِ کاملِ پروژه', detail: a.title.slice(0, 60) })
      e.journal.push({ at: now, text: 'آخرین کلید تحویل شد. اولین چرخهٔ کاملِ «زمین → ساخت → فروش» بسته شد — حالا یک سازندهٔ واقعی هستی.' })
    }
  })
  if (!r.ok) return { ok: false, reason: r.reason }
  return { ok: true, proceeds, pnl, completed, empire: r.empire }
}

// امکاناتِ میان‌ساخت (GDD فصل ۴ بخش ۴): استخر/روف‌گاردن/… — هزینهٔ واقعیِ الان به بهای تمام‌شده، ارزشِ شفافِ بعداً.
export async function addAmenity(userId: string, assetId: string, key: string, cost: number, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    const c = a?.construction
    if (!a || !c) return 'ساختی در جریان نیست'
    if (c.done) return 'ساختمان تکمیل شده — امکانات فقط حینِ ساخت اضافه می‌شود'
    const am = AMENITY_LABELS[key]
    if (!am) return 'امکاناتِ نامعتبر'
    c.amenities = c.amenities || []
    if (c.amenities.includes(key)) return `${am.label} قبلاً به این پروژه اضافه شده`
    const pay = Math.max(1, Math.round(cost))
    if (e.capital < pay) return 'سرمایهٔ نقدِ کافی نیست'
    e.capital -= pay
    c.paid += pay                       // به بهای تمام‌شدهٔ پروژه (قانون ۶: هیچ پولی گم نمی‌شود)
    c.amenities.push(key)
    e.timeline.push({ at: now, icon: am.icon, title: `افزودنِ ${am.label} به پروژه`, detail: `${Math.round(pay / 1e6).toLocaleString('fa-IR')}م تومان — ارزشِ فروشِ واحدها بالاتر می‌رود` })
  })
}

// «نگه‌دار و اجاره بده» (GDD فصل ۴ بخش ۴): واحدِ تکمیل‌شده به‌جای فروش اجاره می‌رود — درآمد از میانهٔ اجارهٔ «واقعیِ» هم‌محله.
export async function rentOutUnits(userId: string, assetId: string, units: number, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    const c = a?.construction
    if (!a || !c || !c.done) return 'ساختمانِ تکمیل‌شده‌ای نیست'
    const free = c.totalUnits - c.presold - c.sold - (c.rented || 0)
    if (!(units >= 1) || units > free) return `فقط ${Math.max(0, free).toLocaleString('fa-IR')} واحدِ آزاد مانده`
    if (!c.rented) c.rentStartAt = now
    c.rented = (c.rented || 0) + Math.floor(units)
    e.timeline.push({ at: now, icon: '🏠', title: `اجارهٔ ${Math.floor(units).toLocaleString('fa-IR')} واحدِ نوساز`, detail: 'درآمدِ ماهانه از میانهٔ اجارهٔ واقعیِ هم‌محله واریز می‌شود' })
  })
}

// فسخِ اجاره — واحدها دوباره آمادهٔ فروش می‌شوند (تصمیمِ برگشت‌پذیر؛ فروش تصمیمِ برگشت‌ناپذیر است).
export async function stopRentUnits(userId: string, assetId: string, units: number, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    const c = a?.construction
    if (!a || !c || !(c.rented && c.rented > 0)) return 'واحدِ اجاره‌ای در این پروژه نیست'
    const n = Math.min(Math.floor(units), c.rented)
    if (!(n >= 1)) return 'تعدادِ نامعتبر'
    c.rented -= n
    if (!c.rented) c.rentStartAt = undefined
    e.timeline.push({ at: now, icon: '🔓', title: `فسخِ اجارهٔ ${n.toLocaleString('fa-IR')} واحد`, detail: 'این واحدها دوباره آمادهٔ فروش‌اند' })
  })
}

// ظرفیتِ پروژهٔ همزمانِ شرکت (سند ۱۵ — فصل ۵ «منابع»: ظرفیت هم یک دارایی است): با سطح رشد می‌کند، شفاف.
export const maxProjectsOf = (level: number, cfg: { projectsBase: number; projectsPerLevels: number }) =>
  Math.max(1, Math.floor(cfg.projectsBase) + Math.floor(Math.max(1, level) / Math.max(1, cfg.projectsPerLevels)))

// فروشِ پروژهٔ نیمه‌کاره (سند ۱۵ — فصل ۵ «پروژهٔ در حالِ ساخت هم دارایی است»): خروج به ٪ شفافی از بهای
// تمام‌شده (زمین + پرداختی‌ها) — تصمیمِ واقعیِ بحرانِ نقدینگی. با پیش‌فروشِ فعال ممنوع (تعهدِ تحویل داری).
export async function sellProject(userId: string, assetId: string, exitPct: number, taxPct: number, now = Date.now()): Promise<{ ok: boolean; reason?: string; proceeds?: number; pnl?: number; empire?: EmpireData }> {
  let proceeds = 0, pnl = 0
  const r = await mutateEmpire(userId, e => {
    const i = e.assets.findIndex(x => x.id === assetId)
    const a = e.assets[i]
    const c = a?.construction
    if (!a || !c) return 'پروژه‌ای در حالِ ساخت نیست'
    if (c.done) return 'ساختمان تکمیل شده — واحدها را جدا بفروش'
    if (c.presold > 0) return 'با پیش‌فروشِ فعال نمی‌توانی از پروژه خارج شوی — تعهدِ تحویل داری'
    const base = a.buyPrice + c.paid
    const value = Math.round(base * Math.max(10, Math.min(100, exitPct)) / 100)
    const tax = Math.round(value * Math.max(0, taxPct) / 100)
    proceeds = value - tax
    pnl = proceeds - base
    e.capital += proceeds
    e.taxPaid = (e.taxPaid || 0) + tax
    e.realized = (e.realized || 0) + pnl
    e.assets.splice(i, 1)   // زمین و کارگاه با هم واگذار می‌شوند
    e.timeline.push({ at: now, icon: '🏳', title: 'خروج از پروژهٔ نیمه‌کاره', detail: `${a.title.slice(0, 45)} · ${Math.abs(Math.round(pnl / 1e6)).toLocaleString('fa-IR')}م تومان ${pnl >= 0 ? 'سود' : 'زیان'}` })
    e.journal.push({ at: now, text: 'از یک پروژه خارج شدی. گاهی بهترین تصمیم، بستنِ به‌موقعِ یک درِ اشتباه است — سرمایه‌ات آزاد شد.' })
  })
  if (!r.ok) return { ok: false, reason: r.reason }
  return { ok: true, proceeds, pnl, empire: r.empire }
}

// پاداشِ Level Up (سند ۱۶ فصل ۶ بخش ۱): رسیدن به سطحِ جدید (از XPِ واقعی) کوین می‌دهد — یک‌بار به‌ازای هر سطح.
// اولین اجرا فقط سطحِ فعلی را ثبت می‌کند (بدونِ پاداشِ گذشته‌نگرِ یکجا برای بازیکن‌های قدیمی).
export async function applyLevelUpReward(userId: string, coinsPerLevel: number, now = Date.now()): Promise<{ ok: boolean; gained?: number; level?: number; empire?: EmpireData }> {
  let gained = 0, level = 0
  const r = await mutateEmpire(userId, e => {
    level = empireLevel(e.xp).level
    if (!e.lastLevel) { e.lastLevel = level; return }   // ثبتِ اولیه — ذخیره می‌شود ولی پاداشی ندارد
    if (level <= e.lastLevel) return 'سطحِ جدیدی نیست'
    gained = (level - e.lastLevel) * Math.max(0, Math.round(coinsPerLevel))
    e.lastLevel = level
    if (gained > 0) {
      e.coins += gained
      e.timeline.push({ at: now, icon: '🎖', title: `رسیدن به سطحِ ${level.toLocaleString('fa-IR')}`, detail: `${gained.toLocaleString('fa-IR')} ملک‌کوین پاداشِ سطح` })
    }
  })
  if (!r.ok) return { ok: false }
  return { ok: true, gained, level, empire: r.empire }
}

// اسنپ‌شاتِ هفتگی (سند ۱۶ بخش ۷): مبنای لیدربوردِ «رشدِ این هفته» — هر بازیکن از نقطهٔ ورودِ خودش
// در همین هفته سنجیده می‌شود، پس بازیکنِ تازه هم شانسِ رقابت دارد (قانونِ صریحِ سند).
export async function setWeekSnap(userId: string, week: number, netWorth: number) {
  return mutateEmpire(userId, e => {
    if (e.weekSnap && e.weekSnap.week >= week) return 'ثبت شده'
    e.weekSnap = { week, netWorth: Math.round(netWorth) }
  })
}

// عنوانِ فعال (سند ۱۶ بخش ۹): فقط از نشان‌های واقعاً کسب‌شده — هویت از رفتار، نه خرید.
export async function setTitle(userId: string, title: string) {
  return mutateEmpire(userId, e => {
    const t = String(title || '').trim()
    if (t && !e.badges.includes(t)) return 'این عنوان را هنوز کسب نکرده‌ای'
    e.title = t || undefined
  })
}

// صدورِ پروانه‌های سررسیدشده — روی هر بازدید سنجیده می‌شود؛ اولین پروانه نشانِ «First Permit» می‌دهد.
export async function progressPermits(userId: string, now = Date.now()): Promise<{ ok: boolean; granted?: number; empire?: EmpireData }> {
  let granted = 0
  const r = await mutateEmpire(userId, e => {
    for (const a of e.assets) {
      if (!a.permit || a.permit.status !== 'pending') continue
      if (now < permitDueAt(a.permit)) continue
      a.permit.status = 'granted'
      a.permit.grantedAt = now
      granted++
      e.timeline.push({ at: now, icon: '📜', title: 'پروانهٔ ساخت صادر شد', detail: a.title.slice(0, 60) })
      if (!e.badges.includes('First Permit')) {
        e.badges.push('First Permit')
        e.journal.push({ at: now, text: 'اولین پروانهٔ ساختِ شرکتت صادر شد — برای این لحظه جنگیدی، نه اینکه فقط یک دکمه بزنی.' })
      }
    }
    if (!granted) return 'پروانهٔ سررسیدشده‌ای نیست'
  })
  if (!r.ok) return { ok: false }
  return { ok: true, granted, empire: r.empire }
}

// ══════════ بازار سرمایه (جلد ۴۰): صندوقِ شاخصی + مشارکتِ جمعی — پول همیشه منبع و مقصد دارد ══════════
// خریدِ واحدِ صندوق: سرمایهٔ نقد → واحد (به قیمتِ روزِ واقعیِ هر «مترِ مجازی» — لایهٔ API محاسبه می‌کند).
export async function buyFundUnits(userId: string, fund: { id: string; name: string }, units: number, unitPrice: number, rewardXp: number, now = Date.now()) {
  return mutateEmpire(userId, e => {
    if (!(units >= 1) || !(unitPrice > 0)) return 'مقدارِ نامعتبر'
    const cost = Math.round(units * unitPrice)
    if (e.capital < cost) return 'سرمایهٔ نقدِ کافی نیست'
    e.capital -= cost
    e.funds = e.funds || []
    const h = e.funds.find(x => x.fundId === fund.id)
    if (h) { h.units += units; h.cost += cost; h.name = fund.name }
    else e.funds.push({ fundId: fund.id, name: fund.name.slice(0, 60), units, cost, boughtAt: now, lastDivAt: now })
    e.xp += Math.max(0, rewardXp)
    e.timeline.push({ at: now, icon: '📊', title: `سرمایه‌گذاری در «${fund.name.slice(0, 40)}»`, detail: `${units.toLocaleString('fa-IR')} واحد (مترِ مجازی) · ${Math.round(cost / 1e6).toLocaleString('fa-IR')}م تومان` })
  })
}

// بازخریدِ واحدِ صندوق (بازارِ ثانویه — فصل ۱۱): به ارزشِ روز؛ کارمزدِ مدیریت کسر و به خزانه می‌رود.
export async function sellFundUnits(userId: string, fundId: string, units: number, unitPrice: number, fee: number, now = Date.now()): Promise<{ ok: boolean; reason?: string; proceeds?: number; pnl?: number; empire?: EmpireData }> {
  let proceeds = 0, pnl = 0
  const r = await mutateEmpire(userId, e => {
    const h = (e.funds || []).find(x => x.fundId === fundId)
    if (!h) return 'واحدی از این صندوق نداری'
    if (!(units >= 1) || units > h.units) return `حداکثر ${h.units.toLocaleString('fa-IR')} واحد داری`
    if (!(unitPrice > 0)) return 'قیمتِ روزِ این صندوق فعلاً در دسترس نیست'
    const value = Math.round(units * unitPrice)
    const f = Math.max(0, Math.min(Math.round(fee), value))
    proceeds = value - f
    const costShare = Math.round(h.cost * units / h.units)
    pnl = proceeds - costShare
    e.capital += proceeds
    e.taxPaid = (e.taxPaid || 0) + f                       // کارمزد → خزانه (قانون ۶: هیچ پولی گم نمی‌شود)
    e.realized = (e.realized || 0) + pnl
    h.units -= units; h.cost -= costShare
    if (h.units <= 0) e.funds = (e.funds || []).filter(x => x.fundId !== fundId)
    const sign = pnl > 0 ? 'سود' : pnl < 0 ? 'زیان' : 'سربه‌سر'
    e.timeline.push({ at: now, icon: '💹', title: `بازخریدِ ${units.toLocaleString('fa-IR')} واحدِ «${h.name.slice(0, 40)}»`, detail: `${sign} ${Math.abs(Math.round(pnl / 1e6)).toLocaleString('fa-IR')}م تومان` })
  })
  if (!r.ok) return { ok: false, reason: r.reason }
  return { ok: true, proceeds, pnl, empire: r.empire }
}

// سودِ دوره‌ایِ صندوق (فصل ۱۵): هر واحد = یک مترِ مجازی → سودِ ماهانه = میانهٔ اجارهٔ واقعیِ هر متر (لایهٔ API).
export async function accrueFundDividends(userId: string, accruals: Array<{ fundId: string; amount: number }>, now = Date.now()) {
  return mutateEmpire(userId, e => {
    let total = 0
    for (const { fundId, amount } of accruals) {
      if (!(amount > 0)) continue
      const h = (e.funds || []).find(x => x.fundId === fundId)
      if (!h) continue
      h.lastDivAt = now
      total += Math.round(amount)
    }
    if (total > 0) {
      e.capital += total
      e.timeline.push({ at: now, icon: '💵', title: 'سودِ دوره‌ایِ صندوق‌ها', detail: `${Math.round(total / 1e6).toLocaleString('fa-IR')}م تومان — از اجاره‌بهای واقعیِ بازار` })
    }
  })
}

// پیوستن به مشارکتِ جمعی (فصل ۷): سهمِ کسری از یک آگهیِ واقعیِ گران؛ مالیاتِ انتقال → خزانه.
export async function joinCrowd(userId: string, pool: { listingId: string; title: string; hood: string }, units: number, unitToman: number, taxPct: number, now = Date.now()) {
  return mutateEmpire(userId, e => {
    if (!(units >= 1) || !(unitToman > 0)) return 'مقدارِ نامعتبر'
    const cost = Math.round(units * unitToman)
    const tax = Math.round(cost * (Math.max(0, taxPct) / 100))
    if (e.capital < cost + tax) return tax > 0 ? 'سرمایه کافی نیست (سهم + مالیاتِ انتقال)' : 'سرمایهٔ نقدِ کافی نیست'
    e.capital -= cost + tax
    e.taxPaid = (e.taxPaid || 0) + tax
    e.crowd = e.crowd || []
    const h = e.crowd.find(x => x.listingId === pool.listingId)
    if (h) { h.units += units; h.cost += cost }
    else e.crowd.push({ listingId: pool.listingId, title: pool.title.slice(0, 120), hood: pool.hood.slice(0, 60), units, cost, boughtAt: now })
    e.timeline.push({ at: now, icon: '🤝', title: 'سرمایه‌گذاریِ جمعی', detail: `${units.toLocaleString('fa-IR')} واحد از «${pool.title.slice(0, 50)}»` })
  })
}

// خروج از مشارکت: به ارزشِ روزِ سهم (قیمتِ زندهٔ آگهی ÷ کلِ واحدها)؛ مالیاتِ انتقال → خزانه.
export async function exitCrowd(userId: string, listingId: string, units: number, unitValueNow: number, taxPct: number, now = Date.now()): Promise<{ ok: boolean; reason?: string; proceeds?: number; pnl?: number; empire?: EmpireData }> {
  let proceeds = 0, pnl = 0
  const r = await mutateEmpire(userId, e => {
    const h = (e.crowd || []).find(x => x.listingId === listingId)
    if (!h) return 'سهمی در این مشارکت نداری'
    if (!(units >= 1) || units > h.units) return `حداکثر ${h.units.toLocaleString('fa-IR')} واحد داری`
    const value = Math.round(units * Math.max(0, unitValueNow))
    const tax = Math.round(value * (Math.max(0, taxPct) / 100))
    proceeds = value - tax
    const costShare = Math.round(h.cost * units / h.units)
    pnl = proceeds - costShare
    e.capital += proceeds
    e.taxPaid = (e.taxPaid || 0) + tax
    e.realized = (e.realized || 0) + pnl
    h.units -= units; h.cost -= costShare
    if (h.units <= 0) e.crowd = (e.crowd || []).filter(x => x.listingId !== listingId)
    const sign = pnl > 0 ? 'سود' : pnl < 0 ? 'زیان' : 'سربه‌سر'
    e.timeline.push({ at: now, icon: '💸', title: `خروج از مشارکتِ «${h.title.slice(0, 40)}»`, detail: `${sign} ${Math.abs(Math.round(pnl / 1e6)).toLocaleString('fa-IR')}م تومان` })
  })
  if (!r.ok) return { ok: false, reason: r.reason }
  return { ok: true, proceeds, pnl, empire: r.empire }
}

// همهٔ امپراتوری‌ها برای جدول‌های رتبه (فصل ۵: ۵ لیدربرد) — نمایشِ عمومی فقط نام/نشان، بدونِ شماره‌تلفن.
export async function listEmpiresPublic(limit = 300): Promise<EmpireData[]> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT data FROM reos_empire ORDER BY at DESC LIMIT $1`, [limit])); return r.rows.map(x => x.data as EmpireData) }
  return Object.values(fileLoad()).slice(0, limit)
}

// ══════════ عملیاتِ سوپرادمین — Empire Control Center (GDD جلد ۹) ══════════
// تنظیمِ دستیِ منابعِ یک بازیکن (جبرانِ خطا/جایزهٔ رویداد) — اتمیک + ثبت در تایم‌لاینِ خودِ بازیکن (شفاف).
export async function adminAdjustEmpire(userId: string, patch: { coins?: number; xp?: number; capital?: number; aiTokens?: number }, reason = '', now = Date.now()) {
  return mutateEmpire(userId, e => {
    const parts: string[] = []
    if (patch.coins) { e.coins = Math.max(0, e.coins + Math.round(patch.coins)); parts.push(`${patch.coins > 0 ? '+' : ''}${Math.round(patch.coins)} کوین`) }
    if (patch.xp) { e.xp = Math.max(0, e.xp + Math.round(patch.xp)); parts.push(`${patch.xp > 0 ? '+' : ''}${Math.round(patch.xp)} XP`) }
    if (patch.capital) { e.capital = Math.max(0, e.capital + Math.round(patch.capital)); parts.push(`${patch.capital > 0 ? '+' : ''}${Math.round(patch.capital / 1e6)}م سرمایه`) }
    if (patch.aiTokens) { e.aiTokens = Math.max(0, e.aiTokens + Math.round(patch.aiTokens)); parts.push(`${patch.aiTokens > 0 ? '+' : ''}${Math.round(patch.aiTokens)} ژتون`) }
    if (!parts.length) return 'تغییری داده نشد'
    e.timeline.push({ at: now, icon: '🎁', title: 'هدیهٔ ملک‌جت', detail: reason ? `${parts.join('، ')} — ${reason.slice(0, 60)}` : parts.join('، ') })
  })
}

// حذفِ کاملِ یک امپراتوری (فقط سوپرادمین — برگشت‌ناپذیر).
export async function deleteEmpire(userId: string): Promise<boolean> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`DELETE FROM reos_empire WHERE user_id=$1`, [userId])); return (r.rowCount || 0) > 0 }
  const db = fileLoad()
  if (!db[userId]) return false
  delete db[userId]; fileSave(db)
  return true
}

// آمارِ نامه‌های یک روز (LiveOps: چند نامه ساخته/باز شده) — نرخِ بازشدنِ واقعی.
export async function briefStatsForDay(day: number): Promise<{ built: number; opened: number }> {
  if (pgEnabled()) {
    await ensureBrief()
    const r = await pgTx(c => c.query(`SELECT count(*)::int AS built, count(*) FILTER (WHERE data ? 'openedAt')::int AS opened FROM reos_daily_brief WHERE day=$1`, [day]))
    return { built: r.rows[0]?.built || 0, opened: r.rows[0]?.opened || 0 }
  }
  const rows = Object.values(briefLoad()).filter(b => b.day === day)
  return { built: rows.length, opened: rows.filter(b => b.openedAt).length }
}

// ارزشِ خالص (Real Asset Value، §6.2-3): نقد + ارزشِ روزِ دارایی‌ها + صندوق/مشارکت − بدهیِ بانکی (جلد ۱۶).
// market (جلد ۴۰): fundUnit = قیمتِ روزِ هر واحدِ صندوق؛ crowdUnit = ارزشِ روزِ هر واحدِ مشارکت (اختیاری — بدونِ آن مبنای هزینه).
export function netWorthOf(e: EmpireData, livePrices: Record<string, number>, market?: { fundUnit?: Record<string, number>; crowdUnit?: Record<string, number> }): { netWorth: number; assetsValue: number; growth: number; marketValue: number } {
  let assetsValue = 0, cost = 0
  for (const a of e.assets) {
    cost += a.buyPrice
    // پروژهٔ در ساخت/تکمیل‌شده (جلد ۶۴+): ارزش = بهای تمام‌شده × کسرِ واحدهای نفروخته (محافظه‌کارانه و واقعی).
    if (a.construction) {
      const c = a.construction
      const frac = Math.max(0, (c.totalUnits - c.presold - c.sold) / Math.max(1, c.totalUnits))
      assetsValue += Math.round((a.buyPrice + c.paid) * frac)
      continue
    }
    assetsValue += livePrices[a.listingId] || a.buyPrice
  }
  let marketValue = 0
  for (const h of e.funds || []) { const u = market?.fundUnit?.[h.fundId]; marketValue += u && u > 0 ? Math.round(h.units * u) : h.cost }
  for (const h of e.crowd || []) { const u = market?.crowdUnit?.[h.listingId]; marketValue += u && u > 0 ? Math.round(h.units * u) : h.cost }
  const growth = cost ? Math.round(((assetsValue - cost) / cost) * 1000) / 10 : 0
  return { netWorth: e.capital + assetsValue + marketValue - (e.loan?.balance || 0), assetsValue, growth, marketValue }
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
