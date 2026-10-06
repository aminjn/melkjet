// ── هدرِ سینماییِ صفحات (ری‌برندِ ۲۹۸ی۷) ─────────────────────────────────────
// بندِ تیرهٔ طلاییِ هم‌خانوادهٔ هیروی صفحهٔ اصلی — روی صفحاتِ داخلی (جستجو، دایرکتوری،
// سازنده‌ها، …) زیرِ <Nav/>. همیشه‌تیره (استثنای عمدی مثلِ هیرو)؛ بدنهٔ صفحه زیرِ آن
// تم‌آگاه و تمیز می‌ماند. گرادیان‌محور (بدونِ عکسِ سنگین روی هر صفحه).

import Link from 'next/link'

interface Crumb { label: string; href?: string }

export default function PageHeader({
  title, subtitle, eyebrow, crumbs, children,
}: {
  title: string
  subtitle?: string
  eyebrow?: string
  crumbs?: Crumb[]
  children?: React.ReactNode
}) {
  return (
    <section style={{ position: 'relative', overflow: 'hidden', background: '#080b14', color: '#f3ede0', padding: 'clamp(26px,4vw,46px) 24px clamp(24px,3.4vw,40px)' }}>
      {/* لایه‌های تیرهٔ طلایی — نسخهٔ جمع‌وجورِ هیرو */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(900px 300px at 78% -20%, rgba(236,151,56,.28), transparent 62%), radial-gradient(700px 260px at 12% 120%, rgba(70,96,150,.18), transparent 60%), linear-gradient(120deg,#070a12,#0b0e1a 55%,#141009)' }}></div>
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(247,222,146,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(247,222,146,.06) 1px,transparent 1px)', backgroundSize: '46px 46px', maskImage: 'radial-gradient(70% 90% at 70% 0%, #000, transparent 75%)', WebkitMaskImage: 'radial-gradient(70% 90% at 70% 0%, #000, transparent 75%)' }}></div>
      {/* خطِ گرادیانیِ پایین */}
      <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: 'linear-gradient(90deg,transparent,rgba(217,173,62,.6),transparent)' }}></div>

      <div style={{ position: 'relative', maxWidth: 1280, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18 }}>
        <div style={{ textAlign: 'right', minWidth: 0 }}>
          {crumbs && crumbs.length > 0 && (
            <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 12.5, color: 'rgba(244,238,225,.6)', marginBottom: 10 }}>
              {crumbs.map((c, i) => (
                <span key={i} style={{ display: 'inline-flex', gap: 6 }}>
                  {c.href ? <Link href={c.href} style={{ color: 'rgba(244,238,225,.7)', textDecoration: 'none' }}>{c.label}</Link> : <span style={{ color: '#F7DE92' }}>{c.label}</span>}
                  {i < crumbs.length - 1 && <span style={{ color: 'rgba(244,238,225,.35)' }}>/</span>}
                </span>
              ))}
            </nav>
          )}
          {eyebrow && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999, border: '1px solid rgba(247,222,146,.4)', background: 'rgba(247,222,146,.09)', fontSize: 12.5, fontWeight: 700, color: '#F7DE92', marginBottom: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F7DE92', display: 'inline-block' }}></span>
              {eyebrow}
            </div>
          )}
          <h1 style={{ margin: 0, fontSize: 'clamp(23px,3.4vw,38px)', lineHeight: 1.25, fontWeight: 800, letterSpacing: '-.5px', color: '#F6F1E6' }}>{title}</h1>
          {subtitle && <p style={{ margin: '10px 0 0', maxWidth: 640, fontSize: 'clamp(13px,1.6vw,15.5px)', lineHeight: 1.8, color: 'rgba(244,238,225,.72)' }}>{subtitle}</p>}
        </div>
        {children && <div style={{ flexShrink: 0 }}>{children}</div>}
      </div>
    </section>
  )
}
