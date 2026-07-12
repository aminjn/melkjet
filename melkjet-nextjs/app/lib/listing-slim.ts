import type { Item } from './scraper-store'

// فاز ۹۹ — شکلِ سبکِ آگهی برای فهرست‌های عمومی. تکِ منبع بینِ /api/content?slim=1
// و SSRِ صفحهٔ جستجو، تا هر دو دقیقاً یک خروجی بدهند (شماره هرگز بیرون نمی‌رود).
export const SLIM_META = ['متراژ', 'طبقه', 'سال ساخت', 'ساخت', 'نوع معامله', 'نوع ملک', 'اتاق خواب', '__lat', '__lng', '__dealStatus']

export function slimListing(it: Item) {
  const { phone, ...rest } = it as any
  void rest
  const meta: Record<string, string> = {}
  for (const k of SLIM_META) { const v = it.meta?.[k]; if (v) meta[k] = v }
  return {
    id: it.id, type: it.type, sourceName: it.sourceName, category: it.category, tags: it.tags,
    title: it.title, price: it.price, location: it.location, image: it.image, url: it.url,
    excerpt: (it.excerpt || '').slice(0, 200), scrapedAt: it.scrapedAt, featured: it.featured, meta,
    hasPhone: !!(phone || (it as any).meta?.__ownerPhone),
  }
}
