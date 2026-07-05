// دادهٔ صفحهٔ اصلی — سمتِ سرور جمع می‌شود تا HTML اولیه «با محتوا» ارسال شود
// (به‌جای واکشیِ کلاینتی بعد از لود که LCP/TBT را خراب می‌کرد). همان منطقِ
// /api/content + /api/promotions + /api/stats، ولی مستقیم روی استورها (بدونِ رفت‌وبرگشتِ HTTP).

import { listItems, getItemById } from './scraper-store'
import { listActive, listAllActive, slotOf } from './promotion-store'
import { catalogStats } from './catalog-store'
import { listPublicShops } from './materials-store'
import { getMeta } from './persiansaze-store'
import { getProfile } from './profile-store'
import { getAccount } from './account-store'
import type { ContentItem } from './content-display'

function toContent(it: any): ContentItem {
  const { phone, ...rest } = it
  return { ...rest, hasPhone: !!(phone || it.meta?.__ownerPhone) }
}

// ContentItem از یک پروموتِ پروفایل (targetId = شماره) — بدونِ نیاز به آیتمِ اسکرپر.
function profilePromoToContent(p: any): ContentItem {
  let photo = ''; let category = 'متخصص'; let name = String(p.title || '').trim(); let loc = String(p.location || '').trim()
  try {
    const gp = getProfile(p.targetId)
    photo = gp.logo || ''
    category = (gp.businessType || '').trim() || 'متخصص'
    if (!name || name === 'متخصص') name = (gp.businessName || gp.displayName || '').trim()
    if (!loc) loc = (gp.city || '').trim()
  } catch {}
  if (!name || name === 'متخصص') { try { name = (getAccount(p.targetId)?.name || '').trim() } catch {} }
  return { id: p.targetId, sourceName: 'ملک‌جت', type: 'directory', category, title: name || 'متخصصِ ملک‌جت', location: loc, image: photo, url: `/profile/${encodeURIComponent(p.targetId)}`, hasPhone: true, promoted: true, promoKind: p.kind || 'ویژه', scrapedAt: p.createdAt || 0, status: 'approved' }
}

// همان انتخابِ عمومیِ /api/content (منتشر، غیرِ پیش‌نویس، ویژه‌ها اول، تازه‌ترها بعد).
// کلِ لیستِ مرتب‌شده را برمی‌گرداند تا هم top-N و هم «تعدادِ کل» از یک خواندن درآید
// (به‌جای دو بار صداکردنِ listItems که TTFB را بالا می‌برد).
async function publicListFull(type: 'listing' | 'directory'): Promise<ContentItem[]> {
  let items: any[] = await listItems(type, { publicOnly: true })
  items = items.filter(i => !(i.type === 'article' && i.meta?.cmsStatus === 'draft'))
  items.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.scrapedAt - a.scrapedAt)
  return items.map(toContent)
}

async function promoItems(slot: string): Promise<ContentItem[]> {
  const s = slotOf(slot)
  const active = await listActive(slot)
  // پروموتِ پروفایل (directory): مستقیم از ردیفِ پروموت + پروفایل ساخته می‌شود.
  if (s?.target === 'directory') return active.map(profilePromoToContent)
  // پروموتِ آگهی/محصول (listing/product): از آیتمِ اسکرپر.
  const arr = await Promise.all(active.map(async p => {
    const it = await getItemById(p.targetId)
    if (!it || it.status === 'rejected') return null
    return { ...toContent(it), promoted: true, promoKind: p.kind || 'ویژه' } as ContentItem
  }))
  return arr.filter(Boolean) as ContentItem[]
}

// ── بنرِ خودکارِ پروموت (Spotlight) — از همهٔ پروموت‌های فعال ساخته می‌شود ──
// هر پروموتِ فعالی (پروفایل یا آگهی، هر جایگاهی) این‌جا به بنرِ صدرِ صفحهٔ اصلی می‌آید.
// اولویت با نشان‌های گران‌تر (VIP/صفحه اول/Hero) است.
export interface SpotlightItem { id: string; kind: string; title: string; subtitle: string; image: string; url: string; isProfile: boolean }
const KIND_RANK: Record<string, number> = { 'VIP': 100, 'صفحه اول': 90, 'Hero': 90, 'برتر': 70, 'منتخب': 60, 'ترند': 55, 'ویژه': 40, 'تأییدشده': 30, 'نردبان': 20 }
async function buildSpotlight(): Promise<SpotlightItem[]> {
  const active = await listAllActive()
  const out: SpotlightItem[] = []
  for (const p of active) {
    const s = slotOf(p.slot)
    if (s?.target === 'directory') {
      const c = profilePromoToContent(p)
      out.push({ id: c.id, kind: p.kind || 'ویژه', title: c.title, subtitle: [c.category, c.location].filter(Boolean).join(' · ') || 'متخصصِ ویژه', image: c.image || '', url: c.url || `/profile/${encodeURIComponent(p.targetId)}`, isProfile: true })
    } else {
      const it = await getItemById(p.targetId)
      if (!it || it.status === 'rejected') continue
      out.push({ id: it.id, kind: p.kind || 'ویژه', title: it.title, subtitle: [it.location, it.price].filter(Boolean).join(' · '), image: it.image || '', url: it.url || `/property/${encodeURIComponent(it.id)}`, isProfile: false })
    }
  }
  out.sort((a, b) => (KIND_RANK[b.kind] || 0) - (KIND_RANK[a.kind] || 0))
  return out.slice(0, 8)
}

export interface HomeData {
  listings: ContentItem[]; advisorItems: ContentItem[]
  promoFeatured: ContentItem[]; promoInvest: ContentItem[]; promoAdvisors: ContentItem[]; promoTrending: ContentItem[]
  spotlight: SpotlightItem[]
  sysStats: { listings: number; advisors: number; products: number; shops: number; builders: number }
}

// هر منبع مستقل و امن: خطای یکی نباید کلِ صفحه را ۵۰۰ کند (fallback = آرایهٔ خالی).
const safe = <T>(p: Promise<T[]>): Promise<T[]> => p.catch(() => [] as T[])

async function compute(): Promise<HomeData> {
  // تسویهٔ تنبلِ مزایده‌ها — صفحهٔ اصلی پربازدید است، پس مزایده بدونِ کرون خودش بسته می‌شود.
  try { const { ensurePromoPricing } = await import('./promo-pricing-store'); await ensurePromoPricing(); const { resolveDue } = await import('./auction-store'); await resolveDue() } catch {}
  const [listingsAll, advisorsAll, promoFeatured, promoInvest, promoAdvisors, promoTrending, spotlight] = await Promise.all([
    safe(publicListFull('listing')),
    safe(publicListFull('directory')),
    safe(promoItems('home_featured')),
    safe(promoItems('home_invest')),
    safe(promoItems('home_advisors')),
    safe(promoItems('home_trending')),
    buildSpotlight().catch(() => [] as SpotlightItem[]),
  ])
  // آمار از همان لیست‌های خوانده‌شده (بدونِ خواندنِ دوباره).
  const sysStats = { listings: listingsAll.length, advisors: advisorsAll.length, products: 0, shops: 0, builders: 0 }
  try { sysStats.products = catalogStats().products } catch {}
  try { sysStats.shops = (await listPublicShops()).length } catch {}
  try { sysStats.builders = getMeta().totalBuilders || 0 } catch {}
  return {
    listings: listingsAll.slice(0, 12),
    advisorItems: advisorsAll.slice(0, 6),
    promoFeatured, promoInvest, promoAdvisors, promoTrending, spotlight, sysStats,
  }
}

// کش با «stale-while-revalidate»: صفحهٔ اصلی برای همهٔ کاربران یکسان است. بدونِ این، هر
// درخواست کلِ دادهٔ صفحه (لیست‌ها + آمار + getMetaِ ۶مگی) را دوباره می‌خواند و TTFB را
// چند ثانیه می‌کرد (همان «Document request latency»). حالا:
//   • اولین درخواست (که warmUpِ بوت جذبش می‌کند) یک‌بار داده را می‌سازد.
//   • بعد از آن هر درخواست فوری دادهٔ کش‌شده را می‌گیرد؛ اگر کهنه شد، در پس‌زمینه تازه
//     می‌شود و درخواست منتظر نمی‌ماند → TTFB همیشه سریع.
let cache: { at: number; data: HomeData } | null = null
let refreshing = false
const TTL = 60_000

function refreshBg() {
  if (refreshing) return
  refreshing = true
  compute().then(d => { cache = { at: Date.now(), data: d } }).catch(() => {}).finally(() => { refreshing = false })
}

export async function getHomeData(): Promise<HomeData> {
  if (!cache) { const data = await compute(); cache = { at: Date.now(), data }; return data }
  if (Date.now() - cache.at >= TTL) refreshBg()   // کهنه → در پس‌زمینه تازه کن، ولی الان همین را بده
  return cache.data
}

// باطل‌کردنِ کش — پس از فعال‌شدنِ پروموت صدا زده می‌شود تا بنر فوری روی صفحهٔ اصلی بیاید
// (به‌جای انتظارِ تا ۶۰ ثانیه). درخواستِ بعدیِ صفحهٔ اصلی داده را از نو می‌سازد.
export function invalidateHomeCache() { cache = null }
