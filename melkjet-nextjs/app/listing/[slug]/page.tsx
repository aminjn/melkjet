import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getItemById } from '@/app/lib/scraper-store'
import { idFromListingSlug } from '@/app/lib/listing-url'
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
  const url = `https://melkjet.com/listing/${idFromListingSlug(slug)}${slug.includes('-') ? slug.slice(idFromListingSlug(slug).length) : ''}`
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
  const id = idFromListingSlug(slug)
  const loc = it.location || ''
  const area = num(it.meta?.['متراژ'])
  const rooms = num(it.meta?.['اتاق خواب'])

  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org', '@type': 'Apartment',
    name: it.title, description: it.excerpt || undefined,
    image: it.image || undefined, address: loc || undefined,
    numberOfRooms: rooms || undefined,
    floorSize: area ? { '@type': 'QuantitativeValue', value: area, unitCode: 'MTK' } : undefined,
    url: `https://melkjet.com/listing/${slug}`,
  }
  Object.keys(ld).forEach(k => ld[k] === undefined && delete ld[k])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <PropertyClient id={id} />
    </>
  )
}
