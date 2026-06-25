import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getSite, getSitePage, type Site, type SitePage, type SiteBlock } from '@/app/lib/sites-store'
import { listItems, listArticles, type Item } from '@/app/lib/scraper-store'
import { listAgencyMembers } from '@/app/lib/agency-link-store'
import { getAdvisor } from '@/app/lib/advisor-store'
import { getProfile } from '@/app/lib/profile-store'

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
  const site = getSite(slug)
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
const INK = '#15110b'
const MUTED = '#6b6256'
const SURFACE = '#fbfaf8'
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
  // Layered overlay over the chosen bg so any image/gradient stays legible.
  const baseBg = props.bg || `linear-gradient(135deg, ${primary}, #1a1510 70%)`
  const bg = `linear-gradient(180deg, rgba(12,9,6,.30), rgba(12,9,6,.62)), ${baseBg}`
  return (
    <section id="hero" style={{
      position: 'relative', background: bg, backgroundSize: 'cover', backgroundPosition: 'center',
      padding: 'clamp(72px,13vw,140px) clamp(20px,5vw,24px)', direction: 'rtl', overflow: 'hidden',
    }}>
      <div style={{
        maxWidth: 1000, margin: '0 auto', textAlign: align as any,
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
          display: 'flex', gap: 12, background: '#fff', padding: 10, borderRadius: 18,
          boxShadow: CARD_SHADOW, border: '1px solid #efe9df',
        }}>
          <div style={{ flex: 1, minHeight: 52, background: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', padding: '0 18px', color: '#a9a195', fontSize: 15 }}>
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
      background: '#fff', borderRadius: 18, overflow: 'hidden', border: '1px solid #efe9df',
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
  const n = Math.max(1, Math.min(12, Number(props.count) || 6))
  const grads = ['#2d2215,#1e1a12', '#1e2215,#141a10', '#15202d,#101828', '#251528,#1a0e1e', '#152825,#0e1a18', '#2d1515,#1e0e0e']

  const cardInner = (it: Item, _i: number) => (
    <>
      <div style={{ fontSize: 16, fontWeight: 800, color: INK, marginBottom: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ opacity: .7 }}>📍</span>{it.location || 'موقعیت نامشخص'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f2ede4', paddingTop: 12 }}>
        <span style={{ fontSize: 17, fontWeight: 900, color: primary }}>{it.price || 'قیمت توافقی'}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: MUTED }}>مشاهده ←</span>
      </div>
    </>
  )

  // Real listings: pull the owner's own published listings. پیش‌فرض هم «آگهی‌های من»
  // است مگر صراحتاً «نمونه» انتخاب شده باشد.
  if (props.source !== 'sample') {
    const items = ownerListings(ownerName, ownerPhone, n)
    return (
      <section id="listings" style={{ background: '#fff', padding: SECTION_PAD, direction: 'rtl' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <SectionHeading primary={primary}>{props.heading}</SectionHeading>
          {items.length === 0 ? (
            <div style={{ background: SURFACE, border: '1px dashed #ddd4c5', borderRadius: 18, padding: '52px 24px', textAlign: 'center', color: '#9b9285', fontSize: 14.5 }}>
              هنوز آگهی منتشرشده‌ای برای نمایش وجود ندارد.
            </div>
          ) : (
            <div className="mjs-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 24 }}>
              {items.map((it, i) => (
                <MediaCard key={it.id} href={`/property/${it.id}`} image={it.image} gradient={grads[i % grads.length]}>{cardInner(it, i)}</MediaCard>
              ))}
            </div>
          )}
        </div>
      </section>
    )
  }

  // Sample cards (source === 'sample' or unset).
  return (
    <section id="listings" style={{ background: '#fff', padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary}>{props.heading}</SectionHeading>
        <div className="mjs-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 24 }}>
          {Array.from({ length: n }).map((_, i) => (
            <div key={i} className="mjs-card" style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', border: '1px solid #efe9df', boxShadow: CARD_SHADOW }}>
              <div style={{ height: 190, background: `linear-gradient(135deg,${grads[i % grads.length]})` }} />
              <div style={{ padding: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: INK, marginBottom: 7 }}>آپارتمان لوکس</div>
                <div style={{ fontSize: 13, color: MUTED, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ opacity: .7 }}>📍</span>تهران، منطقه نمونه</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f2ede4', paddingTop: 12 }}>
                  <span style={{ fontSize: 17, fontWeight: 900, color: primary }}>قیمت توافقی</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: MUTED }}>مشاهده ←</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function BlogBlock({ block, primary, ownerName }: { block: SiteBlock; primary: string; ownerName?: string }) {
  const props = p(block)
  const n = Math.max(1, Math.min(12, Number(props.count) || 3))
  const grads = ['#15202d,#101828', '#251528,#1a0e1e', '#152825,#0e1a18', '#2d2215,#1e1a12', '#2d1515,#1e0e0e', '#1e2215,#141a10']

  // Real articles: pull the owner's own published articles.
  if (props.source === 'mine') {
    const items = ownerArticles(ownerName, n)
    return (
      <section id="blog" style={{ background: SURFACE, padding: SECTION_PAD, direction: 'rtl' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <SectionHeading primary={primary}>{props.heading}</SectionHeading>
          {items.length === 0 ? (
            <div style={{ background: '#fff', border: '1px dashed #ddd4c5', borderRadius: 18, padding: '52px 24px', textAlign: 'center', color: '#9b9285', fontSize: 14.5 }}>
              هنوز مقالهٔ منتشرشده‌ای برای نمایش وجود ندارد.
            </div>
          ) : (
            <div className="mjs-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 }}>
              {items.map((it, i) => {
                const slug = it.meta?.slug || it.id
                const excerpt = it.meta?.summary || it.meta?.metaDescription || it.excerpt || ''
                return (
                  <MediaCard key={it.id} href={`/article/${slug}`} image={it.image} gradient={grads[i % grads.length]}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: INK, marginBottom: 10, lineHeight: 1.6 }}>{it.title}</div>
                    {excerpt ? <p style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.95, margin: '0 0 16px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{excerpt}</p> : null}
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: primary }}>مطالعهٔ مقاله →</span>
                  </MediaCard>
                )
              })}
            </div>
          )}
        </div>
      </section>
    )
  }

  // Sample cards (source === 'sample' or unset).
  return (
    <section id="blog" style={{ background: SURFACE, padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary}>{props.heading}</SectionHeading>
        <div className="mjs-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 }}>
          {Array.from({ length: n }).map((_, i) => (
            <div key={i} className="mjs-card" style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', border: '1px solid #efe9df', boxShadow: CARD_SHADOW }}>
              <div style={{ height: 190, background: `linear-gradient(135deg,${grads[i % grads.length]})` }} />
              <div style={{ padding: 20 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: INK, marginBottom: 10 }}>عنوان مقاله</div>
                <p style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.95, margin: '0 0 16px' }}>خلاصه‌ای کوتاه از مقاله در این بخش نمایش داده می‌شود.</p>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: primary }}>مطالعهٔ مقاله →</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ServicesBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  const items: any[] = Array.isArray(props.items) ? props.items : []
  return (
    <section style={{ background: '#fff', padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary} center>{props.heading}</SectionHeading>
        <div className="mjs-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 24 }}>
          {items.map((s, i) => (
            <div key={i} className="mjs-card" style={{ background: SURFACE, border: '1px solid #efe9df', borderRadius: 18, padding: '34px 22px', textAlign: 'center', boxShadow: CARD_SHADOW }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%', margin: '0 auto 18px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, color: primary, background: `${primary}1f`,
              }}>{s.icon}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: INK, marginBottom: 10 }}>{s.title}</div>
              <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.9 }}>{s.desc}</div>
            </div>
          ))}
        </div>
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
          <p style={{ fontSize: 'clamp(15px,1.7vw,16.5px)', lineHeight: 2.1, color: '#4a4338', margin: 0 }}>{props.text}</p>
        </div>
        {props.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.image} alt="" style={{ flex: '1 1 340px', width: '100%', maxWidth: 440, height: 320, objectFit: 'cover', borderRadius: 22, boxShadow: CARD_SHADOW }} />
        ) : (
          <div style={{ flex: '1 1 340px', width: '100%', maxWidth: 440, height: 320, background: `linear-gradient(135deg,${primary},#1a1510)`, borderRadius: 22, boxShadow: CARD_SHADOW }} />
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
  return (
    <section style={{ background: '#fff', padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary}>{props.heading}</SectionHeading>
        <div className="mjs-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 18 }}>
          {(imgs.length ? imgs : ['', '', '', '']).map((src, i) => src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt="" className="mjs-gallery-img" style={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: 16, boxShadow: CARD_SHADOW, display: 'block' }} />
          ) : (
            <div key={i} style={{ height: 220, background: 'linear-gradient(135deg,#2d2215,#1a1510)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 30, color: 'rgba(255,255,255,0.18)' }}>▥</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function TestimonialsBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  const items: any[] = Array.isArray(props.items) ? props.items : []
  return (
    <section style={{ background: SURFACE, padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary} center>{props.heading}</SectionHeading>
        <div className="mjs-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 24 }}>
          {items.map((s, i) => {
            const rating = Math.max(0, Math.min(5, Number(s.rating) || 5))
            const initial = (s.name || '?').toString().trim().charAt(0)
            return (
              <div key={i} className="mjs-card" style={{ background: '#fff', border: '1px solid #efe9df', borderRadius: 18, padding: 26, boxShadow: CARD_SHADOW }}>
                <div style={{ fontSize: 40, lineHeight: 0.6, color: `${primary}55`, fontWeight: 900, marginBottom: 8 }}>”</div>
                <p style={{ fontSize: 15, lineHeight: 2, color: '#4a4338', margin: '0 0 18px' }}>{s.text}</p>
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
      </div>
    </section>
  )
}

function CtaBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  const baseBg = props.bg || `linear-gradient(135deg, ${primary}, #1a1510 75%)`
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
      <div style={{ fontSize: 15, color: '#4a4338', fontWeight: 600, direction: ltr ? 'ltr' : 'rtl', textAlign: 'right', flex: 1 }}>{children}</div>
    </div>
  )
  return (
    <section id="contact" style={{ background: '#fff', padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <SectionHeading primary={primary}>{props.heading}</SectionHeading>
        <div className="mjs-card" style={{ background: SURFACE, border: '1px solid #efe9df', borderRadius: 22, padding: 'clamp(24px,4vw,36px)', boxShadow: CARD_SHADOW }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 26 }}>
            {props.phone ? <Row icon="☎" ltr>{props.phone}</Row> : null}
            {props.email ? <Row icon="✉" ltr>{props.email}</Row> : null}
            {props.address ? <Row icon="📍">{props.address}</Row> : null}
          </div>
          <div className="mjs-contact-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <input placeholder="نام" style={{ minHeight: 50, background: '#fff', border: '1px solid #e6ddcd', borderRadius: 12, padding: '0 16px', fontSize: 14.5, fontFamily: 'inherit' }} />
            <input placeholder="شماره تماس" style={{ minHeight: 50, background: '#fff', border: '1px solid #e6ddcd', borderRadius: 12, padding: '0 16px', fontSize: 14.5, fontFamily: 'inherit' }} />
          </div>
          <textarea placeholder="پیام شما" style={{ width: '100%', minHeight: 120, background: '#fff', border: '1px solid #e6ddcd', borderRadius: 12, padding: 16, fontSize: 14.5, marginBottom: 18, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }} />
          <button className="mjs-btn" style={{ padding: '14px 38px', background: primary, borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 800, color: '#fff', cursor: 'pointer', boxShadow: `0 12px 30px -14px ${primary}`, fontFamily: 'inherit' }}>ارسال پیام</button>
        </div>
      </div>
    </section>
  )
}

function FooterBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  const links: any[] = Array.isArray(props.links) ? props.links : []
  return (
    <footer style={{ background: '#0d0b08', padding: 'clamp(48px,7vw,72px) clamp(20px,5vw,24px) 32px', direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 36, marginBottom: 36 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: primary, marginBottom: 14, letterSpacing: '-0.4px' }}>{props.text}</div>
            <p style={{ fontSize: 14, color: '#8a8073', lineHeight: 2, maxWidth: 320 }}>همراه شما در خرید و فروش ملک.</p>
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#a9a08f', marginBottom: 16, letterSpacing: '.3px' }}>لینک‌های سریع</div>
            {links.map((l, i) => (
              <a key={i} href={l.href || '#'} className="mjs-flink" style={{ display: 'block', fontSize: 14, color: '#8a8073', marginBottom: 11, textDecoration: 'none' }}>{l.label}</a>
            ))}
          </div>
        </div>
        <div style={{ borderTop: '1px solid #221b12', paddingTop: 22, textAlign: 'center' }}>
          <span style={{ fontSize: 12.5, color: '#5a5145' }}>© ۱۴۰۴ — تمامی حقوق محفوظ است</span>
        </div>
      </div>
    </footer>
  )
}

// ── Team / advisors block: نمایشِ مشاورانِ عضوِ آژانس با عکسِ پروفایل ─────────
// اعضا از رابطهٔ واقعیِ «مشاور↔آژانس» (agency-link) خوانده می‌شوند؛ عکس از پروفایلِ
// مشاور (advisor-store) یا لوگوی کسب‌وکار، و لینکِ سایت از websiteSlug در پروفایل.
function memberInfo(phone: string, fallbackName: string): { phone: string; name: string; photo: string; title: string; slug: string } {
  let photo = '', title = '', name = fallbackName
  try { const ad = getAdvisor(phone).profile; if (ad) { if (ad.photo) photo = ad.photo; if (ad.title) title = ad.title; if (ad.name) name = ad.name } } catch {}
  const prof = getProfile(phone)
  if (!photo) photo = prof.logo || ''
  if (!title) title = prof.businessType || prof.tagline || ''
  return { phone, name: name || 'مشاور', photo, title, slug: prof.websiteSlug || '' }
}

function TeamBlock({ block, primary, ownerPhone }: { block: SiteBlock; primary: string; ownerPhone?: string }) {
  const props = p(block)
  const showSites = props.showSites !== 'no'
  const showPhone = props.showPhone !== 'no'
  const members = ownerPhone ? listAgencyMembers(ownerPhone) : []
  const people = members.map(m => memberInfo(m.advisorPhone, m.advisorName))
  return (
    <section id="team" style={{ background: '#fff', padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary} center sub={props.subheading || undefined}>{props.heading || 'مشاوران ما'}</SectionHeading>
        {people.length === 0 ? (
          <div style={{ background: SURFACE, border: '1px dashed #ddd4c5', borderRadius: 18, padding: '52px 24px', textAlign: 'center', color: '#9b9285', fontSize: 14.5 }}>هنوز مشاوری به این آژانس متصل نشده است.</div>
        ) : (
          <div className="mjs-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 24 }}>
            {people.map(m => (
              <div key={m.phone} className="mjs-card" style={{ background: '#fff', border: '1px solid #efe9df', borderRadius: 20, padding: '32px 20px', textAlign: 'center', boxShadow: CARD_SHADOW }}>
                {m.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.photo} alt={m.name} style={{ width: 104, height: 104, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 16px', display: 'block', border: `4px solid ${primary}22`, boxShadow: `0 0 0 2px ${primary}` }} />
                ) : (
                  <div style={{ width: 104, height: 104, borderRadius: '50%', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${primary}22`, color: primary, fontSize: 38, fontWeight: 900, boxShadow: `0 0 0 2px ${primary}` }}>{(m.name || '?').trim().charAt(0)}</div>
                )}
                <div style={{ fontSize: 17, fontWeight: 800, color: INK }}>{m.name}</div>
                {m.title ? <div style={{ fontSize: 13, color: MUTED, marginTop: 5 }}>{m.title}</div> : null}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18, alignItems: 'center' }}>
                  {showPhone && m.phone ? <a href={`tel:${m.phone}`} style={{ fontSize: 13, color: MUTED, textDecoration: 'none', direction: 'ltr', fontWeight: 600 }}>☎ {m.phone}</a> : null}
                  {showSites && m.slug ? <a href={`/${m.slug}`} target="_blank" rel="noreferrer" className="mjs-btn" style={{ display: 'inline-block', fontSize: 13, fontWeight: 700, color: '#fff', background: primary, borderRadius: 999, padding: '8px 20px', textDecoration: 'none' }}>وب‌سایتِ من ↗</a> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// Render one block. `ownerName` powers the real «آگهی‌های من» listings.
function renderBlock(block: SiteBlock, primary: string, ownerName?: string, ownerPhone?: string) {
  switch (block.type) {
    case 'hero': return <HeroBlock key={block.id} block={block} primary={primary} />
    case 'search': return <SearchBlock key={block.id} block={block} primary={primary} />
    case 'listings': return <ListingsBlock key={block.id} block={block} primary={primary} ownerName={ownerName} ownerPhone={ownerPhone} />
    case 'blog': return <BlogBlock key={block.id} block={block} primary={primary} ownerName={ownerName} />
    case 'services': return <ServicesBlock key={block.id} block={block} primary={primary} />
    case 'about': return <AboutBlock key={block.id} block={block} primary={primary} />
    case 'team': return <TeamBlock key={block.id} block={block} primary={primary} ownerPhone={ownerPhone} />
    case 'stats': return <StatsBlock key={block.id} block={block} primary={primary} />
    case 'gallery': return <GalleryBlock key={block.id} block={block} primary={primary} />
    case 'testimonials': return <TestimonialsBlock key={block.id} block={block} primary={primary} />
    case 'cta': return <CtaBlock key={block.id} block={block} primary={primary} />
    case 'contact': return <ContactBlock key={block.id} block={block} primary={primary} />
    case 'footer': return <FooterBlock key={block.id} block={block} primary={primary} />
    default:
      return (
        <section key={block.id} style={{ background: '#fff', padding: '32px 24px', direction: 'rtl' }}>
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

function SiteNav({ site, primary, currentSlug }: { site: Site; primary: string; currentSlug: string }) {
  const items = menuPages(site)
  return (
    <nav style={{ background: 'rgba(255,255,255,.88)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #f0ebe1', padding: '0 clamp(16px,4vw,24px)', direction: 'rtl', position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 18, minHeight: 64, flexWrap: 'wrap' }}>
        <a href={`/${site.slug}`} style={{ fontSize: 19, fontWeight: 900, color: INK, textDecoration: 'none', marginLeft: 'auto', letterSpacing: '-0.4px' }}>{site.title}</a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {items.map(it => {
            const href = it.home ? `/${site.slug}` : `/${site.slug}/${it.slug}`
            const active = it.slug === currentSlug
            return (
              <a key={it.slug} href={href} className="mjs-navlink" style={{
                fontSize: 14, fontWeight: active ? 800 : 600, textDecoration: 'none',
                color: active ? '#fff' : '#4a4338',
                background: active ? primary : 'transparent',
                padding: '9px 16px', borderRadius: 10,
              }}>{it.label}</a>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

// Shared full-site shell: nav + the given page's blocks. Used by both the home
// route and the [page] sub-route so there's a single source of truth.
export function SiteShell({ site, page }: { site: Site; page: SitePage }) {
  const primary = site.theme?.primary || '#c9a84c'
  return (
    <main style={{ minHeight: '100vh', background: '#fff', fontFamily: 'Vazirmatn, Tahoma, sans-serif' }}>
      <style>{`
        .mjs-card{transition:transform .22s ease, box-shadow .22s ease}
        .mjs-card:hover{transform:translateY(-5px);box-shadow:0 22px 50px -24px rgba(20,16,10,.55),0 6px 16px -8px rgba(20,16,10,.18)}
        .mjs-btn{transition:transform .18s ease, box-shadow .18s ease, opacity .18s ease}
        .mjs-btn:hover{transform:translateY(-2px);opacity:.94}
        .mjs-navlink{transition:background .18s ease, color .18s ease}
        .mjs-navlink:hover{background:${primary}1f;color:${primary}}
        .mjs-flink{transition:color .18s ease, padding .18s ease}
        .mjs-flink:hover{color:${primary};padding-right:5px}
        .mjs-gallery-img{transition:transform .25s ease}
        .mjs-gallery-img:hover{transform:scale(1.03)}
        @media(max-width:680px){
          .mjs-grid-3,.mjs-grid-4{grid-template-columns:1fr !important}
          .mjs-search-row{flex-direction:column !important}
          .mjs-contact-fields{grid-template-columns:1fr !important}
          .mjs-about{flex-direction:column !important}
        }
      `}</style>
      {menuPages(site).length > 1 && <SiteNav site={site} primary={primary} currentSlug={page.slug} />}
      {page.blocks.map(block => renderBlock(block, primary, site.ownerName, site.owner))}
    </main>
  )
}

export default async function PublishedSitePage(
  { params }: { params: Promise<{ site: string }> }
) {
  const { site: slug } = await params
  const site: Site | null = getSite(slug)
  if (!site) notFound()

  const home = getSitePage(site, 'home')
  return <SiteShell site={site} page={home} />
}
