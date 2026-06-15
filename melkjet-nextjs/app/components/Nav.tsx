'use client'
import { useState } from 'react'
import Link from 'next/link'
import ThemeToggle from './ThemeToggle'

const navLinks = [
  { href: '/search', label: 'خرید' },
  { href: '/search?type=rent', label: 'اجاره' },
  { href: '/search?type=presale', label: 'پیش‌فروش' },
  { href: '/directory', label: 'مشاوران' },
  { href: '/neighborhood/tehran', label: 'تحلیل بازار' },
]

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      backdropFilter: 'blur(18px)',
      background: 'var(--navbg)',
      borderBottom: '1px solid var(--line)'
    }}>
      <nav style={{
        maxWidth: 1280, margin: '0 auto', padding: '0 20px',
        height: 64, display: 'flex', alignItems: 'center', gap: 20
      }}>
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--text)', flexShrink: 0 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px -6px var(--gold)' }}>
            <span style={{ width: 13, height: 13, background: 'var(--bg)', transform: 'rotate(45deg)', borderRadius: 2, display: 'block' }}></span>
          </span>
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-.5px' }}>ملک‌جت</span>
        </Link>

        {/* Desktop links */}
        <div className="mj-nav-links mj-navlinks mjs-navlinks" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14.5, fontWeight: 500 }}>
          {navLinks.map(l => (
            <Link key={l.href} href={l.href} style={{ padding: '9px 13px', borderRadius: 9, color: 'var(--muted)', textDecoration: 'none' }}>{l.label}</Link>
          ))}
        </div>

        <div style={{ flex: 1 }}></div>

        {/* Desktop actions */}
        <div className="mj-nav-links mj-login" style={{ display: 'none', alignItems: 'center', gap: 10 }}>
          <ThemeToggle size={40} />
          <Link href="/auth" style={{ padding: '0 16px', height: 40, display: 'flex', alignItems: 'center', borderRadius: 11, border: '1px solid var(--line2)', color: 'var(--text)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>ورود</Link>
          <Link href="/submit" style={{ padding: '0 18px', height: 40, display: 'flex', alignItems: 'center', borderRadius: 11, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>ثبت آگهی</Link>
        </div>

        {/* Mobile: theme + hamburger */}
        <div className="mj-nav-mobile-menu" style={{ display: 'none', alignItems: 'center', gap: 10 }}>
          <ThemeToggle size={38} />
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label="منو"
            style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--text)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: 'pointer' }}
          >
            <span style={{ width: 18, height: 2, background: 'currentColor', borderRadius: 2, transition: 'transform .2s', transform: menuOpen ? 'rotate(45deg) translate(5px,5px)' : 'none' }} />
            <span style={{ width: 18, height: 2, background: 'currentColor', borderRadius: 2, opacity: menuOpen ? 0 : 1, transition: 'opacity .2s' }} />
            <span style={{ width: 18, height: 2, background: 'currentColor', borderRadius: 2, transition: 'transform .2s', transform: menuOpen ? 'rotate(-45deg) translate(5px,-5px)' : 'none' }} />
          </button>
        </div>
      </nav>

      {/* Mobile menu drawer */}
      {menuOpen && (
        <div style={{ background: 'var(--navbg)', borderTop: '1px solid var(--line)', padding: '12px 20px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {navLinks.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)} style={{ padding: '12px 14px', borderRadius: 10, color: 'var(--text)', textDecoration: 'none', fontSize: 15, fontWeight: 600 }}>{l.label}</Link>
            ))}
            <div style={{ height: 1, background: 'var(--line)', margin: '8px 0' }} />
            <Link href="/auth" onClick={() => setMenuOpen(false)} style={{ padding: '12px 14px', borderRadius: 10, color: 'var(--text)', textDecoration: 'none', fontSize: 15, fontWeight: 600 }}>ورود / ثبت‌نام</Link>
            <Link href="/submit" onClick={() => setMenuOpen(false)} style={{ display: 'block', textAlign: 'center', padding: '13px', borderRadius: 12, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', textDecoration: 'none', fontSize: 15, fontWeight: 700, marginTop: 4 }}>+ ثبت آگهی</Link>
          </div>
        </div>
      )}
    </header>
  )
}
