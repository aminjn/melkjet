import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'
import { promoPricing } from './promo-pricing-store'

// ── مزایدهٔ جایگاهِ ویژه — سیستمِ خودگردان ──────────────────────────────────
// مزایدهٔ «مُهرِ بسته» (sealed-bid) و دوره‌ای برای گران‌ترین جایگاه‌ها. کاملاً خودکار:
//  • هر کاربر برای آگهیِ منتشرشدهٔ خود پیشنهاد می‌دهد (یک پیشنهادِ فعال در هر دور).
//  • دور با اولین پیشنهاد آغاز و پس از periodDays بسته می‌شود.
//  • «تسویه» تنبلانه (lazy) است: هر بار وضعیتِ مزایده یا صفحهٔ اصلی خوانده شود، اگر
//    دور تمام شده باشد برنده مشخص، از کیفِ پول کسر و آگهی‌اش برای همان مدت ویژه می‌شود.
//  → بدونِ نیاز به کرون یا دخالتِ مدیر، با رشدِ کاربران خودش کامل کار می‌کند.
const FILE = join(process.cwd(), '.auction-data.json')
const KV_KEY = 'auction'
const DAY = 86400000

export interface AuctionSlot { id: string; promoSlot: string; label: string; target: 'listing'; periodDays: number; minBid: number; step: number; kind: string; forRoles: string[] }
// جایگاهِ مزایده‌ایِ فعلی: «آگهیِ صدرِ صفحهٔ اصلی» (هفتگی). از promoSlotِ home_featured استفاده می‌کند
// که روی صفحهٔ اصلی رندر می‌شود؛ برندهٔ مزایده در صدرِ «املاکِ ویژه» با نشانِ «صفحه اول» می‌آید.
export const AUCTION_SLOTS: AuctionSlot[] = [
  { id: 'home_top', promoSlot: 'home_featured', label: 'آگهیِ صدرِ صفحهٔ اصلی (هفتگی)', target: 'listing', periodDays: 7, minBid: 300000, step: 50000, kind: 'صفحه اول', forRoles: ['/buyer', '/pros', '/agency', '/builder'] },
]
// اعمالِ overrideِ ادمین روی جایگاهِ مزایده (حداقلِ پیشنهاد/پله/مدت).
function applyAuctionOverride(s: AuctionSlot): AuctionSlot {
  try { const o = promoPricing().auction[s.id]; if (o) return { ...s, minBid: o.minBid != null ? o.minBid : s.minBid, step: o.step != null ? o.step : s.step, periodDays: o.periodDays != null ? o.periodDays : s.periodDays } } catch {}
  return s
}
export function auctionSlotOf(id: string) { const s = AUCTION_SLOTS.find(s => s.id === id); return s ? applyAuctionOverride(s) : undefined }
export function auctionSlotsForRole(dash: string) { return AUCTION_SLOTS.filter(s => s.forRoles.includes(dash)).map(applyAuctionOverride) }

export interface Bid { id: string; slot: string; owner: string; targetId: string; targetName: string; amount: number; createdAt: number }
export interface WinnerRec { owner: string; targetName: string; amount: number; at: number }
interface ADB { bids: Bid[]; roundEndsAt: Record<string, number>; lastWinner: Record<string, WinnerRec> }
const EMPTY: ADB = { bids: [], roundEndsAt: {}, lastWinner: {} }

function fileLoad(): ADB { if (existsSync(FILE)) { try { const d = JSON.parse(readFileSync(FILE, 'utf-8')); return { bids: d.bids || [], roundEndsAt: d.roundEndsAt || {}, lastWinner: d.lastWinner || {} } } catch {} } return { bids: [], roundEndsAt: {}, lastWinner: {} } }
function fileSave(db: ADB) { writeFileSync(FILE, JSON.stringify(db, null, 2), 'utf-8') }
async function load(): Promise<ADB> { return pgEnabled() ? await kvGet<ADB>(KV_KEY, EMPTY) : fileLoad() }
async function mutate<R>(fn: (db: ADB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<ADB, R>(KV_KEY, EMPTY, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

// ثبتِ پیشنهاد — یک پیشنهادِ فعال به‌ازای هر کاربر در هر دور (پیشنهادِ جدید جایگزین می‌شود).
// اعتبارِ کیفِ پول باید ≥ مبلغِ پیشنهاد باشد (بررسیِ نرم؛ تسویهٔ نهایی دوباره بررسی می‌کند).
export async function placeBid(slot: string, owner: string, targetId: string, targetName: string, amount: number): Promise<{ ok: boolean; error?: string }> {
  const s = auctionSlotOf(slot); if (!s) return { ok: false, error: 'جایگاهِ مزایده یافت نشد' }
  await resolveDue()   // اول دورِ تمام‌شده را تسویه کن تا پیشنهاد در دورِ درست بنشیند
  const amt = Math.round(amount)
  return mutate(db => {
    const now = Date.now()
    // بالاترین پیشنهادِ فعلی (به‌جز خودِ کاربر) — پیشنهادِ جدید باید حداقل یک پله بالاتر باشد.
    const others = db.bids.filter(b => b.slot === slot && b.owner !== owner)
    const topOther = others.reduce((m, b) => Math.max(m, b.amount), 0)
    const floor = Math.max(s.minBid, topOther ? topOther + s.step : s.minBid)
    if (amt < floor) return { ok: false, error: `پیشنهاد باید حداقل ${floor.toLocaleString('fa-IR')} تومان باشد.` }
    // شروعِ دور اگر فعال نیست.
    if (!db.roundEndsAt[slot] || db.roundEndsAt[slot] <= now) db.roundEndsAt[slot] = now + s.periodDays * DAY
    // جایگزینیِ پیشنهادِ قبلیِ همین کاربر.
    db.bids = db.bids.filter(b => !(b.slot === slot && b.owner === owner))
    db.bids.unshift({ id: randomBytes(6).toString('hex'), slot, owner, targetId, targetName, amount: amt, createdAt: now })
    return { ok: true }
  })
}

export async function cancelBid(slot: string, owner: string): Promise<void> {
  await mutate(db => { db.bids = db.bids.filter(b => !(b.slot === slot && b.owner === owner)) })
}

// تسویهٔ دورهایِ تمام‌شده (تنبل). برنده = بالاترین پیشنهادی که موجودیِ کیف‌پولش کافی باشد.
// پس از تسویه: کسر از کیف‌پول + فعال‌سازیِ پروموت + پاک‌کردنِ پیشنهادها + ثبتِ برنده.
let resolving = false
export async function resolveDue(): Promise<void> {
  if (resolving) return
  resolving = true
  try {
    const now = Date.now()
    const db = await load()
    for (const s of AUCTION_SLOTS) {
      const end = db.roundEndsAt[s.id]
      if (!end || now < end) continue
      const bids = db.bids.filter(b => b.slot === s.id).sort((a, b) => b.amount - a.amount || a.createdAt - b.createdAt)
      // برنده = اولین پیشنهادی که کسر از کیف‌پولش موفق شود.
      let winner: Bid | null = null
      const { chargePromoWallet } = await import('./comm-store')
      for (const b of bids) {
        const r = await chargePromoWallet(b.owner, b.amount)
        if (r.ok) { winner = b; break }
      }
      if (winner) {
        try {
          const { addPromotion } = await import('./promotion-store')
          await addPromotion(s.promoSlot, winner.targetId, now + s.periodDays * DAY, s.kind)
        } catch {}
      }
      // بستنِ دور: پاک‌کردنِ پیشنهادهای این جایگاه + ثبتِ برنده + آزادکردنِ دور.
      await mutate(d => {
        d.bids = d.bids.filter(b => b.slot !== s.id)
        delete d.roundEndsAt[s.id]
        if (winner) d.lastWinner[s.id] = { owner: winner.owner, targetName: winner.targetName, amount: winner.amount, at: now }
      })
    }
  } finally { resolving = false }
}

// وضعیتِ یک جایگاه برای کاربر (پس از تسویهٔ تنبل).
export async function auctionStatus(slot: string, owner?: string): Promise<{
  slot: AuctionSlot; roundEndsAt: number | null; topBid: number; bidCount: number; myBid: number | null; minNext: number; lastWinner: WinnerRec | null
} | null> {
  const s = auctionSlotOf(slot); if (!s) return null
  await resolveDue()
  const db = await load()
  const bids = db.bids.filter(b => b.slot === slot)
  const topBid = bids.reduce((m, b) => Math.max(m, b.amount), 0)
  const myBid = owner ? (bids.find(b => b.owner === owner)?.amount ?? null) : null
  const minNext = Math.max(s.minBid, topBid ? topBid + s.step : s.minBid)
  return { slot: s, roundEndsAt: db.roundEndsAt[slot] || null, topBid, bidCount: bids.length, myBid, minNext, lastWinner: db.lastWinner[slot] || null }
}
