import { NextRequest, NextResponse } from 'next/server'
import { getProduct, categoryBreadcrumb, relatedProducts } from '@/app/lib/catalog-store'
import { sellersOfCatalog } from '@/app/lib/materials-store'

export const dynamic = 'force-dynamic'

// صفحهٔ عمومیِ کالای مرجع: محصول + مسیرِ دسته + فروشندگان + مشابه‌ها.
export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id') || ''
  const product = getProduct(id)
  if (!product || !product.active) return NextResponse.json({ error: 'کالا یافت نشد' }, { status: 404 })
  return NextResponse.json({
    ok: true,
    product,
    breadcrumb: categoryBreadcrumb(product.categoryId),
    sellers: sellersOfCatalog(id),
    related: relatedProducts(product.categoryId, id, 8).map(p => ({ id: p.id, name: p.name, image: p.image, brand: p.brand })),
  })
}
