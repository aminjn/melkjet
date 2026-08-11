import { publicShop } from '@/app/lib/materials-store'
import StorefrontView from './StorefrontView'
import type { Metadata } from 'next'

export const revalidate = 600
export function generateStaticParams() { return [] }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const shop = await publicShop(slug)
  if (!shop) return { title: 'فروشگاه یافت نشد | ملک‌جت' }
  // فاز ۲۲۱ (خروجیِ seo-verify روی prod: تنها ✗ — «/store/… بدونِ canonical»)
  const img = shop.cover || shop.logo || ''
  return {
    title: `${shop.name} | فروشگاه مصالح ملک‌جت`,
    description: shop.tagline || shop.about?.slice(0, 150) || `فروشگاه مصالح ساختمانی ${shop.name}`,
    alternates: { canonical: `https://melkjet.com/store/${slug}` },
    openGraph: { title: shop.name, url: `https://melkjet.com/store/${slug}`, type: 'website', images: img ? [img] : undefined },
  }
}

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const shop = await publicShop(slug)
  if (!shop) {
    return (
      <div dir="rtl" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontFamily: 'Vazirmatn, system-ui, sans-serif' }}>
        فروشگاه یافت نشد.
      </div>
    )
  }
  // فاز ۲۵۴ (سئو): Store/LocalBusiness JSON-LD — نام/تصویر/آدرس/امتیاز؛ فیلدهای خالی حذف می‌شوند.
  const url = `https://melkjet.com/store/${slug}`
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org', '@type': 'Store', name: shop.name, url,
    image: shop.cover || shop.logo || undefined,
    description: (shop.tagline || shop.about || '').slice(0, 300) || undefined,
    address: (shop.city || shop.address) ? { '@type': 'PostalAddress', addressLocality: shop.city || undefined, streetAddress: shop.address || undefined, addressCountry: 'IR' } : undefined,
    aggregateRating: shop.rating > 0 ? { '@type': 'AggregateRating', ratingValue: shop.rating, bestRating: 5, ratingCount: 1 } : undefined,
  }
  Object.keys(ld).forEach(k => ld[k] === undefined && delete ld[k])
  if (ld.address) { const a = ld.address as Record<string, unknown>; Object.keys(a).forEach(k => a[k] === undefined && delete a[k]) }
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    <StorefrontView shop={shop} />
  </>
}
