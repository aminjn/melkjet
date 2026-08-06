// فاز ۲۵۱ب — صفحهٔ پروفایلِ وکیل با سیستمِ استایلِ خودِ ملک‌جت (inline + CSS vars).
// نکتهٔ مهم: پروژه از کلاس‌های utilityِ Tailwind استفاده نمی‌کند (کامپایل نمی‌شوند) — همه‌جا style درون‌خطی + متغیرهای CSS.
import { notFound } from 'next/navigation'
import type { CSSProperties } from 'react'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import { getLawyerProfile } from '@/app/lib/bonyad-profiles'

export const dynamic = 'force-dynamic'
const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props) {
  const slug = decodeURIComponent((await params).slug)
  const p = await getLawyerProfile(slug)
  if (!p) return { title: 'وکیل یافت نشد | ملک‌جت' }
  const desc = (p.bio[0] || `${p.name}، ${p.jobTitle}${p.city ? ` در ${p.city}` : ''}.`).slice(0, 160)
  return { title: `${p.name} — ${p.jobTitle} | ملک‌جت`, description: desc, openGraph: { title: p.name, description: desc, images: p.avatar ? [p.avatar] : [] } }
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const full = Math.round(value)
  return (
    <span aria-label={`امتیاز ${value} از ۵`} style={{ display: 'inline-flex', gap: 1, fontSize: size }}>
      {[0, 1, 2, 3, 4].map(i => <span key={i} style={{ color: i < full ? 'var(--gold)' : 'var(--line2)' }}>★</span>)}
    </span>
  )
}

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20, boxShadow: '0 2px 10px -6px rgba(0,0,0,0.25)' }
const h2: CSSProperties = { fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 14px' }

export default async function LawyerProfilePage({ params }: Props) {
  const slug = decodeURIComponent((await params).slug)
  const p = await getLawyerProfile(slug)
  if (!p) notFound()
  const ratingNum = Number(p.rating) || 0

  const ld = {
    '@context': 'https://schema.org', '@type': 'Person', name: p.name, jobTitle: p.jobTitle,
    image: p.avatar || undefined,
    address: p.city ? { '@type': 'PostalAddress', addressLocality: p.city, addressCountry: 'IR' } : undefined,
    knowsAbout: p.specialties,
    aggregateRating: p.ratingCount ? { '@type': 'AggregateRating', ratingValue: p.rating, ratingCount: p.ratingCount, bestRating: '5' } : undefined,
  }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }}>
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 20px 64px' }}>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16 }}>
          <a href="/directory" style={{ color: 'var(--muted)', textDecoration: 'none' }}>دایرکتوری متخصصان</a>
          <span style={{ margin: '0 6px', color: 'var(--faint)' }}>›</span>
          <a href="/directory?cat=حقوقی" style={{ color: 'var(--muted)', textDecoration: 'none' }}>دفاتر حقوقی و وکلا</a>
          <span style={{ margin: '0 6px', color: 'var(--faint)' }}>›</span>
          <span style={{ color: 'var(--text)' }}>{p.name}</span>
        </div>

        <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
          <div style={{ width: 96, height: 96, borderRadius: 18, flexShrink: 0, border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 30, fontWeight: 800, overflow: 'hidden', background: p.avatar ? `center/cover no-repeat url(${p.avatar})` : 'linear-gradient(135deg, var(--gold), #b8860b)' }}>{!p.avatar && p.name.slice(0, 1)}</div>

          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text)', margin: '0 0 4px' }}>{p.name}</h1>
            <div style={{ fontSize: 13.5, color: 'var(--muted)' }}>{p.jobTitle}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 10, fontSize: 13, alignItems: 'center' }}>
              {p.city && <span style={{ color: 'var(--muted)' }}>📍 {p.city}</span>}
              {p.ratingCount > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}>
                  <Stars value={ratingNum} /> <b>{fa(ratingNum)}</b>
                  <span style={{ color: 'var(--faint)' }}>({fa(p.ratingCount)} دیدگاه)</span>
                </span>
              )}
            </div>
          </div>

          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            {p.startingPrice > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--faint)' }}>شروع از</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text)' }}>{fa(p.startingPrice)} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>تومان</span></div>
              </div>
            )}
            <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', background: 'var(--gold)', color: '#241d00', fontWeight: 800, fontSize: 14, padding: '12px 26px', borderRadius: 12, textDecoration: 'none' }}>رزرو مشاوره</a>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 20, alignItems: 'flex-start' }}>
          <div style={{ flex: '2 1 380px', display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
            {p.bio.length > 0 && (
              <section style={card}>
                <h2 style={h2}>درباره من</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, color: 'var(--muted)', fontSize: 14, lineHeight: 2 }}>
                  {p.bio.map((line, i) => <p key={i} style={{ margin: 0 }}>{line}</p>)}
                </div>
              </section>
            )}
            {p.reviews.length > 0 && (
              <section style={card}>
                <h2 style={h2}>دیدگاه موکلین</h2>
                <div>
                  {p.reviews.map((r, i) => (
                    <div key={i} style={{ padding: '14px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <b style={{ color: 'var(--text)', fontSize: 13.5 }}>{r.author || 'کاربر'}</b>
                        <Stars value={r.rating} size={13} />
                      </div>
                      <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.9 }}>{r.body}</p>
                    </div>
                  ))}
                </div>
                {p.ratingCount > p.reviews.length && (
                  <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 12, fontSize: 13, color: 'var(--goldText)', fontWeight: 700, textDecoration: 'none' }}>مشاهدهٔ همهٔ {fa(p.ratingCount)} دیدگاه ←</a>
                )}
              </section>
            )}
          </div>

          <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
            {p.specialties.length > 0 && (
              <section style={card}>
                <h2 style={h2}>تخصص‌ها</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {p.specialties.map((s, i) => <span key={i} style={{ fontSize: 12.5, padding: '6px 14px', background: 'var(--goldDim)', border: '1px solid var(--gold)', borderRadius: 999, color: 'var(--goldText)', fontWeight: 700 }}>{s}</span>)}
                </div>
              </section>
            )}
            {p.stats.length > 0 && (
              <section style={card}>
                <h2 style={h2}>گزارش عملکرد</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 8 }}>
                  {p.stats.map((s, i) => (
                    <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 12, padding: '12px 6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text)' }}>{fa(s.value)}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
