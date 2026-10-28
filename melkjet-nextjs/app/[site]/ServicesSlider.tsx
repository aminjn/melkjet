'use client'

import { useRef } from 'react'

// آیتمِ خدمت/مزیت که از سرور پاس داده می‌شود.
// فاز ۲۹۷ز — image/href اختیاری: همین اسلایدر کارتِ «پروژه» هم می‌شود (عکسِ واقعی + لینک به
// صفحهٔ پروژه در ملک‌جت). آیتمِ بدونِ این دو، همان کارتِ خدمتِ قبلی است — سایت‌های موجود دست نمی‌خورند.
export interface ServiceItem { icon?: string; title?: string; desc?: string; image?: string; href?: string }

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
        .mjs-srv-card{transition:transform .3s cubic-bezier(.16,1,.3,1), box-shadow .3s ease}
        .mjs-srv-plain::before{content:'';position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,transparent 40%,color-mix(in srgb,${primary} 12%,transparent));transform:translateY(100%);transition:transform .55s cubic-bezier(.16,1,.3,1)}
        .mjs-srv-plain:hover::before{transform:none}
        .mjs-srv-no{transition:-webkit-text-stroke-color .4s ease, transform .5s cubic-bezier(.16,1,.3,1)}
        .mjs-srv-plain:hover .mjs-srv-no{-webkit-text-stroke-color:${primary};transform:translateY(-4px)}
        .mjs-srv-ic{transition:transform .5s cubic-bezier(.16,1,.3,1)}
        .mjs-srv-plain:hover .mjs-srv-ic{transform:rotate(-8deg) scale(1.06)}
        .mjs-srv-card:hover{transform:translateY(-5px);box-shadow:0 22px 50px -24px rgba(20,16,10,.55),0 6px 16px -8px rgba(20,16,10,.18)}
        .mjs-srv-arrow{transition:transform .18s ease, opacity .18s ease}
        .mjs-srv-arrow:hover{transform:translateY(-2px);opacity:.92}
        /* موبایل: کارت‌های خدماتِ روی‌هم (عمودی) به‌جای اسکرولِ افقی */
        @media(max-width:680px){
          .mjs-srv-arrow{display:none !important}
          .mjs-srv-row{display:grid !important;grid-template-columns:1fr !important;gap:14px !important;overflow:visible !important}
          .mjs-srv-card{min-width:0 !important}
        }
      `}</style>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'stretch', gap: 10 }}>
        <button aria-label="قبلی" className="mjs-srv-arrow" onClick={() => scrollByPage(-1)} style={{
          flex: '0 0 auto', alignSelf: 'center', width: 44, height: 44, borderRadius: '50%',
          border: '1px solid color-mix(in srgb, var(--mjs-text) 20%, transparent)', background: 'var(--mjs-bg)', color: primary,
          fontSize: 20, fontWeight: 900, cursor: 'pointer', boxShadow: CARD_SHADOW, lineHeight: 1,
        }}>‹</button>

        <div ref={rowRef} className="mjs-srv-row" style={{
          display: 'flex', gap: 24, overflowX: 'auto', scrollSnapType: 'x mandatory',
          paddingBottom: 6, flex: 1, scrollBehavior: 'smooth',
        }}>
          {items.map((s, i) => {
            const Card: any = s.href ? 'a' : 'div'
            return (
            <Card key={i} {...(s.href ? { href: s.href } : {})} className={`mjs-srv-card mjs-card${s.image ? '' : ' mjs-srv-plain'}`} style={{
              flex: `0 0 ${cardWidth}`, minWidth: 230, scrollSnapAlign: 'start',
              background: 'var(--mjs-surface)', border: '1px solid color-mix(in srgb, var(--mjs-text) 11%, transparent)', borderRadius: 22,
              padding: s.image ? '0 0 22px' : '30px 26px 28px', textAlign: s.image ? 'center' : 'right', boxShadow: CARD_SHADOW,
              textDecoration: 'none', overflow: 'hidden', display: 'block', position: 'relative', isolation: 'isolate',
            }}>
              {s.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.image} alt={s.title || ''} loading="lazy" style={{ width: '100%', height: 170, objectFit: 'cover', display: 'block', marginBottom: 18 }} />
              ) : (
                // پوستهٔ نسلِ ۲ — به‌جای دایرهٔ آیکنِ وسطِ کارت (امضای قالب): آیکنِ کوچکِ گرادیانی در شروع +
                // شمارهٔ بزرگِ توخالی در گوشه که با هاور رنگ می‌گیرد.
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 26 }}>
                  <span className="mjs-srv-ic" style={{
                    width: 52, height: 52, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, color: '#fff', background: `linear-gradient(135deg, ${primary}, color-mix(in srgb, ${primary} 60%, var(--mjs-secondary)))`,
                    boxShadow: `0 12px 26px -12px ${primary}`,
                  }}>{s.icon}</span>
                  <span className="mjs-srv-no" aria-hidden style={{ fontSize: 46, fontWeight: 900, lineHeight: .9, letterSpacing: '-2px', color: 'transparent', WebkitTextStroke: '1.2px color-mix(in srgb, var(--mjs-text) 28%, transparent)' }}>{(i + 1).toLocaleString('fa-IR', { minimumIntegerDigits: 2 })}</span>
                </div>
              )}
              <div style={{ fontSize: s.image ? 17 : 19, fontWeight: 900, color: 'var(--mjs-heading)', marginBottom: 10, padding: s.image ? '0 18px' : 0, letterSpacing: '-.3px' }}>{s.title}</div>
              <div style={{ fontSize: 14, color: 'var(--mjs-text)', lineHeight: 1.9, padding: s.image ? '0 18px' : 0 }}>{s.desc}</div>
              {s.href ? <div style={{ marginTop: 12, fontSize: 13, fontWeight: 800, color: primary }}>مشاهدهٔ پروژه ←</div> : null}
            </Card>
          )})}
        </div>

        <button aria-label="بعدی" className="mjs-srv-arrow" onClick={() => scrollByPage(1)} style={{
          flex: '0 0 auto', alignSelf: 'center', width: 44, height: 44, borderRadius: '50%',
          border: '1px solid color-mix(in srgb, var(--mjs-text) 20%, transparent)', background: 'var(--mjs-bg)', color: primary,
          fontSize: 20, fontWeight: 900, cursor: 'pointer', boxShadow: CARD_SHADOW, lineHeight: 1,
        }}>›</button>
      </div>
    </div>
  )
}
