import type { Metadata } from 'next'
import HomeClient from './HomeClient'
import { getHomeData } from './lib/home-data'
import { siteConfig } from './lib/site-store'

// فاز ۲۲۰ (ممیزیِ سئو): canonicalِ صریحِ صفحهٔ اصلی
export const metadata: Metadata = { alternates: { canonical: 'https://melkjet.com/' } }

// صفحهٔ اصلی سمتِ سرور رندر می‌شود: داده همین‌جا (سرور) جمع و به کلاینت پاس داده می‌شود،
// پس HTML اولیه «با محتوا» می‌رسد (LCP و TBT به‌شدت بهتر) و واکشیِ کلاینتیِ بعد از لود حذف شد.
export const revalidate = 300

export default async function Home() {
  const initial = await getHomeData()
  const heroImage = siteConfig().brand?.heroImage || ''       // هیروی شب (تمِ تیره)
  const heroImageDay = siteConfig().brand?.heroImageDay || ''  // هیروی روز (تمِ روشن)
  return <HomeClient initial={initial} heroImage={heroImage} heroImageDay={heroImageDay} />
}
