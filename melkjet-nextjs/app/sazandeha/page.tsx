import Link from 'next/link'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import { publicProjectsByRegion } from '../lib/persiansaze-store'

export const dynamic = 'force-dynamic'
const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')

export default function Sazandeha() {
  const regions = publicProjectsByRegion()
  const total = regions.reduce((s, r) => s + r.count, 0)

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 60px' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>سازنده‌ها و پروژه‌های ساختمانی</h1>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>{fa(total)} پروژه به تفکیکِ منطقه</div>
        </div>

        {regions.length === 0 ? (
          <div style={{ color: 'var(--faint)', padding: '24px 0' }}>هنوز پروژه‌ای ثبت نشده است.</div>
        ) : regions.map(r => (
          <section key={r.region} style={{ marginBottom: 30 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📍 {r.region}</span>
              <span style={{ fontSize: 12, color: 'var(--faint)', fontWeight: 600 }}>{fa(r.count)} پروژه</span>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14 }}>
              {r.projects.map(p => (
                <Link key={p.hashId} href={`/proje/${p.hashId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <article style={{ background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 14, overflow: 'hidden', height: '100%' }}>
                    {p.photo?.imageThumbnailUrl || p.photo?.imageUrl ? (
                      <img src={p.photo.imageThumbnailUrl || p.photo.imageUrl} alt="" style={{ width: '100%', height: 150, objectFit: 'cover' }} />
                    ) : <div style={{ width: '100%', height: 150, background: 'var(--bg2)' }} />}
                    <div style={{ padding: 12 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.7, height: 42, overflow: 'hidden' }}>{p.address || '—'}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--gold)', marginTop: 6, fontWeight: 700 }}>🏗 {p.builderName}</div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
      <Footer />
    </>
  )
}
