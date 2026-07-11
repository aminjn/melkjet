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

export interface WorldEvent { at: number; day: number; icon: string; title: string; detail?: string; kind: string }
export interface WorldRumor {
  id: string; week: number; hood: string; dir: 1 | -1
  source: string; sourceFa: string; credPct: number; text: string
  madeAt: number; madeDay: number; basePerM: number
  verdict?: 'true' | 'false'; resolvedPerM?: number
}
interface WorldDb { events: WorldEvent[]; rumors: WorldRumor[] }

const FILE = join(process.cwd(), '.empire-world-data.json')
const KV = 'empire_world'
const EMPTY: WorldDb = { events: [], rumors: [] }

async function load(): Promise<WorldDb> {
  if (pgEnabled()) { const d = await kvGet<WorldDb>(KV, EMPTY).catch(() => EMPTY); return { events: d.events || [], rumors: d.rumors || [] } }
  try { if (existsSync(FILE)) { const d = JSON.parse(readFileSync(FILE, 'utf-8')); return { events: d.events || [], rumors: d.rumors || [] } } } catch {}
  return { events: [], rumors: [] }
}
async function mutate<R>(fn: (d: WorldDb) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<WorldDb, R>(KV, EMPTY, raw => { const d = { events: raw.events || [], rumors: raw.rumors || [] }; const out = fn(d); Object.assign(raw as WorldDb, d); return out })
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
export async function appendWorldEvent(ev: { icon: string; title: string; detail?: string; kind: string }, day: number, now = Date.now()): Promise<void> {
  const cap = Math.max(50, config().empire.world.historyCap)
  await mutate(d => {
    if (d.events.some(x => x.day === day && x.title === ev.title)) return
    d.events.unshift({ at: now, day, icon: ev.icon, title: String(ev.title).slice(0, 120), detail: ev.detail ? String(ev.detail).slice(0, 160) : undefined, kind: ev.kind })
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
