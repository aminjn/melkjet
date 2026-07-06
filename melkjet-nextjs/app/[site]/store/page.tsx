import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSite } from '@/app/lib/sites-store'
import { shopProductsOf } from '@/app/lib/materials-store'
import { SiteChrome } from '../page'

export const dynamic = 'force-dynamic'
const MAIN = 'https://melkjet.com'
const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')
const money = (t: number) => t >= 1e9 ? `${fa(Math.round(t / 1e8) / 10)} میلیارد` : t >= 1e6 ? `${fa(Math.round(t / 1e5) / 10)} میلیون` : fa(t)

async function load(siteSlug: string) {
  const site = await getSite(siteSlug); if (!site) return null
  const shop = site.owner ? await shopProductsOf(site.owner) : null
  return { site, shop }
}

export async function generateMetadata({ params }: { params: Promise<{ site: string }> }): Promise<Metadata> {
  const { site: siteSlug } = await params
  const r = await load(siteSlug)
  if (!r) return { title: 'فروشگاه یافت نشد' }
  return {
    title: `فروشگاه | ${r.site.seo?.title || r.site.title}`,
    alternates: r.shop?.slug ? { canonical: `${MAIN}/store/${r.shop.slug}` } : undefined,   // مرجع = استورفرانتِ اصلی
  }
}

export default async function InSiteStore({ params }: { params: Promise<{ site: string }> }) {
  const { site: siteSlug } = await params
  const r = await load(siteSlug)
  if (!r) notFound()
  const products = r.shop?.products || []
  return (
    <SiteChrome site={r.site} appendFooter>
      <section style={{ direction: 'rtl', maxWidth: 1120, margin: '0 auto', padding: 'clamp(20px,4vw,44px) clamp(16px,4vw,22px) 64px' }}>
        <nav style={{ fontSize: 13, color: 'var(--mjs-muted)', marginBottom: 14, display: 'flex', gap: 6 }}>
          <a href={`/${r.site.slug}`} style={{ color: 'var(--mjs-muted)', textDecoration: 'none' }}>خانه</a><span>›</span>
          <span style={{ color: 'var(--mjs-primary)', fontWeight: 700 }}>فروشگاه</span>
        </nav>
        <h1 style={{ fontSize: 'clamp(22px,4vw,32px)', fontWeight: 900, color: 'var(--mjs-heading)', margin: '0 0 20px' }}>محصولات</h1>
        {products.length === 0 ? (
          <div style={{ background: 'var(--mjs-surface)', border: '1px dashed rgba(0,0,0,0.12)', borderRadius: 16, padding: 44, textAlign: 'center', color: 'var(--mjs-muted)' }}>محصولی برای نمایش نیست.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 18 }}>
            {products.map(pr => {
              const price = Math.round(pr.price * (1 - (pr.discountPct || 0) / 100))
              const img = pr.images?.[0]
              return (
                <div key={pr.id} style={{ background: 'var(--mjs-surface)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ position: 'relative', height: 150, background: img ? `center/cover no-repeat url(${img})` : 'linear-gradient(135deg,var(--mjs-surface),var(--mjs-bg))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, color: 'var(--mjs-primary)' }}>
                    {!img && '🧱'}
                    {pr.discountPct ? <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10.5, fontWeight: 800, color: '#fff', background: '#dc2626', borderRadius: 6, padding: '2px 8px' }}>٪{pr.discountPct.toLocaleString('fa-IR')} تخفیف</span> : null}
                  </div>
                  <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--mjs-heading)', lineHeight: 1.6 }}>{pr.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--mjs-muted)' }}>{[pr.brand, pr.category].filter(Boolean).join(' · ')}</div>
                    {pr.stock > 0 ? <div style={{ fontSize: 10.5, color: '#16a34a' }}>✓ موجود{pr.stock ? ` (${pr.stock.toLocaleString('fa-IR')} ${pr.unit})` : ''}</div> : <div style={{ fontSize: 10.5, color: '#dc2626' }}>ناموجود</div>}
                    <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      {pr.discountPct ? <span style={{ fontSize: 11, color: 'var(--mjs-muted)', textDecoration: 'line-through' }}>{money(pr.price)}</span> : null}
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--mjs-primary)' }}>{money(price)}</span>
                      <span style={{ fontSize: 11, color: 'var(--mjs-muted)' }}>تومان/{pr.unit}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </SiteChrome>
  )
}
