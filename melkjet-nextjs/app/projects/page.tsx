import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import { publicQuery, regionLabel } from '@/app/lib/persiansaze-store'
import { ensureProjectSlug } from '@/app/lib/project-slug-store'
import { gradientFor } from '@/app/lib/content-display'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'پروژه‌های ساختمانی و پیش‌فروش | ملک‌جت',
  description: 'جدیدترین پروژه‌های ساختمانی، انبوه‌سازی و پیش‌فروشِ املاک در سراسرِ ایران — با اطلاعاتِ سازنده، طبقات و واحدها.',
  alternates: { canonical: 'https://melkjet.com/projects' },
}

export default async function ProjectsHub() {
  let items: any[] = []
  try { items = publicQuery({ withPhoto: true, pageSize: 36 }).items || [] } catch {}
  const cards = await Promise.all(items.map(async (p) => ({ ...p, slug: await ensureProjectSlug(p.hashId, p.address || p.builderName || 'پروژه'), region: regionLabel(p) })))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Nav />
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '26px 22px 70px' }}>
        <nav aria-label="مسیر" style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14, display: 'flex', gap: 6 }}>
          <Link href="/" style={{ color: 'var(--muted)' }}>خانه</Link><span>›</span><span style={{ color: 'var(--gold)' }}>پروژه‌ها</span>
        </nav>
        <h1 style={{ fontSize: 'clamp(23px,4vw,34px)', fontWeight: 900, margin: '0 0 6px' }}>پروژه‌های ساختمانی و پیش‌فروش</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 22px' }}>پروژه‌های انبوه‌سازی و پیش‌فروشِ املاک در سراسرِ ایران.</p>
        {cards.length === 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px dashed var(--line2)', borderRadius: 16, padding: 40, textAlign: 'center', color: 'var(--muted)' }}>پروژه‌ای برای نمایش نیست.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 16 }}>
            {cards.map(p => (
              <Link key={p.hashId} href={`/projects/${p.slug}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ height: 160, background: (p.photo?.imageThumbnailUrl || p.photo?.imageUrl) ? `center/cover no-repeat url(${p.photo?.imageThumbnailUrl || p.photo?.imageUrl})` : gradientFor(p.address || p.hashId) }} />
                <div style={{ padding: '13px 15px' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address || p.builderName || 'پروژه'}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{[p.region, p.floors ? `${p.floors} طبقه` : '', p.units ? `${p.units} واحد` : ''].filter(Boolean).join(' · ')}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
        <p style={{ marginTop: 24, fontSize: 13, color: 'var(--muted)' }}>مرور بر اساسِ سازنده؟ <Link href="/sazandeha" style={{ color: 'var(--gold)', fontWeight: 700 }}>فهرستِ سازندگان ←</Link></p>
      </div>
      <Footer />
    </div>
  )
}
