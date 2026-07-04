import HomeClient from './HomeClient'
import { getHomeData } from './lib/home-data'

// صفحهٔ اصلی سمتِ سرور رندر می‌شود: داده همین‌جا (سرور) جمع و به کلاینت پاس داده می‌شود،
// پس HTML اولیه «با محتوا» می‌رسد (LCP و TBT به‌شدت بهتر) و واکشیِ کلاینتیِ بعد از لود حذف شد.
export const dynamic = 'force-dynamic'

export default async function Home() {
  const initial = await getHomeData()
  return <HomeClient initial={initial} />
}
