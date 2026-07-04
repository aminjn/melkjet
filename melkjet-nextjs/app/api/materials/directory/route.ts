import { NextRequest, NextResponse } from 'next/server'
import { listPublicShops, publicShopFacets } from '@/app/lib/materials-store'

export const dynamic = 'force-dynamic'

// دایرکتوریِ عمومیِ فروشگاه‌های مصالح + فاستِ فیلترها.
export async function GET(req: NextRequest) {
  const u = new URL(req.url).searchParams
  const shops = await listPublicShops({ city: u.get('city') || undefined, category: u.get('category') || undefined, search: u.get('search') || undefined })
  const body: any = { ok: true, shops }
  if (u.get('facets') === '1') body.facets = await publicShopFacets()
  return NextResponse.json(body)
}
