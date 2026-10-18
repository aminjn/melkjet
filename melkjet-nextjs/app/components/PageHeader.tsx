// ── هدرِ سینماییِ صفحات (ری‌برندِ ۲۹۸ی۷؛ تم‌آگاه در فاز ۳۰۹و) ────────────────
// بندِ طلاییِ هم‌خانوادهٔ هیروی صفحهٔ اصلی — روی صفحاتِ داخلی (جستجو، دایرکتوری،
// سازنده‌ها، …) زیرِ <Nav/>. رنگ‌ها از توکن‌های تم‌آگاهِ --ph-* (globals.css): شب تیره،
// روز روشن (مثلِ هیرو که دیگر همیشه‌تیره نیست). گرادیان‌محور (بدونِ عکسِ سنگین).

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
    <section style={{ position: 'relative', overflow: 'hidden', background: 'var(--ph-base)', color: 'var(--ph-text)', padding: 'clamp(26px,4vw,46px) 24px clamp(24px,3.4vw,40px)' }}>
      {/* لایهٔ طلایی — تم‌آگاه (شب تیره / روز روشن) */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'var(--ph-overlay)' }}></div>
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(247,222,146,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(247,222,146,.06) 1px,transparent 1px)', backgroundSize: '46px 46px', maskImage: 'radial-gradient(70% 90% at 70% 0%, #000, transparent 75%)', WebkitMaskImage: 'radial-gradient(70% 90% at 70% 0%, #000, transparent 75%)' }}></div>
      {/* خطِ گرادیانیِ پایین */}
      <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: 'linear-gradient(90deg,transparent,rgba(217,173,62,.6),transparent)' }}></div>

      <div style={{ position: 'relative', maxWidth: 1280, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18 }}>
        <div style={{ textAlign: 'right', minWidth: 0 }}>
          {crumbs && crumbs.length > 0 && (
            <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 12.5, color: 'var(--ph-crumb)', marginBottom: 10 }}>
              {crumbs.map((c, i) => (
                <span key={i} style={{ display: 'inline-flex', gap: 6 }}>
                  {c.href ? <Link href={c.href} style={{ color: 'var(--ph-crumb)', textDecoration: 'none' }}>{c.label}</Link> : <span style={{ color: 'var(--ph-gold)' }}>{c.label}</span>}
                  {i < crumbs.length - 1 && <span style={{ color: 'var(--ph-crumb-faint)' }}>/</span>}
                </span>
              ))}
            </nav>
          )}
          {eyebrow && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999, border: '1px solid rgba(217,173,62,.4)', background: 'rgba(217,173,62,.1)', fontSize: 12.5, fontWeight: 700, color: 'var(--ph-gold)', marginBottom: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ph-gold)', display: 'inline-block' }}></span>
              {eyebrow}
            </div>
          )}
          <h1 style={{ margin: 0, fontSize: 'clamp(23px,3.4vw,38px)', lineHeight: 1.25, fontWeight: 800, letterSpacing: '-.5px', color: 'var(--ph-text)' }}>{title}</h1>
          {subtitle && <p style={{ margin: '10px 0 0', maxWidth: 640, fontSize: 'clamp(13px,1.6vw,15.5px)', lineHeight: 1.8, color: 'var(--ph-sub)' }}>{subtitle}</p>}
        </div>
        {children && <div style={{ flexShrink: 0 }}>{children}</div>}
      </div>
    </section>
  )
}
