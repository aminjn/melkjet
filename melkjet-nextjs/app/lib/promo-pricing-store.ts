import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { pgEnabled, kvGet, kvMutate } from './db'
import type { PromoTier } from './promotion-store'

// ── کاتالوگ + قیمت‌گذاریِ پروموت (کاملاً قابلِ تنظیم از سوپرادمین) ───────────────
// پیش‌فرض‌ها (seed) در promotion-store هستند؛ این استور «تغییراتِ ادمین» را نگه می‌دارد و
// روی seed اعمال می‌شود: ویرایشِ قیمت/مدت/نام/نشان/جایگاه/نقش‌ها، فعال/غیرفعال، حذفِ
// بسته‌های seed، و افزودنِ بسته‌های کاملاً جدید. با کشِ کوتاه خوانده می‌شود تا getهایِ
// همگامِ promotion-store بدونِ async شدن، کاتالوگِ به‌روز را ببینند (سازگار با ۴ اینستنس).
const FILE = join(process.cwd(), '.promo-pricing-data.json')
const KV_KEY = 'promo_pricing'

export interface PromoPricing {
  tiers: Record<string, { price?: number; days?: number }>
  packs: Record<string, { pay?: number; credit?: number }>
  bundles: Record<string, { price?: number }>
  auction: Record<string, { minBid?: number; step?: number; periodDays?: number; enabled?: boolean }>
  // کنترلِ کاملِ کاتالوگِ تیرها:
  tierMeta?: Record<string, { name?: string; kind?: string; slot?: string; desc?: string; forRoles?: string[]; enabled?: boolean }>
  deletedTiers?: string[]          // idِ تیرهای seed که ادمین حذف کرده
  customTiers?: PromoTier[]        // تیرهای کاملاً جدیدِ ادمین
  areaConfig?: { maxAreas?: number }   // سقفِ محله‌های هر پروموتِ محله‌محور (بدونِ رایگان/اضافه)
}
const EMPTY: PromoPricing = { tiers: {}, packs: {}, bundles: {}, auction: {}, tierMeta: {}, deletedTiers: [], customTiers: [] }

function norm(p: any): PromoPricing {
  const o = (x: any) => (x && typeof x === 'object' && !Array.isArray(x)) ? x : {}
  return {
    tiers: o(p?.tiers), packs: o(p?.packs), bundles: o(p?.bundles), auction: o(p?.auction),
    tierMeta: o(p?.tierMeta),
    deletedTiers: Array.isArray(p?.deletedTiers) ? p.deletedTiers.map(String) : [],
    customTiers: Array.isArray(p?.customTiers) ? p.customTiers : [],
    areaConfig: o(p?.areaConfig),
  }
}
function fileLoad(): PromoPricing { if (existsSync(FILE)) { try { return norm(JSON.parse(readFileSync(FILE, 'utf-8'))) } catch {} } return norm({}) }
function fileSave(db: PromoPricing) { writeFileSync(FILE, JSON.stringify(db, null, 2), 'utf-8') }

// کشِ درون‌فرایندی — getهایِ همگامِ promotion-store از این می‌خوانند.
let cache: PromoPricing | null = null
let at = 0
const TTL = 5000

async function fresh(): Promise<PromoPricing> { return pgEnabled() ? norm(await kvGet<PromoPricing>(KV_KEY, EMPTY)) : fileLoad() }
// باید ابتدای هر درخواستی که کاتالوگِ پروموت را می‌خواند صدا زده شود (کشِ ۵ثانیه‌ای).
export async function ensurePromoPricing(): Promise<void> { if (!cache || Date.now() - at > TTL) { cache = await fresh(); at = Date.now() } }
// خواندنِ همگامِ کش (پس از ensurePromoPricing).
export function promoPricing(): PromoPricing { return cache || EMPTY }
export async function getPromoPricing(): Promise<PromoPricing> { await ensurePromoPricing(); return promoPricing() }

export async function setPromoPricing(patch: any): Promise<PromoPricing> {
  const clean = norm(patch)
  if (pgEnabled()) await kvMutate<PromoPricing, void>(KV_KEY, EMPTY, db => { db.tiers = clean.tiers; db.packs = clean.packs; db.bundles = clean.bundles; db.auction = clean.auction; db.tierMeta = clean.tierMeta; db.deletedTiers = clean.deletedTiers; db.customTiers = clean.customTiers; db.areaConfig = clean.areaConfig })
  else fileSave(clean)
  cache = clean; at = Date.now()
  return clean
}
