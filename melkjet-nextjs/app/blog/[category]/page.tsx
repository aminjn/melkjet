import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import { listItems } from '@/app/lib/scraper-store'
import { gradientFor } from '@/app/lib/content-display'
import { blogCatBySlug, categorySlugForName, BLOG_CATEGORIES } from '@/app/lib/blog-taxonomy'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params
  const cat = blogCatBySlug(category)
  if (!cat) return { title: 'دسته یافت نشد | ملک‌جت' }
  const url = `https://melkjet.com/blog/${category}`
  return { title: `${cat.nameFa} | وبلاگ ملک‌جت`, description: `جدیدترین مقالاتِ «${cat.nameFa}» در ملک‌جت — راهنما، تحلیل و نکاتِ کاربردیِ املاک.`, alternates: { canonical: url }, openGraph: { title: cat.nameFa, url, type: 'website' } }
}

export default async function BlogCategory({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params
  const cat = blogCatBySlug(category)
  if (!cat) notFound()
  const all = await listItems('article', { publicOnly: true })
  const items = all.filter(a => categorySlugForName(a.category) === category)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Nav />
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 22px 70px' }}>
        <nav aria-label="مسیر" style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: 'var(--muted)' }}>خانه</Link><span>›</span>
          <Link href="/blog" style={{ color: 'var(--muted)' }}>وبلاگ</Link><span>›</span>
          <span style={{ color: 'var(--gold)' }}>{cat.nameFa}</span>
        </nav>
        <h1 style={{ fontSize: 'clamp(24px,4vw,34px)', fontWeight: 900, margin: '0 0 6px' }}>{cat.nameFa}</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 8px' }}>{items.length.toLocaleString('fa-IR')} مقاله</p>

        {/* پیمایشِ دسته‌ها */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0 26px' }}>
          {BLOG_CATEGORIES.map(c => (
            <Link key={c.slug} href={`/blog/${c.slug}`} style={{ fontSize: 12.5, fontWeight: 700, padding: '6px 13px', borderRadius: 999, textDecoration: 'none', border: `1px solid ${c.slug === category ? 'var(--gold)' : 'var(--line)'}`, background: c.slug === category ? 'var(--goldDim)' : 'var(--surface)', color: c.slug === category ? 'var(--gold)' : 'var(--muted)' }}>{c.nameFa}</Link>
          ))}
        </div>

        {items.length === 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px dashed var(--line2)', borderRadius: 16, padding: 40, textAlign: 'center', color: 'var(--muted)' }}>هنوز مقاله‌ای در این دسته منتشر نشده است.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 18 }}>
            {items.map(a => {
              const slug = (a.meta as Record<string, string> | undefined)?.slug || a.id
              return (
                <Link key={a.id} href={`/blog/${category}/${slug}`} style={{ display: 'block', textDecoration: 'none', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden', color: 'inherit' }}>
                  <div style={{ height: 168, background: a.image ? `center/cover no-repeat url(${a.image})` : gradientFor(a.title) }} />
                  <div style={{ padding: '15px 17px' }}>
                    <div style={{ fontSize: 11.5, color: 'var(--gold)', fontWeight: 700, marginBottom: 7 }}>{cat.nameFa}</div>
                    <h2 style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.6, margin: 0 }}>{a.title}</h2>
                    {a.excerpt && <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.9, margin: '8px 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.excerpt.replace(/<[^>]+>/g, '').replace(/[#*_>`]/g, '').slice(0, 120)}</p>}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
