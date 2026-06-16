'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Nav from '@/app/components/Nav'
import { fetchContent, gradientFor, type ContentItem } from '@/app/lib/content-display'

function seedNum(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function toProperty(it: ContentItem) {
  const h = seedNum(it.id)
  const sizeMatch = it.title.match(/(\d+)\s*متر/)
  const priceNum = parseFloat((it.price || '').replace(/[^\d.]/g, '')) || 0
  return {
    id: it.id,
    title: it.title,
    location: it.location || 'نامشخص',
    price: it.price || '—',
    priceNum,
    beds: '—',
    size: sizeMatch ? sizeMatch[1] : '—',
    year: '—',
    tag: '',
    score: 80 + (h % 19),
    img: it.image ? '' : gradientFor(it.title),
    image: it.image,
    url: it.url,
    pinX: 12 + (h % 74),
    pinY: 16 + ((h >> 3) % 66),
    pinColor: ['var(--gold)', '#e7674a', '#5fd98a'][h % 3],
  }
}

const tagColors: Record<string, { bg: string; color: string; border: string }> = {
  ویژه:        { bg: 'rgba(201,168,76,0.18)',  color: '#c9a84c', border: 'rgba(201,168,76,0.45)' },
  لوکس:        { bg: 'rgba(160,100,220,0.18)', color: '#c07eed', border: 'rgba(160,100,220,0.45)' },
  فرصت:        { bg: 'rgba(60,180,100,0.18)',  color: '#4ec97a', border: 'rgba(60,180,100,0.45)' },
  اقتصادی:    { bg: 'rgba(60,180,230,0.15)',  color: '#4ec4e8', border: 'rgba(60,180,230,0.4)' },
  'پیشنهاد AI': { bg: 'rgba(80,140,255,0.15)',  color: '#6ea8ff', border: 'rgba(80,140,255,0.4)' },
}

const aiTags = [
  { label: 'نوع', value: 'آپارتمان' },
  { label: 'متراژ', value: '~۱۳۰ متر' },
  { label: 'منطقه', value: 'سعادت‌آباد' },
  { label: 'بودجه', value: 'زیر ۱۸ م.د' },
  { label: 'امکانات', value: 'آسانسور، پارکینگ' },
]

const amenitiesOptions = ['آسانسور', 'پارکینگ', 'انباری', 'بالکن']

export default function SearchPage() {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [dealType, setDealType] = useState<string>('خرید')
  const [beds, setBeds] = useState<string>('همه')
  const [maxPrice, setMaxPrice] = useState(18)
  const [checkedAmenities, setCheckedAmenities] = useState<string[]>(['آسانسور', 'پارکینگ'])
  const [sortBy, setSortBy] = useState('پیشنهاد ملک‌جت')
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [activePin, setActivePin] = useState<string | null>(null)
  const [properties, setProperties] = useState<ReturnType<typeof toProperty>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetchContent('listing', undefined, 60).then((d) => {
      if (alive) { setProperties(d.map(toProperty)); setLoading(false) }
    })
    return () => { alive = false }
  }, [])

  const toggleAmenity = (a: string) =>
    setCheckedAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])

  const filterCount =
    (dealType !== 'خرید' ? 1 : 0) +
    (beds !== 'همه' ? 1 : 0) +
    (maxPrice !== 50 ? 1 : 0) +
    checkedAmenities.length

  const sortedProperties = [...properties].sort((a, b) => {
    if (sortBy === 'ارزان‌ترین') return a.priceNum - b.priceNum
    if (sortBy === 'گران‌ترین')  return b.priceNum - a.priceNum
    if (sortBy === 'جدیدترین')  return parseInt(b.year) - parseInt(a.year)
    return b.score - a.score
  })

  const activeProperty = properties.find(
    p => p.id === hoveredCard || p.id === activePin
  )

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: "'Vazirmatn', system-ui, sans-serif",
      }}
    >
      <Nav />

      {/* ─── Sticky Search + Filter Bar ─────────────────────────── */}
      <div
        style={{
          position: 'sticky',
          top: 68,
          zIndex: 40,
          background: 'var(--bg2)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        {/* Search row */}
        <div className="mjs-filterbar" style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 24px', display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Search input */}
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{
              position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--gold)', fontSize: 16, pointerEvents: 'none', zIndex: 1,
            }}>✦</span>
            <input
              defaultValue="آپارتمان ۱۳۰ متری در سعادت‌آباد زیر ۱۸ میلیارد با آسانسور و پارکینگ"
              style={{
                width: '100%', height: 48,
                paddingRight: 42, paddingLeft: 110,
                background: 'var(--surface)',
                border: '1.5px solid var(--gold)',
                borderRadius: 12,
                color: 'var(--text)',
                fontSize: 14,
                outline: 'none',
                boxShadow: '0 0 0 3px rgba(201,168,76,0.10)',
                textAlign: 'right',
                fontFamily: 'inherit',
              }}
            />
            <div style={{
              position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'var(--goldDim)',
              color: 'var(--gold)',
              border: '1px solid var(--gold)',
              borderRadius: 8,
              padding: '4px 9px',
              fontSize: 11.5,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              cursor: 'default',
            }}>تفسیر AI ✦</div>
          </div>

          {/* Filter button with count badge */}
          <button
            onClick={() => setFiltersOpen(o => !o)}
            style={{
              height: 48, padding: '0 16px', borderRadius: 12,
              background: filtersOpen ? 'var(--goldDim)' : 'var(--surface)',
              border: `1px solid ${filtersOpen ? 'var(--gold)' : 'var(--line2)'}`,
              color: filtersOpen ? 'var(--gold)' : 'var(--text)',
              cursor: 'pointer', fontSize: 13.5, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 7,
              whiteSpace: 'nowrap', fontFamily: 'inherit',
              transition: 'all 0.18s',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            فیلترها
            {filterCount > 0 && (
              <span style={{
                minWidth: 18, height: 18, borderRadius: 9,
                background: 'var(--gold)', color: '#16140f',
                fontSize: 10.5, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 4px',
              }}>{filterCount}</span>
            )}
          </button>

          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{
              height: 48, padding: '0 12px', borderRadius: 12,
              background: 'var(--surface)', border: '1px solid var(--line2)',
              color: 'var(--text)', fontSize: 13.5,
              cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
            }}
          >
            <option>پیشنهاد ملک‌جت</option>
            <option>ارزان‌ترین</option>
            <option>گران‌ترین</option>
            <option>جدیدترین</option>
          </select>
        </div>

        {/* AI Tags Row */}
        <div style={{
          maxWidth: 1280, margin: '0 auto',
          padding: '0 24px 12px',
          display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span style={{ fontSize: 11.5, color: 'var(--faint)', marginLeft: 4 }}>تشخیص AI:</span>
          {aiTags.map(tag => (
            <span
              key={tag.label}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 11px', borderRadius: 999,
                background: 'var(--goldDim)',
                border: '1px solid rgba(201,168,76,0.28)',
                fontSize: 12.5, color: 'var(--text)',
              }}
            >
              <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{tag.label}:</span>
              <span style={{ color: 'var(--muted)' }}>{tag.value}</span>
            </span>
          ))}
        </div>

        {/* ─── Filter Drawer (collapsible) ─────────────── */}
        <div style={{
          maxHeight: filtersOpen ? 260 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.32s cubic-bezier(0.4,0,0.2,1)',
          borderTop: filtersOpen ? '1px solid var(--line)' : 'none',
          background: 'var(--surface)',
        }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 24px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Row 1: Deal type */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap', fontWeight: 600 }}>نوع معامله:</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {['خرید', 'اجاره', 'رهن', 'پیش‌فروش'].map(type => (
                  <button
                    key={type}
                    onClick={() => setDealType(type)}
                    style={{
                      padding: '7px 16px', borderRadius: 10,
                      border: `1px solid ${dealType === type ? 'var(--gold)' : 'var(--line2)'}`,
                      background: dealType === type ? 'var(--goldDim)' : 'transparent',
                      color: dealType === type ? 'var(--gold)' : 'var(--muted)',
                      cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      fontFamily: 'inherit', transition: 'all 0.15s',
                    }}
                  >{type}</button>
                ))}
              </div>
            </div>

            {/* Row 2: Price slider + Beds */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap', fontWeight: 600 }}>حداکثر قیمت:</span>
                <input
                  type="range" min={2} max={50} step={1}
                  value={maxPrice}
                  onChange={e => setMaxPrice(+e.target.value)}
                  style={{ width: 140, accentColor: 'var(--gold)', cursor: 'pointer' }}
                />
                <span style={{
                  minWidth: 52, padding: '5px 10px', borderRadius: 8,
                  background: 'var(--bg)', border: '1px solid var(--line2)',
                  color: 'var(--gold)', fontWeight: 700, fontSize: 13, textAlign: 'center',
                }}>{maxPrice} م</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap', fontWeight: 600 }}>تعداد خواب:</span>
                <div style={{ display: 'flex', gap: 5 }}>
                  {['همه', '۱', '۲', '۳', '+۴'].map(b => (
                    <button
                      key={b}
                      onClick={() => setBeds(b)}
                      style={{
                        width: 38, height: 36, borderRadius: 9,
                        border: `1px solid ${beds === b ? 'var(--gold)' : 'var(--line2)'}`,
                        background: beds === b ? 'var(--goldDim)' : 'transparent',
                        color: beds === b ? 'var(--gold)' : 'var(--muted)',
                        cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
                        fontFamily: 'inherit', transition: 'all 0.15s',
                      }}
                    >{b}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 3: Amenities */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>امکانات:</span>
              {amenitiesOptions.map(a => (
                <label
                  key={a}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 13px', borderRadius: 9, cursor: 'pointer',
                    border: `1px solid ${checkedAmenities.includes(a) ? 'var(--gold)' : 'var(--line2)'}`,
                    background: checkedAmenities.includes(a) ? 'var(--goldDim)' : 'transparent',
                    color: checkedAmenities.includes(a) ? 'var(--gold)' : 'var(--muted)',
                    fontSize: 13, fontWeight: 500, transition: 'all 0.15s',
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checkedAmenities.includes(a)}
                    onChange={() => toggleAmenity(a)}
                    style={{ accentColor: 'var(--gold)', cursor: 'pointer' }}
                  />
                  {a}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Content (split layout) ────────────────────────── */}
      <div className="mjs-grid" style={{
        maxWidth: 1280, margin: '0 auto', padding: '0 24px 48px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 0,
        alignItems: 'start',
        minHeight: 'calc(100vh - 200px)',
      }}>

        {/* ── RIGHT: Results List ──────────────────────────── */}
        <div style={{ paddingTop: 20, paddingLeft: 12 }}>
          {/* Result count + sort label */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 18,
          }}>
            <div style={{ fontSize: 14, color: 'var(--muted)' }}>
              <span style={{ color: 'var(--gold)', fontWeight: 800, fontSize: 16 }}>۶</span>
              {' '}ملک پیدا شد
            </div>
            <div style={{ fontSize: 13, color: 'var(--faint)' }}>
              مرتب‌سازی: <span style={{ color: 'var(--muted)' }}>{sortBy}</span>
            </div>
          </div>

          {/* loading / empty */}
          {(loading || sortedProperties.length === 0) && (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
              {loading ? 'در حال بارگذاری آگهی‌ها…' : 'هنوز آگهی‌ای ثبت نشده. از پنل مدیریت، منبع اسکرپ اضافه و اجرا کنید.'}
            </div>
          )}

          {/* 2-column card grid */}
          <div className="mjs-cards" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {sortedProperties.map((p, index) => {
              const tc = tagColors[p.tag] || tagColors['ویژه']
              const isHov = hoveredCard === p.id

              // Insert promo card after index 3
              const cards = []
              if (index === 3) {
                cards.push(
                  <div
                    key="promo"
                    style={{
                      gridColumn: '1 / -1',
                      border: '1.5px solid var(--gold)',
                      borderRadius: 14,
                      background: 'var(--goldDim)',
                      padding: '18px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      boxShadow: '0 4px 24px -8px rgba(201,168,76,0.25)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{
                          background: 'var(--gold)', color: '#16140f',
                          fontSize: 10.5, fontWeight: 800,
                          padding: '3px 8px', borderRadius: 6,
                        }}>تبلیغ</span>
                        <span style={{ color: 'var(--gold)', fontWeight: 800, fontSize: 15 }}>برج لوکس آرین</span>
                      </div>
                      <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                        پیش‌فروش از ۱۴ میلیارد · بازده پیش‌بینی ۳۸٪
                      </div>
                    </div>
                    <Link
                      href="/property/promo"
                      style={{
                        flexShrink: 0,
                        padding: '9px 18px', borderRadius: 10,
                        background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                        color: '#16140f', textDecoration: 'none',
                        fontSize: 13, fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >مشاهده ←</Link>
                  </div>
                )
              }

              cards.push(
                <div
                  key={p.id}
                  onMouseEnter={() => setHoveredCard(p.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    borderRadius: 14,
                    border: `1px solid ${isHov ? 'var(--gold)' : 'var(--line)'}`,
                    background: 'var(--surface)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'transform 0.18s, box-shadow 0.18s, border-color 0.18s',
                    transform: isHov ? 'translateY(-4px)' : 'none',
                    boxShadow: isHov
                      ? '0 12px 40px -12px rgba(201,168,76,0.22)'
                      : '0 2px 10px -4px rgba(0,0,0,0.3)',
                  }}
                >
                  <Link href={`/property/${p.id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                    {/* Image placeholder */}
                    <div style={{ height: 156, background: p.image ? `center/cover no-repeat url(${p.image})` : p.img, position: 'relative' }}>
                      {/* Diagonal texture */}
                      <div style={{
                        position: 'absolute', inset: 0,
                        backgroundImage: 'repeating-linear-gradient(135deg,transparent,transparent 9px,rgba(255,255,255,0.022) 9px,rgba(255,255,255,0.022) 10px)',
                      }}/>
                      {/* Bottom gradient */}
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, height: 64,
                        background: 'linear-gradient(to top,rgba(0,0,0,0.5),transparent)',
                      }}/>
                      {/* AI score badge */}
                      <div style={{
                        position: 'absolute', top: 10, right: 10,
                        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)',
                        color: 'var(--gold2)', borderRadius: 8,
                        padding: '4px 8px', fontSize: 11.5, fontWeight: 700,
                        border: '1px solid rgba(201,168,76,0.3)',
                        display: 'flex', alignItems: 'center', gap: 3,
                      }}>
                        ✦ {p.score}
                      </div>
                      {/* Tag chip */}
                      {p.tag && (
                        <div style={{
                          position: 'absolute', top: 10, left: 10,
                          background: tc.bg, color: tc.color,
                          border: `1px solid ${tc.border}`,
                          borderRadius: 8, padding: '4px 9px',
                          fontSize: 11.5, fontWeight: 700,
                        }}>{p.tag}</div>
                      )}
                    </div>

                    {/* Card body */}
                    <div style={{ padding: '13px 14px 15px' }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.4, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                          <path d="M6 1a3.5 3.5 0 0 1 3.5 3.5C9.5 7.5 6 11 6 11S2.5 7.5 2.5 4.5A3.5 3.5 0 0 1 6 1z" stroke="currentColor" strokeWidth="1.2"/>
                          <circle cx="6" cy="4.5" r="1.2" fill="currentColor"/>
                        </svg>
                        {p.location}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold)', marginBottom: 10 }}>
                        {p.price}
                        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', marginRight: 4 }}>تومان</span>
                      </div>
                      {/* Stats row */}
                      <div style={{
                        display: 'flex', gap: 8, alignItems: 'center',
                        paddingTop: 10, borderTop: '1px solid var(--line)',
                        fontSize: 12, color: 'var(--muted)',
                      }}>
                        <span>{p.size} م²</span>
                        <span style={{ color: 'var(--faint)' }}>·</span>
                        <span>{p.beds} خواب</span>
                        <span style={{ color: 'var(--faint)' }}>·</span>
                        <span>ساخت {p.year}</span>
                        <div style={{ flex: 1 }}/>
                        <span style={{
                          color: 'var(--gold)', fontSize: 11.5, fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: 2,
                        }}>مشاهده ←</span>
                      </div>
                    </div>
                  </Link>
                </div>
              )

              return cards
            })}
          </div>
        </div>

        {/* ── LEFT: Sticky Map ─────────────────────────────── */}
        <MapPanelDesktop
          properties={sortedProperties}
          hoveredCard={hoveredCard}
          activePin={activePin}
          setActivePin={setActivePin}
          activeProperty={activeProperty ?? null}
        />
      </div>
    </div>
  )
}

type Property = {
  id: string; title: string; location: string; price: string; priceNum: number;
  beds: string; size: string; year: string; tag: string; score: number;
  img: string; pinX: number; pinY: number; pinColor: string;
}

function MapPanelDesktop({
  properties,
  hoveredCard,
  activePin,
  setActivePin,
  activeProperty,
}: {
  properties: Property[]
  hoveredCard: string | null
  activePin: string | null
  setActivePin: (id: string | null) => void
  activeProperty: Property | null
}) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 88,
        height: 'calc(100vh - 108px)',
        paddingTop: 20,
        paddingRight: 12,
      }}
      className="map-panel mjs-map"
    >
      <style>{`
        @media (max-width: 768px) { .map-panel { display: none !important; } }
      `}</style>

      <div style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid var(--line)',
        background: '#0a0908',
      }}>
        {/* SVG map background */}
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          preserveAspectRatio="none"
          viewBox="0 0 650 800"
        >
          {/* Diagonal texture lines */}
          <defs>
            <pattern id="diag" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="24" stroke="rgba(255,255,255,0.028)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="650" height="800" fill="url(#diag)"/>

          {/* Major roads */}
          <path d="M0,310 Q163,290 325,270 Q488,250 650,240" fill="none" stroke="rgba(255,255,255,0.075)" strokeWidth="11"/>
          <path d="M0,310 Q163,290 325,270 Q488,250 650,240" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="22"/>
          <path d="M210,0 Q230,200 245,400 Q260,600 265,800" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9"/>
          <path d="M210,0 Q230,200 245,400 Q260,600 265,800" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="20"/>

          {/* Secondary roads */}
          <path d="M0,490 Q162,468 310,450 Q480,432 650,420" fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth="5"/>
          <path d="M110,0 Q120,240 125,480 Q130,640 135,800" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4"/>
          <path d="M490,0 Q500,200 510,400 Q515,600 520,800" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4"/>
          <path d="M0,160 Q200,152 400,148 Q540,144 650,140" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="3"/>
          <path d="M0,630 Q220,618 400,608 Q540,600 650,594" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="3"/>

          {/* District blocks */}
          <rect x="140" y="120" width="140" height="90" rx="7" fill="rgba(255,255,255,0.012)" stroke="rgba(255,255,255,0.045)" strokeWidth="1"/>
          <rect x="360" y="300" width="160" height="100" rx="7" fill="rgba(255,255,255,0.012)" stroke="rgba(255,255,255,0.045)" strokeWidth="1"/>
          <rect x="40" y="380" width="120" height="80" rx="7" fill="rgba(255,255,255,0.012)" stroke="rgba(255,255,255,0.045)" strokeWidth="1"/>
          <rect x="280" y="500" width="130" height="70" rx="7" fill="rgba(255,255,255,0.012)" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
          <rect x="450" y="160" width="110" height="85" rx="7" fill="rgba(255,255,255,0.012)" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>

          {/* Subtle area fills */}
          <ellipse cx="200" cy="220" rx="100" ry="60" fill="rgba(201,168,76,0.015)"/>
          <ellipse cx="420" cy="400" rx="80" ry="50" fill="rgba(100,160,255,0.012)"/>
        </svg>

        {/* Map header label */}
        <div style={{
          position: 'absolute', top: 14, right: 14,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)',
          borderRadius: 9, padding: '6px 12px',
          fontSize: 12, color: 'var(--muted)',
          border: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', gap: 5,
          zIndex: 10,
        }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M6 1a3.5 3.5 0 0 1 3.5 3.5C9.5 7.5 6 11 6 11S2.5 7.5 2.5 4.5A3.5 3.5 0 0 1 6 1z" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
          تهران — سعادت‌آباد و اطراف
        </div>

        {/* Price pins */}
        {properties.map(p => {
          const isActive = hoveredCard === p.id || activePin === p.id
          return (
            <button
              key={p.id}
              onMouseEnter={() => setActivePin(p.id)}
              onMouseLeave={() => setActivePin(null)}
              style={{
                position: 'absolute',
                right: `${p.pinX}%`,
                top: `${p.pinY}%`,
                transform: `translate(50%,-50%) scale(${isActive ? 1.15 : 1})`,
                padding: '5px 11px',
                borderRadius: 20,
                background: isActive
                  ? 'linear-gradient(140deg,var(--gold2),var(--gold))'
                  : 'rgba(10,9,8,0.88)',
                border: `2px solid ${isActive ? 'var(--gold2)' : p.pinColor}`,
                color: isActive ? '#16140f' : '#f0ede6',
                fontSize: 12, fontWeight: 700,
                cursor: 'pointer',
                boxShadow: isActive
                  ? '0 4px 20px -4px rgba(201,168,76,0.6)'
                  : `0 2px 14px -4px rgba(0,0,0,0.7)`,
                transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
                zIndex: isActive ? 20 : 10,
                backdropFilter: 'blur(6px)',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
              }}
            >
              {p.price}
            </button>
          )
        })}

        {/* Price legend */}
        <div style={{
          position: 'absolute',
          bottom: activeProperty ? 128 : 16,
          left: 14,
          background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)',
          borderRadius: 10, padding: '11px 14px',
          border: '1px solid var(--line)',
          transition: 'bottom 0.25s ease',
          zIndex: 10,
        }}>
          <div style={{ fontSize: 11, color: 'var(--faint)', fontWeight: 700, marginBottom: 9 }}>
            نقشه حرارتی قیمت
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
            <div style={{
              width: 80, height: 6, borderRadius: 3,
              background: 'linear-gradient(to left, #e7674a, #c9a84c, #5fd98a)',
            }}/>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--faint)' }}>
            <span style={{ color: '#5fd98a' }}>ارزان</span>
            <span style={{ color: '#e7674a' }}>گران</span>
          </div>
        </div>

        {/* Hover popup */}
        {activeProperty && (
          <div style={{
            position: 'absolute', bottom: 16, left: 14, right: 14,
            background: 'rgba(10,9,8,0.95)', backdropFilter: 'blur(16px)',
            borderRadius: 13, border: '1px solid var(--line2)',
            boxShadow: '0 -8px 36px -12px rgba(0,0,0,0.6)',
            overflow: 'hidden',
            animation: 'drop 0.22s ease both',
            zIndex: 30,
          }}>
            <div style={{ display: 'flex', gap: 0 }}>
              <div style={{
                width: 80, minHeight: 76,
                background: activeProperty.img, flexShrink: 0,
              }}/>
              <div style={{ padding: '11px 13px', flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.4, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeProperty.title}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 11.5, marginBottom: 8 }}>
                  {activeProperty.location}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--gold)' }}>
                    {activeProperty.price}
                  </span>
                  <span style={{
                    background: 'var(--goldDim)', color: 'var(--gold)',
                    borderRadius: 7, padding: '3px 8px', fontSize: 11, fontWeight: 700,
                    border: '1px solid rgba(201,168,76,0.25)',
                  }}>✦ {activeProperty.score}</span>
                </div>
              </div>
              <div style={{ padding: '10px 10px 10px 0', display: 'flex', alignItems: 'center' }}>
                <Link
                  href={`/property/${activeProperty.id}`}
                  style={{
                    width: 34, height: 34, borderRadius: 9,
                    background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                    color: '#16140f', textDecoration: 'none',
                    fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, fontWeight: 700,
                  }}
                >‹</Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
