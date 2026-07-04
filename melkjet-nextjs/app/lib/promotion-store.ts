import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { getItemById } from './scraper-store'

const FILE = join(process.cwd(), '.promotion-data.json')

// فهرست همهٔ جایگاه‌هایی که در سایت می‌توان چیزی را «پروموت/ویژه» کرد.
export const PROMO_SLOTS: { id: string; label: string; target: 'listing' | 'directory' | 'product'; where: string }[] = [
  { id: 'home_featured', label: 'صفحهٔ خانه — املاک ویژه', target: 'listing', where: 'بخش «املاک ویژه» صفحهٔ اصلی' },
  { id: 'home_invest', label: 'صفحهٔ خانه — فرصت‌های سرمایه‌گذاری', target: 'listing', where: 'بخش «فرصت‌های سرمایه‌گذاری» صفحهٔ اصلی' },
  { id: 'home_advisors', label: 'صفحهٔ خانه — مشاوران برتر', target: 'directory', where: 'بخش «مشاوران برتر» صفحهٔ اصلی' },
  { id: 'search_top', label: 'بالای نتایج جستجو', target: 'listing', where: 'اولین نتایج صفحهٔ جستجو' },
  { id: 'neighborhood_featured', label: 'صفحهٔ محله — آگهی ویژه', target: 'listing', where: 'آگهی برجستهٔ صفحهٔ محله' },
  { id: 'directory_top', label: 'صفحهٔ مشاوران — مشاور ویژه', target: 'directory', where: 'بالای فهرست مشاوران' },
  { id: 'store_featured', label: 'فروشگاه — محصول ویژه', target: 'product', where: 'محصول برجستهٔ فروشگاه' },
  { id: 'presale_featured', label: 'پیش‌فروش — پروژهٔ ویژه', target: 'listing', where: 'پروژهٔ برجستهٔ پیش‌فروش' },
]
export function slotOf(id: string) { return PROMO_SLOTS.find(s => s.id === id) }

export interface Promotion {
  id: string; slot: string; targetId: string; title: string; image?: string; price?: string; location?: string
  order: number; active: boolean; expiresAt?: number; createdAt: number
}

function load(): Promotion[] { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return [] }
function save(rows: Promotion[]) { writeFileSync(FILE, JSON.stringify(rows, null, 2), 'utf-8') }

export function listPromotions(slot?: string): Promotion[] {
  return load().filter(p => !slot || p.slot === slot).sort((a, b) => a.order - b.order || b.createdAt - a.createdAt)
}

// پروموت‌های فعالِ یک جایگاه (با احتساب انقضا) — برای نمایش عمومی.
export function listActive(slot: string): Promotion[] {
  const now = Date.now()
  return load().filter(p => p.slot === slot && p.active && (!p.expiresAt || p.expiresAt > now)).sort((a, b) => a.order - b.order)
}

export async function addPromotion(slot: string, targetId: string, expiresAt?: number): Promise<Promotion | null> {
  if (!slotOf(slot)) return null
  const it = await getItemById(targetId)
  if (!it) return null
  const rows = load()
  const order = rows.filter(p => p.slot === slot).length
  const promo: Promotion = {
    id: randomBytes(6).toString('hex'), slot, targetId, title: it.title, image: it.image,
    price: it.price, location: it.location, order, active: true, expiresAt, createdAt: Date.now(),
  }
  rows.unshift(promo); save(rows); return promo
}

export function updatePromotion(id: string, patch: Partial<Pick<Promotion, 'order' | 'active' | 'expiresAt'>>): Promotion | null {
  const rows = load(); const p = rows.find(x => x.id === id); if (!p) return null
  if (patch.order !== undefined) p.order = patch.order
  if (patch.active !== undefined) p.active = patch.active
  if (patch.expiresAt !== undefined) p.expiresAt = patch.expiresAt
  save(rows); return p
}

export function deletePromotion(id: string) { save(load().filter(p => p.id !== id)) }
