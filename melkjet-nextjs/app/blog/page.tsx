'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import { fetchContent, gradientFor, type ContentItem } from '@/app/lib/content-display'
import { categorySlugForName } from '@/app/lib/blog-taxonomy'

function toFa(n: number | string) { return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]) }
function faDate(ts?: number) { try { return ts ? new Date(ts).toLocaleDateString('fa-IR') : '' } catch { return '' } }

export default function BlogPage() {
  const [articles, setArticles] = useState<ContentItem[]>([])
  const [cats, setCats] = useState<string[]>([])
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchContent('article', undefined, 100).then(setArticles).catch(() => {}).finally(() => setLoading(false))
    fetch('/api/categories?type=article').then(r => r.ok ? r.json() : { categories: [] }).then(d => setCats(d.categories || [])).catch(() => {})
  }, [])

  const shown = useMemo(() => articles.filter(a => {
    if (cat && a.category !== cat) return false
    if (q.trim() && !(a.title.includes(q.trim()) || (a.excerpt || '').includes(q.trim()))) return false
    return true
  }), [articles, cat, q])

  const featured = shown[0]
  const rest = shown.slice(featured ? 1 : 0)
  const meta = (a: any) => a.meta?.metaDescription || a.meta?.summary || (a.excerpt || '').replace(/<[^>]+>/g, ' ').replace(/[#*_>`-]/g, '').slice(0, 150)
  const href = (a: any) => `/blog/${categorySlugForName(a.category)}/${a.meta?.slug || a.id}`
  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden', textDecoration: 'none', color: 'var(--text)', display: 'flex', flexDirection: 'column' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Nav />
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 18px 70px' }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--gold)', background: 'var(--goldDim)', border: '1px solid rgba(212,175,55,.25)', borderRadius: 999, padding: '5px 12px', marginBottom: 12 }}>✦ بلاگ ملک‌جت</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 8px' }}>مقالات و راهنمای املاک</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0, lineHeight: 1.8 }}>راهنمای خرید و اجاره، تحلیل بازار، سرمایه‌گذاری و نکات حقوقی ملک — به‌قلم کارشناسان ملک‌جت.</p>
        </div>

        {/* filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 22 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="جستجو در مقالات…" style={{ flex: 1, minWidth: 200, background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 11, padding: '10px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <button onClick={() => setCat('')} style={chip(cat === '')}>همه</button>
            {cats.map(c => <button key={c} onClick={() => setCat(c)} style={chip(cat === c)}>{c}</button>)}
          </div>
        </div>

        {loading ? <div style={{ color: 'var(--muted)', padding: '40px 0', textAlign: 'center' }}>در حال بارگذاری…</div>
          : shown.length === 0 ? <div style={{ color: 'var(--muted)', padding: '40px 0', textAlign: 'center' }}>مقاله‌ای یافت نشد.</div>
            : (
              <>
                {/* featured */}
                {featured && !q && !cat && (
                  <Link href={href(featured)} style={{ ...card, flexDirection: 'row', marginBottom: 24 }} className="mjb-feat">
                    <div style={{ width: '46%', minHeight: 240, background: featured.image ? `center/cover no-repeat url(${featured.image})` : gradientFor(featured.id) }} className="mjb-featimg" />
                    <div style={{ flex: 1, padding: '28px 26px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      {featured.category && <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700, marginBottom: 10 }}>{featured.category}</span>}
                      <h2 style={{ fontSize: 23, fontWeight: 800, margin: '0 0 12px', lineHeight: 1.5 }}>{featured.title}</h2>
                      <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.9, margin: '0 0 14px' }}>{meta(featured)}</p>
                      <div style={{ fontSize: 12, color: 'var(--faint)' }}>{(featured as any).meta?.author || 'تحریریه ملک‌جت'} · {faDate(featured.scrapedAt)}</div>
                    </div>
                  </Link>
                )}

                {/* grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 18 }}>
                  {rest.map(a => (
                    <Link key={a.id} href={href(a)} style={card}>
                      <div style={{ height: 160, background: a.image ? `center/cover no-repeat url(${a.image})` : gradientFor(a.id) }} />
                      <div style={{ padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                        {a.category && <span style={{ fontSize: 11.5, color: 'var(--gold)', fontWeight: 700, marginBottom: 7 }}>{a.category}</span>}
                        <div style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.6, marginBottom: 8 }}>{a.title}</div>
                        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.8, margin: '0 0 12px', flex: 1 }}>{meta(a).slice(0, 110)}…</p>
                        <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{faDate(a.scrapedAt)}</div>
                      </div>
                    </Link>
                  ))}
                </div>
                <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12.5, color: 'var(--faint)' }}>{toFa(shown.length)} مقاله</div>
              </>
            )}
      </main>
      <Footer />
    </div>
  )
}

function chip(active: boolean): React.CSSProperties {
  return { padding: '8px 15px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: active ? 700 : 500, border: `1px solid ${active ? 'var(--gold)' : 'var(--line2)'}`, background: active ? 'var(--goldDim)' : 'transparent', color: active ? 'var(--gold)' : 'var(--muted)' }
}
