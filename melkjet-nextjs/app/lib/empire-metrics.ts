// 📊 رصدخانهٔ اقتصاد (فاز ۳۵ — سند ۲۴ GDD فصل ۱۴ Analytics & Big Data)
// پیشنهادِ طلاییِ سند: «فقط رفتارِ بازیکن را ذخیره نکنید؛ تاریخچهٔ کاملِ بازار را هم ذخیره کنید» —
// هر روز یک اسنپ‌شات از بازارِ واقعی (میانهٔ متری، محله‌ها) + اقتصادِ مسیرِ رشد (پول، خزانه، DAU، تمرکزِ ثروت).
// از این تاریخچه: تورم/رکود، روندِ DAU، تمرکزِ سرمایه و هشدارهای سلامتِ اقتصاد (Part 06) درمی‌آید —
// همه از دادهٔ واقعی؛ تا دو اسنپ‌شات نداشته باشیم، هیچ روندی ادعا نمی‌شود (empty state صادقانه).
// ذخیره dual-mode: kv('empire_metrics') روی PG وگرنه ‎.empire-metrics-data.json‎ — سقفِ ۴۰۰ روز.
import fs from 'fs'
import path from 'path'
import { pgEnabled, kvGet, kvSet } from './db'
import { listEmpiresPublic, netWorthOf, dayNumberOf, type EmpireData } from './empire-store'
import { activityDaysOf } from './empire-engage'
import { candidateListings, type Item } from './scraper-store'
import { parseFaNum } from './reos/features'

export interface EconSnapshot {
  day: number; at: number
  players: number; newToday: number; dau: number; wau: number
  capital: number; coins: number; netWorth: number
  treasury: number; wages: number; services: number
  assets: number
  listings: number; perM: number; perMSamples: number
  hoods: Array<{ hood: string; perM: number; samples: number }>
  top10Pct: number            // سهمِ ۱۰٪ ثروتمندترین بازیکنان از کلِ ارزشِ خالص (تمرکزِ سرمایه)
}

const FILE = path.join(process.cwd(), '.empire-metrics-data.json')
const KV = 'empire_metrics'
const CAP = 400

const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const hoodOf = (loc?: string) => { const p = String(loc || '').split(/[،,]/).map(x => x.trim()).filter(Boolean); return p.length > 1 ? p[p.length - 1] : (p[0] || '') }

async function loadAll(): Promise<EconSnapshot[]> {
  if (pgEnabled()) return await kvGet<EconSnapshot[]>(KV, []).catch(() => [] as EconSnapshot[])
  try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')) } catch { return [] }
}
async function storeAll(snaps: EconSnapshot[]) {
  const s = [...snaps].sort((a, b) => a.day - b.day).slice(-CAP)
  if (pgEnabled()) { await kvSet(KV, s); return }
  fs.writeFileSync(FILE, JSON.stringify(s))
}

// upsert بر اساسِ روز — اجرای دوباره در همان روز فقط تازه‌سازی می‌کند (ایدمپوتنت، مثلِ بقیهٔ کران‌ها)
export async function saveSnapshot(snap: EconSnapshot) {
  const all = (await loadAll()).filter(s => s.day !== snap.day)
  all.push(snap)
  await storeAll(all)
}
export async function loadSnapshots(limit = 90): Promise<EconSnapshot[]> {
  return (await loadAll()).slice(-Math.max(1, limit))
}

// هستهٔ خالصِ اسنپ‌شات — ورودی‌ها تزریق می‌شوند تا تست‌پذیر باشد (بازیکنانِ واقعی + آگهی‌های واقعی).
export function buildSnapshot(empires: EmpireData[], items: Item[], now = Date.now()): EconSnapshot {
  const today = dayNumberOf(now)
  // بازارِ واقعی: نرخِ هر متر از آگهی‌های فروشِ قیمت‌دارِ متراژدار
  const prices: Record<string, number> = {}
  const rates: number[] = []
  const byHood = new Map<string, number[]>()
  for (const it of items) {
    const p = parseFaNum(it.price)
    if (p > 0) prices[it.id] = p
    if (!(p >= 100_000_000) || /اجاره|رهن|ودیعه/.test(it.price || '')) continue
    const a = parseFaNum((it.meta || {})['متراژ']) || 0
    if (!(a > 0)) continue
    const r = p / a
    rates.push(r)
    const h = hoodOf(it.location)
    if (h) { if (!byHood.has(h)) byHood.set(h, []); byHood.get(h)!.push(r) }
  }
  const hoods = [...byHood.entries()].filter(([, rs]) => rs.length >= 3)
    .map(([hood, rs]) => ({ hood, perM: Math.round(median(rs)), samples: rs.length }))
    .sort((a, b) => b.samples - a.samples).slice(0, 12)
  // اقتصادِ بازیکنان
  let capital = 0, coins = 0, treasury = 0, wages = 0, services = 0, assets = 0, dau = 0, wau = 0, newToday = 0
  const worths: number[] = []
  for (const e of empires) {
    capital += e.capital; coins += e.coins
    treasury += e.taxPaid || 0; wages += e.wagesPaid || 0; services += e.servicesPaid || 0
    assets += e.assets.length
    worths.push(netWorthOf(e, prices).netWorth)
    const days = activityDaysOf(e)
    if (days.has(today)) dau++
    if ([...Array(7)].some((_, i) => days.has(today - i))) wau++
    if (dayNumberOf(e.createdAt) === today) newToday++
  }
  const totalWorth = worths.reduce((s, x) => s + x, 0)
  const topN = Math.max(1, Math.ceil(worths.length / 10))
  const topSum = [...worths].sort((a, b) => b - a).slice(0, topN).reduce((s, x) => s + x, 0)
  return {
    day: today, at: now,
    players: empires.length, newToday, dau, wau,
    capital, coins, netWorth: totalWorth, treasury, wages, services, assets,
    listings: items.length, perM: Math.round(median(rates)), perMSamples: rates.length, hoods,
    top10Pct: totalWorth > 0 ? Math.round(topSum / totalWorth * 100) : 0,
  }
}

// گردآورِ روزانه (کران/دکمهٔ ادمین): بازیکنانِ واقعی + آگهی‌های واقعیِ همین لحظه → یک ردیفِ تاریخ.
export async function takeDailySnapshot(now = Date.now()): Promise<EconSnapshot> {
  const [empires, items] = await Promise.all([
    listEmpiresPublic(2000),
    candidateListings(1500).catch(() => [] as Item[]),
  ])
  const snap = buildSnapshot(empires, items, now)
  await saveSnapshot(snap)
  return snap
}

// سلامتِ اقتصاد (Part 06): تورم/رکود، افتِ DAU، تمرکزِ سرمایه، رشدِ غیرعادیِ پول — آستانه‌ها knob ادمین.
export interface EconHealth {
  ready: boolean
  inflation7: number | null; inflation30: number | null
  capGrowth7: number | null
  dau: number; dau7: number | null
  alerts: Array<{ icon: string; text: string }>
}
export function economyHealthOf(
  snaps: EconSnapshot[],
  cfg: { inflationAlertPct: number; dauDropAlertPct: number; concentrationAlertPct: number; capGrowthAlertPct: number },
): EconHealth {
  const last = snaps[snaps.length - 1]
  if (!last) return { ready: false, inflation7: null, inflation30: null, capGrowth7: null, dau: 0, dau7: null, alerts: [] }
  const at = (days: number) => [...snaps].reverse().find(s => s.day <= last.day - days)
  const pct = (a: number, b: number) => b > 0 ? Math.round((a - b) / b * 1000) / 10 : null
  const w = at(7), m = at(30)
  const inflation7 = w && w.perM > 0 ? pct(last.perM, w.perM) : null
  const inflation30 = m && m.perM > 0 ? pct(last.perM, m.perM) : null
  const capGrowth7 = w && w.capital > 0 ? pct(last.capital, w.capital) : null
  const alerts: Array<{ icon: string; text: string }> = []
  if (inflation7 !== null && inflation7 >= cfg.inflationAlertPct) alerts.push({ icon: '📈', text: `تورمِ بازارِ واقعی: میانهٔ متری در ۷ روز ${inflation7.toLocaleString('fa-IR')}٪ بالا رفته` })
  if (inflation7 !== null && inflation7 <= -cfg.inflationAlertPct) alerts.push({ icon: '📉', text: `سقوطِ بازار: میانهٔ متری در ۷ روز ${Math.abs(inflation7).toLocaleString('fa-IR')}٪ پایین آمده` })
  if (w && w.dau > 0 && last.dau < w.dau * (1 - cfg.dauDropAlertPct / 100)) alerts.push({ icon: '🚪', text: `افتِ شدیدِ بازیکنانِ فعالِ روزانه: ${w.dau.toLocaleString('fa-IR')} → ${last.dau.toLocaleString('fa-IR')}` })
  if (last.top10Pct >= cfg.concentrationAlertPct && last.players >= 10) alerts.push({ icon: '⚖️', text: `تمرکزِ سرمایه: ${last.top10Pct.toLocaleString('fa-IR')}٪ ثروت دستِ ۱۰٪ بازیکنان است` })
  if (capGrowth7 !== null && capGrowth7 >= cfg.capGrowthAlertPct) alerts.push({ icon: '💸', text: `رشدِ غیرعادیِ نقدینگی: سرمایهٔ نقدِ کل در ۷ روز ${capGrowth7.toLocaleString('fa-IR')}٪ بالا رفته — منبعِ تولیدِ پول را چک کن` })
  return { ready: true, inflation7, inflation30, capGrowth7, dau: last.dau, dau7: w?.dau ?? null, alerts }
}

// 🧠 مصرفِ واقعیِ هوشِ سیستم (فاز ۳۶ — سند ۲۵ Part 10 «Human Dashboard»): چند اقدامِ واقعی از
// مسیرِ پیشنهاد/تحلیلِ سیستم انجام شده؟ — از رویدادهای واقعیِ REOS (srcهای empire_*)، پنجرهٔ ۷ روزه.
export function aiUsageOf(events: Array<{ at: number; meta?: Record<string, unknown> }>, now = Date.now()) {
  const since = now - 7 * 864e5
  const out = { buy: 0, analyze: 0, guess: 0, crowd: 0, assembly: 0, total: 0 }
  for (const ev of events) {
    if (ev.at < since) continue
    const src = String(ev.meta?.['src'] || '')
    if (!src.startsWith('empire_')) continue
    const k = src.slice('empire_'.length) as keyof typeof out
    if (k in out && k !== 'total') { out[k]++; out.total++ }
  }
  return out
}

// IES — Investment Engagement Score (پیشنهادِ Part 07): «نه فقط آنلاین است یا نه؛ چقدر واقعاً درگیرِ
// اقتصاد شده؟» — ترکیبِ قطعی از شمارنده‌های واقعیِ رفتار، ۰..۱۰۰.
export function iesOf(e: EmpireData, today: number): number {
  const days = activityDaysOf(e)
  let a7 = 0
  for (let i = 0; i < 7; i++) if (days.has(today - i)) a7++
  return Math.min(100, Math.round(
    a7 * 8                                                  // حضورِ هفتهٔ اخیر (۰..۵۶)
    + Math.min(20, e.assets.length * 4)                     // دارایی‌های واقعی
    + Math.min(15, (e.stats?.projectsDelivered || 0) * 5)   // پروژه‌های تحویلی
    + Math.min(12, (e.stats?.negoWins || 0) * 3)            // مذاکره‌های برنده
    + Math.min(10, (e.guess?.correct || 0) * 2)             // تحلیل‌های درست
    + (e.company ? 10 : 0)                                  // شرکتِ فعال
    + Math.min(5, e.kudos || 0)                             // تحسینِ جامعه
  ))
}
