'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import ThemeToggle from './ThemeToggle'
import CitySelector from './CitySelector'
import { openAuth } from './AuthModal'

const DASH_LABEL: Record<string, string> = {
  '/admin': 'پنل مدیریت', '/builder': 'پنل سازنده', '/pros': 'پنل مشاور',
  '/agency': 'پنل آژانس', '/materials': 'پنل فروشگاه',
  '/buyer': 'پنل من', '/legal': 'پنل حقوقی',
  '/architect': 'پنل معمار', '/contractor': 'پنل پیمانکار', '/appraiser': 'پنل کارشناس',
  '/lawfirm': 'پنل دفتر حقوقی', '/finance': 'پنل بانک و بیمه', '/notary': 'پنل دفترخانه',
}

interface MenuItem { ic: string; label: string; desc: string; href: string }
interface Menu { label: string; items: MenuItem[] }
// منوهای کشویی — همهٔ لینک‌ها به صفحاتِ واقعیِ سایت.
const MENUS: Menu[] = [
  { label: 'خرید و اجاره', items: [
    { ic: '🏢', label: 'خرید آپارتمان', desc: 'فروشِ مسکونی', href: '/search?kind=' + encodeURIComponent('آپارتمان') },
    { ic: '🔑', label: 'اجارهٔ آپارتمان', desc: 'رهن و اجارهٔ مسکونی', href: '/search?type=rent&kind=' + encodeURIComponent('آپارتمان') },
    { ic: '🏡', label: 'خرید ویلا و خانه', desc: 'ویلا، خانه، کلنگی', href: '/search?kind=' + encodeURIComponent('ویلا') },
    { ic: '🏬', label: 'اداری و تجاری', desc: 'دفتر، مغازه، تجاری', href: '/search?kind=' + encodeURIComponent('دفتر/اداری') },
    { ic: '🌱', label: 'پیش‌فروش پروژه‌ها', desc: 'پیش‌فروش تا آمادهٔ تحویل', href: '/search?type=presale' },
    { ic: '🔍', label: 'جستجوی هوشمند (AI)', desc: 'به زبانِ خودت بگو چه می‌خواهی', href: '/search' },
    { ic: '＋', label: 'ثبت آگهی', desc: 'فروش یا اجاره ملکِ شما', href: '/submit' },
  ] },
  { label: 'پروژه‌ها', items: [
    { ic: '🏗', label: 'دایرکتوری پروژه‌ها', desc: 'پیش‌فروش تا آماده تحویل', href: '/builders' },
    { ic: '◉', label: 'سازندگان', desc: 'پروفایل سازندگان', href: '/builders' },
    { ic: '🧱', label: 'بازار مصالح', desc: 'همهٔ محصولات + قیمت', href: '/materials-market' },
    { ic: '🏪', label: 'فروشگاه‌های مصالح', desc: 'فروشندگانِ مصالح', href: '/stores' },
    { ic: '📊', label: 'نرخِ روزِ مصالح', desc: 'قیمتِ روزِ آهن، سیمان و…', href: '/materials-prices' },
  ] },
  { label: 'متخصصان', items: [
    { ic: '◎', label: 'مشاوران املاک', desc: 'یافتن مشاور', href: '/directory?category=مشاور' },
    { ic: '🏢', label: 'آژانس‌های املاک', desc: 'دفاتر و شعب', href: '/directory?category=آژانس' },
    { ic: '🏗', label: 'سازندگان', desc: 'پروژه و پیش‌فروش', href: '/builders' },
    { ic: '🧱', label: 'بازار و محصولاتِ مصالح', desc: 'همهٔ محصولات + قیمت', href: '/materials-market' },
    { ic: '📐', label: 'معمار و طراح داخلی', desc: 'طراحی و نظارت', href: '/directory?category=معمار' },
    { ic: '🛠', label: 'پیمانکار', desc: 'اجرای ساختمان', href: '/directory?category=پیمانکار' },
    { ic: '📋', label: 'کارشناس رسمی', desc: 'ارزیابی و گزارش', href: '/directory?category=کارشناس' },
    { ic: '⚖', label: 'دفتر حقوقی', desc: 'قرارداد و دعاوی', href: '/directory?category=حقوقی' },
    { ic: '🏦', label: 'بانک و بیمه', desc: 'وام و پوشش', href: '/directory?category=بیمه' },
    { ic: '◆', label: 'دفترخانه', desc: 'سند و انتقال', href: '/directory?category=دفترخانه' },
  ] },
  { label: 'ابزار هوشمند', items: [
    { ic: '📊', label: 'تحلیل بازار', desc: 'کلان‌داده و پیش‌بینی', href: '/market' },
    { ic: '🏠', label: 'پلان و مدل سه‌بعدی', desc: 'ساخت پلان از عکس', href: '/plan-ai' },
    { ic: '✦', label: 'دستیار و موتور مذاکره AI', desc: 'مشاوره و استراتژی', href: '/plan-ai' },
    { ic: '📝', label: 'بلاگ و مقالات', desc: 'محتوای آموزشی', href: '/blog' },
    { ic: '◯', label: 'پلن‌ها و اشتراک', desc: 'عضویت متخصصان', href: '/pricing' },
  ] },
]

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [open, setOpen] = useState<string | null>(null)        // منوی دسکتاپِ بازشده
  const [mobOpen, setMobOpen] = useState<string | null>(null)  // بخشِ بازشدهٔ موبایل
  const [me, setMe] = useState<{ dash: string } | null | undefined>(undefined)
  // «قصدِ هاور»: بستنِ منو با کمی تأخیر تا رد شدن از فاصلهٔ بینِ دکمه و منو، آن را نبندد (پرش/فلیکر).
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openMenu = (label: string) => { if (closeTimer.current) clearTimeout(closeTimer.current); setOpen(label) }
  const scheduleClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setOpen(null), 180) }

  useEffect(() => {
    let cancelled = false
    const loadMe = () => fetch('/api/auth/profile').then(r => r.ok ? r.json() : null).then(d => { if (!cancelled) setMe(d && d.phone ? { dash: d.dash || '/buyer' } : null) }).catch(() => { if (!cancelled) setMe(null) })
    loadMe()
    window.addEventListener('mj-auth-success', loadMe)
    return () => { cancelled = true; window.removeEventListener('mj-auth-success', loadMe) }
  }, [])

  const logout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {}
    try { localStorage.removeItem('mj_token'); sessionStorage.removeItem('mj_resume_tried') } catch {}
    window.location.href = '/'
  }
  const dashLabel = me ? (DASH_LABEL[me.dash] || 'پنل من') : ''

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(18px)', background: 'var(--navbg)', borderBottom: '1px solid var(--line)' }}>
      <nav style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px', height: 64, display: 'flex', alignItems: 'center', gap: 18 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--text)', flexShrink: 0 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px -6px var(--gold)' }}>
            <span style={{ width: 13, height: 13, background: 'var(--bg)', transform: 'rotate(45deg)', borderRadius: 2, display: 'block' }} />
          </span>
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-.5px' }}>ملک‌جت</span>
        </Link>

        <CitySelector />

        {/* Desktop dropdown menus */}
        <div className="mj-navlinks" style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 14.5, fontWeight: 600 }}>
          {MENUS.map(m => (
            <div key={m.label} style={{ position: 'relative' }} onMouseEnter={() => openMenu(m.label)} onMouseLeave={scheduleClose}>
              <button onClick={() => (open === m.label ? setOpen(null) : openMenu(m.label))} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 13px', borderRadius: 9, color: open === m.label ? 'var(--text)' : 'var(--muted)', background: open === m.label ? 'var(--surface)' : 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 600 }}>
                {m.label}<span style={{ fontSize: 9, opacity: .7 }}>▾</span>
              </button>
              {open === m.label && (
                // ظرفِ بیرونی از لبهٔ دکمه شروع می‌شود (top:100%، بدونِ فاصلهٔ مُرده) و فاصلهٔ بصری را با
                // paddingTop می‌سازد؛ آن ۸px شفاف ولی قابلِ‌هاور است، پس عبورِ نشانگر منو را نمی‌بندد.
                <div style={{ position: 'absolute', top: '100%', insetInlineEnd: 0, paddingTop: 8, minWidth: 270, zIndex: 60 }}>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 16, boxShadow: '0 16px 50px -12px rgba(0,0,0,.55)', padding: 8, maxHeight: '76vh', overflowY: 'auto' }}>
                    {m.items.map(it => (
                      <Link key={it.label + it.href} href={it.href} onClick={() => setOpen(null)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 11, textDecoration: 'none', color: 'inherit' }} className="mj-menu-item">
                        <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 11, background: 'var(--goldDim)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>{it.ic}</span>
                        <span style={{ flex: 1 }}>
                          <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{it.label}</span>
                          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{it.desc}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div className="mj-nav-links mj-login" style={{ display: 'none', alignItems: 'center', gap: 10 }}>
          <ThemeToggle size={40} />
          {me ? (
            <>
              <button onClick={logout} title="خروج از حساب" style={{ padding: '0 14px', height: 40, display: 'flex', alignItems: 'center', borderRadius: 11, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--muted)', fontFamily: 'inherit', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>خروج</button>
              <Link href={me.dash} style={{ padding: '0 18px', height: 40, display: 'flex', alignItems: 'center', borderRadius: 11, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>{dashLabel}</Link>
            </>
          ) : (
            <>
              <button onClick={() => openAuth()} style={{ padding: '0 16px', height: 40, display: 'flex', alignItems: 'center', borderRadius: 11, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 }}>ورود / ثبت‌نام</button>
              <Link href="/submit" style={{ padding: '0 18px', height: 40, display: 'flex', alignItems: 'center', borderRadius: 11, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>ثبت آگهی</Link>
            </>
          )}
        </div>

        <div className="mj-nav-mobile-menu" style={{ display: 'none', alignItems: 'center', gap: 10 }}>
          <ThemeToggle size={38} />
          <button onClick={() => setMenuOpen(o => !o)} aria-label="منو" style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--text)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: 'pointer' }}>
            <span style={{ width: 18, height: 2, background: 'currentColor', borderRadius: 2, transition: 'transform .2s', transform: menuOpen ? 'rotate(45deg) translate(5px,5px)' : 'none' }} />
            <span style={{ width: 18, height: 2, background: 'currentColor', borderRadius: 2, opacity: menuOpen ? 0 : 1, transition: 'opacity .2s' }} />
            <span style={{ width: 18, height: 2, background: 'currentColor', borderRadius: 2, transition: 'transform .2s', transform: menuOpen ? 'rotate(-45deg) translate(5px,-5px)' : 'none' }} />
          </button>
        </div>
      </nav>

      {/* Mobile drawer with expandable sections */}
      {menuOpen && (
        <div style={{ background: 'var(--navbg)', borderTop: '1px solid var(--line)', padding: '10px 16px 18px', maxHeight: '80vh', overflowY: 'auto' }}>
          {MENUS.map(m => (
            <div key={m.label}>
              <button onClick={() => setMobOpen(o => o === m.label ? null : m.label)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 12px', borderRadius: 10, color: 'var(--text)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}>
                {m.label}<span style={{ fontSize: 11, color: 'var(--muted)' }}>{mobOpen === m.label ? '−' : '+'}</span>
              </button>
              {mobOpen === m.label && m.items.map(it => (
                <Link key={it.label + it.href} href={it.href} onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px 10px 22px', borderRadius: 10, textDecoration: 'none', color: 'inherit' }}>
                  <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 9, background: 'var(--goldDim)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{it.ic}</span>
                  <span><span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{it.label}</span><span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{it.desc}</span></span>
                </Link>
              ))}
            </div>
          ))}
          <div style={{ height: 1, background: 'var(--line)', margin: '10px 0' }} />
          {me ? (
            <>
              <Link href={me.dash} onClick={() => setMenuOpen(false)} style={{ display: 'block', textAlign: 'center', padding: '13px', borderRadius: 12, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', textDecoration: 'none', fontSize: 15, fontWeight: 700 }}>{dashLabel}</Link>
              <button onClick={() => { setMenuOpen(false); logout() }} style={{ width: '100%', padding: '12px 14px', borderRadius: 10, color: 'var(--muted)', background: 'transparent', border: '1px solid var(--line2)', fontFamily: 'inherit', cursor: 'pointer', fontSize: 15, fontWeight: 600, marginTop: 8 }}>خروج از حساب</button>
            </>
          ) : (
            <>
              <button onClick={() => { setMenuOpen(false); openAuth() }} style={{ width: '100%', padding: '12px 14px', borderRadius: 10, color: 'var(--text)', background: 'transparent', border: '1px solid var(--line2)', textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 600 }}>ورود / ثبت‌نام</button>
              <Link href="/submit" onClick={() => setMenuOpen(false)} style={{ display: 'block', textAlign: 'center', padding: '13px', borderRadius: 12, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', textDecoration: 'none', fontSize: 15, fontWeight: 700, marginTop: 8 }}>+ ثبت آگهی</Link>
            </>
          )}
        </div>
      )}
      <style>{`.mj-menu-item:hover{background:var(--bg2)}`}</style>
    </header>
  )
}
