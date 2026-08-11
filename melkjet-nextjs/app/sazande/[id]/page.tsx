import { redirect } from 'next/navigation'
import { slugForBuilderId } from '@/app/lib/builder-slug-store'

export const revalidate = 600

// مسیرِ قدیمیِ فارسی → canonicalِ انگلیسیِ /builders/{slug}
export default async function LegacySazande({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const slug = await slugForBuilderId(id)
  redirect(`/builders/${slug || id}`)
}
