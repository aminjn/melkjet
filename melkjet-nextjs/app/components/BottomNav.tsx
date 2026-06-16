'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  {
    href: '/',
    label: 'خانه',
    icon: (on: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={on ? 'var(--gold)' : 'none'} stroke={on ? 'var(--gold)' : 'var(--muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: '/search',
    label: 'جستجو',
    icon: (on: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={on ? 'var(--gold)' : 'var(--muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
  {
    href: '/submit',
    label: 'ثبت ملک',
    isSubmit: true,
    icon: (_on: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16140f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    ),
  },
  {
    href: '/directory',
    label: 'مشاوران',
    icon: (on: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={on ? 'var(--gold)' : 'var(--muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: '/auth',
    label: 'پروفایل',
    icon: (on: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={on ? 'var(--gold)' : 'var(--muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
]

export default function BottomNav() {
  const path = usePathname()

  return (
    <nav
      className="mj-bottom-nav"
      style={{
        display: 'none',
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 100,
        background: 'var(--navbg)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderTop: '1px solid var(--line)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div style={{ display: 'flex', height: 60 }}>
        {tabs.map(tab => {
          const active = tab.href === '/' ? path === '/' : path.startsWith(tab.href)
          if (tab.isSubmit) {
            return (
              <Link key={tab.href} href={tab.href} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', gap: 3 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px -4px var(--gold)', marginTop: -14 }}>
                  {tab.icon(false)}
                </div>
                <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>{tab.label}</span>
              </Link>
            )
          }
          return (
            <Link key={tab.href} href={tab.href} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', gap: 4, height: '100%' }}>
              {tab.icon(active)}
              <span style={{ fontSize: 10, color: active ? 'var(--gold)' : 'var(--muted)', fontWeight: active ? 700 : 400 }}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
