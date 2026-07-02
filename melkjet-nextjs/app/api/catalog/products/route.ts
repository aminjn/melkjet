import { NextRequest, NextResponse } from 'next/server'
import { publicCatalogQuery, publicCatalogFacets } from '@/app/lib/catalog-store'
import { sellerCountsByCatalog } from '@/app/lib/materials-store'

export const dynamic = 'force-dynamic'

const SOURCE_LABEL: Record<string, string> = { hypersaz: 'هایپرساز', ahanonline: 'آهن‌آنلاین', manual: 'دستی' }

// بازارِ مصالح — همهٔ محصولاتِ کاتالوگ (اسکرپ‌شده + دستی) با فیلتر/جستجو + تعدادِ فروشنده.
export async function GET(req: NextRequest) {
  const u = new URL(req.url).searchParams
  const num = (k: string) => { const v = Number(u.get(k)); return Number.isFinite(v) && v > 0 ? v : undefined }
  const counts = sellerCountsByCatalog()
  const withSeller = u.get('withSeller') === '1'
  const sellerIds = new Set(Object.keys(counts).filter(id => counts[id] > 0))
  const res = publicCatalogQuery({
    search: u.get('search') || undefined, category: u.get('category') || undefined,
    source: u.get('source') || undefined, brand: u.get('brand') || undefined,
    unit: u.get('unit') || undefined, sort: u.get('sort') || undefined,
    minPrice: num('minPrice'), maxPrice: num('maxPrice'),
    withSeller, sellerIds, page: num('page'), pageSize: num('pageSize'),
  })
  const items = res.items.map(p => ({ ...p, sellerCount: counts[p.id] || 0, sourceLabel: SOURCE_LABEL[p.source] || p.source }))
  const body: any = { ok: true, items, total: res.total, page: res.page, pageSize: res.pageSize }
  if (u.get('facets') === '1') body.facets = publicCatalogFacets()
  return NextResponse.json(body)
}
