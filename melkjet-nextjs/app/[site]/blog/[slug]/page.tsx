import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSite } from '@/app/lib/sites-store'
import { getArticleBySlug } from '@/app/lib/scraper-store'
import { mdToHtml } from '@/app/lib/markdown'
import { categorySlugForName } from '@/app/lib/blog-taxonomy'
import { SiteChrome } from '../../page'

export const dynamic = 'force-dynamic'
const MAIN = 'https://melkjet.com'

async function load(siteSlug: string, slug: string) {
  const site = await getSite(siteSlug); if (!site) return null
  const a = await getArticleBySlug(slug)
  if (!a || a.status === 'rejected') return null
  return { site, a }
}

export async function generateMetadata({ params }: { params: Promise<{ site: string; slug: string }> }): Promise<Metadata> {
  const { site: siteSlug, slug } = await params
  const r = await load(siteSlug, slug)
  if (!r) return { title: 'مقاله یافت نشد' }
  const realSlug = (r.a.meta as Record<string, string> | undefined)?.slug || r.a.id
  const canonical = `${MAIN}/blog/${categorySlugForName(r.a.category)}/${realSlug}`
  const desc = ((r.a.meta as any)?.metaDescription || r.a.excerpt || '').replace(/<[^>]+>/g, '').replace(/[#*_>`-]/g, '').slice(0, 160)
  return {
    title: `${r.a.title} | ${r.site.seo?.title || r.site.title}`,
    description: desc,
    alternates: { canonical },
    openGraph: { title: r.a.title, type: 'article', images: r.a.image ? [r.a.image] : undefined },
  }
}

export default async function InSiteArticle({ params }: { params: Promise<{ site: string; slug: string }> }) {
  const { site: siteSlug, slug } = await params
  const r = await load(siteSlug, slug)
  if (!r) notFound()
  const body = r.a.excerpt || ''
  const html = /<\/?[a-z][\s\S]*>/i.test(body) ? body : mdToHtml(body)
  const faDate = (() => { try { return r.a.scrapedAt ? new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(r.a.scrapedAt)) : '' } catch { return '' } })()

  return (
    <SiteChrome site={r.site} appendFooter>
      <article style={{ direction: 'rtl', maxWidth: 820, margin: '0 auto', padding: 'clamp(20px,4vw,44px) clamp(16px,4vw,22px) 64px' }}>
        <nav style={{ fontSize: 13, color: 'var(--mjs-muted)', marginBottom: 16, display: 'flex', gap: 6 }}>
          <a href={`/${r.site.slug}`} style={{ color: 'var(--mjs-muted)', textDecoration: 'none' }}>خانه</a><span>›</span>
          <span style={{ color: 'var(--mjs-primary)', fontWeight: 700 }}>مقاله</span>
        </nav>
        <h1 style={{ fontSize: 'clamp(23px,4vw,34px)', fontWeight: 900, color: 'var(--mjs-heading)', margin: '0 0 8px', lineHeight: 1.6 }}>{r.a.title}</h1>
        {faDate && <div style={{ fontSize: 12.5, color: 'var(--mjs-muted)', marginBottom: 20 }}>{faDate}</div>}
        {r.a.image && <img src={r.a.image} alt={r.a.title} style={{ width: '100%', borderRadius: 16, marginBottom: 24, border: '1px solid rgba(0,0,0,0.08)' }} />}
        <div className="mjs-article-body" style={{ fontSize: 16, lineHeight: 2.15, color: 'var(--mjs-text)' }} dangerouslySetInnerHTML={{ __html: html }} />
        <a href={`/${r.site.slug}`} style={{ display: 'inline-block', marginTop: 28, fontSize: 13.5, color: 'var(--mjs-primary)', fontWeight: 700, textDecoration: 'none' }}>← بازگشت به {r.site.title}</a>
      </article>
    </SiteChrome>
  )
}
