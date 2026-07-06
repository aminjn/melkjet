'use client'
import { useState } from 'react'
import RevealContact from '@/app/components/RevealContact'

export interface DetailItem {
  id: string; title: string; price?: string; location?: string
  images: string[]; description?: string; specs: { k: string; v: string }[]
}

const faDigits = (s: string) => (s || '')

// نمای جزئیاتِ آگهی — با متغیرهای تمِ سایت‌ساز (--mjs-*) رنگ می‌گیرد تا با قالبِ همان سایت بخواند.
export default function ListingDetail({ item, siteSlug, backLabel }: { item: DetailItem; siteSlug: string; backLabel?: string }) {
  const [active, setActive] = useState(0)
  const cover = item.images[active] || item.images[0] || ''
  const card: React.CSSProperties = { background: 'var(--mjs-surface)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16 }

  return (
    <section style={{ direction: 'rtl', maxWidth: 1120, margin: '0 auto', padding: 'clamp(20px,4vw,40px) clamp(16px,4vw,22px) 64px' }}>
      {/* مسیر — داخلِ همان سایت */}
      <nav style={{ fontSize: 13, color: 'var(--mjs-muted)', marginBottom: 18, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <a href={`/${siteSlug}`} style={{ color: 'var(--mjs-muted)', textDecoration: 'none' }}>خانه</a><span>›</span>
        <span style={{ color: 'var(--mjs-primary)', fontWeight: 700 }}>{item.title}</span>
      </nav>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', gap: 22, alignItems: 'start' }} className="mjs-detail-grid">
        {/* گالری */}
        <div>
          <div style={{ ...card, height: 'clamp(240px,42vw,440px)', overflow: 'hidden', background: cover ? `center/cover no-repeat url(${cover})` : 'linear-gradient(135deg,var(--mjs-primary),var(--mjs-secondary))' }} />
          {item.images.length > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {item.images.slice(0, 12).map((img, i) => (
                <button key={i} onClick={() => setActive(i)} style={{ flex: '0 0 auto', width: 78, height: 60, borderRadius: 10, cursor: 'pointer', border: i === active ? '2px solid var(--mjs-primary)' : '1px solid rgba(0,0,0,0.12)', background: `center/cover no-repeat url(${img})`, padding: 0 }} />
              ))}
            </div>
          )}
          {item.description && (
            <div style={{ ...card, padding: 20, marginTop: 18 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--mjs-heading)', margin: '0 0 10px' }}>توضیحات</h2>
              <p style={{ fontSize: 14.5, lineHeight: 2.1, color: 'var(--mjs-text)', margin: 0, whiteSpace: 'pre-wrap' }}>{item.description}</p>
            </div>
          )}
        </div>

        {/* اطلاعات + تماس */}
        <aside style={{ ...card, padding: 22, position: 'sticky', top: 16 }}>
          {item.price && <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--mjs-primary)', marginBottom: 6 }}>{faDigits(item.price)}</div>}
          <h1 style={{ fontSize: 19, fontWeight: 800, color: 'var(--mjs-heading)', margin: '0 0 6px', lineHeight: 1.7 }}>{item.title}</h1>
          {item.location && <div style={{ fontSize: 13.5, color: 'var(--mjs-muted)', marginBottom: 16 }}>📍 {item.location}</div>}

          {item.specs.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              {item.specs.map(s => (
                <div key={s.k} style={{ background: 'var(--mjs-bg)', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 10, padding: '9px 11px' }}>
                  <div style={{ fontSize: 11, color: 'var(--mjs-muted)' }}>{s.k}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--mjs-heading)', marginTop: 2 }}>{s.v}</div>
                </div>
              ))}
            </div>
          )}

          <RevealContact kind="item" id={item.id} label="نمایشِ اطلاعاتِ تماس" style={{ width: '100%', justifyContent: 'center', background: 'var(--mjs-primary)', color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontWeight: 800, fontSize: 15 }} />
          <a href={`/${siteSlug}`} style={{ display: 'block', textAlign: 'center', marginTop: 12, fontSize: 13, color: 'var(--mjs-muted)', textDecoration: 'none' }}>← {backLabel || 'بازگشت به سایت'}</a>
        </aside>
      </div>
      <style>{`@media(max-width:760px){.mjs-detail-grid{grid-template-columns:1fr !important}}`}</style>
    </section>
  )
}
