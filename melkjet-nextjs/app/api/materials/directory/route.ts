import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listPublicShops, publicShopFacets } from '@/app/lib/materials-store'

export const dynamic = 'force-dynamic'

// دایرکتوریِ عمومیِ فروشگاه‌های مصالح + فاستِ فیلترها.
// شمارهٔ تماس فقط برای کاربرِ واردشده برمی‌گردد (قانونِ «شماره فقط برای واردشده‌ها»).
export async function GET(req: NextRequest) {
  const u = new URL(req.url).searchParams
  const s = await getSession().catch(() => null)
  const shops = await listPublicShops({
    city: u.get('city') || undefined,
    category: u.get('category') || undefined,
    search: u.get('search') || undefined,
    withPhone: !!s,
  })
  const body: { ok: boolean; shops: unknown[]; facets?: unknown } = { ok: true, shops }
  if (u.get('facets') === '1') body.facets = await publicShopFacets()
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
