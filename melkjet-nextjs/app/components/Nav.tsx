'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import ThemeToggle from './ThemeToggle'
import CitySelector from './CitySelector'
import { openAuth } from './AuthModal'
import Logo from './Logo'
import GlassIcon, { IconSvg, type IconName } from './GlassIcon'

const DASH_LABEL: Record<string, string> = {
  '/admin': 'پنل مدیریت', '/builder': 'پنل سازنده', '/pros': 'پنل مشاور',
  '/agency': 'پنل آژانس', '/materials': 'پنل فروشگاه',
  '/buyer': 'پنل من', '/legal': 'پنل حقوقی',
  '/architect': 'پنل معمار', '/contractor': 'پنل پیمانکار', '/appraiser': 'پنل کارشناس',
  '/lawfirm': 'پنل دفتر حقوقی', '/finance': 'پنل بانک و بیمه', '/notary': 'پنل دفترخانه',
}

interface MenuItem { ic: IconName; label: string; desc: string; href: string }
// منو یا کشویی است (items) یا «لینکِ مستقیم» (href بدونِ items) — مثلِ «فروشگاه‌ها» که یک‌کلیکه باز می‌شود.
interface Menu { label: string; href?: string; items?: MenuItem[] }
// منوهای کشویی — همهٔ لینک‌ها به صفحاتِ واقعیِ سایت.
const MENUS: Menu[] = [
  { label: 'خرید و اجاره', items: [
    { ic: 'office', label: 'خرید آپارتمان', desc: 'فروشِ مسکونی', href: '/search?kind=' + encodeURIComponent('آپارتمان') },
    { ic: 'key', label: 'اجارهٔ آپارتمان', desc: 'رهن و اجارهٔ مسکونی', href: '/search?type=rent&kind=' + encodeURIComponent('آپارتمان') },
    { ic: 'home', label: 'خرید ویلا و خانه', desc: 'ویلا، خانه، کلنگی', href: '/search?kind=' + encodeURIComponent('ویلا') },
    { ic: 'store', label: 'اداری و تجاری', desc: 'دفتر، مغازه، تجاری', href: '/search?kind=' + encodeURIComponent('دفتر/اداری') },
    { ic: 'layers', label: 'پیش‌فروش پروژه‌ها', desc: 'پیش‌فروش تا آمادهٔ تحویل', href: '/search?type=presale' },
    { ic: 'search', label: 'جستجوی هوشمند (AI)', desc: 'به زبانِ خودت بگو چه می‌خواهی', href: '/search' },
    { ic: 'plus', label: 'ثبت آگهی', desc: 'فروش یا اجاره ملکِ شما', href: '/submit' },
  ] },
  { label: 'پروژه‌ها', items: [
    { ic: 'layers', label: 'دایرکتوری پروژه‌ها', desc: 'پیش‌فروش تا آماده تحویل', href: '/builders' },
    { ic: 'crane', label: 'سازندگان', desc: 'پروفایل سازندگان', href: '/builders' },
    { ic: 'bricks', label: 'بازار مصالح', desc: 'همهٔ محصولات + قیمت', href: '/materials-market' },
    { ic: 'store', label: 'فروشگاه‌های مصالح', desc: 'فروشندگانِ مصالح', href: '/stores' },
    { ic: 'bars', label: 'نرخِ روزِ مصالح', desc: 'قیمتِ روزِ آهن، سیمان و…', href: '/materials-prices' },
  ] },
  // «فروشگاه‌ها» — لینکِ مستقیم (بدونِ کشویی): یک کلیک → فهرستِ فروشگاه‌ها.
  { label: 'فروشگاه‌ها', href: '/stores' },
  { label: 'متخصصان', items: [
    { ic: 'people', label: 'مشاوران املاک', desc: 'یافتن مشاور', href: '/directory?category=مشاور' },
    { ic: 'office', label: 'آژانس‌های املاک', desc: 'دفاتر و شعب', href: '/directory?category=آژانس' },
    { ic: 'crane', label: 'سازندگان', desc: 'پروژه و پیش‌فروش', href: '/builders' },
    { ic: 'bricks', label: 'بازار و محصولاتِ مصالح', desc: 'همهٔ محصولات + قیمت', href: '/materials-market' },
    { ic: 'ruler', label: 'معمار و طراح داخلی', desc: 'طراحی و نظارت', href: '/directory?category=معمار' },
    { ic: 'tools', label: 'پیمانکار', desc: 'اجرای ساختمان', href: '/directory?category=پیمانکار' },
    { ic: 'clipboard', label: 'کارشناس رسمی', desc: 'ارزیابی و گزارش', href: '/directory?category=کارشناس' },
    { ic: 'scale', label: 'دفتر حقوقی', desc: 'قرارداد و دعاوی', href: '/directory?category=حقوقی' },
    { ic: 'bank', label: 'بانک و بیمه', desc: 'وام و پوشش', href: '/directory?category=بیمه' },
    { ic: 'doc', label: 'دفترخانه', desc: 'سند و انتقال', href: '/directory?category=دفترخانه' },
  ] },
  { label: 'ابزار هوشمند', items: [
    { ic: 'crown', label: 'امپراتوریِ ملکی', desc: 'مسیرِ رشدِ سرمایه با دارایی‌های واقعی', href: '/empire' },
    { ic: 'bars', label: 'تحلیل بازار', desc: 'کلان‌داده و پیش‌بینی', href: '/market' },
    { ic: 'ruler', label: 'پلان و مدل سه‌بعدی', desc: 'ساخت پلان از عکس', href: '/plan-ai' },
    { ic: 'spark', label: 'دستیار و موتور مذاکره AI', desc: 'مشاوره و استراتژی', href: '/plan-ai' },
    { ic: 'article', label: 'بلاگ و مقالات', desc: 'محتوای آموزشی', href: '/blog' },
    { ic: 'star', label: 'پلن‌ها و اشتراک', desc: 'عضویت متخصصان', href: '/pricing' },
  ] },
]

export default function Nav({ overlay = false }: { overlay?: boolean } = {}) {
  // ۸ اکتبر — حالتِ overlay (صفحهٔ اصلی) دو نشانه می‌ساخت: `position: absolute` یعنی با اسکرول
  // نمی‌چسبید، و `background: transparent` یعنی نواری وجود نداشت. طرحِ «نوارِ شفاف روی هیرو»
  // عمدی است و نگه داشته می‌شود — ولی فقط تا وقتی هیرو زیرِ نوار است. بعد از عبور، نوارِ ماتِ
  // چسبان می‌شود؛ همان الگوی استانداردی که کاربر هم انتظارش را داشت.
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    if (!overlay) return
    const onScroll = () => setScrolled(window.scrollY > 56)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [overlay])
  // «روی هیرو»: شفاف و متنِ کرم. در این حالت رنگِ تمِ سایت به‌کار نمی‌آید، چون پشتِ نوار
  // تصویرِ تیره است نه پس‌زمینهٔ تم — و همین بود که در تمِ روشن برچسب‌ها را نامرئی می‌کرد.
  // روی هیرو پشتِ نوار همیشه تیره است (هیرو background '#080b14' دارد، با عکس یا بی‌عکس)،
  // پس رنگِ کرم به اسکرول وابسته نیست — فقط ماتیِ نوار وابسته است.
  // فاز ۳۰۹ — رنگِ ناوِ روی هیرو تم‌آگاه شد: تمِ تیره روشن، تمِ روشن تیره (وگرنه روی آسمانِ روز نامرئی بود).
  const onHero = overlay
  const navText = onHero ? 'var(--hero-nav-text)' : 'var(--text)'
  const navDim = onHero ? 'var(--hero-nav-dim)' : 'var(--muted)'
  const navShadow = onHero ? 'var(--hero-nav-shadow)' : undefined
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
    <header style={overlay
      // روی هیرو: بیرونِ جریانِ صفحه (تا هیرو از زیرش رد شود) ولی fixed، نه absolute —
      // absolute با اسکرول می‌رفت بالا، و sticky نوار را داخلِ جریان می‌آورد و هیرو را
      // ۶۴ پیکسل پایین می‌انداخت (متنِ کرم روی زمینهٔ روشن = نامرئی).
      // اسکریمِ گرادیانی عمدی است: بدونِ جاوااسکریپت هم متن خوانا می‌ماند، و رنگش
      // همان rgba(6,8,16) روکشِ خودِ هیروست تا درز معلوم نشود.
      // فاز ۳۲۰ — backdrop-filterِ خودِ نوار حذف شد: اگر نیایِ یک عنصر backdrop-filter داشته باشد،
      // backdrop-filterِ فرزند (منوی شیشه‌ای) دیگر زمینهٔ صفحه را بلور نمی‌کند («بلور نیست، زیر
      // متن‌دار می‌رود»). نوار با زمینهٔ ~۹۴٪ مات خودش بی‌بلور هم خوانا می‌ماند؛ منوها حالا بلور می‌شوند.
      ? { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, color: 'var(--hero-nav-text)',
          background: scrolled ? 'var(--hero-nav-scrim-scrolled)' : 'var(--hero-nav-scrim)',
          borderBottom: scrolled ? '1px solid var(--hero-nav-line)' : '1px solid transparent',
          boxShadow: scrolled ? '0 6px 24px -14px rgba(0,0,0,.6)' : undefined, transition: 'background .25s, border-color .25s' }
      : { position: 'sticky', top: 0, zIndex: 50, background: 'linear-gradient(var(--navbg),var(--navbg)), var(--bg)', borderBottom: '1px solid var(--line2)', boxShadow: '0 6px 24px -14px rgba(0,0,0,.45)' }}>
      <nav style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px', height: 64, display: 'flex', alignItems: 'center', gap: 18 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--text)', flexShrink: 0 }}>
          {/* ری‌برندِ ۲۹۸ی۵ — لوگومارکِ «M» طلایی همیشه نمایش داده می‌شود (برندِ ذخیره‌شدهٔ قدیمیِ
              پنلِ ادمین دیگر override نمی‌کند؛ لوگوی واحدِ وکتور، تیز در هر اندازه). */}
          <Logo height={32} word />
        </Link>

        <CitySelector onHero={onHero} />

        {/* Desktop dropdown menus */}
        {/* ۸ اکتبر — منو وسطِ نوار: دو فاصلهٔ کشسان در دو طرف، پس لوگو/شهر راست و
            دکمه‌های اقدام چپ می‌مانند و منو دقیقاً در مرکزِ نوار می‌نشیند. */}
        <div style={{ flex: 1 }} />
        <div className="mj-navlinks" style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 14.5, fontWeight: 600 }}>
          {MENUS.map(m => m.href && !m.items ? (
            <Link key={m.label} href={m.href} style={{ display: 'flex', alignItems: 'center', padding: '9px 13px', borderRadius: 9, color: navText, textShadow: navShadow, textDecoration: 'none', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 600 }}>{m.label}</Link>
          ) : (
            <div key={m.label} style={{ position: 'relative' }} onMouseEnter={() => openMenu(m.label)} onMouseLeave={scheduleClose}>
              <button onClick={() => (open === m.label ? setOpen(null) : openMenu(m.label))} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 13px', borderRadius: 9, color: open === m.label ? 'var(--text)' : navText, textShadow: open === m.label ? undefined : navShadow, background: open === m.label ? 'var(--surface)' : 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 600 }}>
                {m.label}<span style={{ display: 'flex', opacity: .75 }}><IconSvg name="chevronDown" size={11} /></span>
              </button>
              {open === m.label && (
                // ظرفِ بیرونی از لبهٔ دکمه شروع می‌شود (top:100%، بدونِ فاصلهٔ مُرده) و فاصلهٔ بصری را با
                // paddingTop می‌سازد؛ آن ۸px شفاف ولی قابلِ‌هاور است، پس عبورِ نشانگر منو را نمی‌بندد.
                <div style={{ position: 'absolute', top: '100%', insetInlineEnd: 0, paddingTop: 8, minWidth: 270, zIndex: 60 }}>
                  {/* ۸ اکتبر — پنلِ سفیدِ وسطِ یک صفحهٔ تیره بد می‌نشست. روی هیرو شیشه‌ایِ تیره
                      می‌شود (هم‌رنگِ روکشِ خودِ هیرو) و جای دیگر از توکنِ تم می‌گیرد. رنگِ متن هم
                      با همان حالت می‌آید، وگرنه دوباره «متنِ تیره روی شیشهٔ تیره» می‌شد. */}
                  {/* فاز ۳۲۰ — منوی شیشه‌ای «همه‌جا» (نه فقط هیرو): توکن‌های --hero-nav-pop-* تم‌آگاه‌اند
                      (شیشهٔ سفید در روز، آبی‌تیره در شب) و روی هر صفحه‌ای درست می‌نشینند. */}
                  <div style={{ background: 'var(--hero-nav-pop-bg)', border: '1px solid var(--hero-nav-pop-brd)', color: 'var(--hero-nav-pop-text)', borderRadius: 16, boxShadow: '0 20px 56px -14px rgba(0,0,0,.55), inset 0 1px 0 var(--hero-nav-pop-hi)', padding: 8, maxHeight: '76vh', overflowY: 'auto', backdropFilter: 'blur(26px) saturate(1.5)', WebkitBackdropFilter: 'blur(26px) saturate(1.5)' }}>
                    {(m.items || []).map(it => (
                      <Link key={it.label + it.href} href={it.href} onClick={() => setOpen(null)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 11, textDecoration: 'none', color: 'inherit' }} className="mj-menu-item">
                        <GlassIcon name={it.ic} size={38} box={19} tone="theme" />
                        <span style={{ flex: 1 }}>
                          <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--hero-nav-pop-text)' }}>{it.label}</span>
                          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--hero-nav-pop-dim)', marginTop: 2 }}>{it.desc}</span>
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
          <ThemeToggle size={40} onHero={onHero} />
          {me ? (
            <>
              <button onClick={logout} title="خروج از حساب" style={{ padding: '0 14px', height: 40, display: 'flex', alignItems: 'center', borderRadius: 11, border: onHero ? '1px solid var(--hero-nav-brd)' : '1px solid var(--line2)', background: 'transparent', color: navDim, textShadow: navShadow, fontFamily: 'inherit', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>خروج</button>
              {me.dash !== '/buyer' && <Link href="/content" title="مقالاتِ من" style={{ padding: '0 14px', height: 40, display: 'flex', alignItems: 'center', borderRadius: 11, border: onHero ? '1px solid var(--hero-nav-brd)' : '1px solid var(--line2)', background: 'transparent', color: navText, textShadow: navShadow, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>✎ مقالات</Link>}
              <Link href={me.dash} style={{ padding: '0 18px', height: 40, display: 'flex', alignItems: 'center', borderRadius: 11, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>{dashLabel}</Link>
            </>
          ) : (
            <>
              <button onClick={() => openAuth()} style={{ padding: '0 16px', height: 40, display: 'flex', alignItems: 'center', borderRadius: 11, border: onHero ? '1px solid var(--hero-nav-brd)' : '1px solid var(--line2)', background: 'transparent', color: navText, textShadow: navShadow, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 }}>ورود / ثبت‌نام</button>
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
          {MENUS.map(m => m.href && !m.items ? (
            <Link key={m.label} href={m.href} onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '13px 12px', borderRadius: 10, color: 'var(--text)', textDecoration: 'none', fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}>{m.label}</Link>
          ) : (
            <div key={m.label}>
              <button onClick={() => setMobOpen(o => o === m.label ? null : m.label)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 12px', borderRadius: 10, color: 'var(--text)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}>
                {m.label}<span style={{ fontSize: 11, color: 'var(--muted)' }}>{mobOpen === m.label ? '−' : '+'}</span>
              </button>
              {mobOpen === m.label && (m.items || []).map(it => (
                <Link key={it.label + it.href} href={it.href} onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px 10px 22px', borderRadius: 10, textDecoration: 'none', color: 'inherit' }}>
                  <GlassIcon name={it.ic} size={30} box={16} />
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
      <style>{`.mj-menu-item:hover{background:rgba(221,194,122,.16)}`}</style>
    </header>
  )
}
