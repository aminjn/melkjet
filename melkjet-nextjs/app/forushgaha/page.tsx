'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => n.toLocaleString('fa-IR')
const mt = (t: number) => t >= 1e9 ? `${fa(Math.round(t / 1e8) / 10)} میلیارد` : t >= 1e6 ? `${fa(Math.round(t / 1e5) / 10)} میلیون` : fa(t)

interface Shop {
  slug: string; name: string; tagline: string; logo: string; cover: string; city: string; province: string
  rating: number; productCount: number; categories: string[]; minPrice: number
}
interface Facets { cities: string[]; categories: { label: string; count: number }[]; shopCount: number }

export default function MaterialsDirectory() {
  const [shops, setShops] = useState<Shop[]>([])
  const [facets, setFacets] = useState<Facets | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [cat, setCat] = useState('')

  useEffect(() => {
    setLoading(true)
    const p = new URLSearchParams({ facets: '1' })
    if (search.trim()) p.set('search', search.trim())
    if (city) p.set('city', city)
    if (cat) p.set('category', cat)
    const t = setTimeout(() => {
      fetch(`/api/materials/directory?${p}`).then(r => r.ok ? r.json() : null).then(d => {
        if (d?.ok) { setShops(d.shops || []); if (d.facets) setFacets(d.facets) }
        setLoading(false)
      }).catch(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [search, city, cat])

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: FONT }}>
      <Nav />
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>🧱 بازار مصالح ساختمانی</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8 }}>
            فروشگاه‌های مصالح ساختمانی{facets ? ` — ${fa(facets.shopCount)} فروشگاه` : ''}. نرخِ روز، مقایسه و استعلامِ مستقیم از فروشنده.
          </p>
          <Link href="/nerkh-masaleh" style={{ display: 'inline-block', marginTop: 10, fontSize: 13, color: 'var(--gold)', textDecoration: 'none', border: '1px solid var(--gold)', borderRadius: 9, padding: '8px 16px' }}>📊 نرخِ روزِ مصالح ↗</Link>
        </div>

        {/* filters */}
        <div className="mjd-tools" style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          <input placeholder="جستجوی فروشگاه یا کالا…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200, height: 46, padding: '0 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: FONT }} />
          <select value={city} onChange={e => setCity(e.target.value)} style={sel}>
            <option value="">همهٔ شهرها</option>
            {facets?.cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={cat} onChange={e => setCat(e.target.value)} style={sel}>
            <option value="">همهٔ دسته‌ها</option>
            {facets?.categories.map(c => <option key={c.label} value={c.label}>{c.label} ({fa(c.count)})</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>در حال بارگذاری…</div>
        ) : shops.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: 16 }}>فروشگاهی با این فیلتر یافت نشد.</div>
        ) : (
          <div className="mjd-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
            {shops.map(s => (
              <Link key={s.slug} href={`/forushgah/${s.slug}`} className="mjd-card" style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', transition: 'transform .15s, box-shadow .15s' }}>
                {/* cover */}
                <div style={{ height: 92, background: s.cover ? `center/cover no-repeat url(${s.cover})` : 'linear-gradient(120deg,#242b38,#12151c)', position: 'relative' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--surface), transparent 70%)' }} />
                  {s.rating > 0 && <span style={{ position: 'absolute', top: 12, insetInlineEnd: 12, fontSize: 11.5, fontWeight: 800, color: 'var(--gold)', background: 'rgba(10,9,8,0.8)', borderRadius: 999, padding: '4px 10px' }}>★ {fa(s.rating)}</span>}
                </div>
                {/* logo + name row */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, padding: '0 16px', marginTop: -34, position: 'relative' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: s.logo ? `center/cover no-repeat url(${s.logo})` : 'linear-gradient(135deg,var(--gold2),var(--gold))', border: '3px solid var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: '#16140f', flexShrink: 0, boxShadow: '0 6px 16px -6px rgba(0,0,0,0.6)' }}>{!s.logo && (s.name.charAt(0) || 'ف')}</div>
                  <div style={{ minWidth: 0, flex: 1, paddingBottom: 4 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                    {s.city && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>📍 {s.city}</div>}
                  </div>
                </div>
                {/* body */}
                <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  {s.tagline && <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.tagline}</div>}
                  {s.categories.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {s.categories.slice(0, 3).map(c => <span key={c} style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 999, padding: '4px 11px' }}>{c}</span>)}
                  </div>}
                  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--faint)', paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                    <span>📦 {fa(s.productCount)} کالا</span>
                    {s.minPrice > 0 && <span style={{ color: 'var(--gold)', fontWeight: 800 }}>از {mt(s.minPrice)} تومان</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}

const sel: React.CSSProperties = { height: 46, padding: '0 12px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 14, cursor: 'pointer', outline: 'none', fontFamily: FONT }
