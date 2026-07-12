// Empire · هستهٔ «امپراتوری» (سندِ Empire Bible، جلد۲ فصل ۱–۶) — مسیرِ رشدِ کاربرِ عادی.
// قانونِ ۲ سند: هیچ دادهٔ جعلی — دارایی‌ها آگهی‌های واقعیِ سایت‌اند و ارزششان زنده محاسبه می‌شود.
// چهار نوع ارزش (فصل ۶): XP (غیرقابل‌خرید)، Melk Coin (ارزِ داخلی)، Real Asset (تومان)، Reputation (از REOS trust).
// ذخیره dual-mode: PG (جدولِ reos_empire، هر کاربر یک ردیف) یا فایلِ ‎.empire-data.json‎.
import { pgEnabled, pgTx, kvGet, kvSet } from './db'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes, createHash } from 'crypto'
import { config } from './reos/reos-config'
import { appendWorldEvent, govDecreeOf } from './empire-world'   // فاز ۶۳/۷۰: کتابِ تاریخِ دنیا + مصوبهٔ هفته

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
  lat?: number; lng?: number  // فاز ۷۳: مختصاتِ آگهی در لحظهٔ خرید — تا اگر آگهی از بازار رفت، پینِ نقشه نمیرد
  action?: AssetAction        // تصمیمِ معنادارِ بعد از خرید (بازسازی/اجاره/نگه‌داشتن)
  actionAt?: number
  landPlan?: LandPlan         // سیستمِ زمین (§6.7): فروشِ فوری / ساخت / مشارکت
  // پروانهٔ ساخت (جلد ۶۳): درخواست → بررسی (مهلتِ قطعی از هش) → اعتراضِ احتمالی → صدور. عوارض → خزانه.
  permit?: { requestedAt: number; days: number; fee: number; status: 'pending' | 'granted'; grantedAt?: number; objection?: { text: string; extraDays: number; settleCost: number; settled?: boolean; defended?: boolean } }
  // موتورِ ساخت (جلد ۶۴–۷۲): هزینهٔ روزشمار (بی‌پولی = توقف — جلد ۷۱)، رویدادهای قطعی، پیش‌فروش، فروشِ واحدها.
  construction?: Construction
  business?: string           // لایهٔ کسب‌وکارِ تجاری (§6.9): کافه/فروشگاه/…
  businessProb?: number       // ٪ موفقیت — از دادهٔ واقعی (رقابت + استقبالِ محله)
  income?: number             // درآمدِ جمع‌شدهٔ اجاره/کسب‌وکار (برآورد از بازارِ واقعی)
  lastAccrualAt?: number
  // تجمیع و تخریب (فاز ۲۵): ساختمانِ آپارتمان/تجاری واحدبه‌واحد خریده می‌شود؛ تخریب فقط با مالکیتِ کامل.
  unitsTotal?: number         // کلِ واحدهای ساختمان — از متای واقعیِ آگهی («طبقه: X از Y») یا قطعی از هش
  unitsOwned?: number         // چند واحدش مالِ توست (خریدِ اولیه = ۱)؛ ارزش/فروش × همین ضریب
  demolishedAt?: number       // تخریب‌شده → kind به 'land' برمی‌گردد؛ ارزش تا ساخت = بهای تمام‌شده
  landAreaOverride?: number   // مساحتِ زمینِ برآوردی بعد از تخریب — مبنای نقشهٔ ساخت به‌جای متراژِ واحدِ آگهی
  // طراحیِ معمار (فاز ۲۹): پیش از پروانه — طبقات/واحد در طبقه با تراکمِ قانونی؛ طبقهٔ مازاد = تخلفِ آگاهانه.
  // landArea داخلِ خودِ نقشه ذخیره می‌شود تا ساخت به زنده‌بودنِ آگهیِ واقعی وابسته نماند (آگهی‌ها می‌چرخند).
  design?: { floors: number; unitsPerFloor: number; legalFloors: number; footprint: number; unitArea: number; illegalFloors: number; architectFee: number; startedAt: number; readyAt: number; architect: string; landArea?: number }
  // کمیسیونِ ماده۱۰۰ (فاز ۲۹): بعد از تکمیلِ ساختمانِ متخلف — جریمه/وکیل/تخریبِ طبقهٔ مازاد.
  m100?: { illegalArea: number; illegalUnits: number; fine: number; status: 'pending' | 'paid' | 'demolished'; lawyerTried?: boolean }
  renovBoostPct?: number      // بازسازی (فاز ۲۹): ارزش‌افزودهٔ جمع‌شده (٪، با سقفِ knob)
  renovDone?: string[]        // کدام گزینه‌های بازسازی انجام شده (هر کدام یک‌بار)
  // فاز ۳۷ — بازارِ بازیکنان و مشارکتِ ساخت:
  city?: string               // فاز ۶۸ (چندشهری v1): شهرِ واقعیِ آگهی — از location؛ دارایی‌های قدیمی ندارند (صادقانه شمرده نمی‌شوند)
  forSale?: number            // قیمتِ عرضه به بازیکنانِ دیگر (۰/undefined = عرضه نشده)
  p2pAuction?: { minBid: number; endDay: number; startedDay: number; bids: Array<{ userId: string; no: number; name: string; amount: number; at: number }> }   // فاز ۶۴: مزایدهٔ بینِ بازیکنانِ واقعی
  nickname?: string           // قانونِ ۱۳ (رویاپردازی): نامِ دلخواهِ بازیکن روی دارایی — صرفاً هویتی، صفر اثرِ اقتصادی
  jvOffer?: { pct: number; amount: number }   // پیشنهادِ بازِ مشارکتِ ساخت: سهمِ ٪ در برابرِ آوردهٔ نقدی
  partners?: Array<{ userId: string; no: number; name: string; pct: number; paid: number; at: number }>   // شرکای پروژه — سهمشان از عایدیِ فروش خودکار تسویه می‌شود
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
  name?: string                // قانونِ رویاپردازی (قانون ۱۳): نامی که بازیکن روی پروژه‌اش می‌گذارد — صرفاً هویتی، صفر اثرِ اقتصادی
  facade?: string              // سبکِ نمای انتخابی (BUILD_FACADES) — ظاهری/رویایی، صفر اثرِ اقتصادی
  days: number                 // کلِ روزهای ساخت (رویدادِ «صبر» اضافه‌اش می‌کند)
  days0?: number               // روزهای برنامهٔ اولیه — برای «تحلیلِ پس از پروژه» (GDD فصل ۴)
  goal?: string                // هدفِ پروژه (GDD فصل ۴ بخش ۸): fast / profit / rep — روی قیمت و پیش‌فروش اثرِ شفاف دارد
  structure: string; quality: string; qualityFactor: number
  builtArea: number; unitArea: number; totalUnits: number
  costTotal: number; paid: number; paidDays: number; lastPayAt: number
  presold: number; sold: number; presaleRevenue: number
  illegalUnits?: number        // واحدهای طبقاتِ مازادِ طراحی (فاز ۲۹) — تا حلِ ماده۱۰۰ قابلِ‌فروش/پیش‌فروش نیستند
  salesRevenue?: number        // عایدیِ فروشِ واحدها بعد از تکمیل (بعد از مالیات) — خوراکِ کارنامهٔ پروژه
  amenities?: string[]         // امکاناتِ میان‌ساخت (GDD فصل ۴ بخش ۴): استخر/روف‌گاردن/… — هزینهٔ واقعی، ارزشِ شفاف
  rented?: number              // واحدهای اجاره‌داده‌شده بعد از تکمیل («نگه‌دار و اجاره بده») — درآمد از میانهٔ واقعیِ محله
  rentStartAt?: number
  eventsFired: number
  pendingEvent?: { text: string; payCost: number; extraDays: number; at: number }
  insured?: boolean           // فاز ۷۰: بیمهٔ کارگاه — هزینهٔ رویدادها coveragePct٪ کمتر
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
  demolitionPaid?: number     // هزینهٔ تخریب‌های پرداختی (فاز ۲۵ — مصرفِ شفافِ پول، مثلِ حقوق)
  servicesPaid?: number       // کارمزدِ نقش‌های حرفه‌ای: دفترخانه/مشاور/معمار/وکیل/کارشناس (فاز ۲۹ — مصرفِ شفاف)
  insurancePaid?: number      // فاز ۷۰: حقِ بیمهٔ کارگاه‌های پرداختی (مصرفِ شفافِ پول — قانون ۶)
  stats?: { sellsProfitable: number; negoWins: number; negoTries?: number; projectsDelivered?: number; repProjects?: number; crisisRecovered?: number; auctionWins?: number; auctionTries?: number }   // شمارنده‌های واقعیِ رفتار (جلد ۲۶/۷۲؛ crisisRecovered: فاز ۴۱؛ auction*: فاز ۴۵)
  crisis?: { at: number }     // فاز ۴۱ (سند ۲۸ Part 13): در وضعیتِ بحرانی است — ورود/خروجش در تایم‌لاین ثبت می‌شود
  bigDealWin?: { week: number; discountPct: number }   // فاز ۴۱ (Part 07): تخفیفِ بردهٔ مذاکرهٔ بزرگِ همین هفته — سمتِ سرور، ضدِ دستکاری
  // فاز ۴۵ (سند ۲۹ — Auction Saga): وضعیتِ زندهٔ تالارِ مزایدهٔ هفته — کاملاً سمتِ سرور، هر حرکت قطعی از هش.
  auctionRun?: AuctionRun
  auctionWin?: { week: number; listingId: string; price: number }   // برندهٔ چکش — تا خرید (یا آخرِ هفته) معتبر؛ ضدِ دستکاری
  rivalScore?: Record<string, number>   // حافظهٔ رقبا (سند ۲۹ Part 5): چند بار از جلوی هر رقیب ملک را برده‌ای → انتقام
  projectHist?: ProjectReport[]   // کارنامهٔ پروژه‌های تحویل‌شده (GDD فصل ۴) — درسِ هر پروژه از اعدادِ واقعیِ خودش
  snap?: { day: number; netWorth: number; prev: number }   // اسنپ‌شاتِ روزانه — «سود/زیانِ دیروز» (جلد ۲۶)
  weekSnap?: { week: number; netWorth: number }   // اسنپ‌شاتِ هفتگی — لیدربوردِ «رشدِ این هفته» (سند ۱۶: شانسِ بازیکنِ جدید)
  lastLevel?: number          // آخرین سطحِ پاداش‌گرفته — پاداشِ Level Up (سند ۱۶ فصل ۶ بخش ۱)
  title?: string              // عنوانِ (Title) فعال — فقط از نشان‌های واقعاً کسب‌شده (سند ۱۶ بخش ۹)
  kudos?: number              // 👏 تحسینِ بازیکنانِ واقعی (سند ۱۷ — تعاملِ اجتماعی)؛ هر بازیکن یک‌بار
  dreamsCustom?: Array<{ id: string; label: string; metric: string; target: number; createdAt: number; doneAt?: number }>   // فاز ۶۲ (فصل ۲۰ Part 7): رؤیاهای شخصیِ خودِ بازیکن — هدفِ عددی روی متریکِ واقعی
  seasonSnap?: { id: string; day: number; netWorth: number; projects: number; auctionWins: number; income: number }   // فاز ۶۶ (Season v1): بیس‌لاینِ ورود به فصل — پیشرفتِ فصل = دلتای واقعی از همین نقطه
  following?: number[]        // فاز ۶۷ (World Feed تعاملی): شماره‌های امپراتوری/شرکت‌هایی که دنبال می‌کند — خبرشان در فید هایلایت می‌شود
  pendingComeback?: number    // هدیهٔ بازگشت (Comeback Engine جلد ۲۶) — روزِ کشفِ غیبت
  stylePicks?: string[]                               // مأموریت M2 «سبکِ خودت را پیدا کن» (انتخابِ تصویری)
  hunter?: { a: string; b: string; better: string; at: number }   // جفتِ فعالِ Property Hunter (§6.4)
  cosmetics?: { owned: string[]; frame?: string; flair?: string }   // فروشگاهِ ظاهری (فاز ۳۳ — سند ۲۲ فصل ۳): فقط نمایش، صفر اثرِ اقتصادی
  offerHist?: Record<string, number>                  // پیشنهادِ بسته‌شده → روزِ بستن (فاز ۳۳ — سند ۲۲ فصل ۹: «عدمِ نمایشِ مجددِ همان پیشنهاد»)
  // فاز ۴۰ (سند ۲۷ Part 13 — مرکزِ خودکارسازی): قوانینِ قابل‌تعریفِ خودِ بازیکن — فقط اطلاع/پیشنهاد، هرگز اجرا.
  autoRules?: Array<{ id: string; kind: string; threshold: number; level: 'notify' | 'recommend'; enabled: boolean; createdAt: number }>
  ruleLog?: Array<{ at: number; icon: string; text: string }>   // ثبتِ فعال‌شدن‌ها (Part 13 «Log») — هر قانون حداکثر یک‌بار در روز
  claims: Record<string, number>                      // پاداش‌های یک‌بارمصرفِ دریافت‌شده (missionKey → ts)
  // فاز ۱۰۳ (جلد ۳ — Prestige): بازتولدِ داوطلبانه با امتیازِ مهارتِ دائمی؛ claims/کوین/میراث حفظ می‌شود
  prestige?: { count: number; points: number; spent: Record<string, number>; at?: number }
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

// ── فاز ۱۰۱ (NPC v2) ──────────────────────────────────────────────────────────
// جایزهٔ بردِ جنگِ شرکتی: فقط XP و ثبتِ تایم‌لاین — هیچ پولی جابه‌جا نمی‌شود (بدونِ P2W).
export async function grantWarReward(userId: string, xp: number, title: string, detail: string, now = Date.now()) {
  return mutateEmpire(userId, e => {
    e.xp += Math.max(0, Math.round(xp))
    e.timeline.push({ at: now, icon: '⚔️', title: title.slice(0, 80), detail: detail.slice(0, 120) })
  })
}

// فاز ۱۰۲ (لایهٔ اجتماعی): جابه‌جاییِ شفافِ سرمایهٔ نقد (واریز/دریافتِ خزانه، کنسرسیوم، تقسیمِ فروش)
// — کسر فقط با موجودیِ کافی؛ همیشه با ردِ تایم‌لاین.
export async function moveCapital(userId: string, delta: number, icon: string, title: string, now = Date.now()) {
  const d = Math.round(delta)
  return mutateEmpire(userId, e => {
    if (d < 0 && e.capital < -d) return 'سرمایهٔ نقدِ کافی نیست'
    e.capital += d
    e.timeline.push({ at: now, icon, title: title.slice(0, 90), detail: `${d > 0 ? '+' : '−'}${Math.abs(d).toLocaleString('fa-IR')} تومان` })
  })
}

// فاز ۱۰۷ (فروشگاهِ سازندگان): واریزِ شفافِ کوین (سهمِ سازنده از فروشِ طرحش) — همیشه با ردِ تایم‌لاین.
export async function grantCoins(userId: string, coins: number, title: string, now = Date.now()) {
  const c = Math.max(0, Math.round(coins))
  if (!c) return { ok: true as const }
  return mutateEmpire(userId, e => {
    e.coins += c
    e.timeline.push({ at: now, icon: '🎨', title: title.slice(0, 90), detail: `+${c.toLocaleString('fa-IR')} ملک‌کوین` })
  })
}

// ── فاز ۱۰۳ (جلد ۳): Prestige + درختِ مهارت ─────────────────────────────────
// بازتولد: XP و سرمایه و دارایی‌ها صفر می‌شوند؛ کوین (پولِ پرداختی)، claims (پاداش‌های
// یک‌بارمصرف — جلوی دوباره‌گیریِ جایزهٔ واقعی)، میراث و تایم‌لاین می‌مانند. هر بازتولد
// امتیازِ مهارتِ «دائمی» می‌دهد که در سه شاخه خرج می‌شود — اثرها کوچک و شفاف‌اند (بدونِ P2W).
export const SKILL_BRANCHES = [
  { id: 'nego', icon: '🤝', name: 'استادِ مذاکره', effectFa: (v: number) => `+${v} واحد شانسِ مذاکره` },
  { id: 'build', icon: '🏗', name: 'مهندسِ ارشد', effectFa: (v: number) => `−${v}٪ هزینهٔ ساخت` },
  { id: 'market', icon: '📈', name: 'نبضِ بازار', effectFa: (v: number) => `+${v}٪ درآمدِ اجاره/کسب‌وکار` },
] as const

export function prestigeEffectsOf(pr: EmpireData['prestige'], cfg = config().empire.prestige) {
  const sp = pr?.spent || {}
  return {
    negoPp: (sp.nego || 0) * cfg.negoPpPerPoint,
    buildCostPct: Math.min(30, (sp.build || 0) * cfg.buildCostPctPerPoint),
    marketIncomePct: (sp.market || 0) * cfg.marketIncomePctPerPoint,
  }
}

export async function doPrestige(userId: string, now = Date.now()) {
  const cfg = config().empire.prestige
  let released: string[] = []
  const r = await mutateEmpire(userId, e => {
    if (!cfg.enabled) return 'بازتولد فعلاً فعال نیست'
    if (empireLevel(e.xp).level < cfg.minLevel) return `بازتولد از سطحِ ${cfg.minLevel.toLocaleString('fa-IR')} باز می‌شود`
    if (e.assets.some(a => a.construction && !a.construction.done)) return 'اول کارگاه‌های فعال را تحویل بده'
    if ((e.loan?.balance || 0) > 0) return 'اول بدهیِ بانک را تسویه کن'
    released = e.assets.map(a => a.listingId)
    e.assets = []
    e.xp = 0
    e.capital = config().empire.giftToman
    e.prestige = {
      count: (e.prestige?.count || 0) + 1,
      points: (e.prestige?.points || 0) + Math.max(1, cfg.pointsPerPrestige),
      spent: e.prestige?.spent || {},
      at: now,
    }
    e.timeline.push({ at: now, icon: '🌌', title: `بازتولدِ ${e.prestige.count.toLocaleString('fa-IR')} — امپراتوری از نو، مهارت‌ها ماندگار`, detail: `+${cfg.pointsPerPrestige.toLocaleString('fa-IR')} امتیازِ مهارت` })
  })
  return { ...r, released }
}

export async function spendSkillPoint(userId: string, branch: string, now = Date.now()) {
  const cfg = config().empire.prestige
  if (!SKILL_BRANCHES.some(b => b.id === branch)) return { ok: false as const, reason: 'شاخهٔ نامعتبر' }
  return mutateEmpire(userId, e => {
    const pr = e.prestige
    if (!pr || pr.points <= 0) return 'امتیازِ مهارتی نداری — با بازتولد به‌دست می‌آید'
    if ((pr.spent[branch] || 0) >= cfg.maxPerBranch) return 'این شاخه به سقف رسیده'
    pr.points -= 1
    pr.spent[branch] = (pr.spent[branch] || 0) + 1
    const b = SKILL_BRANCHES.find(x => x.id === branch)!
    e.timeline.push({ at: now, icon: b.icon, title: `مهارتِ «${b.name}» ارتقا گرفت`, detail: b.effectFa(prestigeEffectsOf(pr, cfg)[branch === 'nego' ? 'negoPp' : branch === 'build' ? 'buildCostPct' : 'marketIncomePct'] as number) })
  })
}

// تصاحبِ خصمانهٔ شرکتِ NPC: پرداختِ ارزش‌گذاریِ شفاف از سرمایهٔ نقد، دریافتِ همهٔ املاکِ شرکت
// به قیمتِ روزِ واقعیِ هرکدام (پایهٔ سود/زیانِ آینده). بقای پول: پرداختی سرمایهٔ شرکتِ بازگشته می‌شود.
export async function absorbNpcAssets(userId: string, valuation: number, assets: Array<{ listingId: string; title: string; hood: string; cost: number }>, npcName: string, now = Date.now()) {
  return mutateEmpire(userId, e => {
    if (e.capital < valuation) return 'سرمایهٔ نقدِ کافی برای تصاحب نیست'
    e.capital -= Math.max(0, Math.round(valuation))
    for (const a of assets) {
      e.assets.push({ id: 'ast_' + randomBytes(5).toString('hex'), listingId: a.listingId, title: String(a.title).slice(0, 120), hood: String(a.hood || '').slice(0, 60), kind: 'apartment', buyPrice: Math.max(0, a.cost), boughtAt: now })
    }
    e.timeline.push({ at: now, icon: '🏳️', title: `شرکتِ «${npcName}» را تصاحب کردی`, detail: `${assets.length.toLocaleString('fa-IR')} ملک به پرتفویت اضافه شد` })
  })
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
  // فاز ۷۰ (دولتِ زنده): مصوبهٔ هفته روی نرخِ وام — همان عددی که بازیکن می‌بیند، همان هم اجرا می‌شود
  rate = Math.max(0.5, rate + govDecreeOf(Math.floor(dayNumberOf(Date.now()) / 7)).loanDelta)
  return { maxLoan, ratePctYear: Math.round(rate * 10) / 10, termDays: cfg.termDays, eligible: cfg.enabled && maxLoan > 0, repCutPct: repCutPct > 0 ? repCutPct : undefined }
}

// مذاکره (GDD جلد۱، مرحلهٔ ۵ «تولد یک امپراتور») — قطعی از هش تا قابلِ‌سوءاستفاده نباشد:
// شانسِ موفقیت با مهارتِ مذاکره بالا می‌رود؛ تخفیف ۲ تا ۶٪. همان کاربر/آگهی همیشه همان نتیجه.
export function negotiationOutcome(userId: string, listingId: string, negotiationSkill: number, cfg?: { baseChancePct: number; discountMin: number; discountMax: number }): { success: boolean; discountPct: number } {
  const c = cfg || config().empire.nego || { baseChancePct: 25, discountMin: 2, discountMax: 6 }
  const h = createHash('sha1').update(userId + '|nego|' + listingId).digest()
  const roll = h.readUInt32BE(0) % 100
  const chance = c.baseChancePct + Math.round(Math.max(0, Math.min(100, negotiationSkill)) / 2)   // پایه + مهارت/۲
  if (roll >= chance) return { success: false, discountPct: 0 }
  const span = Math.max(1, c.discountMax - c.discountMin + 1)
  return { success: true, discountPct: c.discountMin + (h.readUInt32BE(4) % span) }
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
// فاز ۷۴: هر مأموریتِ مخفی یک «سرنخِ معمایی» دارد — جهت را نشان می‌دهد، نام/شرط/عدد را لو نمی‌دهد
// (جلد ۲۶: «بازی همه مأموریت‌ها را نشان نمی‌دهد» + قانونِ ۱۴: کشف باید لذت بسازد، نه بن‌بست).
export const HIDDEN_BADGES: Array<{ key: string; fa: string; hint: string; earned: (e: EmpireData) => boolean }> = [
  { key: 'Elite Seller', fa: 'فروشندهٔ نخبه — ۳ فروشِ سودده', hint: 'فروختن هم هنر است — آن‌که چند بار با سود از میز بلند شود، شهر حسابِ کارَش را می‌کند.', earned: e => (e.stats?.sellsProfitable || 0) >= 3 },
  { key: 'Master Negotiator', fa: 'استادِ مذاکره — ۳ خریدِ با تخفیف', hint: 'کسی که سرِ میزِ مذاکره کوتاه نمی‌آید و باز هم برمی‌گردد، بالاخره اسمش سرِ زبان‌ها می‌افتد.', earned: e => (e.stats?.negoWins || 0) >= 3 },
  { key: 'Collector', fa: 'کلکسیونر — مالکِ هر ۴ نوع دارایی', hint: 'بعضی‌ها به یک نوع ملک قانع نیستند — از خاکِ خالی تا ویترینِ مغازه.', earned: e => new Set(e.assets.map(a => a.kind)).size >= 4 },
  { key: 'Landlord', fa: 'مالکِ درآمدساز — ۱۰۰ میلیون درآمدِ اجاره', hint: 'صاحب‌خانه‌ای که ماه‌به‌ماه دستش پر می‌شود، بی‌سروصدا ثروتمند می‌شود.', earned: e => e.assets.reduce((s, a) => s + (a.income || 0), 0) >= 100_000_000 },
  { key: 'Trusted Borrower', fa: 'خوش‌حسابِ افسانه‌ای — ۲ تسویه بدونِ دیرکرد', hint: 'بانک به کسی که همیشه سرِ وقت برمی‌گردد، جورِ دیگری نگاه می‌کند.', earned: e => (e.creditHist?.repaid || 0) >= 2 && (e.creditHist?.lateDays || 0) === 0 },
  // فاز ۴۱ (سند ۲۸ Part 13 — پیشنهادِ «Phoenix» خودِ سند): عبور از بحران بخشی از هویتِ امپراتوری می‌شود.
  { key: 'Phoenix', fa: 'ققنوس — از یک بحرانِ تمام‌عیار زنده بیرون آمد', hint: 'بعضی‌ها از خاکستر برمی‌خیزند — ولی اول باید سوخت.', earned: e => (e.stats?.crisisRecovered || 0) >= 1 },
  // فاز ۴۵ (سند ۲۹ Auction Saga): برد در تالار داستان می‌سازد — «اون برج لعنتی رو یادت هست؟».
  { key: 'Golden Hammer', fa: 'چکشِ طلایی — در تالارِ مزایده چکش به نامش کوبیده شد', hint: 'در تالار، چکش فقط برای یک نفر می‌خورَد.', earned: e => (e.stats?.auctionWins || 0) >= 1 },
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

// ══════════ فاز ۵۰ (سند ۳۰ فصل ۱۷ Part 20 — Collection System «The Hunt») ══════════
// مجموعه‌های «آشکار» با پیشرفتِ قابلِ‌دیدن (برخلافِ مأموریت‌های مخفی) — همه از رفتار/داراییِ واقعی.
// تکمیلِ مجموعه = نشانِ داستان‌دار که «عنوان» هم می‌شود (سیستمِ Title فاز ۱۸) — پاداشِ پرستیژی، نه پولی.
export const COLLECTIONS: Array<{ key: string; icon: string; fa: string; titleFa: string; goal: number; progress: (e: EmpireData) => number }> = [
  { key: 'کلکسیونرِ چهارگانه', icon: '🗂', fa: 'چهارگانهٔ املاک — مالکِ هر ۴ نوع دارایی (آپارتمان/ویلا/تجاری/زمین)', titleFa: 'کلکسیونرِ چهارگانه', goal: 4, progress: e => new Set(e.assets.map(a => a.kind)).size },
  { key: 'فاتحِ محله‌ها', icon: '🗺', fa: 'فاتحِ محله‌ها — دارایی در ۳ محلهٔ متفاوتِ شهر', titleFa: 'فاتحِ محله‌ها', goal: 3, progress: e => new Set(e.assets.map(a => a.hood).filter(Boolean)).size },
  { key: 'سلطانِ برج‌ها', icon: '🏗', fa: 'سلطانِ برج‌ها — ۲ پروژهٔ ساختِ تحویل‌داده', titleFa: 'سلطانِ برج‌ها', goal: 2, progress: e => e.stats?.projectsDelivered || 0 },
  { key: 'شکارچیِ تالار', icon: '🔨', fa: 'شکارچیِ تالار — ۳ بردِ چکش در تالارِ مزایده', titleFa: 'شکارچیِ تالار', goal: 3, progress: e => e.stats?.auctionWins || 0 },
  { key: 'امپراتورِ درآمد', icon: '💰', fa: 'امپراتورِ درآمد — ۵۰۰ میلیون تومان درآمدِ اجاره/کسب‌وکار', titleFa: 'امپراتورِ درآمد', goal: 500_000_000, progress: e => e.assets.reduce((s, a) => s + (a.income || 0), 0) },
  { key: 'فاتحِ شهرها', icon: '🏙', fa: 'فاتحِ شهرها — داراییِ واقعی در ۲ شهرِ متفاوت', titleFa: 'فاتحِ شهرها', goal: 2, progress: e => new Set(e.assets.map(a => a.city).filter(Boolean)).size },   // فاز ۶۸ (چندشهری v1)
]
export function collectionsOf(e: EmpireData): Array<{ key: string; icon: string; fa: string; titleFa: string; goal: number; have: number; done: boolean; earned: boolean }> {
  return COLLECTIONS.map(c => {
    const have = c.progress(e)
    return { key: c.key, icon: c.icon, fa: c.fa, titleFa: c.titleFa, goal: c.goal, have: Math.min(have, c.goal), done: have >= c.goal, earned: e.badges.includes(c.key) }
  })
}
// اعمالِ مجموعه‌های تازه‌کامل‌شده — نشان + تایم‌لاینِ جشن (مثلِ applyHiddenBadges، ولی برای هدف‌های آشکار).
export async function applyCollections(userId: string, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const fresh = COLLECTIONS.filter(c => !e.badges.includes(c.key) && c.progress(e) >= c.goal)
    if (!fresh.length) return 'مجموعهٔ تازه‌ای کامل نشده'
    for (const c of fresh) {
      e.badges.push(c.key)
      e.timeline.push({ at: now, icon: '🏆', title: `مجموعه کامل شد: ${c.icon} ${c.key}`, detail: `${c.fa} — حالا می‌توانی عنوانِ «${c.titleFa}» را روی نامت بگذاری` })
    }
  })
}

// رکوردهای شخصی (Part 20 «⭐ رکوردها») — فقط از دادهٔ ثبت‌شدهٔ واقعیِ خودِ بازیکن؛ بدونِ داده = بدونِ رکورد.
export function recordsOf(e: EmpireData): Array<{ icon: string; label: string; value: number; unit: 'toman' | 'count'; detail?: string }> {
  const out: Array<{ icon: string; label: string; value: number; unit: 'toman' | 'count'; detail?: string }> = []
  const maxBuy = e.assets.reduce((m, a) => a.buyPrice > m.v ? { v: a.buyPrice, t: a.nickname || a.title } : m, { v: 0, t: '' })
  if (maxBuy.v > 0) out.push({ icon: '💎', label: 'گران‌ترین خرید', value: maxBuy.v, unit: 'toman', detail: maxBuy.t.slice(0, 40) })
  const bestProject = (e.projectHist || []).reduce((m, r) => r.revenue > m.v ? { v: r.revenue, t: r.title } : m, { v: 0, t: '' })
  if (bestProject.v > 0) out.push({ icon: '🏗', label: 'بزرگ‌ترین پروژهٔ تحویلی', value: bestProject.v, unit: 'toman', detail: bestProject.t.slice(0, 40) })
  const bestPnl = (e.projectHist || []).reduce((m, r) => r.pnl > m ? r.pnl : m, 0)
  if (bestPnl > 0) out.push({ icon: '📈', label: 'پرسودترین پروژه', value: bestPnl, unit: 'toman' })
  if ((e.realized || 0) > 0) out.push({ icon: '💵', label: 'سودِ تحقق‌یافتهٔ کل', value: e.realized, unit: 'toman' })
  if ((e.stats?.auctionWins || 0) > 0) out.push({ icon: '🔨', label: 'بردهای تالارِ مزایده', value: e.stats!.auctionWins!, unit: 'count' })
  if ((e.stats?.negoWins || 0) > 0) out.push({ icon: '🤝', label: 'مذاکره‌های بردی', value: e.stats!.negoWins, unit: 'count' })
  if ((e.stats?.crisisRecovered || 0) > 0) out.push({ icon: '🕊', label: 'عبور از بحران', value: e.stats!.crisisRecovered!, unit: 'count' })
  return out
}

// ══════════ فاز ۶۶ (صف #۲ — Season Engine v1): فصلِ دنیا ══════════
// بیس‌لاینِ ورود به فصل: اولین دیدارِ بازیکن در بازهٔ فصل ثبت می‌شود؛ پیشرفت = دلتای «واقعی» از همین نقطه.
export async function seasonBaseline(userId: string, id: string, day: number, netWorth: number) {
  return mutateEmpire(userId, e => {
    if (e.seasonSnap?.id === id) return 'از قبل در فصل است'
    e.seasonSnap = { id, day, netWorth, projects: e.stats?.projectsDelivered || 0, auctionWins: e.stats?.auctionWins || 0, income: e.assets.reduce((s2, a) => s2 + (a.income || 0), 0) }
    e.timeline.push({ at: Date.now(), icon: '🌱', title: 'واردِ فصلِ تازهٔ دنیا شد', detail: 'پیشرفتِ فصل از همین لحظه شمرده می‌شود' })
  })
}
export const SEASON_METRIC_FA: Record<string, string> = {
  growth: 'رشدِ ارزشِ خالص', projects: 'پروژه‌های تحویلی', auctionWins: 'بردهای تالارِ مزایده', income: 'درآمدِ انباشته از اجاره/کسب‌وکار',
}
// مقدارِ فصلیِ خالص — همه دلتای واقعی نسبت به بیس‌لاین؛ رشد می‌تواند منفی هم باشد (صادقانه).
export function seasonValueOf(e: EmpireData, currentNetWorth: number, metric: string): number {
  const s = e.seasonSnap
  if (!s) return 0
  if (metric === 'projects') return Math.max(0, (e.stats?.projectsDelivered || 0) - s.projects)
  if (metric === 'auctionWins') return Math.max(0, (e.stats?.auctionWins || 0) - s.auctionWins)
  if (metric === 'income') return Math.max(0, e.assets.reduce((x, a) => x + (a.income || 0), 0) - s.income)
  return currentNetWorth - s.netWorth
}

// فاز ۷۰ (دولتِ زنده): مالیاتِ مؤثرِ این هفته = پایهٔ knob + مصوبهٔ قطعیِ هفته (کف صفر) — یک نقطهٔ حقیقت.
export function effectiveTransferTaxPct(day = dayNumberOf(Date.now())): number {
  const base = config().empire.transferTaxPct
  const d = govDecreeOf(Math.floor(day / 7))
  return Math.max(0, Math.round((base + d.taxDelta) * 100) / 100)
}

// 🛡 بیمهٔ کارگاه (فاز ۷۰ — صفِ GDD): حقِ بیمه ٪ هزینهٔ ساخت (مصرفِ شفاف → insurancePaid)؛
// پوشش: هزینهٔ رویدادهای کارگاه coveragePct٪ کمتر — قبل از وقوع باید بیمه کرده باشی.
export async function insureBuild(userId: string, assetId: string, now = Date.now()) {
  const ic = config().empire.insurance
  if (!ic?.enabled) return { ok: false as const, reason: 'بیمهٔ کارگاه فعلاً فعال نیست' }
  return mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    const c = a?.construction
    if (!a || !c || c.done) return 'کارگاهِ فعالی روی این دارایی نیست'
    if (c.insured) return 'این کارگاه از قبل بیمه است'
    const premium = Math.max(1, Math.round(c.costTotal * (ic.premiumPct / 100)))
    if (e.capital < premium) return `حقِ بیمه ${Math.round(premium / 1e6).toLocaleString('fa-IR')}م تومان است — سرمایه کافی نیست`
    e.capital -= premium
    e.insurancePaid = (e.insurancePaid || 0) + premium
    c.insured = true
    e.timeline.push({ at: now, icon: '🛡', title: `کارگاهِ «${a.title.slice(0, 40)}» بیمه شد`, detail: `حقِ بیمه ${Math.round(premium / 1e6).toLocaleString('fa-IR')}م — ${ic.coveragePct.toLocaleString('fa-IR')}٪ هزینهٔ اتفاق‌های کارگاه پوشش داده می‌شود` })
  })
}

// دنبال‌کردن (فاز ۶۷ — World Feed تعاملی): toggle با سقف — فقط هایلایتِ فید، صفر اثرِ اقتصادی.
export async function followEmpire(userId: string, no: number, on: boolean, maxFollow = 50) {
  return mutateEmpire(userId, e => {
    const list = e.following || []
    if (on) {
      if (list.includes(no)) return 'از قبل دنبال می‌کنی'
      if (list.length >= maxFollow) return `حداکثر ${maxFollow.toLocaleString('fa-IR')} دنبال‌شده می‌توانی داشته باشی`
      if (no === e.no) return 'خودت را نمی‌شود دنبال کرد'
      e.following = [...list, no]
    } else {
      if (!list.includes(no)) return 'در فهرستِ دنبال‌شده‌ها نیست'
      e.following = list.filter(x => x !== no)
    }
  })
}

// جایزهٔ فصل — فقط رتبه‌های برترِ نتیجهٔ «منجمدشده»؛ یک‌بار با کلیدِ claims (کوین، نه پول — بدونِ اثرِ P2W).
export async function claimSeasonReward(userId: string, id: string, rank: number, coins: number, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const key = 'season_' + id
    if (e.claims[key]) return 'جایزهٔ این فصل را گرفته‌ای'
    e.claims[key] = now
    e.coins += Math.max(0, Math.round(coins))
    e.timeline.push({ at: now, icon: '🏁', title: `قهرمانِ فصل — رتبهٔ ${rank.toLocaleString('fa-IR')}`, detail: `${coins.toLocaleString('fa-IR')} ملک‌کوین جایزهٔ فصل` })
  })
}

// ══════════ فاز ۶۲ (سند ۳۱ — فصل ۲۰ End Game) ══════════
// Part 1 — نردبانِ بی‌پایان (Role Evolution): «بعد از ۳۰۰ ساعت نباید همان کارهای ساعتِ اول را بکند؛ نقشش عوض شود».
// لایهٔ نقش از مقیاسِ واقعیِ امپراتوری (ارزشِ خالص + شرطِ ساختاریِ واقعی)؛ آستانه‌ها همه knob (endgame.l2..l8).
export const ROLE_LAYERS: Array<{ icon: string; fa: string; extra?: (e: EmpireData) => boolean; extraFa?: string }> = [
  { icon: '🎯', fa: 'معامله‌گر' },
  { icon: '🏠', fa: 'مشاورِ بازار' },
  { icon: '🏗', fa: 'شرکتِ ساختمانی', extra: e => (e.stats?.projectsDelivered || 0) >= 1, extraFa: 'یک پروژهٔ تحویلی' },
  { icon: '🏢', fa: 'هولدینگ', extra: e => (e.stats?.projectsDelivered || 0) >= 3 && e.assets.length >= 5, extraFa: '۳ پروژهٔ تحویلی + ۵ دارایی' },
  { icon: '🌐', fa: 'سرمایه‌گذارِ کلان', extra: e => (e.funds?.length || 0) + (e.crowd?.length || 0) > 0, extraFa: 'حضور در بازارِ سرمایه (صندوق/مشارکت)' },
  { icon: '🏙', fa: 'سازندهٔ شهر', extra: e => (e.stats?.projectsDelivered || 0) >= 6, extraFa: '۶ پروژهٔ تحویلی' },
  { icon: '🗺', fa: 'فاتحِ شهر', extra: e => new Set(e.assets.map(a => a.hood).filter(Boolean)).size >= 5, extraFa: 'دارایی در ۵ محلهٔ متفاوت' },
  { icon: '👑', fa: 'توسعه‌دهندهٔ افسانه‌ای' },
]
export function roleLayerOf(e: EmpireData, netWorth: number, g = config().empire.endgame): { idx: number; icon: string; fa: string; next: null | { fa: string; icon: string; needToman: number; extraFa?: string; extraOk: boolean } } {
  const ths = [0, g.l2, g.l3, g.l4, g.l5, g.l6, g.l7, g.l8]
  let idx = 0
  for (let i = 1; i < ROLE_LAYERS.length; i++) {
    if (netWorth >= (ths[i] || Infinity) && (!ROLE_LAYERS[i].extra || ROLE_LAYERS[i].extra!(e))) idx = i
    else break
  }
  const n = idx + 1 < ROLE_LAYERS.length ? ROLE_LAYERS[idx + 1] : null
  return { idx, icon: ROLE_LAYERS[idx].icon, fa: ROLE_LAYERS[idx].fa, next: n ? { fa: n.fa, icon: n.icon, needToman: ths[idx + 1] || 0, extraFa: n.extraFa, extraOk: !n.extra || n.extra(e) } : null }
}

// Part 2 — شاخصِ میراث (Legacy Score): «پول تنها معیارِ موفقیت نیست» — همه از دادهٔ ثبت‌شدهٔ واقعی؛ وزن‌ها knob.
export function legacyScoreOf(e: EmpireData, g = config().empire.endgame): { score: number; parts: Array<{ icon: string; fa: string; value: number; unit: 'toman' | 'count'; pts: number }> } {
  const qMap: Record<string, number> = { 'اقتصادی': 40, 'استاندارد': 70, 'لوکس': 95 }
  const hist = e.projectHist || []
  const qAvg = hist.length ? Math.round(hist.reduce((s, r) => s + (qMap[r.quality] ?? 60), 0) / hist.length) : 0
  const parts: Array<{ icon: string; fa: string; value: number; unit: 'toman' | 'count'; pts: number }> = [
    { icon: '🏗', fa: 'پروژه‌های تحویلی', value: e.stats?.projectsDelivered || 0, unit: 'count', pts: (e.stats?.projectsDelivered || 0) * g.legacyBuild },
    { icon: '👷', fa: 'دستمزدِ پرداختی (اشتغال)', value: e.wagesPaid || 0, unit: 'toman', pts: Math.floor((e.wagesPaid || 0) / Math.max(1, g.legacyJobsPer)) },
    { icon: '🏛', fa: 'مالیاتِ پرداختی (سهم در شهر)', value: e.taxPaid || 0, unit: 'toman', pts: Math.floor((e.taxPaid || 0) / Math.max(1, g.legacyTaxPer)) },
    { icon: '⭐', fa: 'میانگینِ کیفیتِ ساخت', value: qAvg, unit: 'count', pts: qAvg * g.legacyQuality },
    { icon: '👏', fa: 'تحسینِ بازیکنانِ واقعی', value: e.kudos || 0, unit: 'count', pts: (e.kudos || 0) * g.legacySocial },
    { icon: '🎖', fa: 'نشان‌های کسب‌شده', value: (e.badges || []).length, unit: 'count', pts: (e.badges || []).length * g.legacyBadge },
  ]
  return { score: parts.reduce((sm, x) => sm + x.pts, 0), parts }
}

// Part 2 — «مستندِ مسیر» (Player History): اولین‌های واقعیِ خودِ بازیکن از تایم‌لاینِ ثبت‌شده — چیزی ساخته نمی‌شود؛
// «انسان‌ها عاشقِ داستانِ خودشان‌اند» — اولین رخدادِ هر نوع (آیکون) به ترتیبِ زمان.
export function storyOf(e: EmpireData): TimelineDot[] {
  const first = new Map<string, TimelineDot>()
  for (const t of e.timeline || []) if (!first.has(t.icon)) first.set(t.icon, t)
  return [...first.values()].sort((a, b) => a.at - b.at).slice(0, 24)
}

// فاز ۷۱ (سند ۳۳ — Player Identity Engine «The Biography»): کتابِ زندگیِ روایی — فصل‌ها از دادهٔ ثبت‌شدهٔ
// «واقعیِ» خودِ بازیکن، قاعده‌مند و قطعی (بدونِ هزینهٔ AI). «بازی خاطره را ثبت می‌کند، نه فقط می‌سازد.»
export function biographyOf(e: EmpireData): Array<{ icon: string; title: string; text: string }> {
  const ch: Array<{ icon: string; title: string; text: string }> = []
  const firstOf = (icon: string) => (e.timeline || []).find(t => t.icon === icon)
  const faD = (ts: number) => new Date(ts).toLocaleDateString('fa-IR')
  const pathFa = e.path && PATHS[e.path] ? PATHS[e.path].label : ''
  ch.push({ icon: '🌅', title: 'فصلِ آغاز', text: `«${e.name}» در ${faD(e.createdAt)} متولد شد${pathFa ? ` — با مسیرِ «${pathFa}»` : ''}${e.dream?.sentence ? ` و یک رؤیا: «${e.dream.sentence.slice(0, 80)}»` : ''}.` })
  const buy1 = firstOf('🏠') || firstOf('🔑')
  if (buy1) ch.push({ icon: '🔑', title: 'اولین مالکیت', text: `${faD(buy1.at)} — ${buy1.title}${buy1.detail ? ` (${buy1.detail.slice(0, 60)})` : ''}. از همین‌جا همه‌چیز شروع شد.` })
  const crisis = firstOf('🚨')
  if (crisis) {
    const phoenix = e.badges.includes('Phoenix')
    ch.push({ icon: phoenix ? '🕊' : '🚨', title: phoenix ? 'سقوط و بازگشت' : 'روزهای سخت', text: phoenix ? `${faD(crisis.at)} واردِ بحران شد — اما برگشت. نشانِ «ققنوس» گواهِ همان روزهاست؛ نقطهٔ عطفی که مسیرش را عوض کرد.` : `${faD(crisis.at)} سخت‌ترین روزهایش را دید — این فصل هنوز تمام نشده.` })
  }
  const tower1 = firstOf('🏙')
  if (tower1) ch.push({ icon: '🏙', title: 'اولین برج', text: `${faD(tower1.at)} — خطِ آسمانِ شهر برای اولین بار با نامِ او عوض شد: ${tower1.detail || tower1.title}` })
  const hammer = firstOf('🔨')
  if (hammer) ch.push({ icon: '🔨', title: 'تالارِ مزایده', text: `${faD(hammer.at)} اولین چکش به نامش خورد${(e.stats?.auctionWins || 0) > 1 ? ` — و تا امروز ${(e.stats!.auctionWins!).toLocaleString('fa-IR')} برد در تالار دارد` : ''}.` })
  const season = firstOf('🏁')
  if (season) ch.push({ icon: '🏁', title: 'قهرمانی', text: `${faD(season.at)} — ${season.title}. نامش در نتیجهٔ منجمدِ آن فصل برای همیشه ثبت است.` })
  const wonder = firstOf('🌍')
  if (wonder) ch.push({ icon: '🌍', title: 'شگفتیِ دنیا', text: `${faD(wonder.at)} — ${wonder.title.slice(0, 90)}` })
  // Personality Evolution (سند ۳۳): شخصیت از «رفتارِ واقعی»، نه پرسش‌نامه
  const traits: string[] = []
  if ((e.creditHist?.taken || 0) > 0 && (e.insurancePaid || 0) > 0) traits.push('اهلِ ریسکِ حساب‌شده — وام می‌گیرد ولی بیمه هم می‌کند')
  else if ((e.creditHist?.taken || 0) >= 2) traits.push('ریسک‌پذیر — اهرمِ بانک ابزارِ همیشگی‌اش است')
  else if ((e.insurancePaid || 0) > 0) traits.push('محتاط — پیش از طوفان چتر می‌خرد')
  const nt = e.stats?.negoTries || 0, nw2 = e.stats?.negoWins || 0
  if (nt >= 3) traits.push(nw2 / nt >= 0.5 ? `مذاکره‌کنندهٔ قهار (${Math.round((nw2 / nt) * 100).toLocaleString('fa-IR')}٪ برد)` : 'مذاکره را رها نمی‌کند، حتی بعد از شکست')
  if ((e.stats?.auctionTries || 0) >= 3) traits.push('عاشقِ هیجانِ تالار')
  if ((e.stats?.projectsDelivered || 0) >= 2) traits.push('سازنده — بیشتر از خریدن، ساختن را دوست دارد')
  if (traits.length) ch.push({ icon: '🧭', title: 'شخصیت — از رفتارِ واقعی', text: traits.join('؛ ') + '.' })
  // اثرِ اجتماعی (سند ۳۳: «آمارِ خشک نه، داستان»)
  const unitsDelivered = (e.projectHist || []).reduce((s2, r) => s2 + (r.units || 0), 0)
  if (unitsDelivered > 0) ch.push({ icon: '🏘', title: 'اثر بر شهر', text: `تا امروز ${unitsDelivered.toLocaleString('fa-IR')} واحدِ مسکونی تحویل داده — خانه‌هایی که حالا بخشی از خطِ آسمانِ شهرند.` })
  if ((e.wagesPaid || 0) > 0) ch.push({ icon: '👷', title: 'کارفرما', text: `${Math.round((e.wagesPaid || 0) / 1e6).toLocaleString('fa-IR')} میلیون تومان دستمزدِ تیمِ مهندسی‌اش شده — امپراتوری یعنی آدم‌ها.` })
  return ch
}

// Part 7 — موتورِ رؤیاها (Dreams Engine): متریک‌های واقعیِ قابلِ هدف‌گذاری — پیشرفتِ رؤیا از عددِ واقعی اندازه می‌خورد.
export const DREAM_METRICS: Record<string, { fa: string; unit: 'toman' | 'count'; of: (e: EmpireData, netWorth: number) => number }> = {
  netWorth: { fa: 'ارزشِ خالص', unit: 'toman', of: (_e, nw) => nw },
  assets: { fa: 'تعدادِ دارایی', unit: 'count', of: e => e.assets.length },
  towers: { fa: 'پروژهٔ تحویلی', unit: 'count', of: e => e.stats?.projectsDelivered || 0 },
  auctionWins: { fa: 'بردِ تالارِ مزایده', unit: 'count', of: e => e.stats?.auctionWins || 0 },
  income: { fa: 'درآمدِ انباشته از اجاره/کسب‌وکار', unit: 'toman', of: e => e.assets.reduce((s, a) => s + (a.income || 0), 0) },
  realized: { fa: 'سودِ تحقق‌یافته', unit: 'toman', of: e => Math.max(0, e.realized || 0) },
  hoods: { fa: 'محله‌های حضور', unit: 'count', of: e => new Set(e.assets.map(a => a.hood).filter(Boolean)).size },
  kudos: { fa: 'تحسینِ بازیکنان', unit: 'count', of: e => e.kudos || 0 },
}
export function dreamProgressOf(e: EmpireData, netWorth: number) {
  return (e.dreamsCustom || []).map(d => {
    const m = DREAM_METRICS[d.metric]
    const have = m ? m.of(e, netWorth) : 0
    return { ...d, unit: m?.unit || ('count' as const), metricFa: m?.fa || d.metric, have: Math.min(have, d.target), pct: Math.min(100, Math.floor((have / Math.max(1, d.target)) * 100)), done: !!d.doneAt || have >= d.target }
  })
}
// پیشنهادِ رؤیا از «سبکِ واقعیِ» خودِ بازیکن — قاعده‌مند و قطعی (نه ادعای AI): قدمِ بعدیِ همان رفتاری که بیشتر داشته.
export function dreamSuggestionsOf(e: EmpireData): Array<{ label: string; metric: string; target: number }> {
  const out: Array<{ label: string; metric: string; target: number }> = []
  const aw = e.stats?.auctionWins || 0, pd = e.stats?.projectsDelivered || 0
  const hoods = new Set(e.assets.map(a => a.hood).filter(Boolean)).size
  if (aw > 0) out.push({ label: `شکارچیِ افسانه‌ای — ${(aw + 3).toLocaleString('fa-IR')} بردِ چکش`, metric: 'auctionWins', target: aw + 3 })
  if (pd > 0) out.push({ label: `سازندهٔ شهر — ${(pd + 2).toLocaleString('fa-IR')} پروژهٔ تحویلی`, metric: 'towers', target: pd + 2 })
  if (hoods > 0) out.push({ label: `فاتحِ محله‌ها — حضور در ${(hoods + 2).toLocaleString('fa-IR')} محله`, metric: 'hoods', target: hoods + 2 })
  if (out.length < 3 && e.assets.length >= 0) out.push({ label: `مالکِ ${(e.assets.length + 2).toLocaleString('fa-IR')} داراییِ واقعی`, metric: 'assets', target: e.assets.length + 2 })
  return out.slice(0, 3)
}
export async function addCustomDream(userId: string, input: { label?: string; metric: string; target: number }, now = Date.now()) {
  const m = DREAM_METRICS[input.metric]
  const target = Math.floor(Number(input.target) || 0)
  if (!m) return { ok: false as const, error: 'متریکِ رؤیا نامعتبر است' }
  if (target <= 0) return { ok: false as const, error: 'هدفِ رؤیا باید عددی مثبت باشد' }
  const maxN = config().empire.endgame.dreamsMax
  return mutateEmpire(userId, e => {
    const list = e.dreamsCustom || []
    if (list.filter(d => !d.doneAt).length >= maxN) return `حداکثر ${maxN.toLocaleString('fa-IR')} رؤیای فعال می‌توانی داشته باشی — اول یکی را محقق کن`
    const label = String(input.label || '').trim().slice(0, 60) || `${m.fa}: ${target.toLocaleString('fa-IR')}`
    e.dreamsCustom = [...list, { id: 'dr' + now.toString(36) + String(list.length), label, metric: input.metric, target, createdAt: now }]
    e.timeline.push({ at: now, icon: '🌠', title: 'رؤیای تازه ثبت شد', detail: label })
  })
}
// تحققِ رؤیاها: هدفِ رسیده → مهرِ انجام + نشانِ اختصاصی + جشنِ تایم‌لاین (Badge/عنوانِ سندِ ۳۱).
export async function applyDreams(userId: string, netWorth: number, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const fresh = (e.dreamsCustom || []).filter(d => !d.doneAt && (DREAM_METRICS[d.metric] ? DREAM_METRICS[d.metric].of(e, netWorth) : 0) >= d.target)
    if (!fresh.length) return 'رؤیای تازه‌ای محقق نشده'
    for (const d of fresh) {
      d.doneAt = now
      const key = `🌠 ${d.label}`.slice(0, 60)
      if (!e.badges.includes(key)) e.badges.push(key)
      e.timeline.push({ at: now, icon: '🌠', title: 'رؤیا محقق شد!', detail: d.label })
    }
  })
}

// Part 4 — شگفتی‌های دنیا (World Wonders): رکوردهای سراسریِ سرور — کمیاب، با پلاکِ دائمی، و قابلِ‌گرفتن.
// «انواعِ مختلفِ افتخار» تا فقط ثروتمندترین برنده نباشد؛ حداقل‌ها knob؛ رکورد فقط با عددِ اکیداً بزرگ‌تر می‌شکند.
export interface WonderHolder { no: number; name: string; value: number; sinceDay: number }
export interface WondersDb { cats: Record<string, WonderHolder>; hist: Record<string, Array<WonderHolder & { toDay: number }>> }
export const WONDER_DEFS: Array<{ key: string; icon: string; fa: string; unit: 'toman' | 'count'; metric: (e: EmpireData) => number; min: (g: ReturnType<typeof config>['empire']['endgame']) => number }> = [
  { key: 'income', icon: '💰', fa: 'بزرگ‌ترین امپراتوریِ درآمد', unit: 'toman', metric: e => e.assets.reduce((s, a) => s + (a.income || 0), 0), min: g => g.wonderMinIncome },
  { key: 'towers', icon: '🏗', fa: 'سازندهٔ برترِ شهر', unit: 'count', metric: e => e.stats?.projectsDelivered || 0, min: g => g.wonderMinProjects },
  { key: 'auction', icon: '🔨', fa: 'سلطانِ تالارِ مزایده', unit: 'count', metric: e => e.stats?.auctionWins || 0, min: g => g.wonderMinAuction },
  { key: 'kudos', icon: '👏', fa: 'محبوب‌ترین امپراتوری', unit: 'count', metric: e => e.kudos || 0, min: g => g.wonderMinKudos },
  { key: 'employer', icon: '👷', fa: 'بزرگ‌ترین کارفرمای شهر', unit: 'toman', metric: e => e.wagesPaid || 0, min: g => g.wonderMinWages },
  { key: 'legacy', icon: '🏛', fa: 'میراثِ برتر', unit: 'count', metric: e => legacyScoreOf(e).score, min: g => g.wonderMinLegacy },
]
// خالص و تست‌پذیر: نگه‌داشتنِ رکورد تا وقتی «اکیداً بزرگ‌تر» نیامده؛ عوض‌شدن = پلاکِ قبلی به تاریخچه (Former World Wonder).
export function wondersCompute(list: EmpireData[], prev: WondersDb, day: number, g = config().empire.endgame): { db: WondersDb; changed: Array<{ key: string; fa: string; icon: string; holder: WonderHolder }> } {
  const db: WondersDb = { cats: { ...(prev.cats || {}) }, hist: { ...(prev.hist || {}) } }
  const changed: Array<{ key: string; fa: string; icon: string; holder: WonderHolder }> = []
  for (const w of WONDER_DEFS) {
    const min = w.min(g)
    let best: { e: EmpireData; v: number } | null = null
    for (const e of list) { const v = w.metric(e); if (v >= min && (!best || v > best.v)) best = { e, v } }
    if (!best) continue
    const cur = db.cats[w.key]
    if (!cur) {
      db.cats[w.key] = { no: best.e.no, name: best.e.name, value: best.v, sinceDay: day }
      changed.push({ key: w.key, fa: w.fa, icon: w.icon, holder: db.cats[w.key] })
    } else if (cur.no === best.e.no) {
      if (best.v > cur.value) db.cats[w.key] = { ...cur, value: best.v }
    } else if (best.v > cur.value) {
      db.hist[w.key] = [{ ...cur, toDay: day }, ...(db.hist[w.key] || [])].slice(0, 10)
      db.cats[w.key] = { no: best.e.no, name: best.e.name, value: best.v, sinceDay: day }
      changed.push({ key: w.key, fa: w.fa, icon: w.icon, holder: db.cats[w.key] })
    }
  }
  return { db, changed }
}
const WONDERS_FILE = join(process.cwd(), '.empire-wonders.json')
const WONDERS_KV = 'empire_wonders'
async function wondersLoad(): Promise<WondersDb> {
  if (pgEnabled()) return kvGet<WondersDb>(WONDERS_KV, { cats: {}, hist: {} }).catch(() => ({ cats: {}, hist: {} }))
  try { if (existsSync(WONDERS_FILE)) return JSON.parse(readFileSync(WONDERS_FILE, 'utf-8')) } catch {}
  return { cats: {}, hist: {} }
}
async function wondersSave(db: WondersDb) {
  if (pgEnabled()) { await kvSet(WONDERS_KV, db); return }
  writeFileSync(WONDERS_FILE, JSON.stringify(db))
}
// به‌روزرسانی + نمای پلاک‌ها — دارندهٔ جدید در تایم‌لاینِ خودش جشن می‌گیرد («یک اتفاقِ جهانی، نه یک ساختمانِ دیگر»).
export async function wondersUpdate(day: number, now = Date.now()) {
  const prev = await wondersLoad()
  const emps = await listEmpiresPublic(500)
  const { db, changed } = wondersCompute(emps, prev, day)
  if (JSON.stringify(db) !== JSON.stringify(prev)) await wondersSave(db).catch(() => {})
  for (const c of changed) {
    const holder = emps.find(x => x.no === c.holder.no)
    if (holder) await mutateEmpire(holder.userId, e => {
      e.timeline.push({ at: now, icon: '🌍', title: `شگفتیِ دنیا از آنِ توست: ${c.icon} ${c.fa}`, detail: 'تا وقتی کسی رکوردِ اکیداً بزرگ‌تری نسازد، این پلاک به نامِ توست' })
    }).catch(() => {})
    // فاز ۶۳: ثبت در کتابِ تاریخِ دنیا — «یک اتفاقِ جهانی، نه یک ساختمانِ دیگر»
    await appendWorldEvent({ icon: c.icon, title: `${c.fa} دست‌به‌دست شد — پلاکِ جدید: ${c.holder.name}`, kind: 'wonder', no: c.holder.no }, day, now).catch(() => {})
  }
  return WONDER_DEFS.map(w => ({ key: w.key, icon: w.icon, fa: w.fa, unit: w.unit, min: w.min(config().empire.endgame), holder: db.cats[w.key] || null, formers: (db.hist[w.key] || []).slice(0, 3) }))
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
export async function buyAsset(userId: string, listing: { id: string; title: string; hood: string; price: number; ptype?: string; city?: string; lat?: number; lng?: number }, opts: { negotiated?: boolean; notaryFeePct?: number } = {}, now = Date.now()) {
  const cfg = config().empire
  return mutateEmpire(userId, e => {
    if (!listing.id || !(listing.price > 0)) return 'آگهیِ نامعتبر'
    if (e.assets.some(a => a.listingId === listing.id)) return 'این ملک از قبل در امپراتوریِ توست'
    // مالیاتِ نقل‌وانتقال (جلد ۵/۱۶): خرید = قیمت + مالیات؛ مالیات به خزانه می‌رود.
    const tax = Math.round(listing.price * (effectiveTransferTaxPct() / 100))   // فاز ۷۰: مصوبهٔ هفته اعمال می‌شود
    // دفترخانه (فاز ۲۹): ثبتِ سند حق‌الثبت دارد — سیستم نقشِ دفترخانه را بازی می‌کند تا دفترخانهٔ واقعی بیاید.
    const notary = Math.round(listing.price * Math.max(0, opts.notaryFeePct || 0) / 100)
    if (e.capital < listing.price + tax + notary) return tax + notary > 0 ? `سرمایه کافی نیست (قیمت + مالیات${notary > 0 ? ' + حق‌الثبتِ دفترخانه' : ''})` : 'سرمایهٔ کافی نیست'
    const first = e.assets.length === 0
    e.capital -= listing.price + tax + notary
    e.taxPaid = (e.taxPaid || 0) + tax
    if (notary > 0) {
      e.servicesPaid = (e.servicesPaid || 0) + notary
      e.timeline.push({ at: now, icon: '📜', title: `سند در ${proPersonaOf('notary', listing.id)} ثبت شد`, detail: `حق‌الثبت ${Math.round(notary / 1e6).toLocaleString('fa-IR')}م تومان` })
    }
    if (opts.negotiated) { e.stats = e.stats || { sellsProfitable: 0, negoWins: 0 }; e.stats.negoWins += 1 }
    e.assets.push({ id: 'ast_' + randomBytes(5).toString('hex'), listingId: listing.id, title: String(listing.title).slice(0, 120), hood: String(listing.hood || '').slice(0, 60), city: String(listing.city || '').slice(0, 40) || undefined, kind: assetKindOf(listing.ptype || ''), buyPrice: listing.price, boughtAt: now, lat: Number(listing.lat) || undefined, lng: Number(listing.lng) || undefined })
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
// اجاره (فاز ۲۹): از طریقِ مشاورِ املاک — کمیسیونِ واقعی → servicesPaid؛ سیستم نقشِ مشاور را بازی می‌کند.
export async function chooseAssetAction(userId: string, assetId: string, action: AssetAction, opts: { fee?: number; feeLabel?: string } = {}, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    if (!a) return 'دارایی یافت نشد'
    const fee = Math.max(0, Math.round(opts.fee || 0))
    if (fee > 0 && e.capital < fee) return 'سرمایهٔ نقدِ کافی برای کمیسیونِ مشاور نیست'
    a.action = action; a.actionAt = now
    if (fee > 0) {
      e.capital -= fee
      e.servicesPaid = (e.servicesPaid || 0) + fee
      e.timeline.push({ at: now, icon: '🤝', title: `${proPersonaOf('advisor', assetId)} مستأجر پیدا کرد`, detail: `${opts.feeLabel || 'کمیسیون'}: ${Math.round(fee / 1e6).toLocaleString('fa-IR')}م تومان` })
    }
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
export async function sellAsset(userId: string, assetId: string, livePrice: number, opts: { commissionPct?: number } = {}, now = Date.now()): Promise<{ ok: boolean; reason?: string; profit?: number; salePrice?: number; empire?: EmpireData }> {
  const cfg = config().empire
  let profit = 0, salePrice = 0
  const r = await mutateEmpire(userId, e => {
    const i = e.assets.findIndex(x => x.id === assetId)
    if (i < 0) return 'دارایی یافت نشد'
    const a = e.assets[i]
    // تجمیع (فاز ۲۵): فروش، کلِ ساختمان را می‌فروشد — قیمتِ روزِ واحد × واحدهای مالکیت‌شده؛ تخریب‌شده = بهای تمام‌شده.
    // بازسازی (فاز ۲۹): ارزش‌افزودهٔ بازسازی در قیمتِ فروش لحاظ می‌شود.
    salePrice = a.demolishedAt ? a.buyPrice : (livePrice > 0 ? Math.round(livePrice * (a.unitsOwned || 1) * (1 + (a.renovBoostPct || 0) / 100)) : a.buyPrice)
    profit = salePrice - a.buyPrice
    const tax = Math.round(salePrice * (effectiveTransferTaxPct() / 100))   // فاز ۷۰
    // مشاورِ املاک (فاز ۲۹): فروش از طریقِ مشاور — کمیسیون → servicesPaid؛ سیستم نقش را بازی می‌کند.
    const commission = Math.round(salePrice * Math.max(0, opts.commissionPct || 0) / 100)
    e.capital += salePrice - tax - commission
    e.taxPaid = (e.taxPaid || 0) + tax
    if (commission > 0) {
      e.servicesPaid = (e.servicesPaid || 0) + commission
      profit -= commission
      e.timeline.push({ at: now, icon: '🤝', title: `${proPersonaOf('advisor', assetId)} خریدار آورد`, detail: `کمیسیونِ فروش ${Math.round(commission / 1e6).toLocaleString('fa-IR')}م تومان` })
    }
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

// ═══════ تجمیع و تخریب (فاز ۲۵): «اگر ۶ واحدی است، تک‌تک بخر؛ تا همه را نخریدی تخریب نمی‌شود» ═══════
// کلِ واحدهای ساختمانِ یک آگهیِ واقعی: اول از متای واقعی («طبقه: ۲ از ۵» → ۵ طبقه ≈ ۵ واحد)،
// وگرنه قطعی از هشِ آگهی بین unitsMin..unitsMax — همان دکترینِ شخصیتِ مالک (ضدسوءاستفاده، تست‌پذیر).
export function buildingUnitsOf(listingId: string, meta: Record<string, string> | undefined, unitsMin: number, unitsMax: number): number {
  const m = meta || {}
  const floorTxt = String(m['طبقه'] || '')
  const fm = floorTxt.match(/از\s*([\d۰-۹]+)/)
  if (fm) {
    const n = Number(fm[1].replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))))
    if (n >= 2 && n <= 50) return n
  }
  const span = Math.max(1, unitsMax - unitsMin + 1)
  const h = createHash('sha1').update(listingId + '|units').digest()
  return unitsMin + (h[0] % span)
}
// قیمتِ واحدِ بعدی: قیمتِ روزِ واقعیِ همان آگهی + ٪ پرمیومِ تجمیع (مالک‌ها می‌فهمند دنبالِ تجمیعی — شفاف در UI).
export function assemblyUnitPriceOf(livePrice: number, premiumPct: number): number {
  return Math.max(1, Math.round(livePrice * (1 + Math.max(0, premiumPct) / 100)))
}

// خریدِ یک واحدِ دیگر از همان ساختمان — پول: قیمت از سرمایه کم می‌شود، مالیات → خزانه، بهای تمام‌شده رشد می‌کند.
export async function buyBuildingUnit(userId: string, assetId: string, opts: { price: number; taxPct: number; total: number }, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    if (!a) return 'دارایی یافت نشد'
    if (a.kind !== 'apartment' && a.kind !== 'commercial') return 'تجمیع فقط برای ساختمانِ آپارتمانی/تجاری است'
    if (a.construction) return 'این ملک واردِ پروژهٔ ساخت شده'
    if (a.demolishedAt) return 'این ساختمان تخریب شده'
    if (!a.unitsTotal) { a.unitsTotal = Math.max(2, opts.total); a.unitsOwned = a.unitsOwned || 1 }
    const owned = a.unitsOwned || 1
    if (owned >= a.unitsTotal) return 'همهٔ واحدهای این ساختمان مالِ توست — حالا می‌توانی تخریب کنی'
    const tax = Math.round(opts.price * opts.taxPct / 100)
    if (e.capital < opts.price + tax) return 'سرمایهٔ نقدِ کافی نیست (قیمت + مالیاتِ انتقال)'
    e.capital -= opts.price + tax
    e.taxPaid = (e.taxPaid || 0) + tax
    a.buyPrice += opts.price                       // بهای تمام‌شده = مجموعِ خریدِ همهٔ واحدها
    a.unitsOwned = owned + 1
    e.identity.builder = Math.min(100, (e.identity.builder || 0) + 2)
    e.timeline.push({ at: now, icon: '🧩', title: `تجمیع: واحدِ ${(owned + 1).toLocaleString('fa-IR')} از ${a.unitsTotal.toLocaleString('fa-IR')} خریده شد`, detail: a.title.slice(0, 60) })
    if (a.unitsOwned >= a.unitsTotal) e.timeline.push({ at: now, icon: '🏢', title: 'مالکیتِ کاملِ ساختمان!', detail: 'حالا می‌توانی تخریب کنی و برجِ خودت را بسازی' })
  })
}

// تخریب: فقط با مالکیتِ کامل (ویلایی مستقیم) → دارایی زمین می‌شود؛ هزینهٔ تخریب مصرفِ شفافِ پول است.
export async function demolishAsset(userId: string, assetId: string, opts: { cost: number; landArea: number }, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    if (!a) return 'دارایی یافت نشد'
    if (a.kind === 'land') return 'زمین که تخریب نمی‌شود — پروانه بگیر و بساز'
    if (a.construction) return 'این ملک واردِ پروژهٔ ساخت شده'
    if (a.demolishedAt) return 'قبلاً تخریب شده'
    if ((a.kind === 'apartment' || a.kind === 'commercial')) {
      const total = a.unitsTotal || 0
      if (!total || (a.unitsOwned || 1) < total) return `تا همهٔ واحدهای ساختمان را نخری نمی‌توانی تخریب کنی (${((a.unitsOwned || 1)).toLocaleString('fa-IR')} از ${(total || 0).toLocaleString('fa-IR')})`
    }
    if (e.capital < opts.cost) return 'سرمایهٔ نقدِ کافی برای هزینهٔ تخریب نیست'
    e.capital -= opts.cost
    e.demolitionPaid = (e.demolitionPaid || 0) + opts.cost
    a.demolishedAt = now
    a.kind = 'land'
    a.landPlan = undefined                          // تصمیمِ بعدی با بازیکن: فروش / ساخت / مشارکت
    a.business = undefined; a.businessProb = undefined; a.action = undefined
    a.landAreaOverride = Math.max(20, Math.round(opts.landArea))
    e.identity.builder = Math.min(100, (e.identity.builder || 0) + 5)
    e.timeline.push({ at: now, icon: '🧨', title: `تخریب: ${a.title.slice(0, 50)}`, detail: `زمینِ ~${a.landAreaOverride.toLocaleString('fa-IR')} متری آماده شد · هزینهٔ تخریب ${Math.round(opts.cost / 1e6).toLocaleString('fa-IR')} میلیون` })
    if (!e.badges.includes('First Demolition')) e.badges.push('First Demolition')
  })
}

// ═══════ نقش‌های حرفه‌ایِ سایت در سناریو (فاز ۲۹) ═══════
// تا وقتی متخصصانِ واقعیِ ملک‌جت (مشاور/دفترخانه/معمار/وکیل/کارشناس/پیمانکار) درگیرِ بازی شوند،
// «سیستم» نقش‌ها را بازی می‌کند — شخصیتِ قطعی از هش (همان دکترینِ مالک) و کارمزدِ شفاف → servicesPaid.
const PRO_NAMES: Record<string, string[]> = {
  advisor: ['مشاورِ املاکِ آقای توکلی', 'مشاورِ املاکِ خانم رستگار', 'مشاورِ املاکِ آقای عظیمی', 'مشاورِ املاکِ خانم پناهی'],
  agency: ['آژانسِ املاکِ آفتابِ محله', 'آژانسِ املاکِ مرکزی', 'آژانسِ املاکِ کاخ', 'آژانسِ املاکِ سبز'],
  notary: ['دفترخانهٔ اسنادِ رسمیِ ۱۲', 'دفترخانهٔ اسنادِ رسمیِ ۴۷', 'دفترخانهٔ اسنادِ رسمیِ ۸۳'],
  architect: ['مهندس‌معمار خانم صدر', 'مهندس‌معمار آقای بهرامی', 'دفترِ معماریِ آتیه'],
  contractor: ['پیمانکاریِ برادرانِ نوری', 'پیمانکاریِ سازهٔ پایدار', 'پیمانکاریِ آقای رحیمی'],
  lawyer: ['وکیلِ پایه‌یک خانم موسوی', 'وکیلِ پایه‌یک آقای شریفی'],
  appraiser: ['کارشناسِ رسمی آقای کاظمی', 'کارشناسِ رسمی خانم امیدی'],
}
export function proPersonaOf(role: string, seed: string): string {
  const list = PRO_NAMES[role] || ['متخصصِ ملک‌جت']
  const h = createHash('sha1').update(role + '|' + seed).digest()
  return list[h[0] % list.length]
}

// طراحیِ معمار (فاز ۲۹): محاسبهٔ شفافِ نقشه از قوانینِ شهرسازیِ knob — سطحِ اشغال، تراکم، حداقل متراژِ واحد.
// طبقهٔ بیش از حدِ قانونی «می‌شود» ساخت (تصمیمِ آگاهانهٔ بازیکن) — اما ماده۱۰۰ در انتظار است.
// ── ضابطهٔ واقعیِ طبقاتِ مجاز (فیدبکِ مستقیمِ کاربر: «قوانینِ ساخت بر اساسِ متراژ و منطقه واقعی نیست») ──
// عرفِ طرحِ تفصیلی: طبقاتِ مجاز پلکانی با متراژِ زمین (زمینِ کوچک ۲ طبقه … زمینِ بزرگ برج) +
// تعدیلِ «منطقه» از عرفِ واقعیِ ساختِ محله (میانهٔ «طبقه: X از Y» آگهی‌های واقعیِ هم‌محله) با سقفِ knob.
// همهٔ آستانه‌ها knob ادمین‌اند؛ عرفِ محله فقط وقتی حساب می‌شود که نمونهٔ واقعیِ کافی باشد (نه عددِ ساختگی).

// «طبقه: X از Y» متای واقعیِ آگهی → تعدادِ کلِ طبقاتِ ساختمان (همان الگوی buildingUnitsOf).
export function floorsOfMeta(meta: Record<string, string> | undefined): number | null {
  const fm = String((meta || {})['طبقه'] || '').match(/از\s*([\d۰-۹]+)/)
  if (!fm) return null
  const n = Number(fm[1].replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))))
  return n >= 2 && n <= 50 ? n : null
}

export interface FloorRuleCfg { tierA: number; tierAFloors: number; tierB: number; tierBFloors: number; tierC: number; tierCFloors: number; tierD: number; tierDFloors: number; bigFloors: number; hoodBonusMax: number }
export function legalFloorsOf(landArea: number, hoodFloors: number | null, cfg: FloorRuleCfg): { floors: number; areaFloors: number; hoodApplied: boolean } {
  const areaFloors = landArea < cfg.tierA ? cfg.tierAFloors
    : landArea < cfg.tierB ? cfg.tierBFloors
    : landArea < cfg.tierC ? cfg.tierCFloors
    : landArea < cfg.tierD ? cfg.tierDFloors
    : cfg.bigFloors
  // منطقه: اگر عرفِ واقعیِ ساختِ محله بلندتر است، تا سقفِ hoodBonusMax طبقه بالاتر مجاز می‌شود (پهنهٔ متراکم‌تر)
  if (hoodFloors && hoodFloors > areaFloors) {
    return { floors: Math.min(hoodFloors, areaFloors + Math.max(0, cfg.hoodBonusMax)), areaFloors, hoodApplied: true }
  }
  return { floors: Math.max(1, areaFloors), areaFloors, hoodApplied: false }
}

export function designPlanOf(landArea: number, floors: number, unitsPerFloor: number,
  cfg: { occupancyPct: number; buildFactor: number; maxOverFloors: number; minUnitArea: number; parkingAreaPerUnit?: number; parkingLevels?: number },
  legalFloorsOverride?: number):
  { ok: true; footprint: number; legalFloors: number; maxFloors: number; unitArea: number; illegalFloors: number; builtArea: number; totalUnits: number; illegalUnits: number; illegalArea: number; parkingCap: number | null } | { ok: false; reason: string } {
  if (!(landArea > 0)) return { ok: false, reason: 'متراژِ زمین نامشخص است' }
  const footprint = Math.max(20, Math.round(landArea * Math.max(10, Math.min(100, cfg.occupancyPct)) / 100))
  // طبقاتِ مجاز: از ضابطهٔ متراژ/منطقه (legalFloorsOf در caller)؛ فرمولِ قدیمیِ تراکم فقط fallbackِ سازگاری.
  const legalFloors = legalFloorsOverride && legalFloorsOverride >= 1
    ? Math.round(legalFloorsOverride)
    : Math.max(1, Math.floor((landArea * Math.max(0.5, cfg.buildFactor)) / footprint))
  const maxFloors = legalFloors + Math.max(0, cfg.maxOverFloors)
  if (!(floors >= 1) || floors > maxFloors) return { ok: false, reason: `طبقات باید بین ۱ و ${maxFloors.toLocaleString('fa-IR')} باشد (مجازِ قانونی: ${legalFloors.toLocaleString('fa-IR')})` }
  if (!(unitsPerFloor >= 1)) return { ok: false, reason: 'حداقل یک واحد در هر طبقه' }
  const unitArea = Math.floor(footprint / unitsPerFloor)
  if (unitArea < cfg.minUnitArea) return { ok: false, reason: `متراژِ هر واحد ${unitArea.toLocaleString('fa-IR')} متر می‌شود — کمتر از حداقلِ قانونیِ ${cfg.minUnitArea.toLocaleString('fa-IR')} متر` }
  // ضابطهٔ واقعیِ «هر واحد یک پارکینگ»: ظرفیتِ پارکینگ = مساحتِ قابلِ‌پارکِ همکف/زیرزمین ÷ سرانهٔ هر خودرو.
  const totalUnits = floors * unitsPerFloor
  const perCar = Math.max(0, cfg.parkingAreaPerUnit ?? 0)
  const parkingCap = perCar > 0 ? Math.max(1, Math.floor(footprint / perCar)) * Math.max(1, cfg.parkingLevels ?? 1) : null
  if (parkingCap !== null && totalUnits > parkingCap) {
    return { ok: false, reason: `برای ${totalUnits.toLocaleString('fa-IR')} واحد پارکینگ کافی نمی‌شود — ضابطهٔ «هر واحد یک پارکینگ» فقط ${parkingCap.toLocaleString('fa-IR')} واحد اجازه می‌دهد (همکف/زیرزمین)` }
  }
  const illegalFloors = Math.max(0, floors - legalFloors)
  return {
    ok: true, footprint, legalFloors, maxFloors, unitArea, illegalFloors,
    builtArea: footprint * floors, totalUnits,
    illegalUnits: illegalFloors * unitsPerFloor, illegalArea: illegalFloors * footprint, parkingCap,
  }
}

// قراردادِ معمار: حق‌الزحمه → servicesPaid؛ طراحی چند روزِ واقعی طول می‌کشد (قابلِ‌تسریع با کوین).
export async function commissionDesign(userId: string, assetId: string, d: { floors: number; unitsPerFloor: number; legalFloors: number; footprint: number; unitArea: number; illegalFloors: number; fee: number; days: number; landArea?: number }, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    if (!a) return 'دارایی یافت نشد'
    if (a.kind !== 'land' || a.landPlan !== 'build') return 'اول زمین با برنامهٔ «ساخت» لازم است'
    if (a.permit) return 'پروانه در جریان است — نقشه قبل از پروانه طراحی می‌شود'
    if (a.design) return 'نقشهٔ این زمین قبلاً سفارش داده شده'
    if (e.capital < d.fee) return 'سرمایهٔ نقدِ کافی برای حق‌الزحمهٔ معمار نیست'
    e.capital -= d.fee
    e.servicesPaid = (e.servicesPaid || 0) + d.fee
    const architect = proPersonaOf('architect', assetId)
    a.design = { floors: d.floors, unitsPerFloor: d.unitsPerFloor, legalFloors: d.legalFloors, footprint: d.footprint, unitArea: d.unitArea, illegalFloors: d.illegalFloors, architectFee: d.fee, startedAt: now, readyAt: now + Math.max(0, d.days) * 864e5, architect, landArea: d.landArea }
    e.identity.builder = Math.min(100, (e.identity.builder || 0) + 3)
    e.timeline.push({ at: now, icon: '📐', title: `قراردادِ طراحی با ${architect}`, detail: `${d.floors.toLocaleString('fa-IR')} طبقه × ${d.unitsPerFloor.toLocaleString('fa-IR')} واحد${d.illegalFloors > 0 ? ` · ⚠️ ${d.illegalFloors.toLocaleString('fa-IR')} طبقهٔ مازاد بر پروانه` : ''}` })
  })
}

// ⚡ تسریعِ طراحی: مثلِ پیگیریِ پروانه — کوین فقط انتظار را کوتاه می‌کند.
export async function boostDesign(userId: string, assetId: string, days: number, coinsPerDay: number, now = Date.now()) {
  let cut = 0
  const r = await mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    if (!a?.design || now >= a.design.readyAt) return 'طراحیِ در جریانی نیست'
    for (let d = 0; d < days && a.design.readyAt > now; d++) {
      if (e.coins < coinsPerDay) { if (!cut) return 'ملک‌کوینِ کافی نداری'; break }
      e.coins -= Math.max(0, coinsPerDay)
      a.design.readyAt = Math.max(now, a.design.readyAt - 864e5)
      cut++
    }
    if (!cut) return 'روزی نمانده'
    e.timeline.push({ at: now, icon: '⚡', title: `جلسهٔ فشرده با معمار: طراحی ${cut.toLocaleString('fa-IR')} روز جلو افتاد`, detail: a.title.slice(0, 50) })
  })
  if (!r.ok) return { ok: false as const, reason: r.reason }
  return { ok: true as const, cut, empire: r.empire }
}

// ⚖️ کمیسیونِ ماده۱۰۰ (فاز ۲۹): جریمه → خزانه (شهرداری) / دفاعِ وکیل (قطعی از هش، یک‌بار) / تخریبِ طبقهٔ مازاد.
export async function resolveM100(userId: string, assetId: string, choice: 'pay' | 'lawyer' | 'demolish',
  ctx: { lawyerFee: number; lawyerCutPct: number; lawyerWinChancePct: number; demolishCost: number }, now = Date.now()) {
  let lawyerWon: boolean | undefined
  const r = await mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    if (!a?.m100 || a.m100.status !== 'pending') return 'پروندهٔ ماده۱۰۰ باز نیست'
    if (choice === 'pay') {
      if (e.capital < a.m100.fine) return 'سرمایهٔ نقدِ کافی برای جریمه نیست'
      e.capital -= a.m100.fine
      e.taxPaid = (e.taxPaid || 0) + a.m100.fine          // جریمه → خزانه (شهرداری)
      a.m100.status = 'paid'
      if (a.construction) a.construction.illegalUnits = 0  // واحدها قانونی و قابلِ‌فروش شدند
      e.timeline.push({ at: now, icon: '⚖️', title: 'جریمهٔ ماده۱۰۰ پرداخت شد — واحدهای مازاد قانونی شدند', detail: `${Math.round(a.m100.fine / 1e6).toLocaleString('fa-IR')}م تومان → شهرداری` })
    } else if (choice === 'lawyer') {
      if (a.m100.lawyerTried) return 'وکیل یک‌بار دفاع کرده — رأیِ کمیسیون قطعی است'
      if (e.capital < ctx.lawyerFee) return 'سرمایهٔ کافی برای حق‌الوکاله نیست'
      e.capital -= ctx.lawyerFee
      e.servicesPaid = (e.servicesPaid || 0) + ctx.lawyerFee
      a.m100.lawyerTried = true
      const h = createHash('sha1').update(userId + '|m100|' + assetId).digest()
      lawyerWon = (h[0] % 100) < Math.max(0, Math.min(100, ctx.lawyerWinChancePct))
      const lawyer = proPersonaOf('lawyer', assetId)
      if (lawyerWon) {
        a.m100.fine = Math.max(1, Math.round(a.m100.fine * (1 - Math.max(0, Math.min(90, ctx.lawyerCutPct)) / 100)))
        e.timeline.push({ at: now, icon: '🧑‍⚖️', title: `${lawyer} در کمیسیون دفاع کرد — جریمه ${ctx.lawyerCutPct.toLocaleString('fa-IR')}٪ کم شد`, detail: `جریمهٔ جدید ${Math.round(a.m100.fine / 1e6).toLocaleString('fa-IR')}م تومان` })
      } else {
        e.timeline.push({ at: now, icon: '🧑‍⚖️', title: `دفاعِ ${lawyer} پذیرفته نشد — رأیِ کمیسیون ماند`, detail: 'حق‌الوکاله برنمی‌گردد؛ جریمه یا تخریب' })
      }
    } else {
      // تخریبِ طبقاتِ مازاد: واحدها حذف، هزینهٔ تخریب پرداخت — پرونده بسته می‌شود.
      const c = a.construction
      if (!c) return 'کارگاهی نیست'
      if (e.capital < ctx.demolishCost) return 'سرمایهٔ کافی برای هزینهٔ تخریب نیست'
      e.capital -= ctx.demolishCost
      e.demolitionPaid = (e.demolitionPaid || 0) + ctx.demolishCost
      c.totalUnits = Math.max(1, c.totalUnits - a.m100.illegalUnits)
      c.illegalUnits = 0
      a.m100.status = 'demolished'
      e.timeline.push({ at: now, icon: '🧨', title: `طبقاتِ مازاد تخریب شد (${a.m100.illegalUnits.toLocaleString('fa-IR')} واحد از دست رفت)`, detail: `هزینهٔ تخریب ${Math.round(ctx.demolishCost / 1e6).toLocaleString('fa-IR')}م تومان` })
    }
  })
  if (!r.ok) return { ok: false as const, reason: r.reason }
  return { ok: true as const, lawyerWon, empire: r.empire }
}

// 🛠 بازسازیِ واقعی (فاز ۲۹): هزینه به بهای تمام‌شده اضافه می‌شود، ارزشِ روز ٪ شفاف بالا می‌رود (با سقف).
export async function renovateAsset(userId: string, assetId: string, option: string, ctx: { cost: number; valuePct: number; maxBoostPct: number }, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    if (!a) return 'دارایی یافت نشد'
    if (a.kind === 'land' || a.demolishedAt) return 'زمین بازسازی ندارد — بساز'
    if (a.construction) return 'این ملک واردِ پروژهٔ ساخت شده'
    if ((a.renovDone || []).includes(option)) return 'این بخش قبلاً بازسازی شده'
    if ((a.renovBoostPct || 0) >= ctx.maxBoostPct) return 'به سقفِ ارزش‌افزودهٔ بازسازی رسیده‌ای'
    if (e.capital < ctx.cost) return 'سرمایهٔ نقدِ کافی نیست'
    e.capital -= ctx.cost
    a.buyPrice += ctx.cost                                 // سرمایه‌گذاری → بهای تمام‌شده (بقای پول)
    a.renovBoostPct = Math.min(ctx.maxBoostPct, (a.renovBoostPct || 0) + Math.max(0, ctx.valuePct))
    a.renovDone = [...(a.renovDone || []), option]
    e.identity.builder = Math.min(100, (e.identity.builder || 0) + 2)
    e.timeline.push({ at: now, icon: '🛠', title: `بازسازی انجام شد (+${ctx.valuePct.toLocaleString('fa-IR')}٪ ارزش)`, detail: `${a.title.slice(0, 50)} · هزینه ${Math.round(ctx.cost / 1e6).toLocaleString('fa-IR')}م` })
  })
}

// فاز ۴۷ (فیدبک: «کسب‌وکارها کم‌اند — نقش‌های خودِ سایت هم باشند»): فهرستِ کسب‌وکارهای قابلِ‌راه‌اندازی
// در ملکِ تجاری = نقش‌های واقعیِ اکوسیستمِ ملک‌جت + صنف‌های کلاسیک. q = واژهٔ هم‌صنفی برای شمارشِ
// رقبای «واقعیِ» همان محله از دایرکتوریِ سایت (فرمولِ احتمالِ موفقیت همان قبلی است — سیگنالِ واقعی).
export const BUSINESS_TYPES: Array<{ key: string; icon: string; q: string }> = [
  { key: 'مشاور املاک', icon: '🏠', q: 'مشاور' },
  { key: 'آژانس املاک', icon: '🏢', q: 'املاک' },
  { key: 'دفتر معماری', icon: '📐', q: 'معماری' },
  { key: 'دفتر پیمانکاری', icon: '👷', q: 'پیمانکار' },
  { key: 'کارشناسی رسمی ملک', icon: '⚖️', q: 'کارشناس' },
  { key: 'دفتر حقوقی', icon: '🧑‍⚖️', q: 'حقوقی' },
  { key: 'دفتر اسناد رسمی', icon: '📜', q: 'اسناد' },
  { key: 'خدمات مالی و بیمه', icon: '🏦', q: 'بیمه' },
  { key: 'فروشگاه مصالح', icon: '🧱', q: 'مصالح' },
  { key: 'کافه', icon: '☕', q: 'کافه' },
  { key: 'رستوران', icon: '🍽', q: 'رستوران' },
  { key: 'فروشگاه', icon: '🛍', q: 'فروشگاه' },
  { key: 'کلینیک', icon: '🩺', q: 'کلینیک' },
  { key: 'دفتر خدماتی', icon: '🗂', q: 'خدمات' },
]

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

// فاز ۴۹ (فیدبک: «۳ واحدِ دیگر خریدم، هیچ اثری ندارد» + «اجارهٔ ۱۲ واحد را نشان نمی‌دهد»):
// یک منبعِ واحدِ نرخِ درآمدِ ماهانه — هم واریزِ روزشمار (accrueRentFor) و هم نمایش (stateOf) از همین می‌خوانند،
// پس عددِ روی صفحه همیشه همان عددِ واریز است. واحدهای تجمیعی (unitsOwned) درآمد را «ضرب» می‌کنند:
// ۴ واحدِ خریده = ۴ برابرِ اجاره/کسب‌وکار — پاداشِ واقعیِ تجمیع، بدونِ مدیریتِ واحدبه‌واحد (قانونِ ۹۰/۱۰).
export function assetMonthlyIncomeOf(
  a: Pick<EmpireAsset, 'business' | 'businessProb' | 'action' | 'unitsOwned' | 'construction'>,
  rentMonthly0: number, amenityFactor = 1, skillFactor = 1,   // فاز ۱۰۳: «نبضِ بازار»
): number {
  if (!(rentMonthly0 > 0)) return 0
  rentMonthly0 = rentMonthly0 * Math.max(1, skillFactor)
  const units = Math.max(1, a.unitsOwned || 1)
  if (a.business) return Math.round(rentMonthly0 * ((a.businessProb || 50) / 100) * 2 * units)   // کسب‌وکار: ~۲× اجارهٔ مسکونی × احتمالِ موفقیت
  if (a.action === 'rent') return Math.round(rentMonthly0 * units)
  if (a.construction?.done && (a.construction.rented || 0) > 0)
    return Math.round(rentMonthly0 * (a.construction.rented || 0) * a.construction.qualityFactor * Math.max(0, amenityFactor))
  return 0
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
export async function takeLoan(userId: string, amount: number, ratePctYear: number, termDays: number, opts: { appraisalFee?: number } = {}, now = Date.now()) {
  return mutateEmpire(userId, e => {
    if (e.loan) return 'یک وامِ فعال داری — اول تسویه کن'
    if (!(amount > 0)) return 'مبلغِ نامعتبر'
    // کارشناسِ رسمی (فاز ۲۹): بانک بدونِ ارزیابیِ کارشناس وام نمی‌دهد — هزینه از مبلغِ وام کسر می‌شود.
    const fee = Math.max(0, Math.round(opts.appraisalFee || 0))
    if (fee > 0) {
      e.servicesPaid = (e.servicesPaid || 0) + fee
      e.timeline.push({ at: now, icon: '📋', title: `${proPersonaOf('appraiser', userId)} وثیقه را ارزیابی کرد`, detail: `هزینهٔ کارشناسی ${Math.round(fee / 1e6 * 10) / 10}م تومان — از مبلغِ وام کسر شد` })
    }
    e.capital += Math.round(amount) - fee
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
export async function requestPermit(userId: string, assetId: string, terms: { days: number; fee: number; objection: { text: string; extraDays: number; settleCost: number } | null }, opts: { requireDesign?: boolean } = {}, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    if (!a) return 'دارایی یافت نشد'
    if (a.kind !== 'land') return 'پروانه فقط برای زمین است'
    if (a.landPlan !== 'build') return 'اول برنامهٔ زمین را «ساخت» انتخاب کن'
    // فاز ۲۹: پروانه روی «نقشهٔ معمار» صادر می‌شود — اول قراردادِ طراحی (API این را بر اساسِ config می‌خواهد).
    if (opts.requireDesign) {
      if (!a.design) return 'اول با معمار قراردادِ طراحیِ نقشه ببند — پروانه روی نقشه صادر می‌شود'
      if (now < a.design.readyAt) return 'معمار هنوز مشغولِ طراحی است — صبر کن یا جلسهٔ فشرده بگذار'
    }
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
    if (ob.defended) return 'در کمیسیون دفاع کرده‌ای — دیگر جای توافق نیست؛ منتظرِ رأی بمان'
    if (e.capital < ob.settleCost) return 'سرمایهٔ کافی برای غرامت نیست'
    e.capital -= ob.settleCost
    e.taxPaid = (e.taxPaid || 0) + ob.settleCost
    ob.settled = true
    e.timeline.push({ at: now, icon: '🤝', title: 'اعتراضِ پروانه با توافق حل شد', detail: `${Math.round(ob.settleCost / 1e6).toLocaleString('fa-IR')}م تومان غرامت` })
  })
}

// دفاع در کمیسیون (فیدبک: «دفاع قابلِ کلیک نیست») — تصمیمِ صریحِ دومِ اعتراض (قانون ۱۲: پول بده و تمام کن،
// یا رایگان دفاع کن و صبرِ بیشتری بخر). دفاع پولی نمی‌گیرد؛ فقط روزهای اعتراض می‌مانَد و راهِ توافق بسته می‌شود.
export async function defendObjection(userId: string, assetId: string, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    const ob = a?.permit?.objection
    if (!a || !a.permit || !ob) return 'اعتراضی در کار نیست'
    if (ob.settled) return 'اعتراض قبلاً با توافق حل شده'
    if (ob.defended) return 'دفاعت از قبل ثبت شده — در انتظارِ رأیِ کمیسیون'
    ob.defended = true
    e.timeline.push({ at: now, icon: '⚖️', title: 'تصمیم: دفاع در کمیسیون', detail: `بدونِ غرامت — بررسیِ پروانه ${ob.extraDays.toLocaleString('fa-IR')} روز طولانی‌تر می‌شود` })
    e.journal.push({ at: now, text: `به‌جای غرامت، راهِ دفاع را انتخاب کردی. صبر هم قیمتی دارد — ولی این‌بار پولش را نگه داشتی.` })
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
// نقشهٔ ساخت از طراحیِ معمار (فاز ۲۹): ابعادِ واقعیِ انتخابِ خودِ بازیکن — بنا/واحد/متراژ از design،
// روزها و هزینه متناسب با بنا نسبت به مبنای «بنای قانونی» مقیاس می‌شوند.
// خودکفا: به زنده‌بودنِ آگهیِ واقعی وابسته نیست — آگهی‌ها می‌چرخند اما نقشهٔ امضاشده ابعادش را دارد
// (باگِ «سازه/کیفیت یا متراژ نامشخص» وقتی آگهیِ زمین بینِ طراحی و کلنگ از استخر می‌افتاد).
export function designBuildPlanOf(structure: string, quality: string, landArea: number,
  design: { footprint: number; floors: number; unitsPerFloor: number; unitArea: number; legalFloors: number; landArea?: number },
  cfg: { buildFactor: number; costPerM: number; buildDays: number }): ReturnType<typeof buildPlanOf> {
  const s = BUILD_STRUCTURES[structure], q = BUILD_QUALITIES[quality]
  if (!s || !q) return null
  const builtArea = design.footprint * design.floors
  const la = landArea > 0 ? landArea : (design.landArea || 0)
  // مبنای زمان: بنای قانونی — از زمین×تراکم اگر متراژ داریم، وگرنه از خودِ نقشه (footprint×طبقاتِ قانونی)
  const baseArea = la > 0 ? Math.max(1, Math.round(la * Math.max(0.5, cfg.buildFactor))) : Math.max(1, design.footprint * Math.max(1, design.legalFloors))
  return {
    days: Math.max(3, Math.round(cfg.buildDays * s.daysMul * builtArea / baseArea)),
    builtArea, unitArea: design.unitArea, totalUnits: design.floors * design.unitsPerFloor,
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
// نامِ دلخواهِ دارایی (قانونِ ۱۳): بازیکن روی خانه/زمین/برجش اسم می‌گذارد — هویتی، بدونِ هیچ اثرِ اقتصادی.
export async function setAssetNickname(userId: string, assetId: string, name: string) {
  return mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    if (!a) return 'دارایی یافت نشد'
    const n = name.trim().slice(0, 24)
    if (n) a.nickname = n; else delete a.nickname
  })
}

// سبک‌های نما (قانونِ ۱۳ رویاپردازی): انتخابِ صرفاً هویتی/ظاهری سرِ کلنگ — هیچ اثری روی هزینه/زمان/قیمت ندارد (قانون ۵).
export const BUILD_FACADES = [
  { key: 'modern', icon: '🏙', label: 'مدرن و شیشه‌ای' },
  { key: 'classic', icon: '🏛', label: 'کلاسیک با سنگِ سفید' },
  { key: 'roman', icon: '🏰', label: 'رومی' },
  { key: 'green', icon: '🌿', label: 'سبز با تراس‌های گیاهی' },
] as const

export async function startBuild(userId: string, assetId: string, plan: NonNullable<ReturnType<typeof buildPlanOf>>, meta: { structure: string; quality: string; goal?: string; name?: string; facade?: string }, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    if (!a) return 'دارایی یافت نشد'
    if (a.permit?.status !== 'granted') return 'اول پروانهٔ ساخت را بگیر'
    if (a.construction) return 'ساختِ این پروژه شروع شده'
    const goal = meta.goal && PROJECT_GOALS[meta.goal] ? meta.goal : undefined
    // فاز ۲۹: واحدهای طبقاتِ مازادِ نقشه از همان کلنگ «غیرمجاز» علامت می‌خورند — پیش‌فروش/فروششان بسته است تا ماده۱۰۰.
    const illegalUnits = a.design ? Math.max(0, a.design.illegalFloors * a.design.unitsPerFloor) : 0
    const dreamName = (meta.name || '').trim().slice(0, 28) || undefined
    const facade = BUILD_FACADES.some(f => f.key === meta.facade) ? meta.facade : undefined
    a.construction = {
      startedAt: now, days: plan.days, days0: plan.days, goal, name: dreamName, facade,
      structure: meta.structure, quality: meta.quality, qualityFactor: plan.qualityFactor,
      builtArea: plan.builtArea, unitArea: plan.unitArea, totalUnits: plan.totalUnits,
      costTotal: plan.costTotal, paid: 0, paidDays: 0, lastPayAt: now,
      presold: 0, sold: 0, presaleRevenue: 0, eventsFired: 0,
      illegalUnits: illegalUnits > 0 ? illegalUnits : undefined,
    }
    e.timeline.push({ at: now, icon: '⛏', title: `کلنگ‌زنیِ ${dreamName ? `«${dreamName}»` : 'پروژه'} با ${proPersonaOf('contractor', a.id)} — ساخت آغاز شد`, detail: `${a.title.slice(0, 45)} · ${plan.builtArea.toLocaleString('fa-IR')} مترِ بنا · ${plan.totalUnits.toLocaleString('fa-IR')} واحد${illegalUnits > 0 ? ` · ⚠️ ${illegalUnits.toLocaleString('fa-IR')} واحدِ مازاد بر پروانه` : ''}${goal ? ` · هدف: ${PROJECT_GOALS[goal].label}` : ''}` })
    e.journal.push({ at: now, text: 'اولین کلنگِ پروژه زده شد. از امروز کارگاه هر روز هزینه دارد — مدیریتِ پول، خودِ ساخت است.' })
  })
}

// پیشرفتِ روزشمار (جلد ۷۱ «Cash Flow Crisis»): هر روزِ ساخت باید «پرداخت» شود؛ بی‌پولی = توقفِ کارگاه.
// در ایستگاه‌های ۳۰٪ و ۷۰٪ رویدادِ قطعی رخ می‌دهد و تا تصمیمِ بازیکن، پیشرفت می‌ایستد.
// رویدادِ ایستگاهِ ۳۰٪/۷۰٪ اگر paidDays روی چک‌پوینت باشد — true یعنی کار تا تصمیمِ بازیکن می‌ایستد.
// مشترک بین پیشرفتِ روزانه و شیفتِ شبانه (فاز ۲۷) تا کوین‌خرج نتواند از رویدادها فرار کند.
function fireCheckpointEvent(e: EmpireData, a: EmpireAsset, now: number): boolean {
  const c = a.construction!
  const checkpoints = [Math.ceil(c.days * 0.3), Math.ceil(c.days * 0.7)]
  const idx = checkpoints.indexOf(c.paidDays)
  if (idx < 0 || c.eventsFired > idx) return false
  c.eventsFired = idx + 1
  const ev = buildEventOf(e.userId, a.id, idx, c.costTotal)
  // تیمِ ماهر (مهارت ≥۵۰) هزینهٔ رویداد را کم می‌کند — همان اثری که روی کارتِ استخدام نوشته شده (GDD فصل ۴).
  const cut = teamSkillOf(e) >= 50 ? Math.max(0, Math.min(90, config().empire.build.eventSkillCutPct)) : 0
  // فاز ۷۰: بیمهٔ کارگاه — بعد از تخفیفِ تیم، coveragePct٪ باقیِ هزینه را بیمه می‌دهد (شفاف در متن)
  const insCut = c.insured && config().empire.insurance?.enabled ? Math.max(0, Math.min(95, config().empire.insurance.coveragePct)) : 0
  const payCost70 = Math.max(1, Math.round(ev.payCost * (1 - cut / 100) * (1 - insCut / 100)))
  c.pendingEvent = { ...ev, text: insCut > 0 ? `${ev.text} — 🛡 بیمه ${insCut.toLocaleString('fa-IR')}٪ هزینه را پوشش داد` : ev.text, payCost: payCost70, at: now }
  e.timeline.push({ at: now, icon: '⚠️', title: 'اتفاق در کارگاه', detail: c.pendingEvent.text })
  return true
}
// تکمیلِ پروژه وقتی همهٔ روزها پرداخت شد — تحویلِ پیش‌فروش‌ها، شمارنده‌ها، نشانِ First Tower.
function completeIfBuilt(e: EmpireData, a: EmpireAsset, now: number): boolean {
  const c = a.construction!
  if (!(c.paidDays >= c.days && !c.done)) return false
  c.done = true; c.doneAt = now
  // ماده۱۰۰ (فاز ۲۹): ساختمانِ متخلف که تمام شد، شهرداری می‌فهمد — کمیسیون تشکیل می‌شود.
  if ((c.illegalUnits || 0) > 0 && a.design && !a.m100) {
    const illegalArea = a.design.illegalFloors * a.design.footprint
    const fine = Math.max(1, Math.round(illegalArea * config().empire.build.costPerM * Math.max(0.1, config().empire.m100.finePerM2Mult)))
    a.m100 = { illegalArea, illegalUnits: c.illegalUnits!, fine, status: 'pending' }
    e.timeline.push({ at: now, icon: '⚖️', title: 'کمیسیونِ ماده۱۰۰ تشکیل شد', detail: `${a.design.illegalFloors.toLocaleString('fa-IR')} طبقهٔ مازاد بر پروانه — جریمه ${Math.round(fine / 1e6).toLocaleString('fa-IR')}م تومان یا تخریب` })
  }
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
  return true
}

// ⚡ شیفتِ شبانه (فاز ۲۷ — قانون ۵ «پرداخت فقط برای سرعت»): روزهای کاری را همین حالا جلو می‌اندازد.
// پول غیب نمی‌شود: هزینهٔ تومانیِ هر روز مثل همیشه از سرمایه کم می‌شود؛ ملک‌کوین فقط «زمان» می‌خرد.
// از همان چک‌پوینت‌ها رد می‌شود — با کوین نمی‌توان از رویدادِ کارگاه فرار کرد.
export async function boostBuild(userId: string, assetId: string, days: number, coinsPerDay: number, now = Date.now()): Promise<{ ok: boolean; reason?: string; advanced?: number; empire?: EmpireData }> {
  let advanced = 0
  const r = await mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    const c = a?.construction
    if (!a || !c || c.done) return 'کارگاهِ فعالی نیست'
    if (c.pendingEvent) return 'اول تکلیفِ اتفاقِ کارگاه را روشن کن — شیفتِ شبانه از رویداد رد نمی‌شود'
    const dailyCost = Math.max(1, Math.round(c.costTotal / c.days))
    for (let d = 0; d < days && c.paidDays < c.days; d++) {
      if (e.coins < coinsPerDay) { if (!advanced) return 'ملک‌کوینِ کافی نداری'; break }
      if (e.capital < dailyCost) { if (!advanced) return 'سرمایهٔ نقدِ کافی برای هزینهٔ روزِ جلوافتاده نیست'; break }
      e.coins -= Math.max(0, coinsPerDay)
      e.capital -= dailyCost
      c.paid += dailyCost
      c.paidDays += 1
      advanced++
      if (fireCheckpointEvent(e, a, now)) break
    }
    if (!advanced) return 'روزی برای جلوانداختن نمانده'
    e.timeline.push({ at: now, icon: '⚡', title: `شیفتِ شبانه: ${advanced.toLocaleString('fa-IR')} روزِ کاری جلو افتاد`, detail: a.title.slice(0, 50) })
    completeIfBuilt(e, a, now)
  })
  if (!r.ok) return { ok: false, reason: r.reason }
  return { ok: true, advanced, empire: r.empire }
}

// 🪙 شارژِ ملک‌کوینِ خریداری‌شده (فاز ۲۸ — تنها نقطهٔ ورودِ پولِ واقعی به دنیای رشد؛ کوین فقط
// سرعت/تحلیل/ظاهر می‌خرد، هرگز قدرت — بدونِ P2W). ایدمپوتنت با کلیدِ claims = authority تا
// رفرشِ صفحهٔ بازگشتِ درگاه دوبار شارژ نکند.
export async function creditCoinPurchase(userId: string, opts: { coins: number; label: string; authority: string; refId?: string }, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const key = 'coinpay_' + opts.authority
    if (e.claims[key]) return 'این پرداخت قبلاً اعمال شده'
    e.claims[key] = now
    e.coins += Math.max(0, Math.round(opts.coins))
    e.timeline.push({ at: now, icon: '🪙', title: `شارژِ ملک‌کوین: ${Math.round(opts.coins).toLocaleString('fa-IR')} کوین (${opts.label.slice(0, 40)})`, detail: opts.refId ? `کدِ پیگیری ${opts.refId}` : undefined })
  })
}

// متراژ از متنِ واقعیِ خودِ آگهی (فیدبکِ کاربر: «اگر تو آگهی نیست، از فرمول حساب کن»).
// «کلنگی ۲۱۰ متری بر ۷ متری مفتح» → ۲۱۰: بزرگ‌ترین «N متر»ِ متن، چون برِ گذر همیشه از عرصه کوچک‌تر است؛
// اعدادِ زیرِ ۳۰ (برِ کوچه) و بدونِ «متر» (سالِ ساخت و…) اصلاً کاندید نمی‌شوند.
export function areaFromText(...texts: Array<string | undefined>): number {
  let best = 0
  for (const t of texts) {
    if (!t) continue
    const s = String(t).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    for (const m of s.matchAll(/(\d{2,6})\s*متر/g)) {
      const n = Number(m[1])
      if (n >= 30 && n <= 100_000 && n > best) best = n
    }
  }
  return best
}

// ══════════ فاز ۳۷ — بازارِ بازیکنان، مشارکتِ ساخت (درخواستِ مستقیم) ══════════

// تراکنشِ اتمیکِ دو-کاربره: هر جابه‌جاییِ پول/دارایی بینِ دو بازیکن باید یا کامل انجام شود یا هیچ.
// PG: هر دو ردیف با FOR UPDATE و به ترتیبِ userId قفل می‌شوند (بدونِ deadlock)؛ فایل: تک‌پروسه‌ایِ dev.
async function twoUserTx(aId: string, bId: string, fn: (a: EmpireData, b: EmpireData) => void | string): Promise<{ ok: boolean; reason?: string; a?: EmpireData; b?: EmpireData }> {
  if (!aId || !bId || aId === bId) return { ok: false, reason: 'دو طرفِ معامله نامعتبرند' }
  if (pgEnabled()) {
    await ensure()
    return pgTx(async c => {
      const [id1, id2] = [aId, bId].sort()
      const r1 = await c.query(`SELECT data FROM reos_empire WHERE user_id=$1 FOR UPDATE`, [id1])
      const r2 = await c.query(`SELECT data FROM reos_empire WHERE user_id=$1 FOR UPDATE`, [id2])
      const byId: Record<string, EmpireData | undefined> = { [id1]: r1.rows[0]?.data, [id2]: r2.rows[0]?.data }
      const a = byId[aId], b = byId[bId]
      if (!a || !b) return { ok: false, reason: 'یکی از دو امپراتوری یافت نشد' }
      const err = fn(a, b)
      if (err) return { ok: false, reason: err }
      const now = Date.now(); a.updatedAt = now; b.updatedAt = now
      await c.query(`UPDATE reos_empire SET data=$2, at=$3 WHERE user_id=$1`, [a.userId, JSON.stringify(a), now])
      await c.query(`UPDATE reos_empire SET data=$2, at=$3 WHERE user_id=$1`, [b.userId, JSON.stringify(b), now])
      return { ok: true, a, b }
    })
  }
  const db = fileLoad()
  const a = db[aId], b = db[bId]
  if (!a || !b) return { ok: false, reason: 'یکی از دو امپراتوری یافت نشد' }
  const err = fn(a, b)
  if (err) return { ok: false, reason: err }
  const now = Date.now(); a.updatedAt = now; b.updatedAt = now
  fileSave(db)
  return { ok: true, a, b }
}

// تقسیمِ شفافِ پولِ معاملهٔ بازیکن‌بابازیکن (خالص، تست‌پذیر): خریدار قیمت+مالیات می‌دهد (مالیات → خزانهٔ خریدار)؛
// فروشنده قیمت−کمیسیونِ مشاور می‌گیرد (کمیسیون → servicesPaid فروشنده) — بقای پول (قانون ۶).
export function tradeSplitOf(price: number, taxPct: number, commissionPct: number) {
  const p = Math.max(0, Math.round(price))
  const tax = Math.round(p * Math.max(0, taxPct) / 100)
  const commission = Math.round(p * Math.max(0, commissionPct) / 100)
  return { price: p, tax, commission, buyerPays: p + tax, sellerGets: p - commission }
}

// عرضهٔ دارایی به بازیکنانِ دیگر (۰ = لغو). وسطِ ساخت یا با پروندهٔ بازِ ماده۱۰۰ سند نمی‌خورد.
export async function setForSale(userId: string, assetId: string, price: number) {
  return mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    if (!a) return 'دارایی یافت نشد'
    if (a.construction && !a.construction.done) return 'وسطِ ساخت نمی‌شود به بازیکنان فروخت — اول پروژه را تحویل بده یا از «فروشِ پروژه» استفاده کن'
    if (a.m100?.status === 'pending') return 'تا حلِ پروندهٔ ماده۱۰۰ سند نمی‌خورد'
    if ((a.unitsOwned || 1) < (a.unitsTotal || a.unitsOwned || 1) && (a.unitsOwned || 0) > 0 && a.unitsTotal && a.unitsOwned !== a.unitsTotal) return 'تجمیعِ ناتمام را نمی‌شود عرضه کرد — یا کاملش کن یا واحدهایت را در بازارِ عادی بفروش'
    const p = Math.max(0, Math.round(price))
    a.forSale = p > 0 ? p : undefined
    if (p > 0) e.timeline.push({ at: Date.now(), icon: '🏪', title: `«${a.title.slice(0, 50)}» در بازارِ بازیکنان عرضه شد`, detail: `${Math.round(p / 1e6).toLocaleString('fa-IR')}م تومان` })
  })
}

// معاملهٔ بازیکن‌بابازیکن: دارایی با تمامِ ویژگی‌های واقعی‌اش (نقشه/بازسازی/واحدها) منتقل می‌شود؛
// قراردادهای شخصیِ فروشنده (اجاره/کسب‌وکار/عرضه) پاک می‌شوند — مالکِ جدید خودش تصمیم می‌گیرد.
export async function tradeAsset(sellerId: string, buyerId: string, assetId: string, opts: { taxPct: number; commissionPct: number; auctionPrice?: number }, now = Date.now()): Promise<{ ok: boolean; reason?: string; price?: number; profit?: number; listingId?: string }> {
  let price = 0, profit = 0, listingId = ''
  const r = await twoUserTx(sellerId, buyerId, (seller, buyer) => {
    const i = seller.assets.findIndex(x => x.id === assetId)
    const a = seller.assets[i]
    // فاز ۶۴: تسویهٔ چکشِ مزایدهٔ بازیکنان از همین مسیرِ اتمیک — قیمت = پیشنهادِ برنده، نه forSale
    const ask = opts.auctionPrice && a?.p2pAuction ? opts.auctionPrice : (a?.forSale || 0)
    if (!a || !(ask > 0)) return 'این دارایی دیگر در بازارِ بازیکنان نیست'
    if (buyer.assets.some(x => x.listingId === a.listingId)) return 'این ملک از قبل در امپراتوریِ توست'
    const s = tradeSplitOf(ask, opts.taxPct, opts.commissionPct)
    if (buyer.capital < s.buyerPays) return 'سرمایه کافی نیست (قیمت + مالیاتِ انتقال)'
    price = s.price; profit = s.price - a.buyPrice; listingId = a.listingId
    // پول — بقای کامل
    buyer.capital -= s.buyerPays
    buyer.taxPaid = (buyer.taxPaid || 0) + s.tax
    seller.capital += s.sellerGets
    seller.servicesPaid = (seller.servicesPaid || 0) + s.commission
    seller.realized = (seller.realized || 0) + profit
    if (profit > 0) { seller.stats = seller.stats || { sellsProfitable: 0, negoWins: 0 }; seller.stats.sellsProfitable += 1 }
    // دارایی — ویژگی‌های ملک منتقل، قراردادهای شخصی صفر
    seller.assets.splice(i, 1)
    buyer.assets.push({
      ...a, buyPrice: s.price, boughtAt: now,
      forSale: undefined, jvOffer: undefined, partners: undefined, p2pAuction: undefined,
      action: undefined, actionAt: undefined, business: undefined, businessProb: undefined,
      income: undefined, lastAccrualAt: undefined,
    })
    seller.timeline.push({ at: now, icon: '🤝', title: `«${a.title.slice(0, 40)}» را به «${buyer.name}» فروختی`, detail: `${Math.round(s.sellerGets / 1e6).toLocaleString('fa-IR')}م تومان (پس از کمیسیونِ مشاور)` })
    buyer.timeline.push({ at: now, icon: '🤝', title: `«${a.title.slice(0, 40)}» را از «${seller.name}» خریدی`, detail: `${Math.round(s.buyerPays / 1e6).toLocaleString('fa-IR')}م تومان (با مالیات)` })
  })
  return r.ok ? { ok: true, price, profit, listingId } : { ok: false, reason: r.reason }
}

// ══════════ فاز ۶۴ — مزایدهٔ بینِ بازیکنانِ «واقعی» (ممیزی: «مزایده بین کاربرها نیست») ══════════
// مکملِ بازارِ ثابت‌قیمت: مالک با «قیمتِ پایه + مهلتِ چندروزه» می‌گذارد؛ بازیکنانِ واقعی روی هم پیشنهاد
// می‌دهند (گامِ حداقلی knob)؛ پایانِ مهلت = چکش: بالاترین پیشنهادی که «سرِ چکش هم» پولش را دارد می‌بَرد —
// تسویه روی همان تراکنشِ اتمیکِ دو-کاربره (بقای کامل پول + مالیات/کمیسیون) + انتقالِ مالکیتِ انحصاری.
export async function openP2pAuction(userId: string, assetId: string, minBid: number, days: number, maxDays: number, day: number) {
  return mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    if (!a) return 'دارایی یافت نشد'
    if (a.construction && !a.construction.done) return 'وسطِ ساخت نمی‌شود به مزایده گذاشت — اول تحویل بده'
    if (a.m100?.status === 'pending') return 'تا حلِ پروندهٔ ماده۱۰۰ سند نمی‌خورد'
    if (a.p2pAuction) return 'همین حالا در مزایده است'
    const mb = Math.round(minBid), d = Math.min(Math.max(1, Math.floor(days) || 1), Math.max(1, maxDays))
    if (!(mb > 0)) return 'قیمتِ پایه را مشخص کن'
    a.forSale = undefined
    a.p2pAuction = { minBid: mb, endDay: day + d, startedDay: day, bids: [] }
    e.timeline.push({ at: Date.now(), icon: '🔨', title: `«${a.title.slice(0, 40)}» به مزایدهٔ بازیکنان رفت`, detail: `پایه ${Math.round(mb / 1e6).toLocaleString('fa-IR')}م تومان — چکش روزِ ${(day + d).toLocaleString('fa-IR')}` })
  })
}
export async function cancelP2pAuction(userId: string, assetId: string) {
  return mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    if (!a?.p2pAuction) return 'در مزایده نیست'
    if (a.p2pAuction.bids.length) return 'بعد از اولین پیشنهاد نمی‌شود لغو کرد — تا چکش صبر کن'
    a.p2pAuction = undefined
  })
}
// پیشنهاد روی داراییِ یک بازیکنِ دیگر — قواعدِ شفاف: بالاتر از پایه و از پیشنهادِ قبلی + گامِ knob؛ سرمایه همان لحظه چک می‌شود.
export async function bidP2pAuction(sellerId: string, bidder: { userId: string; no: number; name: string; capital: number }, assetId: string, amount: number, stepPct: number, day: number): Promise<{ ok: boolean; reason?: string; top?: number }> {
  let top = 0
  const r = await mutateEmpire(sellerId, e => {
    const a = e.assets.find(x => x.id === assetId)
    if (!a?.p2pAuction) return 'این مزایده دیگر باز نیست'
    if (day > a.p2pAuction.endDay) return 'مهلتِ این مزایده تمام شده — منتظرِ چکش باش'
    if (bidder.userId === sellerId) return 'روی داراییِ خودت نمی‌شود پیشنهاد داد'
    const cur = a.p2pAuction.bids[0]?.amount || 0
    const minNext = Math.max(a.p2pAuction.minBid, cur > 0 ? Math.ceil(cur * (1 + Math.max(0, stepPct) / 100)) : a.p2pAuction.minBid)
    const amt = Math.round(amount)
    if (!(amt >= minNext)) return `حداقلِ پیشنهاد ${Math.round(minNext / 1e6).toLocaleString('fa-IR')}م تومان است`
    if (bidder.capital < amt) return 'سرمایه‌ات از پیشنهادت کمتر است'
    a.p2pAuction.bids = [{ userId: bidder.userId, no: bidder.no, name: bidder.name, amount: amt, at: Date.now() }, ...a.p2pAuction.bids.filter(x => x.userId !== bidder.userId)].slice(0, 20)
    top = amt
  })
  return r.ok ? { ok: true, top } : { ok: false, reason: r.reason }
}
// چکش: بالاترین پیشنهادی که «هنوز» پولش را دارد؛ اگر هیچ‌کس نتوانست، مزایده صادقانه بی‌نتیجه بسته می‌شود.
export async function settleP2pAuctions(sellerId: string, day: number, opts: { taxPct: number; commissionPct: number }, now = Date.now()): Promise<Array<{ assetId: string; title: string; winner?: { no: number; name: string; userId: string }; price?: number; listingId?: string }>> {
  const seller = await getEmpire(sellerId)
  if (!seller) return []
  const ended = seller.assets.filter(a => a.p2pAuction && day > a.p2pAuction.endDay)
  const results: Array<{ assetId: string; title: string; winner?: { no: number; name: string; userId: string }; price?: number; listingId?: string }> = []
  for (const a of ended) {
    const bids = [...(a.p2pAuction!.bids || [])].sort((x, y) => y.amount - x.amount)
    let done = false
    for (const bid of bids) {
      const r = await tradeAsset(sellerId, bid.userId, a.id, { ...opts, auctionPrice: bid.amount }, now)
      if (r.ok) { results.push({ assetId: a.id, title: a.title, winner: { no: bid.no, name: bid.name, userId: bid.userId }, price: r.price, listingId: r.listingId }); done = true; break }
    }
    if (!done) {
      await mutateEmpire(sellerId, e => {
        const x = e.assets.find(y => y.id === a.id)
        if (x?.p2pAuction) { x.p2pAuction = undefined; e.timeline.push({ at: now, icon: '🔨', title: `مزایدهٔ «${a.title.slice(0, 40)}» بدونِ برنده بسته شد`, detail: bids.length ? 'هیچ پیشنهاددهنده‌ای سرِ چکش پولِ کافی نداشت' : 'در مهلتِ مزایده پیشنهادی نیامد' }) }
      }).catch(() => {})
      results.push({ assetId: a.id, title: a.title })
    }
  }
  return results
}

// پیشنهادِ مشارکتِ ساخت (پروژهٔ مشترک): مالک سهمِ ٪ از عایدیِ فروشِ پروژه را در برابرِ آوردهٔ نقدی عرضه می‌کند.
// قاعدهٔ شفاف: شریک = سرمایه‌گذار (آورده می‌دهد، سهمِ فروش می‌گیرد)؛ سازنده = مالک (هزینهٔ روزانهٔ کارگاه و اجاره با اوست).
export async function openPartnership(userId: string, assetId: string, pct: number, amount: number, maxPct: number) {
  return mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    if (!a) return 'دارایی یافت نشد'
    const buildable = (a.kind === 'land' && a.landPlan === 'build') || (a.construction && !a.construction.done)
    if (!buildable) return 'مشارکت فقط روی زمینِ آمادهٔ ساخت یا پروژهٔ در حالِ ساخت باز می‌شود'
    const p = Math.round(pct), amt = Math.round(amount)
    if (p <= 0) { a.jvOffer = undefined; return }
    const already = (a.partners || []).reduce((s, x) => s + x.pct, 0)
    if (already + p > Math.max(1, maxPct)) return `جمعِ سهمِ شرکا حداکثر ${Math.round(maxPct).toLocaleString('fa-IR')}٪ است (الان ${already.toLocaleString('fa-IR')}٪ واگذار شده)`
    if (!(amt > 0)) return 'آوردهٔ نقدیِ شریک را مشخص کن'
    a.jvOffer = { pct: p, amount: amt }
    e.timeline.push({ at: Date.now(), icon: '🤝', title: `پیشنهادِ مشارکت روی «${a.title.slice(0, 40)}»`, detail: `${p.toLocaleString('fa-IR')}٪ در برابرِ ${Math.round(amt / 1e6).toLocaleString('fa-IR')}م تومان آورده` })
  })
}

// پیوستن به مشارکت: آوردهٔ شریک → سرمایهٔ سازنده (تأمینِ مالیِ ساخت)؛ سهم روی دارایی ثبت می‌شود.
export async function joinPartnership(ownerId: string, partnerId: string, assetId: string, now = Date.now()): Promise<{ ok: boolean; reason?: string; pct?: number; amount?: number }> {
  let pct = 0, amount = 0
  const r = await twoUserTx(ownerId, partnerId, (owner, partner) => {
    const a = owner.assets.find(x => x.id === assetId)
    if (!a || !a.jvOffer) return 'این پیشنهادِ مشارکت دیگر باز نیست'
    if ((a.partners || []).some(x => x.userId === partner.userId)) return 'از قبل شریکِ همین پروژه‌ای'
    if (partner.capital < a.jvOffer.amount) return 'سرمایه برای آوردهٔ مشارکت کافی نیست'
    pct = a.jvOffer.pct; amount = a.jvOffer.amount
    partner.capital -= amount
    owner.capital += amount
    a.partners = a.partners || []
    a.partners.push({ userId: partner.userId, no: partner.no, name: partner.name, pct, paid: amount, at: now })
    a.jvOffer = undefined
    owner.timeline.push({ at: now, icon: '🤝', title: `«${partner.name}» شریکِ ${pct.toLocaleString('fa-IR')}٪ پروژه شد`, detail: `آورده ${Math.round(amount / 1e6).toLocaleString('fa-IR')}م تومان · ${a.title.slice(0, 40)}` })
    partner.timeline.push({ at: now, icon: '🤝', title: `شریکِ ${pct.toLocaleString('fa-IR')}٪ پروژهٔ «${a.title.slice(0, 40)}» شدی`, detail: `آورده ${Math.round(amount / 1e6).toLocaleString('fa-IR')}م تومان — سهمت از هر فروش خودکار واریز می‌شود` })
  })
  return r.ok ? { ok: true, pct, amount } : { ok: false, reason: r.reason }
}

// هزینهٔ ثبتِ اتحاد (فاز ۳۷): اتمیک؛ هزینه → خزانه (بقای پول) + نقطهٔ تایم‌لاین.
export async function chargeClanFee(userId: string, fee: number, clanName: string, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const f = Math.max(0, Math.round(fee))
    if (e.capital < f) return 'سرمایه برای هزینهٔ ثبتِ اتحاد کافی نیست'
    e.capital -= f
    if (f > 0) e.taxPaid = (e.taxPaid || 0) + f
    e.timeline.push({ at: now, icon: '🏰', title: `اتحادِ «${clanName.slice(0, 30)}» ثبت شد`, detail: f > 0 ? `هزینهٔ ثبت ${Math.round(f / 1e6).toLocaleString('fa-IR')}م تومان → خزانه` : undefined })
  })
}

// تسویهٔ سهمِ شرکا از یک عایدیِ فروش (پیش‌فروش/فروشِ واحد/فروشِ پروژه): برای هر شریک یک انتقالِ اتمیک.
// لیستِ شرکا از بیرون می‌آید تا بعد از «فروشِ کلِ پروژه» (که دارایی حذف می‌شود) هم تسویه ممکن باشد.
export async function settlePartnerShares(ownerId: string, partners: Array<{ userId: string; no: number; name: string; pct: number }>, gross: number, label: string, now = Date.now()): Promise<Array<{ no: number; name: string; share: number }>> {
  const out: Array<{ no: number; name: string; share: number }> = []
  for (const p of partners) {
    const share = Math.round(Math.max(0, gross) * p.pct / 100)
    if (!(share > 0)) continue
    const r = await twoUserTx(ownerId, p.userId, (o, pr) => {
      if (o.capital < share) return 'موجودی برای تسویهٔ سهمِ شریک کافی نیست'
      o.capital -= share
      pr.capital += share
      pr.realized = (pr.realized || 0) + share
      o.timeline.push({ at: now, icon: '➗', title: `سهمِ ${p.pct.toLocaleString('fa-IR')}٪ «${p.name}» از ${label} تسویه شد`, detail: `${Math.round(share / 1e6).toLocaleString('fa-IR')}م تومان` })
      pr.timeline.push({ at: now, icon: '➗', title: `سهمِ ${p.pct.toLocaleString('fa-IR')}٪ تو از ${label} رسید`, detail: `${Math.round(share / 1e6).toLocaleString('fa-IR')}م تومان` })
    })
    if (r.ok) out.push({ no: p.no, name: p.name, share })
  }
  return out
}

// ══════════ فاز ۴۱ (سند ۲۸ فصل ۱۷ — Tycoon نه ERP) ══════════
// Part 07 «Big Deals»: معاملاتِ عادی جریانِ همیشگی‌اند؛ هفته‌ای «یک» ملکِ واقعیِ گران‌قیمت برای همهٔ
// بازیکنان رویدادِ ویژه می‌شود — انتخابِ قطعیِ «شهری» (نه per-user) تا رقابتِ واقعی بر سرِ همان یک ملک باشد
// (مالکیتِ انحصاریِ فاز ۳۷: اولین برنده صاحبش می‌شود). یک تلاشِ مذاکره در هفته؛ استراتژی دستِ بازیکن.

export function bigDealPickOf(week: number, items: Array<{ id: string; price: number }>, topPct: number): string | null {
  const priced = items.filter(x => x.price > 0)
  if (!priced.length) return null
  const sorted = [...priced].sort((a, b) => b.price - a.price)
  const pool = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * Math.max(1, topPct) / 100)))
  return pool
    .map(x => ({ id: x.id, r: createHash('sha1').update(`bigdeal|${week}|${x.id}`).digest().readUInt32BE(0) }))
    .sort((a, b) => a.r - b.r)[0].id
}

// سه استراتژیِ سند (تهاجمی/متعادل/محافظه‌کار): مبادلهٔ شفافِ شانس↔تخفیف — تصمیم با بازیکن، نتیجه قطعی از هش.
export const BIG_DEAL_STRATEGIES = [
  { key: 'bold', icon: '⚔️', label: 'تهاجمی', desc: 'پیشنهادِ پایین — یا تخفیفِ بزرگ یا شکست', chanceMod: -15, discountMult: 1.6 },
  { key: 'balanced', icon: '⚖️', label: 'متعادل', desc: 'تعادلِ شانس و تخفیف', chanceMod: 0, discountMult: 1 },
  { key: 'safe', icon: '🛡', label: 'محافظه‌کار', desc: 'شانسِ بالا — تخفیفِ کوچک‌تر', chanceMod: 15, discountMult: 0.5 },
] as const

export function bigDealNegoOf(userId: string, listingId: string, week: number, strategy: string, skill: number,
  cfg: { baseChancePct: number; discountMax: number }): { success: boolean; discountPct: number; chancePct: number; strategy: string } {
  const st = BIG_DEAL_STRATEGIES.find(s => s.key === strategy) || BIG_DEAL_STRATEGIES[1]
  const persona = ownerPersonaOf(listingId)
  const chancePct = Math.max(5, Math.min(90, Math.round(cfg.baseChancePct + skill / 2 + st.chanceMod + persona.mod)))
  const h = createHash('sha1').update(`${userId}|bigdeal|${week}|${listingId}|${st.key}`).digest()
  const success = (h.readUInt32BE(0) % 100) < chancePct
  const base = 1 + (h.readUInt32BE(4) % Math.max(1, cfg.discountMax))
  const discountPct = success ? Math.max(1, Math.min(cfg.discountMax, Math.round(base * st.discountMult))) : 0
  return { success, discountPct, chancePct, strategy: st.key }
}

// ثبتِ اتمیکِ تلاشِ هفتگی: کلیدِ claims جلوی تلاشِ دوم را می‌گیرد؛ تخفیفِ برنده سمتِ سرور ذخیره می‌شود
// (بازتولید با استراتژیِ ارسالیِ کلاینت سرِ خرید = درِ سوءاستفاده؛ پس همین‌جا قفل می‌شود).
export async function recordBigDealTry(userId: string, week: number, title: string, success: boolean, discountPct: number, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const key = `bd_${week}`
    if (e.claims[key]) return 'این هفته تلاشِ مذاکره‌ات را کرده‌ای'
    e.claims[key] = now
    if (success) {
      e.bigDealWin = { week, discountPct }
      e.timeline.push({ at: now, icon: '🔥', title: `مذاکرهٔ معاملهٔ بزرگ را بردی: «${title.slice(0, 28)}»`, detail: `${discountPct.toLocaleString('fa-IR')}٪ تخفیف — تا آخرِ هفته اعتبار دارد` })
    } else {
      e.timeline.push({ at: now, icon: '🚪', title: 'مذاکرهٔ معاملهٔ بزرگِ این هفته شکست خورد', detail: 'هفتهٔ بعد فرصتِ تازه‌ای می‌آید' })
    }
  })
}

// ── فاز ۴۱ Part 13: ورود/خروجِ وضعیتِ بحرانی — تشخیص در empire-intel (crisisOf)؛ این‌جا فقط ثبتِ اتمیک ──
// خروج از بحران = «ققنوس»: شمارندهٔ واقعی + تایم‌لاین (پیشنهادِ سند: بحران داستان بسازد، نه فقط باخت).
export async function noteCrisis(userId: string, active: boolean, now = Date.now()) {
  return mutateEmpire(userId, e => {
    if (active && !e.crisis) {
      e.crisis = { at: now }
      e.timeline.push({ at: now, icon: '🚨', title: 'واردِ وضعیتِ بحرانی شدی', detail: 'اتاقِ تحلیل تصمیم‌های نجات را نشان می‌دهد' })
    } else if (!active && e.crisis) {
      const days = Math.max(1, Math.round((now - e.crisis.at) / 864e5))
      delete e.crisis
      e.stats = e.stats || { sellsProfitable: 0, negoWins: 0 }
      e.stats.crisisRecovered = (e.stats.crisisRecovered || 0) + 1
      e.timeline.push({ at: now, icon: '🕊', title: 'از بحران بیرون آمدی', detail: `${days.toLocaleString('fa-IR')} روز دوام آوردی — این هم بخشی از هویتِ امپراتوری‌ات شد` })
    } else return 'بدونِ تغییر'
  })
}

// ══════════ فاز ۴۵ (سند ۲۹ — Auction Saga: «هر پیشنهاد یک حمله است، نه یک عدد») ══════════
// مزایدهٔ هفتگی روی یک آگهیِ «واقعی» (متمایز از معاملهٔ بزرگ): برآوردِ بازه‌ای نه عددِ دقیق، رقبای شخصیت‌دار
// با بودجهٔ پنهان + حافظه/انتقام، شایعاتِ لابی (هیچ‌کدام صددرصد قابلِ اعتماد نیست)، نبردِ نوبتیِ پیشنهاد —
// سبکِ بازیکن «از رفتارش» تفسیر می‌شود نه از منو (تصمیمِ صریحِ سند). همه‌چیز قطعی از هش (قانون ۷)؛
// «نفوذ» فقط از رفتارِ واقعیِ بازیکن کسب می‌شود، خریدنی نیست (قانون ۵ + سندِ «Auction Influence»).

export interface AuctionRival {
  key: string; name: string; ceo: string; icon: string; style: string; desc: string
  aggro: number      // ۰..۱۰۰ — چقدر زود و تند پیشنهاد می‌دهد
  patience: number   // ۰..۱۰۰ — چقدر در سکوت می‌ماند و آخرِ کار ضربه می‌زند
  budgetLo: number; budgetHi: number   // سقفِ بودجهٔ پنهان: ٪ از قیمتِ لنگر (بازهٔ قطعی از هش)
  fear: number       // ۰..۱۰۰ — احتمالِ جاخالی در برابرِ «پیشنهادِ سنگین»
}
export const AUCTION_RIVALS: AuctionRival[] = [
  { key: 'kamran', name: 'گروهِ کامران', ceo: 'کامران', icon: '🦁', style: 'عجول و آتشی', desc: 'زود وارد می‌شود و تند بالا می‌برد — اگر عصبی شود، دیگر اقتصادی فکر نمی‌کند', aggro: 85, patience: 15, budgetLo: 88, budgetHi: 118, fear: 30 },
  { key: 'naseri', name: 'هلدینگِ ناصری', ceo: 'ناصری', icon: '🦉', style: 'صبورِ خاموش', desc: 'تا آخرین لحظه ساکت می‌ماند؛ کارش خسته‌کردنِ بقیه است', aggro: 25, patience: 90, budgetLo: 95, budgetHi: 128, fear: 10 },
  { key: 'ofogh', name: 'شرکتِ افق', ceo: 'خانمِ افشار', icon: '🌅', style: 'وسواسِ محله', desc: 'پولِ بی‌حساب ندارد، ولی روی محله‌هایی که دوست دارد بیش از ارزش هم می‌پردازد', aggro: 55, patience: 45, budgetLo: 78, budgetHi: 132, fear: 45 },
  { key: 'atlas', name: 'هلدینگِ اطلس', ceo: 'مهندس اطلسی', icon: '🧊', style: 'سردِ منطقی', desc: 'ذره‌ای احساساتی نیست — قیمت از حسابش رد شود، همان لحظه بیرون می‌رود', aggro: 45, patience: 55, budgetLo: 84, budgetHi: 106, fear: 5 },
  { key: 'sepehr', name: 'گروهِ سپهر', ceo: 'سپهری', icon: '🦅', style: 'شکارچیِ لحظهٔ آخر', desc: 'در سکوت می‌آید و در ثانیه‌های آخر ضربه می‌زند', aggro: 35, patience: 80, budgetLo: 90, budgetHi: 124, fear: 15 },
]

// «همه مزایده‌ها یکسان نیستند» (سند ۲۹ Part 1): هر نوع، قیمتِ شروع و قواعدِ خودش را دارد.
export const AUCTION_TYPES = [
  { key: 'bank', fa: 'مزایدهٔ بانکی', icon: '🏦', desc: 'بانک برای وصولِ طلب می‌فروشد — قیمتِ شروعِ پایین، رقابتِ داغ', startPct: 62, influence: false },
  { key: 'gov', fa: 'مزایدهٔ دولتی', icon: '🏛', desc: 'فروشنده فقط به قیمت نگاه نمی‌کند — سابقه و نفوذِ شرکت‌ها هم امتیاز دارد', startPct: 70, influence: true },
  { key: 'corp', fa: 'مزایدهٔ شرکتی', icon: '🏢', desc: 'یک شرکت در حالِ کوچک‌سازی است — رقبای حرفه‌ای سرِ میزند', startPct: 72, influence: false },
  { key: 'estate', fa: 'مزایدهٔ ماترک', icon: '🕯', desc: 'وارث‌ها برای فروش عجله دارند — قیمتِ شروع وسوسه‌کننده است', startPct: 66, influence: false },
  { key: 'urgent', fa: 'مزایدهٔ اضطراری', icon: '⚡', desc: 'فروشِ فوری — همه‌چیز سریع‌تر از همیشه پیش می‌رود', startPct: 60, influence: false },
] as const

export interface AuctionRun {
  week: number; listingId: string; title: string; hood: string
  type: string             // کلیدِ AUCTION_TYPES
  anchor: number           // قیمتِ واقعیِ آگهی — تا پایان «پنهان» است و آخرِ کار رو می‌شود
  start: number; price: number
  leader: string           // 'me' | کلیدِ رقیب | '' (هنوز پیشنهادی نیست)
  round: number
  calls: number            // شمارشِ چکش در سکوت: «بار اول… بار دوم… بار سوم»
  rivals: Array<{ key: string; ceiling: number; out?: boolean }>
  rumors: Array<{ text: string; about: string; truth: boolean }>
  log: Array<{ icon: string; text: string }>
  done?: boolean; won?: boolean; final?: number
  at: number
}

// انتخابِ ملکِ مزایدهٔ هفته: شهری و قطعی (مثلِ معاملهٔ بزرگ ولی با نمکِ متفاوت) از باندِ میانیِ بازار —
// معاملهٔ بزرگ سگمنتِ لوکس را دارد؛ مزایده باید برای همهٔ سطح‌ها دست‌یافتنی باشد.
export function auctionPickOf(week: number, items: Array<{ id: string; price: number }>, excludeId?: string | null): string | null {
  const priced = items.filter(x => x.price > 0 && x.id !== excludeId)
  if (!priced.length) return null
  const sorted = [...priced].sort((a, b) => a.price - b.price)
  const lo = Math.floor(sorted.length * 0.2), hi = Math.max(lo + 1, Math.ceil(sorted.length * 0.8))
  const pool = sorted.slice(lo, hi)
  return pool
    .map(x => ({ id: x.id, r: createHash('sha1').update(`auction|${week}|${x.id}`).digest().readUInt32BE(0) }))
    .sort((a, b) => a.r - b.r)[0].id
}

// صحنه‌چینیِ قطعیِ مزایده: نوع + رقبا (۲..سقف) + سقفِ بودجهٔ پنهانِ هرکدام + شایعاتِ لابی.
// حافظه/انتقام (سند Part 5): هر بار که از جلوی رقیبی برده‌ای، سقفش بالاتر می‌رود — «دیگر اقتصادی فکر نمی‌کند».
export function auctionSetupOf(week: number, listingId: string, anchor: number, rivalScore: Record<string, number>,
  cfg: { rivalsMax: number; revengePct: number }): { type: typeof AUCTION_TYPES[number]; start: number; rivals: Array<{ key: string; ceiling: number }>; rumors: Array<{ text: string; about: string; truth: boolean }> } {
  const h = createHash('sha1').update(`auction|${week}|${listingId}|setup`).digest()
  const type = AUCTION_TYPES[h.readUInt32BE(0) % AUCTION_TYPES.length]
  const start = Math.max(1, Math.round(anchor * type.startPct / 100))
  const count = Math.max(2, Math.min(cfg.rivalsMax, 2 + (h.readUInt32BE(4) % Math.max(1, cfg.rivalsMax - 1))))
  const picked = AUCTION_RIVALS
    .map(r => ({ r, o: createHash('sha1').update(`auction|${week}|${listingId}|${r.key}`).digest().readUInt32BE(0) }))
    .sort((a, b) => a.o - b.o).slice(0, count)
  const rivals = picked.map(({ r }) => {
    const rh = createHash('sha1').update(`auction|${week}|${listingId}|${r.key}|budget`).digest()
    const pct = r.budgetLo + (rh.readUInt32BE(0) % Math.max(1, r.budgetHi - r.budgetLo + 1))
    const grudge = Math.min(3, Math.max(0, rivalScore[r.key] || 0))
    return { key: r.key, ceiling: Math.round(anchor * pct / 100 * (1 + grudge * Math.max(0, cfg.revengePct) / 100)) }
  })
  // شایعات (Part 2 لابی): دربارهٔ ۲ رقیب؛ هر شایعه با هش یا راست است یا دروغ — بعد از چکش رو می‌شود.
  const rumors = rivals.slice(0, 2).map((rv, i) => {
    const def = AUCTION_RIVALS.find(x => x.key === rv.key)!
    const lie = (h.readUInt32BE(8 + i * 4) % 100) < 40
    const rich = rv.ceiling >= anchor
    const claimRich = lie ? !rich : rich
    return {
      text: claimRich
        ? `یک نفر آرام کنارت می‌گوید: «شنیدم ${def.name} این هفته دستِ پُر آمده…»`
        : `خبرنگاری زیرِ لب می‌گوید: «می‌گویند ${def.name} سقفِ بودجه‌اش را بسته…»`,
      about: rv.key, truth: !lie,
    }
  })
  return { type, start, rivals, rumors }
}

// نفوذِ کسب‌شده (سندِ «Auction Influence» + Part 18: بهترین امتیازها earned هستند، نه خریدنی):
// همه از شمارنده‌های واقعیِ رفتارِ خودِ بازیکن — در مزایده‌های دولتی، رقیب باید با همین حاشیه از تو بالاتر برود.
export function auctionInfluenceOf(e: Pick<EmpireData, 'stats' | 'creditHist' | 'xp'>, max: number): { pct: number; reasons: string[] } {
  const reasons: string[] = []
  let pct = 0
  if ((e.stats?.sellsProfitable || 0) >= 3) { pct++; reasons.push('سابقهٔ فروش‌های سودده — بازار حرفه‌ای می‌داندت') }
  if ((e.stats?.projectsDelivered || 0) >= 1) { pct++; reasons.push('پروژهٔ تحویل‌داده — خوش‌قولی در ساخت') }
  if ((e.creditHist?.repaid || 0) >= 1 && (e.creditHist?.lateDays || 0) === 0) { pct++; reasons.push('خوش‌حسابِ بانک — بدونِ یک روز دیرکرد') }
  if ((e.stats?.crisisRecovered || 0) >= 1) { pct++; reasons.push('از بحران زنده بیرون آمده‌ای — اعتبارِ مقاومت') }
  if (empireLevel(e.xp).level >= 10) { pct++; reasons.push('قدمتِ امپراتوری — نامت را می‌شناسند') }
  return { pct: Math.min(Math.max(0, max), pct), reasons }
}

// قیمتِ پیشنهادِ بعدیِ بازیکن — یک منبعِ واحد برای موتور، گاردِ سرمایه و دکمه‌های UI.
export function auctionNextBidOf(run: Pick<AuctionRun, 'anchor' | 'price' | 'start' | 'leader'>, move: 'bid' | 'power', cfg: { stepPct: number; powerPct: number }): number {
  const step = Math.max(1, Math.round(run.anchor * Math.max(1, cfg.stepPct) / 100))
  const raise = move === 'power' ? Math.max(step * 2, Math.round(run.anchor * Math.max(1, cfg.powerPct) / 100)) : step
  return run.leader ? run.price + raise : (move === 'power' ? run.start + raise : run.start)
}

// یک حرکتِ بازیکن + واکنشِ قطعیِ رقبا — خالص (state جدید برمی‌گرداند، چیزی را تغییر نمی‌دهد).
// سبک از «رفتار» تفسیر می‌شود (تصمیمِ صریحِ سند: منوی Bid Style نه): bid=گامِ عادی، power=حملهٔ سنگین،
// wait=سکوت (چکش می‌شمارد؛ رقبا شاید با هم بجنگند)، quit=خروجِ آگاهانه.
export function auctionMoveOf(userId: string, run: AuctionRun, move: 'bid' | 'power' | 'wait' | 'quit', influencePct: number,
  cfg: { stepPct: number; powerPct: number; maxRounds: number }): AuctionRun {
  const r: AuctionRun = JSON.parse(JSON.stringify(run))
  if (r.done) return r
  const step = Math.max(1, Math.round(r.anchor * Math.max(1, cfg.stepPct) / 100))
  const h = createHash('sha1').update(`${userId}|au|${r.week}|${r.listingId}|${r.round}|${move}`).digest()
  const typeDef = AUCTION_TYPES.find(t => t.key === r.type) || AUCTION_TYPES[0]
  const infl = typeDef.influence ? Math.max(0, influencePct) : 0
  const defOf = (k: string) => AUCTION_RIVALS.find(x => x.key === k)!
  const active = () => r.rivals.filter(x => !x.out)
  const finish = (won: boolean) => { r.done = true; r.won = won; r.final = r.price }

  if (move === 'quit') {
    r.log.push({ icon: '🚪', text: 'کیفت را برداشتی و از تالار بیرون آمدی — همه برگشتند و نگاهت کردند' })
    finish(false)
    return r
  }
  if (move === 'bid' || move === 'power') {
    r.price = auctionNextBidOf(r, move, cfg)
    r.leader = 'me'; r.calls = 0
    r.log.push(move === 'power'
      ? { icon: '⚡', text: `حملهٔ سنگین! دستت را بالا بردی: ${Math.round(r.price / 1e6).toLocaleString('fa-IR')}م — سالن یک لحظه ساکت شد` }
      : { icon: '🖐', text: `پیشنهاد دادی: ${Math.round(r.price / 1e6).toLocaleString('fa-IR')}م تومان` })
    // ترسِ حملهٔ سنگین: بعضی رقبا همان لحظه جا خالی می‌دهند (قطعی از هش + شخصیت).
    if (move === 'power') {
      active().forEach((rv, i) => {
        const d = defOf(rv.key)
        if ((h.readUInt32BE(4 + i * 4) % 100) < d.fear || rv.ceiling < r.price) {
          rv.out = true
          r.log.push({ icon: '💨', text: `${d.icon} ${d.name} سرش را تکان داد و از رقابت بیرون رفت` })
        }
      })
    }
  }
  if (move === 'wait') {
    if (!r.leader) {
      r.log.push({ icon: '🤫', text: 'دست‌به‌سینه فقط نگاه می‌کنی — مجری منتظرِ اولین پیشنهاد است' })
    } else {
      r.calls++
      r.log.push({ icon: '🔨', text: r.calls === 1 ? 'مجری: «بار اول…»' : r.calls === 2 ? 'مجری: «بار دوم…»' : 'مجری چکش را بالا برد…' })
    }
  }
  // واکنشِ رقبا (حداکثر ۲ پیشنهاد در هر نوبت تا ریتم حفظ شود — قانونِ سند: هر چند ثانیه یک اتفاق).
  let rivalBids = 0
  const order = active().map((rv, i) => ({ rv, p: createHash('sha1').update(`${userId}|au|${r.week}|${r.round}|${rv.key}`).digest().readUInt32BE(0) })).sort((a, b) => a.p - b.p)
  for (const { rv } of order) {
    if (rivalBids >= 2 || r.done) break
    const d = defOf(rv.key)
    const next = (r.leader ? r.price : r.start) + (r.leader ? step : 0)
    const effCeil = r.leader === 'me' ? Math.round(rv.ceiling * (1 - infl / 100)) : rv.ceiling
    if (next > effCeil) {
      if (!rv.out && r.price > rv.ceiling * 0.92 && (h.readUInt32BE(16) % 2) === 0) {
        rv.out = true
        r.log.push({ icon: '🚶', text: `${d.icon} ${d.name} آرام بلند شد و رفت — انگار حسابش تمام شده بود` })
      }
      continue
    }
    // شخصیت: عجول‌ها زود می‌پرند؛ صبورها فقط وقتی چکش نزدیک است یا راندهای آخر.
    const urge = d.aggro + (r.calls > 0 ? d.patience : 0) + (r.round >= cfg.maxRounds - 2 ? 30 : 0)
    const roll = createHash('sha1').update(`${userId}|au|${r.week}|${r.round}|${rv.key}|roll`).digest().readUInt32BE(0) % 100
    if (roll < urge) {
      r.price = next
      r.leader = rv.key
      r.calls = 0
      rivalBids++
      r.log.push({ icon: d.icon, text: `${d.name} (${d.ceo}) پاسخ داد: ${Math.round(r.price / 1e6).toLocaleString('fa-IR')}م` })
    }
  }
  // سرنخِ اتاق (Reading The Room): نزدیک به سقف → عصبی؛ عدد نمی‌گوییم، رفتار می‌گوییم.
  for (const rv of active()) {
    const d = defOf(rv.key)
    if (r.price > rv.ceiling * 0.85 && (h.readUInt32BE(12) % 3) === 0) {
      r.log.push({ icon: '👀', text: `${d.ceo} مدام با تلفن حرف می‌زند و عصبی راه می‌رود…` })
      break
    }
  }
  r.round++
  // چکش: سه بارِ مجری در سکوت، یا حذفِ همهٔ رقبا وقتی تو صدرنشینی، یا سقفِ راندها.
  if (r.calls >= 3 && r.leader) finish(r.leader === 'me')
  else if (r.leader === 'me' && active().length === 0) { r.log.push({ icon: '🔨', text: 'مجری نگاهی به سالنِ ساکت انداخت و چکش را کوبید' }); finish(true) }
  else if (r.round >= Math.max(4, cfg.maxRounds)) {
    r.log.push({ icon: '🔨', text: 'وقتِ تالار تمام شد — چکش روی آخرین پیشنهاد کوبیده شد' })
    finish(r.leader === 'me')
  }
  if (r.done) {
    const est = r.anchor
    if (r.won) r.log.push({ icon: '🏆', text: `چکش کوبیده شد — «${r.title.slice(0, 30)}» مالِ توست: ${Math.round((r.final || 0) / 1e6).toLocaleString('fa-IR')}م تومان` })
    else if (r.leader && r.leader !== 'me') {
      const d = defOf(r.leader)
      r.log.push({ icon: '😔', text: `${d.name} برنده شد — ${(r.final || 0) > est ? 'ولی گران‌تر از قیمتِ واقعیِ آگهی خرید؛ شاید برندهٔ واقعی تویی' : 'این بار او زرنگ‌تر بود'}` })
    }
    // پرده‌برداری از شایعات: «هیچ خبری کاملاً قابلِ اعتماد نبود».
    for (const rm of r.rumors) {
      const d = defOf(rm.about)
      r.log.push({ icon: rm.truth ? '✅' : '🎭', text: rm.truth ? `آن شایعه دربارهٔ ${d.name} درست بود` : `شایعهٔ ${d.name} دروغ بود — یکی می‌خواست بازی‌ات بدهد` })
    }
    r.log.push({ icon: '📜', text: `قیمتِ واقعیِ آگهی حالا رو شد: ${Math.round(r.anchor / 1e6).toLocaleString('fa-IR')}م تومان` })
  }
  return r
}

// فاز ۴۸ (جوایزِ پولِ واقعی): ثبتِ یک‌بارهٔ ادعای هر مرحله + نقطهٔ تایم‌لاین — دفترِ درخواست‌ها در empire-rewards.
export async function markRewardClaimed(userId: string, step: number, amount: number, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const key = `rw_${step}`
    if (e.claims[key]) return 'برای این مرحله قبلاً درخواست داده‌ای'
    e.claims[key] = now
    e.timeline.push({ at: now, icon: '🎁', title: `درخواستِ جایزهٔ واقعیِ مرحلهٔ ${step.toLocaleString('fa-IR')} ثبت شد`, detail: `${Math.round(amount / 1e6).toLocaleString('fa-IR')}م تومان — پس از تأییدِ ملک‌جت به کیف‌پولت واریز می‌شود` })
  })
}

// فاز ۵۰ (سند ۳۰ Part 23 — Nemesis): دشمنی از برخوردهای «واقعی» شکل می‌گیرد نه از پیش — اعلامِ یک‌باره در تایم‌لاین.
export async function noteNemesis(userId: string, rivalKey: string, rivalName: string, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const key = `nem_${rivalKey}`
    if (e.claims[key]) return 'قبلاً ثبت شده'
    e.claims[key] = now
    e.timeline.push({ at: now, icon: '💢', title: `«${rivalName}» حریفِ قسم‌خورده‌ات شد`, detail: 'بارها از جلویش برده‌ای — از این به بعد رسانه‌ها رقابتِ شما را دنبال می‌کنند و او سرِ میزِ مزایده دیگر اقتصادی فکر نمی‌کند' })
  })
}

// مصرفِ بردِ مزایده بعد از خریدِ موفق — تا همان برد دوبار خرجِ خرید نشود.
export async function consumeAuctionWin(userId: string) {
  return mutateEmpire(userId, e => { if (!e.auctionWin) return 'بردِ مزایده‌ای در کار نیست'; delete e.auctionWin })
}

// ورود به تالار — اتمیک: یک ورود در هفته (کلیدِ claims)؛ ران تا پایان قابلِ ادامه است.
export async function startAuction(userId: string, week: number, run: Omit<AuctionRun, 'round' | 'calls' | 'leader' | 'log' | 'price'>, now = Date.now()) {
  return mutateEmpire(userId, e => {
    if (e.auctionRun && e.auctionRun.week === week && !e.auctionRun.done) return 'همین حالا داخلِ تالاری — نبرد را تمام کن'
    if (e.claims[`au_${week}`]) return 'این هفته واردِ تالار شده‌ای — مزایدهٔ بعدی هفتهٔ دیگر است'
    e.claims[`au_${week}`] = now
    e.auctionRun = { ...run, price: run.start, leader: '', round: 0, calls: 0, log: [{ icon: '🏛', text: 'واردِ تالار شدی — نورِ سالن کم شد و همهمه خوابید' }] }
    e.stats = e.stats || { sellsProfitable: 0, negoWins: 0 }
    e.stats.auctionTries = (e.stats.auctionTries || 0) + 1
    e.timeline.push({ at: now, icon: '🏛', title: `واردِ تالارِ مزایده شدی: «${run.title.slice(0, 28)}»`, detail: 'رقبا سرِ میزند — هر حرکتت خوانده می‌شود' })
  })
}

// یک حرکت در تالار — اتمیک: نتیجه با موتورِ خالص محاسبه و همان‌جا قفل می‌شود؛ برد → auctionWin ضدِ دستکاری.
export async function applyAuctionMove(userId: string, week: number, move: 'bid' | 'power' | 'wait' | 'quit', influencePct: number,
  cfg: { stepPct: number; powerPct: number; maxRounds: number; xpWin: number; xpTry: number }, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const run = e.auctionRun
    if (!run || run.week !== week) return 'مزایدهٔ فعالی نداری — اول واردِ تالار شو'
    if (run.done) return 'این مزایده تمام شده'
    if ((move === 'bid' || move === 'power') && auctionNextBidOf(run, move, cfg) > e.capital) return 'سرمایه‌ات به این قیمت نمی‌رسد — پیشنهادی که نتوانی بپردازی، بلوفِ خطرناکی است'
    const next = auctionMoveOf(userId, run, move, influencePct, cfg)
    e.auctionRun = next
    if (next.done) {
      e.xp += Math.max(0, next.won ? cfg.xpWin : cfg.xpTry)
      if (next.won) {
        e.auctionWin = { week, listingId: next.listingId, price: next.final || next.price }
        e.stats = e.stats || { sellsProfitable: 0, negoWins: 0 }
        e.stats.auctionWins = (e.stats.auctionWins || 0) + 1
        // حافظهٔ رقبا: از جلوی هر رقیبِ حاضر بردی — دفعهٔ بعد شخصی‌ترش می‌کنند.
        e.rivalScore = e.rivalScore || {}
        for (const rv of next.rivals) e.rivalScore[rv.key] = (e.rivalScore[rv.key] || 0) + 1
        const over = (next.final || 0) > next.anchor
        e.timeline.push({ at: now, icon: '🏆', title: `چکشِ تالار به نامِ تو کوبیده شد: «${next.title.slice(0, 28)}»`, detail: over ? 'رسانه‌ها: «گران خرید» — حالا باید ثابت کنی اشتباه می‌کنند' : 'رسانه‌ها: «با هوش خرید، نه فقط با پول»' })
        e.journal.push({ at: now, text: over ? `مزایده را بردی ولی بالاتر از قیمتِ آگهی — بازار حواسش هست.` : `مزایده را زیرِ قیمتِ آگهی بردی. این همان معامله‌هایی است که ازش داستان می‌سازند.` })
      } else {
        const walked = next.log.some(l => l.icon === '🚪')
        const overpaidRival = !!next.leader && next.leader !== 'me' && (next.final || 0) > next.anchor
        e.timeline.push({ at: now, icon: walked ? '🚪' : '😔', title: walked ? 'آگاهانه از مزایده بیرون آمدی' : 'مزایدهٔ این هفته را واگذار کردی', detail: overpaidRival ? 'رقیب گران‌تر از قیمتِ واقعی خرید — کنار کشیدنت حرفه‌ای بود' : 'هفتهٔ بعد تالار دوباره باز می‌شود' })
      }
    }
  })
}
// قوانینِ قابل‌تعریفِ بازیکن: فقط notify/recommend — «هیچ اقدامِ مالی کاملاً خودکار انجام نمی‌شود» (قانونِ سختِ سند).
// ارزیابیِ شرط‌ها در empire-intel (خالص)؛ این‌جا فقط CRUD اتمیک + ثبتِ فعال‌شدن (هر قانون حداکثر یک‌بار در روز).

export async function setAutoRule(userId: string, rule: { id?: string; kind: string; threshold: number; level: 'notify' | 'recommend' }, maxRules: number, now = Date.now()) {
  return mutateEmpire(userId, e => {
    if (!(rule.threshold > 0)) return 'آستانهٔ قانون باید بزرگ‌تر از صفر باشد'
    e.autoRules = e.autoRules || []
    const ex = rule.id ? e.autoRules.find(r => r.id === rule.id) : undefined
    if (ex) { ex.threshold = rule.threshold; ex.level = rule.level; return }
    if (e.autoRules.length >= Math.max(1, maxRules)) return `حداکثر ${Math.max(1, maxRules).toLocaleString('fa-IR')} قانونِ فعال می‌توانی داشته باشی — یکی را حذف کن`
    e.autoRules.push({ id: 'r' + now.toString(36) + Math.floor(now % 997), kind: rule.kind, threshold: rule.threshold, level: rule.level, enabled: true, createdAt: now })
  })
}

export async function delAutoRule(userId: string, ruleId: string) {
  return mutateEmpire(userId, e => {
    const before = (e.autoRules || []).length
    e.autoRules = (e.autoRules || []).filter(r => r.id !== ruleId)
    if (e.autoRules.length === before) return 'قانون یافت نشد'
  })
}

export async function toggleAutoRule(userId: string, ruleId: string) {
  return mutateEmpire(userId, e => {
    const r = (e.autoRules || []).find(x => x.id === ruleId)
    if (!r) return 'قانون یافت نشد'
    r.enabled = !r.enabled
  })
}

// ثبتِ فعال‌شدنِ قانون‌ها در دفترِ ثبت (Part 13 «Log») — کلیدِ روزانهٔ claims جلوی تکرارِ همان قانون در همان روز را می‌گیرد.
export async function recordRuleFires(userId: string, alerts: Array<{ ruleId: string; icon: string; text: string }>, day: number, logCap = 30, now = Date.now()) {
  if (!alerts.length) return { ok: true }
  return mutateEmpire(userId, e => {
    for (const a of alerts) {
      const key = `rl_${a.ruleId}_${day}`
      if (e.claims[key]) continue
      e.claims[key] = now
      e.ruleLog = e.ruleLog || []
      e.ruleLog.unshift({ at: now, icon: a.icon, text: a.text })
    }
    if (e.ruleLog && e.ruleLog.length > logCap) e.ruleLog = e.ruleLog.slice(0, logCap)
  })
}

// سپرِ نرخِ درخواست (فاز ۳۴ — سند ۲۳ Part 04): شمارندهٔ پنجرهٔ یک‌دقیقه‌ای، خالص و تست‌پذیر.
// limit ≤ 0 یعنی خاموش. state قبلی همان دقیقه → شمارش بالا؛ دقیقهٔ جدید → پنجرهٔ تازه.
export function rateHit(state: { m: number; n: number } | undefined, nowMin: number, limit: number): { state: { m: number; n: number }; limited: boolean } {
  if (limit <= 0) return { state: { m: nowMin, n: 0 }, limited: false }
  const s = state && state.m === nowMin ? { m: nowMin, n: state.n + 1 } : { m: nowMin, n: 1 }
  return { state: s, limited: s.n > limit }
}

// ══════════ فاز ۳۳ (سند ۲۲ — فصل ۱۲ Monetization) ══════════

// بسته‌های فعالِ فروشگاهِ کوین: بستهٔ زمان‌دار (فصل ۷ Bundles) تا پایانِ روزِ until معتبر است —
// تایمر واقعی است (تاریخِ ادمین)، نه نمایشی («پیشنهادهای فریبنده با تایمرِ غیرواقعی» ممنوع).
export function activeCoinPacks<T extends { enabled: boolean; coins: number; priceToman: number; until?: string }>(packs: T[], now = Date.now()): T[] {
  return (packs || []).filter(p => {
    if (!p.enabled || p.coins <= 0 || p.priceToman <= 0) return false
    if (p.until && /^\d{4}-\d{2}-\d{2}$/.test(p.until)) return now <= Date.parse(p.until + 'T23:59:59')
    return !p.until
  })
}

// 🎨 خریدِ آیتمِ ظاهری با ملک‌کوین (فصل ۳ Cosmetic Store): «هیچ آیتمِ ظاهری روی اقتصاد، سرعتِ ساخت،
// سود یا قدرتِ رقابتی اثر نمی‌گذارد» — فقط قاب/نشانِ نمایشی که دیگران در لیدربورد/پروفایل می‌بینند.
export async function buyCosmetic(userId: string, item: { id: string; label: string; icon: string; kind: 'frame' | 'flair'; priceCoins: number }, now = Date.now()) {
  return mutateEmpire(userId, e => {
    const c = e.cosmetics || (e.cosmetics = { owned: [] })
    if (c.owned.includes(item.id)) return 'این آیتم را قبلاً خریده‌ای'
    const price = Math.max(0, Math.round(item.priceCoins))
    if (e.coins < price) return 'ملک‌کوینِ کافی نداری'
    e.coins -= price
    c.owned.push(item.id)
    if (item.kind === 'frame' && !c.frame) c.frame = item.id
    if (item.kind === 'flair' && !c.flair) c.flair = item.id
    e.timeline.push({ at: now, icon: '🎨', title: `${item.label} به مجموعه‌ات اضافه شد (${price.toLocaleString('fa-IR')} کوین)` })
  })
}

// فعال/غیرفعال‌کردنِ آیتمِ ظاهریِ خریداری‌شده (id خالی = برداشتن).
export async function setCosmetic(userId: string, kind: 'frame' | 'flair', id: string) {
  return mutateEmpire(userId, e => {
    const c = e.cosmetics || (e.cosmetics = { owned: [] })
    if (id && !c.owned.includes(id)) return 'این آیتم را نداری'
    c[kind] = id || undefined
  })
}

// 🎁 موتورِ پیشنهادِ هوشمند (فصل ۹ Special Offers): قطعی از رفتارِ واقعیِ بازیکن — حداکثر ۱ در روز،
// قابلِ‌بستن با یک لمس، بدونِ تایمرِ ساختگی. قانون‌ها به‌ترتیبِ اولویت؛ اولین قانونِ برقرارِ بسته‌نشده برنده است.
export type EmpireOffer = { id: string; icon: string; title: string; text: string; cta: string; goto: 'coins' | 'cosmetics' }
export function offerOf(
  e: Pick<EmpireData, 'createdAt' | 'claims' | 'coins' | 'xp' | 'stats' | 'cosmetics' | 'offerHist'>,
  day: number,
  cfg: { enabled: boolean; cooldownDays: number; minAgeDays: number },
  catalog: Array<{ id: string; label: string; icon: string; kind: 'frame' | 'flair'; priceCoins: number; enabled: boolean }>,
  packs: Array<{ id: string; label: string; coins: number; priceToman: number }>,
): EmpireOffer | null {
  if (!cfg.enabled) return null
  if (day - dayNumberOf(e.createdAt) < Math.max(0, cfg.minAgeDays)) return null   // روزهای اول: هیچ پیشنهادی — اول تجربه، بعد فروشگاه
  const items = (catalog || []).filter(i => i.enabled && i.priceCoins > 0)
  const owned = e.cosmetics?.owned || []
  const level = empireLevel(e.xp).level
  const candidates: EmpireOffer[] = []
  // ۱) اولین شارژ: هنوز هیچ خریدِ واقعی نداشته و کوینش کم است → کوچک‌ترین بستهٔ فعال (بدونِ تخفیفِ ساختگی)
  const everPaid = Object.keys(e.claims || {}).some(k => k.startsWith('coinpay_'))
  const cheapestPack = [...(packs || [])].sort((a, b) => a.priceToman - b.priceToman)[0]
  if (!everPaid && cheapestPack && e.coins < cheapestPack.coins)
    candidates.push({ id: 'off_first', icon: '🪙', title: 'اولین شارژِ ملک‌کوین', text: `کیفِ کوینت سبک است؛ ${cheapestPack.label} (${cheapestPack.coins.toLocaleString('fa-IR')} کوین) کوچک‌ترین راهِ شروع است — کوین فقط سرعت، تحلیل و ظاهر می‌خرد.`, cta: 'دیدنِ بسته‌ها', goto: 'coins' })
  // ۲) قابِ پروفایل: به سطحِ ۵+ رسیده و هنوز هیچ قابی ندارد → ارزان‌ترین قاب (شخصی‌سازی، نه قدرت)
  const cheapestFrame = items.filter(i => i.kind === 'frame' && !owned.includes(i.id)).sort((a, b) => a.priceCoins - b.priceCoins)[0]
  if (level >= 5 && !owned.some(id => items.find(i => i.id === id)?.kind === 'frame') && cheapestFrame && !e.cosmetics?.frame)
    candidates.push({ id: 'off_frame', icon: cheapestFrame.icon, title: `سطحِ ${level.toLocaleString('fa-IR')} مبارک`, text: `امپراتوری‌ات بزرگ شده؛ ${cheapestFrame.label} کنارِ نامت در لیدربورد دیده می‌شود — فقط ظاهر، صفر اثرِ اقتصادی.`, cta: 'فروشگاهِ ظاهری', goto: 'cosmetics' })
  // ۳) شخصی‌سازی بر اساسِ سبکِ بازی (فصل ۷/۹): برج‌ساز → نشانِ ساخت؛ مذاکره‌گر → نشانِ مذاکره
  const crane = items.find(i => i.id === 'flair_crane' && !owned.includes(i.id))
  if ((e.stats?.projectsDelivered || 0) >= 1 && crane)
    candidates.push({ id: 'off_build', icon: crane.icon, title: 'برای برج‌سازها', text: `${(e.stats?.projectsDelivered || 0).toLocaleString('fa-IR')} پروژه تحویل داده‌ای؛ ${crane.label} این سابقه را کنارِ نامت نشان می‌دهد.`, cta: 'فروشگاهِ ظاهری', goto: 'cosmetics' })
  const falcon = items.find(i => i.id === 'flair_falcon' && !owned.includes(i.id))
  if ((e.stats?.negoWins || 0) >= 3 && falcon)
    candidates.push({ id: 'off_nego', icon: falcon.icon, title: 'برای مذاکره‌گرها', text: `${(e.stats?.negoWins || 0).toLocaleString('fa-IR')} مذاکرهٔ برنده داری؛ ${falcon.label} مخصوصِ همین سبکِ توست.`, cta: 'فروشگاهِ ظاهری', goto: 'cosmetics' })
  // بسته‌شده‌ها تا cooldownDays پنهان می‌مانند؛ فقط اولین کاندیدِ باز نمایش داده می‌شود (حداکثر ۱ در روز)
  const hist = e.offerHist || {}
  return candidates.find(o => !(o.id in hist) || day - hist[o.id] >= Math.max(1, cfg.cooldownDays)) || null
}

// بستنِ پیشنهاد با یک لمس (فصل ۹): همان پیشنهاد تا cooldownDays روز برنمی‌گردد.
export async function dismissOffer(userId: string, offerId: string, day: number) {
  return mutateEmpire(userId, e => {
    if (!/^off_[a-z]+$/.test(offerId)) return 'پیشنهادِ نامعتبر'
    const h = e.offerHist || (e.offerHist = {})
    h[offerId] = day
  })
}

// ⚡ پیگیریِ حضوریِ پروانه (فاز ۲۷): هر روز کوتاه‌شدنِ بررسی = کوین — انتظار قابلِ‌خرید است، نتیجه نه
// (اعتراض/عوارض سرِ جای خودشان می‌مانند؛ فقط زمان کوتاه می‌شود).
export async function boostPermit(userId: string, assetId: string, days: number, coinsPerDay: number, now = Date.now()): Promise<{ ok: boolean; reason?: string; cut?: number; empire?: EmpireData }> {
  let cut = 0
  const r = await mutateEmpire(userId, e => {
    const a = e.assets.find(x => x.id === assetId)
    if (!a?.permit || a.permit.status !== 'pending') return 'پروانهٔ در حالِ بررسی‌ای نیست'
    for (let d = 0; d < days && a.permit.days > 0; d++) {
      if (e.coins < coinsPerDay) { if (!cut) return 'ملک‌کوینِ کافی نداری'; break }
      e.coins -= Math.max(0, coinsPerDay)
      a.permit.days -= 1
      cut++
    }
    if (!cut) return 'روزی از بررسی نمانده — پروانه در بازدیدِ بعدی صادر می‌شود'
    e.timeline.push({ at: now, icon: '⚡', title: `پیگیریِ حضوری: بررسیِ پروانه ${cut.toLocaleString('fa-IR')} روز کوتاه شد`, detail: a.title.slice(0, 50) })
  })
  if (!r.ok) return { ok: false, reason: r.reason }
  return { ok: true, cut, empire: r.empire }
}

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
      for (let d = 0; d < days && c.paidDays < c.days; d++) {
        if (e.capital < dailyCost) break                      // بحرانِ نقدینگی — کارگاه می‌ایستد
        e.capital -= dailyCost
        c.paid += dailyCost
        c.paidDays += 1
        paidTotal += dailyCost
        if (fireCheckpointEvent(e, a, now)) break             // تا تصمیمِ بازیکن، کار می‌ایستد
      }
      if (completeIfBuilt(e, a, now)) completedTitles.push(a.title)
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
    // فاز ۲۹: واحدهای طبقاتِ مازاد (تخلف) پیش‌فروش نمی‌شوند — سقف روی واحدهای «قانونی» است.
    const legalUnits = Math.max(1, c.totalUnits - (c.illegalUnits || 0))
    const maxPresell = Math.floor(legalUnits * maxPct / 100)
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
    // فاز ۲۹: تا حلِ پروندهٔ ماده۱۰۰ (جریمه/تخریب)، واحدهای طبقاتِ مازاد سند نمی‌خورند و قابلِ‌فروش نیستند.
    const blocked = a.m100?.status === 'pending' ? (c.illegalUnits || 0) : 0
    const left = c.totalUnits - c.presold - c.sold - (c.rented || 0) - blocked
    if (blocked > 0 && units > left && left >= 0) return `تا حلِ ماده۱۰۰، ${blocked.toLocaleString('fa-IR')} واحدِ مازاد قابلِ‌فروش نیست — فقط ${Math.max(0, left).toLocaleString('fa-IR')} واحدِ آزاد داری`
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

// 🎪 رویدادِ زندهٔ فعال (سند ۱۸ — LiveOps): فقط در بازهٔ تعریف‌شدهٔ ادمین و اگر روشن باشد.
export interface LiveEventDef { id: string; title: string; desc: string; icon: string; metric: 'views' | 'saves' | 'searches' | 'hoods'; target: number; rewardXp: number; rewardCoins: number; startAt: number; endAt: number; enabled: boolean }
export const eventActive = (d: Pick<LiveEventDef, 'enabled' | 'startAt' | 'endAt'>, now: number) =>
  !!d.enabled && d.startAt <= now && now < d.endAt

// پاداشِ نقاطِ عطفِ استریک (سند ۱۸ بخش ۱): از استریکِ «واقعی»؛ کلیدِ claim شاملِ روزِ شروعِ همین دوره است
// تا با شکستنِ زنجیره و شروعِ دوباره، نقاطِ عطف دوباره قابلِ‌دریافت شوند.
export function streakMilestonesOf(streak: number, today: number, claims: Record<string, number>, knobs: { d7: number; d14: number; d21: number; d30: number }) {
  const runStart = today - Math.max(1, streak) + 1   // روزِ شروعِ این دورهٔ پیاپی
  return ([[7, knobs.d7], [14, knobs.d14], [21, knobs.d21], [30, knobs.d30]] as const).map(([days, coins]) => {
    const claimKey = `sm_${days}_${runStart}`
    return { days, coins: Math.max(0, coins), done: streak >= days, claimed: !!claims[claimKey], claimKey }
  })
}

// 👏 تحسین (سند ۱۷ — فصل ۷ تعاملِ اجتماعی): هر بازیکنِ واقعی فقط یک‌بار برای هر امپراتوری.
// هیچ پاداشِ پولی ندارد (بدونِ P2W) — فقط شمارنده و یک نقطهٔ تایم‌لاین برای گیرنده.
export async function giveKudos(giverUserId: string, target: EmpireData, now = Date.now()): Promise<{ ok: boolean; reason?: string; kudos?: number }> {
  if (target.userId === giverUserId) return { ok: false, reason: 'خودت را نمی‌توانی تحسین کنی 🙂' }
  const g = await mutateEmpire(giverUserId, e => {
    const key = 'kudos_' + target.no
    if (e.claims[key]) return 'قبلاً این امپراتوری را تحسین کرده‌ای'
    e.claims[key] = now
  })
  if (!g.ok) return { ok: false, reason: g.reason }
  let kudos = 0
  const r = await mutateEmpire(target.userId, e => {
    e.kudos = (e.kudos || 0) + 1
    kudos = e.kudos
    e.timeline.push({ at: now, icon: '👏', title: 'یک سرمایه‌گذارِ واقعی امپراتوری‌ات را تحسین کرد', detail: `مجموعِ تحسین‌ها: ${e.kudos.toLocaleString('fa-IR')}` })
  })
  if (!r.ok) return { ok: false, reason: r.reason }
  return { ok: true, kudos }
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
    // تخریب‌شده و هنوز ساخته‌نشده: قیمتِ آگهیِ اولیه دیگر معنای «ارزشِ روز» ندارد — بهای تمام‌شده مبنا می‌ماند.
    if (a.demolishedAt) { assetsValue += a.buyPrice; continue }
    // تجمیع (فاز ۲۵): ارزش = قیمتِ روزِ واحد × واحدهای مالکیت‌شده · بازسازی (فاز ۲۹): × (۱ + ارزش‌افزوده)
    assetsValue += Math.round((livePrices[a.listingId] || a.buyPrice / (a.unitsOwned || 1)) * (a.unitsOwned || 1) * (1 + (a.renovBoostPct || 0) / 100))
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
