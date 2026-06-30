'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const NeshanMap = dynamic(() => import('../../components/NeshanMap'), { ssr: false })
const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')

interface Props {
  hashId: string
  photos: string[]
  address: string
  region: string
  lat?: number | null
  lng?: number | null
  builder: { id: string; name: string; phone?: string; projectCount: number }
}

interface Enrich { access?: string[]; amenities?: { icon?: string; label: string }[]; description?: string }

export default function ProjectClient({ hashId, photos, address, region, lat, lng, builder }: Props) {
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [enrich, setEnrich] = useState<Enrich | null>(null)
  const [enLoading, setEnLoading] = useState(true)
  const hasGeo = lat != null && lng != null && Math.abs(Number(lat)) > 0.1

  useEffect(() => {
    let dead = false
    fetch(`/api/public/project-access?hashId=${encodeURIComponent(hashId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!dead && d?.ok) setEnrich(d) })
      .catch(() => {})
      .finally(() => { if (!dead) setEnLoading(false) })
    return () => { dead = true }
  }, [hashId])

  useEffect(() => {
    if (lightbox == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null)
      if (e.key === 'ArrowLeft') setLightbox(i => i == null ? i : (i + 1) % photos.length)
      if (e.key === 'ArrowRight') setLightbox(i => i == null ? i : (i - 1 + photos.length) % photos.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, photos.length])

  const hasEnrich = enrich && ((enrich.access && enrich.access.length) || (enrich.amenities && enrich.amenities.length) || enrich.description)

  return (
    <>
      {/* گالریِ عکس‌ها */}
      {photos.length > 0 && (
        <div>
          <img src={photos[0]} alt={address} onClick={() => setLightbox(0)} style={{ width: '100%', maxHeight: 420, objectFit: 'cover', borderRadius: 16, cursor: 'zoom-in' }} />
          {photos.length > 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, marginTop: 8 }}>
              {photos.slice(1).map((ph, i) => (
                <img key={i} src={ph} alt="" loading="lazy" onClick={() => setLightbox(i + 1)} style={{ width: '100%', height: 84, objectFit: 'cover', borderRadius: 10, cursor: 'zoom-in' }} />
              ))}
            </div>
          )}
          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 6 }}>{fa(photos.length)} عکس از پروژه</div>
        </div>
      )}

      {/* لایت‌باکس */}
      {lightbox != null && photos[lightbox] && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={photos[lightbox]} alt="" style={{ maxWidth: '94vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} />
          <button onClick={e => { e.stopPropagation(); setLightbox(null) }} style={{ position: 'fixed', top: 18, insetInlineEnd: 18, background: 'rgba(255,255,255,.12)', color: '#fff', border: 'none', width: 42, height: 42, borderRadius: 21, fontSize: 24, cursor: 'pointer' }}>×</button>
          {photos.length > 1 && <>
            <button onClick={e => { e.stopPropagation(); setLightbox((lightbox + 1) % photos.length) }} style={navBtn('start')}>‹</button>
            <button onClick={e => { e.stopPropagation(); setLightbox((lightbox - 1 + photos.length) % photos.length) }} style={navBtn('end')}>›</button>
            <div style={{ position: 'fixed', bottom: 20, color: '#fff', fontSize: 13, background: 'rgba(0,0,0,.5)', padding: '4px 12px', borderRadius: 20 }}>{fa(lightbox + 1)} / {fa(photos.length)}</div>
          </>}
        </div>
      )}

      {/* نقشه با پین */}
      {hasGeo && (
        <section style={{ marginTop: 26 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 12px' }}>موقعیت روی نقشه</h2>
          <div style={{ height: 320 }}>
            <NeshanMap points={[{ id: hashId, lat: Number(lat), lng: Number(lng), title: address, price: region }]} center={{ lat: Number(lat), lng: Number(lng) }} zoom={15} height={320} />
          </div>
          <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 10, fontSize: 13, color: 'var(--gold)', textDecoration: 'none' }}>↗ مسیریابی در گوگل مپ</a>
        </section>
      )}

      {/* دسترسی‌ها و محله (AI) */}
      {(enLoading || hasEnrich) && (
        <section style={{ marginTop: 26 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            دسترسی‌ها و محله <span style={{ fontSize: 10.5, color: 'var(--faint)', fontWeight: 600, background: 'var(--bg2)', borderRadius: 6, padding: '2px 7px' }}>تکمیل با هوش مصنوعی</span>
          </h2>
          {enLoading ? (
            <div style={{ color: 'var(--faint)', fontSize: 13, padding: '14px 0' }}>در حال تکمیلِ اطلاعاتِ محله…</div>
          ) : (
            <>
              {enrich?.description && <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 2, margin: '8px 0 14px' }}>{enrich.description}</p>}
              {!!enrich?.access?.length && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>🚇 دسترسی‌ها</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {enrich.access.map((a, i) => <span key={i} style={{ fontSize: 12.5, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '7px 12px', color: 'var(--text)' }}>{a}</span>)}
                  </div>
                </div>
              )}
              {!!enrich?.amenities?.length && (
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>🏙 امکاناتِ اطراف</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                    {enrich.amenities.map((a, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', borderRadius: 10, padding: '9px 12px' }}>
                        <span style={{ fontSize: 18 }}>{a.icon || '📍'}</span>
                        <span style={{ fontSize: 12.5 }}>{a.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* تماس با سازنده */}
      <section style={{ marginTop: 28, background: 'linear-gradient(120deg, rgba(212,175,55,.12), transparent 60%), var(--surface)', border: '1px solid var(--line2)', borderRadius: 18, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--goldDim)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>🏗</div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 11.5, color: 'var(--gold)', fontWeight: 700 }}>سازندهٔ پروژه</div>
            <Link href={`/sazande/${encodeURIComponent(builder.id)}`} style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', textDecoration: 'none' }}>{builder.name || 'سازنده'}</Link>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{fa(builder.projectCount)} پروژه</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          {builder.phone && <a href={`tel:${builder.phone}`} style={{ flex: 1, minWidth: 140, textAlign: 'center', background: 'var(--gold)', color: '#1a1408', fontWeight: 800, fontSize: 15, padding: '13px 18px', borderRadius: 12, textDecoration: 'none', direction: 'ltr' }}>☎ {builder.phone}</a>}
          <Link href={`/sazande/${encodeURIComponent(builder.id)}`} style={{ flex: 1, minWidth: 140, textAlign: 'center', background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--line)', fontWeight: 700, fontSize: 14, padding: '13px 18px', borderRadius: 12, textDecoration: 'none' }}>مشاهدهٔ پروفایلِ سازنده</Link>
        </div>
      </section>
    </>
  )
}

const navBtn = (side: 'start' | 'end'): React.CSSProperties => ({ position: 'fixed', top: '50%', transform: 'translateY(-50%)', [side === 'start' ? 'insetInlineStart' : 'insetInlineEnd']: 14, background: 'rgba(255,255,255,.12)', color: '#fff', border: 'none', width: 48, height: 48, borderRadius: 24, fontSize: 30, cursor: 'pointer', lineHeight: 1 } as React.CSSProperties)
