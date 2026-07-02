'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
const money = (t: number) => t >= 1e9 ? `${fa(Math.round(t / 1e8) / 10)} میلیارد` : t >= 1e6 ? `${fa(Math.round(t / 1e5) / 10)} میلیون` : fa(t)

interface Item { id: string; name: string; image: string; brand: string; category: string; unit: string; source: string; refPrice: number; sellerCount: number; sourceLabel: string }
interface Facets { categories: { id: string; name: string; count: number }[]; brands: { label: string; count: number }[]; sources: Record<string, number>; total: number }

export default function BazarMasaleh() {
  const [items, setItems] = useState<Item[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [facets, setFacets] = useState<Facets | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [brand, setBrand] = useState('')
  const [sort, setSort] = useState('')
  const [withSeller, setWithSeller] = useState(false)
  const [ai, setAi] = useState('')
  const [aiBusy, setAiBusy] = useState(false)

  const fetchPage = useCallback((p: number, replace: boolean) => {
    setLoading(true)
    const q = new URLSearchParams({ page: String(p), pageSize: '24' })
    if (search.trim()) q.set('search', search.trim())
    if (category) q.set('category', category)
    if (brand) q.set('brand', brand)
    if (sort) q.set('sort', sort)
    if (withSeller) q.set('withSeller', '1')
    if (p === 1) q.set('facets', '1')
    fetch(`/api/catalog/products?${q}`).then(r => r.ok ? r.json() : null).then(d => {
      if (d?.ok) { setTotal(d.total); setItems(prev => replace ? d.items : [...prev, ...d.items]); if (d.facets) setFacets(d.facets) }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [search, category, brand, sort, withSeller])

  useEffect(() => { setPage(1); const t = setTimeout(() => fetchPage(1, true), 250); return () => clearTimeout(t) }, [fetchPage])

  const runAi = async () => {
    if (!ai.trim()) return
    setAiBusy(true)
    try {
      const r = await fetch('/api/catalog/ai-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: ai.trim() }) })
      const d = await r.json().catch(() => ({}))
      if (d?.ok && d.filter) {
        const catId = d.filter.category ? (facets?.categories.find(c => c.name === d.filter.category)?.id || '') : ''
        setCategory(catId); setSearch(d.filter.search || ''); setSort(d.filter.sort || ''); setWithSeller(false); setBrand('')
      }
    } finally { setAiBusy(false) }
  }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: FONT }}>
      <Nav />
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 20px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>🧱 بازارِ مصالح ساختمانی</h1>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>{facets ? `${fa(facets.total)} کالا` : 'همهٔ محصولات'} — با قیمتِ مرجع، مقایسهٔ فروشندگان و نرخِ روز.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/forushgaha" style={topLink}>🏪 فروشگاه‌ها ↗</Link>
            <Link href="/nerkh-masaleh" style={topLink}>📊 نرخِ روز ↗</Link>
          </div>
        </div>

        {/* AI search */}
        <div style={{ background: 'linear-gradient(120deg,var(--goldDim),transparent)', border: '1px solid var(--gold)', borderRadius: 14, padding: 12, marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={ai} onChange={e => setAi(e.target.value)} onKeyDown={e => e.key === 'Enter' && runAi()} placeholder="✦ با هوش مصنوعی بپرس: مثلاً «میلگرد ارزان برای فونداسیون» یا «کاشی کف ۶۰×۶۰»" style={{ flex: 1, minWidth: 220, height: 44, padding: '0 14px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 13.5, outline: 'none', fontFamily: FONT }} />
          <button onClick={runAi} disabled={aiBusy} style={{ padding: '0 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: FONT }}>{aiBusy ? '…' : 'جستجوی هوشمند'}</button>
        </div>

        {/* filters */}
        <div className="mjb-tools" style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجوی کالا…" style={{ flex: 1, minWidth: 180, height: 44, padding: '0 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 13.5, outline: 'none', fontFamily: FONT }} />
          <select value={brand} onChange={e => setBrand(e.target.value)} style={sel}><option value="">همهٔ برندها</option>{facets?.brands.map(b => <option key={b.label} value={b.label}>{b.label} ({fa(b.count)})</option>)}</select>
          <select value={sort} onChange={e => setSort(e.target.value)} style={sel}><option value="">جدیدترین</option><option value="cheap">ارزان‌ترین</option><option value="expensive">گران‌ترین</option></select>
          <button onClick={() => setWithSeller(v => !v)} style={{ ...sel, cursor: 'pointer', border: `1px solid ${withSeller ? 'var(--gold)' : 'var(--line2)'}`, color: withSeller ? 'var(--gold)' : 'var(--muted)', background: withSeller ? 'var(--goldDim)' : 'var(--surface)', fontWeight: withSeller ? 700 : 400 }}>فقط دارای فروشنده</button>
        </div>

        {/* category chips */}
        {facets && facets.categories.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            <button onClick={() => setCategory('')} style={chip(category === '')}>همه</button>
            {facets.categories.slice(0, 18).map(c => <button key={c.id} onClick={() => setCategory(c.id)} style={chip(category === c.id)}>{c.name} ({fa(c.count)})</button>)}
          </div>
        )}

        {items.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: 16 }}>کالایی با این فیلتر یافت نشد.</div>
        ) : (
          <>
            <div className="mjb-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16 }}>
              {items.map(p => (
                <Link key={p.id} href={`/mahsul/${p.id}`} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ height: 150, background: p.image ? `center/contain no-repeat url(${p.image}) var(--bg2)` : 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>
                    {!p.image && '🧱'}
                  </div>
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.6, minHeight: 42 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.category}{p.brand ? ` · ${p.brand}` : ''}</div>
                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6 }}>
                      {p.refPrice > 0 ? <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)' }}>{money(p.refPrice)} <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400 }}>ت</span></span> : <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>استعلام</span>}
                      {p.sellerCount > 0
                        ? <span style={{ fontSize: 10.5, color: '#5fd98a', fontWeight: 700 }}>● {fa(p.sellerCount)} فروشنده</span>
                        : <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>○ بدون فروشنده</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {loading && <div style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>در حال بارگذاری…</div>}
            {!loading && items.length < total && (
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <button onClick={() => { const np = page + 1; setPage(np); fetchPage(np, false) }} style={{ padding: '11px 30px', borderRadius: 12, border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>نمایشِ بیشتر ({fa(total - items.length)} کالای دیگر)</button>
              </div>
            )}
          </>
        )}
      </div>
      <Footer />
    </div>
  )
}

const sel: React.CSSProperties = { height: 44, padding: '0 12px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 13, cursor: 'pointer', outline: 'none', fontFamily: FONT }
const topLink: React.CSSProperties = { fontSize: 12.5, color: 'var(--gold)', textDecoration: 'none', border: '1px solid var(--gold)', borderRadius: 9, padding: '8px 14px', whiteSpace: 'nowrap' }
function chip(active: boolean): React.CSSProperties {
  return { padding: '7px 14px', borderRadius: 999, border: `1px solid ${active ? 'var(--gold)' : 'var(--line2)'}`, background: active ? 'var(--goldDim)' : 'transparent', color: active ? 'var(--gold)' : 'var(--muted)', fontSize: 12.5, fontWeight: active ? 700 : 400, cursor: 'pointer', fontFamily: FONT }
}
