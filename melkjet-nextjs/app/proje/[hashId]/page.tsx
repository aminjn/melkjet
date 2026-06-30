import Link from 'next/link'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import { publicProject, regionLabel, phaseLabel } from '../../lib/persiansaze-store'
import ProjectClient from './ProjectClient'

export const dynamic = 'force-dynamic'
const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')

export default async function ProjectPage({ params }: { params: Promise<{ hashId: string }> }) {
  const { hashId } = await params
  const data = publicProject(hashId)

  if (!data) {
    return (
      <>
        <Nav />
        <main style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>پروژه پیدا نشد</main>
        <Footer />
      </>
    )
  }
  const { project: p, builder, others } = data

  // همهٔ عکس‌ها: از reveal جمع‌شده (photos) یا عکسِ لیست.
  const photos: string[] = (p.photos && p.photos.length) ? p.photos : (p.photo?.imageUrl ? [p.photo.imageUrl] : (p.photo?.imageThumbnailUrl ? [p.photo.imageThumbnailUrl] : []))
  const region = regionLabel(p)
  const phone = (builder.phones || [])[0]

  const specs: [string, string][] = [
    ['متراژ زمین', `${fa(p.groundArea || 0)} م²`],
    ['زیربنا', `${fa(p.residentialArea || 0)} م²`],
    ['طبقات', fa(p.floors || 0)],
    ['واحدها', fa(p.units || 0)],
  ]

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px 60px' }}>
        {/* عنوان */}
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, lineHeight: 1.7 }}>{p.address || 'پروژه'}</h1>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>📍 {region}</span>
            {phaseLabel(p) && <span>🏗 مرحله: {phaseLabel(p)}</span>}
            <span style={{ color: 'var(--faint)' }}>کدِ پروژه: <span style={{ direction: 'ltr', display: 'inline-block' }}>{p.hashId}</span></span>
          </div>
        </div>

        {/* مشخصات */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 18 }}>
          {specs.map(([l, v]) => (
            <div key={l} style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{l}</div>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* بخش‌های تعاملی: گالری، نقشه، دسترسی‌ها (AI)، تماس با سازنده */}
        <ProjectClient
          hashId={p.hashId}
          photos={photos}
          address={p.address || ''}
          region={region}
          lat={p.latitude ?? null}
          lng={p.longitude ?? null}
          builder={{ id: builder.id, name: builder.name, phone, projectCount: builder.projectCount }}
        />

        {/* سایرِ پروژه‌های همین سازنده */}
        {others.length > 0 && (
          <section style={{ marginTop: 30 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 12px' }}>سایر پروژه‌های {builder.name}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
              {others.slice(0, 12).map(o => (
                <Link key={o.hashId} href={`/proje/${o.hashId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <article style={{ background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 12, overflow: 'hidden' }}>
                    {o.photo?.imageThumbnailUrl ? <img src={o.photo.imageThumbnailUrl} alt="" loading="lazy" style={{ width: '100%', height: 120, objectFit: 'cover' }} /> : <div style={{ height: 120, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--faint)' }}>🏗</div>}
                    <div style={{ padding: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.6, height: 42, overflow: 'hidden' }}>{o.address || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>{regionLabel(o)}</div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  )
}
