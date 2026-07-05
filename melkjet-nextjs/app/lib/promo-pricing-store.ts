import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { pgEnabled, kvGet, kvMutate } from './db'

// ── override قیمت‌های پروموت (قابلِ تنظیم از سوپرادمین) ──────────────────────
// پیش‌فرض‌ها در promotion-store هستند؛ این استور فقط «تغییراتِ ادمین» را نگه می‌دارد و
// روی پیش‌فرض‌ها اعمال می‌شود. با کشِ کوتاه‌مدت خوانده می‌شود تا getهایِ همگامِ
// promotion-store بدونِ async شدن، قیمتِ به‌روز را ببینند (سازگار با ۴ اینستنسِ pm2).
const FILE = join(process.cwd(), '.promo-pricing-data.json')
const KV_KEY = 'promo_pricing'

export interface PromoPricing {
  tiers: Record<string, { price?: number; days?: number }>
  packs: Record<string, { pay?: number; credit?: number }>
  bundles: Record<string, { price?: number }>
  auction: Record<string, { minBid?: number; step?: number; periodDays?: number }>
}
const EMPTY: PromoPricing = { tiers: {}, packs: {}, bundles: {}, auction: {} }

function norm(p: any): PromoPricing {
  return { tiers: p?.tiers && typeof p.tiers === 'object' ? p.tiers : {}, packs: p?.packs && typeof p.packs === 'object' ? p.packs : {}, bundles: p?.bundles && typeof p.bundles === 'object' ? p.bundles : {}, auction: p?.auction && typeof p.auction === 'object' ? p.auction : {} }
}
function fileLoad(): PromoPricing { if (existsSync(FILE)) { try { return norm(JSON.parse(readFileSync(FILE, 'utf-8'))) } catch {} } return { tiers: {}, packs: {}, bundles: {}, auction: {} } }
function fileSave(db: PromoPricing) { writeFileSync(FILE, JSON.stringify(db, null, 2), 'utf-8') }

// کشِ درون‌فرایندی — getهایِ همگامِ promotion-store از این می‌خوانند.
let cache: PromoPricing | null = null
let at = 0
const TTL = 5000

async function fresh(): Promise<PromoPricing> { return pgEnabled() ? norm(await kvGet<PromoPricing>(KV_KEY, EMPTY)) : fileLoad() }
// باید ابتدای هر درخواستی که قیمت‌های پروموت را می‌خواند صدا زده شود (کشِ ۵ثانیه‌ای).
export async function ensurePromoPricing(): Promise<void> { if (!cache || Date.now() - at > TTL) { cache = await fresh(); at = Date.now() } }
// خواندنِ همگامِ کش (پس از ensurePromoPricing).
export function promoPricing(): PromoPricing { return cache || EMPTY }
export async function getPromoPricing(): Promise<PromoPricing> { await ensurePromoPricing(); return promoPricing() }

export async function setPromoPricing(patch: any): Promise<PromoPricing> {
  const clean = norm(patch)
  if (pgEnabled()) await kvMutate<PromoPricing, void>(KV_KEY, EMPTY, db => { db.tiers = clean.tiers; db.packs = clean.packs; db.bundles = clean.bundles; db.auction = clean.auction })
  else fileSave(clean)
  cache = clean; at = Date.now()
  return clean
}
