import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { getItemById } from '@/app/lib/scraper-store'
import { idFromListingSlug, listingHref } from '@/app/lib/listing-url'
import PropertyClient from './PropertyClient'

export const dynamic = 'force-dynamic'

function faToEn(s: string): string { return (s || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))) }
function num(s?: string): number | undefined { const m = faToEn(s || '').match(/\d[\d,]*/); return m ? parseInt(m[0].replace(/,/g, ''), 10) : undefined }

async function load(slug: string) {
  const id = idFromListingSlug(slug)
  const it = await getItemById(id)
  if (!it || it.type !== 'listing' || it.status === 'rejected' || it.status === 'duplicate') return null
  return it
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const it = await load(slug)
  if (!it) return { title: 'آگهی یافت نشد | ملک‌جت' }
  const loc = it.location || it.meta?.['محله'] || it.meta?.['شهر'] || ''
  const title = `${it.title}${loc ? ` — ${loc}` : ''}`
  const desc = (it.excerpt || `${it.title}${it.price ? `، ${it.price}` : ''}${loc ? `، ${loc}` : ''}. مشاهدهٔ جزئیات، تحلیلِ هوش مصنوعی و اطلاعاتِ تماس در ملک‌جت.`).slice(0, 180)
  // فاز ۲۱۸ (ممیزیِ کاملِ سئو): canonical قبلاً «همان slugِ درخواستی» بود — هر واریانتی خودش را
  // canonical اعلام می‌کرد و گوگل نسخه‌های تکراری نگه می‌داشت. حالا همیشه «یک» URLِ حقیقی.
  const url = `https://melkjet.com${listingHref(it.id, it.title, it.location)}`
  return {
    title: `${title} | ملک‌جت`,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title, url, images: it.image ? [it.image] : undefined },
  }
}

export default async function ListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const it = await load(slug)
  if (!it) notFound()
  // فاز ۲۱۸: هر slugِ غیرِ حقیقی (عنوانِ عوض‌شده/لینکِ قدیمی/دست‌ساز) با ۳۰۸ به URLِ یکتا می‌رود —
  // گوگل هرگز دو نسخه از یک آگهی نمی‌بیند.
  const canonicalPath = listingHref(it.id, it.title, it.location)
  if (`/listing/${decodeURIComponent(slug)}` !== canonicalPath) permanentRedirect(canonicalPath)
  const id = idFromListingSlug(slug)
  const loc = it.location || ''
  const area = num(it.meta?.['متراژ'])
  const rooms = num(it.meta?.['اتاق خواب'])
  const city = (it.meta?.['شهر'] || '').trim()
  const canonical = `https://melkjet.com/listing/${slug}`
  const isRent = it.meta?.['نوع معامله'] === 'اجاره' || /اجاره|رهن|ودیعه/.test(`${it.price || ''} ${it.title || ''}`)
  // قیمتِ فروش برای اسکیما — فقط اگر یک عددِ واقعی باشد (اجاره = ودیعه+اجاره، یک عدد نیست؛ «توافقی» = عدد ندارد).
  // schema.org کدِ «تومان» ندارد؛ عدد به ریال (×۱۰) با IRR می‌رود تا واقعی بماند.
  const priceToman = isRent ? undefined : num(it.price)
  const offerRial = priceToman && priceToman >= 1_000_000 ? priceToman * 10 : undefined

  // فاز ۱۳۷ (سئوی آگهی‌ها): اسکیمای کاملِ RealEstateListing — همه از دادهٔ واقعیِ آگهی.
  const about: Record<string, unknown> = {
    '@type': 'Apartment', name: it.title,
    numberOfRooms: rooms || undefined,
    floorSize: area ? { '@type': 'QuantitativeValue', value: area, unitCode: 'MTK' } : undefined,
    address: { '@type': 'PostalAddress', addressLocality: city || loc || undefined, addressCountry: 'IR' },
  }
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org', '@type': 'RealEstateListing',
    name: it.title, description: it.excerpt || undefined,
    image: it.image || undefined, url: canonical,
    datePosted: it.scrapedAt ? new Date(it.scrapedAt).toISOString() : undefined,
    about,
    offers: offerRial ? { '@type': 'Offer', price: offerRial, priceCurrency: 'IRR', url: canonical } : undefined,
  }
  const clean = (o: Record<string, unknown>) => { Object.keys(o).forEach(k => o[k] === undefined && delete o[k]); return o }
  clean(about); clean(about.address as Record<string, unknown>); clean(ld)

  const crumbs = [
    { name: 'خانه', item: 'https://melkjet.com/' },
    { name: 'آگهی‌ها', item: 'https://melkjet.com/listings' },
    { name: isRent ? 'رهن و اجاره' : 'خرید و فروش', item: `https://melkjet.com/listings/${isRent ? 'rent' : 'sale'}` },
    { name: it.title, item: canonical },
  ]
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })),
  }

  // فاز ۱۳۷: نشانِ پروموت سرورساید (به‌جای فچِ جداگانهٔ کلاینت) تا آیتمِ کامل در HTML اولیه باشد.
  let promoKind: string | undefined
  try { const { promotedListingKinds } = await import('@/app/lib/promotion-store'); promoKind = (await promotedListingKinds()).get(String(it.id))?.kind } catch {}

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <PropertyClient id={id} initial={promoKind ? { ...it, promoted: true, promoKind } as any : (it as any)} />
    </>
  )
}
