// Empire · بازار سرمایه (Empire Bible جلد ۴۰ «Capital Market & Investment Ecosystem») — همه از دادهٔ واقعی:
// • صندوقِ شاخصیِ املاک (REIT — فصل ۸): هر واحد = «یک مترِ مجازی» از بازارِ واقعیِ همان بخش؛
//   قیمتِ واحد = میانهٔ قیمتِ هر مترِ آگهی‌های واقعیِ فروش. سودِ دوره‌ای (فصل ۱۵) = میانهٔ اجارهٔ واقعیِ هر متر.
// • سرمایه‌گذاریِ جمعی (فصل ۷): مالکیتِ کسریِ آگهی‌های واقعیِ گران — «پروژهٔ ۵۰۰ میلیاردی، هر واحد ۵ میلیون».
// • بازارِ ثانویه (فصل ۱۱) = بازخرید به ارزشِ روزِ واقعی (NAV) — هیچ طرفِ معاملهٔ ساختگی وجود ندارد.
// • شاخص‌ها (فصل ۱۲)، رتبهٔ صندوق (فصل ۱۷) و روان‌شناسیِ بازار (فصل ۱۶) قطعی از دادهٔ واقعی‌اند.
// اگر داده کافی نیست → صندوق/شاخص اصلاً عرضه نمی‌شود (صادقانه)، نه عددِ ساختگی.
import { pgEnabled, pgTx } from './db'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { parseFaNum } from './reos/features'

// حداقلِ ورودیِ یک آگهی برای محاسبات (ساختاری — تا توابعِ خالص بدونِ scraper-store تست شوند).
export interface Lst { id: string; title: string; location?: string; price?: string; meta?: Record<string, string> }

const MIN_SALE = 100_000_000   // کفِ قیمتِ فروشِ معتبر — هم‌راستا با /api/empire (قیمتِ بدپارس‌شده کاندید نشود)
export const cityOfLoc = (loc?: string) => String(loc || '').split(/[،,]/)[0]?.trim() || ''
const priceOfL = (it: Lst) => parseFaNum(it.price)
const isSaleL = (it: Lst) => !/اجاره|رهن|ودیعه/.test(it.price || '') && (it.meta || {})['نوع معامله'] !== 'اجاره'
const areaOfL = (it: Lst) => parseFaNum((it.meta || {})['متراژ']) || 0
const monthlyRentOfL = (it: Lst) => { const m = (it.price || '').match(/اجاره[^\d۰-۹]*([\d,٬۰-۹]+)/); return m ? parseFaNum(m[1]) : 0 }
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }

// رتبهٔ صندوق (فصل ۱۷) — قطعی از عمقِ داده (تعدادِ نمونه) و پراکندگی (IQR نسبت به میانه):
// دادهٔ عمیق و یکدستِ بازار = رتبهٔ بالاتر = قیمت‌گذاریِ قابل‌اتکاتر.
export function fundRatingOf(samples: number, dispersionPct: number): string {
  if (samples >= 30 && dispersionPct <= 45) return 'AAA'
  if (samples >= 20 && dispersionPct <= 60) return 'AA'
  if (samples >= 12 && dispersionPct <= 80) return 'A'
  if (samples >= 8) return 'BBB'
  return 'BB'
}

// قیمت‌گیریِ یک بخشِ بازار (seg خالی = کلِ بازار؛ وگرنه شهر/محله‌ای که در location آمده).
export interface SegmentQuote { unit: number; samples: number; dispersionPct: number; rating: string; rentPerM: number; rentSamples: number; yieldPctYear: number }
export function segmentQuote(items: Lst[], seg: string, minSamples: number): SegmentQuote | null {
  const inSeg = (it: Lst) => !seg || String(it.location || '').includes(seg)
  const perM: number[] = [], rentPerM: number[] = []
  for (const it of items) {
    if (!inSeg(it)) continue
    const a = areaOfL(it)
    if (!(a > 0)) continue
    if (isSaleL(it)) { const p = priceOfL(it); if (p >= MIN_SALE) perM.push(p / a) }
    else { const r = monthlyRentOfL(it); if (r > 0) rentPerM.push(r / a) }
  }
  if (perM.length < Math.max(1, minSamples)) return null
  const s = [...perM].sort((a, b) => a - b)
  const unit = Math.round(median(perM))
  const q1 = s[Math.floor(s.length * 0.25)], q3 = s[Math.floor(s.length * 0.75)]
  const dispersionPct = unit ? Math.round((q3 - q1) / unit * 100) : 100
  const rPerM = Math.round(median(rentPerM))
  return {
    unit, samples: perM.length, dispersionPct,
    rating: fundRatingOf(perM.length, dispersionPct),
    rentPerM: rPerM, rentSamples: rentPerM.length,
    yieldPctYear: unit && rPerM ? Math.round(rPerM * 12 / unit * 1000) / 10 : 0,
  }
}

// شاخص‌های بازار (فصل ۱۲): شاخصِ کل + اجاره + شهرها — فقط جایی که نمونهٔ واقعیِ کافی هست.
export function marketIndices(items: Lst[], minCitySamples = 5): {
  overallPerM: number; samples: number; rentPerM: number; rentSamples: number
  cities: Array<{ city: string; perM: number; samples: number }>
} {
  const perM: number[] = [], rents: number[] = []
  const byCity = new Map<string, number[]>()
  for (const it of items) {
    const a = areaOfL(it)
    if (!(a > 0)) continue
    if (isSaleL(it)) {
      const p = priceOfL(it)
      if (p < MIN_SALE) continue
      perM.push(p / a)
      const c = cityOfLoc(it.location)
      if (c) { if (!byCity.has(c)) byCity.set(c, []); byCity.get(c)!.push(p / a) }
    } else { const r = monthlyRentOfL(it); if (r > 0) rents.push(r / a) }
  }
  const cities = [...byCity.entries()].filter(([, xs]) => xs.length >= minCitySamples)
    .map(([city, xs]) => ({ city, perM: Math.round(median(xs)), samples: xs.length }))
    .sort((a, b) => b.samples - a.samples).slice(0, 8)
  return { overallPerM: Math.round(median(perM)), samples: perM.length, rentPerM: Math.round(median(rents)), rentSamples: rents.length, cities }
}

// روان‌شناسیِ بازار (فصل ۱۶ «ترس و طمع») — قطعی از رویدادهای واقعیِ REOS:
// فعالیتِ ۷ روزِ اخیر در برابرِ ۷ روزِ قبل؛ ذخیره/تماس وزنِ بیشتری از بازدید دارند.
export function psychologyOf(evs: Array<{ type: string; at: number }>, now: number): { score: number; label: string; recent: number; prev: number } {
  const w = (t: string) => t === 'user_saved_property' ? 3 : t === 'user_contacted_agent' ? 5 : 1
  const wk = 7 * 864e5
  let recent = 0, prev = 0
  for (const e of evs) {
    if (e.at > now) continue
    if (e.at >= now - wk) recent += w(e.type)
    else if (e.at >= now - 2 * wk) prev += w(e.type)
  }
  const score = recent + prev === 0 ? 50 : Math.round(recent / (recent + prev) * 100)
  const label = score <= 25 ? 'ترسِ شدید' : score <= 45 ? 'ترس' : score < 55 ? 'خنثی' : score <= 75 ? 'طمع' : 'طمعِ شدید'
  return { score, label, recent, prev }
}

// کارمزدِ مدیریتِ صندوق (فصل ۱۵/۱۹) — سالانه، به‌نسبتِ روزهای نگه‌داری؛ در بازخرید کسر و به خزانه می‌رود.
export function fundFeeOf(value: number, feePctYear: number, heldDays: number): number {
  return Math.max(0, Math.round(value * (Math.max(0, feePctYear) / 100) * (Math.max(0, heldDays) / 365)))
}

// پرتفوی (فصل ۱۳): ترکیبِ دارایی + شاخصِ تنوع (۱۰۰ − سهمِ بزرگ‌ترین بخش) — ریسکِ تمرکز شفاف.
export interface PortfolioPart { key: string; label: string; value: number; pct: number }
export function portfolioOf(pos: { cash: number; properties: number; funds: number; crowd: number; debt: number }): { parts: PortfolioPart[]; total: number; diversification: number } {
  const defs: Array<[string, string, number]> = [
    ['cash', 'نقد', pos.cash], ['properties', 'املاک', pos.properties],
    ['funds', 'صندوق‌ها', pos.funds], ['crowd', 'مشارکت‌ها', pos.crowd],
  ]
  const total = defs.reduce((s, [, , v]) => s + Math.max(0, v), 0)
  const parts = defs.map(([key, label, v]) => ({ key, label, value: Math.max(0, v), pct: total ? Math.round(Math.max(0, v) / total * 100) : 0 }))
  const held = parts.filter(p => p.value > 0)
  const diversification = !total || held.length <= 1 ? 0 : Math.max(0, 100 - Math.max(...held.map(p => p.pct)))
  return { parts, total, diversification }
}

// ══════════ ذخیرهٔ مشترکِ بازار (dual-mode) — تعریفِ صندوق‌ها + استخرهای مشارکت + حجمِ معاملات ══════════
export interface FundDef { id: string; name: string; seg: string; feePctYear: number; enabled: boolean; createdAt: number }
export interface CrowdPool {
  listingId: string; title: string; hood: string
  unitToman: number; totalUnits: number; soldUnits: number
  investors: Record<string, number>          // userId → units (برای شمارِ شرکا و سقفِ خروج)
  createdAt: number
}
export interface MarketState {
  funds: FundDef[]
  pools: Record<string, CrowdPool>
  vol: { buys: number; sells: number; buyToman: number; sellToman: number }   // KPI فصل ۲۰: حجمِ معاملات
}
const EMPTY: MarketState = { funds: [], pools: {}, vol: { buys: 0, sells: 0, buyToman: 0, sellToman: 0 } }

const FILE = join(process.cwd(), '.empire-market.json')
function fileLoad(): MarketState { if (existsSync(FILE)) { try { return { ...EMPTY, ...JSON.parse(readFileSync(FILE, 'utf-8')) } } catch {} } return JSON.parse(JSON.stringify(EMPTY)) }
function fileSave(d: MarketState) { try { writeFileSync(FILE, JSON.stringify(d)) } catch {} }
let ready = false
async function ensure() { if (ready) return; await pgTx(c => c.query(`CREATE TABLE IF NOT EXISTS reos_empire_market (id text PRIMARY KEY, data jsonb NOT NULL, at bigint NOT NULL)`)); ready = true }

export async function getMarketState(): Promise<MarketState> {
  if (pgEnabled()) {
    await ensure()
    const r = await pgTx(c => c.query(`SELECT data FROM reos_empire_market WHERE id='main'`))
    return { ...JSON.parse(JSON.stringify(EMPTY)), ...(r.rows[0]?.data as MarketState | undefined) }
  }
  return fileLoad()
}

// جهشِ اتمیک با قفلِ ردیف — دو خریدِ همزمانِ واحدهای مشارکت نباید بیش از ظرفیت بفروشند.
export async function mutateMarket<T = void>(fn: (m: MarketState) => T | { error: string }): Promise<{ ok: boolean; reason?: string; out?: T; state?: MarketState }> {
  const apply = (m: MarketState) => {
    const out = fn(m)
    if (out && typeof out === 'object' && 'error' in (out as object)) return { ok: false as const, reason: (out as { error: string }).error, state: m }
    return { ok: true as const, out: out as T, state: m }
  }
  if (pgEnabled()) {
    await ensure()
    return pgTx(async c => {
      await c.query(`INSERT INTO reos_empire_market(id,data,at) VALUES('main',$1,$2) ON CONFLICT(id) DO NOTHING`, [JSON.stringify(EMPTY), Date.now()])
      const r = await c.query(`SELECT data FROM reos_empire_market WHERE id='main' FOR UPDATE`)
      const m = { ...JSON.parse(JSON.stringify(EMPTY)), ...(r.rows[0]?.data as MarketState) }
      const res = apply(m)
      if (!res.ok) return res
      await c.query(`UPDATE reos_empire_market SET data=$1, at=$2 WHERE id='main'`, [JSON.stringify(m), Date.now()])
      return res
    })
  }
  const m = fileLoad()
  const res = apply(m)
  if (res.ok) fileSave(m)
  return res
}

// ── صندوق‌ها (مدیریت از کنسولِ سرمایهٔ سوپرادمین — فصل ۱۹) ──
export async function createFund(name: string, seg: string, feePctYear: number): Promise<{ ok: boolean; reason?: string; fund?: FundDef }> {
  const fund: FundDef = { id: 'fnd_' + randomBytes(4).toString('hex'), name: String(name).trim().slice(0, 60), seg: String(seg).trim().slice(0, 40), feePctYear: Math.max(0, Math.min(20, Number(feePctYear) || 0)), enabled: true, createdAt: Date.now() }
  if (!fund.name) return { ok: false, reason: 'نامِ صندوق خالی است' }
  const r = await mutateMarket(m => {
    if (m.funds.some(f => f.seg === fund.seg)) return { error: 'برای این بخشِ بازار صندوق وجود دارد' }
    m.funds.push(fund)
  })
  return r.ok ? { ok: true, fund } : { ok: false, reason: r.reason }
}
export async function setFundEnabled(id: string, enabled: boolean) {
  return mutateMarket(m => { const f = m.funds.find(x => x.id === id); if (!f) return { error: 'صندوق یافت نشد' }; f.enabled = enabled })
}
export async function deleteFund(id: string) {
  return mutateMarket(m => { const i = m.funds.findIndex(x => x.id === id); if (i < 0) return { error: 'صندوق یافت نشد' }; m.funds.splice(i, 1) })
}

// ── استخرِ مشارکت (فصل ۷): رزرو/آزادسازیِ واحدها — ظرفیت اتمیک کنترل می‌شود ──
export async function reservePoolUnits(listingId: string, userId: string, units: number, init: { title: string; hood: string; unitToman: number; totalUnits: number }, maxPools: number) {
  return mutateMarket(m => {
    let p = m.pools[listingId]
    if (!p) {
      if (Object.keys(m.pools).length >= maxPools) return { error: 'ظرفیتِ استخرهای فعال تکمیل است — از استخرهای موجود انتخاب کن' }
      p = m.pools[listingId] = { listingId, title: init.title.slice(0, 120), hood: init.hood.slice(0, 60), unitToman: init.unitToman, totalUnits: init.totalUnits, soldUnits: 0, investors: {}, createdAt: Date.now() }
    }
    if (units < 1) return { error: 'حداقل یک واحد' }
    if (p.soldUnits + units > p.totalUnits) return { error: `فقط ${(p.totalUnits - p.soldUnits).toLocaleString('fa-IR')} واحد باقی مانده` }
    p.soldUnits += units
    p.investors[userId] = (p.investors[userId] || 0) + units
    return { unitToman: p.unitToman, totalUnits: p.totalUnits }
  })
}
export async function releasePoolUnits(listingId: string, userId: string, units: number) {
  return mutateMarket(m => {
    const p = m.pools[listingId]
    if (!p) return { error: 'استخر یافت نشد' }
    const mine = p.investors[userId] || 0
    if (units > mine) return { error: 'بیش از سهمِ تو' }
    p.soldUnits = Math.max(0, p.soldUnits - units)
    p.investors[userId] = mine - units
    if (p.investors[userId] <= 0) delete p.investors[userId]
    if (p.soldUnits === 0) delete m.pools[listingId]   // استخرِ خالی جمع می‌شود — لیستِ فعال واقعی می‌ماند
  })
}
// ثبتِ حجمِ معاملاتِ بازار (KPI فصل ۲۰) — فقط بعد از موفقیتِ کاملِ معامله صدا زده می‌شود.
export async function recordFundVolume(kind: 'buy' | 'sell', toman: number) {
  return mutateMarket(m => { if (kind === 'buy') { m.vol.buys += 1; m.vol.buyToman += toman } else { m.vol.sells += 1; m.vol.sellToman += toman } })
}
