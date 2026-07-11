// تمدنِ NPC — نسخهٔ ۱ (فاز ۶۵ — صف #۱ تراکر: NPC Civilization): شرکت‌های سیستمیِ «زنده»ی شهر.
// همان شخصیت‌های تالارِ مزایده (سند ۲۹) حالا زندگی می‌کنند: هر روز «قطعی از هشِ روز» (قانون ۷)
// روی آگهی‌های واقعیِ بازار خرید/فروش می‌کنند (قانون ۱: هیچ ملک/قیمتی ساخته نمی‌شود)، مالکیتِ
// انحصاری می‌گیرند (کمیابیِ واقعی و رقیبِ زنده برای بازیکن) و اگر بازیکن ملکِ آن‌ها را بخواهد،
// به همان قیمتِ آگهی واگذار می‌کنند (بدونِ سورپرایزِ قیمتی — قانونِ ۴ سؤال).
// پولِ شرکت‌های NPC یک حلقهٔ کاملاً بسته است — هیچ ریالی از/به اقتصادِ بازیکنان ساخته یا نابود نمی‌شود.
import { createHash } from 'crypto'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { pgEnabled, kvGet, kvMutate } from './db'
import { config } from './reos/reos-config'
import { claimListing, releaseListing } from './empire-social'

export interface NpcAsset { listingId: string; title: string; hood: string; cost: number; boughtDay: number }
export interface NpcCompany {
  id: string; name: string; icon: string; style: string; styleFa: string
  capital: number; realized: number
  assets: NpcAsset[]
  log: Array<{ day: number; icon: string; text: string }>
}
export interface NpcDb { day: number; companies: NpcCompany[] }
export interface NpcCandidate { id: string; title: string; hood: string; price: number }

// ۶ شرکتِ ثابتِ شخصیت‌دار — استایل رفتارِ اقتصادی را عوض می‌کند (باندِ خرید، صبرِ نگه‌داری، فروش‌پذیری).
export const NPC_DEFS: Array<{ id: string; name: string; icon: string; style: 'value' | 'luxury' | 'flipper' | 'patient' | 'balanced' | 'hungry'; styleFa: string; holdDays: number }> = [
  { id: 'kamran', name: 'کامران سرمایه', icon: '🦈', style: 'hungry', styleFa: 'تهاجمی — همیشه در حالِ خرید', holdDays: 6 },
  { id: 'naseri', name: 'گروهِ ناصری', icon: '🏛', style: 'patient', styleFa: 'صبور — می‌خرد و نگه می‌دارد', holdDays: 21 },
  { id: 'ofogh', name: 'شرکتِ افق', icon: '🌅', style: 'value', styleFa: 'ارزش‌خر — دنبالِ ارزان‌ترین‌ها', holdDays: 10 },
  { id: 'atlas', name: 'هولدینگ اطلس', icon: '🗿', style: 'luxury', styleFa: 'لوکس‌باز — فقط بالای بازار', holdDays: 14 },
  { id: 'sepehr', name: 'گروهِ سپهر', icon: '🦅', style: 'flipper', styleFa: 'نوسان‌گیر — زود می‌خرد، زود می‌فروشد', holdDays: 4 },
  { id: 'arman', name: 'آرمان‌سازه', icon: '🧱', style: 'balanced', styleFa: 'متعادل — کمی از همه‌چیز', holdDays: 12 },
]
export const NPC_USER_PREFIX = 'npc:'
const npcNo = (idx: number) => 9000 + idx   // شمارهٔ نمایشیِ ثابت — تداخلی با شماره‌های بازیکنان ندارد

const h32 = (s: string) => parseInt(createHash('sha1').update(s).digest('hex').slice(0, 8), 16)

const FILE = join(process.cwd(), '.empire-npc-data.json')
const KV = 'empire_npc'
const EMPTY: NpcDb = { day: 0, companies: [] }

async function load(): Promise<NpcDb> {
  if (pgEnabled()) { const d = await kvGet<NpcDb>(KV, EMPTY).catch(() => EMPTY); return { day: d.day || 0, companies: d.companies || [] } }
  try { if (existsSync(FILE)) { const d = JSON.parse(readFileSync(FILE, 'utf-8')); return { day: d.day || 0, companies: d.companies || [] } } } catch {}
  return { day: 0, companies: [] }
}
async function mutate<R>(fn: (d: NpcDb) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<NpcDb, R>(KV, EMPTY, raw => { const d = { day: raw.day || 0, companies: raw.companies || [] }; const out = fn(d); Object.assign(raw as NpcDb, d); return out })
  const d = await load()
  const out = fn(d)
  writeFileSync(FILE, JSON.stringify(d))
  return out
}

// شرکت‌های تازه (یا اضافه‌شده با بالارفتنِ knob تعداد) با سرمایهٔ شروعِ knob کاشته می‌شوند.
export function npcSeed(d: NpcDb, count: number, startCapital: number): NpcDb {
  for (const def of NPC_DEFS.slice(0, Math.max(0, count))) {
    if (!d.companies.some(c => c.id === def.id))
      d.companies.push({ id: def.id, name: def.name, icon: def.icon, style: def.style, styleFa: def.styleFa, capital: startCapital, realized: 0, assets: [], log: [] })
  }
  return d
}

// باندِ قیمتیِ هر استایل روی فهرستِ مرتبِ قیمت‌ها — value پایینِ بازار، luxury بالای بازار و…
function bandOf(style: string, n: number): [number, number] {
  if (n <= 1) return [0, n]
  switch (style) {
    case 'value': return [0, Math.max(1, Math.floor(n * 0.25))]
    case 'luxury': return [Math.floor(n * 0.75), n]
    case 'flipper': return [Math.floor(n * 0.25), Math.max(1, Math.floor(n * 0.6))]
    case 'hungry': return [0, Math.max(1, Math.floor(n * 0.6))]
    case 'patient': return [Math.floor(n * 0.3), Math.max(1, Math.floor(n * 0.8))]
    default: return [Math.floor(n * 0.2), Math.max(1, Math.floor(n * 0.8))]
  }
}

// ── تیکِ روزانهٔ خالص (تست‌پذیر): هر شرکت حداکثر یک حرکت در روز — قطعی از هشِ (روز|شرکت) ──
export function npcTickOf(d: NpcDb, day: number, candidates: NpcCandidate[], g = config().empire.npc): {
  d: NpcDb
  bought: Array<{ npc: string; icon: string; name: string; listingId: string; title: string; hood: string; price: number }>
  sold: Array<{ npc: string; icon: string; name: string; listingId: string; title: string; price: number; pnl: number }>
} {
  const bought: Array<{ npc: string; icon: string; name: string; listingId: string; title: string; hood: string; price: number }> = []
  const sold: Array<{ npc: string; icon: string; name: string; listingId: string; title: string; price: number; pnl: number }> = []
  if (d.day >= day || !g.enabled) return { d, bought, sold }
  const priceNow = new Map(candidates.map(c => [c.id, c.price]))
  const sorted = [...candidates].filter(c => c.price > 0).sort((a, b) => a.price - b.price)
  const ownedAnywhere = new Set(d.companies.flatMap(c => c.assets.map(a => a.listingId)))
  for (const c of d.companies.slice(0, Math.max(0, g.count))) {
    const def = NPC_DEFS.find(x => x.id === c.id)!
    if (h32(`npc|${day}|${c.id}`) % 100 >= g.actChancePct) continue   // امروز حرکتی ندارد
    // فروش: داراییِ به‌سن‌رسیده‌ای که هنوز قیمتِ روزِ واقعی دارد — سود/زیان از بازارِ واقعی
    const ripe = c.assets.filter(a => day - a.boughtDay >= def.holdDays && priceNow.has(a.listingId))
    const wantSell = ripe.length > 0 && (c.assets.length >= g.maxAssets || h32(`sell|${day}|${c.id}`) % 100 < 45)
    if (wantSell) {
      const a = ripe[h32(`pick|${day}|${c.id}`) % ripe.length]
      const p = priceNow.get(a.listingId)!
      c.capital += p
      c.realized += p - a.cost
      c.assets = c.assets.filter(x => x.listingId !== a.listingId)
      c.log.unshift({ day, icon: '💰', text: `«${a.title.slice(0, 40)}» را فروخت — ${p > a.cost ? 'سود' : 'زیانِ'} ${Math.abs(Math.round((p - a.cost) / 1e6)).toLocaleString('fa-IR')}م` })
      sold.push({ npc: c.id, icon: c.icon, name: c.name, listingId: a.listingId, title: a.title, price: p, pnl: p - a.cost })
    } else {
      // خرید: در باندِ استایل، فقط آگهی‌هایی که هیچ NPCای ندارد و پولش را دارد
      const pool = sorted.filter(x => !ownedAnywhere.has(x.id) && x.price <= c.capital)
      if (!pool.length || c.assets.length >= g.maxAssets) continue
      const [lo, hi] = bandOf(c.style, pool.length)
      const band = pool.slice(lo, Math.max(lo + 1, hi))
      const pick = band[h32(`buy|${day}|${c.id}`) % band.length]
      c.capital -= pick.price
      c.assets.push({ listingId: pick.id, title: pick.title.slice(0, 60), hood: pick.hood, cost: pick.price, boughtDay: day })
      ownedAnywhere.add(pick.id)
      c.log.unshift({ day, icon: '🏠', text: `«${pick.title.slice(0, 40)}» را در ${pick.hood || 'شهر'} خرید — ${Math.round(pick.price / 1e6).toLocaleString('fa-IR')}م` })
      bought.push({ npc: c.id, icon: c.icon, name: c.name, listingId: pick.id, title: pick.title, hood: pick.hood, price: pick.price })
    }
    c.log = c.log.slice(0, 20)
  }
  d.day = day
  return { d, bought, sold }
}

// نگه‌داری: کاشت + تیکِ امروز (یک‌بار در روز — dedupe با d.day) + همگام‌سازیِ مالکیتِ انحصاری در registry.
export async function npcMaintain(day: number, candidates: NpcCandidate[]): Promise<{ db: NpcDb; bought: ReturnType<typeof npcTickOf>['bought']; sold: ReturnType<typeof npcTickOf>['sold'] }> {
  const g = config().empire.npc
  let out: ReturnType<typeof npcTickOf> = { d: EMPTY, bought: [], sold: [] }
  const db = await mutate(d => {
    npcSeed(d, g.count, g.startCapital)
    out = npcTickOf(d, day, candidates, g)
    return out.d
  })
  // مالکیتِ انحصاری: خریدها claim و فروش‌ها release — خارج از تراکنشِ اصلی، idempotent
  for (const bgh of out.bought) {
    const idx = NPC_DEFS.findIndex(x => x.id === bgh.npc)
    await claimListing(bgh.listingId, { userId: NPC_USER_PREFIX + bgh.npc, no: npcNo(idx), name: bgh.name }).catch(() => {})
  }
  for (const sl of out.sold) await releaseListing(sl.listingId, NPC_USER_PREFIX + sl.npc).catch(() => {})
  return { db, bought: out.bought, sold: out.sold }
}

export async function npcDb(): Promise<NpcDb> { return load() }
export function npcOwnerOf(d: NpcDb, listingId: string): NpcCompany | null {
  return d.companies.find(c => c.assets.some(a => a.listingId === listingId)) || null
}
// واگذاری به بازیکن — به همان قیمتی که بازیکن در آگهی دیده (بدونِ سورپرایز)؛ دفترِ NPC فروش را ثبت می‌کند.
export async function npcSellToPlayer(npcId: string, listingId: string, price: number, buyerName: string, day: number): Promise<{ ok: boolean }> {
  return mutate(d => {
    const c = d.companies.find(x => x.id === npcId)
    const a = c?.assets.find(x => x.listingId === listingId)
    if (!c || !a) return { ok: false }
    c.capital += price
    c.realized += price - a.cost
    c.assets = c.assets.filter(x => x.listingId !== listingId)
    c.log.unshift({ day, icon: '🤝', text: `«${a.title.slice(0, 40)}» را به «${buyerName}» واگذار کرد` })
    c.log = c.log.slice(0, 20)
    return { ok: true }
  })
}
// نمای عمومی برای کارتِ «شرکت‌های شهر» — پرتفوی و کارنامهٔ هر شرکت شفاف است.
export function npcView(d: NpcDb, count = config().empire.npc.count) {
  return d.companies.slice(0, Math.max(0, count)).map(c => ({
    id: c.id, name: c.name, icon: c.icon, styleFa: c.styleFa,
    capital: c.capital, realized: c.realized, assets: c.assets.length,
    holdings: c.assets.slice(0, 5).map(a => ({ title: a.title.slice(0, 40), hood: a.hood, cost: a.cost, boughtDay: a.boughtDay })),
    log: c.log.slice(0, 4),
  }))
}
