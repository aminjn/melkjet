'use client'

// فاز ۱۳۰ — بازطراحیِ دایرکتوری طبقِ طرحِ کاربر: هیروی جستجو + سایدبارِ دسته‌ها با شمارشِ واقعی +
// کارت‌های آماری. قانونِ آهنین: هیچ عددی ساختگی نیست — نظر/امتیاز از نظراتِ تأییدشدهٔ واقعی،
// معامله از آگهی‌های فروخته/اجاره‌رفتهٔ خودِ متخصص، عضویت از تاریخِ واقعیِ ثبت‌نام، پروژه از پرشین‌سازه.
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import RevealContact from '@/app/components/RevealContact'
import PromoBadge from '@/app/components/PromoBadge'
import RepBadges from '@/app/components/RepBadges'
import { useState, useEffect, useMemo } from 'react'
import { fetchContent, gradientFor, initialsFor, type ContentItem } from '@/app/lib/content-display'

// دسته‌های اصلی طبقِ طرح — id همان دستهٔ داخلیِ دایرکتوری است (ROLE_CAT / اسکرپ)
const CATS: { id: string; label: string; icon: string }[] = [
  { id: 'مشاور', label: 'مشاوران املاک', icon: '🧑‍💼' },
  { id: 'آژانس', label: 'آژانس‌ها', icon: '🏢' },
  { id: 'سازنده', label: 'سازندگان', icon: '🏗' },
  { id: 'مصالح', label: 'فروشندگان مصالح', icon: '🧱' },
  { id: 'معمار', label: 'معماران و طراحان', icon: '📐' },
  { id: 'پیمانکار', label: 'پیمانکاران', icon: '🛠' },
  { id: 'کارشناس', label: 'کارشناسان رسمی', icon: '📋' },
  { id: 'حقوقی', label: 'دفاتر حقوقی و وکلا', icon: '⚖' },
  { id: 'بیمه', label: 'بانک و بیمه', icon: '🏦' },
  { id: 'دفترخانه', label: 'دفاتر اسناد رسمی', icon: '◆' },
]
const catLabelOf = (id: string) => CATS.find(c => c.id === id)?.label || id
const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')

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
    url: it.url,
    hasPhone: it.hasPhone,
    image: it.image,
    stats,
    registered: !!(it as any).registered,
    revealKind: (it as any).revealKind as ('item' | 'advisor' | 'builder' | undefined),
    revealId: (it as any).revealId as (string | undefined),
  }
}
type Professional = ReturnType<typeof toProfessional>

export default function DirectoryPage() {
  const [activeCategory, setActiveCategory] = useState('مشاور')
  const [searchQuery, setSearchQuery] = useState('')
  const [serviceTag, setServiceTag] = useState('')
  const [items, setItems] = useState<ContentItem[]>([])
  const [promoted, setPromoted] = useState<ContentItem[]>([])
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
    setServiceTag('')
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

  // مرتب‌سازی طبقِ اعلامِ صفحه: اول پروموت‌شده‌ها، بعد بالاترین امتیازِ واقعی، بعد پرنظرترین‌ها
  const filteredProfessionals = all
    .filter((p) => !searchQuery || p.name.includes(searchQuery) || (p.area || '').includes(searchQuery))
    .filter((p) => !serviceTag || p.tags.some(t => String(t).trim() === serviceTag))
    .sort((x, y) => (Number(y.promoted) - Number(x.promoted)) || ((y.rating || 0) - (x.rating || 0)) || ((y.stats.reviews || 0) - (x.stats.reviews || 0)))

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }}>
      <Nav />

      {/* ── هیرو ── */}
      <section style={{ background: 'linear-gradient(160deg, var(--bg2) 0%, var(--bg) 100%)', borderBottom: '1px solid var(--line)', padding: '56px 24px 44px', textAlign: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: 'var(--goldText)', background: 'var(--goldDim)', border: '1px solid var(--gold)', borderRadius: 999, padding: '6px 16px', marginBottom: 18 }}>
          <span style={{ fontSize: 8 }}>●</span> دایرکتوری متخصصان ملک‌جت
        </span>
        <h1 style={{ fontSize: '2.1rem', fontWeight: 900, color: 'var(--text)', margin: '0 0 12px', lineHeight: 1.4 }}>متخصص و خدمات املاک پیدا کن</h1>
        <p style={{ fontSize: '1rem', color: 'var(--muted)', maxWidth: 560, margin: '0 auto 30px', lineHeight: 1.8 }}>از مشاور و سازنده تا کارشناس، وکیل و پیمانکار — همه در یک‌جا.</p>
        <div style={{ maxWidth: 520, margin: '0 auto', position: 'relative' }}>
          <input
            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="نام متخصص یا شهر…"
            style={{ width: '100%', padding: '15px 20px 15px 50px', fontSize: '.95rem', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', boxShadow: 'var(--shadow)', transition: 'border-color .2s' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--gold)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }}
          />
          <span style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '1rem', pointerEvents: 'none' }}>🔍</span>
        </div>
      </section>

      {/* ── بدنه: سایدبارِ دسته‌ها (راست) + نتایج ── */}
      <main className="mjdir-body" style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px 64px', display: 'grid', gridTemplateColumns: '270px 1fr', gap: 24, alignItems: 'start' }}>
        {/* سایدبار */}
        <aside className="mjdir-side" style={{ position: 'sticky', top: 16, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', padding: '4px 8px 12px' }}>دسته‌بندی متخصصان</div>
          <div className="mjdir-cats" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[...CATS, ...extraCats.map(c => ({ id: c, label: c, icon: '•' }))].map((cat) => {
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
                  <span style={{ fontSize: 15, width: 22, textAlign: 'center', flexShrink: 0 }}>{cat.icon}</span>
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
            <span style={{ fontSize: '.8rem', color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 7, color: 'var(--gold)' }}>●</span> مرتب: پروموت‌شده و بالاترین امتیاز
            </span>
          </div>

          {/* چیپ‌های نوعِ خدمات — از تگ‌های واقعیِ همین فهرست */}
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
              {filteredProfessionals.map((pro) => <ProfessionalCard key={pro.id} pro={pro} />)}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 16, opacity: 0.4 }}>🔍</div>
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

function StatBox({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 11, padding: '10px 6px' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: color || 'var(--text)', marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{label}</div>
    </div>
  )
}

function ProfessionalCard({ pro }: { pro: Professional }) {
  const [hovered, setHovered] = useState(false)
  const hasArea = !!(pro.area && pro.area.trim())
  const href = pro.url || `/profile/${pro.id}`
  const external = !!pro.url && !pro.url.startsWith('/')
  const s = pro.stats
  // جعبه‌های آمار فقط وقتی دادهٔ واقعی هست — برای ثبت‌شده‌ها (نظر/عضویت/معامله) و سازنده‌ها (پروژه)
  const boxes: { value: string; label: string; color?: string }[] = []
  if (pro.registered && s.memberYears !== undefined) {
    boxes.push({ value: fa(s.reviews || 0), label: 'نظر', color: '#5fd98a' })
    boxes.push({ value: s.memberYears! >= 1 ? fa(s.memberYears!) : '<۱', label: 'سال عضویت' })
    boxes.push({ value: fa(s.deals || 0), label: 'معاملهٔ موفق', color: 'var(--goldText)' })
  } else if (s.projects) {
    boxes.push({ value: fa(s.projects), label: 'پروژهٔ ثبت‌شده', color: 'var(--goldText)' })
  }

  return (
    <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block', textDecoration: 'none', color: 'inherit',
        background: 'var(--surface)',
        border: `1px solid ${pro.promoted || hovered ? 'var(--gold)' : 'var(--line)'}`,
        borderRadius: 16, padding: 16,
        transition: 'transform .18s, box-shadow .18s, border-color .18s',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? '0 12px 34px -14px rgba(201,168,76,0.22)' : '0 2px 10px -6px rgba(0,0,0,0.25)',
      }}>
      {/* ردیفِ بالا: پروموت + امتیازِ واقعی */}
      {(pro.promoted || pro.rating > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, minHeight: 22 }}>
          <span>{pro.promoted && <PromoBadge kind={pro.promoKind || 'ویژه'} size="sm" />}</span>
          {pro.rating > 0 && <span title={pro.registered ? `میانگینِ ${fa(s.reviews || 0)} نظرِ تأییدشده` : 'امتیاز از منبعِ آگهی'} style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>{Number(pro.rating).toLocaleString('fa-IR')} <span style={{ color: 'var(--gold)' }}>★</span></span>}
        </div>
      )}
      {/* آواتار + نام */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{
          width: 62, height: 62, borderRadius: 16, margin: '0 auto 10px',
          background: pro.image ? `center/cover no-repeat url(${pro.image})` : pro.avatarGradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 19, fontWeight: 800, overflow: 'hidden',
        }}>{!pro.image && pro.initials}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <span style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pro.name}</span>
          {pro.badges?.some(b => b.id === 'verified') && <span title="پروفایلِ کامل و تأییدشده" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: 'rgba(95,217,138,0.15)', color: '#5fd98a', fontSize: 10, fontWeight: 800 }}>✓</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
          <span style={{ color: 'var(--goldText)', fontWeight: 700 }}>{pro.role}</span>
          {hasArea && <> · {pro.area}</>}
        </div>
      </div>
      {/* آمارِ واقعی */}
      {boxes.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {boxes.map(b => <StatBox key={b.label} value={b.value} label={b.label} color={b.color} />)}
        </div>
      )}
      {(pro.badges?.filter(b => b.id !== 'verified').length ?? 0) > 0 && (
        <div style={{ marginBottom: 8 }}><RepBadges badges={pro.badges!.filter(b => b.id !== 'verified')} size="sm" /></div>
      )}
      {pro.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 4, justifyContent: 'center' }}>
          {pro.tags.slice(0, 3).map((tag) => (
            <span key={tag} style={{ fontSize: 10.5, padding: '3px 10px', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 999, color: 'var(--muted)', fontWeight: 600 }}>{tag}</span>
          ))}
        </div>
      )}
      {/* فوتر: نمایشِ شماره + مشاهدهٔ خدمات */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
        {pro.hasPhone
          ? <div onClick={(e) => { e.preventDefault(); e.stopPropagation() }}><RevealContact kind={pro.revealKind || 'item'} id={pro.revealId || String(pro.id)} compact label="نمایشِ شماره" /></div>
          : <span style={{ fontSize: 12, color: 'var(--faint)' }}>پروفایل عمومی</span>}
        <span style={{ fontSize: 12.5, color: 'var(--goldText)', fontWeight: 800, whiteSpace: 'nowrap' }}>مشاهدهٔ خدمات ←</span>
      </div>
    </a>
  )
}
