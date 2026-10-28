import { Suspense } from 'react'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { listItems } from '@/app/lib/scraper-store'
import { slimListing } from '@/app/lib/listing-slim'
import { swrValue } from '@/app/lib/swr-cache'
import type { ContentItem } from '@/app/lib/content-display'
import SearchClient from './SearchClient'
import { canonCity } from '@/app/lib/city-name'

// فاز ۹۹ — SSR جستجو: ریشهٔ سه ایرادِ قرمزِ Lighthouse (LCP بالا، «LCP request
// discovery»، main-thread) این بود که صفحه کاملاً کلاینتی بود: HTML خالی → JS →
// JSON → تازه تصویر. حالا ۶۰ آگهیِ اول (همان خروجیِ slim کهِ API می‌داد) روی
// سرور خوانده و کارت‌ها در HTML اولیه رندر می‌شوند — تصویرِ LCP از همان بایتِ
// اولِ HTML قابلِ‌کشف است. فیلترها/نقشه/واکشیِ کاملِ ۱۰۰۰تایی عیناً مثلِ قبل
// در کلاینت می‌مانند.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'جستجوی هوشمند ملک | ملک‌جت',
  description: 'جستجوی خرید، رهن و اجارهٔ ملک با فیلترهای هوشمند، نقشه و تحلیل قیمت واقعی بازار.',
  alternates: { canonical: 'https://melkjet.com/search' },
}

// فاز ۱۵۲ (سنجشِ prod: TTFB جستجو ۲.۰۶ث): ۶۰ کارتِ اول برای همه یکسان است، ولی هر درخواست
// کلِ آگهی‌ها را از PG می‌خواند و slim می‌کرد. حالا stale-while-revalidate: پاسخ همیشه فوری،
// تازه‌سازی در پس‌زمینه (همان الگوی home-data که TTFB صفحهٔ اصلی را حل کرد).
const ssrPool = swrValue<ContentItem[]>(async () => {
  const items = await listItems('listing', { publicOnly: true })
  // همان ترتیبِ /api/content: ویژه‌ها اول، بعد تازه‌ترین‌ها
  items.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.scrapedAt - a.scrapedAt)
  return items.slice(0, 60).map(slimListing) as unknown as ContentItem[]
}, { ttlMs: 30_000, maxStaleMs: 300_000 })

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  let initial: ContentItem[] = []
  try {
    initial = await ssrPool.get()
  } catch { /* دیتابیس لحظه‌ای در دسترس نبود → کلاینت خودش واکشی می‌کند (فالبکِ SearchClient) */ }

  // شهرِ انتخابیِ کاربر از کوکی — تا SSR همان چیزی را نشان دهد که بعد از هیدریت می‌ماند
  let initialCity = ''
  try {
    const jar = await cookies()
    const c = jar.get('mj_city')?.value
    if (c) initialCity = canonCity(decodeURIComponent(c))
    if (!initialCity) {
      const loc = jar.get('mj_loc')?.value
      if (loc) initialCity = canonCity(JSON.parse(decodeURIComponent(loc))?.city as string)
    }
  } catch { /* کوکیِ خراب → بدونِ فیلترِ شهر */ }

  // فاز د — لینکِ «جستجوی ذخیره‌شده» شهرش را در URL دارد؛ بر کوکی مقدم است (کلاینت کوکی را هم هم‌سو می‌کند).
  try { const u = (await searchParams).city; const uc = canonCity(Array.isArray(u) ? u[0] : u); if (uc) initialCity = uc } catch {}
  return <Suspense fallback={null}><SearchClient initial={initial} initialCity={initialCity} /></Suspense>
}
