'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import { fetchContent, gradientFor, type ContentItem } from '@/app/lib/content-display'

/* ─── Types ─────────────────────────────────────────────── */

interface SavedSearch { id: string; label: string; query: string; createdAt: number }
interface Prefs { favorites: string[]; savedSearches: SavedSearch[] }

/* ─── Static UI data (local-only sections) ─────────────── */

const needTags = ['آپارتمان', 'سعادت‌آباد', '۱۳۰–۱۵۰ متر', 'زیر ۱۸م', 'آسانسور', 'پارکینگ']

const journeySteps = [
  { label: 'تعریف نیاز', done: true, active: false },
  { label: 'بررسی گزینه‌ها', done: false, active: true },
  { label: 'بازدید حضوری', done: false, active: false },
  { label: 'قرارداد', done: false, active: false },
]

const notifications = [
  { color: '#e05555', dot: '#e05555', text: 'فایل سعادت‌آباد ۱۴۰م – کاهش قیمت ۴۰۰م', time: '۲ ساعت پیش' },
  { color: '#3dba6e', dot: '#3dba6e', text: 'فایل جدید مطابق جستجوی شما', time: '۵ ساعت پیش' },
  { color: '#5b8dee', dot: '#5b8dee', text: 'یادآور بازدید فردا ۱۴:۰۰', time: '۱ روز پیش' },
  { color: '#e8a84c', dot: '#e8a84c', text: 'دستیار AI: ۳ فرصت جدید پیدا شد', time: '۲ روز پیش' },
]

/* ─── Component ─────────────────────────────────────────── */

export default function BuyerPage() {
  const [compareSet, setCompareSet] = useState<string[]>([])
  const [visitCancelled, setVisitCancelled] = useState(false)

  // Real data
  const [prefs, setPrefs] = useState<Prefs>({ favorites: [], savedSearches: [] })
  const [listings, setListings] = useState<ContentItem[]>([])
  const [loaded, setLoaded] = useState(false)

  // AI assistant
  const [aiInput, setAiInput] = useState('')
  const [aiReply, setAiReply] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  const toggleCompare = (id: string) =>
    setCompareSet(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  // Load prefs + real listings
  const reloadPrefs = useCallback(async () => {
    try {
      const r = await fetch('/api/user/prefs', { cache: 'no-store' })
      if (r.ok) {
        const d = await r.json()
        setPrefs({
          favorites: Array.isArray(d.favorites) ? d.favorites : [],
          savedSearches: Array.isArray(d.savedSearches) ? d.savedSearches : [],
        })
      }
    } catch { /* keep current */ }
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [items] = await Promise.all([fetchContent('listing', undefined, 24), reloadPrefs()])
      if (!alive) return
      setListings(items)
      setLoaded(true)
    })()
    return () => { alive = false }
  }, [reloadPrefs])

  const byId = new Map(listings.map(l => [l.id, l]))
  const favListings = prefs.favorites.map(id => byId.get(id)).filter(Boolean) as ContentItem[]
  const hasFavorites = favListings.length > 0
  // When the user has no favorites, suggest all real listings as add-able cards.
  const gridItems = hasFavorites ? favListings : listings

  const addFav = async (listingId: string) => {
    setPrefs(p => ({ ...p, favorites: [listingId, ...p.favorites.filter(x => x !== listingId)] }))
    try {
      const r = await fetch('/api/user/prefs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addFav', listingId }),
      })
      if (r.ok) setPrefs(await r.json())
    } catch { reloadPrefs() }
  }

  const removeFav = async (listingId: string) => {
    setPrefs(p => ({ ...p, favorites: p.favorites.filter(x => x !== listingId) }))
    try {
      const r = await fetch('/api/user/prefs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'removeFav', listingId }),
      })
      if (r.ok) setPrefs(await r.json())
    } catch { reloadPrefs() }
  }

  const addSearch = async () => {
    const query = (window.prompt('عبارت جستجوی موردنظر را وارد کنید:', '') || '').trim()
    if (!query) return
    const label = (window.prompt('یک عنوان برای این جستجو وارد کنید:', query) || query).trim()
    try {
      const r = await fetch('/api/user/prefs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addSearch', label, query }),
      })
      if (r.ok) setPrefs(await r.json())
    } catch { reloadPrefs() }
  }

  const removeSearch = async (id: string) => {
    setPrefs(p => ({ ...p, savedSearches: p.savedSearches.filter(s => s.id !== id) }))
    try {
      const r = await fetch('/api/user/prefs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'removeSearch', id }),
      })
      if (r.ok) setPrefs(await r.json())
    } catch { reloadPrefs() }
  }

  const askAi = async () => {
    const input = aiInput.trim() ||
      `بر اساس نیازهای من (${needTags.join('، ')}) چه پیشنهادهایی برای خرید ملک داری؟`
    setAiLoading(true); setAiError(''); setAiReply('')
    try {
      const r = await fetch('/api/ai/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'chat', input }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.ok && d.text) setAiReply(d.text)
      else setAiError(d.error || 'خطا در دریافت پاسخ دستیار')
    } catch {
      setAiError('ارتباط با دستیار برقرار نشد')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Vazirmatn', sans-serif" }}>
      <Nav />

      {/* ── Section breadcrumb bar ── */}
      <div style={{
        background: 'var(--navbg)',
        borderBottom: '1px solid var(--line)',
        backdropFilter: 'blur(12px)',
        position: 'sticky', top: 68, zIndex: 40,
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', height: 40, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
          <span>ملک‌جت</span>
          <span style={{ color: 'var(--faint)' }}>›</span>
          <span style={{ color: 'var(--gold)' }}>میز کار خریدار</span>
        </div>
      </div>

      {/* ── Page wrapper ── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '36px 24px 60px' }}>

        {/* ── User Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: 'var(--text)' }}>
              سلام، امیر رضایی 👋
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)' }}>
              آخرین ورود: دیروز ۲۱:۳۰
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '7px 16px', borderRadius: 30,
              background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
              color: '#16140f', fontSize: 13, fontWeight: 700,
            }}>
              <span style={{ fontSize: 15 }}>★</span>
              خریدار حرفه‌ای
            </span>
          </div>
        </div>

        {/* ── 2-col grid ── */}
        <div className="mjb-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 28, alignItems: 'start' }}>

          {/* ══ LEFT COLUMN ══════════════════════════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

            {/* ── AI Assistant Card ── */}
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--gold)',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 0 0 1px rgba(201,168,76,0.12), 0 8px 32px -12px rgba(201,168,76,0.15)',
            }}>
              {/* Card Header */}
              <div style={{
                padding: '18px 22px', borderBottom: '1px solid var(--line)',
                background: 'var(--goldDim)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, color: '#16140f', flexShrink: 0,
                  }}>✦</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>دستیار خرید شخصی ملک‌جت</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>هوش مصنوعی اختصاصی شما</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{
                    width: 9, height: 9, borderRadius: '50%',
                    background: '#3dba6e',
                    boxShadow: '0 0 8px #3dba6e',
                    display: 'inline-block',
                    animation: 'pulse 2s infinite',
                  }} />
                  <span style={{ fontSize: 12, color: '#3dba6e', fontWeight: 600 }}>پایش بازار ۲۴ ساعته</span>
                </div>
              </div>

              <div style={{ padding: '20px 22px' }}>
                {/* Need Tags */}
                <div style={{ marginBottom: 20 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>نیازهای ذخیره‌شده شما:</p>
                  <div className="mjb-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {needTags.map(tag => (
                      <span key={tag} style={{
                        padding: '4px 12px', borderRadius: 20,
                        background: 'var(--goldDim)',
                        border: '1px solid rgba(201,168,76,0.3)',
                        fontSize: 12, color: 'var(--gold)', fontWeight: 600,
                      }}>{tag}</span>
                    ))}
                  </div>
                </div>

                {/* AI Assistant — real call to /api/ai/run */}
                <div>
                  <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    ✦ از دستیار خرید درباره پیشنهادها بپرسید
                  </p>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                    <input
                      value={aiInput}
                      onChange={e => setAiInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !aiLoading) askAi() }}
                      placeholder="مثلاً: برای خرید آپارتمان در سعادت‌آباد چه پیشنهادی داری؟"
                      style={{
                        flex: 1, minWidth: 180,
                        padding: '10px 14px', borderRadius: 9,
                        background: 'var(--bg2)',
                        border: '1px solid var(--line2)',
                        color: 'var(--text)', fontSize: 13,
                        fontFamily: "'Vazirmatn', sans-serif",
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={askAi}
                      disabled={aiLoading}
                      style={{
                        padding: '10px 18px', borderRadius: 9,
                        background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                        border: 'none', color: '#16140f', fontSize: 13, fontWeight: 700,
                        cursor: aiLoading ? 'default' : 'pointer', opacity: aiLoading ? 0.6 : 1,
                        fontFamily: "'Vazirmatn', sans-serif", flexShrink: 0,
                      }}
                    >{aiLoading ? 'در حال پردازش…' : 'بپرس از AI'}</button>
                  </div>

                  <div style={{
                    background: 'var(--bg2)',
                    border: '1px solid var(--line2)',
                    borderRadius: 12,
                    padding: '14px 16px',
                    fontSize: 13, lineHeight: 1.9, color: 'var(--text)',
                    whiteSpace: 'pre-wrap', minHeight: 60,
                  }}>
                    {aiLoading && (
                      <span style={{ color: 'var(--muted)' }}>دستیار در حال بررسی بازار است…</span>
                    )}
                    {!aiLoading && aiError && (
                      <span style={{ color: '#e05555' }}>{aiError}</span>
                    )}
                    {!aiLoading && !aiError && aiReply && aiReply}
                    {!aiLoading && !aiError && !aiReply && (
                      <span style={{ color: 'var(--muted)' }}>
                        سؤال خود را بنویسید یا روی «بپرس از AI» بزنید تا بر اساس نیازهای ذخیره‌شده‌تان پیشنهاد بدهد.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Saved Searches ── */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>جستجوهای ذخیره‌شده</h2>
                <button
                  onClick={addSearch}
                  style={{
                    padding: '7px 16px', borderRadius: 9,
                    background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                    border: 'none', color: '#16140f', fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', fontFamily: "'Vazirmatn', sans-serif",
                  }}>+ جستجوی جدید</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {prefs.savedSearches.length === 0 && (
                  <div style={{
                    background: 'var(--surface)',
                    border: '1px dashed var(--line2)',
                    borderRadius: 14, padding: '20px',
                    fontSize: 13, color: 'var(--muted)', textAlign: 'center',
                  }}>
                    هنوز جستجویی ذخیره نکرده‌اید. با «+ جستجوی جدید» اولین جستجوی خود را اضافه کنید.
                  </div>
                )}
                {prefs.savedSearches.map(s => (
                  <div key={s.id} style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 14, padding: '16px 20px',
                    transition: 'border-color 0.2s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{s.label}</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: 20,
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid var(--line2)',
                            fontSize: 11, color: 'var(--muted)',
                          }}>{s.query}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--faint)' }}>
                          ذخیره‌شده در: {new Date(s.createdAt).toLocaleDateString('fa-IR')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                        <Link
                          href={`/search?q=${encodeURIComponent(s.query)}`}
                          style={{
                            padding: '7px 16px', borderRadius: 8,
                            background: 'var(--goldDim)',
                            border: '1px solid rgba(201,168,76,0.25)',
                            color: 'var(--gold)', fontSize: 12, fontWeight: 600,
                            cursor: 'pointer', textDecoration: 'none',
                          }}>مشاهده نتایج</Link>
                        <button
                          onClick={() => removeSearch(s.id)}
                          style={{
                            padding: '7px 14px', borderRadius: 8,
                            background: 'transparent',
                            border: '1px solid rgba(220,60,60,0.3)',
                            color: '#e05555', fontSize: 12, fontWeight: 600,
                            cursor: 'pointer', fontFamily: "'Vazirmatn', sans-serif",
                          }}>حذف</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Favorites Grid ── */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  {hasFavorites ? 'علاقه‌مندی‌ها' : 'پیشنهاد برای شما'}
                  <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)', marginRight: 8 }}>
                    {hasFavorites ? `(${favListings.length} ملک)` : '(هنوز علاقه‌مندی ندارید — افزودن کنید)'}
                  </span>
                </h2>
                {compareSet.length > 1 && (
                  <Link
                    href={`/search?compare=${compareSet.map(encodeURIComponent).join(',')}`}
                    style={{
                      padding: '7px 16px', borderRadius: 9,
                      background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                      border: 'none', color: '#16140f', fontSize: 13, fontWeight: 700,
                      cursor: 'pointer', textDecoration: 'none',
                    }}>مقایسه {compareSet.length} ملک</Link>
                )}
              </div>
              {loaded && gridItems.length === 0 && (
                <div style={{
                  background: 'var(--surface)',
                  border: '1px dashed var(--line2)',
                  borderRadius: 14, padding: '24px',
                  fontSize: 13, color: 'var(--muted)', textAlign: 'center',
                }}>
                  در حال حاضر ملکی برای نمایش وجود ندارد.
                </div>
              )}
              <div className="mjb-fav" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                {gridItems.map(prop => {
                  const isFav = prefs.favorites.includes(prop.id)
                  return (
                  <Link key={prop.id} href={`/property/${prop.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 14, overflow: 'hidden',
                      transition: 'border-color 0.15s, transform 0.15s',
                      cursor: 'pointer',
                    }}>
                      {/* Image */}
                      <div style={{
                        height: 130,
                        background: prop.image ? `center/cover no-repeat url(${prop.image})` : gradientFor(prop.id),
                        position: 'relative',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 36, color: 'rgba(255,255,255,0.09)',
                      }}>
                        {!prop.image && '⌂'}
                        {/* Heart — add or remove favorite */}
                        <button
                          onClick={e => { e.preventDefault(); isFav ? removeFav(prop.id) : addFav(prop.id) }}
                          title={isFav ? 'حذف از علاقه‌مندی' : 'افزودن به علاقه‌مندی'}
                          style={{
                            position: 'absolute', top: 10, left: 10,
                            width: 30, height: 30, borderRadius: '50%',
                            background: 'rgba(0,0,0,0.45)',
                            border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 15, color: isFav ? '#e05555' : 'rgba(255,255,255,0.8)',
                          }}
                        >{isFav ? '♥' : '♡'}</button>
                      </div>
                      {/* Body */}
                      <div style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 3, lineHeight: 1.4 }}>{prop.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>{prop.location || '—'}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)', marginBottom: 10 }}>{prop.price || 'توافقی'}</div>
                        {hasFavorites ? (
                          <label
                            onClick={e => e.preventDefault()}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: 'var(--muted)' }}
                          >
                            <input
                              type="checkbox"
                              checked={compareSet.includes(prop.id)}
                              onChange={() => toggleCompare(prop.id)}
                              style={{ accentColor: 'var(--gold)', width: 13, height: 13 }}
                            />
                            مقایسه
                          </label>
                        ) : (
                          <button
                            onClick={e => { e.preventDefault(); addFav(prop.id) }}
                            style={{
                              width: '100%', padding: '7px 0', borderRadius: 8,
                              background: 'var(--goldDim)',
                              border: '1px solid rgba(201,168,76,0.25)',
                              color: 'var(--gold)', fontSize: 11, fontWeight: 600,
                              cursor: 'pointer', fontFamily: "'Vazirmatn', sans-serif",
                            }}
                          >+ افزودن به علاقه‌مندی</button>
                        )}
                      </div>
                    </div>
                  </Link>
                  )
                })}
              </div>
            </section>

          </div>
          {/* ══ END LEFT COLUMN ══════════════════════════════════ */}

          {/* ══ RIGHT SIDEBAR ════════════════════════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 88 }}>

            {/* ── Journey Tracker ── */}
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 16, padding: '20px 20px 22px',
            }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>مسیر خرید شما</h3>
              <div style={{ position: 'relative' }}>
                {/* Connecting line */}
                <div style={{
                  position: 'absolute',
                  top: 15, right: 15,
                  width: 2,
                  height: 'calc(100% - 30px)',
                  background: 'var(--line2)',
                }} />
                {journeySteps.map((step, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    paddingBottom: i < journeySteps.length - 1 ? 22 : 0,
                    position: 'relative', zIndex: 1,
                  }}>
                    {/* Step indicator */}
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: step.done
                        ? 'linear-gradient(140deg,var(--gold2),var(--gold))'
                        : step.active
                          ? 'var(--goldDim)'
                          : 'var(--bg2)',
                      border: step.active
                        ? '2px solid var(--gold)'
                        : step.done
                          ? 'none'
                          : '2px solid var(--line2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14,
                      color: step.done ? '#16140f' : step.active ? 'var(--gold)' : 'var(--faint)',
                      fontWeight: 700,
                    }}>
                      {step.done ? '✓' : i + 1}
                    </div>
                    <div>
                      <div style={{
                        fontSize: 13, fontWeight: step.active ? 700 : 500,
                        color: step.done || step.active ? 'var(--text)' : 'var(--muted)',
                      }}>{step.label}</div>
                      {step.active && (
                        <div style={{ fontSize: 10, color: 'var(--gold)', marginTop: 2, fontWeight: 600 }}>● در حال انجام</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Notifications Feed ── */}
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 16, overflow: 'hidden',
            }}>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>اعلان‌ها</h3>
                <span style={{
                  padding: '2px 8px', borderRadius: 20,
                  background: 'rgba(220,60,60,0.15)',
                  border: '1px solid rgba(220,60,60,0.3)',
                  color: '#e05555', fontSize: 11, fontWeight: 700,
                }}>۴ جدید</span>
              </div>
              <div>
                {notifications.map((n, i) => (
                  <div key={i} style={{
                    padding: '13px 18px',
                    borderBottom: i < notifications.length - 1 ? '1px solid var(--line)' : 'none',
                    display: 'flex', alignItems: 'flex-start', gap: 11,
                  }}>
                    <span style={{
                      width: 9, height: 9, borderRadius: '50%',
                      background: n.dot, flexShrink: 0, marginTop: 4,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, marginBottom: 3 }}>{n.text}</div>
                      <div style={{ fontSize: 10, color: 'var(--faint)' }}>{n.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Upcoming Visit ── */}
            {!visitCancelled && (
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 16, padding: '18px 20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 16 }}>📅</span>
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>بازدید پیش‌رو</h3>
                </div>
                <div style={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--line2)',
                  borderRadius: 10, padding: '13px 15px', marginBottom: 14,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 5 }}>آپارتمان سعادت‌آباد</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 5 }}>
                    📅 یکشنبه ۱۲ خرداد · ۱۴:۰۰
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    👤 مشاور: سارا محمدی
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => alert('برای تغییر زمان بازدید با مشاور خود تماس بگیرید.')}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 9,
                      background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                      border: 'none', color: '#16140f', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', fontFamily: "'Vazirmatn', sans-serif",
                    }}>تغییر زمان</button>
                  <button
                    onClick={() => setVisitCancelled(true)}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 9,
                      background: 'transparent',
                      border: '1px solid rgba(220,60,60,0.3)',
                      color: '#e05555', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: "'Vazirmatn', sans-serif",
                    }}>لغو</button>
                </div>
              </div>
            )}

          </div>
          {/* ══ END SIDEBAR ══════════════════════════════════════ */}

        </div>
      </div>

      <Footer />
    </div>
  )
}
