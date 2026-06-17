'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Nav from '@/app/components/Nav'
import PropertyMap from '@/app/components/PropertyMap'

interface Item {
  id: string; type: string; category?: string; title: string; price?: string
  location?: string; image?: string; url?: string; excerpt?: string; phone?: string
  owner?: string; sourceName: string; status: string; scrapedAt: number; meta?: Record<string, string>
}
interface Fact { label: string; value: string }
interface Analysis {
  summary: string; pros: string[]; cons: string[]; scores: Record<string, number>; confidence: number
  facts?: Fact[]; amenities?: string[]
  nearby?: { type?: string; name?: string; label?: string; time: string }[]
  priceTrend?: { values: number[]; yearGrowth: string; forecast: string }
  originality?: { verdict: string; fakeProbability: string }
}
const MONTHS = ['تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند', 'فروردین', 'اردیبهشت', 'خرداد']
const NEARBY_ICONS: Record<string, string> = { مترو: '🚇', 'مرکز خرید': '🛍', بیمارستان: '🏥', پارک: '🌳', مدرسه: '🏫', اتوبوس: '🚌', بانک: '🏦', بزرگراه: '🛣', دانشگاه: '🎓', پاساژ: '🛍', بوستان: '🌳' }
// نزدیک‌ترین آیکن را بر اساس نوع یا کلمات کلیدی نام محل پیدا کن
function nearbyIcon(n: { type?: string; name?: string; label?: string }): string {
  const hay = `${n.type || ''} ${n.name || ''} ${n.label || ''}`
  for (const [k, v] of Object.entries(NEARBY_ICONS)) if (hay.includes(k)) return v
  return '📍'
}

function toFa(n: number | string): string { return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]) }
function timeAgo(ts: number): string {
  const h = Math.floor((Date.now() - ts) / 3600000)
  if (h < 1) return 'کمتر از یک ساعت پیش'
  if (h < 24) return `${toFa(h)} ساعت پیش`
  return `${toFa(Math.floor(h / 24))} روز پیش`
}

const AMENITY_WORDS = ['آسانسور', 'پارکینگ', 'انباری', 'بالکن', 'تراس', 'کولر', 'پکیج', 'لابی', 'سالن اجتماعات', 'استخر', 'سونا', 'جکوزی', 'روف‌گاردن', 'دوربین', 'سیستم امنیتی', 'لاندری', 'مستر', 'نگهبان', 'سرایدار']

function ScoreRing({ value, label }: { value: number; label: string }) {
  const r = 20, circ = 2 * Math.PI * r, filled = (value / 10) * circ
  const color = value >= 8 ? '#5fd98a' : value >= 6 ? 'var(--gold)' : '#e7a14a'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: 56, height: 56 }}>
        <svg width="56" height="56" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="28" cy="28" r={r} fill="none" stroke="var(--line2)" strokeWidth="4" />
          <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4" strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color }}>{toFa(value)}</div>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', textAlign: 'center' }}>{label}</div>
    </div>
  )
}

export default function PropertyPage() {
  const id = String(useParams()?.id || '')
  const [item, setItem] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)
  const [gallery, setGallery] = useState<string[]>([])
  const [activeImg, setActiveImg] = useState(0)
  const [facts, setFacts] = useState<Fact[]>([])
  const [aiAmenities, setAiAmenities] = useState<string[]>([])
  const [divarAmenities, setDivarAmenities] = useState<string[]>([])
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [market, setMarket] = useState<{ stats: { avg: number; count: number; trend: { month: string; avg: number }[] } | null; value?: number } | null>(null)
  const [aiError, setAiError] = useState('')
  const [similar, setSimilar] = useState<Item[]>([])
  const [phone, setPhone] = useState<string | null>(null)
  const [gettingPhone, setGettingPhone] = useState(false)
  const [loan, setLoan] = useState(5_000_000_000)
  const [ask, setAsk] = useState('')
  const [askMsgs, setAskMsgs] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const [asking, setAsking] = useState(false)

  const sendAsk = async (q?: string) => {
    const content = (q ?? ask).trim()
    if (!content || !item || asking) return
    setAsk(''); setAskMsgs(m => [...m, { role: 'user', text: content }]); setAsking(true)
    const ctx = `دربارهٔ این آگهی پاسخ بده:\nعنوان: ${item.title}\nقیمت: ${item.price}\nموقعیت: ${item.location}\n${facts.map(f => `${f.label}: ${f.value}`).join('\n')}\nتوضیحات: ${(item.excerpt || '').slice(0, 800)}\n\nسؤال: ${content}`
    try {
      const r = await fetch('/api/ai/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: 'chat', input: ctx }) })
      const d = await r.json()
      setAskMsgs(m => [...m, { role: 'ai', text: d.ok ? d.text : `⚠ ${d.error || 'خطا'}` }])
    } catch { setAskMsgs(m => [...m, { role: 'ai', text: '⚠ خطا در ارتباط' }]) } finally { setAsking(false) }
  }

  useEffect(() => {
    if (!id) return
    fetch(`/api/content/item?id=${id}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : { item: null }).then(d => {
      const it: Item | null = d.item
      setItem(it); setLoading(false)
      if (!it) return
      // real market stats (price/m² of the neighbourhood, from our scraped data)
      const mq = new URLSearchParams({ city: it.meta?.['شهر'] || '', district: it.meta?.['محله'] || '', price: it.price || '', title: it.title || '' })
      fetch(`/api/market/stats?${mq}`).then(r => r.ok ? r.json() : null).then(setMarket).catch(() => {})
      // similar (same category, exclude self)
      fetch(`/api/content?type=listing&limit=12`).then(r => r.ok ? r.json() : { items: [] }).then(s => {
        setSimilar((s.items || []).filter((x: Item) => x.id !== it.id).slice(0, 3))
      }).catch(() => {})
      // Divar gallery + facts + description
      const m = (it.url || '').match(/divar\.ir\/v\/([A-Za-z0-9_-]+)/)
      const finishAnalyze = (fct: Fact[], desc: string, ams: string[] = []) => {
        fetch('/api/ai/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: it.title, price: it.price, location: it.location, facts: fct, description: desc, meta: it.meta, amenities: ams }) })
          .then(r => r.json()).then(a => {
            if (a.ok && a.analysis) {
              setAnalysis(a.analysis)
              // if Divar didn't give structured facts, use the AI-extracted ones
              if (!fct.length && a.analysis.facts?.length) setFacts(a.analysis.facts)
              if (a.analysis.amenities?.length) setAiAmenities(a.analysis.amenities)
            } else setAiError(a.error || 'تحلیل در دسترس نیست')
          }).catch(() => setAiError('خطا در ارتباط با هوش مصنوعی'))
      }
      if (m) {
        fetch(`/api/divar/post?token=${m[1]}`).then(r => r.ok ? r.json() : {}).then((g: any) => {
          if (g.images?.length) setGallery(g.images)
          const fct: Fact[] = g.facts?.length ? g.facts : []
          if (fct.length) setFacts(fct)
          if (g.amenities?.length) setDivarAmenities(g.amenities)
          if (typeof g.lat === 'number' && typeof g.lng === 'number') setGeo({ lat: g.lat, lng: g.lng })
          const desc = g.description || it.excerpt || ''
          if (g.description) setItem(p => p ? { ...p, excerpt: g.description } : p)
          finishAnalyze(fct, desc, g.amenities || [])
        }).catch(() => finishAnalyze([], it.excerpt || ''))
      } else {
        finishAnalyze([], it.excerpt || '')
      }
    }).catch(() => setLoading(false))
  }, [id])

  const images = gallery.length ? gallery : (item?.image ? [item.image] : [])
  const amenities = (() => {
    const text = (item?.excerpt || '') + ' ' + facts.map(f => f.label + ' ' + f.value).join(' ')
    const fromText = AMENITY_WORDS.filter(w => text.includes(w))
    return Array.from(new Set([...divarAmenities, ...fromText, ...aiAmenities]))
  })()
  const perMeter = (() => {
    const area = parseFloat((facts.find(f => f.label === 'متراژ')?.value || '').replace(/[^\d.]/g, ''))
    const priceNum = parseFloat((item?.price || '').replace(/[^\d.]/g, ''))
    if (area && priceNum && /میلیارد/.test(item?.price || '')) return `${toFa((priceNum * 1000 / area).toFixed(0))} میلیون / متر`
    return ''
  })()

  const getContact = async () => {
    if (!item || gettingPhone) return
    const m = (item.url || '').match(/divar\.ir\/v\/([A-Za-z0-9_-]+)/); if (!m) return
    setGettingPhone(true)
    try { const r = await fetch(`/api/divar/contact?token=${m[1]}`); const d = await r.json(); setPhone(d.phone || 'شماره در دسترس نیست') }
    catch { setPhone('خطا') } finally { setGettingPhone(false) }
  }

  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 22 }
  const monthly = (() => { const r = 0.18 / 12, n = 240; return loan * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) })()

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Nav />
      {loading ? (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px', textAlign: 'center', color: 'var(--muted)' }}>در حال بارگذاری…</div>
      ) : !item ? (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, opacity: 0.3, marginBottom: 16 }}>🏠</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>این آگهی یافت نشد</h1>
          <Link href="/search" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>← بازگشت به جستجو</Link>
        </div>
      ) : (
        <>
          {/* gallery */}
          <section style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 24px 0' }}>
            <nav style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--muted)', marginBottom: 16, flexWrap: 'wrap' }}>
              <Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>خانه</Link><span style={{ color: 'var(--faint)' }}>›</span>
              <Link href="/search" style={{ color: 'var(--muted)', textDecoration: 'none' }}>آگهی‌ها</Link>
              {item.location && <><span style={{ color: 'var(--faint)' }}>›</span><span style={{ color: 'var(--text)' }}>{item.location}</span></>}
            </nav>
            <div className="mjp-gallery" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gridTemplateRows: '200px 200px', gap: 10, borderRadius: 20, overflow: 'hidden', height: 410 }}>
              <div style={{ gridRow: '1/3', position: 'relative', background: 'var(--surface)' }}>
                {images.length ? <img src={images[activeImg]} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, opacity: 0.1 }}>🏠</div>}
              </div>
              {[1, 2].map((i, k) => (
                <div key={i} onClick={() => images[i] && setActiveImg(i)} style={{ position: 'relative', background: 'var(--surface)', cursor: 'pointer', overflow: 'hidden' }}>
                  {images[i] ? <img src={images[i]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, opacity: 0.1 }}>🏠</div>}
                  {k === 1 && images.length > 3 && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 800 }}>+{toFa(images.length - 3)} عکس</div>}
                </div>
              ))}
            </div>
            {images.length > 1 && (
              <div className="mjp-thumbs" style={{ display: 'flex', gap: 10, marginTop: 10, overflowX: 'auto', paddingBottom: 4 }}>
                {images.map((src, i) => (
                  <button key={i} onClick={() => setActiveImg(i)} style={{ flexShrink: 0, width: 84, height: 58, borderRadius: 10, padding: 0, cursor: 'pointer', overflow: 'hidden', border: `2px solid ${i === activeImg ? 'var(--gold)' : 'transparent'}` }}>
                    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="mjp-grid" style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 24px 80px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32, alignItems: 'start' }}>
            {/* LEFT */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <h1 style={{ fontSize: 'clamp(20px,3vw,28px)', fontWeight: 800, lineHeight: 1.4, marginBottom: 12 }}>{item.title}</h1>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                  {item.price && <span style={{ fontSize: 26, fontWeight: 900, color: 'var(--gold)' }}>{item.price}</span>}
                  {perMeter && <span style={{ padding: '4px 12px', borderRadius: 999, background: 'var(--goldDim)', border: '1px solid var(--gold)', color: 'var(--gold)', fontSize: 13, fontWeight: 700 }}>{perMeter}</span>}
                </div>
                {item.location && <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, color: 'var(--muted)' }}>📍 {item.location}</div>}
              </div>

              {facts.length > 0 && (
                <div className="mjp-facts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 12 }}>
                  {facts.map(f => (
                    <div key={f.label} style={{ ...card, padding: '14px 10px', textAlign: 'center', borderRadius: 14 }}>
                      <div style={{ fontSize: 15.5, fontWeight: 800, wordBreak: 'break-word' }}>{f.value}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{f.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* AI summary */}
              <div style={{ ...card, border: '1px solid var(--gold)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#16140f', fontWeight: 800 }}>✦</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>خلاصهٔ هوشمند ملک‌جت</div>
                  </div>
                  {analysis && <div style={{ textAlign: 'center' }}><div style={{ fontSize: 20, fontWeight: 900, color: '#5fd98a' }}>{toFa(analysis.confidence)}٪</div><div style={{ fontSize: 10, color: 'var(--faint)' }}>اطمینان</div></div>}
                </div>
                {analysis ? (
                  <>
                    <p style={{ fontSize: 14.5, lineHeight: 1.9, marginBottom: 16 }}>{analysis.summary}</p>
                    <div className="mjp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#5fd98a', marginBottom: 8 }}>✓ نقاط قوت</div>
                        {analysis.pros?.map((p, i) => <div key={i} style={{ fontSize: 13, lineHeight: 1.8 }}>· {p}</div>)}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#e7a14a', marginBottom: 8 }}>⚠ نکات قابل توجه</div>
                        {analysis.cons?.map((c, i) => <div key={i} style={{ fontSize: 13, lineHeight: 1.8 }}>· {c}</div>)}
                      </div>
                    </div>
                  </>
                ) : aiError ? (
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>تحلیل هوشمند در دسترس نیست. <span style={{ color: 'var(--faint)' }}>({aiError})</span></div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>در حال تحلیل این ملک توسط هوش مصنوعی…</div>
                )}
              </div>

              {/* score rings */}
              {analysis?.scores && (
                <div style={card}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--gold)' }}>✦</span> امتیازهای تحلیلی
                    {market?.value != null && market.stats && <span style={{ fontSize: 11, fontWeight: 500, color: '#5fd98a', background: 'rgba(95,217,138,0.12)', borderRadius: 999, padding: '3px 10px' }}>✓ ارزش خرید از {toFa(market.stats.count)} آگهی واقعی محله</span>}
                  </div>
                  <div className="mjp-scores" style={{ display: 'flex', justifyContent: 'space-around', gap: 8, flexWrap: 'wrap' }}>
                    {Object.entries(analysis.scores).map(([label, v]) => {
                      const real = (market?.value != null && /ارزش خرید/.test(label)) ? market.value : Number(v)
                      return <ScoreRing key={label} value={real} label={label} />
                    })}
                  </div>
                </div>
              )}

              {amenities.length > 0 && (
                <div style={card}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>امکانات</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10 }}>
                    {amenities.map(a => <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--line)' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#5fd98a' }} /><span style={{ fontSize: 12.5 }}>{a}</span></div>)}
                  </div>
                </div>
              )}

              {/* price trend — real market data if we have ≥3 months, else AI estimate */}
              {(() => {
                const real = market?.stats?.trend && market.stats.trend.length >= 3
                const labels = real ? market!.stats!.trend.map(t => t.month.split('-')[1] + '/' + t.month.split('-')[0].slice(2)) : MONTHS
                const values = real ? market!.stats!.trend.map(t => t.avg) : (analysis?.priceTrend?.values || [])
                if (!values.length) return null
                const max = Math.max(...values)
                return (
                  <div style={card}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>روند قیمت {real ? '' : 'در ۱۲ ماه'}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>میانگین قیمت هر متر در {item.meta?.['محله'] || item.location}</div>
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        {real ? <div style={{ color: '#5fd98a', fontWeight: 700, fontSize: 12 }}>✓ از {toFa(market!.stats!.count)} آگهی واقعی</div>
                          : analysis?.priceTrend && <><div style={{ color: '#5fd98a', fontWeight: 700, fontSize: 13 }}>↗ {analysis.priceTrend.yearGrowth} رشد سالانه</div><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>تخمین AI · {analysis.priceTrend.forecast}</div></>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140 }}>
                      {values.map((v, i) => {
                        const last = i === values.length - 1
                        return (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                            <div title={real ? `${Math.round(v / 1e6)} م.ت/متر` : ''} style={{ width: '100%', height: `${(v / max) * 110}px`, borderRadius: 6, background: last ? 'linear-gradient(180deg,var(--gold2),var(--gold))' : 'var(--goldDim)', border: last ? '1px solid var(--gold)' : 'none' }} />
                            <span style={{ fontSize: 9, color: 'var(--faint)' }}>{labels[i]}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* nearby */}
              {analysis?.nearby?.length ? (
                <div style={card}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>دسترسی‌های اطراف</div>
                  <div className="mjp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {analysis.nearby.map((n, i) => (
                      <div key={(n.name || n.label || '') + i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'var(--bg2)', border: '1px solid var(--line)' }}>
                        <span style={{ fontSize: 22 }}>{nearbyIcon(n)}</span>
                        <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{n.name || n.label}</div><div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700 }}>{[n.type && n.name ? n.type : '', n.time].filter(Boolean).join(' · ')}</div></div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* map */}
              {geo && (
                <div style={card}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>موقعیت روی نقشه</div>
                  <PropertyMap lat={geo.lat} lng={geo.lng} />
                </div>
              )}

              {/* loan calculator */}
              {item.price && (
                <div style={card}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>ماشین‌حساب وام</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 18 }}>نرخ سود ۱۸٪ سالانه · دورهٔ ۲۰ سال</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ fontSize: 13, color: 'var(--muted)' }}>مبلغ وام</span><span style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold)' }}>{toFa((loan / 1e9).toFixed(1))} میلیارد</span></div>
                  <input type="range" min={1e9} max={1e10} step={1e8} value={loan} onChange={e => setLoan(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--gold)' }} />
                  <div style={{ background: 'var(--bg2)', borderRadius: 14, padding: 16, textAlign: 'center', marginTop: 14 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>قسط ماهانهٔ تخمینی</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--gold)' }}>{toFa((monthly / 1e6).toFixed(1))} میلیون</div>
                  </div>
                </div>
              )}

              {item.excerpt && (
                <div style={card}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>توضیحات</div>
                  <p style={{ fontSize: 14.5, lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{item.excerpt}</p>
                </div>
              )}

              {similar.length > 0 && (
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>آگهی‌های مشابه</div>
                  <div className="mjp-similar" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                    {similar.map(s => (
                      <Link key={s.id} href={`/property/${s.id}`} style={{ textDecoration: 'none', ...card, padding: 0, overflow: 'hidden', display: 'block' }}>
                        <div style={{ height: 110, background: 'var(--bg2)' }}>{s.image && <img src={s.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                        <div style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 6 }}>{s.location}</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)' }}>{s.price}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT */}
            <div className="mjp-side" style={{ position: 'sticky', top: 90, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={card}>
                {item.price && <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--gold)', marginBottom: 4 }}>{item.price}</div>}
                {(item.owner) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0', paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
                    <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{item.owner.slice(0, 1)}</span>
                    <div><div style={{ fontWeight: 700, fontSize: 13.5 }}>{item.owner}</div><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>مالک / مشاور آگهی</div></div>
                  </div>
                )}
                <div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 14 }}>منبع: {item.sourceName} · {timeAgo(item.scrapedAt)}</div>
                {(item.phone || (phone && /^\d/.test(phone))) ? (
                  <a href={`tel:${item.phone || phone}`} style={{ display: 'block', textAlign: 'center', padding: '13px', borderRadius: 12, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', textDecoration: 'none', fontWeight: 800 }}>☎ تماس — {item.phone || phone}</a>
                ) : phone ? (
                  <div style={{ textAlign: 'center', padding: '13px', borderRadius: 12, background: 'var(--bg2)', color: 'var(--muted)', fontSize: 13 }}>{phone}</div>
                ) : (
                  <button onClick={getContact} disabled={gettingPhone} style={{ width: '100%', padding: '13px', borderRadius: 12, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', border: 'none', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, opacity: gettingPhone ? 0.6 : 1 }}>{gettingPhone ? 'در حال دریافت…' : 'دریافت اطلاعات تماس'}</button>
                )}
              </div>

              {/* originality badge */}
              {analysis?.originality && (
                <div style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', gap: 12, border: '1px solid rgba(95,217,138,0.3)' }}>
                  <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(95,217,138,0.15)', color: '#5fd98a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>✓</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>این آگهی توسط ملک‌جت بررسی و <span style={{ color: '#5fd98a' }}>{analysis.originality.verdict}</span> تشخیص داده شد</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>احتمال جعلی بودن: {analysis.originality.fakeProbability}</div>
                  </div>
                </div>
              )}

              {/* ask about this property */}
              <div style={{ ...card, border: '1px solid var(--gold)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16140f', fontWeight: 800 }}>✦</span>
                  <div><div style={{ fontWeight: 700, fontSize: 13.5 }}>دربارهٔ این ملک بپرس</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>دستیار همین آگهی</div></div>
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                  {askMsgs.length === 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {['کیفیت ساخت؟', 'برای سرمایه‌گذاری؟', 'قابل مذاکره؟'].map(c => (
                        <button key={c} onClick={() => sendAsk(c)} style={{ padding: '7px 11px', borderRadius: 999, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>{c}</button>
                      ))}
                    </div>
                  )}
                  {askMsgs.map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-start' : 'flex-end' }}>
                      <div style={{ maxWidth: '88%', fontSize: 12.5, lineHeight: 1.8, padding: '8px 11px', borderRadius: 12, whiteSpace: 'pre-wrap', background: m.role === 'user' ? 'linear-gradient(140deg,var(--gold2),var(--gold))' : 'var(--bg2)', color: m.role === 'user' ? '#16140f' : 'var(--text)' }}>{m.text}</div>
                    </div>
                  ))}
                  {asking && <div style={{ fontSize: 12, color: 'var(--muted)' }}>در حال پاسخ…</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '6px 6px 6px 12px', alignItems: 'center' }}>
                  <input value={ask} onChange={e => setAsk(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendAsk() }} placeholder="سؤالت را بپرس…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13 }} />
                  <button onClick={() => sendAsk()} disabled={asking} style={{ width: 32, height: 32, border: 'none', borderRadius: 9, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', cursor: 'pointer', fontWeight: 800, opacity: asking ? 0.6 : 1 }}>↑</button>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
