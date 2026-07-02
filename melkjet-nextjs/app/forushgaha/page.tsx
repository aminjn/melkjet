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
              <Link key={s.slug} href={`/forushgah/${s.slug}`} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: 84, background: s.cover ? `center/cover no-repeat url(${s.cover})` : 'linear-gradient(120deg,#1f2937,#0f2340)', position: 'relative' }}>
                  {s.rating > 0 && <span style={{ position: 'absolute', top: 10, insetInlineStart: 10, fontSize: 11.5, fontWeight: 700, color: 'var(--gold)', background: 'rgba(10,9,8,0.75)', borderRadius: 8, padding: '3px 9px' }}>{fa(s.rating)} ★</span>}
                </div>
                <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 14, marginTop: -28, background: s.logo ? `center/cover no-repeat url(${s.logo})` : 'linear-gradient(135deg,var(--gold2),var(--gold))', border: '3px solid var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#16140f', flexShrink: 0, boxShadow: '0 4px 12px -4px rgba(0,0,0,0.5)' }}>{!s.logo && (s.name.charAt(0) || 'ف')}</div>
                  <div style={{ fontSize: 15.5, fontWeight: 800, marginTop: 4, lineHeight: 1.5 }}>{s.name}</div>
                  {s.tagline && <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.tagline}</div>}
                  {s.categories.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {s.categories.slice(0, 3).map(c => <span key={c} style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 7, padding: '3px 9px' }}>{c}</span>)}
                  </div>}
                  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--faint)', paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                    <span>📦 {fa(s.productCount)} کالا{s.city ? ` · ${s.city}` : ''}</span>
                    {s.minPrice > 0 && <span style={{ color: 'var(--gold)', fontWeight: 700 }}>از {mt(s.minPrice)} ت</span>}
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
