import { getProduct, categoryBreadcrumb, relatedProducts } from '@/app/lib/catalog-store'
import { sellersOfCatalog } from '@/app/lib/materials-store'
import { productIdForSlug, slugForProductId, ensureProductSlug } from '@/app/lib/product-slug-store'
import ProductPageView from './ProductPageView'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// slug → id (یا خودِ id برای سازگاریِ عقب‌رو)
async function resolveId(slug: string): Promise<string | null> {
  const byId = await productIdForSlug(slug)
  if (byId) return byId
  return getProduct(slug) ? slug : null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const id = await resolveId(slug)
  const p = id ? getProduct(id) : null
  if (!p) return { title: 'کالا یافت نشد | ملک‌جت' }
  const canonSlug = (await slugForProductId(id!)) || slug
  return {
    title: `${p.name}${p.brand ? ' · ' + p.brand : ''} | مصالح ملک‌جت`,
    description: (p.description || p.name).slice(0, 150),
    alternates: { canonical: `https://melkjet.com/product/${canonSlug}` },
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const id = await resolveId(slug)
  const product = id ? getProduct(id) : null
  if (!product || !product.active) {
    return <div dir="rtl" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontFamily: 'Vazirmatn, system-ui, sans-serif' }}>کالا یافت نشد.</div>
  }
  // کنونیکال: اگر با idِ خام آمده و slug داریم/می‌سازیم، به /product/{slug} ریدایرکت کن.
  const canonSlug = (await slugForProductId(id!)) || (await ensureProductSlug(id!, product.name))
  if (canonSlug && slug !== canonSlug) redirect(`/product/${canonSlug}`)

  const breadcrumb = categoryBreadcrumb(product.categoryId)
  const sellers = await sellersOfCatalog(id!)
  const related = relatedProducts(product.categoryId, id!, 8).map(p => ({ id: p.id, name: p.name, image: p.image || '', brand: p.brand || '' }))
  return <ProductPageView product={product as any} breadcrumb={breadcrumb} sellers={sellers} related={related} />
}
