import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import RevealContact from '@/app/components/RevealContact'
import RepBadges from '@/app/components/RepBadges'
import { resolveProvider, typeLabel } from '@/app/lib/provider-public'
import { gradientFor, initialsFor } from '@/app/lib/content-display'

// متایِ SSR برای صفحهٔ عمومیِ یک متخصص.
export async function providerMetadata(type: string, slug: string): Promise<Metadata> {
  const p = await resolveProvider(type, slug)
  if (!p) return { title: 'متخصص یافت نشد | ملک‌جت' }
  const url = `https://melkjet.com/${p.type}/${p.slug}`
  const title = `${p.name} — ${p.typeLabel}${p.city ? ` در ${p.city}` : ''}`
  const desc = (p.bio || `${p.name}، ${p.typeLabel}${p.city ? ` در ${p.city}` : ''} در ملک‌جت. مشاهدهٔ آگهی‌ها و اطلاعاتِ تماس.`).replace(/<[^>]+>/g, '').slice(0, 160)
  return { title: `${title} | ملک‌جت`, description: desc, alternates: { canonical: url }, openGraph: { title, description: desc, url, type: 'profile', images: p.photo ? [p.photo] : undefined } }
}

export default async function ProviderProfilePage({ type, slug }: { type: string; slug: string }) {
  const p = await resolveProvider(type, slug)
  if (!p) notFound()
  if (p.type !== type) redirect(`/${p.type}/${p.slug}`)   // canonicalِ نوعِ درست

  const ld = {
    '@context': 'https://schema.org', '@type': type === 'agency' ? 'RealEstateAgent' : 'LocalBusiness',
    name: p.name, image: p.photo || undefined, description: (p.bio || '').replace(/<[^>]+>/g, '').slice(0, 300),
    areaServed: p.city || undefined, url: `https://melkjet.com/${p.type}/${p.slug}`,
  }
  const crumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'خانه', item: 'https://melkjet.com/' },
      { '@type': 'ListItem', position: 2, name: 'متخصصان', item: 'https://melkjet.com/directory' },
      { '@type': 'ListItem', position: 3, name: p.typeLabel, item: `https://melkjet.com/directory?category=${encodeURIComponent(p.typeLabel)}` },
      { '@type': 'ListItem', position: 4, name: p.name },
    ],
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbLd) }} />
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '26px 22px 70px' }}>
        <nav aria-label="مسیر" style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: 'var(--muted)' }}>خانه</Link><span>›</span>
          <Link href="/directory" style={{ color: 'var(--muted)' }}>متخصصان</Link><span>›</span>
          <span style={{ color: 'var(--gold)' }}>{p.typeLabel}</span>
        </nav>

        {/* هدر */}
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 22, marginBottom: 22 }}>
          {p.photo
            ? <img src={p.photo} alt={p.name} style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--gold)', flexShrink: 0 }} />
            : <div style={{ width: 88, height: 88, borderRadius: '50%', background: gradientFor(p.name, 'avatar'), border: '2px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 800, flexShrink: 0 }}>{initialsFor(p.name)}</div>}
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ fontSize: 'clamp(20px,3vw,28px)', fontWeight: 900, margin: '0 0 6px' }}>{p.name}</h1>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: 'var(--muted)' }}>
              <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{p.typeLabel}</span>
              {p.city && <><span style={{ color: 'var(--faint)' }}>·</span><span>{p.city}</span></>}
            </div>
            {p.badges.length > 0 && <div style={{ marginTop: 10 }}><RepBadges badges={p.badges} /></div>}
          </div>
          {p.hasPhone && <div style={{ flexShrink: 0 }}><RevealContact kind="advisor" id={p.phone} compact label="نمایشِ شماره" /></div>}
        </div>

        {p.bio && <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20, marginBottom: 22, fontSize: 14.5, lineHeight: 2, color: 'var(--text)' }} dangerouslySetInnerHTML={{ __html: /<\/?[a-z]/i.test(p.bio) ? p.bio : p.bio.replace(/\n/g, '<br/>') }} />}

        {p.specialties.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>تخصص‌ها</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{p.specialties.map((s, i) => <span key={i} style={{ fontSize: 12.5, padding: '5px 12px', background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 999, color: 'var(--muted)' }}>{s}</span>)}</div>
          </div>
        )}

        {p.listings.length > 0 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>آگهی‌های {p.name}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
              {p.listings.map(it => (
                <Link key={it.id} href={`/property/${it.id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 13, overflow: 'hidden' }}>
                  <div style={{ height: 130, background: it.image ? `center/cover no-repeat url(${it.image})` : gradientFor(it.title) }} />
                  <div style={{ padding: '11px 13px' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)' }}>{it.price || '—'}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
                    {it.location && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{it.location}</div>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
