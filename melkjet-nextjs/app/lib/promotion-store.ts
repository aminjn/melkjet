import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { getItemById } from './scraper-store'
import { pgEnabled, kvGet, kvMutate } from './db'
import { promoPricing } from './promo-pricing-store'

const FILE = join(process.cwd(), '.promotion-data.json')
const KV_KEY = 'promotions'

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
  { id: 'home_trending', label: 'صفحهٔ خانه — آگهی‌های ترند', target: 'listing', where: 'بخش «ترند/داغِ» صفحهٔ اصلی' },
]
export function slotOf(id: string) { return PROMO_SLOTS.find(s => s.id === id) }

// موتورِ پروموت (نقش‌محور): کاربر خودش می‌خرد؛ سوپرادمین تأیید می‌کند. قیمت‌ها سمتِ سرور تعریف می‌شوند.
// پروموت جدا از اشتراک است؛ حتی کاربرانِ رایگان هم پروموت می‌خرند. `kind` = نشانِ فارسیِ کوتاه،
// `forRoles` = داشبوردهایی که این بسته را می‌بینند.
export interface PromoTier { id: string; slot: string; target: 'profile' | 'listing'; days: number; name: string; price: number; desc: string; kind: string; forRoles?: string[] }
const LISTING_ROLES = ['/buyer', '/pros', '/agency', '/builder']
export const PROMO_TIERS: PromoTier[] = [
  // ── آگهی/پروژه (listing) — نردبان/ویژه/VIP/صفحهٔ اول/ترند ──
  { id: 'l_ladder_1d', slot: 'search_top', target: 'listing', days: 1, name: 'نردبان ۲۴ ساعت', price: 49000, kind: 'نردبان', forRoles: LISTING_ROLES, desc: 'قرارگرفتنِ آگهیِ شما بالای نتایجِ جستجو — ۲۴ ساعت' },
  { id: 'l_ladder_7d', slot: 'search_top', target: 'listing', days: 7, name: 'نردبان ۷ روز', price: 149000, kind: 'نردبان', forRoles: LISTING_ROLES, desc: 'قرارگرفتنِ مکررِ آگهیِ شما بالای نتایجِ جستجو — ۷ روز' },
  { id: 'l_featured_7d', slot: 'home_featured', target: 'listing', days: 7, name: 'ویژه ۷ روز', price: 199000, kind: 'ویژه', forRoles: LISTING_ROLES, desc: 'نمایشِ آگهیِ شما در «املاکِ ویژه» صفحهٔ اصلی — ۷ روز' },
  { id: 'l_vip_7d', slot: 'home_featured', target: 'listing', days: 7, name: 'VIP ۷ روز', price: 299000, kind: 'VIP', forRoles: LISTING_ROLES, desc: 'نشانِ VIP + بالاترین اولویتِ نمایش در «املاکِ ویژه» — ۷ روز' },
  { id: 'l_frontpage_7d', slot: 'home_featured', target: 'listing', days: 7, name: 'صفحهٔ اول ۷ روز', price: 499000, kind: 'صفحه اول', forRoles: LISTING_ROLES, desc: 'نمایشِ برجستهٔ آگهیِ شما در صدرِ صفحهٔ نخستِ ملک‌جت — ۷ روز' },
  { id: 'l_trending_7d', slot: 'home_trending', target: 'listing', days: 7, name: 'ترند ۷ روز', price: 399000, kind: 'ترند', forRoles: LISTING_ROLES, desc: 'نمایشِ آگهیِ شما در بخشِ «ترند/داغِ» صفحهٔ اصلی — ۷ روز' },

  // ── مشاور /pros ──
  { id: 'pros_featured', slot: 'directory_top', target: 'profile', days: 30, name: 'مشاورِ ویژه', price: 199000, kind: 'ویژه', forRoles: ['/pros'], desc: 'نشانِ ★ ویژه و اولویتِ بالاتر در فهرستِ مشاوران — ۳۰ روز' },
  { id: 'pros_top', slot: 'directory_top', target: 'profile', days: 30, name: 'مشاورِ منتخبِ منطقه', price: 399000, kind: 'منتخب', forRoles: ['/pros'], desc: 'نمایش به‌عنوانِ مشاورِ منتخبِ منطقهٔ شما در صدرِ فهرست — ۳۰ روز' },
  { id: 'pros_home', slot: 'home_advisors', target: 'profile', days: 30, name: 'نمایش در صفحهٔ اصلی', price: 349000, kind: 'صفحه اول', forRoles: ['/pros'], desc: 'معرفیِ شما در بخشِ «مشاورانِ برترِ» صفحهٔ نخست — ۳۰ روز' },

  // ── آژانس /agency ──
  { id: 'agency_top', slot: 'directory_top', target: 'profile', days: 30, name: 'آژانسِ برتر', price: 999000, kind: 'برتر', forRoles: ['/agency'], desc: 'بالاترین اولویتِ نمایش + نشانِ برترِ آژانس در دایرکتوری — ۳۰ روز' },
  { id: 'agency_featured', slot: 'directory_top', target: 'profile', days: 30, name: 'آژانسِ ویژه', price: 499000, kind: 'ویژه', forRoles: ['/agency'], desc: 'نشانِ ★ ویژه و اولویتِ بالاتر برای آژانسِ شما — ۳۰ روز' },
  { id: 'agency_hero', slot: 'home_advisors', target: 'profile', days: 7, name: 'بنرِ Hero آژانس', price: 1500000, kind: 'VIP', forRoles: ['/agency'], desc: 'نمایشِ ویژهٔ آژانسِ شما در بنرِ قهرمانِ صفحهٔ اصلی — ۷ روز' },

  // ── معمار /architect ──
  { id: 'arch_featured', slot: 'directory_top', target: 'profile', days: 30, name: 'معمارِ ویژه', price: 199000, kind: 'ویژه', forRoles: ['/architect'], desc: 'نشانِ ★ ویژه و اولویتِ بالاتر در فهرستِ معماران — ۳۰ روز' },
  { id: 'arch_spotlight', slot: 'home_advisors', target: 'profile', days: 30, name: 'نمایشِ نمونه‌کار (Spotlight)', price: 349000, kind: 'منتخب', forRoles: ['/architect'], desc: 'معرفیِ نمونه‌کارهای شما در صفحهٔ اصلی — ۳۰ روز' },

  // ── پیمانکار /contractor ──
  { id: 'contractor_featured', slot: 'directory_top', target: 'profile', days: 30, name: 'پیمانکارِ ویژه', price: 199000, kind: 'ویژه', forRoles: ['/contractor'], desc: 'نشانِ ★ ویژه و اولویتِ بالاتر در فهرستِ پیمانکاران — ۳۰ روز' },
  { id: 'contractor_top', slot: 'directory_top', target: 'profile', days: 30, name: 'پیمانکارِ برتر', price: 349000, kind: 'برتر', forRoles: ['/contractor'], desc: 'نمایش به‌عنوانِ پیمانکارِ برتر در صدرِ فهرست — ۳۰ روز' },

  // ── کارشناس /appraiser ──
  { id: 'appraiser_verified', slot: 'directory_top', target: 'profile', days: 30, name: 'کارشناسِ تأییدشده', price: 199000, kind: 'تأییدشده', forRoles: ['/appraiser'], desc: 'نشانِ تأییدشده و اعتمادِ بیشتر در فهرستِ کارشناسان — ۳۰ روز' },
  { id: 'appraiser_top', slot: 'directory_top', target: 'profile', days: 30, name: 'کارشناسِ برتر', price: 349000, kind: 'برتر', forRoles: ['/appraiser'], desc: 'نمایش به‌عنوانِ کارشناسِ برتر در صدرِ فهرست — ۳۰ روز' },

  // ── دفترِ حقوقی /lawfirm ──
  { id: 'lawfirm_top', slot: 'directory_top', target: 'profile', days: 30, name: 'دفترِ حقوقیِ برتر', price: 399000, kind: 'برتر', forRoles: ['/lawfirm'], desc: 'بالاترین اولویتِ نمایش + نشانِ برتر برای دفترِ حقوقیِ شما — ۳۰ روز' },
  { id: 'lawfirm_featured', slot: 'directory_top', target: 'profile', days: 30, name: 'وکیلِ ویژه', price: 199000, kind: 'ویژه', forRoles: ['/lawfirm'], desc: 'نشانِ ★ ویژه و اولویتِ بالاتر در فهرستِ حقوقی — ۳۰ روز' },

  // ── وکیل /legal ──
  { id: 'legal_featured', slot: 'directory_top', target: 'profile', days: 30, name: 'وکیلِ ویژه', price: 199000, kind: 'ویژه', forRoles: ['/legal'], desc: 'نشانِ ★ ویژه و اولویتِ بالاتر در فهرستِ وکلا — ۳۰ روز' },
  { id: 'legal_top', slot: 'directory_top', target: 'profile', days: 30, name: 'وکیلِ برتر', price: 349000, kind: 'برتر', forRoles: ['/legal'], desc: 'نمایش به‌عنوانِ وکیلِ برتر در صدرِ فهرست — ۳۰ روز' },

  // ── مالی /finance ──
  { id: 'finance_featured', slot: 'directory_top', target: 'profile', days: 30, name: 'شریکِ مالیِ ویژه', price: 499000, kind: 'ویژه', forRoles: ['/finance'], desc: 'نشانِ ★ ویژه و اولویتِ بالاتر در فهرستِ شرکای مالی — ۳۰ روز' },
  { id: 'finance_home', slot: 'home_advisors', target: 'profile', days: 30, name: 'نمایش در صفحهٔ اصلی', price: 999000, kind: 'صفحه اول', forRoles: ['/finance'], desc: 'معرفیِ شما در بخشِ برترِ صفحهٔ نخستِ ملک‌جت — ۳۰ روز' },

  // ── دفترخانه /notary ──
  { id: 'notary_verified', slot: 'directory_top', target: 'profile', days: 30, name: 'دفترخانهٔ تأییدشده', price: 199000, kind: 'تأییدشده', forRoles: ['/notary'], desc: 'نشانِ تأییدشده و اعتمادِ بیشتر در فهرستِ دفاترِ اسناد — ۳۰ روز' },
  { id: 'notary_top', slot: 'directory_top', target: 'profile', days: 30, name: 'دفترخانهٔ برتر', price: 349000, kind: 'برتر', forRoles: ['/notary'], desc: 'نمایش به‌عنوانِ دفترخانهٔ برتر در صدرِ فهرست — ۳۰ روز' },

  // ── سازنده /builder (پروفایل؛ آگهی‌های پروژه از بسته‌های listing استفاده می‌کنند) ──
  { id: 'builder_featured', slot: 'directory_top', target: 'profile', days: 30, name: 'سازندهٔ ویژه', price: 499000, kind: 'ویژه', forRoles: ['/builder'], desc: 'نشانِ ★ ویژه و اولویتِ بالاتر برای سازندهٔ شما در دایرکتوری — ۳۰ روز' },

  // ── تأمین‌کنندهٔ مصالح /materials ──
  { id: 'materials_featured', slot: 'directory_top', target: 'profile', days: 30, name: 'تأمین‌کنندهٔ ویژه', price: 199000, kind: 'ویژه', forRoles: ['/materials'], desc: 'نشانِ ★ ویژه و اولویتِ بالاتر در فهرستِ تأمین‌کنندگان — ۳۰ روز' },
  { id: 'materials_top', slot: 'directory_top', target: 'profile', days: 30, name: 'تأمین‌کنندهٔ برتر', price: 499000, kind: 'برتر', forRoles: ['/materials'], desc: 'نمایش به‌عنوانِ تأمین‌کنندهٔ برتر در صدرِ فهرست — ۳۰ روز' },
  { id: 'materials_product', slot: 'store_featured', target: 'listing', days: 7, name: 'محصولِ ویژهٔ فروشگاه', price: 149000, kind: 'ویژه', forRoles: ['/materials'], desc: 'نمایشِ محصولِ شما به‌عنوانِ محصولِ برجستهٔ فروشگاه — ۷ روز' },
]
// اعمالِ overrideِ ادمین روی یک تیر (قیمت/مدت).
function applyTierOverride(t: PromoTier): PromoTier {
  try { const o = promoPricing().tiers[t.id]; if (o) return { ...t, price: o.price != null ? o.price : t.price, days: o.days != null ? o.days : t.days } } catch {}
  return t
}
export function promoTierOf(id: string) { const t = PROMO_TIERS.find(t => t.id === id); return t ? applyTierOverride(t) : undefined }
// بسته‌های قابلِ نمایش برای یک داشبورد (نقش) — اگر forRoles نداشته باشد برای همه است.
export function tiersForRole(dash: string): PromoTier[] { return PROMO_TIERS.filter(t => !t.forRoles || t.forRoles.includes(dash)).map(applyTierOverride) }

// ── تخفیفِ پروموت بر اساسِ پلنِ اشتراکِ کاربر (کلیدواژهٔ نامِ پلن → درصد) ──
export const PLAN_PROMO_DISCOUNT: Record<string, number> = {
  'رایگان': 0, 'free': 0,
  'starter': 5, 'basic': 5, 'lite': 5, 'team': 5,
  'growth': 10, 'advanced': 10, 'pro': 10, 'plus': 10,
  'professional': 15, 'business': 15, 'expert': 15,
  'elite': 20, 'premium': 20, 'max': 20,
  'enterprise': 30,
}
// بیشترین تخفیفِ منطبق با نامِ پلن (case-insensitive contains). پیش‌فرض ۰.
export function promoDiscountForPlanName(name?: string): number {
  const n = String(name || '').toLowerCase().trim()
  if (!n) return 0
  let best = 0
  for (const [k, v] of Object.entries(PLAN_PROMO_DISCOUNT)) if (n.includes(k) && v > best) best = v
  return best
}

// ── باندل‌های پروموت (چند بسته با یک قیمتِ تخفیف‌خورده) — فقط بسته‌های profile تا فعال‌سازی ساده باشد ──
export interface PromoBundle { id: string; name: string; desc: string; tierIds: string[]; price: number; forRoles: string[] }
export const PROMO_BUNDLES: PromoBundle[] = [
  { id: 'bundle_pros_gold', name: 'باندلِ «مشاورِ طلایی»', desc: 'ویژه + منتخبِ منطقه + نمایش در صفحهٔ اصلی — یکجا و اقتصادی', tierIds: ['pros_featured', 'pros_top', 'pros_home'], price: 599000, forRoles: ['/pros'] },
  { id: 'bundle_arch_pro', name: 'باندلِ «معمارِ حرفه‌ای»', desc: 'معمارِ ویژه + نمایشِ نمونه‌کار (Spotlight) — یکجا', tierIds: ['arch_featured', 'arch_spotlight'], price: 449000, forRoles: ['/architect'] },
  { id: 'bundle_legal_top', name: 'باندلِ «حقوقیِ برتر»', desc: 'وکیلِ ویژه + دفترِ حقوقیِ برتر — یکجا', tierIds: ['lawfirm_featured', 'lawfirm_top'], price: 499000, forRoles: ['/lawfirm', '/legal'] },
]
function applyBundleOverride(b: PromoBundle): PromoBundle {
  try { const o = promoPricing().bundles[b.id]; if (o && o.price != null) return { ...b, price: o.price } } catch {}
  return b
}
export function bundlesAll(): PromoBundle[] { return PROMO_BUNDLES.map(applyBundleOverride) }
export function bundleOf(id: string) { const b = PROMO_BUNDLES.find(b => b.id === id); return b ? applyBundleOverride(b) : undefined }

// ── اعتبارِ پروموت (کیفِ پولِ پیش‌پرداختِ تبلیغات) — مدلِ «شارژِ کیف‌پول» مثلِ عملیاتِ AI ──
// کاربر مبلغی می‌پردازد و اعتبارِ بیشتری (با پاداش) می‌گیرد؛ بعداً هر پروموت را می‌تواند «از
// کیفِ پول» پرداخت کند که فوری و بدونِ انتظارِ تأییدِ مدیر فعال می‌شود.
export interface PromoCreditPack { id: string; name: string; pay: number; credit: number; bonusPct: number }
export const PROMO_CREDIT_PACKS: PromoCreditPack[] = [
  { id: 'pc_200', name: 'شارژِ پایه', pay: 200000, credit: 220000, bonusPct: 10 },
  { id: 'pc_500', name: 'شارژِ استاندارد', pay: 500000, credit: 575000, bonusPct: 15 },
  { id: 'pc_1000', name: 'شارژِ حرفه‌ای', pay: 1000000, credit: 1200000, bonusPct: 20 },
  { id: 'pc_2000', name: 'شارژِ کسب‌وکار', pay: 2000000, credit: 2600000, bonusPct: 30 },
]
function applyPackOverride(p: PromoCreditPack): PromoCreditPack {
  try { const o = promoPricing().packs[p.id]; if (o) { const pay = o.pay != null ? o.pay : p.pay, credit = o.credit != null ? o.credit : p.credit; return { ...p, pay, credit, bonusPct: pay > 0 ? Math.round((credit / pay - 1) * 100) : p.bonusPct } } } catch {}
  return p
}
export function creditPacks(): PromoCreditPack[] { return PROMO_CREDIT_PACKS.map(applyPackOverride) }
export function creditPackOf(id: string) { const p = PROMO_CREDIT_PACKS.find(p => p.id === id); return p ? applyPackOverride(p) : undefined }

export interface Promotion {
  id: string; slot: string; targetId: string; title: string; image?: string; price?: string; location?: string
  order: number; active: boolean; expiresAt?: number; createdAt: number; kind?: string
}

// دومَحاله: DATABASE_URL ست باشد → Postgres (نوشتنِ اتمیک، سازگار با ۴ اینستنسِ pm2)، وگرنه فایل.
interface PDB { rows: Promotion[] }
function fileLoad(): PDB { if (existsSync(FILE)) { try { const raw = JSON.parse(readFileSync(FILE, 'utf-8')); return { rows: Array.isArray(raw) ? raw : (Array.isArray(raw.rows) ? raw.rows : []) } } catch {} } return { rows: [] } }
function fileSave(db: PDB) { writeFileSync(FILE, JSON.stringify(db.rows, null, 2), 'utf-8') }
async function load(): Promise<Promotion[]> { return (pgEnabled() ? await kvGet<PDB>(KV_KEY, { rows: [] }) : fileLoad()).rows }
async function mutate<R>(fn: (rows: Promotion[]) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<PDB, R>(KV_KEY, { rows: [] }, db => fn(db.rows))
  const db = fileLoad(); const r = fn(db.rows); fileSave(db); return r
}

export async function listPromotions(slot?: string): Promise<Promotion[]> {
  return (await load()).filter(p => !slot || p.slot === slot).sort((a, b) => a.order - b.order || b.createdAt - a.createdAt)
}

// پروموت‌های فعالِ یک جایگاه (با احتساب انقضا) — برای نمایش عمومی.
export async function listActive(slot: string): Promise<Promotion[]> {
  const now = Date.now()
  return (await load()).filter(p => p.slot === slot && p.active && (!p.expiresAt || p.expiresAt > now)).sort((a, b) => a.order - b.order)
}

// همهٔ پروموت‌های فعال (هر جایگاه) — برای نمایِ مدیریتیِ سوپرادمین.
export async function listAllActive(): Promise<Promotion[]> {
  const now = Date.now()
  return (await load()).filter(p => p.active && (!p.expiresAt || p.expiresAt > now)).sort((a, b) => b.createdAt - a.createdAt)
}

export async function addPromotion(slot: string, targetId: string, expiresAt?: number, kind?: string): Promise<Promotion | null> {
  if (!slotOf(slot)) return null
  const it = await getItemById(targetId)
  if (!it) return null
  return mutate(rows => {
    const order = rows.filter(p => p.slot === slot).length
    const promo: Promotion = {
      id: randomBytes(6).toString('hex'), slot, targetId, title: it.title, image: it.image,
      price: it.price, location: it.location, order, active: true, expiresAt, createdAt: Date.now(), kind,
    }
    rows.unshift(promo); return promo
  })
}

export async function updatePromotion(id: string, patch: Partial<Pick<Promotion, 'order' | 'active' | 'expiresAt'>>): Promise<Promotion | null> {
  return mutate(rows => {
    const p = rows.find(x => x.id === id); if (!p) return null
    if (patch.order !== undefined) p.order = patch.order
    if (patch.active !== undefined) p.active = patch.active
    if (patch.expiresAt !== undefined) p.expiresAt = patch.expiresAt
    return p
  })
}

export async function deletePromotion(id: string): Promise<void> { await mutate(rows => { const i = rows.findIndex(p => p.id === id); if (i >= 0) rows.splice(i, 1) }) }

// ── پروموتِ پروفایل (مشاور/وکیل/… در دایرکتوری) — بدونِ نیاز به آیتمِ اسکرپ ──
const normPhone = (p: string) => String(p || '').replace(/\D/g, '')
export async function addProfilePromotion(slot: string, phone: string, name: string, area?: string, expiresAt?: number, kind?: string): Promise<Promotion | null> {
  const s = slotOf(slot); if (!s || s.target !== 'directory') return null
  return mutate(rows => {
    const promo: Promotion = { id: randomBytes(6).toString('hex'), slot, targetId: phone, title: name || 'متخصص', location: area, order: 0, active: true, expiresAt, createdAt: Date.now(), kind }
    rows.unshift(promo); return promo
  })
}
// مجموعهٔ شماره‌هایِ دارای پروموتِ فعالِ دایرکتوری (برای علامت‌گذاریِ «ویژه» و اولویتِ نمایش).
export async function promotedProfilePhones(): Promise<Set<string>> {
  return new Set((await promotedProfileInfo()).keys())
}
// نگاشتِ شمارهٔ پروفایلِ پروموت‌شده → نوعِ نشان (kind) برای نمایشِ نشانِ درست در دایرکتوری.
export async function promotedProfileInfo(): Promise<Map<string, { kind?: string }>> {
  const now = Date.now()
  const dirSlots = PROMO_SLOTS.filter(s => s.target === 'directory').map(s => s.id)
  const m = new Map<string, { kind?: string }>()
  for (const p of await load()) if (dirSlots.includes(p.slot) && p.active && (!p.expiresAt || p.expiresAt > now)) {
    const key = normPhone(p.targetId)
    if (!m.has(key)) m.set(key, { kind: p.kind })   // اولین (تازه‌ترین) پروموتِ فعال
  }
  return m
}

// ── پروموت‌های فعالِ یک کاربر (برای پنلِ «پروموت‌های من» + گِیتِ خریدِ دوباره) ──
// پروفایل: targetId = شمارهٔ کاربر. آگهی: targetId = شناسهٔ آیتم که مالکش این کاربر است.
export interface MyPromo { id: string; slot: string; slotLabel: string; where: string; kind?: string; title: string; targetId: string; expiresAt?: number; target: 'listing' | 'directory' | 'product' }
export async function myActivePromotions(phone: string): Promise<MyPromo[]> {
  const now = Date.now()
  const ph = normPhone(phone)
  const rows = (await load()).filter(p => p.active && (!p.expiresAt || p.expiresAt > now))
  const out: MyPromo[] = []
  for (const p of rows) {
    const s = slotOf(p.slot); if (!s) continue
    let mine = false
    if (s.target === 'directory') mine = normPhone(p.targetId) === ph
    else { try { const it = await getItemById(p.targetId); mine = String((it as any)?.meta?.__ownerPhone || '') === phone } catch {} }
    if (mine) out.push({ id: p.id, slot: p.slot, slotLabel: s.label, where: s.where, kind: p.kind, title: p.title, targetId: String(p.targetId), expiresAt: p.expiresAt, target: s.target })
  }
  return out
}
// آیا کاربر پروموتِ فعالی در این جایگاه دارد؟ (برای جلوگیری از خریدِ دوباره تا پایان)
export async function hasActivePromoInSlot(phone: string, slot: string): Promise<{ has: boolean; expiresAt?: number }> {
  const mine = await myActivePromotions(phone)
  const m = mine.find(x => x.slot === slot)
  return m ? { has: true, expiresAt: m.expiresAt } : { has: false }
}

// نگاشتِ شناسهٔ آیتمِ آگهیِ پروموت‌شده → {slot, kind} برای نمایشِ نشانِ نوعِ پروموت روی کارتِ آگهی.
export async function promotedListingKinds(): Promise<Map<string, { slot: string; kind?: string }>> {
  const now = Date.now()
  const listSlots = PROMO_SLOTS.filter(s => s.target === 'listing').map(s => s.id)
  const m = new Map<string, { slot: string; kind?: string }>()
  for (const p of await load()) if (listSlots.includes(p.slot) && p.active && (!p.expiresAt || p.expiresAt > now)) {
    if (!m.has(String(p.targetId))) m.set(String(p.targetId), { slot: p.slot, kind: p.kind })
  }
  return m
}
