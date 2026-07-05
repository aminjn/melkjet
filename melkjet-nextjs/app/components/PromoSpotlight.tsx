'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

// بنرِ خودکارِ پروموت — از پروموت‌های فعال ساخته می‌شود و در صدرِ صفحهٔ اصلی می‌نشیند.
// هر پروموتِ فعالی این‌جا خودبه‌خود به‌صورتِ بنر نمایش داده می‌شود (چرخشیِ نرم).
export interface SpotlightItem { id: string; kind: string; title: string; subtitle: string; image: string; url: string; isProfile: boolean }

const KIND_STYLE: Record<string, { bg: string; fg: string; icon: string }> = {
  'VIP': { bg: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', fg: '#fff', icon: '♛' },
  'صفحه اول': { bg: 'linear-gradient(135deg,#d4af37,#b8860b)', fg: '#1a160c', icon: '⚑' },
  'Hero': { bg: 'linear-gradient(135deg,#d4af37,#b8860b)', fg: '#1a160c', icon: '★' },
  'ترند': { bg: 'linear-gradient(135deg,#ef6a4a,#c8442a)', fg: '#fff', icon: '🔥' },
  'برتر': { bg: 'linear-gradient(135deg,#d4af37,#b8860b)', fg: '#1a160c', icon: '✦' },
  'منتخب': { bg: 'linear-gradient(135deg,#4a90e2,#2f6fc0)', fg: '#fff', icon: '✦' },
  'ویژه': { bg: 'linear-gradient(135deg,#d4af37,#b8860b)', fg: '#1a160c', icon: '★' },
  'نردبان': { bg: 'linear-gradient(135deg,#4a90e2,#2f6fc0)', fg: '#fff', icon: '↑' },
}
const st = (k: string) => KIND_STYLE[k] || KIND_STYLE['ویژه']

export default function PromoSpotlight({ items }: { items: SpotlightItem[] }) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (items.length <= 1) return
    const t = setInterval(() => setIdx(i => (i + 1) % items.length), 5000)
    return () => clearInterval(t)
  }, [items.length])
  if (!items || items.length === 0) return null
  const cur = items[idx % items.length]
  const s = st(cur.kind)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Link href={cur.url} style={{ textDecoration: 'none', display: 'block' }}>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, minHeight: 210, border: '1px solid var(--gold)', background: 'var(--surface)', boxShadow: '0 14px 46px -18px rgba(212,175,55,.45)' }}>
          {cur.image
            ? <div style={{ position: 'absolute', inset: 0, background: `center/cover no-repeat url(${cur.image})` }} />
            : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg,#2a2620,#17140f)' }} />}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(10,8,5,.92) 0%, rgba(10,8,5,.72) 45%, rgba(10,8,5,.28) 100%)' }} />
          <div style={{ position: 'relative', padding: 'clamp(20px,4vw,34px)', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 210, justifyContent: 'center', maxWidth: 640 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: s.bg, color: s.fg, borderRadius: 8, padding: '5px 12px', fontSize: 12.5, fontWeight: 800, letterSpacing: '.2px' }}>
                <span>{s.icon}</span>{cur.kind}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--gold2)', letterSpacing: '.5px' }}>{cur.isProfile ? 'متخصصِ پیشنهادیِ ملک‌جت' : 'آگهیِ ویژهٔ ملک‌جت'}</span>
            </div>
            <div style={{ fontSize: 'clamp(20px,3vw,28px)', fontWeight: 900, color: '#fff', lineHeight: 1.35, letterSpacing: '-.4px' }}>{cur.title}</div>
            {cur.subtitle && <div style={{ fontSize: 14, color: 'rgba(255,255,255,.82)', fontWeight: 500 }}>{cur.subtitle}</div>}
            <div style={{ marginTop: 4 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 13.5, borderRadius: 11, padding: '9px 18px' }}>
                {cur.isProfile ? 'مشاهدهٔ پروفایل' : 'مشاهدهٔ آگهی'} ←
              </span>
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
