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
async function publicList(type: 'listing' | 'directory', limit: number): Promise<ContentItem[]> {
  let items: any[] = await listItems(type, { publicOnly: true })
  items = items.filter(i => !(i.type === 'article' && i.meta?.cmsStatus === 'draft'))
  items.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.scrapedAt - a.scrapedAt)
  return items.slice(0, limit).map(toContent)
}

async function promoItems(slot: string): Promise<ContentItem[]> {
  const arr = await Promise.all(listActive(slot).map(async p => {
    const it = await getItemById(p.targetId)
    if (!it || it.status === 'rejected') return null
    return toContent(it)
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

export async function getHomeData(): Promise<HomeData> {
  const [listings, advisorItems, promoFeatured, promoInvest, promoAdvisors] = await Promise.all([
    safe(publicList('listing', 12)),
    safe(publicList('directory', 6)),
    safe(promoItems('home_featured')),
    safe(promoItems('home_invest')),
    safe(promoItems('home_advisors')),
  ])
  const sysStats = { listings: 0, advisors: 0, products: 0, shops: 0, builders: 0 }
  try { sysStats.listings = (await listItems('listing', { publicOnly: true })).length } catch {}
  try { sysStats.advisors = (await listItems('directory', { publicOnly: true })).length } catch {}
  try { sysStats.products = catalogStats().products } catch {}
  try { sysStats.shops = (await listPublicShops()).length } catch {}
  try { sysStats.builders = getMeta().totalBuilders || 0 } catch {}
  return { listings, advisorItems, promoFeatured, promoInvest, promoAdvisors, sysStats }
}
