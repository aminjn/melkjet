import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import Link from 'next/link'
import { TOOL_LANDINGS } from '@/app/lib/tool-landings'

// فاز ۲۹۸د — فهرستِ همهٔ ابزارهای کسب‌وکارِ ملک‌جت (صفحهٔ عمومیِ لندینگ).
export const revalidate = 3600
export const metadata = {
  title: 'ابزارهای کسب‌وکارِ ملک‌جت',
  description: 'میز کارِ سازنده، CRMِ مشاوران، پنلِ آژانس، مارکتینگ، بازارِ مصالح و سایت‌سازِ اختصاصی — همه در یک اکوسیستم.',
  alternates: { canonical: 'https://melkjet.com/features' },
}

export default function FeaturesIndex() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Nav />
      <section style={{ padding: 'clamp(44px,7vw,80px) clamp(16px,5vw,24px) clamp(20px,3vw,32px)', direction: 'rtl', textAlign: 'center' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 16px', borderRadius: 999, background: '#c9a84c1f', border: '1px solid var(--line)', color: 'var(--gold)', fontSize: 13, fontWeight: 800, marginBottom: 20 }}>✦ ابزارهای کسب‌وکار</div>
          <h1 style={{ fontSize: 'clamp(28px,5vw,46px)', fontWeight: 900, margin: '0 0 16px', color: 'var(--text)' }}>هرچه برای رشدِ کسب‌وکارِ ملکی‌ات لازم داری</h1>
          <p style={{ fontSize: 'clamp(15px,2vw,18px)', color: 'var(--muted)', lineHeight: 1.9, margin: 0 }}>از مدیریتِ پروژه و سرنخ تا سایتِ اختصاصی و بازاریابی — همه در یک جا، داده‌محور و بومیِ ایران.</p>
        </div>
      </section>
      <section style={{ padding: '0 clamp(16px,5vw,24px) clamp(48px,7vw,80px)', direction: 'rtl' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20 }}>
          {TOOL_LANDINGS.map(t => (
            <Link key={t.id} href={`/features/${t.id}`} style={{ display: 'block', textDecoration: 'none', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: '28px 26px', position: 'relative', overflow: 'hidden' }}>
              <div aria-hidden style={{ position: 'absolute', insetInlineEnd: -40, top: -40, width: 150, height: 150, borderRadius: '50%', background: `radial-gradient(circle, ${t.accent}22, transparent 70%)` }} />
              <div style={{ position: 'relative' }}>
                <div style={{ width: 54, height: 54, borderRadius: 15, background: `${t.accent}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 16 }}>{t.glyph}</div>
                <h2 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 8px', color: 'var(--text)' }}>{t.name}</h2>
                <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.85, margin: '0 0 16px' }}>{t.tagline}</p>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: t.accent, fontWeight: 800, fontSize: 14 }}>بیشتر بدان <span>←</span></span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  )
}
