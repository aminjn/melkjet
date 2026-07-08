// Empire · تعامل، استادی و روایتِ دنیا (Empire Bible جلد ۴۹ + ۵۱ + ۵۲) — همه از دادهٔ واقعی:
// • ردِ فعالیتِ هر بازیکن از کلیدهای تاریخ‌دارِ claims (صندوقچه/کوئست) + اسنپ‌شات — نه شمارندهٔ ساختگی.
//   همین رد، DAU/WAU/MAU و Retention کلاسیکِ D1/D7/D30 را می‌سازد (جلد ۴۹ فصل ۱۹).
// • Mastery (جلد ۴۹ فصل ۵): استادیِ چندمحوره از شمارنده‌های واقعیِ رفتار — قطعی و تست‌پذیر.
// • روزنامهٔ ملک‌جت (جلد ۵۲): خبر از خودِ دنیا تولید می‌شود (رویدادها/بازار/بازیکنانِ واقعی)، نه اسکریپت.
// • آرشیوِ تمدن (جلد ۵۱ فصل ۹): رکوردهای واقعیِ تاریخِ بازی.
import type { EmpireData } from './empire-store'
import { netWorthOf, dayNumberOf } from './empire-store'

// ── ردِ فعالیتِ واقعیِ روزانه: از کلیدهای تاریخ‌دارِ claims + تولد + اسنپ‌شات + آخرین فعالیت ──
export function activityDaysOf(e: Pick<EmpireData, 'claims' | 'createdAt' | 'updatedAt' | 'snap'>): Set<number> {
  const days = new Set<number>()
  days.add(dayNumberOf(e.createdAt))
  days.add(dayNumberOf(e.updatedAt))
  if (e.snap) { days.add(e.snap.day) }
  for (const k of Object.keys(e.claims || {})) {
    let m = k.match(/^(?:chest|dq)_(\d+)$/)
    if (m) { days.add(Number(m[1])); continue }
    m = k.match(/^wq_(\d+)$/)
    if (m) { days.add(Number(m[1]) * 7) ; continue }   // هفته → روزِ شروعِ همان هفته (دقتِ هفتگی)
    // پاداش‌های یک‌بارمصرف (m1/m2/…) مقدارشان timestamp لحظهٔ دریافت است
    const ts = (e.claims as Record<string, number>)[k]
    if (ts > 1e12) days.add(dayNumberOf(ts))
  }
  return days
}

// ── آمارِ تعامل (جلد ۴۹ فصل ۱۹/۲۰): DAU/WAU/MAU + Retention کوهورتی + سریِ ۱۴روزه ──
export interface EngagementStats {
  dau: number; wau: number; mau: number
  retention: { d1: { pct: number; cohort: number }; d7: { pct: number; cohort: number }; d30: { pct: number; cohort: number } }
  series: Array<{ day: number; active: number }>
  avgActiveDays: number
}
export function engagementStats(empires: Array<Pick<EmpireData, 'claims' | 'createdAt' | 'updatedAt' | 'snap'>>, today: number): EngagementStats {
  const traces = empires.map(e => ({ birth: dayNumberOf(e.createdAt), days: activityDaysOf(e) }))
  const activeWithin = (n: number) => traces.filter(t => { for (const d of t.days) if (d > today - n && d <= today) return true; return false }).length
  // Retention کلاسیک: از کوهورتی که حداقل N روز از تولدشان گذشته، چند درصد در/بعدِ روزِ تولد+N فعال بوده‌اند.
  const ret = (n: number) => {
    const cohort = traces.filter(t => t.birth <= today - n)
    if (!cohort.length) return { pct: 0, cohort: 0 }
    const kept = cohort.filter(t => { for (const d of t.days) if (d >= t.birth + n) return true; return false }).length
    return { pct: Math.round(kept / cohort.length * 100), cohort: cohort.length }
  }
  const series: Array<{ day: number; active: number }> = []
  for (let d = today - 13; d <= today; d++) series.push({ day: d, active: traces.filter(t => t.days.has(d)).length })
  const avgActiveDays = traces.length ? Math.round(traces.reduce((s, t) => s + t.days.size, 0) / traces.length * 10) / 10 : 0
  return { dau: activeWithin(1), wau: activeWithin(7), mau: activeWithin(30), retention: { d1: ret(1), d7: ret(7), d30: ret(30) }, series, avgActiveDays }
}

// ── ریسکِ ریزش (جلد ۴۹ فصل ۱۸ — نسخهٔ صادقانه): باارزش‌ترین بازیکنانِ غایب، برای اقدامِ ادمین ──
export function churnRisk(empires: EmpireData[], prices: Record<string, number>, today: number, minAbsentDays = 7) {
  return empires
    .map(e => ({ e, absent: today - Math.max(...activityDaysOf(e)), netWorth: netWorthOf(e, prices).netWorth }))
    .filter(x => x.absent >= minAbsentDays)
    .sort((a, b) => b.netWorth - a.netWorth)
    .slice(0, 20)
    .map(x => ({ userId: x.e.userId, no: x.e.no, name: x.e.name, persona: x.e.persona, absentDays: x.absent, netWorth: x.netWorth, assets: x.e.assets.length }))
}

// ── Mastery (جلد ۴۹ فصل ۵): استادیِ چندمحوره از شمارنده‌های واقعی — سطح از آستانه‌های ثابت ──
const TIERS = [1, 3, 10, 25, 50]   // سطح ۱..۵
const tierOf = (n: number) => { let lv = 0; for (const t of TIERS) if (n >= t) lv++; return lv }
export interface Mastery { key: string; icon: string; label: string; count: number; level: number; next: number | null }
export function masteryOf(e: EmpireData): Mastery[] {
  const defs: Array<[string, string, string, number]> = [
    ['trader', '💰', 'استادِ معامله', (e.stats?.sellsProfitable || 0)],
    ['negotiator', '🤝', 'استادِ مذاکره', (e.stats?.negoWins || 0)],
    ['analyst', '🧠', 'استادِ تحلیل', e.guess.correct],
    ['banker', '🏦', 'استادِ اعتبار', (e.creditHist?.repaid || 0)],
    ['collector', '🏘', 'استادِ مالکیت', e.assets.length],
    ['investor', '📊', 'استادِ سرمایه', (e.funds?.length || 0) + (e.crowd?.length || 0)],
  ]
  return defs.map(([key, icon, label, count]) => {
    const level = tierOf(count)
    return { key, icon, label, count, level, next: level < TIERS.length ? TIERS[level] : null }
  })
}

// ── روزنامهٔ ملک‌جت (جلد ۵۲): خبر فقط از اتفاقِ واقعی — هر تیتر منبعِ واقعی دارد؛ بدونِ اتفاق، بدونِ خبر ──
export interface NewsItem { icon: string; title: string; detail?: string; at: number }
export interface NewsInput {
  now: number
  // آگهی‌های واقعیِ بازار (برای رکوردها/محلهٔ داغ): perM فقط وقتی متراژ و قیمتِ معتبر دارد.
  listings: Array<{ id: string; title: string; hood: string; price: number; perM: number; scrapedAt: number }>
  empires: EmpireData[]
  prices: Record<string, number>
}
export function newsOf(inp: NewsInput): { news: NewsItem[]; records: Array<{ icon: string; label: string; value: string }> } {
  const { now, listings, empires, prices } = inp
  const day2 = now - 2 * 864e5, day7 = now - 7 * 864e5
  const news: NewsItem[] = []
  const faB = (n: number) => n >= 1e9 ? `${(Math.round(n / 1e8) / 10).toLocaleString('fa-IR')} میلیارد` : `${Math.round(n / 1e6).toLocaleString('fa-IR')} میلیون`

  // ورودِ عرضهٔ تازه: پرتعدادترین محلهٔ ۴۸ ساعتِ اخیر (همان سیگنالِ «بازارِ داغ» نامهٔ روزانه)
  const fresh = listings.filter(l => l.scrapedAt >= day2)
  const byHood = new Map<string, number>()
  for (const l of fresh) if (l.hood) byHood.set(l.hood, (byHood.get(l.hood) || 0) + 1)
  const hot = [...byHood.entries()].sort((a, b) => b[1] - a[1])[0]
  if (hot && hot[1] >= 3) news.push({ icon: '🔥', title: `«${hot[0]}» داغ‌ترین محلهٔ این روزهاست`, detail: `${hot[1].toLocaleString('fa-IR')} آگهیِ تازه در ۴۸ ساعتِ گذشته`, at: now })
  if (fresh.length) news.push({ icon: '🏷', title: `${fresh.length.toLocaleString('fa-IR')} فرصتِ تازه واردِ بازار شد`, detail: 'در ۴۸ ساعتِ گذشته', at: now })

  // گران‌ترین متریِ هفته (رکوردِ واقعیِ بازار)
  const week = listings.filter(l => l.scrapedAt >= day7 && l.perM > 0)
  const priciest = [...week].sort((a, b) => b.perM - a.perM)[0]
  if (priciest) news.push({ icon: '👑', title: `رکوردِ متریِ هفته در «${priciest.hood || 'بازار'}»`, detail: `${faB(priciest.perM)} تومان برای هر متر — ${priciest.title.slice(0, 50)}`, at: now })

  // دنیای بازیکنان: تولدها و بزرگ‌ترین معاملهٔ هفته — از تایم‌لاین‌های واقعی، فقط نام/نشانِ عمومی
  const births = empires.filter(e => now - e.createdAt < 7 * 864e5)
  if (births.length) {
    const latest = [...births].sort((a, b) => b.createdAt - a.createdAt)[0]
    news.push({ icon: '🌱', title: `${births.length.toLocaleString('fa-IR')} امپراتوریِ تازه این هفته متولد شد`, detail: `تازه‌ترین: «${latest.name}» (#${latest.no.toLocaleString('fa-IR')})`, at: latest.createdAt })
  }
  let bigSale: { name: string; amount: number; at: number } | null = null
  for (const e of empires) for (const t of e.timeline) {
    if (t.at < day7 || !t.title.startsWith('فروش:')) continue
    const m = (t.detail || '').match(/سود ([\d٬,۰-۹]+) میلیون/)
    const amount = m ? Number(m[1].replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[^\d]/g, '')) * 1e6 : 0
    if (amount > 0 && (!bigSale || amount > bigSale.amount)) bigSale = { name: e.name, amount, at: t.at }
  }
  if (bigSale) news.push({ icon: '💸', title: `سوددهی‌ترین فروشِ هفته: «${bigSale.name}»`, detail: `${faB(bigSale.amount)} تومان سودِ تحقق‌یافته`, at: bigSale.at })

  // آرشیوِ تمدن (جلد ۵۱ فصل ۹): رکوردهای همیشگیِ دنیا — فقط اگر واقعاً ثبت شده باشند
  const records: Array<{ icon: string; label: string; value: string }> = []
  const rows = empires.map(e => ({ e, nw: netWorthOf(e, prices) }))
  const richest = [...rows].sort((a, b) => b.nw.netWorth - a.nw.netWorth)[0]
  if (richest && richest.e.assets.length) records.push({ icon: '🏛', label: 'ثروتمندترین امپراتوری', value: `«${richest.e.name}» — ${faB(richest.nw.netWorth)} تومان` })
  const mostAssets = [...empires].sort((a, b) => b.assets.length - a.assets.length)[0]
  if (mostAssets && mostAssets.assets.length) records.push({ icon: '🏘', label: 'بزرگ‌ترین پرتفوی', value: `«${mostAssets.name}» — ${mostAssets.assets.length.toLocaleString('fa-IR')} دارایی` })
  const bestRealized = [...empires].sort((a, b) => (b.realized || 0) - (a.realized || 0))[0]
  if (bestRealized && (bestRealized.realized || 0) > 0) records.push({ icon: '📈', label: 'بیشترین سودِ تحقق‌یافتهٔ تاریخ', value: `«${bestRealized.name}» — ${faB(bestRealized.realized)} تومان` })
  const oldest = [...empires].sort((a, b) => a.createdAt - b.createdAt)[0]
  if (oldest) records.push({ icon: '📜', label: 'قدیمی‌ترین امپراتوری', value: `«${oldest.name}» — تولد ${new Date(oldest.createdAt).toLocaleDateString('fa-IR')}` })
  const allTimePerM = listings.filter(l => l.perM > 0).sort((a, b) => b.perM - a.perM)[0]
  if (allTimePerM) records.push({ icon: '👑', label: 'گران‌ترین متریِ بازارِ فعلی', value: `${faB(allTimePerM.perM)} تومان — ${allTimePerM.hood || allTimePerM.title.slice(0, 30)}` })

  return { news: news.sort((a, b) => b.at - a.at).slice(0, 8), records }
}
