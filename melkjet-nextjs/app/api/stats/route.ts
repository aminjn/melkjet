import { NextResponse } from 'next/server'
import { listItems } from '@/app/lib/scraper-store'
import { catalogStats } from '@/app/lib/catalog-store'
import { listPublicShops } from '@/app/lib/materials-store'
import { getMeta } from '@/app/lib/persiansaze-store'

export const dynamic = 'force-dynamic'

// آمارِ واقعیِ سیستم برای صفحهٔ خانه (سبک، با کشِ کوتاه).
export async function GET() {
  let listings = 0, advisors = 0, products = 0, shops = 0, builders = 0
  try { listings = listItems('listing', { publicOnly: true }).length } catch {}
  try { advisors = listItems('directory', { publicOnly: true }).length } catch {}
  try { products = catalogStats().products } catch {}
  try { shops = (await listPublicShops()).length } catch {}
  try { builders = getMeta().totalBuilders || 0 } catch {}
  return NextResponse.json({ listings, advisors, products, shops, builders }, { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=600' } })
}
