import { getProduct, categoryBreadcrumb, relatedProducts } from '@/app/lib/catalog-store'
import { sellersOfCatalog } from '@/app/lib/materials-store'
import ProductPageView from './ProductPageView'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const p = getProduct(id)
  if (!p) return { title: 'کالا یافت نشد | ملک‌جت' }
  return { title: `${p.name}${p.brand ? ' · ' + p.brand : ''} | مصالح ملک‌جت`, description: (p.description || p.name).slice(0, 150) }
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = getProduct(id)
  if (!product || !product.active) {
    return <div dir="rtl" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontFamily: 'Vazirmatn, system-ui, sans-serif' }}>کالا یافت نشد.</div>
  }
  const breadcrumb = categoryBreadcrumb(product.categoryId)
  const sellers = sellersOfCatalog(id)
  const related = relatedProducts(product.categoryId, id, 8).map(p => ({ id: p.id, name: p.name, image: p.image || '', brand: p.brand || '' }))
  return <ProductPageView product={product as any} breadcrumb={breadcrumb} sellers={sellers} related={related} />
}
