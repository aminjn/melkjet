import { getProduct, categoryBreadcrumb, relatedProducts } from '@/app/lib/catalog-store'
import { sellersOfCatalog } from '@/app/lib/materials-store'
import { productIdForSlug, slugForProductId, ensureProductSlug } from '@/app/lib/product-slug-store'
import ProductPageView from './ProductPageView'
import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'

export const revalidate = 600
export function generateStaticParams() { return [] }

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
    openGraph: { title: p.name, url: `https://melkjet.com/product/${canonSlug}`, type: 'website', images: p.image ? [p.image] : undefined },
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const id = await resolveId(slug)
  const product = id ? getProduct(id) : null
  if (!product || !product.active) notFound()  // ۴۰۴ِ واقعی به‌جای soft-404 با وضعیتِ ۲۰۰
  // کنونیکال: اگر با idِ خام آمده و slug داریم/می‌سازیم، به /product/{slug} ریدایرکت کن.
  const canonSlug = (await slugForProductId(id!)) || (await ensureProductSlug(id!, product.name))
  if (canonSlug && slug !== canonSlug) redirect(`/product/${canonSlug}`)

  const breadcrumb = categoryBreadcrumb(product.categoryId)
  const sellers = await sellersOfCatalog(id!)
  const related = relatedProducts(product.categoryId, id!, 8).map(p => ({ id: p.id, name: p.name, image: p.image || '', brand: p.brand || '' }))

  // فاز ۲۵۴ (سئو): Product JSON-LD — نتایجِ ریچِ گوگل (قیمت/برند/دسته). قیمت از آخرین نقطهٔ تاریخچه
  // (تومان → ریال ×۱۰ برای priceCurrency=IRR، هم‌روشِ صفحهٔ آگهی). فیلدهای خالی حذف می‌شوند.
  const ph = product.priceHistory || []
  const priceToman = ph.length ? Number(ph[ph.length - 1].price) : 0
  const url = `https://melkjet.com/product/${canonSlug}`
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org', '@type': 'Product', name: product.name, url,
    image: product.image || undefined,
    description: (product.description || product.name).slice(0, 300) || undefined,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    category: breadcrumb.map(b => b.name).filter(Boolean).join(' › ') || undefined,
    offers: priceToman > 0 ? { '@type': 'Offer', price: Math.round(priceToman * 10), priceCurrency: 'IRR', availability: 'https://schema.org/InStock', url } : undefined,
  }
  Object.keys(ld).forEach(k => ld[k] === undefined && delete ld[k])
  const crumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'خانه', item: 'https://melkjet.com/' },
      { '@type': 'ListItem', position: 2, name: 'فروشگاه مصالح', item: 'https://melkjet.com/store' },
      ...breadcrumb.filter(b => b.name).map((b, i) => ({ '@type': 'ListItem', position: 3 + i, name: b.name })),
      { '@type': 'ListItem', position: 3 + breadcrumb.length, name: product.name, item: url },
    ],
  }
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbLd) }} />
    <ProductPageView product={product as any} breadcrumb={breadcrumb} sellers={sellers} related={related} />
  </>
}
