'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

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

  // لایت‌باکس (نمایشِ تمام‌صفحه)
  const [open, setOpen] = useState<number | null>(null)
  const close = useCallback(() => setOpen(null), [])
  const step = useCallback((d: 1 | -1) => setOpen(o => (o == null ? o : (o + d + imgs.length) % imgs.length)), [imgs.length])
  useEffect(() => {
    if (open == null) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') step(-1); else if (e.key === 'ArrowLeft') step(1) }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow }
  }, [open, close, step])

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
        /* موبایل: گریدِ دوستونیِ عکس‌ها به‌جای اسکرولِ افقی (مثلِ گالریِ سایت‌های بزرگ) */
        @media(max-width:680px){
          .mjs-gal-arrow{display:none !important}
          .mjs-gal-row{display:grid !important;grid-template-columns:1fr 1fr !important;gap:10px !important;overflow:visible !important}
          .mjs-gal-item{min-width:0 !important}
          .mjs-gal-item img{height:150px !important}
        }
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
              <img src={src} alt="" onClick={() => setOpen(i)} style={{ width: '100%', height: 240, objectFit: 'cover', display: 'block', cursor: 'zoom-in' }} />
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

      {/* لایت‌باکس */}
      {open != null && imgs[open] && (
        <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(8,7,6,.94)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4vh 16px', direction: 'rtl' }}>
          <button aria-label="بستن" onClick={close} style={{ position: 'absolute', top: 16, insetInlineStart: 16, width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.08)', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
          {imgs.length > 1 && (
            <>
              <button aria-label="بعدی" onClick={e => { e.stopPropagation(); step(1) }} style={{ position: 'absolute', insetInlineEnd: 14, top: '50%', transform: 'translateY(-50%)', width: 50, height: 50, borderRadius: '50%', border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.08)', color: '#fff', fontSize: 26, cursor: 'pointer', lineHeight: 1 }}>›</button>
              <button aria-label="قبلی" onClick={e => { e.stopPropagation(); step(-1) }} style={{ position: 'absolute', insetInlineStart: 14, top: '50%', transform: 'translateY(-50%)', width: 50, height: 50, borderRadius: '50%', border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.08)', color: '#fff', fontSize: 26, cursor: 'pointer', lineHeight: 1 }}>‹</button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgs[open]} alt="" onClick={e => e.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: 12, boxShadow: '0 20px 70px rgba(0,0,0,.6)' }} />
          {imgs.length > 1 && <div style={{ position: 'absolute', bottom: 18, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,.8)', fontSize: 13, fontWeight: 600 }}>{(open + 1).toLocaleString('fa-IR')} / {imgs.length.toLocaleString('fa-IR')}</div>}
        </div>
      )}
    </div>
  )
}
