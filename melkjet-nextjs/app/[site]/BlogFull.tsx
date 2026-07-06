'use client'

import { useMemo, useState } from 'react'

const CARD_SHADOW = '0 10px 34px -22px rgba(20,16,10,.55), 0 2px 8px -4px rgba(20,16,10,.10)'
const INK = 'var(--mjs-heading)'
const MUTED = 'var(--mjs-muted)'
const GRADS = ['#15202d,#101828', '#251528,#1a0e1e', '#152825,#0e1a18', '#2d2215,#1e1a12', '#2d1515,#1e0e0e', '#1e2215,#141a10']

// مقالهٔ آماده‌شده برای کلاینت — هر فیلدی که موجود باشد خوانده می‌شود.
export interface BlogArticle {
  id?: string
  slug?: string
  title: string
  excerpt?: string
  image?: string
  category?: string
  author?: string
  date?: string
}

// کارتِ مقاله (همان ظاهرِ بخشِ وبلاگِ صفحهٔ اصلی): کاور، چیپِ دسته، عنوان، خلاصه، متاها.
const articleHref = (a: { slug?: string; id?: string }, siteSlug?: string) => {
  const s = a.slug || a.id || ''
  return siteSlug ? `/${siteSlug}/blog/${s}` : `/article/${s}`
}
function ArticleCard({ a, i, primary, siteSlug }: { a: BlogArticle; i: number; primary: string; siteSlug?: string }) {
  const href = articleHref(a, siteSlug)
  return (
    <a href={href} className="mjs-card" style={{
      background: 'var(--mjs-bg)', borderRadius: 18, overflow: 'hidden', border: '1px solid #efe9df',
      textDecoration: 'none', display: 'flex', flexDirection: 'column', boxShadow: CARD_SHADOW,
    }}>
      {a.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.image} alt="" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ height: 180, background: `linear-gradient(135deg,${GRADS[i % GRADS.length]})` }} />
      )}
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', flex: 1 }}>
        {a.category ? (
          <span style={{
            alignSelf: 'flex-start', fontSize: 11.5, fontWeight: 700, color: primary,
            background: `${primary}14`, border: `1px solid ${primary}33`, borderRadius: 999,
            padding: '3px 11px', marginBottom: 12,
          }}>{a.category}</span>
        ) : null}
        <div style={{ fontSize: 17, fontWeight: 800, color: INK, marginBottom: 10, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.title}</div>
        {a.excerpt ? (
          <p style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.95, margin: '0 0 16px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.excerpt}</p>
        ) : null}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTop: '1px solid #f2ede4', paddingTop: 14 }}>
          <span style={{ fontSize: 12, color: MUTED }}>
            {[a.author, a.date].filter(Boolean).join(' · ')}
          </span>
          <span style={{ fontSize: 13, fontWeight: 800, color: primary }}>ادامه مطلب →</span>
        </div>
      </div>
    </a>
  )
}

// صفحهٔ کاملِ وبلاگ: ستونِ اصلی (گرید کارت‌ها با فیلترِ دسته + جستجو) + ساید‌بار
// (جستجو، فهرستِ دسته‌ها با تعداد، آخرین مطالب). روی موبایل ساید‌بار زیر می‌نشیند.
export default function BlogFull({
  articles, categories, sidebar = 'yes', primary, siteSlug = '',
}: {
  articles: BlogArticle[]
  categories: string[]
  sidebar?: 'yes' | 'no'
  primary: string
  siteSlug?: string
}) {
  const [cat, setCat] = useState<string>('__all__')
  const [q, setQ] = useState<string>('')
  const hasSidebar = sidebar === 'yes'

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const a of articles) {
      const c = (a.category || '').trim()
      if (c) m[c] = (m[c] || 0) + 1
    }
    return m
  }, [articles])

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase()
    return articles.filter(a => {
      if (cat !== '__all__' && (a.category || '').trim() !== cat) return false
      if (needle) {
        const hay = `${a.title || ''} ${a.excerpt || ''}`.toLocaleLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [articles, cat, q])

  const recent = articles.slice(0, 5)

  const inputStyle: React.CSSProperties = {
    width: '100%', minHeight: 48, background: 'var(--mjs-bg)', border: '1px solid #e6ddcd',
    borderRadius: 12, padding: '0 16px', fontSize: 14.5, fontFamily: 'inherit', boxSizing: 'border-box',
    color: 'var(--mjs-text)',
  }

  // بدونِ مقالهٔ واقعی → حالتِ خالی (هیچ دادهٔ نمونه نمایش داده نمی‌شود).
  if (!articles.length) {
    return (
      <div style={{ background: 'var(--mjs-bg)', border: '1px dashed #ddd4c5', borderRadius: 18, padding: '64px 24px', textAlign: 'center', color: '#9b9285', fontSize: 15, lineHeight: 2 }}>
        <div style={{ fontSize: 40, opacity: .3, marginBottom: 10 }}>🗞</div>
        هنوز مقاله‌ای منتشر نشده است.
      </div>
    )
  }

  return (
    <div>
      <style>{`
        .mjs-blogfull{display:grid;grid-template-columns:1fr 300px;gap:clamp(24px,4vw,40px);align-items:start}
        .mjs-blogfull-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:24px}
        @media(max-width:880px){
          .mjs-blogfull{grid-template-columns:1fr !important}
          .mjs-blogfull-grid{grid-template-columns:1fr !important}
        }
      `}</style>

      <div className="mjs-blogfull">
        {/* ستونِ اصلی */}
        <div>
          <div style={{ marginBottom: 22 }}>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="جستجو در مقاله‌ها…"
              style={inputStyle}
            />
          </div>
          {filtered.length === 0 ? (
            <div style={{ background: 'var(--mjs-surface)', border: '1px dashed #ddd4c5', borderRadius: 18, padding: '52px 24px', textAlign: 'center', color: '#9b9285', fontSize: 14.5 }}>
              مقاله‌ای با این فیلتر یافت نشد.
            </div>
          ) : (
            <div className="mjs-blogfull-grid">
              {filtered.map((a, i) => <ArticleCard key={a.id || a.slug || i} a={a} i={i} primary={primary} siteSlug={siteSlug} />)}
            </div>
          )}
        </div>

        {/* ساید‌بار */}
        {hasSidebar ? (
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ background: 'var(--mjs-bg)', border: '1px solid #efe9df', borderRadius: 16, padding: 18, boxShadow: CARD_SHADOW }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: INK, marginBottom: 12 }}>جستجو</div>
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="کلمهٔ کلیدی…"
                style={inputStyle}
              />
            </div>

            <div style={{ background: 'var(--mjs-bg)', border: '1px solid #efe9df', borderRadius: 16, padding: 18, boxShadow: CARD_SHADOW }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: INK, marginBottom: 12 }}>دسته‌بندی‌ها</div>
              <button
                onClick={() => setCat('__all__')}
                style={catRowStyle(cat === '__all__', primary)}
              >
                <span>همه</span>
                <span style={catCountStyle(cat === '__all__', primary)}>{articles.length}</span>
              </button>
              {categories.map(c => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  style={catRowStyle(cat === c, primary)}
                >
                  <span>{c}</span>
                  <span style={catCountStyle(cat === c, primary)}>{counts[c] || 0}</span>
                </button>
              ))}
            </div>

            <div style={{ background: 'var(--mjs-bg)', border: '1px solid #efe9df', borderRadius: 16, padding: 18, boxShadow: CARD_SHADOW }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: INK, marginBottom: 12 }}>آخرین مطالب</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {recent.map((a, i) => (
                  <a key={a.id || a.slug || i} href={articleHref(a, siteSlug)} style={{ display: 'flex', gap: 11, alignItems: 'center', textDecoration: 'none' }}>
                    {a.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.image} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flex: '0 0 auto' }} />
                    ) : (
                      <div style={{ width: 56, height: 56, borderRadius: 10, flex: '0 0 auto', background: `linear-gradient(135deg,${GRADS[i % GRADS.length]})` }} />
                    )}
                    <span style={{ fontSize: 13, fontWeight: 700, color: INK, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.title}</span>
                  </a>
                ))}
                {recent.length === 0 ? <span style={{ fontSize: 13, color: MUTED }}>مطلبی موجود نیست.</span> : null}
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  )
}

function catRowStyle(on: boolean, primary: string): React.CSSProperties {
  return {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, padding: '9px 12px', borderRadius: 10, marginBottom: 6, cursor: 'pointer',
    border: 'none', fontFamily: 'inherit', textAlign: 'right',
    fontSize: 13.5, fontWeight: on ? 800 : 600,
    color: on ? '#fff' : 'var(--mjs-text)',
    background: on ? primary : 'var(--mjs-surface)',
  }
}

function catCountStyle(on: boolean, primary: string): React.CSSProperties {
  return {
    fontSize: 12, fontWeight: 800, minWidth: 24, textAlign: 'center',
    borderRadius: 999, padding: '1px 8px',
    color: on ? primary : '#fff',
    background: on ? '#fff' : primary,
  }
}
