// دادهٔ صفحهٔ اصلی — سمتِ سرور جمع می‌شود تا HTML اولیه «با محتوا» ارسال شود
// (به‌جای واکشیِ کلاینتی بعد از لود که LCP/TBT را خراب می‌کرد). همان منطقِ
// /api/content + /api/promotions + /api/stats، ولی مستقیم روی استورها (بدونِ رفت‌وبرگشتِ HTTP).

import { listItems, getItemById } from './scraper-store'
import { listActive } from './promotion-store'
import { catalogStats } from './catalog-store'
import { listPublicShops } from './materials-store'
import { getMeta } from './persiansaze-store'
import type { ContentItem } from './content-display'

function toContent(it: any): ContentItem {
  const { phone, ...rest } = it
  return { ...rest, hasPhone: !!(phone || it.meta?.__ownerPhone) }
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
  const arr = await Promise.all((await listActive(slot)).map(async p => {
    const it = await getItemById(p.targetId)
    if (!it || it.status === 'rejected') return null
    return { ...toContent(it), promoKind: p.kind || 'ویژه' } as ContentItem
  }))
  return arr.filter(Boolean) as ContentItem[]
}

export interface HomeData {
  listings: ContentItem[]; advisorItems: ContentItem[]
  promoFeatured: ContentItem[]; promoInvest: ContentItem[]; promoAdvisors: ContentItem[]
  sysStats: { listings: number; advisors: number; products: number; shops: number; builders: number }
}

// هر منبع مستقل و امن: خطای یکی نباید کلِ صفحه را ۵۰۰ کند (fallback = آرایهٔ خالی).
const safe = <T>(p: Promise<T[]>): Promise<T[]> => p.catch(() => [] as T[])

async function compute(): Promise<HomeData> {
  // تسویهٔ تنبلِ مزایده‌ها — صفحهٔ اصلی پربازدید است، پس مزایده بدونِ کرون خودش بسته می‌شود.
  try { const { ensurePromoPricing } = await import('./promo-pricing-store'); await ensurePromoPricing(); const { resolveDue } = await import('./auction-store'); await resolveDue() } catch {}
  const [listingsAll, advisorsAll, promoFeatured, promoInvest, promoAdvisors] = await Promise.all([
    safe(publicListFull('listing')),
    safe(publicListFull('directory')),
    safe(promoItems('home_featured')),
    safe(promoItems('home_invest')),
    safe(promoItems('home_advisors')),
  ])
  // آمار از همان لیست‌های خوانده‌شده (بدونِ خواندنِ دوباره).
  const sysStats = { listings: listingsAll.length, advisors: advisorsAll.length, products: 0, shops: 0, builders: 0 }
  try { sysStats.products = catalogStats().products } catch {}
  try { sysStats.shops = (await listPublicShops()).length } catch {}
  try { sysStats.builders = getMeta().totalBuilders || 0 } catch {}
  return {
    listings: listingsAll.slice(0, 12),
    advisorItems: advisorsAll.slice(0, 6),
    promoFeatured, promoInvest, promoAdvisors, sysStats,
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
