'use client'

import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import { useParams } from 'next/navigation'

export default function ProjectPage() {
  const params = useParams()
  const id = params?.id

  const milestones = [
    { label: 'پی‌ریزی', state: 'done' },
    { label: 'اسکلت', state: 'done' },
    { label: 'سفت‌کاری', state: 'done' },
    { label: 'نازک‌کاری', state: 'active' },
    { label: 'تحویل', state: 'upcoming' },
  ]

  const gallery = [
    { label: 'نمای بیرونی', bg: 'linear-gradient(135deg, #1a2535, #0d1520)' },
    { label: 'لابی', bg: 'linear-gradient(135deg, #251a0d, #1a1208)' },
    { label: 'نمونه آپارتمان', bg: 'linear-gradient(135deg, #1a2518, #0f1a0d)' },
    { label: 'پارکینگ', bg: 'linear-gradient(135deg, #1f1f2a, #141420)' },
    { label: 'روف‌گاردن', bg: 'linear-gradient(135deg, #1a2520, #0d1a14)' },
    { label: 'استخر', bg: 'linear-gradient(135deg, #0d1e2a, #081318)' },
  ]

  const units = [
    { type: 'یک خوابه', size: '۸۵ م²', floor: '۳-۸', price: '۱۱.۹ م.د', status: 'موجود', statusColor: '#2ecc71', statusBg: 'rgba(46,204,113,0.12)' },
    { type: 'دو خوابه', size: '۱۲۰ م²', floor: '۵-۱۵', price: '۱۶.۸ م.د', status: 'موجود', statusColor: '#2ecc71', statusBg: 'rgba(46,204,113,0.12)' },
    { type: 'دو خوابه', size: '۱۳۵ م²', floor: '۱۰-۱۸', price: '۱۹.۴ م.د', status: 'محدود', statusColor: '#c9a84c', statusBg: 'rgba(201,168,76,0.12)' },
    { type: 'سه خوابه', size: '۱۸۰ م²', floor: '۱۲-۱۸', price: '۲۶.۱ م.د', status: 'محدود', statusColor: '#c9a84c', statusBg: 'rgba(201,168,76,0.12)' },
    { type: 'پنت‌هاوس', size: '۲۸۰ م²', floor: '۱۷-۱۸', price: '۴۵.۰ م.د', status: 'رزرو', statusColor: '#888', statusBg: 'rgba(136,136,136,0.12)' },
  ]

  const reviews = [
    {
      name: 'آقای محمدی',
      stars: 5,
      text: 'کیفیت ساخت فوق‌العاده‌ست. از اول پروژه تا الان همه چیز طبق برنامه پیش رفته. مشاورین شرکت هم خیلی حرفه‌ای بودن.',
      date: '۱۴۰۳/۰۱/۱۵',
      tag: 'خریدار واحد ۱۲۰ متری',
    },
    {
      name: 'خانم رضایی',
      stars: 4,
      text: 'موقعیت مکانی عالیه. دسترسی به مترو و مراکز خرید خیلی راحته. فقط تحویل یه ماه عقب افتاد که بابتش توضیح دادن.',
      date: '۱۴۰۳/۰۲/۰۸',
      tag: 'خریدار واحد ۸۵ متری',
    },
    {
      name: 'آقای صادقی',
      stars: 5,
      text: 'سرمایه‌گذاری خوبیه. قیمت منطقه داره بالا میره و این پروژه خوب قیمت‌گذاری شده.',
      date: '۱۴۰۳/۰۳/۲۲',
      tag: 'سرمایه‌گذار',
    },
  ]

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

      {/* Hero Banner */}
      <div
        style={{
          position: 'relative',
          height: 300,
          background: 'linear-gradient(to bottom, #1a1612, #0f0e0c)',
          overflow: 'hidden',
        }}
      >
        {/* Subtle texture overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,0.015) 40px, rgba(255,255,255,0.015) 41px), repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(255,255,255,0.01) 60px, rgba(255,255,255,0.01) 61px)',
            pointerEvents: 'none',
          }}
        />

        {/* Breadcrumb top */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 32,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'rgba(255,255,255,0.45)',
            zIndex: 2,
          }}
        >
          <span style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.55)' }}>خانه</span>
          <span style={{ color: 'rgba(255,255,255,0.25)' }}>/</span>
          <span style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.55)' }}>پروژه‌ها</span>
          <span style={{ color: 'rgba(255,255,255,0.25)' }}>/</span>
          <span style={{ color: 'rgba(255,255,255,0.8)' }}>برج مروارید</span>
        </div>

        {/* Active pre-sale badge top-left (in RTL, left is the end so this is the left edge visually) */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 32,
            zIndex: 2,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'rgba(34,197,94,0.18)',
              border: '1px solid rgba(34,197,94,0.45)',
              color: '#4ade80',
              fontSize: 12,
              fontWeight: 700,
              backdropFilter: 'blur(8px)',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#4ade80',
                display: 'inline-block',
                boxShadow: '0 0 6px #4ade80',
              }}
            />
            پیش‌فروش فعال
          </span>
        </div>

        {/* Project name centered */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1,
            padding: '0 32px',
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 38,
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '-0.5px',
              textShadow: '0 2px 16px rgba(0,0,0,0.6)',
            }}
          >
            برج مروارید سعادت‌آباد
          </h1>
        </div>

        {/* Builder + location bottom overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '24px 32px 20px',
            background: 'linear-gradient(to top, rgba(10,9,8,0.85) 0%, transparent 100%)',
            zIndex: 2,
            textAlign: 'center',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: 'rgba(255,255,255,0.6)',
              letterSpacing: '0.2px',
            }}
          >
            توسعه‌دهنده: گروه ساختمانی ایران نو &nbsp;|&nbsp; سعادت‌آباد، بلوار مرزداران
          </p>
        </div>
      </div>

      {/* Main layout */}
      <div
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          padding: '40px 24px 80px',
          display: 'grid',
          gridTemplateColumns: '1fr 320px',
          gap: 32,
          alignItems: 'start',
        }}
      >
        {/* ─── LEFT CONTENT ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

          {/* Section 1 — 4 Stats */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 14,
            }}
          >
            {[
              { icon: '⬛', number: '۱۸۲', label: 'واحدها', sub: 'واحد' },
              { icon: '🏢', number: '۱۸', label: 'طبقات', sub: 'طبقه' },
              { icon: '📅', number: '۱۴۰۶', label: 'تحویل', sub: '' },
              { icon: '📈', number: '۳۸٪', label: 'بازده سرمایه', sub: '' },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  padding: '20px 16px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 24 }}>{stat.icon}</span>
                <span
                  style={{
                    fontSize: 26,
                    fontWeight: 900,
                    color: 'var(--gold)',
                    lineHeight: 1,
                  }}
                >
                  {stat.number}
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
                  {stat.label}
                  {stat.sub && (
                    <span style={{ color: 'var(--faint)', marginRight: 3 }}>{stat.sub}</span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {/* Section 2 — Construction progress with milestones */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 18,
              padding: '28px 28px 32px',
            }}
          >
            <h2
              style={{
                margin: '0 0 36px',
                fontSize: 17,
                fontWeight: 800,
                color: 'var(--text)',
              }}
            >
              پیشرفت ساخت
            </h2>

            {/* Milestone track */}
            <div style={{ position: 'relative', padding: '0 28px' }}>
              {/* Background track line */}
              <div
                style={{
                  position: 'absolute',
                  top: 9,
                  right: 28,
                  left: 28,
                  height: 4,
                  background: 'var(--line2)',
                  borderRadius: 2,
                  zIndex: 0,
                }}
              />
              {/* Gold fill — 70% */}
              <div
                style={{
                  position: 'absolute',
                  top: 9,
                  right: 28,
                  width: '70%',
                  height: 4,
                  background: 'linear-gradient(to left, var(--gold), var(--gold2))',
                  borderRadius: 2,
                  zIndex: 1,
                }}
              />

              {/* Dots + labels row */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                {milestones.map((m) => (
                  <div
                    key={m.label}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    {/* Dot */}
                    <div
                      style={{
                        width: m.state === 'active' ? 20 : 16,
                        height: m.state === 'active' ? 20 : 16,
                        borderRadius: '50%',
                        background:
                          m.state === 'upcoming'
                            ? 'var(--bg2)'
                            : 'var(--gold)',
                        border:
                          m.state === 'upcoming'
                            ? '2px solid var(--line2)'
                            : m.state === 'active'
                            ? '3px solid var(--gold)'
                            : '2px solid var(--gold2)',
                        boxShadow:
                          m.state === 'done'
                            ? '0 0 8px rgba(201,168,76,0.4)'
                            : m.state === 'active'
                            ? '0 0 14px rgba(201,168,76,0.7)'
                            : 'none',
                        animation:
                          m.state === 'active'
                            ? 'pulse 1.6s ease-in-out infinite'
                            : 'none',
                        flexShrink: 0,
                        marginTop: m.state === 'active' ? -2 : 0,
                      }}
                    />

                    {/* Label */}
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: m.state === 'active' ? 700 : 500,
                        color:
                          m.state === 'upcoming'
                            ? 'var(--faint)'
                            : m.state === 'active'
                            ? 'var(--gold)'
                            : 'var(--muted)',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      {m.label}
                      {m.state === 'done' && (
                        <span style={{ color: 'var(--gold)', fontSize: 10 }}>✓</span>
                      )}
                      {m.state === 'active' && (
                        <span style={{ color: 'var(--gold)', fontSize: 9, opacity: 0.8 }}>
                          در حال اجرا
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Overall % */}
            <div
              style={{
                marginTop: 28,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: 'var(--bg2)',
                borderRadius: 10,
                border: '1px solid var(--line)',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>پیشرفت کلی پروژه</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--gold)' }}>۷۰٪</span>
            </div>
          </div>

          {/* Section 3 — Gallery 3×2 grid */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 18,
              padding: 24,
            }}
          >
            <h2 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
              گالری تصاویر
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
              }}
            >
              {gallery.map((item) => (
                <div
                  key={item.label}
                  style={{
                    height: 180,
                    borderRadius: 12,
                    background: item.bg,
                    border: '1px solid var(--line)',
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 10,
                      right: 12,
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.9)',
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'rgba(0,0,0,0.4)',
                      backdropFilter: 'blur(4px)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                    }}
                  >
                    🔍
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4 — Available units table */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 18,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid var(--line)' }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
                واحدهای موجود
              </h2>
            </div>

            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.4fr 0.9fr 0.9fr 1.1fr 1fr',
                padding: '12px 24px',
                background: 'var(--bg2)',
                borderBottom: '1px solid var(--line)',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--faint)',
                gap: 8,
              }}
            >
              <span>نوع</span>
              <span>متراژ</span>
              <span>طبقه</span>
              <span>قیمت</span>
              <span>وضعیت</span>
            </div>

            {/* Table rows */}
            {units.map((unit, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 0.9fr 0.9fr 1.1fr 1fr',
                  padding: '15px 24px',
                  borderBottom: i < units.length - 1 ? '1px solid var(--line)' : 'none',
                  fontSize: 13,
                  alignItems: 'center',
                  gap: 8,
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{unit.type}</span>
                <span style={{ color: 'var(--muted)' }}>{unit.size}</span>
                <span
                  style={{
                    color: 'var(--muted)',
                    direction: 'ltr',
                    unicodeBidi: 'embed',
                    display: 'inline-block',
                  }}
                >
                  {unit.floor}
                </span>
                <span style={{ fontWeight: 700, color: 'var(--gold)' }}>{unit.price}</span>
                <span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: unit.statusBg,
                      color: unit.statusColor,
                      fontSize: 11,
                      fontWeight: 700,
                      border: `1px solid ${unit.statusColor}40`,
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: unit.statusColor,
                        display: 'inline-block',
                      }}
                    />
                    {unit.status}
                  </span>
                </span>
              </div>
            ))}
          </div>

          {/* Section 5 — Buyer reviews */}
          <div>
            <h2
              style={{
                margin: '0 0 20px',
                fontSize: 17,
                fontWeight: 800,
                color: 'var(--text)',
              }}
            >
              نظرات خریداران
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {reviews.map((review, i) => (
                <div
                  key={i}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 16,
                    padding: '20px 22px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Avatar */}
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: '50%',
                          background:
                            'linear-gradient(140deg, var(--gold2), var(--gold))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 15,
                          fontWeight: 800,
                          color: '#16140f',
                          flexShrink: 0,
                        }}
                      >
                        {review.name.charAt(review.name.length - 1)}
                      </div>
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: 'var(--text)',
                            marginBottom: 4,
                          }}
                        >
                          {review.name}
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            color: 'var(--faint)',
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: 'var(--bg2)',
                            border: '1px solid var(--line)',
                            display: 'inline-block',
                          }}
                        >
                          {review.tag}
                        </span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'left', flexShrink: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          color: 'var(--gold)',
                          letterSpacing: 1,
                          marginBottom: 4,
                        }}
                      >
                        {Array.from({ length: 5 }).map((_, si) =>
                          si < review.stars ? '★' : '☆'
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--faint)' }}>{review.date}</div>
                    </div>
                  </div>

                  <p
                    style={{
                      margin: 0,
                      fontSize: 13.5,
                      color: 'var(--muted)',
                      lineHeight: 1.8,
                    }}
                  >
                    {review.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── RIGHT SIDEBAR ─── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            position: 'sticky',
            top: 80,
          }}
        >
          {/* Card 1 — Pricing */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 20,
              padding: '26px 22px',
              boxShadow: '0 4px 32px var(--shadow)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: 'var(--muted)',
                marginBottom: 6,
                fontWeight: 500,
              }}
            >
              قیمت شروع از
            </div>
            <div
              style={{
                fontSize: 38,
                fontWeight: 900,
                color: 'var(--gold)',
                lineHeight: 1,
                marginBottom: 10,
              }}
            >
              ۱۴ م.د
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--muted)',
                padding: '9px 12px',
                background: 'rgba(201,168,76,0.08)',
                borderRadius: 8,
                border: '1px solid rgba(201,168,76,0.2)',
                marginBottom: 20,
                lineHeight: 1.55,
              }}
            >
              بازده سرمایه‌گذاری ۳۸٪ در ۳ سال
            </div>

            {/* Primary CTA */}
            <button
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: 12,
                background: 'linear-gradient(140deg, var(--gold2), var(--gold))',
                color: '#16140f',
                fontWeight: 800,
                fontSize: 14,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                marginBottom: 10,
                boxShadow: '0 6px 20px -6px var(--gold)',
                letterSpacing: '0.2px',
              }}
            >
              درخواست بازدید / رزرو واحد
            </button>

            {/* Secondary CTA */}
            <button
              style={{
                width: '100%',
                padding: '12px 0',
                borderRadius: 12,
                background: 'transparent',
                color: 'var(--muted)',
                fontWeight: 600,
                fontSize: 13,
                border: '1px solid var(--line)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                marginBottom: 16,
              }}
            >
              دانلود کاتالوگ پروژه ↓
            </button>

            {/* Urgency text */}
            <div
              style={{
                textAlign: 'center',
                fontSize: 12,
                fontWeight: 700,
                color: '#e05c3a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#e05c3a',
                  display: 'inline-block',
                  animation: 'pulse 1.4s ease-in-out infinite',
                }}
              />
              ۱۲ واحد باقی مانده
            </div>
          </div>

          {/* Card 2 — Builder profile */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 20,
              padding: '22px 22px 18px',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--faint)',
                letterSpacing: '0.6px',
                marginBottom: 18,
                textTransform: 'uppercase',
              }}
            >
              سازنده پروژه
            </div>

            {/* Avatar + name */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background:
                    'linear-gradient(140deg, var(--gold2), var(--gold))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  fontWeight: 900,
                  color: '#16140f',
                  flexShrink: 0,
                  boxShadow: '0 4px 16px -6px var(--gold)',
                }}
              >
                ن
              </div>
              <div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 14,
                    color: 'var(--text)',
                    marginBottom: 4,
                  }}
                >
                  گروه ساختمانی ایران نو
                </div>
                <div style={{ fontSize: 11, color: 'var(--faint)' }}>تأسیس ۱۳۷۸</div>
              </div>
            </div>

            {/* Stats */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                marginBottom: 14,
              }}
            >
              {[
                { value: '۲۳', label: 'پروژه تکمیل‌شده' },
                { value: '۴٬۲۰۰', label: 'واحد تحویلی' },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    textAlign: 'center',
                    padding: '12px 8px',
                    background: 'var(--bg2)',
                    borderRadius: 10,
                    border: '1px solid var(--line)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 900,
                      color: 'var(--gold)',
                      marginBottom: 3,
                    }}
                  >
                    {s.value}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--faint)' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Rating */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                background: 'var(--bg2)',
                borderRadius: 10,
                border: '1px solid var(--line)',
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 16, color: 'var(--gold)' }}>★</span>
              <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--gold)' }}>۴.۸</span>
              <span style={{ fontSize: 12, color: 'var(--faint)' }}>( ۱۴۲ نظر )</span>
            </div>

            {/* Link */}
            <div
              style={{
                textAlign: 'center',
                fontSize: 12,
                color: 'var(--gold)',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '10px 0 0',
                borderTop: '1px solid var(--line)',
              }}
            >
              مشاهده پروفایل سازنده ←
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
