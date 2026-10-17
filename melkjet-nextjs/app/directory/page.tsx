'use client'

// فاز ۱۳۰ — بازطراحیِ دایرکتوری طبقِ طرحِ کاربر: هیروی جستجو + سایدبارِ دسته‌ها با شمارشِ واقعی +
// کارت‌های آماری. قانونِ آهنین: هیچ عددی ساختگی نیست — نظر/امتیاز از نظراتِ تأییدشدهٔ واقعی،
// معامله از آگهی‌های فروخته/اجاره‌رفتهٔ خودِ متخصص، عضویت از تاریخِ واقعیِ ثبت‌نام، پروژه از پرشین‌سازه.
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import PageHeader from '@/app/components/PageHeader'
import RevealContact from '@/app/components/RevealContact'
import PromoBadge from '@/app/components/PromoBadge'
import { IconSvg, type IconName } from '@/app/components/GlassIcon'
import { useState, useEffect, useMemo } from 'react'
import { fetchContent, gradientFor, initialsFor, avatarPosFor, type ContentItem } from '@/app/lib/content-display'
import { dirItemScore, computeDist, topPercentLabel, scoreOutOf10, type ScoreDist } from '@/app/lib/provider-score'

// دسته‌های اصلی طبقِ طرح — id همان دستهٔ داخلیِ دایرکتوری است (ROLE_CAT / اسکرپ)
const CATS: { id: string; label: string; icon: IconName }[] = [
  { id: 'مشاور', label: 'مشاوران املاک', icon: 'people' },
  { id: 'آژانس', label: 'آژانس‌ها', icon: 'office' },
  { id: 'سازنده', label: 'سازندگان', icon: 'crane' },
  { id: 'مصالح', label: 'فروشندگان مصالح', icon: 'bricks' },
  { id: 'معمار', label: 'معماران و طراحان', icon: 'ruler' },
  { id: 'پیمانکار', label: 'پیمانکاران', icon: 'tools' },
  { id: 'کارشناس', label: 'کارشناسان رسمی', icon: 'clipboard' },
  { id: 'حقوقی', label: 'دفاتر حقوقی و وکلا', icon: 'scale' },
  { id: 'بیمه', label: 'بانک و بیمه', icon: 'bank' },
  { id: 'دفترخانه', label: 'دفاتر اسناد رسمی', icon: 'doc' },
]
const catLabelOf = (id: string) => CATS.find(c => c.id === id)?.label || id
const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')
const faDec = (n: number) => (Number(n) || 0).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

type Stats = { reviews?: number; rating?: number; deals?: number; listings?: number; memberYears?: number; projects?: number }

function toProfessional(it: ContentItem) {
  const stats = ((it as any).stats || {}) as Stats
  const scrapedRating = Number(it.rating) || 0
  return {
    id: it.id,
    name: it.title,
    role: it.category || 'متخصص',
    // امتیاز: میانگینِ نظراتِ واقعیِ سایت؛ برای آیتم‌های اسکرپ‌شده امتیازِ منبعِ واقعی
    rating: stats.rating || scrapedRating || 0,
    area: it.location || '',
    tags: it.tags || [],
    initials: initialsFor(it.title),
    category: it.category || '',
    promoted: false,
    promoKind: (it as any).promoKind as (string | undefined),
    badges: ((it as any).badges || []) as { id: string; label: string; icon: string; desc?: string }[],
    avatarGradient: gradientFor(it.title, 'avatar'),
    // فاز ۳۰۴ — کارشناس/وکیلِ کانون (hub.23055.ir) → پروفایلِ داخلیِ ملک‌جت، نه سایتِ منبع.
    url: it.url && /bonyadvokala\.com\/lawyers\//.test(it.url) ? `/lawyers/${it.url.match(/\/lawyers\/([^/?#]+)/)?.[1] || ''}`
      : it.url && /hub\.23055\.ir/.test(it.url) ? `/directory/${encodeURIComponent(it.id)}`
      : it.url,
    hasPhone: it.hasPhone,
    image: it.image,
    stats,
    registered: !!(it as any).registered,
    verified: !!(it as any).verified,   // فاز ۲۹۲ — تیکِ آبی
    memberSince: Number((it as any).stats?.memberSince) || Number(it.scrapedAt) || 0,
    revealKind: (it as any).revealKind as ('item' | 'advisor' | 'builder' | undefined),
    revealId: (it as any).revealId as (string | undefined),
  }
}
type Professional = ReturnType<typeof toProfessional>

export default function DirectoryPage() {
  const [activeCategory, setActiveCategory] = useState('مشاور')
  const [searchQuery, setSearchQuery] = useState('')
  const [serviceTag, setServiceTag] = useState('')
  const [city, setCity] = useState('')
  const [items, setItems] = useState<ContentItem[]>([])
  // فاز ۱۷۸ — جستجو/دسته/تگ در URL می‌ماند: برگشت از پروفایل چیزی را نمی‌پراند
  useEffect(() => { try { const sp = new URLSearchParams(window.location.search); const qq = sp.get('q'); if (qq) setSearchQuery(qq); const c = sp.get('cat'); if (c) setActiveCategory(c); const tg = sp.get('tag'); if (tg) setServiceTag(tg) } catch {} }, [])
  useEffect(() => {
    const t = setTimeout(() => { try { const sp = new URLSearchParams(); if (searchQuery) sp.set('q', searchQuery); if (activeCategory !== 'مشاور') sp.set('cat', activeCategory); if (serviceTag) sp.set('tag', serviceTag); window.history.replaceState(null, '', window.location.pathname + (sp.toString() ? '?' + sp.toString() : '')) } catch {} }, 250)
    return () => clearTimeout(t)
  }, [searchQuery, activeCategory, serviceTag])
  const [promoted, setPromoted] = useState<ContentItem[]>([])
  const [sortBy, setSortBy] = useState<'score' | 'top' | 'reviews' | 'newest'>('score')   // فاز ۲۹۲ / ۲۹۸ش (امتیاز پیش‌فرض)
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [extraCats, setExtraCats] = useState<string[]>([])

  // دستهٔ انتخابی از پارامترِ آدرس (?category=) — تا لینک‌های منوی «متخصصان» مستقیم باز شوند.
  useEffect(() => {
    try { const c = new URLSearchParams(window.location.search).get('category'); if (c) setActiveCategory(c) } catch {}
  }, [])

  // شمارشِ واقعیِ هر دسته برای سایدبار + دسته‌های اضافهٔ اسکرپ‌شده
  useEffect(() => {
    fetch('/api/directory?counts=1', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { counts: {} })
      .then(d => setCounts(d.counts || {}))
      .catch(() => {})
    fetch('/api/content/categories', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { categories: [] })
      .then(d => setExtraCats(((d.categories || []) as string[]).filter(c => !CATS.some(k => k.id === c))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setServiceTag(''); setCity('')
    // متخصصانِ ثبت‌شده در سایت (اکانت‌های نقش‌دار) + آیتم‌های اسکرپ‌شدهٔ دایرکتوری — یکجا.
    Promise.all([
      fetch(`/api/directory?category=${encodeURIComponent(activeCategory)}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : { items: [] })).then((d) => (d.items || []) as ContentItem[]).catch(() => [] as ContentItem[]),
      fetchContent('directory', activeCategory),
    ]).then(([registered, scraped]) => {
      if (!alive) return
      const seen = new Set<string>()
      const merged = [...registered, ...scraped].filter((it) => { if (seen.has(it.id)) return false; seen.add(it.id); return true })
      setItems(merged); setLoading(false)
    })
    return () => { alive = false }
  }, [activeCategory])

  useEffect(() => {
    let alive = true
    fetch('/api/promotions?slot=directory_top', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => { if (alive) setPromoted((d.items || []) as ContentItem[]) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const promotedIds = new Set(promoted.map((p) => p.id))
  const all = [...promoted, ...items.filter((p) => !promotedIds.has(p.id))]
    .map((it) => ({ ...toProfessional(it), promoted: promotedIds.has(it.id) || !!(it as any).promoted }))

  // چیپ‌های «نوعِ خدمات» از تگ‌های واقعیِ همین فهرست (پرتکرارترین‌ها) — فیلترِ واقعی، نه تزئینی
  const serviceTags = useMemo(() => {
    const freq = new Map<string, number>()
    for (const p of all) for (const t of p.tags) { const k = String(t).trim(); if (k && !/پروژه$/.test(k)) freq.set(k, (freq.get(k) || 0) + 1) }
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, promoted])

  const cities = useMemo(() => {
    const freq = new Map<string, number>()
    for (const p of all) { const c = (p.area || '').split(/[،,]/)[0].trim(); if (c) freq.set(c, (freq.get(c) || 0) + 1) }
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, promoted])

  // فاز ۲۹۸ش — امتیازِ ملک‌جتِ هر متخصص (یک‌بار) برای مرتب‌سازی + توزیعِ رتبهٔ درصدیِ دسته.
  const scoreById = useMemo(() => new Map(all.map(p => [p.id, dirItemScore(p).score])), [items, promoted])   // eslint-disable-line react-hooks/exhaustive-deps
  const catDist = useMemo(() => computeDist([...scoreById.values()]), [scoreById])

  // فاز ۲۹۲ — مرتب‌سازیِ قابلِ انتخاب. پروموت‌شده‌ها همیشه اول (تعهدِ فروش)؛ بعد معیارِ کاربر:
  // امتیاز = امتیازِ بومیِ ملک‌جت؛ برترین‌ها = امتیازِ بازخورد؛ پرنظرترین‌ها = تعدادِ نظر؛ جدیدترین‌ها = عضویت.
  const cmp: Record<string, (x: Professional, y: Professional) => number> = {
    score: (x, y) => (scoreById.get(y.id) || 0) - (scoreById.get(x.id) || 0),
    top: (x, y) => ((y.rating || 0) - (x.rating || 0)) || ((y.stats.reviews || 0) - (x.stats.reviews || 0)),
    reviews: (x, y) => ((y.stats.reviews || 0) - (x.stats.reviews || 0)) || ((y.rating || 0) - (x.rating || 0)),
    newest: (x, y) => (y.memberSince || 0) - (x.memberSince || 0),
  }
  const filteredProfessionals = all
    .filter((p) => !searchQuery || p.name.includes(searchQuery) || (p.area || '').includes(searchQuery))
    .filter((p) => !serviceTag || p.tags.some(t => String(t).trim() === serviceTag))
    .filter((p) => !city || (p.area || '').split(/[،,]/)[0].trim() === city)
    .sort((x, y) => (Number(y.promoted) - Number(x.promoted)) || (cmp[sortBy] || cmp.top)(x, y))

  // فاز ۲۹۸ک — آمارِ هیرو از دادهٔ «واقعی» (counts سراسری + شهرهای بارگذاری‌شده) — بدونِ عددِ ساختگی.
  const totalPros = Object.values(counts).reduce((a, b) => a + (b || 0), 0)
  const nCats = Object.values(counts).filter(n => (n || 0) > 0).length
  const heroStats = [
    totalPros > 0 && { v: fa(totalPros), l: 'متخصصِ فعال' },
    nCats > 0 && { v: fa(nCats), l: 'دسته‌بندی' },
    cities.length > 0 && { v: fa(cities.length), l: 'شهر' },
  ].filter(Boolean) as { v: string; l: string }[]

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }}>
      <Nav />

      {/* ── هدرِ سینمایی (ری‌برندِ ۲۹۸ی۷) ── */}
      <PageHeader eyebrow="دایرکتوری متخصصان ملک‌جت" title="متخصص و خدماتِ املاک پیدا کن" subtitle="از مشاور و سازنده تا کارشناس، وکیل و پیمانکار — همه در یک‌جا، با امتیاز و نظرِ واقعی.">
        <div style={{ display: 'grid', gap: 16, justifyItems: 'stretch', width: 'min(86vw,360px)' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="نام متخصص یا شهر…"
              style={{ width: '100%', padding: '14px 18px 14px 48px', fontSize: '.95rem', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(247,222,146,.3)', borderRadius: 13, color: '#f3ede0', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#F7DE92' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(247,222,146,.3)' }}
            />
            <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgba(244,238,225,.6)', pointerEvents: 'none', display: 'flex' }}><IconSvg name="search" size={17} /></span>
          </div>
          {heroStats.length > 0 && (
            <div style={{ display: 'flex', gap: 'clamp(18px,4vw,34px)', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              {heroStats.map(st => (
                <div key={st.l} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 23, fontWeight: 900, color: '#F7DE92', lineHeight: 1.1 }}>{st.v}</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(244,238,225,.65)', marginTop: 2 }}>{st.l}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PageHeader>

      {/* ── بدنه: سایدبارِ دسته‌ها (راست) + نتایج ── */}
      <main className="mjdir-body" style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px 64px', display: 'grid', gridTemplateColumns: '270px 1fr', gap: 24, alignItems: 'start' }}>
        {/* سایدبار */}
        <aside className="mjdir-side" style={{ position: 'sticky', top: 16, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', padding: '4px 8px 12px' }}>دسته‌بندی متخصصان</div>
          <div className="mjdir-cats" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[...CATS, ...extraCats.map(c => ({ id: c, label: c, icon: 'layers' as IconName }))].map((cat) => {
              const isActive = activeCategory === cat.id
              const n = counts[cat.id] || 0
              return (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'right',
                    padding: '10px 12px', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                    border: isActive ? '1px solid var(--gold)' : '1px solid transparent',
                    background: isActive ? 'linear-gradient(135deg, var(--goldDim), transparent)' : 'transparent',
                    color: isActive ? 'var(--goldText)' : 'var(--muted)',
                  }}>
                  <span style={{ width: 22, display: 'flex', justifyContent: 'center', flexShrink: 0 }}><IconSvg name={cat.icon} size={16} /></span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 800 : 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.label}</span>
                  {n > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? 'var(--goldText)' : 'var(--faint)', background: isActive ? 'var(--goldDim)' : 'var(--bg2)', border: `1px solid ${isActive ? 'var(--gold)' : 'var(--line)'}`, borderRadius: 999, padding: '2px 9px', flexShrink: 0 }}>{fa(n)}</span>}
                </button>
              )
            })}
          </div>
        </aside>

        {/* نتایج */}
        <section style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <h2 style={{ fontSize: '1.08rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
              {loading ? 'در حال بارگذاری…' : <><span style={{ color: 'var(--goldText)' }}>{fa(filteredProfessionals.length)}</span> {catLabelOf(activeCategory)} فعال</>}
            </h2>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {([['score', 'medal', 'امتیازِ ملک‌جت'], ['top', 'star', 'برترین‌ها'], ['reviews', 'chat', 'پرنظرترین‌ها'], ['newest', 'bolt', 'جدیدترین‌ها']] as ['score' | 'top' | 'reviews' | 'newest', IconName, string][]).map(([id, ic, label]) => {
                const active = sortBy === id
                return (
                  <button key={id} onClick={() => setSortBy(id)}
                    style={{ padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: active ? 800 : 500, cursor: 'pointer', fontFamily: 'inherit', border: active ? '1px solid var(--gold)' : '1px solid var(--line2)', background: active ? 'var(--goldDim)' : 'transparent', color: active ? 'var(--goldText)' : 'var(--muted)', transition: 'all .15s', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <IconSvg name={ic} size={13} />{label}
                  </button>
                )
              })}
            </span>
          </div>

          {/* فیلترِ منطقه — تک‌ردیفِ افقی (نه دیوارِ عمودی که مشاوران را دفن می‌کرد، فاز ۲۹۸ط).
              پرتکرارها نمایش، بقیه از کادرِ جستجو. انتخابِ فعال همیشه در ردیف می‌ماند. */}
          {cities.length > 1 && (() => {
            const TOP = 24
            const shown = city && !cities.slice(0, TOP).includes(city) ? [city, ...cities.slice(0, TOP)] : cities.slice(0, TOP)
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', overflowX: 'auto', marginBottom: 12, paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>منطقه:</span>
                {['', ...shown].map(c => {
                  const active = city === c
                  return (
                    <button key={c || 'all'} onClick={() => setCity(c)}
                      style={{ flexShrink: 0, whiteSpace: 'nowrap', padding: '7px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: active ? 800 : 500, cursor: 'pointer', fontFamily: 'inherit', border: active ? '1px solid var(--gold)' : '1px solid var(--line2)', background: active ? 'var(--goldDim)' : 'transparent', color: active ? 'var(--goldText)' : 'var(--muted)', transition: 'all .15s' }}>
                      {c || 'همه'}
                    </button>
                  )
                })}
                {cities.length > TOP && <span style={{ flexShrink: 0, fontSize: 11.5, color: 'var(--faint)', whiteSpace: 'nowrap', paddingInlineStart: 4 }}>+{fa(cities.length - TOP)} منطقهٔ دیگر — در کادرِ جستجو بنویس</span>}
              </div>
            )
          })()}

          {serviceTags.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>نوع خدمات:</span>
              {['', ...serviceTags].map(t => {
                const active = serviceTag === t
                return (
                  <button key={t || 'all'} onClick={() => setServiceTag(t)}
                    style={{ padding: '7px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: active ? 800 : 500, cursor: 'pointer', fontFamily: 'inherit', border: active ? '1px solid var(--gold)' : '1px solid var(--line2)', background: active ? 'var(--goldDim)' : 'transparent', color: active ? 'var(--goldText)' : 'var(--muted)', transition: 'all .15s' }}>
                    {t || 'همه'}
                  </button>
                )
              })}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--muted)' }}>در حال بارگذاری…</div>
          ) : filteredProfessionals.length > 0 ? (
            <div className="mjdir-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
              {filteredProfessionals.map((pro) => <ProfessionalCard key={pro.id} pro={pro} dist={catDist} />)}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, opacity: 0.4, color: 'var(--muted)' }}><IconSvg name="search" size={48} weight={1.4} /></div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>نتایجی یافت نشد</h3>
              <p style={{ fontSize: '.95rem', color: 'var(--muted)', margin: 0 }}>در حال حاضر متخصصی در دسته‌بندی «{catLabelOf(activeCategory)}» ثبت نشده است.</p>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  )
}

// فاز ۲۹۸ی۲۴ — کارتِ «سینمایی» طبقِ طرحِ A کاربر: عکسِ واقعیِ تمام‌کادر + اسکریمِ تیره +
// محتوای روی تصویر. فقط پالتِ طلاییِ پروژه (هیچ سبزی). بی‌عکس = گرادیانِ گرمِ تیرهٔ برند.
const NOISE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"
// موتیفِ معماریِ خط‌نقشه‌ای (طلایی، کم‌رنگ) برای کارتِ بی‌عکس — تا هیروی سینمایی خالی/تخت به‌نظر نرسد.
const BLUEPRINT = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='180' fill='none' stroke='%23f7e39a' stroke-width='2' stroke-linejoin='round' stroke-linecap='round'%3E%3Cpath d='M30 96 L130 36 L230 96'/%3E%3Crect x='56' y='96' width='148' height='62'/%3E%3Crect x='96' y='116' width='30' height='42'/%3E%3Crect x='146' y='114' width='36' height='28'/%3E%3Cpath d='M30 158 L230 158'/%3E%3Cpath d='M130 36 L130 20'/%3E%3C/svg%3E\")"
const GOLD = '#f7e39a'        // طلاییِ روشنِ برند
const GOLD_MID = '#d9ad3e'    // طلاییِ میانیِ برند
const INK = '#241a06'         // متنِ تیره روی سطحِ طلایی
// گرادیانِ سینماییِ «غروبِ» برند (هم‌خانوادهٔ هیروی صفحهٔ اصلی) — پس‌زمینهٔ تزئینیِ کارتِ بی‌عکس.
const DUSK = 'radial-gradient(560px 320px at 70% 30%, rgba(236,151,56,.32), rgba(188,108,38,.12) 45%, transparent 72%), radial-gradient(380px 240px at 88% -16%, rgba(247,222,146,.2), transparent 64%), linear-gradient(180deg,#0a0e1a 0%,#0c0f18 34%,#15110a 72%,#0b0806 100%)'

function Star({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={GOLD} aria-hidden style={{ flexShrink: 0, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,.5))' }}><path d="M12 2.2l2.95 5.98 6.6.96-4.77 4.65 1.13 6.57L12 17.23l-5.9 3.1 1.13-6.56L2.45 9.14l6.6-.96z" /></svg>
}

function CineStat({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, color: '#fff' }}>
        <span style={{ color: GOLD, display: 'inline-flex' }}><IconSvg name={icon} size={14} /></span>
        <span style={{ fontSize: 15.5, fontWeight: 800, letterSpacing: '-.3px', fontVariantNumeric: 'tabular-nums', textShadow: '0 1px 6px rgba(0,0,0,.5)' }}>{value}</span>
      </div>
      <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.62)', marginTop: 5, whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  )
}

function ProfessionalCard({ pro, dist }: { pro: Professional; dist?: ScoreDist | null }) {
  const [hovered, setHovered] = useState(false)
  const hasArea = !!(pro.area && pro.area.trim())
  const href = pro.url || `/profile/${pro.id}`
  const external = !!pro.url && !pro.url.startsWith('/')
  const s = pro.stats
  // فاز ۲۹۸س — امتیازِ ملک‌جت (همان موتورِ پروفایل) از دادهٔ واقعیِ همین کارت + رتبهٔ درصدیِ درونِ دسته.
  const score = dirItemScore(pro)
  const pct = topPercentLabel(score.score, dist)
  // ستون‌های آماری — فقط «دستاوردِ واقعیِ شمارش‌پذیر» (نه عددِ ساختگی).
  const cells: { icon: IconName; value: string; label: string }[] = []
  if ((s.listings || 0) > 0) cells.push({ icon: 'office', value: fa(s.listings!), label: 'آگهیِ فعال' })
  if ((s.projects || 0) > 0) cells.push({ icon: 'crane', value: fa(s.projects!), label: 'پروژه' })
  if (pro.registered && (s.deals || 0) > 0) cells.push({ icon: 'trophy', value: fa(s.deals!), label: 'معامله' })
  if (pro.registered && (s.memberYears || 0) >= 1) cells.push({ icon: 'clock', value: fa(s.memberYears!), label: 'سال سابقه' })
  const statCells = cells.slice(0, 3)
  const tierChip = pct || (score.score > 0 ? score.tier : '')
  const reviews = s.reviews || 0
  const specialties = pro.tags.length ? pro.tags.slice(0, 3).join('   |   ') : (pro.role || '')
  const isPaid = !!pro.verified
  const showCheck = pro.verified || pro.badges?.some(b => b.id === 'verified')
  const catIcon = CATS.find(c => c.id === pro.category)?.icon
  // لایهٔ پس‌زمینه: عکسِ واقعی، وگرنه گرادیانِ گرمِ تیرهٔ برند (طلایی/برنز روی تیره — بدونِ سبز).
  const bgLayer = pro.image
    ? `${avatarPosFor(pro.category) === 'top' ? 'center top' : 'center'}/cover no-repeat url(${pro.image})`
    : DUSK

  return (
    <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block', textDecoration: 'none', position: 'relative', overflow: 'hidden',
        borderRadius: 24, minHeight: 300, color: '#fff',
        border: pro.promoted ? '1px solid rgba(247,227,154,.55)' : '1px solid rgba(255,255,255,.1)',
        boxShadow: hovered
          ? '0 34px 64px -28px rgba(0,0,0,.85), 0 0 44px -22px rgba(217,173,62,.5)'
          : '0 18px 44px -26px rgba(0,0,0,.72), 0 0 26px -22px rgba(217,173,62,.3)',
        transform: hovered ? 'translateY(-6px) scale(1.008)' : 'none',
        transition: 'transform .3s cubic-bezier(.22,1,.36,1), box-shadow .3s',
      }}>
      {/* عکس/گرادیانِ هیرو — با زومِ نرمِ هاور (حسِ سینمایی) */}
      <span aria-hidden style={{ position: 'absolute', inset: 0, background: bgLayer, transform: hovered ? 'scale(1.055)' : 'scale(1)', transition: 'transform .6s cubic-bezier(.22,1,.36,1)' }} />
      {/* کارتِ بی‌عکس — هالهٔ گرمِ غروب + موتیفِ معماریِ خط‌نقشه‌ای + واترمارکِ حروفِ اول، تا هیرو سینمایی بماند */}
      {!pro.image && <span aria-hidden style={{ position: 'absolute', top: '-16%', insetInlineEnd: '-12%', width: 210, height: 210, borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,170,70,.3), transparent 68%)', filter: 'blur(26px)', pointerEvents: 'none' }} />}
      {!pro.image && <span aria-hidden style={{ position: 'absolute', top: 20, insetInline: 0, height: 152, backgroundImage: BLUEPRINT, backgroundRepeat: 'no-repeat', backgroundPosition: 'center', backgroundSize: '240px auto', opacity: .14, pointerEvents: 'none' }} />}
      {!pro.image && <span aria-hidden style={{ position: 'absolute', top: '4%', insetInlineStart: '5%', fontSize: 120, fontWeight: 900, color: 'rgba(247,227,154,.05)', lineHeight: 1, letterSpacing: '-6px', pointerEvents: 'none' }}>{pro.initials}</span>}
      {/* اسکریمِ تیره برای خوانایی (پایین پررنگ‌تر) */}
      <span aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(5,6,8,.95) 2%, rgba(5,6,8,.74) 24%, rgba(5,6,8,.34) 50%, rgba(5,6,8,.1) 70%, rgba(5,6,8,.5) 100%)' }} />
      {/* گرینِ فیلم (جنسِ مات) */}
      <span aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: NOISE, backgroundSize: '160px 160px', opacity: .05, mixBlendMode: 'overlay', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', minHeight: 300, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '15px 16px 16px', boxSizing: 'border-box' }}>
        {/* ردیفِ بالا — نشانِ «برگزیده» + چیپِ شیشه‌ایِ دستهٔ متخصص */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div>{pro.promoted && <PromoBadge kind={pro.promoKind || 'ویژه'} size="sm" />}</div>
          {catIcon && (
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 11, color: GOLD, background: 'rgba(16,13,8,.42)', border: '1px solid rgba(247,227,154,.28)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}><IconSvg name={catIcon} size={16} /></span>
          )}
        </div>

        {/* بلوکِ پایین — هویت + امتیاز + منطقه + آمار/دکمه */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-.4px', textShadow: '0 2px 16px rgba(0,0,0,.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{pro.name}</span>
            {showCheck && <span title={isPaid ? 'تاییدشدهٔ ملک‌جت' : 'پروفایلِ کامل'} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: isPaid ? '#2f81f7' : GOLD, color: isPaid ? '#fff' : INK, boxShadow: '0 0 0 2px rgba(255,255,255,.3), 0 2px 8px rgba(0,0,0,.45)' }}><IconSvg name="check" size={11} weight={2.8} /></span>}
          </div>

          {specialties && <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.82)', fontWeight: 600, marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 8px rgba(0,0,0,.6)' }}>{specialties}</div>}

          {(pro.rating > 0 || tierChip) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: hasArea ? 8 : 12, flexWrap: 'wrap' }}>
              {pro.rating > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Star size={15} />
                  <span style={{ fontSize: 14.5, fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums', textShadow: '0 1px 6px rgba(0,0,0,.6)' }}>{faDec(pro.rating)}</span>
                  {reviews > 0 && <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,.72)' }}>({fa(reviews)} نظر)</span>}
                </span>
              )}
              {tierChip && <span style={{ fontSize: 9.5, fontWeight: 800, padding: '3px 10px', borderRadius: 999, background: 'rgba(247,227,154,.16)', border: '1px solid rgba(247,227,154,.42)', color: GOLD, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>{tierChip}</span>}
            </div>
          )}

          {hasArea && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 13, fontSize: 12, color: 'rgba(255,255,255,.74)', textShadow: '0 1px 6px rgba(0,0,0,.6)' }}>
              <span style={{ color: GOLD, display: 'inline-flex', flexShrink: 0 }}><IconSvg name="pin" size={13} /></span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pro.area}</span>
            </div>
          )}

          {/* ردیفِ پایانی — آمار/تماس (راست) + دکمهٔ گردِ طلایی (چپ) */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, paddingTop: 13, borderTop: '1px solid rgba(255,255,255,.14)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, minWidth: 0 }}>
              {statCells.length > 0
                ? statCells.map((c) => <CineStat key={c.label} icon={c.icon} value={c.value} label={c.label} />)
                : (pro.hasPhone
                  ? <div onClick={(e) => { e.preventDefault(); e.stopPropagation() }}><RevealContact kind={pro.revealKind || 'item'} id={pro.revealId || String(pro.id)} compact label="نمایشِ شماره" /></div>
                  : <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', fontWeight: 600 }}>پروفایلِ عمومی</span>)}
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              {statCells.length > 0 && pro.hasPhone && <div onClick={(e) => { e.preventDefault(); e.stopPropagation() }}><RevealContact kind={pro.revealKind || 'item'} id={pro.revealId || String(pro.id)} compact label="شماره" /></div>}
              <span style={{
                width: 52, height: 52, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: INK,
                background: `linear-gradient(135deg, ${GOLD}, ${GOLD_MID})`,
                boxShadow: hovered ? '0 14px 28px -8px rgba(217,173,62,.8)' : '0 8px 18px -10px rgba(217,173,62,.6)',
                transition: 'box-shadow .3s, transform .3s', transform: hovered ? 'translateX(-3px)' : 'none',
              }}><IconSvg name="arrowLeft" size={20} weight={2.6} /></span>
            </span>
          </div>
        </div>
      </div>
    </a>
  )
}
