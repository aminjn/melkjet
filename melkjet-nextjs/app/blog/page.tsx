import type { Metadata } from 'next'
import { listItems, type Item } from '@/app/lib/scraper-store'
import { swrValue } from '@/app/lib/swr-cache'
import BlogClient, { type BlogIndexData, type BlogIndexArticle } from './BlogClient'

// فاز ۱۵۴ — ایندکسِ بلاگ سرور-ساید شد (شکایتِ کاربر: «مقالات خیلی طول می‌کشه لود بشه»).
// قبلاً صفحه کاملاً کلاینتی بود: HTML خالی → هیدریت → واکشیِ ۱۰۰ مقالهٔ «کامل» (با بدنه) →
// تازه رندر. حالا همان الگویِ SSR جستجو (فاز ۹۹/۱۵۲): فهرست روی سرور از استخرِ کش‌شدهٔ
// stale-while-revalidate خوانده و «لاغر» می‌شود (بدونِ بدنهٔ مقاله) و کارت‌ها در HTML اولیه‌اند.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'مجلهٔ ملک‌جت | مقالات و راهنمای املاک',
  description: 'راهنمای خرید و اجارهٔ ملک، تحلیل بازار مسکن، سرمایه‌گذاری، وام و نکات حقوقی — مقالات کارشناسی مجلهٔ ملک‌جت.',
  alternates: { canonical: 'https://melkjet.com/blog' },
}

// فقط فیلدهایی که کارتِ ایندکس لازم دارد — نه بدنهٔ مقاله، نه متاهای داخلیِ __ (حجمِ HTML پایین می‌ماند).
function slimArticle(a: Item): BlogIndexArticle {
  const m = a.meta || {}
  const raw = m.metaDescription || m.summary || a.excerpt || ''
  const excerpt = raw.replace(/<[^>]+>/g, ' ').replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 180)
  const meta: Record<string, string> = {}
  if (m.slug) meta.slug = m.slug
  if (m.author) meta.author = m.author
  return { id: a.id, title: a.title, excerpt, image: a.image, category: a.category, scrapedAt: a.scrapedAt, url: a.url, meta }
}

const indexPool = swrValue<BlogIndexData>(async () => {
  // همان مسیرِ /api/content که fetchContent قبلی می‌خواند: publicOnly + حذفِ پیش‌نویس‌های CMS
  let items = await listItems('article', { publicOnly: true })
  items = items.filter(i => i.meta?.cmsStatus !== 'draft')
  // همان ترتیبِ /api/content: ویژه‌ها اول، بعد تازه‌ترین‌ها
  items.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.scrapedAt - a.scrapedAt)
  const counts = new Map<string, number>()
  for (const i of items) { const c = (i.category || '').trim(); if (c) counts.set(c, (counts.get(c) || 0) + 1) }
  const cats = [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  return { articles: items.slice(0, 100).map(slimArticle), cats }
}, { ttlMs: 60_000, maxStaleMs: 300_000 })

export default async function BlogPage() {
  let initial: BlogIndexData = { articles: [], cats: [] }
  try {
    initial = await indexPool.get()
  } catch { /* دیتابیس لحظه‌ای در دسترس نبود → کلاینت خودش واکشی می‌کند (فالبکِ BlogClient) */ }
  return <BlogClient initial={initial} />
}
