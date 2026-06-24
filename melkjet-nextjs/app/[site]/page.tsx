import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getSite, type Site, type SiteBlock } from '@/app/lib/sites-store'

// Public renderer for builder-published sites living at melkjet.com/{slug}.
// Existing static single-segment routes (search, owner, ...) take precedence;
// this dynamic segment only catches unknown single-segment paths.
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
    title: site.seo.title || site.title,
    description: site.seo.description || undefined,
  }
}

// Helper: read a prop with fallback.
function p(block: SiteBlock): Record<string, any> {
  return (block.props || {}) as Record<string, any>
}

function HeroBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  const align = props.align === 'right' ? 'right' : 'center'
  return (
    <section id="hero" style={{ background: props.bg || 'linear-gradient(140deg,#1a1510,#2d2215,#1a1510)', padding: '80px 24px', textAlign: align as any, direction: 'rtl' }}>
      <h1 style={{ fontSize: 36, fontWeight: 900, color: props.textColor || '#fff', marginBottom: 16, letterSpacing: '-0.5px', maxWidth: 900, margin: align === 'center' ? '0 auto 16px' : '0 0 16px' }}>{props.heading}</h1>
      <p style={{ fontSize: 16, color: props.textColor || '#fff', opacity: 0.6, marginBottom: 28, maxWidth: 700, margin: align === 'center' ? '0 auto 28px' : '0 0 28px' }}>{props.subheading}</p>
      {props.buttonText ? <a href={props.buttonLink || '#'} style={{ display: 'inline-block', padding: '13px 32px', background: primary, borderRadius: 10, fontSize: 15, fontWeight: 700, color: '#fff', textDecoration: 'none' }}>{props.buttonText}</a> : null}
    </section>
  )
}

function SearchBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  return (
    <section style={{ background: '#f5f3ef', padding: '40px 24px', direction: 'rtl' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {props.heading ? <h2 style={{ fontSize: 20, fontWeight: 700, color: '#2a2215', marginBottom: 18 }}>{props.heading}</h2> : null}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, height: 50, background: '#fff', border: '1px solid #ddd', borderRadius: 10, display: 'flex', alignItems: 'center', padding: '0 18px', color: '#aaa', fontSize: 15 }}>{props.placeholder}</div>
          <div style={{ padding: '0 30px', height: 50, background: primary, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff' }}>جستجو</div>
        </div>
      </div>
    </section>
  )
}

function ListingsBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  const n = Math.max(1, Math.min(12, Number(props.count) || 3))
  const grads = ['#2d2215,#1e1a12', '#1e2215,#141a10', '#15202d,#101828', '#251528,#1a0e1e', '#152825,#0e1a18', '#2d1515,#1e0e0e']
  return (
    <section id="listings" style={{ background: '#fff', padding: '56px 24px', direction: 'rtl' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: '#1a1510', marginBottom: 8 }}>{props.heading}</h2>
        {props.source === 'mine' ? <p style={{ fontSize: 13, color: primary, marginBottom: 18 }}>این بخش آگهی‌های ثبت‌شدهٔ شما را نمایش می‌دهد.</p> : <div style={{ marginBottom: 18 }} />}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 18 }}>
          {Array.from({ length: n }).map((_, i) => (
            <div key={i} style={{ background: '#f5f3ef', borderRadius: 14, overflow: 'hidden', border: '1px solid #eee' }}>
              <div style={{ height: 150, background: `linear-gradient(135deg,${grads[i % grads.length]})` }} />
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1510', marginBottom: 6 }}>آپارتمان لوکس</div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>تهران، منطقه نمونه</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: primary }}>قیمت توافقی</div>
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
    <section style={{ background: '#faf9f7', padding: '56px 24px', direction: 'rtl' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: '#1a1510', marginBottom: 28, textAlign: 'center' }}>{props.heading}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 18 }}>
          {items.map((s, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 14, padding: '28px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12, color: primary }}>{s.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1510', marginBottom: 8 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: '#888', lineHeight: 1.8 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function AboutBlock({ block }: { block: SiteBlock }) {
  const props = p(block)
  return (
    <section id="about" style={{ background: '#fff', padding: '56px 24px', direction: 'rtl' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px' }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: '#1a1510', marginBottom: 18 }}>{props.heading}</h2>
          <p style={{ fontSize: 15, lineHeight: 2, color: '#555', margin: 0 }}>{props.text}</p>
        </div>
        {props.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.image} alt="" style={{ flex: '0 0 320px', width: 320, maxWidth: '100%', height: 230, objectFit: 'cover', borderRadius: 16 }} />
        ) : (
          <div style={{ flex: '0 0 320px', width: 320, maxWidth: '100%', height: 230, background: 'linear-gradient(135deg,#2d2215,#1a1510)', borderRadius: 16 }} />
        )}
      </div>
    </section>
  )
}

function StatsBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  const items: any[] = Array.isArray(props.items) ? props.items : []
  return (
    <section style={{ background: '#f5f3ef', padding: '56px 24px', direction: 'rtl' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 18 }}>
        {items.map((s, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 14, padding: '24px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: primary, marginBottom: 6 }}>{s.value}</div>
            <div style={{ fontSize: 13, color: '#888' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function GalleryBlock({ block }: { block: SiteBlock }) {
  const props = p(block)
  const imgs: string[] = Array.isArray(props.images) ? props.images.filter(Boolean) : []
  return (
    <section style={{ background: '#fff', padding: '56px 24px', direction: 'rtl' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: '#1a1510', marginBottom: 24 }}>{props.heading}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14 }}>
          {(imgs.length ? imgs : ['', '', '', '']).map((src, i) => src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 12 }} />
          ) : (
            <div key={i} style={{ height: 160, background: 'linear-gradient(135deg,#2d2215,#1a1510)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 28, color: 'rgba(255,255,255,0.18)' }}>▥</span>
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
    <section style={{ background: '#faf9f7', padding: '56px 24px', direction: 'rtl' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: '#1a1510', marginBottom: 28, textAlign: 'center' }}>{props.heading}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18 }}>
          {items.map((s, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 14, padding: 22 }}>
              <div style={{ color: primary, marginBottom: 12, fontSize: 16 }}>{'★'.repeat(Math.max(0, Math.min(5, Number(s.rating) || 5)))}</div>
              <p style={{ fontSize: 14, lineHeight: 1.9, color: '#555', marginBottom: 14 }}>{s.text}</p>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1510' }}>{s.name}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CtaBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  return (
    <section style={{ background: props.bg || 'linear-gradient(135deg,#2d2215,#1a1510)', padding: '64px 24px', textAlign: 'center', direction: 'rtl' }}>
      <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 10 }}>{props.heading}</h2>
      <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', marginBottom: 28 }}>{props.subheading}</p>
      {props.buttonText ? <a href={props.buttonLink || '#'} style={{ display: 'inline-block', padding: '13px 34px', background: primary, borderRadius: 10, fontSize: 15, fontWeight: 700, color: '#fff', textDecoration: 'none' }}>{props.buttonText}</a> : null}
    </section>
  )
}

function ContactBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  return (
    <section id="contact" style={{ background: '#fff', padding: '56px 24px', direction: 'rtl' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: '#1a1510', marginBottom: 22 }}>{props.heading}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
          {props.phone ? <div style={{ fontSize: 15, color: '#555' }}>☏ {props.phone}</div> : null}
          {props.email ? <div style={{ fontSize: 15, color: '#555', direction: 'ltr', textAlign: 'right' }}>✉ {props.email}</div> : null}
          {props.address ? <div style={{ fontSize: 15, color: '#555' }}>⌂ {props.address}</div> : null}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <input placeholder="نام" style={{ height: 44, background: '#f5f3ef', border: '1px solid #ddd', borderRadius: 9, padding: '0 14px', fontSize: 14 }} />
          <input placeholder="شماره تماس" style={{ height: 44, background: '#f5f3ef', border: '1px solid #ddd', borderRadius: 9, padding: '0 14px', fontSize: 14 }} />
        </div>
        <textarea placeholder="پیام شما" style={{ width: '100%', minHeight: 110, background: '#f5f3ef', border: '1px solid #ddd', borderRadius: 9, padding: 14, fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }} />
        <button style={{ padding: '12px 32px', background: primary, borderRadius: 9, border: 'none', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>ارسال پیام</button>
      </div>
    </section>
  )
}

function FooterBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  const links: any[] = Array.isArray(props.links) ? props.links : []
  return (
    <footer style={{ background: '#0d0b08', padding: '48px 24px', direction: 'rtl' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 28, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: primary, marginBottom: 12 }}>{props.text}</div>
            <p style={{ fontSize: 13, color: '#777', lineHeight: 1.9 }}>همراه شما در خرید و فروش ملک.</p>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#999', marginBottom: 12 }}>لینک‌های سریع</div>
            {links.map((l, i) => (
              <a key={i} href={l.href || '#'} style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 8, textDecoration: 'none' }}>{l.label}</a>
            ))}
          </div>
        </div>
        <div style={{ borderTop: '1px solid #1a1510', paddingTop: 16, textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: '#444' }}>© ۱۴۰۴ — تمامی حقوق محفوظ است</span>
        </div>
      </div>
    </footer>
  )
}

function renderBlock(block: SiteBlock, primary: string) {
  switch (block.type) {
    case 'hero': return <HeroBlock key={block.id} block={block} primary={primary} />
    case 'search': return <SearchBlock key={block.id} block={block} primary={primary} />
    case 'listings': return <ListingsBlock key={block.id} block={block} primary={primary} />
    case 'services': return <ServicesBlock key={block.id} block={block} primary={primary} />
    case 'about': return <AboutBlock key={block.id} block={block} />
    case 'stats': return <StatsBlock key={block.id} block={block} primary={primary} />
    case 'gallery': return <GalleryBlock key={block.id} block={block} />
    case 'testimonials': return <TestimonialsBlock key={block.id} block={block} primary={primary} />
    case 'cta': return <CtaBlock key={block.id} block={block} primary={primary} />
    case 'contact': return <ContactBlock key={block.id} block={block} primary={primary} />
    case 'footer': return <FooterBlock key={block.id} block={block} primary={primary} />
    default:
      return (
        <section key={block.id} style={{ background: '#fff', padding: '32px 24px', direction: 'rtl' }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1a1510' }}>{p(block).heading || block.type}</h2>
        </section>
      )
  }
}

export default async function PublishedSitePage(
  { params }: { params: Promise<{ site: string }> }
) {
  const { site: slug } = await params
  const site: Site | null = getSite(slug)
  if (!site) notFound()

  const primary = site.theme?.primary || '#c9a84c'

  return (
    <main style={{ minHeight: '100vh', background: '#fff', fontFamily: 'Vazirmatn, Tahoma, sans-serif' }}>
      {site.blocks.map(block => renderBlock(block, primary))}
    </main>
  )
}
