'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type React from 'react'
import { openAuth } from './AuthModal'

const tabs: { href: string; label: string; center?: boolean; icon: (on: boolean) => React.ReactNode }[] = [
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
  // فاز ج — «بازار» (مصالح) و «متخصصین» از تب‌بار رفتند (هر دو در منوی ☰ هستند). «متخصصین» اصلاً به
  // داشبوردِ /pros (پنلِ مشاور) می‌رفت نه دایرکتوری. جایشان، الگوی همهٔ رقبای ملکی (دیوار/شیپور): دکمهٔ
  // برجستهٔ «ثبت آگهی» وسط + «من» (پنل/ورود) آخر.
  {
    href: '/submit',
    label: 'ثبت آگهی',
    center: true,
    icon: (on: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16140f" strokeWidth="2.6" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
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
]

// مسیرهای داشبورد/پنل — ناوبریِ پایینِ عمومی نباید آنجا دیده شود.
// در این مسیرها تب‌بارِ پایین پنهان می‌شود. صفحهٔ آگهی هم جزوِ این‌هاست چون نوارِ اکشنِ
// «چت / اطلاعات تماس» جای آن را می‌گیرد (مثلِ دیوار).
// «/listing» آدرسِ کانونیِ جدیدِ صفحهٔ آگهی است (مهاجرتِ اسلاگ) — بدونِ آن، تب‌بار روی
// نوارِ «چت/تماس» می‌نشست و می‌پوشاندش.
const PANEL_ROUTES = ['/empire', '/admin', '/agency', '/pros', '/builder', '/materials', '/owner', '/buyer', '/legal', '/architect', '/contractor', '/appraiser', '/lawfirm', '/finance', '/notary', '/crm', '/marketing', '/workflow', '/website-builder', '/content', '/plan-ai', '/property', '/listing']

export default function BottomNav() {
  const path = usePathname()
  if (PANEL_ROUTES.some(r => path === r || path.startsWith(r + '/'))) return null
  const goMe = async () => {
    try {
      const d = await fetch('/api/auth/profile').then(r => r.ok ? r.json() : null)
      if (d?.phone) { window.location.href = d.dash || '/buyer'; return }
    } catch {}
    openAuth()
  }

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
            <Link key={tab.href} href={tab.href} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, textDecoration: 'none', height: '100%', position: 'relative' }}>
              {active && !tab.center && (
                <span style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 28, height: 2, borderRadius: '0 0 4px 4px', background: 'var(--gold)' }} />
              )}
              {tab.center ? (
                <span style={{ width: 44, height: 34, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', boxShadow: '0 6px 16px -6px rgba(217,173,62,.7)' }}>{tab.icon(active)}</span>
              ) : tab.icon(active)}
              <span style={{ fontSize: 10, color: active || tab.center ? 'var(--gold)' : 'var(--muted)', fontWeight: active || tab.center ? 700 : 400 }}>{tab.label}</span>
            </Link>
          )
        })}
        {/* «من» — واردشده → پنلِ خودش، مهمان → پنجرهٔ ورود (نه صفحهٔ خالیِ «وارد شوید»). */}
        <button onClick={goMe} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, height: '100%', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7"/>
          </svg>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>من</span>
        </button>
      </div>
    </nav>
  )
}
