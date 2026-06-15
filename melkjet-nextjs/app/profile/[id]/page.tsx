'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'

// ─── Mock data ──────────────────────────────────────────────────────────────

const mockAdvisors: Record<string, {
  id: string; name: string; title: string; agency: string; city: string;
  bio: string; avatar: string; badge: string; verified: boolean;
  rating: number; reviews: number; deals: number; years: number; responseTime: string;
  specialties: string[]; areas: string[]; certs: string[];
  stats: { label: string; value: string; icon: string }[];
  listings: {
    id: string; title: string; location: string; price: string;
    size: string; beds: string; year: string; tag: string; score: number;
    img: string;
  }[];
  reviewList: {
    id: number; author: string; rating: number; date: string;
    text: string; propertyTitle: string; avatar: string;
  }[];
  contactAvailability: string[];
}> = {
  '1': {
    id: '1',
    name: 'سارا محمدی',
    title: 'مشاور ارشد لوکس',
    agency: 'آژانس الماس تهران',
    city: 'تهران · سعادت‌آباد',
    bio: 'با بیش از ۱۲ سال تجربه در حوزه مسکن لوکس تهران، تخصص اصلی من خرید و فروش آپارتمان‌های سطح بالا در مناطق شمالی شهر است. در این مدت بیش از ۳۴۰ معامله موفق را به سرانجام رسانده‌ام و همواره رضایت مشتریان را در اولویت قرار داده‌ام. با دانش کاملی از بازار مسکن تهران و تسلط بر قوانین مالکیت، آماده‌ام تا بهترین مشاوره را در اختیار شما قرار دهم.',
    avatar: 'linear-gradient(135deg,#caa86a,#8a6f3e)',
    badge: 'طلایی',
    verified: true,
    rating: 4.9,
    reviews: 128,
    deals: 340,
    years: 12,
    responseTime: '۳۰ دقیقه',
    specialties: ['آپارتمان لوکس', 'ویلا', 'پنت‌هاوس', 'ملک تجاری', 'سرمایه‌گذاری'],
    areas: ['سعادت‌آباد', 'زعفرانیه', 'نیاوران', 'اوین', 'فرمانیه', 'ولنجک'],
    certs: ['مجوز رسمی کانون مشاوران', 'گواهینامه ارزیابی ملک', 'دوره تخصصی بازار مسکن', 'عضو اتحادیه مشاوران تهران'],
    stats: [
      { label: 'معامله موفق', value: '۳۴۰', icon: '✓' },
      { label: 'سال تجربه', value: '۱۲', icon: '◈' },
      { label: 'امتیاز مشتریان', value: '۴.۹', icon: '★' },
      { label: 'زمان پاسخ', value: '۳۰ دقیقه', icon: '⟳' },
    ],
    listings: [
      { id: '1', title: 'آپارتمان ۱۴۰ متری نوساز', location: 'سعادت‌آباد، تهران', price: '۱۷.۸ میلیارد', size: '۱۴۰', beds: '۳', year: '۱۴۰۲', tag: 'ویژه', score: 96, img: 'linear-gradient(135deg,#3a3530,#211e1b)' },
      { id: '7', title: 'پنت‌هاوس دوبلکس ویو‌دار', location: 'زعفرانیه، تهران', price: '۸۵ میلیارد', size: '۲۶۰', beds: '۴', year: '۱۴۰۳', tag: 'لوکس', score: 98, img: 'linear-gradient(135deg,#33303a,#1d1b22)' },
      { id: '8', title: 'آپارتمان بازسازی‌شده', location: 'نیاوران، تهران', price: '۲۴ میلیارد', size: '۱۸۰', beds: '۳', year: '۱۳۹۸', tag: '', score: 91, img: 'linear-gradient(135deg,#2f3a34,#1b211e)' },
      { id: '9', title: 'ویلای باغ شمال', location: 'نوشهر، مازندران', price: '۳۲ میلیارد', size: '۳۵۰', beds: '۵', year: '۱۴۰۰', tag: 'ویژه', score: 94, img: 'linear-gradient(135deg,#2c343a,#1a1f23)' },
      { id: '10', title: 'آپارتمان اداری', location: 'سعادت‌آباد، تهران', price: '۱۲ میلیارد', size: '۱۱۰', beds: '۲', year: '۱۴۰۱', tag: '', score: 87, img: 'linear-gradient(135deg,#34323c,#1e1d23)' },
      { id: '11', title: 'خانه ویلایی دوبلکس', location: 'فرمانیه، تهران', price: '۴۸ میلیارد', size: '۴۲۰', beds: '۵', year: '۱۳۹۵', tag: 'فرصت', score: 89, img: 'linear-gradient(135deg,#3a3530,#261f1a)' },
    ],
    reviewList: [
      { id: 1, author: 'رضا احمدی', rating: 5, date: '۱۵ خرداد ۱۴۰۵', text: 'سارا خانم واقعاً حرفه‌ای هستند. در خرید آپارتمانمان در سعادت‌آباد تمام مراحل را با دقت و صبر پیگیری کردند. از قیمت‌گذاری تا مشاوره حقوقی، همه‌چیز عالی بود.', propertyTitle: 'آپارتمان ۱۴۰ متری سعادت‌آباد', avatar: 'ر' },
      { id: 2, author: 'مریم کریمی', rating: 5, date: '۸ اردیبهشت ۱۴۰۵', text: 'بهترین تجربه خرید ملک در عمرم! ایشان نه‌تنها در پیدا کردن ملک مناسب کمک کردند، بلکه در مذاکره قیمت هم عالی عمل کردند. قطعاً دوباره با سارا خانم کار می‌کنم.', propertyTitle: 'پنت‌هاوس زعفرانیه', avatar: 'م' },
      { id: 3, author: 'علیرضا صادقی', rating: 4, date: '۲۲ فروردین ۱۴۰۵', text: 'مشاوره خوبی داشتند. تنها نکته اینکه گاهی در برگرداندن تماس کمی تاخیر داشتند. ولی در کل راضی بودم و معامله به خوبی انجام شد.', propertyTitle: 'آپارتمان نیاوران', avatar: 'ع' },
      { id: 4, author: 'فاطمه نوری', rating: 5, date: '۵ اسفند ۱۴۰۴', text: 'ممنون از زحمات سارا خانم. فروش خانه‌ام در کمتر از ۳ هفته انجام شد با بالاترین قیمت ممکن. دانش ایشان از بازار واقعاً تحسین‌برانگیز است.', propertyTitle: 'ویلای فرمانیه', avatar: 'ف' },
      { id: 5, author: 'کاوه مرادی', rating: 5, date: '۱۸ بهمن ۱۴۰۴', text: 'برای خرید اولین خانه‌ام به سارا خانم مراجعه کردم. با حوصله تمام سوالاتم را پاسخ دادند و کمکم کردند بهترین تصمیم را بگیرم. واقعاً متخصص و قابل اعتماد.', propertyTitle: 'آپارتمان سعادت‌آباد', avatar: 'ک' },
    ],
    contactAvailability: ['شنبه تا چهارشنبه', '۹ صبح تا ۷ شب', 'جمعه با هماهنگی قبلی'],
  },
}

const defaultAdvisor = mockAdvisors['1']

// ─── Component ───────────────────────────────────────────────────────────────

type Tab = 'listings' | 'reviews' | 'about' | 'contact'

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          style={{
            fontSize: size,
            color: i <= Math.floor(rating) ? 'var(--gold)' :
              i === Math.ceil(rating) && rating % 1 > 0 ? 'var(--goldDim)' : 'var(--line2)',
          }}
        >
          ★
        </span>
      ))}
    </div>
  )
}

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const advisor = mockAdvisors[id] ?? defaultAdvisor

  const [activeTab, setActiveTab] = useState<Tab>('listings')
  const [contactForm, setContactForm] = useState({ name: '', phone: '', message: '' })
  const [formSent, setFormSent] = useState(false)
  const [formError, setFormError] = useState('')

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'listings', label: 'آگهی‌ها', icon: '⌂' },
    { id: 'reviews', label: 'نظرات', icon: '★' },
    { id: 'about', label: 'درباره', icon: '◈' },
    { id: 'contact', label: 'تماس', icon: '✉' },
  ]

  function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!contactForm.name.trim() || !contactForm.phone.trim() || !contactForm.message.trim()) {
      setFormError('لطفاً تمام فیلدها را پر کنید.')
      return
    }
    setFormError('')
    setFormSent(true)
    setContactForm({ name: '', phone: '', message: '' })
  }

  const avgRating = advisor.reviewList.reduce((sum, r) => sum + r.rating, 0) / advisor.reviewList.length
  const ratingDistribution = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: advisor.reviewList.filter(r => r.rating === star).length,
    pct: Math.round((advisor.reviewList.filter(r => r.rating === star).length / advisor.reviewList.length) * 100),
  }))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Nav />

      {/* Breadcrumb */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 24px 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
        <Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>خانه</Link>
        <span style={{ color: 'var(--faint)' }}>›</span>
        <Link href="/directory" style={{ color: 'var(--muted)', textDecoration: 'none' }}>مشاوران</Link>
        <span style={{ color: 'var(--faint)' }}>›</span>
        <span style={{ color: 'var(--text)' }}>{advisor.name}</span>
      </div>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 24px 0' }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24,
          overflow: 'hidden', position: 'relative',
        }}>
          {/* Banner gradient */}
          <div style={{
            height: 140, background: 'linear-gradient(135deg, #1a1710 0%, #2a2318 40%, #1e1c14 100%)',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 18px, rgba(201,168,76,0.04) 18px, rgba(201,168,76,0.04) 19px)',
            }} />
            <div style={{
              position: 'absolute', bottom: -40, right: -40, width: 200, height: 200,
              borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)',
            }} />
            {advisor.verified && (
              <div style={{
                position: 'absolute', top: 16, left: 16,
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(80,200,120,0.12)', border: '1px solid rgba(80,200,120,0.3)',
                borderRadius: 999, padding: '5px 12px', fontSize: 12, color: '#50c878',
              }}>
                <span style={{ fontWeight: 800 }}>✓</span>
                <span style={{ fontWeight: 600 }}>مشاور تأییدشده</span>
              </div>
            )}
          </div>

          {/* Profile info row */}
          <div style={{ padding: '0 28px 28px', display: 'flex', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
            {/* Avatar */}
            <div style={{
              width: 100, height: 100, borderRadius: '50%',
              background: advisor.avatar, flexShrink: 0,
              border: '4px solid var(--surface)',
              marginTop: -50, position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36, fontWeight: 800, color: '#1a1710',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              {advisor.name.charAt(0)}
              {/* badge */}
              <div style={{
                position: 'absolute', bottom: 2, right: 2,
                width: 26, height: 26, borderRadius: '50%',
                background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                border: '2px solid var(--surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12,
              }}>
                ✦
              </div>
            </div>

            {/* Name + details */}
            <div style={{ flex: 1, minWidth: 220, paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{advisor.name}</h1>
                <span style={{
                  padding: '3px 11px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                  background: 'var(--goldDim)', color: 'var(--gold)', border: '1px solid var(--line)',
                }}>
                  {advisor.badge} ✦
                </span>
              </div>
              <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 6 }}>
                {advisor.title} · {advisor.agency}
              </div>
              <div style={{ fontSize: 13, color: 'var(--faint)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📍</span>
                <span>{advisor.city}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <StarRating rating={advisor.rating} size={15} />
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>{advisor.rating}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>({advisor.reviews} نظر)</span>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {advisor.stats.map(stat => (
                <div key={stat.label} style={{
                  background: 'var(--bg2)', border: '1px solid var(--line)',
                  borderRadius: 14, padding: '12px 18px', textAlign: 'center', minWidth: 80,
                }}>
                  <div style={{ fontSize: 18, color: 'var(--gold)', marginBottom: 4 }}>{stat.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>{stat.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* CTA buttons */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
              <button
                onClick={() => setActiveTab('contact')}
                style={{
                  padding: '11px 22px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                  color: '#16140f', fontWeight: 700, fontSize: 14,
                  boxShadow: '0 6px 20px -8px var(--gold)',
                }}
              >
                تماس با مشاور
              </button>
              <button style={{
                padding: '11px 18px', borderRadius: 12,
                border: '1px solid var(--line)', background: 'transparent',
                color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}>
                ↗ اشتراک
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs + Content ──────────────────────────────────────── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 24px 60px', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>

        {/* LEFT MAIN CONTENT */}
        <div>
          {/* Tab bar */}
          <div style={{
            display: 'flex', gap: 4, background: 'var(--surface)',
            border: '1px solid var(--line)', borderRadius: 14, padding: 5, marginBottom: 24,
          }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: activeTab === tab.id ? 'var(--goldDim)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--gold)' : 'var(--muted)',
                  fontWeight: activeTab === tab.id ? 700 : 500, fontSize: 14, transition: '.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* ── Tab: Listings ─────────────────────────────────── */}
          {activeTab === 'listings' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>آگهی‌های فعال</h2>
                  <p style={{ color: 'var(--muted)', marginTop: 4, fontSize: 13 }}>{advisor.listings.length} ملک در لیست</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['همه', 'خرید', 'اجاره'].map(f => (
                    <button key={f} style={{
                      padding: '7px 14px', borderRadius: 9, border: '1px solid var(--line)',
                      background: f === 'همه' ? 'var(--goldDim)' : 'var(--surface)',
                      color: f === 'همه' ? 'var(--gold)' : 'var(--muted)',
                      fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                    }}>{f}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18 }}>
                {advisor.listings.map(listing => (
                  <Link key={listing.id} href={`/property/${listing.id}`} style={{
                    display: 'block', textDecoration: 'none',
                    background: 'var(--surface)', border: '1px solid var(--line)',
                    borderRadius: 16, overflow: 'hidden', transition: 'border-color 0.2s',
                  }}
                    onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--gold)'}
                    onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--line)'}
                  >
                    {/* Image area */}
                    <div style={{ position: 'relative', height: 160, background: listing.img }}>
                      {listing.tag && (
                        <span style={{
                          position: 'absolute', top: 10, right: 10,
                          padding: '3px 10px', borderRadius: 8,
                          background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                          color: '#16140f', fontSize: 11, fontWeight: 800,
                        }}>{listing.tag}</span>
                      )}
                      <div style={{
                        position: 'absolute', top: 10, left: 10,
                        padding: '3px 10px', borderRadius: 8,
                        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
                        color: 'var(--gold)', fontSize: 11, fontWeight: 700,
                      }}>✦ {listing.score}</div>
                    </div>
                    {/* Card body */}
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6, lineHeight: 1.4 }}>
                        {listing.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                        📍 {listing.location}
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                        {[
                          { icon: '⬛', val: `${listing.size} م²` },
                          { icon: '🛏', val: `${listing.beds} خواب` },
                          { icon: '📅', val: listing.year },
                        ].map(spec => (
                          <span key={spec.val} style={{
                            fontSize: 11.5, color: 'var(--muted)',
                            background: 'var(--bg2)', border: '1px solid var(--line)',
                            borderRadius: 6, padding: '3px 8px',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                            {spec.val}
                          </span>
                        ))}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold)' }}>
                        {listing.price} تومان
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── Tab: Reviews ──────────────────────────────────── */}
          {activeTab === 'reviews' && (
            <div>
              <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 800 }}>نظرات مشتریان</h2>

              {/* Rating summary */}
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: 18, padding: 24, marginBottom: 24,
                display: 'grid', gridTemplateColumns: '160px 1fr', gap: 24, alignItems: 'center',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 56, fontWeight: 900, color: 'var(--gold)', lineHeight: 1, letterSpacing: '-2px' }}>
                    {avgRating.toFixed(1)}
                  </div>
                  <StarRating rating={avgRating} size={18} />
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
                    از {advisor.reviews} نظر
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ratingDistribution.map(({ star, count, pct }) => (
                    <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, color: 'var(--muted)', width: 16, textAlign: 'center' }}>{star}</span>
                      <span style={{ color: 'var(--gold)', fontSize: 12 }}>★</span>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--line)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 3, width: `${pct}%`,
                          background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                          transition: '.4s',
                        }} />
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--faint)', width: 24, textAlign: 'left' }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Review cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {advisor.reviewList.map(review => (
                  <div key={review.id} style={{
                    background: 'var(--surface)', border: '1px solid var(--line)',
                    borderRadius: 16, padding: 20,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                      {/* Avatar */}
                      <div style={{
                        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg,var(--gold2),#8a6f3e)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, fontWeight: 800, color: '#1a1710',
                      }}>
                        {review.avatar}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{review.author}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                              <StarRating rating={review.rating} size={13} />
                              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{review.date}</span>
                            </div>
                          </div>
                          <span style={{
                            padding: '4px 12px', borderRadius: 999, fontSize: 11.5,
                            background: 'var(--goldDim)', color: 'var(--gold)', border: '1px solid var(--line)',
                          }}>
                            {review.propertyTitle}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--text)', lineHeight: 1.8, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                      {review.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Tab: About ────────────────────────────────────── */}
          {activeTab === 'about' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>درباره مشاور</h2>

              {/* Bio */}
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: 18, padding: 24,
              }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--gold)' }}>◈</span> معرفی
                </h3>
                <p style={{ margin: 0, fontSize: 14.5, color: 'var(--text)', lineHeight: 2 }}>
                  {advisor.bio}
                </p>
              </div>

              {/* Specialties */}
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: 18, padding: 24,
              }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--gold)' }}>★</span> تخصص‌ها
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {advisor.specialties.map(s => (
                    <span key={s} style={{
                      padding: '8px 16px', borderRadius: 999, fontSize: 13.5, fontWeight: 600,
                      background: 'var(--goldDim)', color: 'var(--gold)',
                      border: '1px solid rgba(201,168,76,0.3)',
                    }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Coverage areas */}
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: 18, padding: 24,
              }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--gold)' }}>📍</span> محدوده فعالیت
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  {advisor.areas.map(area => (
                    <div key={area} style={{
                      background: 'var(--bg2)', border: '1px solid var(--line)',
                      borderRadius: 10, padding: '10px 14px', fontSize: 13.5, color: 'var(--text)',
                      display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500,
                    }}>
                      <span style={{ color: 'var(--gold)', fontSize: 16 }}>⬡</span>
                      {area}
                    </div>
                  ))}
                </div>
              </div>

              {/* Certificates */}
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: 18, padding: 24,
              }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--gold)' }}>🏆</span> مدارک و گواهینامه‌ها
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {advisor.certs.map((cert, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: 'var(--bg2)', border: '1px solid var(--line)',
                      borderRadius: 12, padding: '12px 16px',
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, color: '#1a1710', fontWeight: 800,
                      }}>
                        ✦
                      </div>
                      <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{cert}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI performance score */}
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: 18, padding: 24,
              }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--gold)' }}>✦</span> امتیازات عملکرد (AI)
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
                  {[
                    { label: 'رضایت مشتری', value: 9.4, max: 10 },
                    { label: 'سرعت پاسخ', value: 9.1, max: 10 },
                    { label: 'دقت قیمت', value: 8.8, max: 10 },
                    { label: 'تجربه کلی', value: 9.6, max: 10 },
                  ].map(metric => {
                    const pct = metric.value / metric.max
                    const r = 30
                    const circ = 2 * Math.PI * r
                    const dash = pct * circ
                    return (
                      <div key={metric.label} style={{ textAlign: 'center' }}>
                        <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto' }}>
                          <svg width={80} height={80} style={{ transform: 'rotate(-90deg)' }}>
                            <circle cx={40} cy={40} r={r} fill="none" stroke="var(--line2)" strokeWidth={6} />
                            <circle cx={40} cy={40} r={r} fill="none" stroke="var(--gold)" strokeWidth={6}
                              strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
                          </svg>
                          <div style={{
                            position: 'absolute', inset: 0, display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            fontSize: 14, fontWeight: 800, color: 'var(--gold)',
                          }}>{metric.value}</div>
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8 }}>{metric.label}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Contact ──────────────────────────────────── */}
          {activeTab === 'contact' && (
            <div>
              <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>تماس با مشاور</h2>
              <p style={{ color: 'var(--muted)', marginTop: 0, marginBottom: 24, fontSize: 14 }}>
                پیام خود را ارسال کنید — ظرف {advisor.responseTime} پاسخ می‌گیرید.
              </p>

              {/* Availability */}
              <div style={{
                background: 'var(--goldDim)', border: '1px solid rgba(201,168,76,0.3)',
                borderRadius: 14, padding: '14px 18px', marginBottom: 24,
                display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
              }}>
                <span style={{ color: 'var(--gold)', fontSize: 18 }}>🕐</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 2 }}>ساعات دسترسی</div>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {advisor.contactAvailability.map(slot => (
                      <span key={slot} style={{ fontSize: 13, color: 'var(--text)' }}>{slot}</span>
                    ))}
                  </div>
                </div>
              </div>

              {formSent ? (
                <div style={{
                  background: 'rgba(80,200,120,0.08)', border: '1px solid rgba(80,200,120,0.3)',
                  borderRadius: 18, padding: 32, textAlign: 'center',
                }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#50c878', marginBottom: 8 }}>پیام شما ارسال شد!</div>
                  <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>
                    {advisor.name} بزودی با شما تماس خواهند گرفت.
                  </div>
                  <button
                    onClick={() => setFormSent(false)}
                    style={{
                      padding: '10px 24px', borderRadius: 12, border: '1px solid var(--line)',
                      background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 14,
                    }}
                  >
                    ارسال پیام جدید
                  </button>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--text)', marginBottom: 7 }}>
                        نام و نام خانوادگی *
                      </label>
                      <input
                        value={contactForm.name}
                        onChange={e => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="مثال: علی احمدی"
                        style={{
                          width: '100%', padding: '11px 14px', borderRadius: 11,
                          border: '1px solid var(--line)', background: 'var(--surface)',
                          color: 'var(--text)', fontSize: 14, outline: 'none',
                          boxSizing: 'border-box',
                        }}
                        onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
                        onBlur={e => (e.target.style.borderColor = 'var(--line)')}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--text)', marginBottom: 7 }}>
                        شماره تماس *
                      </label>
                      <input
                        value={contactForm.phone}
                        onChange={e => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="۰۹۱۲-xxx-xxxx"
                        type="tel"
                        style={{
                          width: '100%', padding: '11px 14px', borderRadius: 11,
                          border: '1px solid var(--line)', background: 'var(--surface)',
                          color: 'var(--text)', fontSize: 14, outline: 'none',
                          boxSizing: 'border-box',
                        }}
                        onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
                        onBlur={e => (e.target.style.borderColor = 'var(--line)')}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--text)', marginBottom: 7 }}>
                      پیام *
                    </label>
                    <textarea
                      value={contactForm.message}
                      onChange={e => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                      placeholder="سلام، می‌خواستم درباره ملک‌هایی که دارید بیشتر بدانم..."
                      rows={5}
                      style={{
                        width: '100%', padding: '12px 14px', borderRadius: 11,
                        border: '1px solid var(--line)', background: 'var(--surface)',
                        color: 'var(--text)', fontSize: 14, outline: 'none',
                        resize: 'vertical', lineHeight: 1.7, boxSizing: 'border-box',
                        fontFamily: 'Vazirmatn, Tahoma, sans-serif',
                      }}
                      onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--line)')}
                    />
                  </div>

                  {/* Quick topic chips */}
                  <div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 8 }}>موضوع پیام (اختیاری):</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {['مشاوره خرید', 'مشاوره فروش', 'اجاره ملک', 'سرمایه‌گذاری', 'ارزیابی ملک'].map(topic => (
                        <button
                          key={topic} type="button"
                          onClick={() => setContactForm(prev => ({
                            ...prev,
                            message: prev.message ? prev.message : `موضوع: ${topic}\n`,
                          }))}
                          style={{
                            padding: '6px 14px', borderRadius: 999, fontSize: 12.5,
                            border: '1px solid var(--line)', background: 'var(--surface)',
                            color: 'var(--muted)', cursor: 'pointer', transition: '.2s',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'var(--gold)'
                            e.currentTarget.style.color = 'var(--gold)'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'var(--line)'
                            e.currentTarget.style.color = 'var(--muted)'
                          }}
                        >
                          {topic}
                        </button>
                      ))}
                    </div>
                  </div>

                  {formError && (
                    <div style={{
                      padding: '10px 14px', borderRadius: 10,
                      background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.25)',
                      fontSize: 13, color: '#e74c3c',
                    }}>
                      {formError}
                    </div>
                  )}

                  <button
                    type="submit"
                    style={{
                      padding: '13px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                      color: '#16140f', fontWeight: 800, fontSize: 15,
                      boxShadow: '0 8px 24px -10px var(--gold)',
                    }}
                  >
                    ✉ ارسال پیام
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'sticky', top: 88 }}>

          {/* Quick contact card */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 18, padding: 22,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, paddingBottom: 18, borderBottom: '1px solid var(--line)' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                background: advisor.avatar, border: '2px solid var(--gold)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 800, color: '#1a1710',
              }}>
                {advisor.name.charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{advisor.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{advisor.agency}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => setActiveTab('contact')}
                style={{
                  width: '100%', padding: '12px', borderRadius: 11, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                  color: '#16140f', fontWeight: 700, fontSize: 13.5,
                }}
              >
                ✉ ارسال پیام
              </button>
              <button style={{
                width: '100%', padding: '11px', borderRadius: 11,
                border: '1px solid var(--line)', background: 'transparent',
                color: 'var(--text)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer',
              }}>
                📞 تماس تلفنی
              </button>
            </div>
            <div style={{ marginTop: 14, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
              معمولاً ظرف {advisor.responseTime} پاسخ می‌دهد
            </div>
          </div>

          {/* Trust signals */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 18, padding: 20,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>دلایل اعتماد</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: '✓', label: 'مشاور تأییدشده ملک‌جت', color: '#50c878' },
                { icon: '★', label: `امتیاز ${advisor.rating} از ۵`, color: 'var(--gold)' },
                { icon: '🔒', label: 'معاملات ایمن تضمینی', color: '#3498db' },
                { icon: '⟳', label: `${advisor.deals}+ معامله موفق`, color: 'var(--gold)' },
              ].map(item => (
                <div key={item.label} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 10,
                  background: 'var(--bg2)', border: '1px solid var(--line)',
                }}>
                  <span style={{ fontSize: 16, color: item.color, width: 20, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Share */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 18, padding: 18,
          }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>اشتراک‌گذاری پروفایل</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {[
                { label: 'تلگرام', color: '#2CA5E0', icon: '✈' },
                { label: 'واتساپ', color: '#25D366', icon: '◉' },
                { label: 'کپی لینک', color: 'var(--muted)', icon: '⎗' },
              ].map(social => (
                <button key={social.label} style={{
                  padding: '9px 6px', borderRadius: 10, border: '1px solid var(--line)',
                  background: 'var(--bg2)', cursor: 'pointer', fontSize: 12,
                  color: social.color, fontWeight: 600, display: 'flex',
                  flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                  <span style={{ fontSize: 16 }}>{social.icon}</span>
                  <span style={{ color: 'var(--muted)' }}>{social.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Similar advisors */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 18, padding: 18,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>مشاوران مشابه</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { name: 'علی رضایی', title: 'مشاور لوکس · ونک', rating: 4.8, deals: 210, id: '2' },
                { name: 'نیلوفر صادقی', title: 'مشاور ارشد · الهیه', rating: 4.7, deals: 178, id: '3' },
                { name: 'کمال فرهادی', title: 'مشاور سرمایه‌گذاری', rating: 4.6, deals: 156, id: '4' },
              ].map(adv => (
                <Link key={adv.id} href={`/profile/${adv.id}`} style={{
                  display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none',
                  padding: '10px 12px', borderRadius: 12, border: '1px solid var(--line)',
                  background: 'var(--bg2)', transition: '.2s',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg,var(--gold2),#6b5520)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 800, color: '#1a1710',
                  }}>
                    {adv.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{adv.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{adv.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: 'var(--gold)' }}>★ {adv.rating}</span>
                      <span style={{ fontSize: 10, color: 'var(--faint)' }}>· {adv.deals} معامله</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>

      <Footer />
    </div>
  )
}
