'use client'

import { useRef } from 'react'

// آیتمِ خدمت/مزیت که از سرور پاس داده می‌شود.
export interface ServiceItem { icon?: string; title?: string; desc?: string }

const CARD_SHADOW = '0 10px 34px -22px rgba(20,16,10,.55), 0 2px 8px -4px rgba(20,16,10,.10)'

// اسلایدرِ خدمات: ردیفِ افقیِ اسکرول‌شونده با snap و دکمه‌های جهت — شبیهِ اسلایدرِ آگهی‌ها.
export default function ServicesSlider({
  items, perSlide, primary,
}: {
  items: ServiceItem[]
  perSlide: number
  primary: string
}) {
  const rowRef = useRef<HTMLDivElement | null>(null)
  const per = Math.max(1, Math.min(4, Number(perSlide) || 3))
  const cardWidth = `calc((100% - ${(per - 1) * 24}px) / ${per})`

  const scrollByPage = (dir: 1 | -1) => {
    const el = rowRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' })
  }

  if (items.length === 0) return null

  return (
    <div>
      <style>{`
        .mjs-srv-row{scrollbar-width:none}
        .mjs-srv-row::-webkit-scrollbar{display:none}
        .mjs-srv-card{transition:transform .22s ease, box-shadow .22s ease}
        .mjs-srv-card:hover{transform:translateY(-5px);box-shadow:0 22px 50px -24px rgba(20,16,10,.55),0 6px 16px -8px rgba(20,16,10,.18)}
        .mjs-srv-arrow{transition:transform .18s ease, opacity .18s ease}
        .mjs-srv-arrow:hover{transform:translateY(-2px);opacity:.92}
        @media(max-width:680px){.mjs-srv-card{flex-basis:84% !important;min-width:84% !important}}
      `}</style>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'stretch', gap: 10 }}>
        <button aria-label="قبلی" className="mjs-srv-arrow" onClick={() => scrollByPage(-1)} style={{
          flex: '0 0 auto', alignSelf: 'center', width: 44, height: 44, borderRadius: '50%',
          border: '1px solid #e6ddcd', background: 'var(--mjs-bg)', color: primary,
          fontSize: 20, fontWeight: 900, cursor: 'pointer', boxShadow: CARD_SHADOW, lineHeight: 1,
        }}>‹</button>

        <div ref={rowRef} className="mjs-srv-row" style={{
          display: 'flex', gap: 24, overflowX: 'auto', scrollSnapType: 'x mandatory',
          paddingBottom: 6, flex: 1, scrollBehavior: 'smooth',
        }}>
          {items.map((s, i) => (
            <div key={i} className="mjs-srv-card" style={{
              flex: `0 0 ${cardWidth}`, minWidth: 230, scrollSnapAlign: 'start',
              background: 'var(--mjs-surface)', border: '1px solid #efe9df', borderRadius: 18,
              padding: '34px 22px', textAlign: 'center', boxShadow: CARD_SHADOW,
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%', margin: '0 auto 18px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, color: primary, background: `${primary}1f`,
              }}>{s.icon}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--mjs-heading)', marginBottom: 10 }}>{s.title}</div>
              <div style={{ fontSize: 14, color: 'var(--mjs-text)', lineHeight: 1.9 }}>{s.desc}</div>
            </div>
          ))}
        </div>

        <button aria-label="بعدی" className="mjs-srv-arrow" onClick={() => scrollByPage(1)} style={{
          flex: '0 0 auto', alignSelf: 'center', width: 44, height: 44, borderRadius: '50%',
          border: '1px solid #e6ddcd', background: 'var(--mjs-bg)', color: primary,
          fontSize: 20, fontWeight: 900, cursor: 'pointer', boxShadow: CARD_SHADOW, lineHeight: 1,
        }}>›</button>
      </div>
    </div>
  )
}
