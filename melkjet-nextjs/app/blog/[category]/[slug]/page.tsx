import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import { getArticleBySlug } from '@/app/lib/scraper-store'
import { mdToHtml } from '@/app/lib/markdown'
import { blogCatBySlug, categorySlugForName } from '@/app/lib/blog-taxonomy'

export const dynamic = 'force-dynamic'

async function load(slug: string) {
  const a = await getArticleBySlug(slug)
  if (!a || a.status === 'rejected') return null
  return a
}
const faDate = (ts?: number) => { if (!ts) return ''; try { return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(ts)) } catch { return '' } }

export async function generateMetadata({ params }: { params: Promise<{ category: string; slug: string }> }): Promise<Metadata> {
  const { category, slug } = await params
  const a = await load(slug)
  if (!a) return { title: 'مقاله یافت نشد | ملک‌جت' }
  const m = (a.meta || {}) as Record<string, string>
  const title = (m.seoTitle || a.title || '').trim()
  const desc = (m.metaDescription || a.excerpt || '').replace(/<[^>]+>/g, '').replace(/[#*_>`-]/g, '').slice(0, 160)
  const url = `https://melkjet.com/blog/${category}/${slug}`
  return {
    title: `${title} | ملک‌جت`,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title, description: desc, url, type: 'article', images: a.image ? [a.image] : undefined },
  }
}

export default async function BlogArticle({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category, slug } = await params
  const a = await load(slug)
  if (!a) notFound()
  // اگر دستهٔ URL با دستهٔ واقعیِ مقاله نخواند، به آدرسِ درست هدایت کن (canonical واحد).
  const realCat = categorySlugForName(a.category)
  if (category !== realCat) redirect(`/blog/${realCat}/${slug}`)

  const cat = blogCatBySlug(realCat)
  const body = a.excerpt || ''
  const html = /<\/?[a-z][\s\S]*>/i.test(body) ? body : mdToHtml(body)
  const author = (a.meta as Record<string, string> | undefined)?.author || 'تحریریهٔ ملک‌جت'
  const date = faDate(a.scrapedAt)

  const ld = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: a.title, image: a.image ? [a.image] : undefined, datePublished: a.scrapedAt ? new Date(a.scrapedAt).toISOString() : undefined,
    author: { '@type': 'Organization', name: 'ملک‌جت' }, publisher: { '@type': 'Organization', name: 'ملک‌جت' },
    mainEntityOfPage: `https://melkjet.com/blog/${realCat}/${slug}`,
  }
  const crumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'خانه', item: 'https://melkjet.com/' },
      { '@type': 'ListItem', position: 2, name: 'وبلاگ', item: 'https://melkjet.com/blog' },
      { '@type': 'ListItem', position: 3, name: cat?.nameFa || a.category || 'مقاله', item: `https://melkjet.com/blog/${realCat}` },
      { '@type': 'ListItem', position: 4, name: a.title },
    ],
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbLd) }} />
      <article style={{ maxWidth: 800, margin: '0 auto', padding: '28px 22px 70px' }}>
        <nav aria-label="مسیر" style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 18, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: 'var(--muted)' }}>خانه</Link><span>›</span>
          <Link href="/blog" style={{ color: 'var(--muted)' }}>وبلاگ</Link><span>›</span>
          <Link href={`/blog/${realCat}`} style={{ color: 'var(--gold)' }}>{cat?.nameFa || a.category}</Link>
        </nav>
        <h1 style={{ fontSize: 'clamp(24px,4vw,36px)', fontWeight: 900, lineHeight: 1.45, margin: '0 0 14px' }}>{a.title}</h1>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontSize: 13, color: 'var(--muted)', marginBottom: 22, flexWrap: 'wrap' }}>
          <span>✍ {author}</span>{date && <><span style={{ color: 'var(--faint)' }}>·</span><span>{date}</span></>}
        </div>
        {a.image && <img src={a.image} alt={a.title} style={{ width: '100%', borderRadius: 16, marginBottom: 26, border: '1px solid var(--line)' }} />}
        <div className="mj-article-body" style={{ fontSize: 16.5, lineHeight: 2.1 }} dangerouslySetInnerHTML={{ __html: html }} />
      </article>
      <Footer />
    </div>
  )
}
