import Link from 'next/link'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import { publicProject, regionLabel, phaseLabel } from '../../lib/persiansaze-store'

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

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px 60px' }}>
        {/* عکس‌ها */}
        {(p.photos && p.photos.length) ? (
          <div>
            <img src={p.photos[0]} alt={p.address || ''} style={{ width: '100%', maxHeight: 380, objectFit: 'cover', borderRadius: 16 }} />
            {p.photos.length > 1 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginTop: 8 }}>
                {p.photos.slice(1).map((ph, i) => <a key={i} href={ph} target="_blank" rel="noreferrer"><img src={ph} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 10 }} /></a>)}
              </div>
            )}
          </div>
        ) : (p.photo?.imageUrl || p.photo?.imageThumbnailUrl) ? (
          <img src={p.photo.imageUrl || p.photo.imageThumbnailUrl} alt={p.address || ''} style={{ width: '100%', maxHeight: 380, objectFit: 'cover', borderRadius: 16 }} />
        ) : null}

        <div style={{ marginTop: 18 }}>
          <h1 style={{ fontSize: 21, fontWeight: 900, margin: 0, lineHeight: 1.7 }}>{p.address || 'پروژه'}</h1>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
            {regionLabel(p)}{phaseLabel(p) ? ` · مرحله: ${phaseLabel(p)}` : ''}
            <span style={{ marginInlineStart: 12, color: 'var(--faint)' }}>کدِ پروژه: <span style={{ direction: 'ltr', display: 'inline-block' }}>{p.hashId}</span></span>
          </div>
        </div>

        {/* مشخصات */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginTop: 18 }}>
          {[
            ['متراژ زمین', `${fa(p.groundArea || 0)} م²`],
            ['زیربنا', `${fa(p.residentialArea || 0)} م²`],
            ['طبقات', fa(p.floors || 0)],
            ['واحدها', fa(p.units || 0)],
          ].map(([l, v]) => (
            <div key={l} style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{l}</div>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>{v}</div>
            </div>
          ))}
        </div>

        {p.latitude != null && p.longitude != null && (
          <a href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 14, fontSize: 13, color: 'var(--gold)', textDecoration: 'none' }}>📍 مشاهده روی نقشه</a>
        )}

        {/* سازنده */}
        <section style={{ marginTop: 26, background: 'linear-gradient(120deg, rgba(212,175,55,.1), transparent 60%), var(--surface)', border: '1px solid var(--line2)', borderRadius: 16, padding: 18, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--goldDim)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🏗</div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 11.5, color: 'var(--gold)', fontWeight: 700 }}>سازنده</div>
            <Link href={`/sazande/${encodeURIComponent(builder.id)}`} style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', textDecoration: 'none' }}>{builder.name}</Link>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{fa(builder.projectCount)} پروژه</div>
          </div>
        </section>

        {/* سایرِ پروژه‌های همین سازنده */}
        {others.length > 0 && (
          <section style={{ marginTop: 26 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 12px' }}>سایر پروژه‌های {builder.name}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {others.slice(0, 12).map(o => (
                <Link key={o.hashId} href={`/proje/${o.hashId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <article style={{ background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 12, overflow: 'hidden' }}>
                    {o.photo?.imageThumbnailUrl ? <img src={o.photo.imageThumbnailUrl} alt="" style={{ width: '100%', height: 120, objectFit: 'cover' }} /> : <div style={{ height: 120, background: 'var(--bg2)' }} />}
                    <div style={{ padding: 10, fontSize: 12, fontWeight: 600, lineHeight: 1.6, height: 50, overflow: 'hidden' }}>{o.address || '—'}</div>
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
