// 🎨 فروشگاهِ سازندگان (فاز ۱۰۷ — سند ۲۲ Creator Store): بازیکنان خودشان قاب/نشانِ ظاهری طراحی می‌کنند؛
// پس از تأییدِ انسانیِ ادمین در فروشگاهِ ظاهری فروخته می‌شود و سهمِ سازنده (knob) به کوینِ او واریز می‌شود.
// مثل همهٔ آیتم‌های ظاهری: صفر اثرِ اقتصادی/رقابتی (No P2W) — فقط دیده‌شدن. ذخیره dual-mode (kv اتمیک روی PG، وگرنه فایل).
import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'

const FILE = path.join(process.cwd(), '.empire-creator-data.json')
const KEY = 'empire_creator'

export interface CreatorItem {
  id: string
  by: { userId: string; no: number; name: string }
  kind: 'frame' | 'flair'
  icon: string          // ایموجی (حداکثر چند کاراکتر)
  label: string
  priceCoins: number
  status: 'pending' | 'approved' | 'rejected'
  note?: string         // یادداشتِ ادمین در رد (به سازنده نمایش داده می‌شود)
  sales: number
  earnedCoins: number   // جمعِ سهمِ واریزشده به سازنده
  at: number
  decidedAt?: number
}
type CreatorDb = { items: CreatorItem[] }

async function load(): Promise<CreatorDb> {
  if (pgEnabled()) return kvGet<CreatorDb>(KEY, { items: [] }).catch(() => ({ items: [] }))
  try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')) } catch { return { items: [] } }
}
async function mutate<R>(fn: (d: CreatorDb) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<CreatorDb, R>(KEY, { items: [] }, fn)
  let d: CreatorDb = { items: [] }
  try { d = JSON.parse(fs.readFileSync(FILE, 'utf-8')) } catch {}
  const r = fn(d)
  try { fs.writeFileSync(FILE, JSON.stringify(d)) } catch {}
  return r
}

export type CreatorCfg = { enabled: boolean; sharePct: number; minPriceCoins: number; maxPriceCoins: number; maxPendingPerUser: number }

// واژه‌های ممنوع در برچسب (قانون ۳: هرگز «بازی» در UI کاربر؛ + نام‌های ممنوعِ دستیار)
const BANNED = /بازی|گیم|نورا|قمار|شرط/

// اعتبارسنجیِ خالص (تست‌پذیر): null = معتبر، وگرنه پیامِ فارسیِ صادقانه.
export function validateCreatorItem(
  input: { kind?: string; icon?: string; label?: string; priceCoins?: number },
  cfg: CreatorCfg,
  pendingCount: number,
): string | null {
  if (!cfg.enabled) return 'فروشگاهِ سازندگان فعال نیست'
  if (pendingCount >= Math.max(1, cfg.maxPendingPerUser)) return `حداکثر ${Math.max(1, cfg.maxPendingPerUser).toLocaleString('fa-IR')} طرحِ در انتظارِ بررسی می‌توانی داشته باشی — صبر کن نتیجهٔ قبلی‌ها بیاید`
  if (input.kind !== 'frame' && input.kind !== 'flair') return 'نوعِ آیتم باید قاب یا نشان باشد'
  const icon = String(input.icon || '').trim()
  if (!icon || [...icon].length > 4) return 'یک ایموجیِ کوتاه برای آیتم انتخاب کن'
  if (/[<>&"']/.test(icon)) return 'ایموجیِ نامعتبر'
  const label = String(input.label || '').trim()
  if (label.length < 2 || label.length > 30) return 'نامِ آیتم باید ۲ تا ۳۰ کاراکتر باشد'
  if (BANNED.test(label) || BANNED.test(icon)) return 'این نام مجاز نیست — نامِ دیگری انتخاب کن'
  const price = Math.round(Number(input.priceCoins) || 0)
  if (price < Math.max(1, cfg.minPriceCoins) || price > Math.max(cfg.minPriceCoins, cfg.maxPriceCoins))
    return `قیمت باید بینِ ${Math.max(1, cfg.minPriceCoins).toLocaleString('fa-IR')} و ${Math.max(cfg.minPriceCoins, cfg.maxPriceCoins).toLocaleString('fa-IR')} کوین باشد`
  return null
}

// سهمِ سازنده از هر فروش — باقیمانده (کارمزدِ ملک‌جت) از گردش حذف می‌شود: چاهِ شفافِ کوین.
export function creatorShareOf(priceCoins: number, sharePct: number): number {
  return Math.max(0, Math.floor(Math.round(priceCoins) * Math.min(100, Math.max(0, sharePct)) / 100))
}

export async function submitCreatorItem(
  by: { userId: string; no: number; name: string },
  input: { kind?: string; icon?: string; label?: string; priceCoins?: number },
  cfg: CreatorCfg,
): Promise<{ ok: boolean; reason?: string; item?: CreatorItem }> {
  return mutate(db => {
    const pending = db.items.filter(i => i.by.userId === by.userId && i.status === 'pending').length
    const err = validateCreatorItem(input, cfg, pending)
    if (err) return { ok: false, reason: err }
    const item: CreatorItem = {
      id: randomBytes(5).toString('hex'),
      by, kind: input.kind as 'frame' | 'flair',
      icon: String(input.icon).trim(), label: String(input.label).trim(),
      priceCoins: Math.round(Number(input.priceCoins) || 0),
      status: 'pending', sales: 0, earnedCoins: 0, at: Date.now(),
    }
    db.items.unshift(item)
    if (db.items.length > 500) db.items = db.items.slice(0, 500)   // سقفِ ساختاری
    return { ok: true, item }
  })
}

export async function myCreatorItems(userId: string): Promise<CreatorItem[]> {
  return (await load()).items.filter(i => i.by.userId === userId).slice(0, 30)
}

export async function listCreatorItems(): Promise<CreatorItem[]> {
  return (await load()).items.slice(0, 120)
}

// کشِ همگامِ آیکن‌ها برای cosmeticIconOf (لیدربورد/پروفایل sync است) — با هر خواندنِ approved تازه می‌شود.
let ICON_CACHE: Record<string, string> = {}
export function creatorIconOf(id: string): string { return ICON_CACHE[id] || '' }

export async function approvedCreatorItems(): Promise<CreatorItem[]> {
  const items = (await load()).items.filter(i => i.status === 'approved')
  const next: Record<string, string> = {}
  for (const i of items) next['cr_' + i.id] = i.icon
  ICON_CACHE = next
  return items
}

export async function decideCreatorItem(id: string, approve: boolean, note?: string): Promise<{ ok: boolean; reason?: string; item?: CreatorItem }> {
  return mutate(db => {
    const it = db.items.find(i => i.id === id)
    if (!it) return { ok: false, reason: 'این طرح یافت نشد' }
    if (it.status !== 'pending') return { ok: false, reason: 'قبلاً تصمیم‌گیری شده' }
    it.status = approve ? 'approved' : 'rejected'
    it.decidedAt = Date.now()
    if (!approve && note) it.note = String(note).slice(0, 120)
    return { ok: true, item: it }
  })
}

// ثبتِ فروش: شمارنده + جمعِ سهمِ سازنده (واریزِ کوین به سازنده جدا در empire-store انجام می‌شود).
export async function recordCreatorSale(id: string, creatorShare: number): Promise<void> {
  await mutate(db => {
    const it = db.items.find(i => i.id === id)
    if (it) { it.sales += 1; it.earnedCoins += Math.max(0, Math.round(creatorShare)) }
  })
}
