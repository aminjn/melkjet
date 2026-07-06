import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSite } from '@/app/lib/sites-store'
import { getItemById, type Item } from '@/app/lib/scraper-store'
import { idFromListingSlug, listingHref } from '@/app/lib/listing-url'
import { SiteChrome } from '../../page'
import ListingDetail, { type DetailItem } from '../../ListingDetail'

export const dynamic = 'force-dynamic'
const MAIN = 'https://melkjet.com'

async function load(siteSlug: string, slug: string) {
  const site = await getSite(siteSlug); if (!site) return null
  const it = await getItemById(idFromListingSlug(slug))
  if (!it || it.type !== 'listing' || it.status === 'rejected' || it.status === 'duplicate') return null
  return { site, it }
}

// نگاشتِ آیتم به دادهٔ نمایش (عکس‌ها + مشخصات) — کلیدهای داخلی (__) و شهر/محلهٔ تکراری حذف می‌شوند.
function toDetail(it: Item): DetailItem {
  const gallery = (it.meta?.['__gallery'] || '').split('\n').map(s => s.trim()).filter(Boolean)
  const images = (gallery.length ? gallery : (it.image ? [it.image] : [])).slice(0, 12)
  const specs: { k: string; v: string }[] = []
  for (const [k, v] of Object.entries(it.meta || {})) { if (!v || k.startsWith('__') || ['شهر', 'محله', 'استان', 'منطقه'].includes(k)) continue; specs.push({ k, v: String(v) }) }
  return { id: it.id, title: it.title, price: it.price, location: it.location, images, description: it.excerpt, specs: specs.slice(0, 10) }
}

export async function generateMetadata({ params }: { params: Promise<{ site: string; slug: string }> }): Promise<Metadata> {
  const { site: siteSlug, slug } = await params
  const r = await load(siteSlug, slug)
  if (!r) return { title: 'آگهی یافت نشد' }
  const canonical = `${MAIN}${listingHref(r.it.id, r.it.title, r.it.location)}`   // مرجع = صفحهٔ اصلی → گوگل تکراری نمی‌بیند
  return {
    title: `${r.it.title} | ${r.site.seo?.title || r.site.title}`,
    description: (r.it.excerpt || r.it.title).slice(0, 160),
    alternates: { canonical },
    openGraph: { title: r.it.title, images: r.it.image ? [r.it.image] : undefined },
  }
}

export default async function InSiteListing({ params }: { params: Promise<{ site: string; slug: string }> }) {
  const { site: siteSlug, slug } = await params
  const r = await load(siteSlug, slug)
  if (!r) notFound()
  return (
    <SiteChrome site={r.site} appendFooter>
      <ListingDetail item={toDetail(r.it)} siteSlug={r.site.slug} backLabel={`بازگشت به ${r.site.title}`} />
    </SiteChrome>
  )
}
