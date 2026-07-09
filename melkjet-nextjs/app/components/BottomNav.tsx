'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  {
    href: '/',
    label: 'خانه',
    icon: (on: boolean) => (
      <svg width="23" height="23" viewBox="0 0 24 24" fill={on ? 'var(--gold)' : 'none'} stroke={on ? 'var(--gold)' : 'var(--muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: '/search',
    label: 'جستجو',
    icon: (on: boolean) => (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={on ? 'var(--gold)' : 'var(--muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
  {
    // امپراتوری به‌جای دایرکتوری (خواستهٔ صریح) — دایرکتوری از منوی «متخصصان» در دسترس می‌ماند.
    href: '/empire',
    label: 'امپراتوری',
    icon: (on: boolean) => (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={on ? 'var(--gold)' : 'var(--muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18"/>
        <path d="M5 21V8l4-3v16"/>
        <path d="M9 21V5l6 4v12"/>
        <path d="M15 21V9l4 3v9"/>
      </svg>
    ),
  },
  {
    href: '/store',
    label: 'بازار',
    icon: (on: boolean) => (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={on ? 'var(--gold)' : 'var(--muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    ),
  },
  {
    href: '/pros',
    label: 'متخصصین',
    icon: (on: boolean) => (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={on ? 'var(--gold)' : 'var(--muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
    ),
  },
]

// مسیرهای داشبورد/پنل — ناوبریِ پایینِ عمومی نباید آنجا دیده شود.
// در این مسیرها تب‌بارِ پایین پنهان می‌شود. صفحهٔ آگهی هم جزوِ این‌هاست چون نوارِ اکشنِ
// «چت / اطلاعات تماس» جای آن را می‌گیرد (مثلِ دیوار).
// «/listing» آدرسِ کانونیِ جدیدِ صفحهٔ آگهی است (مهاجرتِ اسلاگ) — بدونِ آن، تب‌بار روی
// نوارِ «چت/تماس» می‌نشست و می‌پوشاندش.
const PANEL_ROUTES = ['/admin', '/agency', '/pros', '/builder', '/materials', '/owner', '/buyer', '/legal', '/architect', '/contractor', '/appraiser', '/lawfirm', '/finance', '/notary', '/crm', '/marketing', '/workflow', '/website-builder', '/content', '/plan-ai', '/property', '/listing']

export default function BottomNav() {
  const path = usePathname()
  if (PANEL_ROUTES.some(r => path === r || path.startsWith(r + '/'))) return null

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
      <div style={{ display: 'flex', height: 62 }}>
        {tabs.map(tab => {
          const active = tab.href === '/' ? path === '/' : path.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                textDecoration: 'none',
                height: '100%',
                position: 'relative',
              }}
            >
              {active && (
                <span style={{
                  position: 'absolute',
                  top: 0, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 28, height: 2,
                  borderRadius: '0 0 4px 4px',
                  background: 'var(--gold)',
                }} />
              )}
              {tab.icon(active)}
              <span style={{
                fontSize: 10,
                color: active ? 'var(--gold)' : 'var(--muted)',
                fontWeight: active ? 700 : 400,
              }}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
