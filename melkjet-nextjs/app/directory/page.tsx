'use client'

import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import { useState } from 'react'

const categories = [
  { id: 'مشاور', label: 'مشاور', count: '۱۸٬۵۰۰' },
  { id: 'آژانس', label: 'آژانس', count: '۹۴۰' },
  { id: 'سازنده', label: 'سازنده', count: '۱٬۲۴۰' },
  { id: 'مصالح', label: 'مصالح', count: '۳٬۲۰۰' },
  { id: 'معمار', label: 'معمار', count: '۲٬۱۰۰' },
  { id: 'پیمانکار', label: 'پیمانکار', count: '۱٬۸۰۰' },
  { id: 'کارشناس', label: 'کارشناس', count: '۸۴۰' },
  { id: 'حقوقی', label: 'حقوقی', count: '۱٬۱۰۰' },
  { id: 'بانک', label: 'بانک', count: '۳۲۰' },
  { id: 'دفترخانه', label: 'دفترخانه', count: '۶۸۰' },
]

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

  const filteredProfessionals = professionals.filter(
    (p) => p.category === activeCategory
  )

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
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
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
                  {cat.label}
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: isActive ? 'var(--gold2, var(--gold))' : 'var(--faint)',
                    fontWeight: 400,
                  }}
                >
                  {cat.count}
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
            {activeCategory === 'مشاور'
              ? `${filteredProfessionals.length} متخصص یافت شد`
              : 'نتایج دسته‌بندی'}
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
        {filteredProfessionals.length > 0 ? (
          <div
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
  id: number
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
  coverGradient: string
  avatarGradient: string
}

function ProfessionalCard({ pro }: { pro: Professional }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--surface)',
        border: pro.promoted
          ? '1px solid var(--gold)'
          : '1px solid var(--line)',
        borderRadius: '16px',
        overflow: 'hidden',
        position: 'relative',
        transition: 'transform 0.2s, box-shadow 0.2s',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered
          ? '0 12px 40px var(--shadow)'
          : '0 2px 8px var(--shadow)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Cover */}
      <div
        style={{
          height: '74px',
          background: pro.coverGradient,
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {/* Promoted Badge */}
        {pro.promoted && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold2, #c8a03c) 100%)',
              color: '#1a1200',
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '3px 9px',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              letterSpacing: '0.01em',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            ★ پروموت
          </div>
        )}
      </div>

      {/* Body */}
      <div
        style={{
          padding: '0 18px 18px',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
        }}
      >
        {/* Avatar Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: '10px',
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: pro.avatarGradient,
              border: '3px solid var(--bg)',
              marginTop: '-28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 700,
              flexShrink: 0,
              boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
            }}
          >
            {pro.initials}
          </div>

          {/* Verified chip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: '20px',
              padding: '3px 9px',
              fontSize: '0.7rem',
              color: '#22c55e',
              fontWeight: 600,
              marginBottom: '4px',
            }}
          >
            ✓ تأییدشده
          </div>
        </div>

        {/* Name & Role */}
        <h3
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--text)',
            margin: '0 0 2px',
            lineHeight: 1.3,
          }}
        >
          {pro.name}
        </h3>
        <p
          style={{
            fontSize: '0.82rem',
            color: 'var(--muted)',
            margin: '0 0 10px',
          }}
        >
          {pro.role}
        </p>

        {/* Rating & Area */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span style={{ color: 'var(--gold)', fontSize: '0.9rem' }}>★</span>
            <span
              style={{
                fontSize: '0.88rem',
                fontWeight: 700,
                color: 'var(--text)',
              }}
            >
              {pro.rating}
            </span>
          </div>
          <span
            style={{
              fontSize: '0.78rem',
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            📍 {pro.area}
          </span>
        </div>

        {/* Stats Row */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '12px',
            padding: '8px 12px',
            background: 'var(--faint)',
            borderRadius: '8px',
            border: '1px solid var(--line2)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span
              style={{
                fontSize: '0.88rem',
                fontWeight: 700,
                color: 'var(--text)',
              }}
            >
              {pro.deals}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
              معامله
            </span>
          </div>
          <div
            style={{
              width: '1px',
              background: 'var(--line)',
              alignSelf: 'stretch',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span
              style={{
                fontSize: '0.88rem',
                fontWeight: 700,
                color: 'var(--text)',
              }}
            >
              {pro.years}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
              سال سابقه
            </span>
          </div>
        </div>

        {/* Tags */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginBottom: '14px',
          }}
        >
          {pro.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: '0.7rem',
                padding: '3px 9px',
                background: 'var(--faint)',
                border: '1px solid var(--line2)',
                borderRadius: '20px',
                color: 'var(--muted)',
                fontWeight: 500,
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div style={{ marginTop: 'auto' }}>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--gold)',
              textDecoration: 'none',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.75'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1'
            }}
          >
            مشاهده خدمات ←
          </a>
        </div>
      </div>
    </div>
  )
}
