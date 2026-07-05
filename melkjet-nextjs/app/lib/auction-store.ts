import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'
import { promoPricing } from './promo-pricing-store'

// ── مزایدهٔ محله‌محورِ آگهی — سیستمِ خودگردان ────────────────────────────────
// برای هر «محله» یک مزایده برگزار می‌شود: کاربران برای آگهیِ منتشرشدهٔ خود در آن محله
// پیشنهاد می‌دهند. در پایانِ هر دورِ هفتگی، بالاترین پیشنهادِ هر محله برنده می‌شود،
// از کیفِ پول کسر و آگهی‌اش در صدرِ آن محله (بالاتر از پروموت‌های محله‌محور) ویژه می‌شود.
// همهٔ شرکت‌کنندگانِ آن محله پیامک + اعلانِ «مزایده با قیمتِ X تمام شد» می‌گیرند.
// تسویه «تنبل» است (هنگام خواندنِ وضعیت/صفحهٔ اصلی) → بدونِ کرون خودش کار می‌کند.
const FILE = join(process.cwd(), '.auction-data.json')
const KV_KEY = 'auction'
const DAY = 86400000

export interface AuctionConfig { id: string; label: string; promoSlot: string; kind: string; periodDays: number; minBid: number; step: number; enabled: boolean }
const AUCTION_DEFAULT: AuctionConfig = { id: 'area', label: 'مزایدهٔ محله‌محورِ آگهی (هفتگی)', promoSlot: 'neighborhood_featured', kind: 'مزایده', periodDays: 7, minBid: 200000, step: 50000, enabled: true }
// پیکربندیِ مزایده با overrideِ ادمین (از promo-pricing.auction['area']).
export function auctionConfig(): AuctionConfig {
  try {
    const o = promoPricing().auction?.['area']
    if (o) return { ...AUCTION_DEFAULT, minBid: o.minBid != null ? o.minBid : AUCTION_DEFAULT.minBid, step: o.step != null ? o.step : AUCTION_DEFAULT.step, periodDays: o.periodDays != null ? o.periodDays : AUCTION_DEFAULT.periodDays, enabled: o.enabled !== false }
  } catch {}
  return AUCTION_DEFAULT
}

export interface Bid { id: string; area: string; owner: string; targetId: string; targetName: string; amount: number; createdAt: number }
export interface WinnerRec { owner: string; targetName: string; amount: number; at: number }
interface ADB { bids: Bid[]; roundEndsAt: number | null; lastWinners: Record<string, WinnerRec> }
const EMPTY: ADB = { bids: [], roundEndsAt: null, lastWinners: {} }
const normArea = (s: string) => String(s || '').trim().replace(/\s+/g, ' ')

function fileLoad(): ADB { if (existsSync(FILE)) { try { const d = JSON.parse(readFileSync(FILE, 'utf-8')); return { bids: d.bids || [], roundEndsAt: d.roundEndsAt ?? null, lastWinners: d.lastWinners || {} } } catch {} } return { bids: [], roundEndsAt: null, lastWinners: {} } }
function fileSave(db: ADB) { writeFileSync(FILE, JSON.stringify(db, null, 2), 'utf-8') }
async function load(): Promise<ADB> { return pgEnabled() ? await kvGet<ADB>(KV_KEY, EMPTY) : fileLoad() }
async function mutate<R>(fn: (db: ADB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<ADB, R>(KV_KEY, EMPTY, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

// ثبتِ پیشنهاد در یک محله — یک پیشنهادِ فعال به‌ازای هر کاربر در هر محله.
export async function placeBid(area: string, owner: string, targetId: string, targetName: string, amount: number): Promise<{ ok: boolean; error?: string }> {
  const cfg = auctionConfig()
  if (!cfg.enabled) return { ok: false, error: 'مزایده در حالِ حاضر فعال نیست.' }
  const ar = normArea(area); if (!ar) return { ok: false, error: 'محله را انتخاب کنید.' }
  await resolveDue()
  const amt = Math.round(amount)
  return mutate(db => {
    const now = Date.now()
    const others = db.bids.filter(b => normArea(b.area) === ar && b.owner !== owner)
    const topOther = others.reduce((m, b) => Math.max(m, b.amount), 0)
    const floor = Math.max(cfg.minBid, topOther ? topOther + cfg.step : cfg.minBid)
    if (amt < floor) return { ok: false, error: `پیشنهاد باید حداقل ${floor.toLocaleString('fa-IR')} تومان باشد.` }
    if (!db.roundEndsAt || db.roundEndsAt <= now) db.roundEndsAt = now + cfg.periodDays * DAY   // شروعِ دورِ سراسری
    db.bids = db.bids.filter(b => !(normArea(b.area) === ar && b.owner === owner))
    db.bids.unshift({ id: randomBytes(6).toString('hex'), area: ar, owner, targetId, targetName, amount: amt, createdAt: now })
    return { ok: true }
  })
}

export async function cancelBid(area: string, owner: string): Promise<void> {
  const ar = normArea(area)
  await mutate(db => { db.bids = db.bids.filter(b => !(normArea(b.area) === ar && b.owner === owner)) })
}

// تسویهٔ دورِ تمام‌شده — برای هر محله برنده مشخص، از کیف‌پول کسر، پروموتِ محله‌محور با نشانِ
// «مزایده» فعال، سپس همهٔ شرکت‌کنندگان پیامک + اعلان می‌گیرند و دور بسته می‌شود.
let resolving = false
export async function resolveDue(): Promise<void> {
  if (resolving) return
  resolving = true
  try {
    const cfg = auctionConfig()
    const now = Date.now()
    const db = await load()
    if (!db.roundEndsAt || now < db.roundEndsAt) return
    if (db.bids.length === 0) { await mutate(d => { d.roundEndsAt = null }); return }

    const areas = Array.from(new Set(db.bids.map(b => normArea(b.area))))
    const { chargePromoWallet } = await import('./comm-store')
    const { addPromotion } = await import('./promotion-store')
    const settled: { area: string; winner: Bid | null; bidders: Bid[] }[] = []

    for (const area of areas) {
      const bids = db.bids.filter(b => normArea(b.area) === area).sort((a, b) => b.amount - a.amount || a.createdAt - b.createdAt)
      let winner: Bid | null = null
      for (const b of bids) { const r = await chargePromoWallet(b.owner, b.amount); if (r.ok) { winner = b; break } }
      if (winner) { try { await addPromotion(cfg.promoSlot, winner.targetId, now + cfg.periodDays * DAY, cfg.kind, [area]) } catch {} }
      settled.push({ area, winner, bidders: bids })
    }

    // بستنِ دور + ثبتِ برندگان.
    await mutate(d => {
      d.bids = []
      d.roundEndsAt = null
      for (const s of settled) if (s.winner) d.lastWinners[s.area] = { owner: s.winner.owner, targetName: s.winner.targetName, amount: s.winner.amount, at: now }
    })

    // اعلان‌ها (پیامک + درون‌برنامه) به همهٔ شرکت‌کنندگانِ هر محله.
    try {
      const { sendServiceSms } = await import('./sms')
      const { addNotif } = await import('./notif-store')
      for (const s of settled) {
        if (!s.winner) continue
        const fa = (n: number) => n.toLocaleString('fa-IR')
        for (const b of s.bidders) {
          const won = b.owner === s.winner.owner
          const txt = won
            ? `تبریک! در مزایدهٔ محلهٔ «${s.area}» با پیشنهادِ ${fa(s.winner.amount)} تومان برنده شدید و آگهیِ شما اکنون در صدرِ این محله است.`
            : `مزایدهٔ محلهٔ «${s.area}» با قیمتِ ${fa(s.winner.amount)} تومان به پایان رسید. این‌بار برنده نشدید؛ در دورِ بعد دوباره شرکت کنید.`
          try { await addNotif(b.owner, txt, 'auction') } catch {}
          try { await sendServiceSms(b.owner, txt, 'مزایدهٔ ملک‌جت') } catch {}
        }
      }
    } catch {}
  } finally { resolving = false }
}

// وضعیتِ مزایدهٔ یک محله برای کاربر.
export async function auctionAreaStatus(area: string, owner?: string): Promise<{
  cfg: AuctionConfig; area: string; roundEndsAt: number | null; topBid: number; bidCount: number; myBid: number | null; minNext: number; lastWinner: WinnerRec | null
}> {
  const cfg = auctionConfig()
  await resolveDue()
  const db = await load()
  const ar = normArea(area)
  const bids = db.bids.filter(b => normArea(b.area) === ar)
  const topBid = bids.reduce((m, b) => Math.max(m, b.amount), 0)
  const myBid = owner ? (bids.find(b => b.owner === owner)?.amount ?? null) : null
  const minNext = Math.max(cfg.minBid, topBid ? topBid + cfg.step : cfg.minBid)
  return { cfg, area: ar, roundEndsAt: db.roundEndsAt, topBid, bidCount: bids.length, myBid, minNext, lastWinner: db.lastWinners[ar] || null }
}

// پیشنهادهای فعالِ یک کاربر (در همهٔ محله‌ها) — برای پنل.
export async function myAuctionBids(owner: string): Promise<{ area: string; amount: number; targetName: string; leading: boolean }[]> {
  await resolveDue()
  const db = await load()
  const mine = db.bids.filter(b => b.owner === owner)
  return mine.map(b => {
    const top = db.bids.filter(x => normArea(x.area) === normArea(b.area)).reduce((m, x) => Math.max(m, x.amount), 0)
    return { area: b.area, amount: b.amount, targetName: b.targetName, leading: b.amount >= top }
  })
}
