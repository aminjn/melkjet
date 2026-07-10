// 🧭 هوشِ سرمایه‌گذاری (فاز ۳۹ — سند ۲۶ GDD فصل ۱۶ Cognitive AI Platform)
// جمع‌بندیِ نهاییِ خودِ سند: نه «پلتفرمِ AI عمومی»، نه ده‌ها فیچرِ هم‌پوشان — چند سیستمِ هوشِ
// قابلِ‌ساخت که همه «پیشنهاددهنده»اند نه «مجری» (Part 05: AI تصمیم نمی‌گیرد؛ کیفیتِ تصمیم را بالا می‌برد).
// قوانینِ سند که این‌جا کد شده‌اند:
//  - «AI نباید حدس بزند» → همهٔ اعداد از دادهٔ واقعی (آگهی‌های هم‌محله، تاریخچهٔ اسنپ‌شاتِ رصدخانه، جریان‌های ثبت‌شدهٔ خودِ بازیکن).
//  - «بدونِ دادهٔ کافی اعتمادِ بالا نشان نده» → Confidence از تعدادِ نمونهٔ واقعی؛ کم بود → صادقانه «داده کافی نیست».
//  - «هر پیشنهاد دلیل دارد» (Explainability) → هر خروجی reasons دارد.
//  - «آینده قطعی اعلام نشود» → سناریوها از پراکندگیِ واقعیِ قیمت‌های محله (چارک‌ها)، با برچسبِ «برآورد».
// همه توابعِ خالص و قطعی‌اند (تست‌پذیر، بدونِ I/O) — ورودی‌ها تزریق می‌شوند؛ آستانه‌ها knob ادمین (empire.intel).
import type { EmpireData } from './empire-store'
import type { EconSnapshot } from './empire-metrics'

export interface IntelCfg {
  enabled: boolean
  minComps: number        // حداقل نمونهٔ هم‌محله برای ارزش‌گذاری (کمتر → «داده کافی نیست»)
  fairBandPct: number     // |اختلاف| کمتر از این = قیمتِ منصفانه
  expensivePct: number    // تا این سقف = «کمی بالاتر»؛ بیشتر = «گران»
  bubblePct: number       // بالاتر از این = «احتمالِ حباب»
  trendDays: number       // فاصلهٔ مقایسهٔ روندِ محله‌ها (روز)
  loanSoonDays: number    // «سررسیدِ وام نزدیک است» از چند روز مانده
  liqHigh: number         // تعدادِ آگهیِ هم‌محله که یعنی بازارِ پرتحرک
  liqMid: number          // …و بازارِ معمولی (کمتر = کم‌عمق)
}

const fa = (n: number) => Math.round(n).toLocaleString('fa-IR')
const faB = (n: number) => n >= 1e9 ? `${(Math.round(n / 1e8) / 10).toLocaleString('fa-IR')} میلیارد` : `${Math.round(n / 1e6).toLocaleString('fa-IR')} میلیون`

// ── آمارِ نمونه‌های هم‌محله (comps) ─────────────────────────────────────────────
// از نرخ‌های متریِ واقعیِ آگهی‌های فروشِ هم‌محله: میانه + چارک‌ها (پراکندگیِ واقعی، نه عددِ ساختگی).
export interface CompStats { perM: number; p25: number; p75: number; samples: number; fresh: number }
export function compStatsOf(rates: number[], fresh = 0): CompStats {
  const s = [...rates].filter(r => r > 0).sort((a, b) => a - b)
  const q = (p: number) => { if (!s.length) return 0; const i = (s.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo) }
  return { perM: Math.round(q(0.5)), p25: Math.round(q(0.25)), p75: Math.round(q(0.75)), samples: s.length, fresh }
}

// ── ارزش‌گذاریِ ملک (Part 03: Fair Value / Badge / Liquidity / Score / Confidence / Scenarios / Reasons) ──
export interface Valuation {
  ready: boolean
  note?: string                                   // وقتی ready=false: توضیحِ صادقانه
  fair: number                                    // ارزشِ منصفانه = میانهٔ متریِ واقعیِ محله × متراژ
  market: number                                  // قیمتِ پیشنهادیِ فروشنده
  diffPct: number                                 // (بازار − منصفانه) / منصفانه
  badge: { icon: string; label: string; tone: 'good' | 'warn' | 'bad' }
  liquidity: { label: string; level: 0 | 1 | 2 }  // عمقِ بازارِ محله از عرضهٔ واقعی
  score: number                                   // کیفیتِ سرمایه‌گذاری ۰..۱۰۰ (توضیح‌پذیر)
  confidence: number                              // ۰..۱۰۰ فقط از حجمِ دادهٔ واقعی
  scenarios: { pess: number; base: number; opt: number }   // از چارک‌های واقعیِ محله — برآورد، نه قول
  reasons: string[]
}
export function valuationOf(price: number, area: number, comps: CompStats, cfg: IntelCfg): Valuation {
  const empty: Valuation = {
    ready: false, fair: 0, market: price, diffPct: 0,
    badge: { icon: '⚪', label: 'بدونِ داده', tone: 'warn' }, liquidity: { label: 'نامشخص', level: 0 },
    score: 0, confidence: 0, scenarios: { pess: 0, base: 0, opt: 0 }, reasons: [],
  }
  if (comps.samples < cfg.minComps) return { ...empty, note: `برای ارزش‌گذاری در این محله فقط ${fa(comps.samples)} نمونهٔ واقعی داریم (نیاز: ${fa(cfg.minComps)}) — اعتمادِ بالا نمایش نمی‌دهیم.` }
  if (!(price > 0) || !(area > 0)) return { ...empty, note: 'قیمت یا متراژِ آگهی نامشخص است — ارزش‌گذاری بدونِ این دو ممکن نیست.' }
  const fair = comps.perM * area
  const diffPct = Math.round((price - fair) / fair * 100)
  const badge = diffPct <= -cfg.fairBandPct ? { icon: '🟢', label: 'زیرِ ارزشِ منصفانه — فرصتِ قابلِ‌بررسی', tone: 'good' as const }
    : Math.abs(diffPct) < cfg.fairBandPct ? { icon: '🟢', label: 'قیمتِ منصفانه', tone: 'good' as const }
    : diffPct < cfg.expensivePct ? { icon: '🟡', label: 'کمی بالاتر از ارزش', tone: 'warn' as const }
    : diffPct < cfg.bubblePct ? { icon: '🟠', label: 'بیش از حد گران', tone: 'bad' as const }
    : { icon: '🔴', label: 'احتمالِ حبابِ قیمتی', tone: 'bad' as const }
  const liquidity = comps.samples >= cfg.liqHigh ? { label: 'پرتحرک', level: 2 as const }
    : comps.samples >= cfg.liqMid ? { label: 'معمولی', level: 1 as const } : { label: 'کم‌عمق', level: 0 as const }
  // Confidence فقط تابعِ حجمِ داده است (سند: «بدونِ داده کافی اعتمادِ بالا ممنوع») — سقف ۹۵، هرگز ۱۰۰.
  const confidence = Math.min(95, 35 + comps.samples * 4 + comps.fresh * 2)
  // امتیازِ سرمایه‌گذاری، توضیح‌پذیر: قیمت نسبت به منصفانه (۰..۵۰) + عمقِ بازار (۰..۳۰) + اعتمادِ داده (۰..۲۰)
  const priceScore = Math.max(0, Math.min(50, Math.round(25 - diffPct * 1.25)))
  const score = Math.max(0, Math.min(100, priceScore + liquidity.level * 15 + Math.round(confidence / 5)))
  const reasons = [
    `میانهٔ متریِ ${fa(comps.samples)} آگهیِ واقعیِ هم‌محله: ${faB(comps.perM)} تومان`,
    diffPct === 0 ? 'قیمت دقیقاً روی میانهٔ محله است' : `این ملک ${fa(Math.abs(diffPct))}٪ ${diffPct > 0 ? 'بالاتر' : 'پایین‌تر'} از ارزشِ منصفانهٔ برآوردی است`,
    `عرضهٔ محله ${liquidity.label} است (${fa(comps.samples)} آگهیِ فعال${comps.fresh ? `، ${fa(comps.fresh)} تای آن تازه` : ''})`,
  ]
  return {
    ready: true, fair: Math.round(fair), market: price, diffPct, badge, liquidity, score, confidence,
    // سناریوها از پراکندگیِ «واقعیِ» قیمت‌های محله (چارک ۲۵ و ۷۵) — برآوردِ بازه، نه پیش‌بینیِ قطعی.
    scenarios: { pess: Math.round(comps.p25 * area), base: Math.round(fair), opt: Math.round(comps.p75 * area) },
    reasons,
  }
}

// ── تصمیم‌یارِ پیش از خرید (Part 05 DSS: Financial Check → هشدار، نه اجرا) ─────────────
export interface Decision { can: boolean; afterCapital: number; warnings: string[]; notes: string[] }
export function decisionOf(fin: { capital: number; loanBalance: number; netWorth: number; dailyBurn: number }, price: number, cfg: IntelCfg): Decision {
  const afterCapital = fin.capital - price
  const warnings: string[] = []
  const notes: string[] = []
  if (afterCapital < 0) return { can: false, afterCapital, warnings: [`سرمایهٔ نقدی کافی نیست — ${faB(price - fin.capital)} تومان کم داری (فروشِ دارایی یا وام را بسنج)`], notes }
  const total = Math.max(1, fin.netWorth)
  const liqPct = Math.round(afterCapital / total * 100)
  if (liqPct < 10) warnings.push(`بعد از این خرید نقدینگی‌ات به ${fa(liqPct)}٪ کلِ دارایی می‌رسد — جای مانورِ کمی می‌ماند`)
  if (fin.dailyBurn > 0) {
    const runway = Math.floor(afterCapital / fin.dailyBurn)
    if (runway < 30) warnings.push(`با خرجِ روزانهٔ فعلی (حقوق/ساخت/بهره) نقدِ باقی‌مانده فقط ${fa(runway)} روز دوام می‌آورد`)
    else notes.push(`نقدِ باقی‌مانده با خرجِ روزانهٔ فعلی ${fa(runway)} روز دوام می‌آورد`)
  }
  if (fin.loanBalance > 0) {
    const debtPct = Math.round(fin.loanBalance / total * 100)
    notes.push(`بدهیِ بانکی‌ات ${debtPct >= 30 ? `${fa(debtPct)}٪ دارایی است — سنگین` : `${fa(debtPct)}٪ دارایی است`}`)
    if (debtPct >= 30) warnings.push('پیش از تعهدِ جدید، سبک‌کردنِ وام را بسنج')
  }
  if (!warnings.length) notes.unshift('از نظرِ نقدینگی مشکلی ایجاد نمی‌کند')
  return { can: true, afterCapital, warnings, notes }
}

// ── هوشِ بازار (Part 04: روندِ محله‌ها از «تاریخچهٔ واقعیِ» رصدخانه — فاز ۳۵) ─────────────
export interface MarketIntel {
  ready: boolean
  note?: string
  sinceDays: number
  city: { perM: number; pct: number | null }
  rising: Array<{ hood: string; perM: number; pct: number }>
  falling: Array<{ hood: string; perM: number; pct: number }>
}
export function marketIntelOf(snaps: EconSnapshot[], cfg: IntelCfg): MarketIntel {
  const empty: MarketIntel = { ready: false, sinceDays: 0, city: { perM: 0, pct: null }, rising: [], falling: [] }
  const last = snaps[snaps.length - 1]
  if (!last) return { ...empty, note: 'هنوز تاریخچهٔ بازار ثبت نشده — از فردا که اولین اسنپ‌شاتِ روزانه گرفته شود، روندها از دادهٔ واقعی ساخته می‌شوند.' }
  const ref = [...snaps].reverse().find(s => s.day <= last.day - Math.max(2, cfg.trendDays)) || (snaps.length > 1 && snaps[0].day < last.day ? snaps[0] : undefined)
  if (!ref) return { ...empty, city: { perM: last.perM, pct: null }, note: 'برای روندگیری حداقل دو روز تاریخچهٔ واقعی لازم است — فعلاً فقط وضعِ امروز را داریم.' }
  const pct = (a: number, b: number) => b > 0 ? Math.round((a - b) / b * 1000) / 10 : null
  const refHoods = new Map(ref.hoods.map(h => [h.hood, h]))
  const moved: Array<{ hood: string; perM: number; pct: number }> = []
  for (const h of last.hoods) {
    const r = refHoods.get(h.hood)
    if (!r || r.perM <= 0 || h.samples < 3) continue
    const p = pct(h.perM, r.perM)
    if (p !== null) moved.push({ hood: h.hood, perM: h.perM, pct: p })
  }
  return {
    ready: true, sinceDays: last.day - ref.day,
    city: { perM: last.perM, pct: pct(last.perM, ref.perM) },
    rising: moved.filter(m => m.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 3),
    falling: moved.filter(m => m.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, 3),
  }
}

// ── جریانِ نقدی (Part 10: ۷/۳۰/۹۰ روز — فقط از جریان‌های «ثبت‌شدهٔ» خودِ بازیکن) ─────────────
// درآمد: میانگینِ واقعیِ آنچه تا حالا جمع شده (a.income ÷ روزهای فعال) — برآورد از رفتارِ واقعی، نه وعده.
// خرج: حقوقِ مهندس‌ها + هزینهٔ روزشمارِ ساخت‌های فعال + بهرهٔ روزانهٔ وام — همه از قراردادهای جاری.
export interface Cashflow { dailyIn: number; dailyOut: number; net: number; d7: number; d30: number; d90: number; runwayDays: number | null }
export function cashflowOf(e: Pick<EmpireData, 'capital' | 'assets' | 'company' | 'loan'>, now = Date.now()): Cashflow {
  let dailyIn = 0
  for (const a of e.assets) {
    if (!(a.income && a.income > 0)) continue
    const days = Math.max(1, Math.floor((now - (a.actionAt || a.boughtAt)) / 864e5))
    dailyIn += a.income / days
  }
  let dailyOut = 0
  for (const en of e.company?.engineers || []) dailyOut += en.salaryMonthly / 30
  for (const a of e.assets) {
    const c = a.construction
    if (c && !c.done && c.paidDays < c.days) dailyOut += c.costTotal / Math.max(1, c.days)
  }
  if (e.loan && e.loan.balance > 0) dailyOut += e.loan.balance * (e.loan.ratePctYear / 100) / 365
  const net = dailyIn - dailyOut
  const proj = (d: number) => Math.round(e.capital + net * d)
  return {
    dailyIn: Math.round(dailyIn), dailyOut: Math.round(dailyOut), net: Math.round(net),
    d7: proj(7), d30: proj(30), d90: proj(90),
    runwayDays: net < 0 ? Math.max(0, Math.floor(e.capital / -net)) : null,
  }
}

// ── سلامتِ مالی (Part 10: یک امتیازِ کلی + دلایلِ شفاف — «کمیتهٔ تحلیل»، نه حکمِ قطعی) ─────────────
export interface FinHealth { score: number; band: string; reasons: string[] }
export function financialHealthOf(e: Pick<EmpireData, 'capital' | 'assets' | 'loan' | 'realized' | 'stats'>, netWorth: number, flow: Cashflow): FinHealth {
  let score = 50
  const reasons: string[] = []
  const total = Math.max(1, netWorth)
  const liqPct = Math.round(e.capital / total * 100)
  if (liqPct >= 15) { score += 15; reasons.push(`نقدینگیِ سالم: ${fa(liqPct)}٪ دارایی نقد است`) }
  else if (liqPct >= 5) { score += 8; reasons.push(`نقدینگی قابلِ‌قبول (${fa(liqPct)}٪) — ولی جای ذخیرهٔ بیشتری هست`) }
  else reasons.push(`نقدینگیِ کم: فقط ${fa(liqPct)}٪ دارایی نقد است — یک هزینهٔ غیرمنتظره می‌تواند بحرانی شود`)
  const debt = e.loan?.balance || 0
  if (!debt) { score += 10; reasons.push('بدهیِ بانکی نداری') }
  else {
    const debtPct = Math.round(debt / total * 100)
    if (debtPct < 30) { score += 5; reasons.push(`بدهیِ کنترل‌شده: ${fa(debtPct)}٪ دارایی`) }
    else { score -= 10; reasons.push(`بدهیِ سنگین: ${fa(debtPct)}٪ دارایی — نسبتِ بدهی را پایین بیاور`) }
  }
  if (flow.net >= 0) { score += 15; if (flow.dailyIn > 0) reasons.push(`جریانِ نقدیِ روزانه مثبت است (${faB(flow.net)}+ تومان در روز)`) }
  else { score -= 10; reasons.push(`خرجِ روزانه از درآمد بیشتر است${flow.runwayDays !== null ? ` — نقدِ فعلی ${fa(flow.runwayDays)} روز دوام می‌آورد` : ''}`) }
  const kinds = new Set(e.assets.map(a => a.kind))
  if (kinds.size >= 2) { score += 5; reasons.push('پرتفوی متنوع است (بیش از یک نوع ملک)') }
  else if (e.assets.length >= 2) reasons.push('همهٔ دارایی‌ها یک نوع‌اند — تنوع، ریسک را کم می‌کند')
  const hoods = e.assets.map(a => a.hood).filter(Boolean)
  if (hoods.length >= 2) {
    const maxShare = Math.max(...[...new Set(hoods)].map(h => hoods.filter(x => x === h).length)) / hoods.length
    if (maxShare <= 0.6) { score += 5; reasons.push('دارایی‌ها در چند محله پخش‌اند') }
    else reasons.push('تمرکزِ دارایی‌ها روی یک محله بالاست — رکودِ همان محله همه را می‌زند')
  }
  if ((e.realized || 0) > 0) { score += 5; reasons.push('سودِ تحقق‌یافته از فروش‌های قبلی داری') }
  if ((e.stats?.sellsProfitable || 0) >= 1) score += 5
  score = Math.max(0, Math.min(100, score))
  const band = score >= 75 ? 'مستحکم' : score >= 50 ? 'قابلِ‌قبول' : score >= 25 ? 'شکننده' : 'بحرانی'
  return { score, band, reasons }
}

// ── اولویت‌های امروز (Part 11: حداکثر ۵ اقدامِ مهم — همه از «وضعیتِ واقعیِ» همین لحظه) ─────────────
export function prioritiesOf(e: EmpireData, now = Date.now(), cfg?: Pick<IntelCfg, 'loanSoonDays'>): Array<{ icon: string; text: string }> {
  const out: Array<{ icon: string; text: string }> = []
  const soonDays = cfg?.loanSoonDays ?? 7
  for (const a of e.assets) {
    if (a.construction?.pendingEvent) out.push({ icon: '🚨', text: `کارگاهِ «${a.title.slice(0, 24)}» منتظرِ تصمیمِ توست: ${a.construction.pendingEvent.text.slice(0, 40)}` })
    if (a.m100 && a.m100.status === 'pending') out.push({ icon: '⚖️', text: `پروندهٔ ماده۱۰۰ِ «${a.title.slice(0, 24)}» باز است — جریمه ${faB(a.m100.fine)} تومان` })
  }
  for (const a of e.assets) {
    const c = a.construction
    if (c && !c.done && c.paidDays < c.days) {
      const remaining = c.costTotal - c.paid
      if (remaining > e.capital) { out.push({ icon: '🏗', text: `نقدینگی برای ادامهٔ ساختِ «${a.title.slice(0, 24)}» کافی نیست (${faB(remaining - e.capital)} تومان کم) — پیش‌فروش یا فروشِ دارایی را بسنج` }); break }
    }
  }
  if (e.loan && e.loan.balance > 0) {
    const left = Math.ceil((e.loan.dueAt - now) / 864e5)
    if (left <= soonDays) out.push({ icon: '🏦', text: left <= 0 ? `سررسیدِ وام گذشته — ${faB(e.loan.balance)} تومان بدهی را تسویه کن` : `سررسیدِ وام ${fa(left)} روزِ دیگر است (${faB(e.loan.balance)} تومان)` })
  }
  for (const a of e.assets) {
    if (a.permit?.status === 'granted' && !a.construction) { out.push({ icon: '📐', text: `پروانهٔ «${a.title.slice(0, 24)}» صادر شده — ساخت را شروع کن` }); break }
  }
  for (const a of e.assets) {
    if (a.design && a.design.readyAt <= now && !a.permit && !a.construction) { out.push({ icon: '🏛', text: `نقشهٔ معمارِ «${a.title.slice(0, 24)}» آماده است — برو سراغِ پروانه` }); break }
  }
  for (const a of e.assets) {
    const c = a.construction
    if (c && c.done && (c.sold + c.presold) < c.totalUnits - (c.illegalUnits || 0)) {
      out.push({ icon: '🏢', text: `${fa(c.totalUnits - (c.illegalUnits || 0) - c.sold - c.presold)} واحدِ فروش‌نرفته در «${a.title.slice(0, 24)}» داری — بفروش یا اجاره بده` }); break
    }
  }
  for (const a of e.assets) {
    if (a.kind === 'land' && !a.landPlan && !a.construction && !a.demolishedAt) { out.push({ icon: '🗺', text: `برای زمینِ «${a.title.slice(0, 24)}» هنوز برنامه‌ای نریخته‌ای — فروش، ساخت یا مشارکت؟` }); break }
    if (a.kind !== 'land' && !a.action && !a.construction && !a.business) { out.push({ icon: '🧭', text: `برای «${a.title.slice(0, 24)}» تصمیم بگیر: اجاره، بازسازی یا نگه‌داشتن` }); break }
  }
  return out.slice(0, 5)
}
