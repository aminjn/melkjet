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
    url: it.url && /bonyadvokala\.com\/lawyers\//.test(it.url) ? `/lawyers/${it.url.match(/\/lawyers\/([^/?#]+)/)?.[1] || ''}` : it.url,
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

// فاز ۲۹۸ی۲۳ — بازطراحیِ کامل طبقِ طرحِ مرجعِ کاربر (کارت‌های B/D/F): سطحِ تم‌آگاه (سفید در روشن،
// اسلیتِ تیره در دارک از var(--surface))، اکسنتِ سبزِ زمردی، امتیازِ ستاره‌ای + تعدادِ نظر،
// چیپِ تخصص، ستون‌های آماریِ آیکن‌دار، و دکمهٔ گردِ سبز. هیچ عددِ ساختگی — فقط دادهٔ واقعی.
const GREEN = '#17946c'       // اکسنتِ سبزِ زمردی — روی هر دو تم خوانا
const GREEN_LT = '#2bbd86'
const AMBER = '#f5a623'       // رنگِ ستارهٔ امتیاز

function Star({ size = 13 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={AMBER} aria-hidden style={{ flexShrink: 0 }}><path d="M12 2.2l2.95 5.98 6.6.96-4.77 4.65 1.13 6.57L12 17.23l-5.9 3.1 1.13-6.56L2.45 9.14l6.6-.96z" /></svg>
}

function StatCell({ icon, value, label, border }: { icon: IconName; value: string; label: string; border: boolean }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '11px 4px', borderInlineStart: border ? '1px solid var(--line)' : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
        <span style={{ color: GREEN, display: 'inline-flex' }}><IconSvg name={icon} size={13} /></span>
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', lineHeight: 1, letterSpacing: '-.3px', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </div>
      <div style={{ fontSize: 9.5, color: 'var(--faint)', marginTop: 6, letterSpacing: '.2px' }}>{label}</div>
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
  // ستون‌های آماری — فقط «دستاوردِ واقعیِ شمارش‌پذیر» (نه امتیازِ خام که برای کم‌فعال‌ها کوچک و منفی است).
  const cells: { icon: IconName; value: string; label: string }[] = []
  if ((s.listings || 0) > 0) cells.push({ icon: 'office', value: fa(s.listings!), label: 'آگهیِ فعال' })
  if ((s.projects || 0) > 0) cells.push({ icon: 'crane', value: fa(s.projects!), label: 'پروژه' })
  if (pro.registered && (s.deals || 0) > 0) cells.push({ icon: 'trophy', value: fa(s.deals!), label: 'معامله' })
  if (pro.registered && (s.memberYears || 0) >= 1) cells.push({ icon: 'clock', value: fa(s.memberYears!), label: 'سال سابقه' })
  const statCells = cells.slice(0, 3)
  // رتبه به‌صورتِ برچسبِ متنیِ نرم (مثلِ «در حال رشد»/«٪۵ برتر») — نه عددِ خامِ کوچک.
  const tierChip = pct || (score.score > 0 ? score.tier : '')
  const reviews = s.reviews || 0
  const hasBody = pro.tags.length > 0 || statCells.length > 0

  return (
    <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block', textDecoration: 'none', position: 'relative', color: 'var(--text)',
        borderRadius: 20, overflow: 'hidden', background: 'var(--surface)',
        border: pro.promoted ? '1px solid color-mix(in srgb, var(--gold) 60%, transparent)' : '1px solid var(--line)',
        boxShadow: hovered
          ? '0 26px 50px -24px rgba(0,0,0,.42), inset 0 0 0 1px var(--line2)'
          : '0 12px 30px -20px rgba(0,0,0,.34)',
        transform: hovered ? 'translateY(-5px)' : 'none',
        transition: 'transform .26s cubic-bezier(.22,1,.36,1), box-shadow .26s',
      }}>
      {/* نوارِ اکسنتِ سبزِ نازک در لبهٔ بالا — امضای بصریِ برند، روی هر دو تم */}
      <span aria-hidden style={{ position: 'absolute', top: 0, insetInline: 0, height: 3, background: `linear-gradient(90deg, ${GREEN_LT}, ${GREEN})`, opacity: pro.promoted ? 0 : .9 }} />
      {pro.promoted && <span aria-hidden style={{ position: 'absolute', top: 0, insetInline: 0, height: 3, background: 'linear-gradient(90deg,#f7e39a,#b07f26,#f7e39a)' }} />}
      {pro.promoted && <span style={{ position: 'absolute', top: 12, insetInlineStart: 12, zIndex: 3 }}><PromoBadge kind={pro.promoKind || 'ویژه'} size="sm" /></span>}

      <div style={{ position: 'relative', padding: '18px 16px 15px' }}>
        {/* هویت — لوگو/آواتار + نام/نقش + امتیازِ ستاره‌ای */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 15, flexShrink: 0, overflow: 'hidden',
            background: pro.image ? `${avatarPosFor(pro.category)}/cover no-repeat url(${pro.image})` : pro.avatarGradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 800,
            border: '1px solid var(--line)', boxShadow: '0 6px 16px -8px rgba(0,0,0,.45)',
          }}>{!pro.image && pro.initials}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16.5, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-.3px' }}>{pro.name}</span>
              {(pro.verified || pro.badges?.some(b => b.id === 'verified')) && <span title={pro.verified ? 'تاییدشدهٔ ملک‌جت' : 'پروفایلِ کامل'} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 17, height: 17, borderRadius: '50%', background: pro.verified ? '#2f81f7' : GREEN, color: '#fff', boxShadow: pro.verified ? '0 0 10px -2px rgba(47,129,247,.6)' : `0 0 10px -3px ${GREEN}` }}><IconSvg name="check" size={10} weight={2.6} /></span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pro.role}{hasArea && <span style={{ color: 'var(--faint)', fontWeight: 400 }}> · {pro.area}</span>}
            </div>
            {pro.rating > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 7 }}>
                <Star size={13} />
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{faDec(pro.rating)}</span>
                {reviews > 0 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>({fa(reviews)} نظر)</span>}
                {tierChip && <span style={{ marginInlineStart: 4, fontSize: 9.5, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: `color-mix(in srgb, ${GREEN} 13%, transparent)`, border: `1px solid color-mix(in srgb, ${GREEN} 34%, transparent)`, color: GREEN }}>{tierChip}</span>}
              </div>
            ) : tierChip ? (
              <div style={{ marginTop: 7 }}>
                <span style={{ fontSize: 9.5, fontWeight: 800, padding: '2px 9px', borderRadius: 999, background: `color-mix(in srgb, ${GREEN} 13%, transparent)`, border: `1px solid color-mix(in srgb, ${GREEN} 34%, transparent)`, color: GREEN }}>{tierChip}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* چیپ‌های تخصص — سبزِ کم‌رنگ، تا ۳ تا */}
        {pro.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 13 }}>
            {pro.tags.slice(0, 3).map((tag) => (
              <span key={tag} style={{ fontSize: 10.5, padding: '4px 11px', background: 'color-mix(in srgb, var(--text) 5%, transparent)', border: '1px solid var(--line)', borderRadius: 999, color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{tag}</span>
            ))}
          </div>
        )}

        {/* ستون‌های آماری — فقط دادهٔ واقعی */}
        {statCells.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'stretch', marginTop: 14, borderRadius: 14, overflow: 'hidden', background: 'color-mix(in srgb, var(--text) 3.5%, transparent)', border: '1px solid var(--line)' }}>
            {statCells.map((c, i) => <StatCell key={c.label} icon={c.icon} value={c.value} label={c.label} border={i > 0} />)}
          </div>
        )}

        {/* کارتِ کم‌داده — ردیفِ اطلاعاتِ کلیدی (منطقه + وضعیتِ تماس) تا بدنه خالی/مبتدی به‌نظر نرسد (الگویِ کارتِ F). */}
        {!hasBody && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 14, padding: '10px 13px', borderRadius: 13, background: 'color-mix(in srgb, var(--text) 3.5%, transparent)', border: '1px solid var(--line)' }}>
            <span style={{ color: GREEN, display: 'inline-flex', flexShrink: 0 }}><IconSvg name="pin" size={15} /></span>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hasArea ? pro.area : (catLabelOf(pro.category) || pro.role)}</span>
            <span style={{ marginInlineStart: 'auto', flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: pro.hasPhone ? GREEN : 'var(--faint)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {pro.hasPhone ? <><IconSvg name="phone" size={11} /> پاسخ‌گو</> : 'عضو ملک‌جت'}
            </span>
          </div>
        )}

        {/* فوتر — نمایشِ شماره + دکمهٔ گردِ سبزِ «مشاهده» */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 15, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          {pro.hasPhone
            ? <div onClick={(e) => { e.preventDefault(); e.stopPropagation() }}><RevealContact kind={pro.revealKind || 'item'} id={pro.revealId || String(pro.id)} compact label="نمایشِ شماره" /></div>
            : <span style={{ fontSize: 12, color: 'var(--faint)', fontWeight: 600 }}>پروفایلِ عمومی</span>}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12.5, color: GREEN, fontWeight: 800, whiteSpace: 'nowrap' }}>مشاهدهٔ پروفایل</span>
            <span style={{
              width: 38, height: 38, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              background: `linear-gradient(135deg, ${GREEN_LT}, ${GREEN})`,
              boxShadow: hovered ? `0 10px 22px -8px ${GREEN}` : `0 6px 16px -9px ${GREEN}`,
              transition: 'box-shadow .26s, transform .26s', transform: hovered ? 'translateX(-2px)' : 'none',
            }}><IconSvg name="arrowLeft" size={16} weight={2.4} /></span>
          </span>
        </div>
      </div>
    </a>
  )
}
