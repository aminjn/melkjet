import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getSite, type Site, type SiteBlock } from '@/app/lib/sites-store'

// Public renderer for builder-published sites living at melkjet.com/{slug}.
// Existing static single-segment routes (search, owner, ...) take precedence;
// this dynamic segment only catches unknown single-segment paths.

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

function HeroBlock({ block }: { block: SiteBlock }) {
  return (
    <section style={{ background: 'linear-gradient(140deg,#1a1510,#2d2215,#1a1510)', padding: '72px 24px', textAlign: 'center', direction: 'rtl' }}>
      <h1 style={{ fontSize: 34, fontWeight: 900, color: '#fff', marginBottom: 14, letterSpacing: '-0.5px' }}>{block.heading}</h1>
      <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', marginBottom: 26 }}>مشاور املاک حرفه‌ای با بیش از ۱۰ سال تجربه</p>
      <span style={{ display: 'inline-block', padding: '12px 30px', background: 'linear-gradient(135deg,#b8922a,#c9a84c)', borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#16140f' }}>مشاهده ملک‌ها</span>
    </section>
  )
}

function SearchBlock({ block }: { block: SiteBlock }) {
  return (
    <section style={{ background: '#f5f3ef', padding: '32px 24px', direction: 'rtl' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#2a2215', marginBottom: 16 }}>{block.heading}</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, height: 48, background: '#fff', border: '1px solid #ddd', borderRadius: 10, display: 'flex', alignItems: 'center', padding: '0 16px', color: '#aaa', fontSize: 14 }}>منطقه، شهر یا محله را وارد کنید...</div>
          <div style={{ width: 110, height: 48, background: 'linear-gradient(135deg,#b8922a,#c9a84c)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#16140f' }}>جستجو</div>
        </div>
      </div>
    </section>
  )
}

function ListingsBlock({ block }: { block: SiteBlock }) {
  const cards: [string, string][] = [['#2d2215', '#1e1a12'], ['#1e2215', '#141a10'], ['#15202d', '#101828']]
  return (
    <section style={{ background: '#fff', padding: '48px 24px', direction: 'rtl' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1a1510', marginBottom: 24 }}>{block.heading}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 18 }}>
          {cards.map(([from, to], i) => (
            <div key={i} style={{ background: '#f5f3ef', borderRadius: 14, overflow: 'hidden', border: '1px solid #eee' }}>
              <div style={{ height: 150, background: `linear-gradient(135deg,${from},${to})` }} />
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1510', marginBottom: 6 }}>آپارتمان لوکس</div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>تهران، منطقه نمونه</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#c9a84c' }}>قیمت توافقی</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ServicesBlock({ block }: { block: SiteBlock }) {
  const items: [string, string][] = [['خرید ملک', '◇'], ['اجاره', '⌂'], ['مشاوره', '◈']]
  return (
    <section style={{ background: '#faf9f7', padding: '48px 24px', direction: 'rtl' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1a1510', marginBottom: 24, textAlign: 'center' }}>{block.heading}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 18 }}>
          {items.map(([s, icon]) => (
            <div key={s} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 14, padding: '28px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12, color: '#c9a84c' }}>{icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1510' }}>{s}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function AboutBlock({ block }: { block: SiteBlock }) {
  return (
    <section style={{ background: '#fff', padding: '48px 24px', direction: 'rtl' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1a1510', marginBottom: 18 }}>{block.heading}</h2>
        <p style={{ fontSize: 15, lineHeight: 2, color: '#555' }}>
          ما با سال‌ها تجربه در حوزه املاک، همراه شما در مسیر خرید، فروش و اجاره ملک هستیم. تیم حرفه‌ای ما با ارائه مشاوره تخصصی، بهترین گزینه‌ها را متناسب با نیاز شما پیشنهاد می‌دهد.
        </p>
      </div>
    </section>
  )
}

function StatsBlock(_props: { block: SiteBlock }) {
  const stats: [string, string][] = [['۵۰۰+', 'ملک فروخته'], ['۱۲', 'سال تجربه'], ['۲۰۰', 'مشتری راضی'], ['۹۸٪', 'رضایت']]
  return (
    <section style={{ background: '#f5f3ef', padding: '48px 24px', direction: 'rtl' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 18 }}>
        {stats.map(([num, lbl]) => (
          <div key={lbl} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 14, padding: '24px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#c9a84c', marginBottom: 6 }}>{num}</div>
            <div style={{ fontSize: 13, color: '#888' }}>{lbl}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function GalleryBlock({ block }: { block: SiteBlock }) {
  const tiles: [string, string][] = [['#2d2215', '#1a1510'], ['#1e2530', '#141c25'], ['#252015', '#1a1a0d'], ['#201528', '#150e1e']]
  return (
    <section style={{ background: '#fff', padding: '48px 24px', direction: 'rtl' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1a1510', marginBottom: 24 }}>{block.heading}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14 }}>
          {tiles.map(([from, to], i) => (
            <div key={i} style={{ height: 160, background: `linear-gradient(135deg,${from},${to})`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 28, color: 'rgba(255,255,255,0.18)' }}>▥</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function TestimonialsBlock({ block }: { block: SiteBlock }) {
  const items: [string, string][] = [['علی رضایی', 'خرید آپارتمان در نیاوران'], ['مریم احمدی', 'اجاره ویلا در شمال']]
  return (
    <section style={{ background: '#faf9f7', padding: '48px 24px', direction: 'rtl' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1a1510', marginBottom: 24, textAlign: 'center' }}>{block.heading}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18 }}>
          {items.map(([name, desc]) => (
            <div key={name} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 14, padding: 22 }}>
              <div style={{ fontSize: 26, color: '#c9a84c', marginBottom: 10 }}>❝</div>
              <p style={{ fontSize: 14, lineHeight: 1.9, color: '#555', marginBottom: 14 }}>تجربه‌ای عالی و حرفه‌ای داشتم. کاملاً راضی هستم و پیشنهاد می‌کنم.</p>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1510' }}>{name}</div>
              <div style={{ fontSize: 12, color: '#aaa' }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CtaBlock({ block }: { block: SiteBlock }) {
  return (
    <section style={{ background: 'linear-gradient(135deg,#2d2215,#1a1510)', padding: '56px 24px', textAlign: 'center', direction: 'rtl' }}>
      <h2 style={{ fontSize: 26, fontWeight: 800, color: '#fff', marginBottom: 10 }}>{block.heading}</h2>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 26 }}>کارشناسان ما آماده پاسخگویی هستند</p>
      <span style={{ display: 'inline-block', padding: '12px 32px', background: 'linear-gradient(135deg,#b8922a,#c9a84c)', borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#16140f' }}>تماس با ما</span>
    </section>
  )
}

function ContactBlock({ block }: { block: SiteBlock }) {
  return (
    <section style={{ background: '#fff', padding: '48px 24px', direction: 'rtl' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1a1510', marginBottom: 22 }}>{block.heading}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <input placeholder="نام" style={{ height: 44, background: '#f5f3ef', border: '1px solid #ddd', borderRadius: 9, padding: '0 14px', fontSize: 14 }} />
          <input placeholder="شماره تماس" style={{ height: 44, background: '#f5f3ef', border: '1px solid #ddd', borderRadius: 9, padding: '0 14px', fontSize: 14 }} />
        </div>
        <textarea placeholder="پیام شما" style={{ width: '100%', minHeight: 110, background: '#f5f3ef', border: '1px solid #ddd', borderRadius: 9, padding: 14, fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }} />
        <button style={{ padding: '12px 32px', background: 'linear-gradient(135deg,#b8922a,#c9a84c)', borderRadius: 9, border: 'none', fontSize: 14, fontWeight: 700, color: '#16140f', cursor: 'pointer' }}>ارسال پیام</button>
      </div>
    </section>
  )
}

function FooterBlock({ block }: { block: SiteBlock }) {
  return (
    <footer style={{ background: '#0d0b08', padding: '40px 24px', direction: 'rtl' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 28, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#c9a84c', marginBottom: 12 }}>{block.heading}</div>
            <p style={{ fontSize: 13, color: '#777', lineHeight: 1.9 }}>مشاور املاک حرفه‌ای، همراه شما در خرید و فروش ملک.</p>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#999', marginBottom: 12 }}>لینک‌های سریع</div>
            {['خانه', 'آگهی‌ها', 'درباره ما', 'تماس'].map(l => (
              <div key={l} style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>{l}</div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#999', marginBottom: 12 }}>اطلاعات تماس</div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>تهران، ایران</div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 8, direction: 'ltr', textAlign: 'right' }}>۰۲۱-۱۲۳۴۵۶۷۸</div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid #1a1510', paddingTop: 16, textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: '#444' }}>© ۱۴۰۴ — تمامی حقوق محفوظ است</span>
        </div>
      </div>
    </footer>
  )
}

function renderBlock(block: SiteBlock) {
  switch (block.type) {
    case 'hero': return <HeroBlock key={block.id} block={block} />
    case 'search': return <SearchBlock key={block.id} block={block} />
    case 'listings': return <ListingsBlock key={block.id} block={block} />
    case 'services': return <ServicesBlock key={block.id} block={block} />
    case 'about': return <AboutBlock key={block.id} block={block} />
    case 'stats': return <StatsBlock key={block.id} block={block} />
    case 'gallery': return <GalleryBlock key={block.id} block={block} />
    case 'testimonials': return <TestimonialsBlock key={block.id} block={block} />
    case 'cta': return <CtaBlock key={block.id} block={block} />
    case 'contact': return <ContactBlock key={block.id} block={block} />
    case 'footer': return <FooterBlock key={block.id} block={block} />
    default:
      return (
        <section key={block.id} style={{ background: '#fff', padding: '32px 24px', direction: 'rtl' }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1a1510' }}>{block.heading}</h2>
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

  return (
    <main style={{ minHeight: '100vh', background: '#fff', fontFamily: 'Vazirmatn, Tahoma, sans-serif' }}>
      {site.blocks.map(renderBlock)}
    </main>
  )
}
