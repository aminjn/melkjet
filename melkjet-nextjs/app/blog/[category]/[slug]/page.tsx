import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import BannerSlot from '@/app/components/BannerSlot'
import { getArticleBySlug, listItems } from '@/app/lib/scraper-store'
import { mdToHtml } from '@/app/lib/markdown'
import { blogCatBySlugDyn as blogCatBySlug, categorySlugForNameDyn as categorySlugForName } from '@/app/lib/blog-taxonomy-server'
import { siteConfig } from '@/app/lib/site-store'
import { marketOverview } from '@/app/lib/market-stats'

export const dynamic = 'force-dynamic'

// فاز ۱۵۰ — بازطراحیِ مجله‌ایِ صفحهٔ مقاله. اصلِ آهنین: هیچ دادهٔ فیکی نیست —
// خلاصه از متایِ خودِ مقاله، آمارِ بازار از دادهٔ واقعیِ سایت، تبلیغ فقط اگر ادمین بنر تعریف کرده باشد.

async function load(slug: string) {
  const a = await getArticleBySlug(slug)
  if (!a || a.status === 'rejected') return null
  return a
}
const faDate = (ts?: number) => { if (!ts) return ''; try { return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(ts)) } catch { return '' } }
const fa = (n: number) => n.toLocaleString('fa-IR')

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
  const realCat = categorySlugForName(a.category)
  if (category !== realCat) redirect(`/blog/${realCat}/${slug}`)

  const cat = blogCatBySlug(realCat)
  const m = (a.meta || {}) as Record<string, string>
  const body = a.excerpt || ''
  const rawHtml = /<\/?[a-z][\s\S]*>/i.test(body) ? body : mdToHtml(body)
  const author = m.author || 'تحریریهٔ ملک‌جت'
  const date = faDate(a.scrapedAt)
  const catName = cat?.nameFa || a.category || 'مقاله'
  const url = `https://melkjet.com/blog/${realCat}/${slug}`

  // فهرستِ مطالب از تیترهای واقعیِ خودِ متن (h2/h3) — با تزریقِ id برای پرش.
  let secIdx = 0
  const toc: { id: string; text: string; level: number }[] = []
  const html = rawHtml.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi, (_mm, lvl, attrs, inner) => {
    const text = String(inner).replace(/<[^>]+>/g, '').trim()
    const hid = `sec-${++secIdx}`
    if (text) toc.push({ id: hid, text: text.slice(0, 60), level: Number(lvl) })
    return `<h${lvl}${attrs} id="${hid}">${inner}</h${lvl}>`
  })

  // زمانِ مطالعه از شمارِ واقعیِ واژه‌ها.
  const plain = rawHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const readMin = Math.max(1, Math.round(plain.split(' ').length / 180))

  // خلاصه (TL;DR) — فقط از متنِ خودِ مقاله (متای summary/metaDescription)؛ knob ادمین.
  const cfg = siteConfig()
  const tldrSrc = (m.summary || m.metaDescription || '').replace(/<[^>]+>/g, '').trim()
  const tldr = cfg.blog.tldr && tldrSrc ? tldrSrc.split(/(?<=[.!؟])\s+/).map(s => s.trim()).filter(s => s.length > 15).slice(0, 3) : []

  // کارتِ تحلیلِ بازار — آمارِ زندهٔ واقعی از آگهی‌های فروش؛ بدونِ داده یا knob خاموش → اصلاً رندر نمی‌شود.
  let market: { totalSaleListings: number; neighbourhoods: number; cityAvg: number } | null = null
  if (cfg.blog.market) {
    try { const o = await marketOverview(); if (o.totalSaleListings > 0 && o.cityAvg > 0) market = o } catch {}
  }

  // مقالاتِ مرتبطِ واقعی: هم‌دسته، به‌جز خودِ مقاله.
  let related: { title: string; href: string; cat: string; min: number }[] = []
  try {
    related = (await listItems('article', { publicOnly: true }))
      .filter(x => x.id !== a.id && x.category === a.category)
      .slice(0, 3)
      .map(x => {
        const xm = (x.meta || {}) as Record<string, string>
        const words = (x.excerpt || '').replace(/<[^>]+>/g, ' ').split(/\s+/).length
        return { title: x.title, href: `/blog/${categorySlugForName(x.category)}/${xm.slug || x.id}`, cat: x.category || '', min: Math.max(1, Math.round(words / 180)) }
      })
  } catch {}

  const tags = (a.tags || []).filter(Boolean)
  const share = encodeURIComponent(url)
  const shareTitle = encodeURIComponent(a.title)

  const ld = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: a.title, image: a.image ? [a.image] : undefined, datePublished: a.scrapedAt ? new Date(a.scrapedAt).toISOString() : undefined,
    author: { '@type': 'Organization', name: 'ملک‌جت' }, publisher: { '@type': 'Organization', name: 'ملک‌جت' },
    mainEntityOfPage: url,
  }
  const crumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'خانه', item: 'https://melkjet.com/' },
      { '@type': 'ListItem', position: 2, name: 'مجله', item: 'https://melkjet.com/blog' },
      { '@type': 'ListItem', position: 3, name: catName, item: `https://melkjet.com/blog/${realCat}` },
      { '@type': 'ListItem', position: 4, name: a.title },
    ],
  }

  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }
  const shareBtn: React.CSSProperties = { width: 36, height: 36, borderRadius: 10, border: '1px solid var(--line2)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 15, color: 'var(--text)' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbLd) }} />

      {/* ── هیرو ── */}
      <header style={{ background: 'linear-gradient(180deg, var(--bg2), var(--bg))', borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '34px 22px 30px' }}>
          <nav aria-label="مسیر" style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Link href="/" style={{ color: 'var(--muted)' }}>خانه</Link><span>›</span>
            <Link href="/blog" style={{ color: 'var(--muted)' }}>مجله</Link><span>›</span>
            <Link href={`/blog/${realCat}`} style={{ color: 'var(--gold)' }}>{catName}</Link>
          </nav>
          <Link href={`/blog/${realCat}`} style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, color: 'var(--gold)', border: '1px solid var(--goldDim)', borderRadius: 999, padding: '4px 14px', marginBottom: 14, textDecoration: 'none' }}>{catName}</Link>
          <h1 style={{ fontSize: 'clamp(26px,4.4vw,42px)', fontWeight: 900, lineHeight: 1.4, margin: '0 0 12px', maxWidth: 860 }}>{a.title}</h1>
          {m.metaDescription && <p style={{ fontSize: 15.5, color: 'var(--muted)', lineHeight: 1.9, margin: '0 0 18px', maxWidth: 760 }}>{m.metaDescription}</p>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--goldDim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✦</div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{author}</div>
                <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>مجلهٔ ملک‌جت</div>
              </div>
            </div>
            <span style={{ color: 'var(--line2)' }}>|</span>
            <div style={{ display: 'flex', gap: 12, fontSize: 12.5, color: 'var(--muted)', flexWrap: 'wrap' }}>
              {date && <span>📅 {date}</span>}
              <span>⏱ {fa(readMin)} دقیقه مطالعه</span>
            </div>
            <span style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <a href={`https://t.me/share/url?url=${share}&text=${shareTitle}`} target="_blank" rel="noopener noreferrer" title="اشتراک در تلگرام" style={shareBtn}>✈️</a>
              <a href={`https://wa.me/?text=${shareTitle}%20${share}`} target="_blank" rel="noopener noreferrer" title="اشتراک در واتساپ" style={shareBtn}>💬</a>
              <a href={`https://twitter.com/intent/tweet?url=${share}&text=${shareTitle}`} target="_blank" rel="noopener noreferrer" title="اشتراک در X" style={{ ...shareBtn, fontSize: 14 }}>𝕏</a>
            </div>
          </div>
        </div>
      </header>

      {/* ── بدنه: سایدبار + مقاله ── */}
      <div className="mjblog-grid" style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 22px 70px', display: 'grid', gridTemplateColumns: '260px minmax(0,1fr)', gap: 28, alignItems: 'start' }}>

        <aside className="mjblog-side" style={{ position: 'sticky', top: 86, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {toc.length > 1 && (
            <div style={{ ...card, padding: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--muted)', marginBottom: 10 }}>فهرست مطالب</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {toc.map(t => (
                  <a key={t.id} href={`#${t.id}`} style={{ fontSize: 12.5, color: 'var(--text)', textDecoration: 'none', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--line)', marginInlineStart: t.level === 3 ? 12 : 0 }}>{t.text}</a>
                ))}
              </div>
            </div>
          )}
          {/* تبلیغِ سایدبار — فقط اگر ادمین بنری (عمومی/دسته/همین مقاله) تعریف کرده باشد؛ نبود = هیچ */}
          <BannerSlot placement="sidebar" category={a.category} slug={slug} />
        </aside>

        <article style={{ minWidth: 0 }}>
          {a.image && <img src={a.image} alt={a.title} style={{ width: '100%', borderRadius: 16, marginBottom: 22, border: '1px solid var(--line)' }} />}

          {tldr.length > 0 && (
            <div style={{ ...card, borderColor: 'var(--goldDim)', padding: '16px 18px', marginBottom: 22 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold)', marginBottom: 10 }}>✦ خلاصهٔ مقاله (TL;DR)</div>
              <ul style={{ margin: 0, paddingInlineStart: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tldr.map((s, i) => <li key={i} style={{ fontSize: 13.5, lineHeight: 1.9 }}>{s}</li>)}
              </ul>
            </div>
          )}

          <div className="mj-article-body" style={{ fontSize: 16.5, lineHeight: 2.1 }} dangerouslySetInnerHTML={{ __html: html }} />

          {/* تبلیغِ داخلِ مقاله — بنرِ اختصاصیِ مقاله (مقاله‌ساز) یا هدف‌گیریِ دسته/عمومی؛ نبود = هیچ */}
          <div style={{ margin: '26px 0 0' }}>
            {m.__bannerId
              ? <BannerSlot placement="article" bannerId={m.__bannerId} />
              : <BannerSlot placement="article" category={a.category} slug={slug} />}
          </div>

          {/* تحلیلِ بازار — آمارِ زندهٔ واقعی؛ بدونِ داده یا knob خاموش → هیچ */}
          {market && (
            <div style={{ ...card, padding: 20, marginTop: 26 }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>📊 تحلیلِ بازارِ ملک‌جت</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>آمارِ زنده از آگهی‌های فروشِ فعالِ همین سایت — نه برآورد، نه عددِ ساختگی.</div>
              <div className="mjblog-tiles" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                {[
                  [`${fa(Math.round(market.cityAvg / 1e6))} م`, 'میانگینِ هر متر (تومان)'],
                  [fa(market.totalSaleListings), 'آگهیِ فروشِ مبنا'],
                  [fa(market.neighbourhoods), 'محلهٔ تحلیل‌شده'],
                ].map(([v, l]) => (
                  <div key={l as string} style={{ background: 'var(--bg2)', borderRadius: 12, padding: '14px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 19, fontWeight: 900, color: 'var(--gold)' }}>{v}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{l}</div>
                  </div>
                ))}
              </div>
              <Link href="/market" style={{ display: 'inline-block', background: 'linear-gradient(135deg, var(--gold), #b8933f)', color: '#16140f', fontWeight: 800, fontSize: 13.5, borderRadius: 11, padding: '10px 22px', textDecoration: 'none' }}>تحلیلِ کاملِ بازار و قیمتِ محله‌ها ←</Link>
            </div>
          )}

          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '24px 0 0' }}>
              {tags.map(t => <span key={t} style={{ fontSize: 12, color: 'var(--muted)', border: '1px solid var(--line2)', borderRadius: 999, padding: '4px 12px' }}>#{t}</span>)}
            </div>
          )}

          <div style={{ ...card, padding: 16, display: 'flex', gap: 12, alignItems: 'center', marginTop: 24 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--goldDim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>✦</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{author}</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.8 }}>محتوای مجلهٔ ملک‌جت با تکیه بر داده‌های واقعیِ بازارِ املاک تهیه می‌شود.</div>
            </div>
          </div>

          {related.length > 0 && (
            <div style={{ marginTop: 34 }}>
              <div style={{ fontSize: 17, fontWeight: 900, marginBottom: 14 }}>مقالاتِ مرتبط</div>
              <div className="mjblog-rel" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                {related.map(r => (
                  <Link key={r.href} href={r.href} style={{ ...card, padding: 14, textDecoration: 'none', color: 'inherit', display: 'block' }}>
                    <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, marginBottom: 6 }}>{r.cat}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.7 }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 8 }}>⏱ {fa(r.min)} دقیقه</div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>
      <Footer />
    </div>
  )
}
