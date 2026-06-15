'use client'
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
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      backdropFilter: 'blur(18px)',
      background: 'var(--navbg)',
      borderBottom: '1px solid var(--line)'
    }}>
      <nav style={{
        maxWidth: 1280, margin: '0 auto', padding: '0 24px',
        height: 68, display: 'flex', alignItems: 'center', gap: 28
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none', color: 'var(--text)' }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px -6px var(--gold)' }}>
            <span style={{ width: 13, height: 13, background: 'var(--bg)', transform: 'rotate(45deg)', borderRadius: 2, display: 'block' }}></span>
          </span>
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-.5px' }}>ملک‌جت</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14.5, fontWeight: 500 }}>
          {navLinks.map(l => (
            <Link key={l.href} href={l.href} style={{ padding: '9px 13px', borderRadius: 9, color: 'var(--muted)', textDecoration: 'none' }}>{l.label}</Link>
          ))}
        </div>
        <div style={{ flex: 1 }}></div>
        <ThemeToggle size={40} />
        <Link href="/auth" style={{ padding: '0 16px', height: 40, display: 'flex', alignItems: 'center', borderRadius: 11, border: '1px solid var(--line2)', color: 'var(--text)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>ورود / ثبت‌نام</Link>
        <Link href="/submit" style={{ padding: '0 18px', height: 40, display: 'flex', alignItems: 'center', borderRadius: 11, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', textDecoration: 'none', fontSize: 14, fontWeight: 700, boxShadow: '0 8px 22px -10px var(--gold)' }}>ثبت آگهی</Link>
      </nav>
    </header>
  )
}
