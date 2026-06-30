import Link from 'next/link'
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
        <main style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>سازنده پیدا نشد</main>
        <Footer />
      </>
    )
  }
  const phone = (p.phones || [])[0]

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 16px 60px' }}>
        <section style={{ background: 'linear-gradient(120deg, rgba(212,175,55,.12), transparent 60%), var(--surface)', border: '1px solid var(--line2)', borderRadius: 18, padding: '24px 22px', display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: 'var(--goldDim)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>🏗</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11.5, color: 'var(--gold)', fontWeight: 700, marginBottom: 4 }}>سازنده / انبوه‌ساز</div>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>{p.name || 'سازنده'}</h1>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>📋 {fa(p.projectCount)} پروژه</div>
          </div>
          {phone && <a href={`tel:${phone}`} style={{ background: 'var(--gold)', color: '#1a1408', fontWeight: 800, fontSize: 15, padding: '12px 22px', borderRadius: 12, textDecoration: 'none', direction: 'ltr' }}>☎ {phone}</a>}
        </section>

        <h2 style={{ fontSize: 17, fontWeight: 800, margin: '28px 0 14px' }}>پروژه‌ها</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
          {(p.projects || []).map(pr => (
            <Link key={pr.hashId} href={`/proje/${pr.hashId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <article style={{ background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 14, overflow: 'hidden', height: '100%' }}>
                {pr.photo?.imageThumbnailUrl || pr.photo?.imageUrl ? <img src={pr.photo.imageThumbnailUrl || pr.photo.imageUrl} alt="" style={{ width: '100%', height: 160, objectFit: 'cover' }} /> : <div style={{ height: 160, background: 'var(--bg2)' }} />}
                <div style={{ padding: 12 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.7, height: 42, overflow: 'hidden' }}>{pr.address || '—'}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>{regionLabel(pr)}{phaseLabel(pr) ? ` · ${phaseLabel(pr)}` : ''}</div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </>
  )
}
