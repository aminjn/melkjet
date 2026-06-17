'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Nav from '@/app/components/Nav'
import Link from 'next/link'

interface Item {
  id: string; type: string; category?: string; title: string; price?: string
  location?: string; image?: string; url?: string; excerpt?: string; phone?: string
  sourceName: string; status: string; scrapedAt: number; meta?: Record<string, string>
}

function timeAgo(ts: number): string {
  const d = Date.now() - ts
  const h = Math.floor(d / 3600000)
  if (h < 1) return 'کمتر از یک ساعت پیش'
  if (h < 24) return `${h} ساعت پیش`
  return `${Math.floor(h / 24)} روز پیش`
}

export default function PropertyPage() {
  const params = useParams()
  const id = String(params?.id || '')
  const [item, setItem] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    fetch(`/api/content/item?id=${id}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { item: null }))
      .then(d => { setItem(d.item); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Nav />

      {loading ? (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px', textAlign: 'center', color: 'var(--muted)' }}>
          در حال بارگذاری…
        </div>
      ) : !item ? (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, opacity: 0.3, marginBottom: 16 }}>🏠</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>این آگهی یافت نشد</h1>
          <p style={{ color: 'var(--muted)', marginBottom: 20 }}>ممکن است حذف شده باشد یا هنوز واکشی نشده باشد.</p>
          <Link href="/search" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>← بازگشت به جستجو</Link>
        </div>
      ) : (
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 80px' }}>
          {/* Breadcrumb */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)', flexWrap: 'wrap', marginBottom: 20 }}>
            <Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>خانه</Link>
            <span style={{ color: 'var(--faint)' }}>›</span>
            <Link href="/search" style={{ color: 'var(--muted)', textDecoration: 'none' }}>آگهی‌ها</Link>
            {item.location && <><span style={{ color: 'var(--faint)' }}>›</span><span style={{ color: 'var(--text)' }}>{item.location}</span></>}
          </nav>

          <div className="mjp-grid" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 28, alignItems: 'start' }}>
            {/* LEFT */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Image */}
              <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--line)', minHeight: 320 }}>
                {item.image ? (
                  <img src={item.image} alt={item.title} style={{ width: '100%', maxHeight: 460, objectFit: 'cover', display: 'block' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                ) : (
                  <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, opacity: 0.1 }}>🏠</div>
                )}
              </div>

              {/* Title + price */}
              <div>
                <h1 style={{ fontSize: 'clamp(20px,3vw,28px)', fontWeight: 800, lineHeight: 1.4, marginBottom: 14 }}>{item.title}</h1>
                {item.price && (
                  <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--gold)', marginBottom: 10 }}>{item.price}</div>
                )}
                {item.location && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, color: 'var(--muted)' }}>
                    <span>📍</span><span>{item.location}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              {item.excerpt && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>توضیحات</div>
                  <p style={{ fontSize: 14.5, lineHeight: 1.9, color: 'var(--text)' }}>{item.excerpt}</p>
                </div>
              )}

              {/* Meta chips */}
              {item.meta && Object.keys(item.meta).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(item.meta).filter(([k]) => !['city_id', 'category', 'district_id'].includes(k)).map(([k, v]) => (
                    <span key={k} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '7px 12px', fontSize: 12.5, color: 'var(--muted)' }}>
                      {k}: <b style={{ color: 'var(--text)' }}>{v}</b>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT (sticky) */}
            <div className="mjp-side" style={{ position: 'sticky', top: 90, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 22 }}>
                {item.price && <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--gold)', marginBottom: 4 }}>{item.price}</div>}
                <div style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 18 }}>منبع: {item.sourceName} · {timeAgo(item.scrapedAt)}</div>

                {item.phone && (
                  <a href={`tel:${item.phone}`} style={{ display: 'block', textAlign: 'center', padding: '12px', borderRadius: 12, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', textDecoration: 'none', fontWeight: 800, marginBottom: 10 }}>
                    ☎ {item.phone}
                  </a>
                )}

                {item.url && (
                  <a href={item.url} target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', padding: '12px', borderRadius: 12, border: '1px solid var(--gold)', color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>
                    مشاهدهٔ آگهی اصلی ↗
                  </a>
                )}

                <div style={{ marginTop: 16, padding: 14, background: 'var(--bg2)', borderRadius: 12, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.8 }}>
                   این آگهی به‌صورت خودکار از منبع خارجی واکشی شده است. برای تصاویر کامل و جزئیات بیشتر، روی «مشاهدهٔ آگهی اصلی» بزنید.
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
