import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import { publicProject, regionLabel } from '@/app/lib/persiansaze-store'
import { hashForProjectSlug, ensureProjectSlug } from '@/app/lib/project-slug-store'
import { gradientFor } from '@/app/lib/content-display'

export const dynamic = 'force-dynamic'
const projName = (p: any, b: any) => (p.address || p.receptor || b?.name || 'پروژهٔ ساختمانی').trim()

async function load(slug: string) {
  const hash = await hashForProjectSlug(slug)
  if (!hash) return null
  const r = publicProject(hash)
  if (!r) return null
  return { hash, ...r }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const r = await load(slug)
  if (!r) return { title: 'پروژه یافت نشد | ملک‌جت' }
  const name = projName(r.project, r.builder)
  const region = regionLabel(r.project)
  const title = `پروژهٔ ${name}${region ? ` — ${region}` : ''}`
  const url = `https://melkjet.com/projects/${slug}`
  return { title: `${title} | ملک‌جت`, description: `${title}؛ ${r.project.floors ? `${r.project.floors} طبقه، ` : ''}${r.project.units ? `${r.project.units} واحد، ` : ''}سازنده ${r.builder?.name || '—'}. اطلاعات و واحدهای پروژه در ملک‌جت.`, alternates: { canonical: url }, openGraph: { title, url, images: r.project.photo?.imageUrl ? [r.project.photo.imageUrl] : undefined } }
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const r = await load(slug)
  if (!r) notFound()
  const { project: p, builder: b, others } = r
  const name = projName(p, b)
  const region = regionLabel(p)
  const photo = p.photo?.imageUrl || p.photo?.imageThumbnailUrl || ''
  const facts: [string, string | number | undefined][] = [['منطقه', region], ['طبقات', p.floors], ['واحدها', p.units], ['متراژِ زمین', p.groundArea], ['فاز', p.phaseName]]

  const ld = {
    '@context': 'https://schema.org', '@type': 'ApartmentComplex', name,
    image: photo || undefined, address: region || undefined, numberOfAccommodationUnits: p.units || undefined,
    url: `https://melkjet.com/projects/${slug}`,
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '26px 22px 70px' }}>
        <nav aria-label="مسیر" style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: 'var(--muted)' }}>خانه</Link><span>›</span>
          <Link href="/projects" style={{ color: 'var(--muted)' }}>پروژه‌ها</Link><span>›</span>
          <span style={{ color: 'var(--gold)' }}>{name}</span>
        </nav>
        <div style={{ height: 260, borderRadius: 18, background: photo ? `center/cover no-repeat url(${photo})` : gradientFor(name), border: '1px solid var(--line)', marginBottom: 20 }} />
        <h1 style={{ fontSize: 'clamp(22px,4vw,32px)', fontWeight: 900, margin: '0 0 6px' }}>پروژهٔ {name}</h1>
        {b?.name && <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 18px' }}>سازنده: <Link href={`/sazande/${encodeURIComponent(b.id)}`} style={{ color: 'var(--gold)', fontWeight: 700 }}>{b.name}</Link></p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 24 }}>
          {facts.filter(([, v]) => v !== undefined && v !== '' && v !== 0).map(([k, v]) => (
            <div key={k} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '13px 15px' }}>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{k}</div>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 3 }}>{typeof v === 'number' ? v.toLocaleString('fa-IR') : v}</div>
            </div>
          ))}
        </div>

        {others && others.length > 0 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>سایرِ پروژه‌های {b?.name || 'این سازنده'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
              {await Promise.all(others.slice(0, 6).map(async (o) => {
                const os = await ensureProjectSlug(o.hashId, (o.address || o.receptor || 'پروژه'))
                return (
                  <Link key={o.hashId} href={`/projects/${os}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ height: 120, background: (o.photo?.imageThumbnailUrl || o.photo?.imageUrl) ? `center/cover no-repeat url(${o.photo?.imageThumbnailUrl || o.photo?.imageUrl})` : gradientFor(o.address || o.hashId) }} />
                    <div style={{ padding: '11px 13px', fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.address || o.receptor || 'پروژه'}</div>
                  </Link>
                )
              }))}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
