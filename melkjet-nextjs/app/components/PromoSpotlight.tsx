'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

// بنرِ خودکارِ پروموت — از پروموت‌های فعال ساخته می‌شود و در صدرِ صفحهٔ اصلی می‌نشیند.
// طراحیِ تمیز و پُر: حتی بدونِ عکس هم زیبا (آواتار/گرادیان + گلوِ طلایی + چیدمانِ متوازن).
export interface SpotlightItem { id: string; kind: string; title: string; subtitle: string; image: string; url: string; isProfile: boolean }

const KIND_STYLE: Record<string, { bg: string; fg: string; icon: string }> = {
  'VIP': { bg: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', fg: '#fff', icon: '♛' },
  'صفحه اول': { bg: 'linear-gradient(135deg,var(--gold2),var(--gold))', fg: '#1a160c', icon: '⚑' },
  'Hero': { bg: 'linear-gradient(135deg,var(--gold2),var(--gold))', fg: '#1a160c', icon: '★' },
  'ترند': { bg: 'linear-gradient(135deg,#ef6a4a,#c8442a)', fg: '#fff', icon: '🔥' },
  'برتر': { bg: 'linear-gradient(135deg,var(--gold2),var(--gold))', fg: '#1a160c', icon: '✦' },
  'منتخب': { bg: 'linear-gradient(135deg,#4a90e2,#2f6fc0)', fg: '#fff', icon: '✦' },
  'ویژه': { bg: 'linear-gradient(135deg,var(--gold2),var(--gold))', fg: '#1a160c', icon: '★' },
  'نردبان': { bg: 'linear-gradient(135deg,#4a90e2,#2f6fc0)', fg: '#fff', icon: '↑' },
}
const st = (k: string) => KIND_STYLE[k] || KIND_STYLE['ویژه']
// آواتارِ رنگی از حروفِ اول (وقتی عکسی نیست) — رنگ از خودِ متن مشتق می‌شود تا ثابت بماند.
const AV = ['#c9a84c', '#4a90e2', '#3fae6a', '#e07b5a', '#8b5cf6', '#2d9a8f']
function initials(t: string) { const w = (t || '').trim().split(/\s+/).filter(Boolean); return ((w[0]?.[0] || '') + (w[1]?.[0] || '')).trim() || '★' }
function avColor(t: string) { let h = 0; for (const c of t || '') h = (h * 31 + c.charCodeAt(0)) >>> 0; return AV[h % AV.length] }

export default function PromoSpotlight({ items }: { items: SpotlightItem[] }) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (items.length <= 1) return
    const t = setInterval(() => setIdx(i => (i + 1) % items.length), 6000)
    return () => clearInterval(t)
  }, [items.length])
  if (!items || items.length === 0) return null
  const cur = items[idx % items.length]
  const s = st(cur.kind)
  const col = avColor(cur.title)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Link href={cur.url} style={{ textDecoration: 'none', display: 'block' }}>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, border: '1px solid var(--gold)', background: 'linear-gradient(105deg, rgba(212,175,55,.13), var(--surface) 42%, var(--surface))', boxShadow: '0 12px 40px -16px rgba(212,175,55,.4)' }}>
          {/* گلوِ طلاییِ تزئینی */}
          <div style={{ position: 'absolute', insetInlineStart: -60, top: -60, width: 240, height: 240, borderRadius: '50%', background: `radial-gradient(circle, ${col}22, transparent 70%)`, pointerEvents: 'none' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 'clamp(16px,3vw,32px)', padding: 'clamp(18px,3vw,26px) clamp(20px,3.5vw,32px)' }}>
            {/* بصری: عکس یا آواتارِ حروف */}
            <div style={{ flexShrink: 0 }}>
              {cur.image
                ? <div style={{ width: 'clamp(84px,12vw,120px)', height: 'clamp(84px,12vw,120px)', borderRadius: cur.isProfile ? '50%' : 16, background: `center/cover no-repeat url(${cur.image})`, border: '2px solid var(--gold)', boxShadow: '0 8px 24px -8px rgba(0,0,0,.5)' }} />
                : <div style={{ width: 'clamp(84px,12vw,120px)', height: 'clamp(84px,12vw,120px)', borderRadius: cur.isProfile ? '50%' : 16, background: `linear-gradient(140deg, ${col}, ${col}88)`, border: '2px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 'clamp(28px,4vw,40px)', fontWeight: 900, letterSpacing: '-1px', boxShadow: '0 8px 24px -8px rgba(0,0,0,.5)' }}>{initials(cur.title)}</div>}
            </div>
            {/* متن */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: s.bg, color: s.fg, borderRadius: 8, padding: '4px 11px', fontSize: 12, fontWeight: 800 }}><span>{s.icon}</span>{cur.kind}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--gold2)' }}>{cur.isProfile ? 'متخصصِ پیشنهادیِ ملک‌جت' : 'آگهیِ ویژهٔ ملک‌جت'}</span>
              </div>
              <div style={{ fontSize: 'clamp(19px,2.6vw,26px)', fontWeight: 900, color: 'var(--text)', lineHeight: 1.3, letterSpacing: '-.4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cur.title}</div>
              {cur.subtitle && <div style={{ fontSize: 13.5, color: 'var(--muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cur.subtitle}</div>}
            </div>
            {/* CTA — در دسکتاپ سمتِ چپ */}
            <div className="mj-spot-cta" style={{ flexShrink: 0 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 13.5, borderRadius: 12, padding: '11px 20px', whiteSpace: 'nowrap' }}>{cur.isProfile ? 'مشاهدهٔ پروفایل' : 'مشاهدهٔ آگهی'} ←</span>
            </div>
          </div>
        </div>
      </Link>
      {items.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 7 }}>
          {items.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} aria-label={`اسلاید ${i + 1}`} style={{ width: i === idx % items.length ? 22 : 8, height: 8, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 0, transition: 'width .25s', background: i === idx % items.length ? 'var(--gold)' : 'var(--line2)' }} />
          ))}
        </div>
      )}
    </div>
  )
}
