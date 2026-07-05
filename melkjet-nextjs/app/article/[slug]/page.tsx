import { redirect, notFound } from 'next/navigation'
import { getArticleBySlug } from '@/app/lib/scraper-store'
import { categorySlugForName } from '@/app/lib/blog-taxonomy'

export const dynamic = 'force-dynamic'

// مسیرِ قدیمی → ساختارِ جدیدِ سئو: /blog/{category}/{slug}
export default async function LegacyArticle({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const a = await getArticleBySlug(slug)
  if (!a) notFound()
  redirect(`/blog/${categorySlugForName(a.category)}/${slug}`)
}
