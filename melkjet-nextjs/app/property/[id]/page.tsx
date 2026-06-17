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

function toFa(n: number | string): string { return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]) }

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
  const [gallery, setGallery] = useState<string[]>([])
  const [activeImg, setActiveImg] = useState(0)
  const [facts, setFacts] = useState<{ label: string; value: string }[]>([])
  const [analysis, setAnalysis] = useState('')
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    if (!id) return
    fetch(`/api/content/item?id=${id}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { item: null }))
      .then(d => {
        setItem(d.item); setLoading(false)
        // For Divar items, fetch the full photo gallery + facts by token
        const m = (d.item?.url || '').match(/divar\.ir\/v\/([A-Za-z0-9_-]+)/)
        if (m) {
          fetch(`/api/divar/post?token=${m[1]}`)
            .then(r => r.ok ? r.json() : {})
            .then((g: any) => { if (g.images?.length) setGallery(g.images); if (g.facts?.length) setFacts(g.facts); if (g.description) setItem((it: Item | null) => it ? { ...it, excerpt: g.description } : it) })
            .catch(() => {})
        }
      })
      .catch(() => setLoading(false))
  }, [id])

  const [phone, setPhone] = useState<string | null>(null)
  const [gettingPhone, setGettingPhone] = useState(false)
  const getContact = async () => {
    if (!item || gettingPhone) return
    const m = (item.url || '').match(/divar\.ir\/v\/([A-Za-z0-9_-]+)/)
    if (!m) return
    setGettingPhone(true)
    try {
      const r = await fetch(`/api/divar/contact?token=${m[1]}`)
      const d = await r.json()
      setPhone(d.phone || 'شماره در دسترس نیست')
    } catch { setPhone('خطا') } finally { setGettingPhone(false) }
  }

  const analyze = async () => {
    if (!item || analyzing) return
    setAnalyzing(true); setAnalysis('')
    const info = `عنوان: ${item.title}\nقیمت: ${item.price || '-'}\nموقعیت: ${item.location || '-'}\n${facts.map(f => `${f.label}: ${f.value}`).join('\n')}\nتوضیحات: ${(item.excerpt || '').slice(0, 1000)}`
    try {
      const r = await fetch('/api/ai/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: 'pricing', input: `این آگهی ملک را تحلیل کن: نکات مثبت، نکات منفی، برآورد منصفانهٔ قیمت و توصیه به خریدار. مختصر و فارسی.\n\n${info}` }) })
      const d = await r.json()
      setAnalysis(d.ok ? d.text : `⚠ ${d.error || 'خطا'}`)
    } catch { setAnalysis('⚠ خطا در ارتباط') } finally { setAnalyzing(false) }
  }

  const images = gallery.length ? gallery : (item?.image ? [item.image] : [])

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
              {/* Gallery */}
              <div>
                <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--line)', minHeight: 320 }}>
                  {images.length ? (
                    <img src={images[activeImg]} alt={item.title} style={{ width: '100%', maxHeight: 480, objectFit: 'cover', display: 'block' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  ) : (
                    <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, opacity: 0.1 }}>🏠</div>
                  )}
                  {images.length > 1 && (
                    <div style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 999, padding: '4px 12px', fontSize: 12 }}>
                      {toFa(activeImg + 1)} / {toFa(images.length)}
                    </div>
                  )}
                </div>
                {images.length > 1 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 4 }}>
                    {images.map((src, i) => (
                      <button key={i} onClick={() => setActiveImg(i)} style={{
                        flexShrink: 0, width: 84, height: 60, borderRadius: 10, padding: 0, cursor: 'pointer', overflow: 'hidden',
                        border: `2px solid ${i === activeImg ? 'var(--gold)' : 'transparent'}`, background: 'var(--surface)',
                      }}>
                        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden' }} />
                      </button>
                    ))}
                  </div>
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

              {/* Facts */}
              {facts.length > 0 && (
                <div className="mjp-facts" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(facts.length, 4)},1fr)`, gap: 12 }}>
                  {facts.slice(0, 8).map(f => (
                    <div key={f.label} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{f.value}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{f.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* AI analysis */}
              <div style={{ position: 'relative', background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: 18, padding: 22, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: analysis || analyzing ? 14 : 0, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#16140f', fontWeight: 800 }}>✦</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>تحلیل هوشمند ملک‌جت</div>
                  </div>
                  {!analysis && <button onClick={analyze} disabled={analyzing} style={{ padding: '8px 16px', borderRadius: 10, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: analyzing ? 0.6 : 1 }}>{analyzing ? 'در حال تحلیل…' : 'تحلیل این ملک'}</button>}
                </div>
                {analysis && <p style={{ fontSize: 14.5, lineHeight: 1.95, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{analysis}</p>}
              </div>

              {/* Description */}
              {item.excerpt && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>توضیحات</div>
                  <p style={{ fontSize: 14.5, lineHeight: 1.9, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{item.excerpt}</p>
                </div>
              )}

              {/* Meta chips */}
              {item.meta && Object.keys(item.meta).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(item.meta).filter(([k]) => !['city_id', 'category', 'district_id', 'lat', 'lng'].includes(k)).map(([k, v]) => (
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

                {(item as any).owner && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
                    <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>{((item as any).owner || '؟').slice(0, 1)}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{(item as any).owner}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>مالک / مشاور آگهی</div>
                    </div>
                  </div>
                )}

                {(item.phone || (phone && /^\d/.test(phone))) ? (
                  <a href={`tel:${item.phone || phone}`} style={{ display: 'block', textAlign: 'center', padding: '13px', borderRadius: 12, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', textDecoration: 'none', fontWeight: 800 }}>
                    ☎ تماس — {item.phone || phone}
                  </a>
                ) : phone ? (
                  <div style={{ textAlign: 'center', padding: '13px', borderRadius: 12, background: 'var(--bg2)', color: 'var(--muted)', fontSize: 13 }}>{phone}</div>
                ) : (
                  <button onClick={getContact} disabled={gettingPhone} style={{ width: '100%', padding: '13px', borderRadius: 12, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', border: 'none', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, opacity: gettingPhone ? 0.6 : 1 }}>
                    {gettingPhone ? 'در حال دریافت…' : 'دریافت اطلاعات تماس'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
