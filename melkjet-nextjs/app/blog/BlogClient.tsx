'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import { fetchContent, gradientFor } from '@/app/lib/content-display'
import { categorySlugForName } from '@/app/lib/blog-taxonomy'

// فاز ۱۵۴ — کلاینتِ ایندکسِ بلاگ: از `initial` سرور فوری رندر می‌شود (بدونِ «در حال بارگذاری…»).
// بازخوردِ کاربر: «اون بالا یک عالمه دسته‌بندی» → دسته‌ها یک ردیفِ اسکرولیِ جمع‌وجورند
// (+ «بیشتر ▾» برای باقی)، هیرو فشرده‌تر، کارت‌ها هم‌خانوادهٔ طراحیِ مجله‌ایِ صفحهٔ مقاله.
// هیچ دادهٔ فیکی نیست — شمارِ مقاله‌ها و تاریخ‌ها همه واقعی‌اند.

export interface BlogIndexArticle {
  id: string
  title: string
  excerpt?: string
  image?: string
  category?: string
  scrapedAt: number
  url?: string
  meta?: Record<string, string>   // فقط slug/author — نه بدنه، نه متاهای داخلی
}
export interface BlogIndexData { articles: BlogIndexArticle[]; cats: { name: string; count: number }[] }

const fa = (n: number) => n.toLocaleString('fa-IR')
const faDate = (ts?: number) => { try { return ts ? new Date(ts).toLocaleDateString('fa-IR') : '' } catch { return '' } }
const INLINE_CHIPS = 8   // بیش از ~۱۰ دسته → بقیه در «بیشتر ▾»

export default function BlogClient({ initial }: { initial: BlogIndexData }) {
  const [articles, setArticles] = useState<BlogIndexArticle[]>(initial.articles)
  const [cats, setCats] = useState(initial.cats)
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')
  const [booting, setBooting] = useState(initial.articles.length === 0)
  const [moreOpen, setMoreOpen] = useState(false)
  // فاز ۱۷۸ — جستجو/دسته در URL می‌ماند: رفتن به مقاله و برگشتن چیزی را نمی‌پراند
  useEffect(() => { try { const sp = new URLSearchParams(window.location.search); const qq = sp.get('q'); if (qq) setQ(qq); const c = sp.get('cat'); if (c) setCat(c) } catch {} }, [])
  useEffect(() => {
    const t = setTimeout(() => { try { const sp = new URLSearchParams(); if (q) sp.set('q', q); if (cat) sp.set('cat', cat); window.history.replaceState(null, '', window.location.pathname + (sp.toString() ? '?' + sp.toString() : '')) } catch {} }, 250)
    return () => clearTimeout(t)
  }, [q, cat])
  const moreRef = useRef<HTMLDivElement>(null)

  // فالبک: فقط اگر SSR چیزی نداشت (مثلاً دیتابیس لحظه‌ای قطع بود) کلاینت خودش واکشی می‌کند.
  useEffect(() => {
    if (initial.articles.length > 0) return
    fetchContent('article', undefined, 100).then(items => {
      if (items.length === 0) return
      setArticles(items.map(a => ({ id: a.id, title: a.title, excerpt: a.excerpt, image: a.image, category: a.category, scrapedAt: a.scrapedAt, url: a.url, meta: a.meta })))
      const counts = new Map<string, number>()
      for (const i of items) { const c = (i.category || '').trim(); if (c) counts.set(c, (counts.get(c) || 0) + 1) }
      setCats([...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count))
    }).catch(() => {}).finally(() => setBooting(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // بستنِ منویِ «بیشتر» با کلیکِ بیرون
  useEffect(() => {
    if (!moreOpen) return
    const close = (e: MouseEvent) => { if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [moreOpen])

  const desc = (a: BlogIndexArticle) =>
    (a.meta?.metaDescription || a.meta?.summary || a.excerpt || '').replace(/<[^>]+>/g, ' ').replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 180)
  const href = (a: BlogIndexArticle) => `/blog/${categorySlugForName(a.category)}/${a.meta?.slug || a.id}`

  const shown = useMemo(() => articles.filter(a => {
    if (cat && a.category !== cat) return false
    if (q.trim() && !(a.title.includes(q.trim()) || (a.excerpt || '').includes(q.trim()))) return false
    return true
  }), [articles, cat, q])

  const inlineCats = cats.length > INLINE_CHIPS + 2 ? cats.slice(0, INLINE_CHIPS) : cats
  const moreCats = cats.length > INLINE_CHIPS + 2 ? cats.slice(INLINE_CHIPS) : []
  const moreActive = moreCats.some(c => c.name === cat)

  const filtering = !!q.trim() || !!cat
  const featured = !filtering ? shown[0] : undefined
  const rest = featured ? shown.slice(1) : shown

  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden', textDecoration: 'none', color: 'var(--text)', display: 'flex', flexDirection: 'column' }
  const clamp2: React.CSSProperties = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
  const badge = (active: boolean): React.CSSProperties =>
    ({ fontSize: 10.5, fontWeight: 600, color: active ? 'var(--gold)' : 'var(--faint)', background: active ? 'transparent' : 'var(--bg2)', border: active ? '1px solid rgba(212,175,55,.3)' : '1px solid transparent', borderRadius: 999, padding: '1px 7px', marginInlineStart: 6 })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Nav />

      {/* ── هیروِ فشرده (هم‌خانوادهٔ هیروِ صفحهٔ مقاله) ── */}
      <header style={{ background: 'linear-gradient(180deg, var(--bg2), var(--bg))', borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 18px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 5px', display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ color: 'var(--gold)', fontSize: 18 }}>✦</span> مقالات و راهنمای املاک
              </h1>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.8 }}>راهنمای خرید و اجاره، تحلیل بازار، سرمایه‌گذاری و نکات حقوقی — به‌قلم کارشناسان ملک‌جت.</p>
            </div>
            <div style={{ position: 'relative', flexShrink: 0, width: 'min(300px, 100%)' }}>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="جستجو در مقالات…"
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 11, padding: '10px 14px 10px 36px', color: 'var(--text)', fontSize: 13.5, fontFamily: 'inherit', outline: 'none' }} />
              <span style={{ position: 'absolute', insetInlineEnd: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
            </div>
          </div>

          {/* ── دسته‌ها: یک ردیفِ اسکرولی + «بیشتر ▾» ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <div className="mjbi-chips" style={{ display: 'flex', gap: 7, overflowX: 'auto', flex: 1, minWidth: 0, paddingBottom: 2 }}>
              <button onClick={() => setCat('')} style={chip(cat === '')}>
                همه{articles.length > 0 && <span style={badge(cat === '')}>{fa(articles.length)}</span>}
              </button>
              {inlineCats.map(c => (
                <button key={c.name} onClick={() => setCat(cat === c.name ? '' : c.name)} style={chip(cat === c.name)}>
                  {c.name}<span style={badge(cat === c.name)}>{fa(c.count)}</span>
                </button>
              ))}
            </div>
            {moreCats.length > 0 && (
              <div ref={moreRef} style={{ position: 'relative', flexShrink: 0 }}>
                <button onClick={() => setMoreOpen(v => !v)} style={chip(moreActive || moreOpen)}>بیشتر ▾</button>
                {moreOpen && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', insetInlineEnd: 0, zIndex: 40, background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 12, padding: 6, minWidth: 190, maxHeight: 280, overflowY: 'auto', boxShadow: '0 14px 34px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {moreCats.map(c => (
                      <button key={c.name} onClick={() => { setCat(cat === c.name ? '' : c.name); setMoreOpen(false) }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 11px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right', fontSize: 12.5, fontWeight: cat === c.name ? 700 : 500, background: cat === c.name ? 'var(--goldDim)' : 'transparent', color: cat === c.name ? 'var(--gold)' : 'var(--text)' }}>
                        <span>{c.name}</span>
                        <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{fa(c.count)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 18px 70px' }}>
        {booting ? <div style={{ color: 'var(--muted)', padding: '40px 0', textAlign: 'center' }}>در حال بارگذاری…</div>
          : shown.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 30, marginBottom: 10 }}>📄</div>
              <div style={{ color: 'var(--muted)', fontSize: 14 }}>{filtering ? 'مقاله‌ای مطابقِ جستجو نیست.' : 'هنوز مقاله‌ای منتشر نشده است.'}</div>
              {filtering && <button onClick={() => { setQ(''); setCat('') }} style={{ ...chip(true), marginTop: 14 }}>پاک‌کردن فیلترها</button>}
            </div>
          ) : (
            <>
              {/* ── مقالهٔ ویژه (تازه‌ترین) ── */}
              {featured && (
                <Link href={href(featured)} className="mjbi-card mjbi-feat" style={{ ...card, flexDirection: 'row', marginBottom: 22 }}>
                  <div className="mjbi-featimg" style={{ width: '44%', minHeight: 230, flexShrink: 0, background: featured.image ? `center/cover no-repeat url(${featured.image})` : gradientFor(featured.id) }} />
                  <div style={{ flex: 1, minWidth: 0, padding: '24px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      {featured.category && <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--gold)', border: '1px solid var(--goldDim)', borderRadius: 999, padding: '3px 11px' }}>{featured.category}</span>}
                      <span style={{ fontSize: 11, color: 'var(--faint)', background: 'var(--bg2)', borderRadius: 999, padding: '3px 10px' }}>تازه‌ترین</span>
                    </div>
                    <h2 style={{ fontSize: 21, fontWeight: 800, margin: '0 0 10px', lineHeight: 1.55 }}>{featured.title}</h2>
                    {desc(featured) && <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.9, margin: '0 0 12px', ...clamp2, WebkitLineClamp: 3 }}>{desc(featured)}</p>}
                    <div style={{ fontSize: 12, color: 'var(--faint)' }}>{featured.meta?.author || 'تحریریهٔ ملک‌جت'} · {faDate(featured.scrapedAt)}</div>
                  </div>
                </Link>
              )}

              {/* ── گریدِ کارت‌ها ── */}
              <div className="mjbi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {rest.map(a => (
                  <Link key={a.id} href={href(a)} className="mjbi-card" style={card}>
                    <div style={{ height: 150, background: a.image ? `center/cover no-repeat url(${a.image})` : gradientFor(a.id) }} />
                    <div style={{ padding: '14px 15px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      {a.category && <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, marginBottom: 7 }}>{a.category}</span>}
                      <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.65, marginBottom: 7, ...clamp2 }}>{a.title}</div>
                      {desc(a) && <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.8, margin: '0 0 11px', flex: 1, ...clamp2 }}>{desc(a).slice(0, 110)}</p>}
                      <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 'auto' }}>{faDate(a.scrapedAt)}</div>
                    </div>
                  </Link>
                ))}
              </div>

              <div style={{ textAlign: 'center', marginTop: 22, fontSize: 12.5, color: 'var(--faint)' }}>{fa(shown.length)} مقاله</div>
            </>
          )}
      </main>
      <Footer />
    </div>
  )
}

function chip(active: boolean): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', flexShrink: 0, padding: '7px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: active ? 700 : 500, border: `1px solid ${active ? 'var(--gold)' : 'var(--line2)'}`, background: active ? 'var(--goldDim)' : 'var(--surface)', color: active ? 'var(--gold)' : 'var(--muted)' }
}
