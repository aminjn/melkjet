'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
const money = (t: number) => t >= 1e9 ? `${fa(Math.round(t / 1e8) / 10)} میلیارد` : t >= 1e6 ? `${fa(Math.round(t / 1e5) / 10)} میلیون` : fa(t)

interface Item { id: string; name: string; image: string; brand: string; category: string; unit: string; source: string; refPrice: number; sellerCount: number }
interface CatNode { id: string; name: string; count: number; children?: CatNode[] }
interface Facets { tree: CatNode[]; brands: { label: string; count: number }[]; units: { label: string; count: number }[]; priceRange: { min: number; max: number } | null; total: number }

function findCatByName(nodes: CatNode[], name: string): string {
  for (const n of nodes) { if (n.name === name) return n.id; if (n.children) { const r = findCatByName(n.children, name); if (r) return r } }
  return ''
}

export default function BazarMasaleh() {
  const [items, setItems] = useState<Item[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [facets, setFacets] = useState<Facets | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [brand, setBrand] = useState('')
  const [unit, setUnit] = useState('')
  const [sort, setSort] = useState('')
  const [withSeller, setWithSeller] = useState(false)
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [ai, setAi] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const fetchPage = useCallback((p: number, replace: boolean) => {
    setLoading(true)
    const q = new URLSearchParams({ page: String(p), pageSize: '24' })
    if (search.trim()) q.set('search', search.trim())
    if (category) q.set('category', category)
    if (brand) q.set('brand', brand)
    if (unit) q.set('unit', unit)
    if (sort) q.set('sort', sort)
    if (withSeller) q.set('withSeller', '1')
    if (minPrice) q.set('minPrice', minPrice)
    if (maxPrice) q.set('maxPrice', maxPrice)
    if (p === 1) q.set('facets', '1')
    fetch(`/api/catalog/products?${q}`).then(r => r.ok ? r.json() : null).then(d => {
      if (d?.ok) { setTotal(d.total); setItems(prev => replace ? d.items : [...prev, ...d.items]); if (d.facets) setFacets(d.facets) }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [search, category, brand, unit, sort, withSeller, minPrice, maxPrice])

  useEffect(() => { setPage(1); const t = setTimeout(() => fetchPage(1, true), 250); return () => clearTimeout(t) }, [fetchPage])

  const runAi = async () => {
    if (!ai.trim()) return
    setAiBusy(true)
    try {
      const r = await fetch('/api/catalog/ai-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: ai.trim() }) })
      const d = await r.json().catch(() => ({}))
      if (d?.ok && d.filter) {
        setCategory(d.filter.category && facets ? findCatByName(facets.tree, d.filter.category) : '')
        setSearch(d.filter.search || ''); setSort(d.filter.sort || ''); setWithSeller(false); setBrand(''); setUnit(''); setMinPrice(''); setMaxPrice('')
      }
    } finally { setAiBusy(false) }
  }

  const activeFilters = [category, brand, unit, sort, minPrice, maxPrice].filter(Boolean).length + (withSeller ? 1 : 0)
  const reset = () => { setCategory(''); setBrand(''); setUnit(''); setSort(''); setWithSeller(false); setMinPrice(''); setMaxPrice(''); setSearch('') }

  const FilterPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* category tree */}
      {facets && facets.tree.length > 0 && (
        <div>
          <div style={fh}>دسته‌بندی</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 340, overflowY: 'auto', marginInlineEnd: -4, paddingInlineEnd: 4 }}>
            <CatRowBtn label="همهٔ کالاها" count={facets.total} active={category === ''} depth={0} onClick={() => setCategory('')} />
            {facets.tree.map(n => <CatTree key={n.id} node={n} depth={0} selected={category} onSelect={setCategory} />)}
          </div>
        </div>
      )}
      {/* brand */}
      {facets && facets.brands.length > 0 && (
        <div>
          <div style={fh}>برند / کارخانه</div>
          <select value={brand} onChange={e => setBrand(e.target.value)} style={sel}><option value="">همهٔ برندها</option>{facets.brands.map(b => <option key={b.label} value={b.label}>{b.label} ({fa(b.count)})</option>)}</select>
        </div>
      )}
      {/* unit */}
      {facets && facets.units.length > 1 && (
        <div>
          <div style={fh}>واحد</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setUnit('')} style={pill(unit === '')}>همه</button>
            {facets.units.slice(0, 8).map(u => <button key={u.label} onClick={() => setUnit(unit === u.label ? '' : u.label)} style={pill(unit === u.label)}>{u.label}</button>)}
          </div>
        </div>
      )}
      {/* price range */}
      {facets?.priceRange && (
        <div>
          <div style={fh}>محدودهٔ قیمت (تومان)</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input inputMode="numeric" value={minPrice} onChange={e => setMinPrice(e.target.value.replace(/\D/g, ''))} placeholder={`از ${money(facets.priceRange.min)}`} style={{ ...sel, textAlign: 'center' }} />
            <span style={{ color: 'var(--faint)' }}>تا</span>
            <input inputMode="numeric" value={maxPrice} onChange={e => setMaxPrice(e.target.value.replace(/\D/g, ''))} placeholder={`تا ${money(facets.priceRange.max)}`} style={{ ...sel, textAlign: 'center' }} />
          </div>
        </div>
      )}
      {/* sort + seller */}
      <div>
        <div style={fh}>مرتب‌سازی</div>
        <select value={sort} onChange={e => setSort(e.target.value)} style={sel}><option value="">جدیدترین</option><option value="cheap">ارزان‌ترین</option><option value="expensive">گران‌ترین</option></select>
      </div>
      <button onClick={() => setWithSeller(v => !v)} style={{ ...sel, cursor: 'pointer', border: `1px solid ${withSeller ? 'var(--gold)' : 'var(--line2)'}`, color: withSeller ? 'var(--gold)' : 'var(--muted)', background: withSeller ? 'var(--goldDim)' : 'var(--surface)', fontWeight: withSeller ? 700 : 400, textAlign: 'center' }}>{withSeller ? '✓ ' : ''}فقط دارای فروشنده</button>
      {activeFilters > 0 && <button onClick={reset} style={{ ...sel, cursor: 'pointer', color: '#f87171', border: '1px solid var(--line2)', background: 'transparent', textAlign: 'center' }}>پاک‌کردنِ فیلترها ({fa(activeFilters)})</button>}
    </div>
  )

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: FONT }}>
      <Nav />
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '24px 20px 60px' }}>
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
        <div style={{ background: 'linear-gradient(120deg,var(--goldDim),transparent)', border: '1px solid var(--gold)', borderRadius: 14, padding: 12, marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={ai} onChange={e => setAi(e.target.value)} onKeyDown={e => e.key === 'Enter' && runAi()} placeholder="✦ با هوش مصنوعی بپرس: مثلاً «میلگرد ارزان برای فونداسیون» یا «کاشی کف ۶۰×۶۰»" style={{ flex: 1, minWidth: 220, height: 44, padding: '0 14px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 13.5, outline: 'none', fontFamily: FONT }} />
          <button onClick={runAi} disabled={aiBusy} style={{ padding: '0 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: FONT }}>{aiBusy ? '…' : 'جستجوی هوشمند'}</button>
        </div>

        {/* search + mobile filter toggle */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجوی کالا…" style={{ flex: 1, minWidth: 180, height: 44, padding: '0 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 13.5, outline: 'none', fontFamily: FONT }} />
          <button className="mjb-filterbtn" onClick={() => setShowFilters(v => !v)} style={{ display: 'none', height: 44, padding: '0 18px', borderRadius: 12, border: `1px solid ${activeFilters ? 'var(--gold)' : 'var(--line2)'}`, background: activeFilters ? 'var(--goldDim)' : 'var(--surface)', color: activeFilters ? 'var(--gold)' : 'var(--text)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>⚙ فیلترها{activeFilters ? ` (${fa(activeFilters)})` : ''}</button>
        </div>

        <div className="mjb-layout" style={{ display: 'grid', gridTemplateColumns: '236px 1fr', gap: 20, alignItems: 'start' }}>
          {/* sidebar */}
          <aside className={`mjb-side${showFilters ? ' open' : ''}`} style={{ position: 'sticky', top: 16, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 16 }}>
            {FilterPanel}
          </aside>

          {/* results */}
          <div>
            {items.length === 0 && !loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: 16 }}>کالایی با این فیلتر یافت نشد.</div>
            ) : (
              <>
                <div className="mjb-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 16 }}>
                  {items.map(p => (
                    <Link key={p.id} href={`/mahsul/${p.id}`} className="mjd-card" style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', transition: 'transform .15s, box-shadow .15s' }}>
                      <div style={{ height: 150, background: p.image ? `center/contain no-repeat url(${p.image}) var(--bg2)` : 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, position: 'relative' }}>
                        {!p.image && '🧱'}
                        {p.sellerCount > 0 && <span style={{ position: 'absolute', top: 8, insetInlineEnd: 8, fontSize: 10, fontWeight: 800, color: '#0c1a10', background: '#5fd98a', borderRadius: 999, padding: '3px 8px' }}>{fa(p.sellerCount)} فروشنده</span>}
                      </div>
                      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.6, minHeight: 42, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.category}{p.brand ? ` · ${p.brand}` : ''}</div>
                        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                          {p.refPrice > 0 ? <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)' }}>{money(p.refPrice)} <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400 }}>ت{p.unit ? `/${p.unit}` : ''}</span></span> : <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>استعلام</span>}
                          {p.sellerCount === 0 && <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>بدون فروشنده</span>}
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
        </div>
      </div>
      <Footer />
    </div>
  )
}

// ردیفِ دستهٔ درختی — با فرورفتگیِ سطح و شمارش
function CatTree({ node, depth, selected, onSelect }: { node: CatNode; depth: number; selected: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const hasKids = !!node.children && node.children.length > 0
  const isSel = selected === node.id
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingInlineStart: depth * 12 }}>
        {hasKids ? <button onClick={() => setOpen(o => !o)} style={{ width: 18, height: 22, border: 'none', background: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 10, flexShrink: 0 }}>{open ? '▾' : '▸'}</button> : <span style={{ width: 18, flexShrink: 0 }} />}
        <CatRowBtn label={node.name} count={node.count} active={isSel} depth={0} onClick={() => onSelect(isSel ? '' : node.id)} />
      </div>
      {open && hasKids && node.children!.map(ch => <CatTree key={ch.id} node={ch} depth={depth + 1} selected={selected} onSelect={onSelect} />)}
    </div>
  )
}
function CatRowBtn({ label, count, active, onClick }: { label: string; count: number; active: boolean; depth: number; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 9, border: 'none', background: active ? 'var(--goldDim)' : 'transparent', color: active ? 'var(--gold)' : 'var(--text)', fontSize: 12.5, fontWeight: active ? 700 : 400, cursor: 'pointer', fontFamily: FONT, textAlign: 'right', minWidth: 0 }}>
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <span style={{ fontSize: 10.5, color: 'var(--faint)', flexShrink: 0 }}>{fa(count)}</span>
    </button>
  )
}

const fh: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }
const sel: React.CSSProperties = { width: '100%', height: 40, padding: '0 12px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 13, cursor: 'pointer', outline: 'none', fontFamily: FONT }
const topLink: React.CSSProperties = { fontSize: 12.5, color: 'var(--gold)', textDecoration: 'none', border: '1px solid var(--gold)', borderRadius: 9, padding: '8px 14px', whiteSpace: 'nowrap' }
function pill(active: boolean): React.CSSProperties {
  return { padding: '6px 12px', borderRadius: 999, border: `1px solid ${active ? 'var(--gold)' : 'var(--line2)'}`, background: active ? 'var(--goldDim)' : 'transparent', color: active ? 'var(--gold)' : 'var(--muted)', fontSize: 12, fontWeight: active ? 700 : 400, cursor: 'pointer', fontFamily: FONT }
}
