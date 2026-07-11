// دنیای زنده (فاز ۶۳ — سند ۳۲ فصل ۲۱ Live World Engine).
// «دنیا نباید هر روز مثلِ دیروز باشد» — ولی طبقِ قانونِ ۱ هیچ‌چیز ساخته نمی‌شود:
//  • کتابِ تاریخِ دنیا (World Memory/Timeline): فقط رخدادهای «واقعاً رخ‌داده» ثبت می‌شوند.
//  • سالِ دنیا (World Age): از dayNumber و طولِ سالِ knob — زمانِ بازی، نه Date.now (قانون ۱۰).
//  • دمای دنیا (Heat Index): از فعالیتِ واقعیِ همین امروز؛ خروجی فقط «پیشنهاد» به ادمین است (Level 0/1).
//  • شایعاتِ منصفانه (Rumor System): قطعی از هشِ هفته + دادهٔ واقعیِ محله؛ منبع + اعتبارِ ٪ + ارزیابیِ
//    بعد از ۷ روز با میانهٔ «واقعیِ» رصدخانه — بازیکن یاد می‌گیرد به کدام منبع اعتماد کند.
import { createHash } from 'crypto'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { pgEnabled, kvGet, kvMutate } from './db'
import { config } from './reos/reos-config'

export interface WorldEvent { at: number; day: number; icon: string; title: string; detail?: string; kind: string; no?: number }   // no = شمارهٔ امپراتوری/شرکتِ مرتبط (فاز ۶۷: فیدِ تعاملی)
export interface WorldRumor {
  id: string; week: number; hood: string; dir: 1 | -1
  source: string; sourceFa: string; credPct: number; text: string
  madeAt: number; madeDay: number; basePerM: number
  verdict?: 'true' | 'false'; resolvedPerM?: number
}
interface WorldDb { events: WorldEvent[]; rumors: WorldRumor[]; seasons?: Record<string, Array<{ no: number; name: string; value: number; rank: number }>> }

const FILE = join(process.cwd(), '.empire-world-data.json')
const KV = 'empire_world'
const EMPTY: WorldDb = { events: [], rumors: [] }

async function load(): Promise<WorldDb> {
  if (pgEnabled()) { const d = await kvGet<WorldDb>(KV, EMPTY).catch(() => EMPTY); return { events: d.events || [], rumors: d.rumors || [], seasons: d.seasons || {} } }
  try { if (existsSync(FILE)) { const d = JSON.parse(readFileSync(FILE, 'utf-8')); return { events: d.events || [], rumors: d.rumors || [], seasons: d.seasons || {} } } } catch {}
  return { events: [], rumors: [], seasons: {} }
}
async function mutate<R>(fn: (d: WorldDb) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<WorldDb, R>(KV, EMPTY, raw => { const d = { events: raw.events || [], rumors: raw.rumors || [], seasons: raw.seasons || {} }; const out = fn(d); Object.assign(raw as WorldDb, d); return out })
  const d = await load()
  const out = fn(d)
  writeFileSync(FILE, JSON.stringify(d))
  return out
}

// ── سالِ دنیا (Part 7 World Age): زمانِ بازی از dayNumber؛ طولِ سال knob ──
export function worldYearOf(day: number, daysPerYear = config().empire.world.daysPerYear): { year: number; dayOfYear: number } {
  const dpy = Math.max(1, daysPerYear)
  return { year: Math.floor(Math.max(0, day) / dpy) + 1, dayOfYear: (Math.max(0, day) % dpy) + 1 }
}

// ── کتابِ تاریخِ دنیا (Part 1 World Memory + Part 2 Timeline) ──
// فقط رخدادِ واقعی؛ dedupe با (روز + عنوان) تا retry تراکنش/چند-instance رخداد را دوبار ننویسد.
export async function appendWorldEvent(ev: { icon: string; title: string; detail?: string; kind: string; no?: number }, day: number, now = Date.now()): Promise<void> {
  const cap = Math.max(50, config().empire.world.historyCap)
  await mutate(d => {
    if (d.events.some(x => x.day === day && x.title === ev.title)) return
    d.events.unshift({ at: now, day, icon: ev.icon, title: String(ev.title).slice(0, 120), detail: ev.detail ? String(ev.detail).slice(0, 160) : undefined, kind: ev.kind, no: ev.no })
    d.events = d.events.slice(0, cap)
  }).catch(() => {})
}
export async function worldHistory(limit = 60): Promise<WorldEvent[]> {
  const d = await load()
  return d.events.slice(0, Math.max(1, limit))
}

// ── دمای دنیا (Part 5 Heat Index): از فعالیتِ واقعیِ امروز؛ فقط پیشنهاد به ادمین، هرگز اجرا ──
export function worldHeatOf(
  sig: { activePlayers: number; eventsToday: number; auctionsLive: number; liveOpsActive: number },
  w = config().empire.world,
): { score: number; parts: Array<{ fa: string; value: number; pts: number }>; mood: string; suggestions: string[] } {
  const parts = [
    { fa: 'بازیکنانِ فعالِ امروز', value: sig.activePlayers, pts: Math.min(40, sig.activePlayers * w.heatWActive) },
    { fa: 'رخدادهای امروزِ دنیا', value: sig.eventsToday, pts: Math.min(30, sig.eventsToday * w.heatWEvent) },
    { fa: 'نبردهای زندهٔ تالار', value: sig.auctionsLive, pts: Math.min(20, sig.auctionsLive * w.heatWAuction) },
    { fa: 'رویدادهای فعالِ استودیو', value: sig.liveOpsActive, pts: Math.min(10, sig.liveOpsActive * 5) },
  ]
  const score = Math.min(100, parts.reduce((s, p) => s + p.pts, 0))
  const mood = score < w.heatLow ? 'سرد' : score > w.heatHigh ? 'داغ' : 'متعادل'
  const suggestions = score < w.heatLow
    ? ['از استودیوی رویداد یک رویدادِ کوتاه فعال کن (بدونِ دیپلوی)', 'زمانِ خوبی برای اعلامِ یک مزایدهٔ ویژه در روزنامه است', 'پاداشِ نقاطِ عطفِ استریک را موقتاً پررنگ‌تر کن']
    : score > w.heatHigh
      ? ['امروز چیزی اضافه نکن — بازیکنان فرصتِ مدیریتِ همین‌ها را ندارند', 'اگر رویدادِ استودیو فعال است، تمدیدش نکن']
      : []
  return { score, parts, mood, suggestions }
}

// ── شایعاتِ منصفانه (Part 3 Rumor System) ──
// قطعی از هشِ هفته (قانون ۷) + محله‌های «واقعیِ» رصدخانه؛ منبع + اعتبارِ ٪ اعلام می‌شود؛
// بعد از ۷ روز با میانهٔ واقعیِ همان محله ارزیابی و ✓/✗ می‌خورد — «فریبِ بی‌دلیل» وجود ندارد.
const RUMOR_SOURCES: Array<{ key: string; fa: string }> = [
  { key: 'media', fa: 'رسانهٔ اقتصادی' },
  { key: 'analyst', fa: 'تحلیلگرِ بازار' },
  { key: 'rival', fa: 'شرکتِ رقیب' },
]
const h32 = (s: string) => parseInt(createHash('sha1').update(s).digest('hex').slice(0, 8), 16)
export function rumorsGen(week: number, hoods: Array<{ hood: string; perM: number }>, w = config().empire.world, now = Date.now(), day = 0): WorldRumor[] {
  const usable = hoods.filter(x => x.hood && x.perM > 0)
  if (!usable.length) return []
  const out: WorldRumor[] = []
  const n = Math.min(Math.max(1, w.rumorsPerWeek), usable.length)
  for (let i = 0; i < n; i++) {
    const hx = h32(`rumor|${week}|${i}`)
    const hood = usable[hx % usable.length]
    const dir: 1 | -1 = (h32(`dir|${week}|${i}`) % 2 === 0 ? 1 : -1)
    const src = RUMOR_SOURCES[h32(`src|${week}|${i}`) % RUMOR_SOURCES.length]
    const band = Math.max(1, w.rumorCredMax - w.rumorCredMin)
    const credPct = w.rumorCredMin + (h32(`cred|${week}|${i}`) % band)
    out.push({
      id: `rm${week}_${i}`, week, hood: hood.hood, dir,
      source: src.key, sourceFa: src.fa, credPct,
      text: dir === 1
        ? `شنیده شده تقاضا در «${hood.hood}» بالا می‌رود — احتمالِ رشدِ قیمتِ متری`
        : `شنیده شده عرضه در «${hood.hood}» زیاد شده — احتمالِ افتِ قیمتِ متری`,
      madeAt: now, madeDay: day, basePerM: hood.perM,
    })
  }
  return out
}
// ارزیابیِ خالص: جهتِ واقعیِ میانهٔ متری (رصدخانهٔ امروز) نسبت به روزِ ساختِ شایعه.
export function resolveRumor(r: WorldRumor, perMNow: number): 'true' | 'false' | null {
  if (!(perMNow > 0) || !(r.basePerM > 0)) return null
  const delta = (perMNow - r.basePerM) / r.basePerM
  if (Math.abs(delta) < 0.002) return null   // هنوز حرکتِ معناداری نیست — قضاوت نکن (صادقانه)
  return (delta > 0 ? 1 : -1) === r.dir ? 'true' : 'false'
}
// اعتبارِ تاریخیِ هر منبع از شایعاتِ «ارزیابی‌شده» — بازیکن یاد می‌گیرد به کدام منبع اعتماد کند.
export function sourceTrustOf(rumors: WorldRumor[]): Array<{ source: string; sourceFa: string; total: number; truePct: number }> {
  return RUMOR_SOURCES.map(s => {
    const done = rumors.filter(r => r.source === s.key && r.verdict)
    const t = done.filter(r => r.verdict === 'true').length
    return { source: s.key, sourceFa: s.fa, total: done.length, truePct: done.length ? Math.round((t / done.length) * 100) : 0 }
  })
}

// نگه‌داری: شایعاتِ هفتهٔ جاری را (اگر نیست) از دادهٔ واقعی بساز + شایعاتِ ۷+روزه را با میانهٔ واقعی ارزیابی کن.
export async function rumorsMaintain(day: number, hoodsNow: Array<{ hood: string; perM: number }>, now = Date.now()): Promise<{ current: WorldRumor[]; recent: WorldRumor[]; trust: ReturnType<typeof sourceTrustOf> }> {
  const week = Math.floor(day / 7)
  const w = config().empire.world
  return mutate(d => {
    if (!d.rumors.some(r => r.week === week) && hoodsNow.length) {
      d.rumors.unshift(...rumorsGen(week, hoodsNow, w, now, day))
      d.rumors = d.rumors.slice(0, 40)
    }
    for (const r of d.rumors) {
      if (r.verdict || day - r.madeDay < 7) continue
      const hn = hoodsNow.find(x => x.hood === r.hood)
      if (!hn) continue
      const v = resolveRumor(r, hn.perM)
      if (v) { r.verdict = v; r.resolvedPerM = hn.perM }
    }
    return {
      current: d.rumors.filter(r => r.week === week),
      recent: d.rumors.filter(r => r.verdict).slice(0, 4),
      trust: sourceTrustOf(d.rumors),
    }
  })
}

// ── فاز ۶۶ (Season Engine v1): نتیجهٔ نهاییِ فصل — یک‌بار، سرِ اولین خواندنِ بعد از پایان، منجمد می‌شود ──
export async function seasonFinalize(id: string, rows: Array<{ no: number; name: string; value: number; rank: number }>): Promise<Array<{ no: number; name: string; value: number; rank: number }>> {
  return mutate(d => {
    d.seasons = d.seasons || {}
    if (!d.seasons[id]) d.seasons[id] = rows.slice(0, 20)
    return d.seasons[id]
  })
}
export async function seasonFinalOf(id: string): Promise<Array<{ no: number; name: string; value: number; rank: number }> | null> {
  const d = await load()
  return d.seasons?.[id] || null
}

// ── فاز ۶۸ (چندشهری v1 — «شخصیتِ شهر از خودِ بازارِ واقعی»): شهرها داینامیک از location آگهی‌های واقعی ──
// location = «شهر، محله» → شهر بخشِ اول؛ تک‌بخشی (مثل «کیش») خودش شهر است. شهرِ جدید با رسیدنِ داده‌اش خودکار ظاهر می‌شود.
export function cityOf(loc?: string): string {
  const p = String(loc || '').split(/[،,]/).map(x => x.trim()).filter(Boolean)
  return p[0] || ''
}
export function cityStatsOf(list: Array<{ city: string; price: number }>): Array<{ city: string; listings: number; medianPrice: number }> {
  const by = new Map<string, number[]>()
  for (const x of list) { if (!x.city || !(x.price > 0)) continue; const a = by.get(x.city) || []; a.push(x.price); by.set(x.city, a) }
  return [...by.entries()].map(([city, prices]) => {
    const sorted = [...prices].sort((a, b) => a - b)
    return { city, listings: prices.length, medianPrice: sorted[Math.floor(sorted.length / 2)] }
  }).sort((a, b) => b.listings - a.listings).slice(0, 8)
}

// ── فاز ۷۰ (دولتِ زنده + Future Engine): مصوبهٔ هفتهٔ شهر — قطعی از هشِ هفته (قانون ۷)، در دامنه‌های
// محدودِ knob، و همیشه «یک هفته زودتر» اعلام می‌شود تا هیچ بازیکنی غافلگیرِ ناعادلانه نشود (انصافِ سند). ──
export interface GovDecree { kind: 'tax' | 'loan' | 'none'; taxDelta: number; loanDelta: number; fa: string }
export function govDecreeOf(week: number, g = config().empire.gov): GovDecree {
  if (!g?.enabled) return { kind: 'none', taxDelta: 0, loanDelta: 0, fa: 'بدونِ مصوبهٔ جدید' }
  if (h32(`gov|${week}`) % 100 >= Math.max(0, Math.min(100, g.chancePct))) return { kind: 'none', taxDelta: 0, loanDelta: 0, fa: 'بدونِ مصوبهٔ جدید — نرخ‌ها سرِ جای خودشان' }
  const kind: 'tax' | 'loan' = h32(`govk|${week}`) % 2 === 0 ? 'tax' : 'loan'
  const sign = h32(`govs|${week}`) % 2 === 0 ? 1 : -1
  // گام‌های ربعِ واحد در بازهٔ [۰٫۲۵ .. max] — عددِ کوچک و قابلِ‌فهم، نه شوکِ اقتصادی
  const stepsT = Math.max(1, Math.round(Math.max(0.25, g.maxTaxDelta) / 0.25))
  const stepsL = Math.max(1, Math.round(Math.max(0.5, g.maxLoanDelta) / 0.5))
  if (kind === 'tax') {
    const d = sign * (1 + (h32(`govm|${week}`) % stepsT)) * 0.25
    return { kind, taxDelta: d, loanDelta: 0, fa: `مالیاتِ نقل‌وانتقال این هفته ${d > 0 ? '+' : '−'}${Math.abs(d).toLocaleString('fa-IR')} واحدِ درصد` }
  }
  const d = sign * (1 + (h32(`govm|${week}`) % stepsL)) * 0.5
  return { kind, taxDelta: 0, loanDelta: d, fa: `نرخِ وامِ بانک این هفته ${d > 0 ? '+' : '−'}${Math.abs(d).toLocaleString('fa-IR')} واحدِ درصد` }
}

// ── فاز ۷۱ (سند ۳۳ — Real World Integration lite): مناسبت‌های «واقعیِ» تقویم؛ دنیا با زندگیِ واقعی نفس می‌کشد ──
// از تقویمِ رسمیِ فارسی (Intl fa-IR-u-ca-persian) — هیچ رویدادِ ساختگی؛ فقط حال‌وهوا، صفر اثرِ اقتصادی.
export function occasionOf(now = new Date()): { icon: string; text: string } | null {
  let m = 0, d = 0
  try {
    const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', { month: 'numeric', day: 'numeric' }).formatToParts(now)
    m = Number(parts.find(x => x.type === 'month')?.value || 0)
    d = Number(parts.find(x => x.type === 'day')?.value || 0)
  } catch { return null }
  if (m === 1 && d >= 1 && d <= 4) return { icon: '🌸', text: 'نوروز است — شهر رختِ نو پوشیده؛ سالِ نو مبارک' }
  if (m === 9 && d === 30) return { icon: '🍉', text: 'شبِ یلداست — بلندترین شبِ سال؛ شهر چراغانی است' }
  if (m === 12 && d >= 25) return { icon: '🧹', text: 'روزهای پایانِ سال — شهر در تکاپوی خانه‌تکانی و جابه‌جایی است' }
  if (now.getDay() === 5) return { icon: '🌿', text: 'جمعه است — شهر آرام‌تر نفس می‌کشد' }
  return null
}
