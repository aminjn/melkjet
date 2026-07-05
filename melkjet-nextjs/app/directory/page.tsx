'use client'

import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import RevealContact from '@/app/components/RevealContact'
import PromoBadge from '@/app/components/PromoBadge'
import RepBadges from '@/app/components/RepBadges'
import { useState, useEffect } from 'react'
import { fetchContent, gradientFor, initialsFor, type ContentItem } from '@/app/lib/content-display'

const DEFAULT_CATS = ['مشاور', 'آژانس', 'سازنده', 'مصالح', 'معمار', 'پیمانکار', 'کارشناس', 'حقوقی', 'وکیل', 'بیمه', 'بانک', 'دفترخانه']

function toProfessional(it: ContentItem) {
  return {
    id: it.id,
    name: it.title,
    role: it.category || 'متخصص',
    rating: it.rating || '—',
    area: it.location || '',
    deals: '',
    years: '',
    tags: it.tags || [],
    initials: initialsFor(it.title),
    category: it.category || '',
    promoted: false,
    promoKind: (it as any).promoKind as (string | undefined),
    badges: ((it as any).badges || []) as { id: string; label: string; icon: string; desc?: string }[],
    coverGradient: gradientFor(it.title, 'cover'),
    avatarGradient: gradientFor(it.title, 'avatar'),
    url: it.url,
    phone: it.phone,
    hasPhone: it.hasPhone,
    image: it.image,
    // مسیرِ درستِ نمایشِ شماره را از API بیاور (سازنده→builder، اکانت‌ها→advisor، اسکرپ→item).
    revealKind: (it as any).revealKind as ('item' | 'advisor' | 'builder' | undefined),
    revealId: (it as any).revealId as (string | undefined),
  }
}

const professionals = [
  {
    id: 1,
    name: 'علی رضایی',
    role: 'مشاور ارشد',
    rating: '۴.۹',
    area: 'سعادت‌آباد',
    deals: '۳۲۰',
    years: '۱۴',
    tags: ['لوکس', 'مسکونی', 'سرمایه‌گذاری'],
    initials: 'ع.ر',
    category: 'مشاور',
    promoted: true,
    coverGradient: 'linear-gradient(135deg, #1a3a5c 0%, #2d6a8f 100%)',
    avatarGradient: 'linear-gradient(135deg, #2d6a8f 0%, #4a9ec4 100%)',
  },
  {
    id: 2,
    name: 'سارا احمدی',
    role: 'مشاور مسکونی',
    rating: '۴.۸',
    area: 'زعفرانیه',
    deals: '۲۱۴',
    years: '۸',
    tags: ['مسکونی', 'اجاره'],
    initials: 'س.ا',
    category: 'مشاور',
    promoted: true,
    coverGradient: 'linear-gradient(135deg, #3d1f5c 0%, #7b4fa0 100%)',
    avatarGradient: 'linear-gradient(135deg, #7b4fa0 0%, #a77fd4 100%)',
  },
  {
    id: 3,
    name: 'محمد کریمی',
    role: 'مشاور تجاری',
    rating: '۴.۷',
    area: 'میرداماد',
    deals: '۱۸۶',
    years: '۱۱',
    tags: ['تجاری', 'اداری'],
    initials: 'م.ک',
    category: 'مشاور',
    promoted: false,
    coverGradient: 'linear-gradient(135deg, #1a4a2e 0%, #2d8a52 100%)',
    avatarGradient: 'linear-gradient(135deg, #2d8a52 0%, #4ac47e 100%)',
  },
  {
    id: 4,
    name: 'فاطمه موسوی',
    role: 'مشاور ارشد',
    rating: '۴.۸',
    area: 'ونک',
    deals: '۲۹۸',
    years: '۱۲',
    tags: ['مسکونی', 'لوکس', 'ویلا'],
    initials: 'ف.م',
    category: 'مشاور',
    promoted: false,
    coverGradient: 'linear-gradient(135deg, #5c1a1a 0%, #a03030 100%)',
    avatarGradient: 'linear-gradient(135deg, #a03030 0%, #d46060 100%)',
  },
  {
    id: 5,
    name: 'امیر حسینی',
    role: 'مشاور',
    rating: '۴.۶',
    area: 'جردن',
    deals: '۱۴۳',
    years: '۶',
    tags: ['مسکونی', 'پیش‌فروش'],
    initials: 'ا.ح',
    category: 'مشاور',
    promoted: false,
    coverGradient: 'linear-gradient(135deg, #1a3a4a 0%, #2d6a8f 100%)',
    avatarGradient: 'linear-gradient(135deg, #2d5c8f 0%, #4a80c4 100%)',
  },
  {
    id: 6,
    name: 'نگار صادقی',
    role: 'مشاور ارشد',
    rating: '۴.۹',
    area: 'الهیه',
    deals: '۳۴۱',
    years: '۱۵',
    tags: ['لوکس', 'سرمایه‌گذاری'],
    initials: 'ن.ص',
    category: 'مشاور',
    promoted: false,
    coverGradient: 'linear-gradient(135deg, #3a2a10 0%, #8f6a20 100%)',
    avatarGradient: 'linear-gradient(135deg, #8f6a20 0%, #c4a040 100%)',
  },
]

export default function DirectoryPage() {
  const [activeCategory, setActiveCategory] = useState('مشاور')
  const [searchQuery, setSearchQuery] = useState('')
  const [items, setItems] = useState<ContentItem[]>([])
  const [promoted, setPromoted] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryList, setCategoryList] = useState<string[]>(DEFAULT_CATS)

  // دستهٔ انتخابی از پارامترِ آدرس (?category=) — تا لینک‌های منوی «متخصصان» مستقیم باز شوند.
  useEffect(() => {
    try { const c = new URLSearchParams(window.location.search).get('category'); if (c) setActiveCategory(c) } catch {}
  }, [])

  useEffect(() => {
    fetch('/api/content/categories', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { categories: [] })
      .then(d => {
        const merged = Array.from(new Set([...(d.categories || []), ...DEFAULT_CATS]))
        if (merged.length) setCategoryList(merged)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    // متخصصانِ ثبت‌شده در سایت (اکانت‌های نقش‌دار) + آیتم‌های اسکرپ‌شدهٔ دایرکتوری — یکجا.
    Promise.all([
      fetch(`/api/directory?category=${encodeURIComponent(activeCategory)}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : { items: [] })).then((d) => (d.items || []) as ContentItem[]).catch(() => [] as ContentItem[]),
      fetchContent('directory', activeCategory),
    ]).then(([registered, scraped]) => {
      if (!alive) return
      const seen = new Set<string>()
      const merged = [...registered, ...scraped].filter((it) => { if (seen.has(it.id)) return false; seen.add(it.id); return true })
      setItems(merged); setLoading(false)
    })
    return () => { alive = false }
  }, [activeCategory])

  useEffect(() => {
    let alive = true
    fetch('/api/promotions?slot=directory_top', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => { if (alive) setPromoted((d.items || []) as ContentItem[]) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const promotedIds = new Set(promoted.map((p) => p.id))
  // Promoted profiles lead the list (dedup by id), flagged so the existing badge shows.
  const filteredProfessionals = [...promoted, ...items.filter((p) => !promotedIds.has(p.id))]
    .filter((p) => !searchQuery || p.title.includes(searchQuery) || (p.location || '').includes(searchQuery))
    .map((it) => ({ ...toProfessional(it), promoted: promotedIds.has(it.id) || !!(it as any).promoted }))

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: 'inherit',
      }}
    >
      <Nav />

      {/* Hero Section */}
      <section
        style={{
          background: 'linear-gradient(160deg, var(--bg2) 0%, var(--bg) 100%)',
          borderBottom: '1px solid var(--line)',
          padding: '60px 24px 48px',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 800,
            color: 'var(--text)',
            marginBottom: '12px',
            lineHeight: 1.4,
          }}
        >
          دایرکتوری متخصصان
        </h1>
        <p
          style={{
            fontSize: '1rem',
            color: 'var(--muted)',
            marginBottom: '32px',
            maxWidth: '560px',
            margin: '0 auto 32px',
            lineHeight: 1.7,
          }}
        >
          بزرگ‌ترین بانک اطلاعاتی متخصصان صنعت ساختمان و مسکن
        </p>
        <div
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            position: 'relative',
          }}
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در دایرکتوری متخصصان..."
            style={{
              width: '100%',
              padding: '16px 20px 16px 52px',
              fontSize: '1rem',
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: '12px',
              color: 'var(--text)',
              outline: 'none',
              boxSizing: 'border-box',
              boxShadow: '0 4px 24px var(--shadow)',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--gold)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--line)'
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: '18px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--muted)',
              fontSize: '1.1rem',
              pointerEvents: 'none',
            }}
          >
            🔍
          </span>
        </div>
      </section>

      {/* Sticky Tab Bar */}
      <div
        className="mjdir-cats"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'var(--navbg, var(--bg2))',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--line)',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '4px',
            padding: '10px 20px',
            minWidth: 'max-content',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {categoryList.map((cat) => {
            const isActive = activeCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: isActive
                    ? '1px solid var(--gold)'
                    : '1px solid transparent',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(var(--gold-rgb, 200,160,60), 0.12) 0%, rgba(var(--gold-rgb, 200,160,60), 0.06) 100%)'
                    : 'transparent',
                  color: isActive ? 'var(--gold)' : 'var(--muted)',
                  cursor: 'pointer',
                  transition: 'all 0.18s',
                  whiteSpace: 'nowrap',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--faint)'
                    e.currentTarget.style.color = 'var(--text)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'var(--muted)'
                  }
                }}
              >
                <span style={{ fontSize: '0.9rem', fontWeight: isActive ? 700 : 500 }}>
                  {cat}
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: isActive ? 'var(--gold2, var(--gold))' : 'var(--faint)',
                    fontWeight: 400,
                  }}
                >
                  {isActive ? `${filteredProfessionals.length}` : ''}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content */}
      <main
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '36px 24px 64px',
        }}
      >
        {/* Results Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
          }}
        >
          <h2
            style={{
              fontSize: '1.05rem',
              fontWeight: 700,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            {loading ? 'در حال بارگذاری…' : `${filteredProfessionals.length} مورد در «${activeCategory}»`}
          </h2>
          <span
            style={{
              fontSize: '0.85rem',
              color: 'var(--muted)',
            }}
          >
            مرتب‌سازی: بهترین امتیاز
          </span>
        </div>

        {/* Cards Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--muted)' }}>
            در حال بارگذاری…
          </div>
        ) : filteredProfessionals.length > 0 ? (
          <div
            className="mjdir-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '20px',
            }}
          >
            {filteredProfessionals.map((pro) => (
              <ProfessionalCard key={pro.id} pro={pro} />
            ))}
          </div>
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: '80px 24px',
              color: 'var(--muted)',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.4 }}>
              🔍
            </div>
            <h3
              style={{
                fontSize: '1.2rem',
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: '8px',
              }}
            >
              نتایجی یافت نشد
            </h3>
            <p style={{ fontSize: '0.95rem', color: 'var(--muted)', margin: 0 }}>
              در حال حاضر متخصصی در دسته‌بندی «{activeCategory}» ثبت نشده است.
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

type Professional = {
  id: string
  name: string
  role: string
  rating: string
  area: string
  deals: string
  years: string
  tags: string[]
  initials: string
  category: string
  promoted: boolean
  promoKind?: string
  badges?: { id: string; label: string; icon: string; desc?: string }[]
  coverGradient: string
  avatarGradient: string
  url?: string
  phone?: string
  hasPhone?: boolean
  image?: string
  revealKind?: 'item' | 'advisor' | 'builder'
  revealId?: string
}

function ProfessionalCard({ pro }: { pro: Professional }) {
  const [hovered, setHovered] = useState(false)
  const hasArea = !!(pro.area && pro.area.trim())
  const hasRating = !!(pro.rating && pro.rating !== '—')
  const cat = (pro.category || pro.role || '').trim()
  const href = pro.url || `/profile/${pro.id}`
  const external = !!pro.url && !pro.url.startsWith('/')

  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block', textDecoration: 'none', color: 'inherit',
        background: 'var(--surface)',
        border: `1px solid ${pro.promoted || hovered ? 'var(--gold)' : 'var(--line)'}`,
        borderRadius: 14, padding: 14,
        transition: 'transform .18s, box-shadow .18s, border-color .18s',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? '0 12px 34px -14px rgba(201,168,76,0.22)' : '0 2px 10px -6px rgba(0,0,0,0.3)',
      }}
    >
      {/* ردیفِ بالا: آواتار + اطلاعات */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{
          width: 54, height: 54, borderRadius: 14, flexShrink: 0,
          background: pro.image ? `center/cover no-repeat url(${pro.image})` : pro.avatarGradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 800, overflow: 'hidden',
        }}>
          {!pro.image && pro.initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pro.name}</span>
            {pro.badges?.some(b => b.id === 'verified') && <span title="پروفایلِ کامل و تأییدشده" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: 'rgba(95,217,138,0.15)', color: '#5fd98a', fontSize: 10, fontWeight: 800 }}>✓</span>}
            {pro.promoted && <span style={{ flexShrink: 0 }}><PromoBadge kind={pro.promoKind || 'ویژه'} size="sm" /></span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)' }}>
            {cat && <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{cat}</span>}
            {hasArea && <><span style={{ color: 'var(--faint)' }}>·</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}><path d="M6 1a3.5 3.5 0 0 1 3.5 3.5C9.5 7.5 6 11 6 11S2.5 7.5 2.5 4.5A3.5 3.5 0 0 1 6 1z" stroke="currentColor" strokeWidth="1.2" /></svg>
              {pro.area}</span></>}
            {hasRating && <><span style={{ color: 'var(--faint)' }}>·</span><span style={{ color: 'var(--text)', fontWeight: 700 }}>★ {pro.rating}</span></>}
          </div>
          {(pro.badges?.filter(b => b.id !== 'verified').length ?? 0) > 0 && (
            <div style={{ marginTop: 8 }}><RepBadges badges={pro.badges!.filter(b => b.id !== 'verified')} size="sm" /></div>
          )}
          {pro.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
              {pro.tags.slice(0, 3).map((tag) => (
                <span key={tag} style={{ fontSize: 10.5, padding: '2px 8px', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 999, color: 'var(--muted)', fontWeight: 500 }}>{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* فوتر: نمایشِ شماره + مشاهدهٔ پروفایل */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
        {pro.hasPhone
          ? <div onClick={(e) => { e.preventDefault(); e.stopPropagation() }}><RevealContact kind={pro.revealKind || 'item'} id={pro.revealId || String(pro.id)} compact label="نمایشِ شماره" /></div>
          : <span style={{ fontSize: 12, color: 'var(--faint)' }}>پروفایل و خدمات</span>}
        <span style={{ fontSize: 12.5, color: 'var(--gold)', fontWeight: 700, whiteSpace: 'nowrap' }}>مشاهده ←</span>
      </div>
    </a>
  )
}
