import { redirect, notFound } from 'next/navigation'
import { getItemById } from '@/app/lib/scraper-store'
import { listingHref } from '@/app/lib/listing-url'

export const dynamic = 'force-dynamic'

// مسیرِ قدیمی → canonicalِ جدید /listing/{id}-{slug}
export default async function LegacyProperty({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const it = await getItemById(id)
  if (!it) notFound()
  redirect(listingHref(it.id, it.title, it.location))
}
