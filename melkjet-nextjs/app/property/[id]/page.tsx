'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Nav from '@/app/components/Nav'
import PropertyMap from '@/app/components/PropertyMap'
import CompareButton from '@/app/components/CompareButton'
import { openAuth } from '@/app/components/AuthModal'

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
  const [nearby, setNearby] = useState<{ type?: string; name?: string; time: string }[]>([])
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [market, setMarket] = useState<{ stats: { avg: number; count: number; trend: { month: string; avg: number }[] } | null; value?: number } | null>(null)
  const [forecast, setForecast] = useState<{ points: { label: string; value: number; kind: string }[]; currentAvg: number; yearGrowthPct: number; monthlyGrowthPct: number; method: string; confidence: string; samples: number } | null>(null)
  const [selMonth, setSelMonth] = useState<number | null>(null)
  const [aiError, setAiError] = useState('')
  const [similar, setSimilar] = useState<Item[]>([])
  const [phone, setPhone] = useState<string | null>(null)
  const [gettingPhone, setGettingPhone] = useState(false)
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [revealed, setRevealed] = useState(false)
  const pendingReveal = useRef(false)
  const [loan, setLoan] = useState(5_000_000_000)
  const [ask, setAsk] = useState('')
  const [askMsgs, setAskMsgs] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const [asking, setAsking] = useState(false)
  // چت با صاحب آگهی (در پنل خریدار هم ذخیره می‌شود)
  const [ownerThread, setOwnerThread] = useState<{ from: 'buyer' | 'owner'; text: string }[]>([])
  const [ownerInput, setOwnerInput] = useState('')
  const [ownerBusy, setOwnerBusy] = useState(false)
  const [ownerSent, setOwnerSent] = useState('')
  const [chatNeedLogin, setChatNeedLogin] = useState(false)

  const sendOwnerChat = async (q?: string) => {
    const content = (q ?? ownerInput).trim()
    if (!content || !item || ownerBusy) return
    const ownerPhone = String((item.meta as Record<string, string> | undefined)?.__ownerPhone || '').trim()
    setOwnerBusy(true); setChatNeedLogin(false); setOwnerSent('')
    try {
      const r = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start', listingId: item.id, listingTitle: item.title, ownerPhone, ownerName: item.owner || 'صاحب آگهی', text: content }) })
      if (r.status === 401) { setChatNeedLogin(true); setOwnerInput(content); return }
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setOwnerSent('⚠ ' + (d.error || 'ارسال نشد')); return }
      setOwnerInput('')
      setOwnerThread(t => [...t, { from: 'buyer', text: content }])
      setOwnerSent('✓ پیام شما برای صاحب آگهی ارسال شد. پاسخ را در پنل کاربری‌تان، بخش «گفتگوها» می‌بینید.')
    } catch { setOwnerSent('⚠ خطا در ارتباط') } finally { setOwnerBusy(false) }
  }

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
      // ثبتِ بازدید (باز شدنِ آگهی) — برای گزارشِ صاحبِ آگهی
      try { fetch('/api/listing-stats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'view', id: it.id }) }).catch(() => {}) } catch {}
      // گالری و موقعیتِ آگهیِ ثبت‌شده توسط کاربر/مشاور (در meta ذخیره شده)
      const g = it.meta?.['__gallery']
      if (g) { const imgs = g.split(/[\n,]+/).map(s => s.trim()).filter(Boolean); if (imgs.length) setGallery(imgs) }
      const mlat = Number(it.meta?.['__lat']); const mlng = Number(it.meta?.['__lng'])
      if (mlat && mlng) setGeo({ lat: mlat, lng: mlng })
      // real market stats (price/m² of the neighbourhood, from our scraped data)
      const mq = new URLSearchParams({ city: it.meta?.['شهر'] || '', district: it.meta?.['محله'] || '', price: it.price || '', title: it.title || '' })
      fetch(`/api/market/stats?${mq}`).then(r => r.ok ? r.json() : null).then(setMarket).catch(() => {})
      // پیش‌بینیِ قیمت (مدلِ رگرسیونیِ یادگیریِ ماشین روی دادهٔ واقعی؛ اگر دادهٔ محله نبود، قیمتِ همین ملک مبنا)
      const fq = new URLSearchParams({ city: it.meta?.['شهر'] || '', district: it.meta?.['محله'] || it.location || '', price: it.price || '', area: it.meta?.['متراژ'] || '', title: it.title || '' })
      fetch(`/api/market/forecast?${fq}`).then(r => r.ok ? r.json() : null).then(d => setForecast(d?.forecast || null)).catch(() => {})
      // similar (same category, exclude self)
      fetch(`/api/content?type=listing&limit=12`).then(r => r.ok ? r.json() : { items: [] }).then(s => {
        setSimilar((s.items || []).filter((x: Item) => x.id !== it.id).slice(0, 3))
      }).catch(() => {})
      // غنی‌سازی فقط یک‌بار (هنگامِ اسکرپ) ساخته و در دیتابیس ذخیره می‌شود؛ این‌جا فقط از کش خوانده می‌شود.
      // اگر آگهیِ قدیمی هنوز غنی نشده باشد، سرور در پس‌زمینه گرمش می‌کند و یک‌بار دوباره از دیتابیس می‌خوانیم.
      const loadEnrich = (retry = false) => {
        fetch(`/api/listing/enrich?id=${id}`).then(r => r.ok ? r.json() : null).then((e: any) => {
          if (!e) { setAiError('تحلیل در دسترس نیست'); return }
          if (e.gallery?.length) setGallery(e.gallery)
          if (e.facts?.length) setFacts(e.facts)
          if (e.amenities?.length) setDivarAmenities(e.amenities)
          if (e.geo) setGeo(e.geo)
          if (e.nearby?.length) setNearby(e.nearby)
          // اگر دسترسی‌ها در کش نبود ولی مختصات داریم، همان‌جا با نشان (فاصله/زمانِ واقعی) بساز.
          else {
            const g = e.geo || (mlat && mlng ? { lat: mlat, lng: mlng } : null)
            if (g) fetch(`/api/geo/nearby?lat=${g.lat}&lng=${g.lng}`).then(r => r.ok ? r.json() : null).then((d: any) => { if (d?.nearby?.length) setNearby(d.nearby) }).catch(() => {})
          }
          if (e.description) setItem(p => p ? { ...p, excerpt: e.description } : p)
          if (e.analysis) {
            setAnalysis(e.analysis); setAiError('')
            if (!e.facts?.length && e.analysis.facts?.length) setFacts(e.analysis.facts)
            if (e.analysis.amenities?.length) setAiAmenities(e.analysis.amenities)
          } else if (e.pending && !retry) {
            // در پس‌زمینه در حالِ ساخت است — یک‌بار دیگر (بدونِ اجرای دوبارهٔ AI) از دیتابیس بخوان.
            setAiError('تحلیل هوشمند در حالِ آماده‌سازی است…')
            setTimeout(() => loadEnrich(true), 9000)
          } else setAiError('تحلیل هوشمند هنوز آماده نیست — چند لحظه بعد دوباره باز کنید')
        }).catch(() => setAiError('خطا در ارتباط با هوش مصنوعی'))
      }
      loadEnrich()
    }).catch(() => setLoading(false))
  }, [id])


  const images = gallery.length ? gallery : (item?.image ? [item.image] : [])
  const dealStatus: 'sold' | 'rented' | '' = item?.meta?.['__dealStatus'] === 'sold' ? 'sold' : item?.meta?.['__dealStatus'] === 'rented' ? 'rented' : ''
  const amenities = (() => {
    const text = (item?.excerpt || '') + ' ' + facts.map(f => f.label + ' ' + f.value).join(' ')
    const fromText = AMENITY_WORDS.filter(w => text.includes(w))
    return Array.from(new Set([...divarAmenities, ...fromText, ...aiAmenities]))
  })()
  // مشخصاتِ نمایشی: ادغامِ متاهای کلیدیِ آگهی (طبقه، متراژ، …) با factهای غنی‌سازی.
  const specKeys = ['متراژ', 'اتاق خواب', 'طبقه', 'تعداد طبقات', 'سال ساخت', 'جهت', 'سند', 'نوع ملک']
  const metaSpecs = specKeys.map(k => ({ label: k, value: String(item?.meta?.[k] || '') })).filter(s => s.value)
  const specLabels = new Set(metaSpecs.map(s => s.label))
  const specs = [...metaSpecs, ...facts.filter(f => !specLabels.has(f.label) && f.value)]
  // قیمت هر متر (فقط فروش) — مستقل از فرمتِ قیمت و ارقامِ فارسی.
  const perMeter = (() => {
    if (item?.meta?.['نوع معامله'] === 'اجاره') return ''
    const toLatin = (s: string) => (s || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    const area = parseInt(toLatin(String(item?.meta?.['متراژ'] || facts.find(f => f.label === 'متراژ')?.value || '')).replace(/[^\d]/g, ''), 10)
    const price = parseInt(toLatin(item?.price || '').replace(/[^\d]/g, ''), 10)
    if (!area || !price) return ''
    const pm = Math.round(price / area)
    if (pm >= 1e9) return `${toFa((pm / 1e9).toFixed(1))} میلیارد / متر`
    if (pm >= 1e6) return `${toFa(String(Math.round(pm / 1e6)))} میلیون / متر`
    return `${toFa(String(pm))} تومان / متر`
  })()

  // وضعیتِ ورود (برای محدودکردنِ نمایشِ شماره)
  useEffect(() => { fetch('/api/auth/profile').then(r => r.ok ? r.json() : null).then(d => setLoggedIn(!!(d && d.phone))).catch(() => setLoggedIn(false)) }, [])

  // واکشیِ شمارهٔ آگهی‌های دیوار (پس از احرازِ ورود)
  const fetchDivarPhone = async () => {
    if (!item) return
    const m = (item.url || '').match(/divar\.ir\/v\/([A-Za-z0-9_-]+)/); if (!m) return
    setGettingPhone(true)
    try { const r = await fetch(`/api/divar/contact?token=${m[1]}`); const d = await r.json(); setPhone(d.phone || 'شماره در دسترس نیست') }
    catch { setPhone('خطا') } finally { setGettingPhone(false) }
  }

  // شمارهٔ تماسِ آگهی: شمارهٔ خودِ آگهی، وگرنه شمارهٔ حسابِ صاحبِ آگهی (مشاور/مالک).
  const ownerAccountPhone = String((item?.meta as Record<string, string> | undefined)?.__ownerPhone || '').trim()
  const contactPhone = (item?.phone && String(item.phone).trim()) || ownerAccountPhone || ''

  const doReveal = async () => {
    if (!item) return
    setRevealed(true)
    try { await fetch('/api/listing-stats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'contact', id: item.id }) }) } catch {}
    // اگر شماره‌ای روی آگهی/حساب نیست ولی لینکِ دیوار دارد، شماره را از دیوار بگیر.
    if (!contactPhone && (item.url || '').includes('divar.ir/v/')) fetchDivarPhone()
  }
  // نمایشِ اطلاعات تماس — فقط برای کاربرِ واردشده؛ کلیک ثبت و به صاحبِ آگهی گزارش می‌شود
  const revealContact = () => {
    if (!item) return
    if (!loggedIn) { pendingReveal.current = true; openAuth('برای دیدن اطلاعات تماس، وارد شوید'); return }
    doReveal()
  }
  // پس از ورودِ موفق از پاپ‌آپ، اگر کاربر منتظرِ شماره بود، نمایش بده
  useEffect(() => {
    const onAuth = () => { setLoggedIn(true); if (pendingReveal.current) { pendingReveal.current = false; doReveal() } }
    window.addEventListener('mj-auth-success', onAuth)
    return () => window.removeEventListener('mj-auth-success', onAuth)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item])

  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 22 }
  const monthly = (() => { const r = 0.18 / 12, n = 240; return loan * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) })()

  return (
    <div dir="rtl" className="mjp-page" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
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
                {images.length ? <img src={images[activeImg]} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: dealStatus ? 'grayscale(0.5) brightness(0.72)' : 'none' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, opacity: 0.1 }}>🏠</div>}
                {dealStatus && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <span style={{ transform: 'rotate(-12deg)', background: dealStatus === 'sold' ? 'rgba(231,74,74,0.94)' : 'rgba(74,144,231,0.94)', color: '#fff', fontWeight: 900, fontSize: 34, padding: '12px 38px', borderRadius: 16, border: '3px solid rgba(255,255,255,0.9)', boxShadow: '0 10px 40px -8px rgba(0,0,0,0.7)', letterSpacing: '1px' }}>
                      {dealStatus === 'sold' ? 'فروخته شد' : 'اجاره رفت'}
                    </span>
                  </div>
                )}
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

              {specs.length > 0 && (
                <div className="mjp-facts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 12 }}>
                  {perMeter && (
                    <div style={{ ...card, padding: '14px 10px', textAlign: 'center', borderRadius: 14, borderColor: 'var(--gold)' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)', wordBreak: 'break-word' }}>{perMeter}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>قیمت هر متر</div>
                    </div>
                  )}
                  {specs.map(f => (
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

              {/* روند و پیش‌بینیِ قیمت — مدلِ رگرسیونی روی دادهٔ واقعیِ محله، با ماهِ جاری و ۳ ماه پیش‌بینی */}
              {forecast && forecast.points.length > 0 && (() => {
                const pts = forecast.points
                const max = Math.max(...pts.map(p => p.value)) || 1
                const sel = selMonth != null ? pts[selMonth] : null
                const growthPos = forecast.yearGrowthPct >= 0
                const confLabel = forecast.confidence === 'high' ? 'دقتِ بالا' : forecast.confidence === 'medium' ? 'دقتِ متوسط' : 'دقتِ پایه'
                return (
                  <div style={card}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>روند و پیش‌بینیِ قیمت</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>میانگین قیمت هر متر در {item.meta?.['محله'] || item.location}</div>
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ color: growthPos ? '#5fd98a' : '#ef4444', fontWeight: 700, fontSize: 13 }}>{growthPos ? '↗' : '↘'} {toFa(Math.abs(Math.round(forecast.yearGrowthPct)))}٪ رشدِ سالانه (پیش‌بینی)</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>مدلِ یادگیریِ ماشین · {confLabel}</div>
                      </div>
                    </div>
                    {/* مقدارِ ماهِ انتخاب‌شده */}
                    <div style={{ fontSize: 12.5, marginBottom: 10, minHeight: 18, color: 'var(--muted)' }}>
                      {sel ? <span><b style={{ color: 'var(--gold)' }}>{sel.label}</b>: {toFa(Math.round(sel.value / 1e6))} م.ت/متر{sel.kind === 'forecast' ? ' (پیش‌بینی)' : sel.kind === 'current' ? ' (ماهِ جاری)' : ''}</span> : 'روی هر ماه بزنید تا قیمتِ آن را ببینید.'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 140 }}>
                      {pts.map((p, i) => {
                        const isCur = p.kind === 'current'
                        const isFc = p.kind === 'forecast'
                        const on = selMonth === i
                        return (
                          <button key={i} onClick={() => setSelMonth(on ? null : i)} title={`${p.label}: ${Math.round(p.value / 1e6)} م.ت/متر`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                            <div style={{
                              width: '100%', height: `${Math.max(6, (p.value / max) * 110)}px`, borderRadius: 6,
                              background: isCur ? 'linear-gradient(180deg,var(--gold2),var(--gold))' : isFc ? 'repeating-linear-gradient(45deg,var(--goldDim),var(--goldDim) 5px,transparent 5px,transparent 9px)' : 'var(--goldDim)',
                              border: on ? '2px solid var(--gold)' : isCur ? '1px solid var(--gold)' : isFc ? '1px dashed var(--line2)' : 'none',
                            }} />
                            <span style={{ fontSize: 9, color: isCur ? 'var(--gold)' : 'var(--faint)', fontWeight: isCur ? 700 : 400 }}>{p.label}</span>
                          </button>
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 11, color: 'var(--faint)', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}><span style={{ width: 11, height: 11, borderRadius: 3, background: 'var(--goldDim)' }} /> روند</span>
                      <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}><span style={{ width: 11, height: 11, borderRadius: 3, background: 'var(--gold)' }} /> ماهِ جاری</span>
                      <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}><span style={{ width: 11, height: 11, borderRadius: 3, background: 'repeating-linear-gradient(45deg,var(--goldDim),var(--goldDim) 3px,transparent 3px,transparent 6px)', border: '1px dashed var(--line2)' }} /> پیش‌بینی</span>
                      <span style={{ marginInlineStart: 'auto' }}>{forecast.method}</span>
                    </div>
                  </div>
                )
              })()}

              {/* nearby — فقط مکان‌های واقعی از نشان/OSM بر اساس مختصات واقعی ملک */}
              {nearby.length ? (
                <div style={card}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>دسترسی‌های اطراف</div>
                  <div className="mjp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {nearby.map((n, i) => (
                      <div key={(n.name || '') + i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'var(--bg2)', border: '1px solid var(--line)' }}>
                        <span style={{ fontSize: 22 }}>{nearbyIcon(n)}</span>
                        <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{n.name}</div><div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700 }}>{[n.type, n.time].filter(Boolean).join(' · ')}</div></div>
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
                    {similar.map(s => {
                      const sd = s.meta?.['__dealStatus']
                      return (
                      <Link key={s.id} href={`/property/${s.id}`} style={{ textDecoration: 'none', ...card, padding: 0, overflow: 'hidden', display: 'block' }}>
                        <div style={{ height: 110, background: 'var(--bg2)', position: 'relative' }}>
                          {s.image && <img src={s.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: sd ? 'grayscale(0.5) brightness(0.72)' : 'none' }} />}
                          {sd && <span style={{ position: 'absolute', top: 8, right: 8, background: sd === 'sold' ? 'rgba(231,74,74,0.94)' : 'rgba(74,144,231,0.94)', color: '#fff', fontWeight: 800, fontSize: 10.5, padding: '3px 8px', borderRadius: 7 }}>{sd === 'sold' ? 'فروخته شد' : 'اجاره رفت'}</span>}
                        </div>
                        <div style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 6 }}>{s.location}</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)' }}>{s.price}</div>
                        </div>
                      </Link>
                    )})}
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
                {revealed && (contactPhone || (phone && /^\d/.test(phone))) ? (
                  <a href={`tel:${contactPhone || phone}`} style={{ display: 'block', textAlign: 'center', padding: '13px', borderRadius: 12, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', textDecoration: 'none', fontWeight: 800, direction: 'ltr' }}>☎ تماس — {contactPhone || phone}</a>
                ) : revealed && gettingPhone ? (
                  <div style={{ textAlign: 'center', padding: '13px', borderRadius: 12, background: 'var(--bg2)', color: 'var(--muted)', fontSize: 13 }}>در حال دریافت شماره…</div>
                ) : revealed && phone ? (
                  <div style={{ textAlign: 'center', padding: '13px', borderRadius: 12, background: 'var(--bg2)', color: 'var(--muted)', fontSize: 13 }}>{phone}</div>
                ) : revealed ? (
                  <div style={{ textAlign: 'center', padding: '13px', borderRadius: 12, background: 'var(--bg2)', color: 'var(--muted)', fontSize: 13 }}>شمارهٔ تماسی برای این آگهی ثبت نشده — از «چت با صاحب آگهی» استفاده کنید.</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderRadius: 12, background: 'var(--bg2)', border: '1px dashed var(--line2)', marginBottom: 10 }}>
                      <span style={{ fontSize: 16 }}>☎</span>
                      <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 2, color: 'var(--muted)', direction: 'ltr', filter: 'blur(0.5px)' }}>۰۹•• ••• ••••</span>
                      <span style={{ marginInlineStart: 'auto', fontSize: 11.5, color: 'var(--faint)' }}>{loggedIn ? 'برای نمایش کلیک کنید' : 'برای دیدن، وارد شوید'}</span>
                    </div>
                    <button onClick={revealContact} disabled={gettingPhone} style={{ width: '100%', padding: '13px', borderRadius: 12, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', border: 'none', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, opacity: gettingPhone ? 0.6 : 1 }}>نمایش اطلاعات تماس</button>
                  </>
                )}
              </div>

              {/* compare */}
              <div style={card}>
                <CompareButton variant="full" entry={{ kind: 'item', id: String(item.id), title: item.title, photo: (item.image && (String(item.image).startsWith('http') || String(item.image).startsWith('/'))) ? item.image : undefined, subtitle: item.location }} />
              </div>

              {/* chat with owner — saved to buyer panel */}
              <div id="mjp-chat" style={{ ...card, border: '1px solid var(--gold)', scrollMarginTop: 80 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16140f', fontWeight: 800 }}>💬</span>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13.5 }}>چت با صاحب آگهی</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{item.owner || 'صاحب آگهی'} · پاسخِ شخصِ آگهی‌دهنده</div></div>
                </div>

                {ownerThread.length > 0 && (
                  <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                    {ownerThread.map((m, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{ maxWidth: '85%', padding: '8px 11px', borderRadius: 12, fontSize: 12.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', borderTopRightRadius: 4 }}>
                          {m.text}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {ownerSent && <div style={{ fontSize: 11.5, color: ownerSent.startsWith('✓') ? 'var(--gold)' : '#ef4444', marginBottom: 10, lineHeight: 1.7 }}>{ownerSent}</div>}

                {ownerThread.length === 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {['سلام، هنوز موجوده؟', 'امکان بازدید هست؟', 'قیمت قابل مذاکره است؟'].map(c => (
                      <button key={c} onClick={() => sendOwnerChat(c)} disabled={ownerBusy} style={{ padding: '7px 11px', borderRadius: 999, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>{c}</button>
                    ))}
                  </div>
                )}

                {chatNeedLogin ? (
                  <a href={`/auth?next=/property/${item.id}`} style={{ display: 'block', textAlign: 'center', padding: '11px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--gold)', color: 'var(--gold)', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>برای چت با صاحب آگهی وارد شوید →</a>
                ) : (
                  <form onSubmit={e => { e.preventDefault(); sendOwnerChat() }} style={{ display: 'flex', gap: 7 }}>
                    <input value={ownerInput} onChange={e => setOwnerInput(e.target.value)} placeholder="پیامت را بنویس…" style={{ flex: 1, padding: '9px 11px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 12.5, outline: 'none', fontFamily: 'inherit' }} />
                    <button type="submit" disabled={ownerBusy || !ownerInput.trim()} style={{ padding: '9px 16px', borderRadius: 9, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', border: 'none', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', opacity: ownerBusy || !ownerInput.trim() ? .6 : 1 }}>ارسال</button>
                  </form>
                )}
                <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8, textAlign: 'center' }}>این گفتگو در پنل خریدار شما هم ذخیره می‌شود · <a href="/buyer" style={{ color: 'var(--gold)' }}>مشاهده</a></div>
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

      {/* نوارِ اکشنِ چسبانِ پایین (موبایل) — مثلِ دیوار: چت + اطلاعات تماس همیشه جلوی چشم */}
      {item && (
        <div className="mjp-actionbar" style={{ position: 'fixed', bottom: 0, insetInlineStart: 0, insetInlineEnd: 0, zIndex: 60, display: 'none', gap: 10, padding: '10px 14px calc(10px + env(safe-area-inset-bottom))', background: 'var(--surface)', borderTop: '1px solid var(--line2)', boxShadow: '0 -4px 22px -10px rgba(0,0,0,.6)' }}>
          <button onClick={() => { const el = document.getElementById('mjp-chat'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
            style={{ flex: 1, height: 46, borderRadius: 12, border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)', fontWeight: 800, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>💬 چت</button>
          {revealed && (contactPhone || (phone && /^\d/.test(phone))) ? (
            <a href={`tel:${contactPhone || phone}`} style={{ flex: 1, height: 46, borderRadius: 12, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', textDecoration: 'none', fontWeight: 800, fontSize: 14, direction: 'ltr', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>☎ {contactPhone || phone}</a>
          ) : (
            <button onClick={revealContact} disabled={gettingPhone}
              style={{ flex: 1, height: 46, borderRadius: 12, border: 'none', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: gettingPhone ? 0.6 : 1 }}>☎ اطلاعات تماس</button>
          )}
        </div>
      )}
    </div>
  )
}
