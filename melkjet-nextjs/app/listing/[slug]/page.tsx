import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { getItemById } from '@/app/lib/scraper-store'
import { idFromListingSlug, listingHref } from '@/app/lib/listing-url'
import { listingSeoText, buildListingDetailData } from '@/app/lib/listing-detail-data'
import PropertyClient from './PropertyClient'

export const revalidate = 300
export function generateStaticParams() { return [] }

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
  // فاز ۲۲۸ (ضدِ تکراری با دیوار): title/description «به‌کل» از دادهٔ ساختاریافتهٔ خودِ آگهی بازساخته
  // می‌شود + سئوِ محله‌ای — منطق در listing-detail-data (مشترک با صفحهٔ آگهیِ سایت‌ساز، فاز ۲۹۷د).
  const { title, desc } = await listingSeoText(it)
  // فاز ۲۱۸ (ممیزیِ کاملِ سئو): canonical همیشه «یک» URLِ حقیقی.
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
  // فاز ۲۹۸ی — URLِ «منجمد»: canonical از seoSlugِ ذخیره‌شده ساخته می‌شود، نه از عنوانِ متغیر،
  // تا با هر اسکرپ عوض نشود (ریشهٔ انبوهِ «Page with redirect» در GSC).
  const canonicalPath = listingHref(it.id, it.title, it.location, (it as { seoSlug?: string }).seoSlug)
  if (`/listing/${decodeURIComponent(slug)}` !== canonicalPath) permanentRedirect(canonicalPath)
  const id = idFromListingSlug(slug)

  // فاز ۲۹۷د — کلِ منطقِ سرورساید (JSON-LDها، اصالت، enrich در HTML اولیه) در موتورِ مشترک.
  const d = await buildListingDetailData(it)

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d.ld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d.breadcrumbLd) }} />
      {d.nearbyLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d.nearbyLd) }} />}
      <PropertyClient id={id} initial={d.initial as any} originality={d.originality} initialEnrich={d.initialEnrich as any} />
    </>
  )
}
