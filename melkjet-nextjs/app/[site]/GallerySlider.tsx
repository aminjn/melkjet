'use client'

import { useRef } from 'react'

const CARD_SHADOW = '0 10px 34px -22px rgba(20,16,10,.55), 0 2px 8px -4px rgba(20,16,10,.10)'

// اسلایدرِ افقیِ گالری: ردیفِ اسکرول‌شونده با scroll-snap و دکمه‌های جهت. عرضِ هر آیتم
// بر اساسِ perSlide محاسبه می‌شود و با min-width روی موبایل تقریباً یکی-در-نما می‌شود.
export default function GallerySlider({
  images, perSlide = 3, primary,
}: {
  images: string[]
  perSlide?: number
  primary: string
}) {
  const rowRef = useRef<HTMLDivElement | null>(null)
  const imgs = (images || []).filter(Boolean)
  const per = Math.max(1, Math.min(6, Number(perSlide) || 3))

  const scrollByPage = (dir: 1 | -1) => {
    const el = rowRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' })
  }

  const cardWidth = `calc((100% - ${(per - 1) * 16}px) / ${per})`

  if (imgs.length === 0) {
    return (
      <div style={{
        background: 'var(--mjs-surface)', border: '1px dashed #ddd4c5', borderRadius: 18,
        padding: '56px 24px', textAlign: 'center', color: '#9b9285', fontSize: 14.5,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 38, opacity: .35 }}>▥</span>
        هنوز تصویری برای گالری اضافه نشده است.
      </div>
    )
  }

  return (
    <div>
      <style>{`
        .mjs-gal-row{scrollbar-width:none}
        .mjs-gal-row::-webkit-scrollbar{display:none}
        .mjs-gal-item{transition:transform .25s ease, box-shadow .25s ease}
        .mjs-gal-item:hover{transform:translateY(-4px);box-shadow:0 22px 50px -24px rgba(20,16,10,.55),0 6px 16px -8px rgba(20,16,10,.18)}
        .mjs-gal-arrow{transition:transform .18s ease, opacity .18s ease}
        .mjs-gal-arrow:hover{transform:translateY(-2px);opacity:.92}
      `}</style>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'stretch', gap: 10 }}>
        <button
          aria-label="قبلی"
          className="mjs-gal-arrow"
          onClick={() => scrollByPage(-1)}
          style={{
            flex: '0 0 auto', alignSelf: 'center', width: 44, height: 44, borderRadius: '50%',
            border: '1px solid #e6ddcd', background: 'var(--mjs-bg)', color: primary,
            fontSize: 20, fontWeight: 900, cursor: 'pointer', boxShadow: CARD_SHADOW, lineHeight: 1,
          }}
        >‹</button>

        <div
          ref={rowRef}
          className="mjs-gal-row"
          style={{
            display: 'flex', gap: 16, overflowX: 'auto', scrollSnapType: 'x mandatory',
            paddingBottom: 6, flex: 1, scrollBehavior: 'smooth',
          }}
        >
          {imgs.map((src, i) => (
            <div
              key={i}
              className="mjs-gal-item"
              style={{
                flex: `0 0 ${cardWidth}`, minWidth: 220, scrollSnapAlign: 'start',
                borderRadius: 16, overflow: 'hidden', boxShadow: CARD_SHADOW,
                border: '1px solid #efe9df', background: 'var(--mjs-bg)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" style={{ width: '100%', height: 240, objectFit: 'cover', display: 'block' }} />
            </div>
          ))}
        </div>

        <button
          aria-label="بعدی"
          className="mjs-gal-arrow"
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
