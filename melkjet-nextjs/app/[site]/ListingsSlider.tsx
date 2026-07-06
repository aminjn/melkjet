'use client'

import { useMemo, useRef, useState } from 'react'
import { listingHref } from '@/app/lib/listing-url'

// آیتمِ آگهی که از سرور به اسلایدر پاس داده می‌شود.
export interface SliderItem {
  id: string | number
  title?: string
  location?: string
  price?: string
  image?: string
  category?: string
}

const CARD_SHADOW = '0 10px 34px -22px rgba(20,16,10,.55), 0 2px 8px -4px rgba(20,16,10,.10)'
const GRADS = ['#2d2215,#1e1a12', '#1e2215,#141a10', '#15202d,#101828', '#251528,#1a0e1e', '#152825,#0e1a18', '#2d1515,#1e0e0e']

// اسلایدرِ آگهی‌ها: چیپ‌های دسته‌بندی + ردیفِ افقیِ اسکرول‌شونده با snap و دکمه‌های جهت.
export default function ListingsSlider({
  items, categories, perSlide, primary, showCategories, siteSlug = '',
}: {
  items: SliderItem[]
  categories: string[]
  perSlide: number
  primary: string
  showCategories: boolean
  siteSlug?: string
}) {
  const [active, setActive] = useState<string>('__all__')
  const rowRef = useRef<HTMLDivElement | null>(null)
  const per = Math.max(1, Number(perSlide) || 3)

  const visible = useMemo(() => {
    if (active === '__all__') return items
    return items.filter(it => (it.category || '') === active)
  }, [items, active])

  // اسکرول یک «صفحه» به چپ/راست (RTL → جهتِ scrollBy معکوس می‌شود توسطِ مرورگر).
  const scrollByPage = (dir: 1 | -1) => {
    const el = rowRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' })
  }

  const cardWidth = `calc((100% - ${(per - 1) * 20}px) / ${per})`

  return (
    <div>
      <style>{`
        .mjs-slider-row{scrollbar-width:none}
        .mjs-slider-row::-webkit-scrollbar{display:none}
        .mjs-slide-card{transition:transform .22s ease, box-shadow .22s ease}
        .mjs-slide-card:hover{transform:translateY(-5px);box-shadow:0 22px 50px -24px rgba(20,16,10,.55),0 6px 16px -8px rgba(20,16,10,.18)}
        .mjs-slider-arrow{transition:transform .18s ease, opacity .18s ease, background .18s ease}
        .mjs-slider-arrow:hover{transform:translateY(-2px);opacity:.92}
        /* موبایل: مثلِ سایت‌های بزرگِ ملکی، کارت‌های تمام‌عرضِ عمودی به‌جای اسکرولِ افقی */
        @media(max-width:680px){
          .mjs-slider-arrow{display:none !important}
          .mjs-slider-row{display:grid !important;grid-template-columns:1fr !important;gap:16px !important;overflow:visible !important}
          .mjs-slide-card{min-width:0 !important;width:100% !important;flex-basis:auto !important}
        }
      `}</style>

      {showCategories && categories.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginBottom: 22 }}>
          {[{ key: '__all__', label: 'همه' }, ...categories.map(c => ({ key: c, label: c }))].map(tab => {
            const on = active === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActive(tab.key)}
                style={{
                  fontSize: 13.5, fontWeight: on ? 800 : 600, cursor: 'pointer',
                  color: on ? '#fff' : 'var(--mjs-text)',
                  background: on ? primary : 'var(--mjs-surface)',
                  border: on ? `1px solid ${primary}` : '1px solid #e6ddcd',
                  borderRadius: 999, padding: '8px 18px', fontFamily: 'inherit',
                  boxShadow: on ? `0 10px 24px -14px ${primary}` : 'none',
                }}
              >{tab.label}</button>
            )
          })}
        </div>
      ) : null}

      <div style={{ position: 'relative', display: 'flex', alignItems: 'stretch', gap: 10 }}>
        <button
          aria-label="قبلی"
          className="mjs-slider-arrow"
          onClick={() => scrollByPage(-1)}
          style={{
            flex: '0 0 auto', alignSelf: 'center', width: 44, height: 44, borderRadius: '50%',
            border: '1px solid #e6ddcd', background: 'var(--mjs-bg)', color: primary,
            fontSize: 20, fontWeight: 900, cursor: 'pointer', boxShadow: CARD_SHADOW, lineHeight: 1,
          }}
        >‹</button>

        <div
          ref={rowRef}
          className="mjs-slider-row"
          style={{
            display: 'flex', gap: 20, overflowX: 'auto', scrollSnapType: 'x mandatory',
            paddingBottom: 6, flex: 1, scrollBehavior: 'smooth',
          }}
        >
          {visible.length === 0 ? (
            <div style={{ flex: 1, textAlign: 'center', color: 'var(--mjs-text)', opacity: .7, fontSize: 14, padding: '40px 0' }}>
              موردی در این دسته یافت نشد.
            </div>
          ) : visible.map((it, i) => (
            <a
              key={it.id}
              href={siteSlug ? `/${siteSlug}${listingHref(it.id, it.title, it.location)}` : `/property/${it.id}`}
              className="mjs-slide-card"
              style={{
                flex: `0 0 ${cardWidth}`, minWidth: 240, scrollSnapAlign: 'start',
                background: 'var(--mjs-bg)', borderRadius: 18, overflow: 'hidden',
                border: '1px solid #efe9df', textDecoration: 'none', display: 'block',
                boxShadow: CARD_SHADOW,
              }}
            >
              {it.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.image} alt="" style={{ width: '100%', height: 190, objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ height: 190, background: `linear-gradient(135deg,${GRADS[i % GRADS.length]})` }} />
              )}
              <div style={{ padding: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--mjs-heading)', marginBottom: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
                <div style={{ fontSize: 13, color: 'var(--mjs-text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ opacity: .7 }}>📍</span>{it.location || 'موقعیت نامشخص'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f2ede4', paddingTop: 12 }}>
                  <span style={{ fontSize: 17, fontWeight: 900, color: primary }}>{it.price || 'قیمت توافقی'}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--mjs-text)' }}>مشاهده ←</span>
                </div>
              </div>
            </a>
          ))}
        </div>

        <button
          aria-label="بعدی"
          className="mjs-slider-arrow"
          onClick={() => scrollByPage(1)}
          style={{
            flex: '0 0 auto', alignSelf: 'center', width: 44, height: 44, borderRadius: '50%',
            border: '1px solid #e6ddcd', background: 'var(--mjs-bg)', color: primary,
            fontSize: 20, fontWeight: 900, cursor: 'pointer', boxShadow: CARD_SHADOW, lineHeight: 1,
          }}
        >›</button>
      </div>
    </div>
  )
}
