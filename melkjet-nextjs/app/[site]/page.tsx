import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getSite, getSitePage, type Site, type SitePage, type SiteBlock } from '@/app/lib/sites-store'
import { listItems, listArticles, type Item } from '@/app/lib/scraper-store'
import { getTeamMembers, type TeamMember } from '@/app/lib/team-members'
import { listReviews } from '@/app/lib/reviews-store'
import { shopProductsOf } from '@/app/lib/materials-store'
import ListingsSlider from './ListingsSlider'
import SiteListings, { type SiteListing } from './SiteListings'
import ServicesSlider from './ServicesSlider'
import HeroSlider from './HeroSlider'
import GallerySlider from './GallerySlider'
import BlogFull, { type BlogArticle } from './BlogFull'
import NavBar from './NavBar'
import ReviewForm from './ReviewForm'

// Public renderer for builder-published sites living at melkjet.com/{slug}.
// Existing static single-segment routes (search, owner, ...) take precedence;
// this dynamic segment only catches unknown single-segment paths. Sub-pages live
// at /{slug}/{pageSlug} (app/[site]/[page]/page.tsx) and reuse the helpers here.
//
// Rendering mirrors the builder's BlockBody (app/components/tools/WebsiteBuilderTool.tsx),
// reading each block's `props` and the site `theme.primary`.

export async function generateMetadata(
  { params }: { params: Promise<{ site: string }> }
): Promise<Metadata> {
  const { site: slug } = await params
  const site = await getSite(slug)
  if (!site) return {}
  return {
    title: site.seo?.title || site.title,
    description: site.seo?.description || undefined,
  }
}

// Helper: read a prop with fallback.
function p(block: SiteBlock): Record<string, any> {
  return (block.props || {}) as Record<string, any>
}

// ── Owner listings: resolve the site owner's REAL published listings ──────────
// Mirrors the article↔listing owner match (app/api/content/route.ts): normalise
// whitespace + lowercase and compare for equality against item.owner.
function normOwner(s: string): string {
  return (s || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

// تطبیق آگهی‌ها با مالک سایت: اول با شمارهٔ حساب (مطمئن، مستقل از نام)، سپس
// به‌عنوان جایگزین با نامِ نمایشیِ نرمال‌شده.
function ownerListings(ownerName: string | undefined, ownerPhone: string | undefined, count: number): Item[] {
  const want = normOwner(ownerName || '')
  const phone = (ownerPhone || '').trim()
  if (!want && !phone) return []
  const all = listItems('listing', { publicOnly: true })
  // معیارِ مطمئن: شمارهٔ حساب (هنگام انتشار مهر می‌خورد). فقط اگر هیچ آگهیِ مهرخورده‌ای
  // نبود، به‌عنوان جایگزین با نام تطبیق می‌دهیم — تا آگهی‌های سراسریِ سایت نشت نکنند.
  let mine = phone ? all.filter(it => it.meta?.__ownerPhone === phone) : []
  if (mine.length === 0 && want) mine = all.filter(it => !it.meta?.__ownerPhone && normOwner(it.owner || '') === want)
  return mine.slice(0, count)
}

// Owner articles: resolve the site owner's REAL published articles, matched the
// same way as listings — normalised meta.author === normalised site ownerName.
function ownerArticles(ownerName: string | undefined, count: number): Item[] {
  const want = normOwner(ownerName || '')
  if (!want) return []
  return listArticles({ publishedOnly: true })
    .filter(it => normOwner(it.meta?.author || '') === want)
    .slice(0, count)
}

// ── Shared visual primitives ──────────────────────────────────────────────────
// رنگ‌ها از متغیرهای CSS خوانده می‌شوند تا با پالتِ تمِ سایت بازرنگ شوند (SiteShell
// روی <main> این متغیرها را از theme می‌ست می‌کند).
const INK = 'var(--mjs-heading)'
const MUTED = 'var(--mjs-muted)'
const SURFACE = 'var(--mjs-surface)'
const CARD_SHADOW = '0 10px 34px -22px rgba(20,16,10,.55), 0 2px 8px -4px rgba(20,16,10,.10)'
const SECTION_PAD = 'clamp(56px,8vw,96px) clamp(20px,5vw,24px)'

// Bold section heading with a short primary accent underline.
function SectionHeading({ children, primary, center, light, sub }: {
  children: React.ReactNode; primary: string; center?: boolean; light?: boolean; sub?: string
}) {
  return (
    <div style={{ marginBottom: 'clamp(28px,4vw,44px)', textAlign: center ? 'center' : 'right' }}>
      <h2 style={{
        fontSize: 'clamp(24px,3.4vw,34px)', fontWeight: 900, letterSpacing: '-0.6px',
        color: light ? '#fff' : INK, margin: 0, lineHeight: 1.25,
      }}>{children}</h2>
      <div style={{
        height: 4, width: 56, borderRadius: 999, background: primary,
        margin: center ? '14px auto 0' : '14px 0 0',
      }} />
      {sub ? (
        <p style={{
          fontSize: 'clamp(14px,1.6vw,16px)', color: light ? 'rgba(255,255,255,.72)' : MUTED,
          margin: center ? '14px auto 0' : '14px 0 0', maxWidth: 640, lineHeight: 1.9,
        }}>{sub}</p>
      ) : null}
    </div>
  )
}

function HeroBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  const align = props.align === 'right' ? 'right' : 'center'
  const textColor = props.textColor || '#fff'
  const overlay: 'dark' | 'light' | 'none' =
    props.overlay === 'light' ? 'light' : props.overlay === 'none' ? 'none' : 'dark'
  const tall = props.height === 'tall'

  // منبعِ تصاویرِ اسلایدشو (اگر ≥۲ باشد یک لایهٔ پس‌زمینهٔ کلاینت با محو-تدریجی رندر می‌شود).
  const images: string[] = Array.isArray(props.images) ? props.images.filter(Boolean) : []
  const useSlider = images.length >= 2

  // پس‌زمینهٔ ثابت: image → props.bg → گرادیانِ تم.
  const image: string = typeof props.image === 'string' ? props.image.trim() : ''
  const baseBg = image
    ? `url(${image})`
    : (props.bg || 'linear-gradient(135deg, var(--mjs-primary), var(--mjs-secondary) 70%)')

  // گرادیانِ روکش برای خوانایی، بسته به overlay.
  const overlayGrad =
    overlay === 'dark'
      ? 'linear-gradient(180deg, rgba(12,9,6,.38), rgba(12,9,6,.70))'
      : overlay === 'light'
        ? 'linear-gradient(180deg, rgba(255,255,255,.30), rgba(255,255,255,.55))'
        : ''

  // وقتی اسلایدر فعال است، روکش داخلِ HeroSlider اعمال می‌شود؛ پس‌زمینهٔ section خنثی می‌ماند.
  const sectionBg = useSlider
    ? 'var(--mjs-secondary)'
    : (overlayGrad ? `${overlayGrad}, ${baseBg}` : baseBg)

  const minHeight = tall ? 'clamp(440px,80vh,720px)' : undefined
  const padY = tall ? 'clamp(96px,16vw,160px)' : 'clamp(72px,13vw,140px)'

  return (
    <section id="hero" style={{
      position: 'relative', background: sectionBg, backgroundSize: 'cover', backgroundPosition: 'center',
      padding: `${padY} clamp(20px,5vw,24px)`, direction: 'rtl', overflow: 'hidden',
      minHeight, display: 'flex', alignItems: 'center',
    }}>
      {useSlider ? <HeroSlider images={images} overlay={overlay} interval={5000} /> : null}
      <div style={{
        position: 'relative', zIndex: 1,
        maxWidth: 1000, margin: '0 auto', width: '100%', textAlign: align as any,
        display: 'flex', flexDirection: 'column', alignItems: align === 'center' ? 'center' : 'flex-start',
      }}>
        <span className="mjs-hero-badge" style={{
          display: 'inline-block', fontSize: 13, fontWeight: 700, color: textColor,
          background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.22)',
          padding: '7px 16px', borderRadius: 999, marginBottom: 22, backdropFilter: 'blur(4px)',
        }}>املاک و مستغلات</span>
        <h1 className="mjs-hero-h1" style={{
          fontSize: 'clamp(32px,6vw,60px)', fontWeight: 900, color: textColor,
          margin: 0, marginBottom: 18, letterSpacing: '-1px', lineHeight: 1.15, maxWidth: 900,
        }}>{props.heading}</h1>
        {props.subheading ? (
          <p style={{
            fontSize: 'clamp(15px,2vw,19px)', color: textColor, opacity: .82,
            margin: 0, marginBottom: 34, maxWidth: 620, lineHeight: 1.9,
          }}>{props.subheading}</p>
        ) : null}
        {props.buttonText ? (
          <a href={props.buttonLink || '#'} className="mjs-btn" style={{
            display: 'inline-block', padding: '15px 38px', background: primary, borderRadius: 14,
            fontSize: 16, fontWeight: 800, color: '#fff', textDecoration: 'none',
            boxShadow: `0 16px 40px -14px ${primary}`,
          }}>{props.buttonText}</a>
        ) : null}
      </div>
    </section>
  )
}

function SearchBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  return (
    <section style={{ background: SURFACE, padding: 'clamp(28px,5vw,44px) clamp(20px,5vw,24px)', direction: 'rtl' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        {props.heading ? <h2 style={{ fontSize: 'clamp(18px,2.4vw,22px)', fontWeight: 800, color: INK, marginBottom: 16 }}>{props.heading}</h2> : null}
        <div className="mjs-search-row" style={{
          display: 'flex', gap: 12, background: 'var(--mjs-bg)', padding: 10, borderRadius: 18,
          boxShadow: CARD_SHADOW, border: '1px solid #efe9df',
        }}>
          <div style={{ flex: 1, minHeight: 52, background: 'var(--mjs-bg)', borderRadius: 12, display: 'flex', alignItems: 'center', padding: '0 18px', color: '#a9a195', fontSize: 15 }}>
            <span style={{ marginLeft: 10, opacity: .7 }}>🔍</span>{props.placeholder}
          </div>
          <div className="mjs-btn" style={{ padding: '0 34px', minHeight: 52, background: primary, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#fff', boxShadow: `0 10px 26px -12px ${primary}` }}>جستجو</div>
        </div>
      </div>
    </section>
  )
}

// Reusable property/article card.
function MediaCard({ href, image, gradient, children }: {
  href: string; image?: string; gradient: string; children: React.ReactNode
}) {
  return (
    <a href={href} className="mjs-card" style={{
      background: 'var(--mjs-bg)', borderRadius: 18, overflow: 'hidden', border: '1px solid #efe9df',
      textDecoration: 'none', display: 'block', boxShadow: CARD_SHADOW,
    }}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" style={{ width: '100%', height: 190, objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ height: 190, background: `linear-gradient(135deg,${gradient})` }} />
      )}
      <div style={{ padding: 20 }}>{children}</div>
    </a>
  )
}

function ListingsBlock({ block, primary, ownerName, ownerPhone }: { block: SiteBlock; primary: string; ownerName?: string; ownerPhone?: string }) {
  const props = p(block)
  // total = تعداد آگهی‌های بارگذاری‌شده (پیش‌فرض ۹)؛ count به‌عنوان جایگزینِ legacy.
  const total = Math.max(1, Math.min(48, Number(props.total) || Number(props.count) || 9))
  const perSlide = Math.max(1, Math.min(6, Number(props.perSlide) || 3))
  const showCategories = props.showCategories !== 'no'

  // فقط آگهی‌های واقعیِ منتشرشدهٔ مالک — هیچ دادهٔ نمونه/فیک. در نبودِ آگهی، حالتِ خالی.
  const items = ownerListings(ownerName, ownerPhone, total)
  const categories: string[] = []
  for (const it of items) {
    const c = (it.category || '').trim()
    if (c && !categories.includes(c)) categories.push(c)
  }
  const sliderItems = items.map(it => ({
    id: it.id, title: it.title, location: it.location, price: it.price, image: it.image, category: (it.category || '').trim(),
  }))
  return (
    <section id="listings" style={{ background: 'var(--mjs-bg)', padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary}>{props.heading}</SectionHeading>
        {items.length === 0 ? (
          <div style={{ background: SURFACE, border: '1px dashed #ddd4c5', borderRadius: 18, padding: '52px 24px', textAlign: 'center', color: '#9b9285', fontSize: 14.5 }}>
            هنوز آگهی منتشرشده‌ای برای نمایش وجود ندارد.
          </div>
        ) : (
          <ListingsSlider
            items={sliderItems}
            categories={categories}
            perSlide={perSlide}
            primary={primary}
            showCategories={showCategories}
          />
        )}
      </div>
    </section>
  )
}

function BlogBlock({ block, primary, ownerName }: { block: SiteBlock; primary: string; ownerName?: string }) {
  const props = p(block)
  const n = Math.max(1, Math.min(12, Number(props.count) || 3))
  const grads = ['#15202d,#101828', '#251528,#1a0e1e', '#152825,#0e1a18', '#2d2215,#1e1a12', '#2d1515,#1e0e0e', '#1e2215,#141a10']

  // فقط مقاله‌های واقعیِ منتشرشدهٔ مالک — هیچ دادهٔ نمونه. در نبودِ مقاله، حالتِ خالی.
  const items = ownerArticles(ownerName, n)
  return (
    <section id="blog" style={{ background: SURFACE, padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary}>{props.heading}</SectionHeading>
        {items.length === 0 ? (
          <div style={{ background: 'var(--mjs-bg)', border: '1px dashed #ddd4c5', borderRadius: 18, padding: '52px 24px', textAlign: 'center', color: '#9b9285', fontSize: 14.5 }}>
            هنوز مقالهٔ منتشرشده‌ای برای نمایش وجود ندارد.
          </div>
        ) : (
          <div className="mjs-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 }}>
            {items.map((it, i) => {
              const slug = it.meta?.slug || it.id
              const excerpt = it.meta?.summary || it.meta?.metaDescription || it.excerpt || ''
              const cat = (it.category || it.meta?.category || '').trim()
              const author = (it.meta?.author || '').trim()
              const date = (it.meta?.date || it.meta?.publishedAt || '').trim()
              const meta = [author, date].filter(Boolean).join(' · ')
              return (
                <MediaCard key={it.id} href={`/article/${slug}`} image={it.image} gradient={grads[i % grads.length]}>
                  {cat ? (
                    <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, color: primary, background: `${primary}14`, border: `1px solid ${primary}33`, borderRadius: 999, padding: '3px 11px', marginBottom: 12 }}>{cat}</span>
                  ) : null}
                  <div style={{ fontSize: 17, fontWeight: 800, color: INK, marginBottom: 10, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{it.title}</div>
                  {excerpt ? <p style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.95, margin: '0 0 16px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{excerpt}</p> : null}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTop: '1px solid #f2ede4', paddingTop: 14 }}>
                    {meta ? <span style={{ fontSize: 12, color: MUTED }}>{meta}</span> : <span />}
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: primary }}>ادامه مطلب →</span>
                  </div>
                </MediaCard>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

// صفحهٔ کاملِ وبلاگ: فقط مقاله‌های واقعیِ منتشرشده را بارگذاری می‌کند (هیچ دادهٔ نمونه)؛
// دسته‌ها را استخراج و به مؤلفهٔ کلاینتِ BlogFull (فیلتر + جستجو + ساید‌بار) پاس می‌دهد.
function BlogFullBlock({ block, primary, ownerName }: { block: SiteBlock; primary: string; ownerName?: string }) {
  const props = p(block)
  const heading = props.heading || 'وبلاگ'
  const sidebar: 'yes' | 'no' = props.sidebar === 'no' ? 'no' : 'yes'

  const items = ownerArticles(ownerName, 24)
  const articles: BlogArticle[] = items.map(it => ({
    id: it.id,
    slug: it.meta?.slug || it.id,
    title: it.title,
    excerpt: it.meta?.summary || it.meta?.metaDescription || it.excerpt || '',
    image: it.image,
    category: (it.category || it.meta?.category || '').trim() || undefined,
    author: (it.meta?.author || '').trim() || undefined,
    date: (it.meta?.date || it.meta?.publishedAt || '').trim() || undefined,
  }))

  // دسته‌های متمایزِ غیرخالی به ترتیبِ اولین مشاهده.
  const categories: string[] = []
  for (const a of articles) {
    const c = (a.category || '').trim()
    if (c && !categories.includes(c)) categories.push(c)
  }

  return (
    <section id="blog" style={{ background: SURFACE, padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionHeading primary={primary}>{heading}</SectionHeading>
        <BlogFull articles={articles} categories={categories} sidebar={sidebar} primary={primary} />
      </div>
    </section>
  )
}

// تبدیلِ رقمِ فارسی به لاتین و استخراجِ عدد.
function faDigits(s: string): number {
  const latin = String(s || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  const n = parseInt(latin.replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

// «آگهی‌ها با جستجو و فیلتر» — مثلِ صفحهٔ اصلیِ آگهی‌ها: گریدِ کامل + فیلتر + جستجو.
function SearchListBlock({ block, primary, ownerName, ownerPhone }: { block: SiteBlock; primary: string; ownerName?: string; ownerPhone?: string }) {
  const props = p(block)
  const total = Math.max(1, Math.min(300, Number(props.total) || 60))
  const items: SiteListing[] = ownerListings(ownerName, ownerPhone, total).map(it => {
    const m = (it.meta || {}) as Record<string, string>
    const deal: 'sale' | 'rent' = m['نوع معامله'] === 'اجاره' ? 'rent' : 'sale'
    return {
      id: it.id, title: it.title, location: it.location, price: it.price, image: it.image, category: (it.category || '').trim(),
      deal, ptype: (m['نوع ملک'] || '').trim(),
      city: (m['شهر'] || '').trim(), neighborhood: (m['محله'] || m['منطقه'] || '').trim(),
      rooms: faDigits(m['اتاق خواب'] || ''), area: faDigits(m['متراژ'] || ''),
      priceNum: faDigits(it.price || ''),
    }
  })
  return (
    <section id="listings" style={{ background: 'var(--mjs-bg)', padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary}>{props.heading}</SectionHeading>
        {items.length === 0 ? (
          <div style={{ background: SURFACE, border: '1px dashed #ddd4c5', borderRadius: 18, padding: '52px 24px', textAlign: 'center', color: '#9b9285', fontSize: 14.5 }}>
            هنوز آگهی منتشرشده‌ای برای نمایش وجود ندارد.
          </div>
        ) : (
          <SiteListings items={items} primary={primary} />
        )}
      </div>
    </section>
  )
}

function ServicesBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  const items: any[] = Array.isArray(props.items) ? props.items : []
  const perSlide = Math.max(1, Math.min(4, Number(props.perSlide) || 3))
  return (
    <section style={{ background: 'var(--mjs-bg)', padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary} center>{props.heading}</SectionHeading>
        {items.length > 0 && (
          <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, marginTop: -10, marginBottom: 24 }}>
            {items.length.toLocaleString('fa-IR')} مورد · {perSlide.toLocaleString('fa-IR')} در هر نما
          </div>
        )}
        <ServicesSlider items={items} perSlide={perSlide} primary={primary} />
      </div>
    </section>
  )
}

function AboutBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  return (
    <section id="about" style={{ background: SURFACE, padding: SECTION_PAD, direction: 'rtl' }}>
      <div className="mjs-about" style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 'clamp(28px,5vw,56px)', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 340px' }}>
          <SectionHeading primary={primary}>{props.heading}</SectionHeading>
          <p style={{ fontSize: 'clamp(15px,1.7vw,16.5px)', lineHeight: 2.1, color: 'var(--mjs-text)', margin: 0 }}>{props.text}</p>
        </div>
        {props.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.image} alt="" style={{ flex: '1 1 340px', width: '100%', maxWidth: 440, height: 320, objectFit: 'cover', borderRadius: 22, boxShadow: CARD_SHADOW }} />
        ) : (
          <div style={{ flex: '1 1 340px', width: '100%', maxWidth: 440, height: 320, background: 'linear-gradient(135deg,var(--mjs-primary),var(--mjs-secondary))', borderRadius: 22, boxShadow: CARD_SHADOW }} />
        )}
      </div>
    </section>
  )
}

function StatsBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  const items: any[] = Array.isArray(props.items) ? props.items : []
  return (
    <section style={{ background: `linear-gradient(135deg, ${primary}14, ${primary}0a)`, padding: 'clamp(48px,7vw,80px) clamp(20px,5vw,24px)', direction: 'rtl' }}>
      <div className="mjs-grid-4" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 20 }}>
        {items.map((s, i) => (
          <div key={i} style={{ textAlign: 'center', padding: '14px 12px' }}>
            <div style={{ fontSize: 'clamp(34px,5vw,46px)', fontWeight: 900, color: primary, marginBottom: 8, letterSpacing: '-1px' }}>{s.value}</div>
            <div style={{ fontSize: 14.5, color: MUTED, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function GalleryBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  const imgs: string[] = Array.isArray(props.images) ? props.images.filter(Boolean) : []
  const total = Math.max(1, Math.min(48, Number(props.total) || 9))
  const perSlide = Math.max(1, Math.min(6, Number(props.perSlide) || 3))
  return (
    <section style={{ background: 'var(--mjs-bg)', padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary}>{props.heading}</SectionHeading>
        <GallerySlider images={imgs.slice(0, total)} perSlide={perSlide} primary={primary} />
      </div>
    </section>
  )
}

function TestimonialsBlock({ block, primary, ownerPhone, slug }: { block: SiteBlock; primary: string; ownerPhone?: string; slug?: string }) {
  const props = p(block)
  const showReal = props.showReal !== 'no'
  const allowSubmit = props.allowSubmit !== 'no'

  // نظراتِ دستی (props.items) + نظراتِ واقعیِ ثبت‌شده برای مالکِ سایت.
  type Quote = { name: string; text: string; rating: number }
  const manual: Quote[] = (Array.isArray(props.items) ? props.items : []).map((s: any) => ({
    name: String(s?.name || '').trim(),
    text: String(s?.text || ''),
    rating: Math.max(0, Math.min(5, Number(s?.rating) || 5)),
  }))
  const real: Quote[] = (showReal && ownerPhone)
    ? listReviews(ownerPhone).map(r => ({ name: r.name, text: r.text, rating: Math.max(0, Math.min(5, Number(r.rating) || 5)) }))
    : []
  // دستی‌ها اول، سپس واقعی‌ها.
  const quotes: Quote[] = [...manual, ...real]

  return (
    <section style={{ background: SURFACE, padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary} center>{props.heading}</SectionHeading>
        {quotes.length > 0 ? (
          <div className="mjs-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 24 }}>
            {quotes.map((s, i) => {
              const rating = Math.max(0, Math.min(5, Number(s.rating) || 5))
              const initial = (s.name || '?').toString().trim().charAt(0) || '?'
              return (
                <div key={i} className="mjs-card" style={{ background: 'var(--mjs-bg)', border: '1px solid #efe9df', borderRadius: 18, padding: 26, boxShadow: CARD_SHADOW }}>
                  <div style={{ fontSize: 40, lineHeight: 0.6, color: `${primary}55`, fontWeight: 900, marginBottom: 8 }}>”</div>
                  <p style={{ fontSize: 15, lineHeight: 2, color: 'var(--mjs-text)', margin: '0 0 18px' }}>{s.text}</p>
                  <div style={{ color: primary, marginBottom: 16, fontSize: 15, letterSpacing: 2 }}>
                    {'★'.repeat(rating)}<span style={{ color: '#e3dccf' }}>{'★'.repeat(5 - rating)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid #f2ede4', paddingTop: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${primary}1f`, color: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}>{initial}</div>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: INK }}>{s.name}</div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (allowSubmit && slug) ? (
          <div style={{ textAlign: 'center', color: '#9b9285', fontSize: 14.5 }}>اولین نظر را شما ثبت کنید.</div>
        ) : null}

        {allowSubmit && slug ? <ReviewForm slug={slug} primary={primary} /> : null}
      </div>
    </section>
  )
}

function CtaBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  const baseBg = props.bg || 'linear-gradient(135deg, var(--mjs-primary), var(--mjs-secondary) 75%)'
  const bg = `linear-gradient(180deg, rgba(12,9,6,.20), rgba(12,9,6,.45)), ${baseBg}`
  return (
    <section style={{ background: bg, backgroundSize: 'cover', backgroundPosition: 'center', padding: 'clamp(60px,9vw,100px) clamp(20px,5vw,24px)', textAlign: 'center', direction: 'rtl' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h2 style={{ fontSize: 'clamp(26px,4vw,40px)', fontWeight: 900, color: '#fff', marginBottom: 14, letterSpacing: '-0.8px', lineHeight: 1.25 }}>{props.heading}</h2>
        {props.subheading ? <p style={{ fontSize: 'clamp(15px,2vw,18px)', color: 'rgba(255,255,255,0.78)', marginBottom: 34, lineHeight: 1.9 }}>{props.subheading}</p> : null}
        {props.buttonText ? <a href={props.buttonLink || '#'} className="mjs-btn" style={{ display: 'inline-block', padding: '15px 40px', background: '#fff', borderRadius: 14, fontSize: 16, fontWeight: 800, color: INK, textDecoration: 'none', boxShadow: '0 16px 40px -16px rgba(0,0,0,.6)' }}>{props.buttonText}</a> : null}
      </div>
    </section>
  )
}

function ContactBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  const Row = ({ icon, children, ltr }: { icon: string; children: React.ReactNode; ltr?: boolean }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ flex: '0 0 auto', width: 44, height: 44, borderRadius: 12, background: `${primary}1f`, color: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{icon}</div>
      <div style={{ fontSize: 15, color: 'var(--mjs-text)', fontWeight: 600, direction: ltr ? 'ltr' : 'rtl', textAlign: 'right', flex: 1 }}>{children}</div>
    </div>
  )
  return (
    <section id="contact" style={{ background: 'var(--mjs-bg)', padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <SectionHeading primary={primary}>{props.heading}</SectionHeading>
        <div className="mjs-card" style={{ background: SURFACE, border: '1px solid #efe9df', borderRadius: 22, padding: 'clamp(24px,4vw,36px)', boxShadow: CARD_SHADOW }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 26 }}>
            {props.phone ? <Row icon="☎" ltr>{props.phone}</Row> : null}
            {props.email ? <Row icon="✉" ltr>{props.email}</Row> : null}
            {props.address ? <Row icon="📍">{props.address}</Row> : null}
          </div>
          <div className="mjs-contact-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <input placeholder="نام" style={{ minHeight: 50, background: 'var(--mjs-bg)', border: '1px solid #e6ddcd', borderRadius: 12, padding: '0 16px', fontSize: 14.5, fontFamily: 'inherit' }} />
            <input placeholder="شماره تماس" style={{ minHeight: 50, background: 'var(--mjs-bg)', border: '1px solid #e6ddcd', borderRadius: 12, padding: '0 16px', fontSize: 14.5, fontFamily: 'inherit' }} />
          </div>
          <textarea placeholder="پیام شما" style={{ width: '100%', minHeight: 120, background: 'var(--mjs-bg)', border: '1px solid #e6ddcd', borderRadius: 12, padding: 16, fontSize: 14.5, marginBottom: 18, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }} />
          <button className="mjs-btn" style={{ padding: '14px 38px', background: primary, borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 800, color: '#fff', cursor: 'pointer', boxShadow: `0 12px 30px -14px ${primary}`, fontFamily: 'inherit' }}>ارسال پیام</button>
        </div>
      </div>
    </section>
  )
}

// ── Rich multi-column footer ──────────────────────────────────────────────────
// پسوندِ تیرهٔ برند (var(--mjs-secondary)): برند + توضیح، ستون‌های لینک، تماس و
// شبکه‌های اجتماعی در گریدِ واکنش‌گرا، با ردیفِ کپی‌رایت در پایین. سازگار با propهای legacy.
type FooterLink = { label: string; href: string }
type FooterColumn = { title: string; links: FooterLink[] }

function FooterBlock({ block, primary, ownerName }: { block: SiteBlock; primary: string; ownerName?: string }) {
  const props = p(block)

  const brand: string = String(props.brand || props.text || ownerName || 'ملک‌جت').trim() || 'ملک‌جت'
  const about: string = String(props.about || 'همراه شما در خرید و فروش ملک.').trim()
  const copyright: string = String(props.copyright || '© ۱۴۰۴ — تمامی حقوق محفوظ است').trim()

  // ستون‌ها: props.columns ← اگر نبود، propی legacyِ links به‌عنوان یک ستونِ «دسترسی سریع».
  let columns: FooterColumn[] = Array.isArray(props.columns)
    ? (props.columns as any[])
        .map(c => ({ title: String(c?.title || '').trim(), links: Array.isArray(c?.links) ? (c.links as any[]).map(l => ({ label: String(l?.label || ''), href: String(l?.href || '#') })) : [] }))
        .filter(c => c.title || c.links.length)
        .slice(0, 4)
    : []
  if (columns.length === 0 && Array.isArray(props.links) && props.links.length) {
    columns = [{ title: 'دسترسی سریع', links: (props.links as any[]).map(l => ({ label: String(l?.label || ''), href: String(l?.href || '#') })) }]
  }

  const phone = String(props.phone || '').trim()
  const email = String(props.email || '').trim()
  const address = String(props.address || '').trim()
  const hasContact = !!(phone || email || address)

  // شبکه‌های اجتماعی: هم از props.social (شیء) و هم از فیلدهای مسطحِ ویرایشگر خوانده می‌شود.
  const socialObj = (props.social && typeof props.social === 'object' ? props.social : {}) as Record<string, string>
  const social: Record<string, string> = {
    instagram: socialObj.instagram || props.instagram,
    telegram: socialObj.telegram || props.telegram,
    whatsapp: socialObj.whatsapp || props.whatsapp,
    linkedin: socialObj.linkedin || props.linkedin,
  }
  const socialItems: { key: string; glyph: string; href: string; label: string }[] = []
  const sv = (v: any) => String(v || '').trim()
  if (sv(social.instagram)) socialItems.push({ key: 'instagram', glyph: 'IG', href: sv(social.instagram), label: 'اینستاگرام' })
  if (sv(social.telegram)) socialItems.push({ key: 'telegram', glyph: 'TG', href: sv(social.telegram), label: 'تلگرام' })
  if (sv(social.whatsapp)) socialItems.push({ key: 'whatsapp', glyph: 'WA', href: sv(social.whatsapp), label: 'واتساپ' })
  if (sv(social.linkedin)) socialItems.push({ key: 'linkedin', glyph: 'in', href: sv(social.linkedin), label: 'لینکدین' })

  const ContactRow = ({ icon, children, ltr }: { icon: string; children: React.ReactNode; ltr?: boolean }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
      <span style={{ flex: '0 0 auto', width: 30, height: 30, borderRadius: 9, background: `${primary}26`, color: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{icon}</span>
      <span style={{ fontSize: 13.5, color: '#b6ac9c', direction: ltr ? 'ltr' : 'rtl', textAlign: 'right', flex: 1 }}>{children}</span>
    </div>
  )

  return (
    <footer style={{ background: 'var(--mjs-secondary)', padding: 'clamp(48px,7vw,72px) clamp(20px,5vw,24px) 32px', direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="mjs-footer-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr repeat(auto-fit,minmax(160px,1fr))', gap: 'clamp(28px,5vw,44px)', marginBottom: 38, alignItems: 'start' }}>
          {/* برند + توضیح + شبکه‌های اجتماعی */}
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: primary, marginBottom: 14, letterSpacing: '-0.4px' }}>{brand}</div>
            {about ? <p style={{ fontSize: 14, color: '#9b9183', lineHeight: 2, maxWidth: 340, margin: '0 0 18px' }}>{about}</p> : null}
            {socialItems.length > 0 ? (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {socialItems.map(s => (
                  <a key={s.key} href={s.href} target="_blank" rel="noreferrer" aria-label={s.label} title={s.label} className="mjs-fsocial" style={{
                    width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12.5, fontWeight: 800, color: '#cfc6b6', background: 'rgba(255,255,255,.07)',
                    border: '1px solid rgba(255,255,255,.12)', textDecoration: 'none',
                  }}>{s.glyph}</a>
                ))}
              </div>
            ) : null}
          </div>

          {/* ستون‌های لینک */}
          {columns.map((col, ci) => (
            <div key={ci}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#c2b8a6', marginBottom: 16, letterSpacing: '.3px' }}>{col.title}</div>
              {col.links.map((l, i) => (
                <a key={i} href={l.href || '#'} className="mjs-flink" style={{ display: 'block', fontSize: 14, color: '#8a8073', marginBottom: 11, textDecoration: 'none' }}>{l.label}</a>
              ))}
            </div>
          ))}

          {/* تماس */}
          {hasContact ? (
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#c2b8a6', marginBottom: 16, letterSpacing: '.3px' }}>تماس</div>
              {phone ? <ContactRow icon="☎" ltr>{phone}</ContactRow> : null}
              {email ? <ContactRow icon="✉" ltr>{email}</ContactRow> : null}
              {address ? <ContactRow icon="📍">{address}</ContactRow> : null}
            </div>
          ) : null}
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,.10)', paddingTop: 22, textAlign: 'center' }}>
          <span style={{ fontSize: 12.5, color: '#7a7062' }}>{copyright}</span>
        </div>
      </div>
    </footer>
  )
}

// ── Team / advisors block: کارتِ زیبای مشاورانِ عضوِ آژانس با تخصص و اطلاعاتِ مفید ──
// اعضا از رابطهٔ واقعیِ «مشاور↔آژانس» خوانده و کامل می‌شوند (team-members). مشاوری که
// در props.members انتخاب شده باشد نمایش داده می‌شود؛ اگر چیزی انتخاب نشده، همه.
export function TeamMemberCard({ m, primary, showSites, showPhone }: { m: TeamMember; primary: string; showSites: boolean; showPhone: boolean }) {
  const info: { icon: string; label: string; value: string }[] = []
  if (m.areas) info.push({ icon: '📍', label: 'مناطقِ کاری', value: m.areas })
  if (m.experience) info.push({ icon: '⏳', label: 'سابقه', value: m.experience })
  if (m.activeListings > 0) info.push({ icon: '🏠', label: 'آگهیِ فعال', value: `${m.activeListings.toLocaleString('fa-IR')} مورد` })
  if (showPhone && m.phone) info.push({ icon: '☎', label: 'تماس', value: m.phone })
  return (
    <div className="mjs-card" style={{ background: 'var(--mjs-bg)', border: '1px solid #efe9df', borderRadius: 22, overflow: 'hidden', boxShadow: CARD_SHADOW, textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
      {/* نوارِ رنگیِ بالا */}
      <div style={{ height: 76, background: 'linear-gradient(135deg, var(--mjs-primary), var(--mjs-secondary))' }} />
      <div style={{ padding: '0 20px 22px', marginTop: -52, display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
        {m.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.photo} alt={m.name} style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', display: 'block', border: '4px solid #fff', boxShadow: `0 0 0 2px ${primary}, 0 8px 20px -8px rgba(0,0,0,.4)` }} />
        ) : (
          <div style={{ width: 96, height: 96, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${primary}22`, color: primary, fontSize: 36, fontWeight: 900, border: '4px solid #fff', boxShadow: `0 0 0 2px ${primary}` }}>{(m.name || '?').trim().charAt(0)}</div>
        )}
        <div style={{ fontSize: 18, fontWeight: 900, color: INK, marginTop: 12 }}>{m.name}</div>
        {m.title ? <div style={{ fontSize: 13, color: primary, fontWeight: 700, marginTop: 4 }}>{m.title}</div> : null}
        {/* چیپ‌های تخصص */}
        {m.specialties.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 12 }}>
            {m.specialties.slice(0, 3).map((s, i) => (
              <span key={i} style={{ fontSize: 11.5, fontWeight: 600, color: primary, background: `${primary}14`, border: `1px solid ${primary}33`, borderRadius: 999, padding: '3px 11px' }}>{s}</span>
            ))}
          </div>
        )}
        {/* اطلاعاتِ مفید */}
        {info.length > 0 && (
          <div style={{ width: '100%', marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'right' }}>
            {info.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, background: SURFACE, border: '1px solid #f0ebe2', borderRadius: 11, padding: '8px 11px' }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: `${primary}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{r.icon}</span>
                <span style={{ fontSize: 11.5, color: MUTED, flexShrink: 0 }}>{r.label}:</span>
                <span style={{ fontSize: 12.5, color: INK, fontWeight: 700, marginInlineStart: 'auto', direction: r.icon === '☎' ? 'ltr' : 'rtl', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.value}</span>
              </div>
            ))}
          </div>
        )}
        {/* دکمه‌ها */}
        <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 18, width: '100%' }}>
          {showSites && m.slug ? <a href={`/${m.slug}`} target="_blank" rel="noreferrer" className="mjs-btn" style={{ flex: 1, fontSize: 13, fontWeight: 800, color: '#fff', background: primary, borderRadius: 12, padding: '10px 8px', textDecoration: 'none', boxShadow: `0 10px 22px -12px ${primary}` }}>وب‌سایتِ من ↗</a> : null}
          {showPhone && m.phone ? <a href={`tel:${m.phone}`} style={{ flex: showSites && m.slug ? '0 0 auto' : 1, fontSize: 13, fontWeight: 800, color: primary, background: `${primary}12`, border: `1px solid ${primary}33`, borderRadius: 12, padding: '10px 16px', textDecoration: 'none' }}>☎ تماس</a> : null}
        </div>
      </div>
    </div>
  )
}

async function TeamBlock({ block, primary, ownerPhone }: { block: SiteBlock; primary: string; ownerPhone?: string }) {
  const props = p(block)
  const showSites = props.showSites !== 'no'
  const showPhone = props.showPhone !== 'no'
  const sel = Array.isArray(props.members) ? (props.members as string[]) : null
  let people = ownerPhone ? await getTeamMembers(ownerPhone) : []
  if (sel) people = people.filter(m => sel.includes(m.phone))
  return (
    <section id="team" style={{ background: 'var(--mjs-bg)', padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary} center sub={props.subheading || undefined}>{props.heading || 'مشاوران ما'}</SectionHeading>
        {people.length === 0 ? (
          <div style={{ background: SURFACE, border: '1px dashed #ddd4c5', borderRadius: 18, padding: '52px 24px', textAlign: 'center', color: '#9b9285', fontSize: 14.5 }}>هنوز مشاوری به این آژانس متصل نشده است.</div>
        ) : (
          <div className="mjs-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 24 }}>
            {people.map(m => <TeamMemberCard key={m.phone} m={m} primary={primary} showSites={showSites} showPhone={showPhone} />)}
          </div>
        )}
      </div>
    </section>
  )
}

// Render one block. `ownerName` powers the real «آگهی‌های من» listings.
// ── کاتالوگِ محصولاتِ مصالح (واقعی، از پنلِ فروشندهٔ همین سایت) ──
function CatalogBlock({ block, primary, ownerPhone }: { block: SiteBlock; primary: string; ownerPhone?: string }) {
  const props = p(block)
  const data = ownerPhone ? shopProductsOf(ownerPhone) : null
  const count = Math.max(3, Math.min(24, Number(props.count) || 12))
  const products = (data?.products || []).slice(0, count)
  const fa = (n: number) => n.toLocaleString('fa-IR')
  const money = (t: number) => t >= 1e9 ? `${fa(Math.round(t / 1e8) / 10)} میلیارد` : t >= 1e6 ? `${fa(Math.round(t / 1e5) / 10)} میلیون` : fa(t)
  return (
    <section id="catalog" style={{ background: 'var(--mjs-bg)', padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary} center>{props.heading || 'محصولات ما'}</SectionHeading>
        {products.length === 0 ? (
          <div style={{ textAlign: 'center', color: MUTED, fontSize: 14, padding: 24 }}>محصولی برای نمایش ثبت نشده است.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 18, marginTop: 24 }}>
            {products.map(pr => {
              const price = Math.round(pr.price * (1 - (pr.discountPct || 0) / 100))
              const img = pr.images?.[0]
              const href = data?.slug ? `/forushgah/${data.slug}` : undefined
              const Card: any = href ? 'a' : 'div'
              return (
                <Card key={pr.id} {...(href ? { href } : {})} style={{ background: SURFACE, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', boxShadow: CARD_SHADOW }}>
                  <div style={{ height: 150, background: img ? `center/cover no-repeat url(${img})` : `linear-gradient(135deg,${primary}22,${primary}05)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>{!img && '🧱'}</div>
                  <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: INK, lineHeight: 1.6 }}>{pr.name}</div>
                    {pr.brand && <div style={{ fontSize: 11.5, color: MUTED }}>{pr.brand}</div>}
                    <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: primary }}>{money(price)}</span>
                      <span style={{ fontSize: 11, color: MUTED }}>تومان/{pr.unit}</span>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

// ── نرخِ روزِ محصولاتِ فروشنده (جدولِ قیمت) ──
function PriceListBlock({ block, primary, ownerPhone }: { block: SiteBlock; primary: string; ownerPhone?: string }) {
  const props = p(block)
  const data = ownerPhone ? shopProductsOf(ownerPhone) : null
  const rows = (data?.products || []).slice(0, 40)
  const fa = (n: number) => n.toLocaleString('fa-IR')
  return (
    <section id="pricelist" style={{ background: SURFACE, padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <SectionHeading primary={primary} center>{props.heading || 'نرخِ روزِ محصولات'}</SectionHeading>
        {rows.length === 0 ? (
          <div style={{ textAlign: 'center', color: MUTED, fontSize: 14, padding: 24 }}>قیمتی ثبت نشده است.</div>
        ) : (
          <div style={{ marginTop: 24, background: 'var(--mjs-bg)', borderRadius: 16, overflow: 'hidden', boxShadow: CARD_SHADOW }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '12px 18px', background: `${primary}12`, fontSize: 13, fontWeight: 800, color: INK }}>
              <div>کالا</div><div>واحد</div><div style={{ textAlign: 'left' }}>قیمت (تومان)</div>
            </div>
            {rows.map((pr, i) => {
              const price = Math.round(pr.price * (1 - (pr.discountPct || 0) / 100))
              return (
                <div key={pr.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '12px 18px', borderTop: '1px solid rgba(0,0,0,0.06)', fontSize: 13.5, alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, color: INK }}>{pr.name}{pr.brand && <span style={{ color: MUTED, fontWeight: 400 }}> · {pr.brand}</span>}</div>
                  <div style={{ color: MUTED }}>{pr.unit}</div>
                  <div style={{ textAlign: 'left', fontWeight: 800, color: primary }}>{fa(price)}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

function renderBlock(block: SiteBlock, primary: string, ownerName?: string, ownerPhone?: string, slug?: string) {
  switch (block.type) {
    case 'catalog': return <CatalogBlock key={block.id} block={block} primary={primary} ownerPhone={ownerPhone} />
    case 'pricelist': return <PriceListBlock key={block.id} block={block} primary={primary} ownerPhone={ownerPhone} />
    case 'hero': return <HeroBlock key={block.id} block={block} primary={primary} />
    case 'search': return <SearchBlock key={block.id} block={block} primary={primary} />
    case 'listings': return <ListingsBlock key={block.id} block={block} primary={primary} ownerName={ownerName} ownerPhone={ownerPhone} />
    case 'searchlist': return <SearchListBlock key={block.id} block={block} primary={primary} ownerName={ownerName} ownerPhone={ownerPhone} />
    case 'blog': return <BlogBlock key={block.id} block={block} primary={primary} ownerName={ownerName} />
    case 'blogfull': return <BlogFullBlock key={block.id} block={block} primary={primary} ownerName={ownerName} />
    case 'services': return <ServicesBlock key={block.id} block={block} primary={primary} />
    case 'about': return <AboutBlock key={block.id} block={block} primary={primary} />
    case 'team': return <TeamBlock key={block.id} block={block} primary={primary} ownerPhone={ownerPhone} />
    case 'stats': return <StatsBlock key={block.id} block={block} primary={primary} />
    case 'gallery': return <GalleryBlock key={block.id} block={block} primary={primary} />
    case 'testimonials': return <TestimonialsBlock key={block.id} block={block} primary={primary} ownerPhone={ownerPhone} slug={slug} />
    case 'cta': return <CtaBlock key={block.id} block={block} primary={primary} />
    case 'contact': return <ContactBlock key={block.id} block={block} primary={primary} />
    case 'footer': return <FooterBlock key={block.id} block={block} primary={primary} ownerName={ownerName} />
    default:
      return (
        <section key={block.id} style={{ background: 'var(--mjs-bg)', padding: '32px 24px', direction: 'rtl' }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: INK }}>{p(block).heading || block.type}</h2>
        </section>
      )
  }
}

// Top nav listing every page of the site, themed. Home → /{slug}, others → /{slug}/{pageSlug}.
// صفحاتی که باید در منو بیایند: خانه همیشه + هر صفحه‌ای که inMenu !== false
function menuPages(site: Site): { slug: string; label: string; home: boolean }[] {
  return site.pages
    .map((pg, i) => ({ slug: pg.slug, label: pg.menuLabel || pg.title, home: i === 0, inMenu: i === 0 || pg.inMenu !== false }))
    .filter(p => p.inMenu)
    .map(({ slug, label, home }) => ({ slug, label, home }))
}

// رپرِ نازکِ سازگار: ناوبری به مؤلفهٔ کلاینتِ NavBar واگذار می‌شود (همبرگرِ موبایل).
function SiteNav({ site, primary, currentSlug }: { site: Site; primary: string; currentSlug: string }) {
  return <NavBar brand={site.title} items={menuPages(site)} currentSlug={currentSlug} siteSlug={site.slug} primary={primary} />
}

// Shared full-site shell: nav + the given page's blocks. Used by both the home
// route and the [page] sub-route so there's a single source of truth.
export function SiteShell({ site, page }: { site: Site; page: SitePage }) {
  // پالتِ کاملِ تم را یک‌بار با مقادیرِ پیش‌فرض حل می‌کنیم؛ کلِ سایت از همین متغیرهای CSS
  // (روی <main>) بازرنگ می‌شود.
  const t = site.theme
  const primary = t?.primary || '#c9a84c'
  const secondary = t?.secondary || '#1a1510'
  const bg = t?.bg || '#ffffff'
  const surface = t?.surface || '#fbfaf8'
  const text = t?.text || '#4a4338'
  const heading = t?.heading || '#15110b'
  // همهٔ فونت‌ها لوکال‌اند (@font-face در globals.css) — هیچ بارگذاری از گوگل.
  const fontFamily = (t?.font ? `'${t.font}', ` : '') + 'Vazirmatn, Tahoma, sans-serif'
  const cssVars = {
    '--mjs-primary': primary,
    '--mjs-secondary': secondary,
    '--mjs-bg': bg,
    '--mjs-surface': surface,
    '--mjs-text': text,
    '--mjs-heading': heading,
    '--mjs-muted': text, // متنِ بدنه در برابرِ عنوان‌ها نقشِ «خاموش/muted» را بازی می‌کند.
  } as React.CSSProperties
  return (
    <main style={{ minHeight: '100vh', background: 'var(--mjs-bg)', color: 'var(--mjs-text)', fontFamily, ...cssVars }}>
      <style>{`
        /* ناوبریِ موبایلِ ملک‌جت روی سایتِ منتشرشده دیده نشود — هر سایت منوی خودش را دارد. */
        .mj-bottom-nav{display:none !important}
        .mjs-card{transition:transform .22s ease, box-shadow .22s ease}
        .mjs-card:hover{transform:translateY(-5px);box-shadow:0 22px 50px -24px rgba(20,16,10,.55),0 6px 16px -8px rgba(20,16,10,.18)}
        .mjs-btn{transition:transform .18s ease, box-shadow .18s ease, opacity .18s ease}
        .mjs-btn:hover{transform:translateY(-2px);opacity:.94}
        .mjs-navlink{transition:background .18s ease, color .18s ease}
        .mjs-navlink:hover{background:${primary}1f;color:${primary}}
        .mjs-flink{transition:color .18s ease, padding .18s ease}
        .mjs-flink:hover{color:${primary};padding-right:5px}
        .mjs-fsocial{transition:transform .18s ease, background .18s ease, color .18s ease, border-color .18s ease}
        .mjs-fsocial:hover{transform:translateY(-2px);background:${primary};color:#fff;border-color:${primary}}
        .mjs-gallery-img{transition:transform .25s ease}
        .mjs-gallery-img:hover{transform:scale(1.03)}
        .mjs-nav-items{scrollbar-width:none}
        .mjs-nav-items::-webkit-scrollbar{display:none}
        @media(max-width:680px){
          .mjs-grid-3,.mjs-grid-4{grid-template-columns:1fr !important}
          .mjs-search-row{flex-direction:column !important}
          .mjs-contact-fields{grid-template-columns:1fr !important}
          .mjs-about{flex-direction:column !important}
          .mjs-footer-grid{grid-template-columns:1fr !important}
        }
      `}</style>
      <NavBar brand={site.title} items={menuPages(site)} currentSlug={page.slug} siteSlug={site.slug} primary={primary} />
      {page.blocks.map(block => renderBlock(block, primary, site.ownerName, site.owner, site.slug))}
    </main>
  )
}

export default async function PublishedSitePage(
  { params }: { params: Promise<{ site: string }> }
) {
  const { site: slug } = await params
  const site: Site | null = await getSite(slug)
  if (!site) notFound()

  const home = getSitePage(site, 'home')
  return <SiteShell site={site} page={home} />
}
