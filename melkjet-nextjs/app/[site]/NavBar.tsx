'use client'

import { useState } from 'react'

// هدرِ چسبانِ سایت: روی دسکتاپ (≥720px) آیتم‌های منو به‌صورتِ افقی در سمتِ چپ و برند در سمتِ
// راست؛ روی موبایل (<720px) دکمهٔ همبرگری که یک پنلِ کشویی تمام‌عرض را باز/بسته می‌کند.
// نمایش/پنهانِ آیتم‌ها با media query (کلاس‌ها) انجام می‌شود تا SSR درست باشد؛ باز/بستهٔ
// پنلِ موبایل با state کنترل می‌شود و با کلیک روی هر آیتم بسته می‌شود.
type NavItem = { slug: string; label: string; home: boolean }

export default function NavBar({
  brand, items, currentSlug, siteSlug, primary,
}: {
  brand: string
  items: NavItem[]
  currentSlug: string
  siteSlug: string
  primary: string
}) {
  const [open, setOpen] = useState(false)

  const hrefOf = (it: NavItem) => (it.home ? `/${siteSlug}` : `/${siteSlug}/${it.slug}`)

  return (
    <nav className="mjs-nav" style={{
      background: 'color-mix(in srgb, var(--mjs-bg) 86%, transparent)', backdropFilter: 'blur(10px)',
      borderBottom: '1px solid color-mix(in srgb, var(--mjs-text) 12%, transparent)',
      padding: '0 clamp(16px,4vw,24px)', direction: 'rtl', position: 'sticky', top: 0, zIndex: 50,
      boxShadow: '0 6px 24px -22px rgba(20,16,10,.7)',
    }}>
      <style>{`
        .mjs-nav-burger{display:none}
        .mjs-nav-inline{display:flex}
        .mjs-nav-panel{display:none}
        @media(max-width:719px){
          .mjs-nav-inline{display:none !important}
          .mjs-nav-burger{display:flex !important}
          .mjs-nav-panel{display:block}
        }
        .mjs-nav-panel{overflow:hidden;max-height:0;opacity:0;transition:max-height .26s ease, opacity .2s ease}
        .mjs-nav-panel.open{max-height:80vh;opacity:1}
        .mjs-navlink{transition:background .18s ease, color .18s ease}
        .mjs-navlink:hover{background:${primary}1f;color:${primary}}
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 18, minHeight: 64 }}>
        <a href={`/${siteSlug}`} style={{ fontSize: 19, fontWeight: 900, color: 'var(--mjs-heading)', textDecoration: 'none', marginLeft: 'auto', letterSpacing: '-0.4px', flex: '0 0 auto' }}>{brand}</a>

        {/* آیتم‌های افقیِ دسکتاپ */}
        <div className="mjs-nav-inline" style={{ alignItems: 'center', gap: 4, flex: '1 1 auto', justifyContent: 'flex-start' }}>
          {items.map(it => {
            const active = it.slug === currentSlug
            return (
              <a key={it.slug} href={hrefOf(it)} className="mjs-navlink" style={{
                fontSize: 14, fontWeight: active ? 800 : 600, textDecoration: 'none', whiteSpace: 'nowrap',
                color: active ? '#fff' : 'var(--mjs-text)',
                background: active ? primary : 'transparent',
                padding: '9px 16px', borderRadius: 10,
              }}>{it.label}</a>
            )
          })}
        </div>

        {/* دکمهٔ همبرگری موبایل */}
        <button
          type="button"
          aria-label={open ? 'بستنِ منو' : 'بازکردنِ منو'}
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
          className="mjs-nav-burger"
          style={{
            flex: '0 0 auto', width: 44, height: 44, borderRadius: 12, cursor: 'pointer',
            alignItems: 'center', justifyContent: 'center', fontSize: 22, lineHeight: 1,
            color: 'var(--mjs-heading)', background: `${primary}14`,
            border: '1px solid color-mix(in srgb, var(--mjs-text) 14%, transparent)',
          }}
        >{open ? '✕' : '☰'}</button>
      </div>

      {/* پنلِ کشویی موبایل */}
      <div className={`mjs-nav-panel${open ? ' open' : ''}`} style={{ direction: 'rtl' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '8px 0 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map(it => {
            const active = it.slug === currentSlug
            return (
              <a key={it.slug} href={hrefOf(it)} onClick={() => setOpen(false)} className="mjs-navlink" style={{
                display: 'flex', alignItems: 'center', minHeight: 48, padding: '0 16px', borderRadius: 12,
                fontSize: 15.5, fontWeight: active ? 800 : 600, textDecoration: 'none',
                color: active ? '#fff' : 'var(--mjs-text)',
                background: active ? primary : 'transparent',
              }}>{it.label}</a>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
