import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import { getProfile, regionLabel, phaseLabel } from '../../lib/persiansaze-store'

export const dynamic = 'force-dynamic'

const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')

export default async function SazandeProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const p = getProfile(id)

  if (!p) {
    return (
      <>
        <Nav />
        <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🏗</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>این سازنده پیدا نشد</div>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  const phone = (p.phones || [])[0]
  const projects = p.projects || []

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 16px 60px' }}>
        {/* هدرِ پروفایل */}
        <section style={{ background: 'linear-gradient(120deg, rgba(212,175,55,.12), transparent 60%), var(--surface)', border: '1px solid var(--line2)', borderRadius: 18, padding: '24px 22px', display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: 'var(--goldDim)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, flexShrink: 0 }}>🏗</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11.5, color: 'var(--gold)', fontWeight: 700, marginBottom: 4 }}>سازنده / انبوه‌ساز</div>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>{p.name || 'سازنده'}</h1>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span>📋 {fa(p.projectCount)} پروژه</span>
              {(p.regions || []).length > 0 && <span>📍 {(p.regions || []).slice(0, 5).map(r => (r > 100 && r < 123) ? `منطقه ${r - 100}` : `م${r}`).join('، ')}</span>}
            </div>
          </div>
          {phone && (
            <a href={`tel:${phone}`} style={{ background: 'var(--gold)', color: '#1a1408', fontWeight: 800, fontSize: 15, padding: '12px 22px', borderRadius: 12, textDecoration: 'none', direction: 'ltr' }}>
              ☎ {phone}
            </a>
          )}
        </section>

        {/* پروژه‌ها */}
        <h2 style={{ fontSize: 17, fontWeight: 800, margin: '28px 0 14px' }}>پروژه‌های این سازنده</h2>
        {projects.length === 0 ? (
          <div style={{ color: 'var(--faint)', padding: '20px 0' }}>پروژه‌ای ثبت نشده است.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {projects.map(pr => (
              <article key={pr.hashId} style={{ background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {pr.photo?.imageUrl || pr.photo?.imageThumbnailUrl ? (
                  <img src={pr.photo.imageUrl || pr.photo.imageThumbnailUrl} alt={pr.address || ''} style={{ width: '100%', height: 170, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: 170, background: 'var(--bg2)' }} />
                )}
                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.7 }}>{pr.address || '—'}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{regionLabel(pr)}{phaseLabel(pr) ? ` · ${phaseLabel(pr)}` : ''}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.9, marginTop: 'auto' }}>
                    متراژ {fa(pr.groundArea || 0)} / زیربنا {fa(pr.residentialArea || 0)} م²<br />
                    {fa(pr.floors || 0)} طبقه · {fa(pr.units || 0)} واحد
                  </div>
                  {pr.latitude != null && pr.longitude != null && (
                    <a href={`https://www.google.com/maps?q=${pr.latitude},${pr.longitude}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none' }}>📍 مشاهده روی نقشه</a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
