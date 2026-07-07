'use client'
import { useState, useEffect } from 'react'

const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => n.toLocaleString('fa-IR')
const money = (t: number) => t >= 1e9 ? `${fa(Math.round(t / 1e8) / 10)} میلیارد` : t >= 1e6 ? `${fa(Math.round(t / 1e5) / 10)} م` : fa(t)
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }

interface PriceRow { name: string; category: string; unit: string; min: number; max: number; avg: number; sellers: number }
interface Shop { slug: string; name: string; logo: string; city: string; neighborhood?: string; rating: number; productCount: number; categories: string[]; minPrice: number; phone?: string }
interface Facets { cities: string[]; categories: { label: string; count: number }[]; shopCount: number }

// «تأمینِ مصالح» در پنلِ سازنده — نرخِ روز + فروشگاه‌های واقعیِ مصالح با فیلترِ دسته/شهر + تماس/چت.
export default function MaterialsSupplyView() {
  const [rows, setRows] = useState<PriceRow[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [facets, setFacets] = useState<Facets | null>(null)
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => {
      const qs = new URLSearchParams()
      if (search.trim()) qs.set('search', search.trim())
      if (city) qs.set('city', city)
      if (category) qs.set('category', category)
      if (!facets) qs.set('facets', '1')
      Promise.all([
        fetch(`/api/materials/prices?${new URLSearchParams({ ...(search.trim() ? { search: search.trim() } : {}), ...(category ? { category } : {}) })}`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/materials/directory?${qs}`).then(r => r.ok ? r.json() : null).catch(() => null),
      ]).then(([p, d]) => {
        if (p?.ok) setRows(p.rows || [])
        if (d?.ok) { setShops(d.shops || []); if (d.facets) setFacets(d.facets) }
        setLoading(false)
      })
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, city, category])

  const chip = (label: string, active: boolean, onClick: () => void) => (
    <button key={label} onClick={onClick} style={{ fontSize: 11.5, fontWeight: active ? 800 : 600, padding: '6px 12px', borderRadius: 999, border: active ? '1px solid var(--gold)' : '1px solid var(--line2)', background: active ? 'var(--goldDim)' : 'var(--surface)', color: active ? 'var(--gold)' : 'var(--muted)', cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap' }}>{label}</button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontFamily: FONT }}>
      <div style={{ ...card, padding: 18, background: 'linear-gradient(120deg,var(--goldDim),transparent)' }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>🧱 تأمینِ مصالحِ پروژه</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.9 }}>
          نرخِ روزِ مصالح از قیمتِ واقعیِ فروشندگانِ ملک‌جت. برای برآوردِ هزینه، مقایسه و استعلامِ مستقیم از فروشنده.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <a href="/materials-prices" target="_blank" rel="noreferrer" style={linkBtn}>📊 نرخِ روزِ کامل ↗</a>
          <a href="/stores" target="_blank" rel="noreferrer" style={linkBtn}>🏪 همهٔ فروشگاه‌ها ↗</a>
        </div>
      </div>

      {/* جستجو + فیلترِ شهر/دسته — با هزارها فروشنده هم کار می‌کند */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="جستجوی کالا، فروشگاه یا محله (میلگرد، سیمان…)" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: '1 1 260px', height: 46, padding: '0 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: FONT }} />
        <select value={city} onChange={e => setCity(e.target.value)} style={{ height: 46, padding: '0 12px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line2)', color: city ? 'var(--gold)' : 'var(--muted)', fontSize: 13, fontFamily: FONT, minWidth: 130 }}>
          <option value="">همهٔ شهرها</option>
          {(facets?.cities || []).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {(facets?.categories || []).length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {chip('همهٔ دسته‌ها', !category, () => setCategory(''))}
          {(facets?.categories || []).slice(0, 12).map(c => chip(`${c.label} (${fa(c.count)})`, category === c.label, () => setCategory(category === c.label ? '' : c.label)))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>در حال بارگذاری…</div>
      ) : (
        <div className="mjb-supply" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 18, alignItems: 'start' }}>
          {/* price board */}
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', fontSize: 14, fontWeight: 700 }}>نرخِ روزِ مصالح</div>
            {rows.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>هنوز قیمتی ثبت نشده است.</div>
            ) : (
              <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                {rows.slice(0, 30).map((r, i) => (
                  <div key={r.name + i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.8fr', padding: '11px 16px', borderTop: i ? '1px solid var(--line)' : 'none', fontSize: 12.5, alignItems: 'center' }}>
                    <div><div style={{ fontWeight: 700 }}>{r.name}</div><div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 2 }}>{r.category} · هر {r.unit}</div></div>
                    <div style={{ fontWeight: 800, color: 'var(--gold)', whiteSpace: 'nowrap' }}>{money(r.avg)} <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400 }}>میانگین</span></div>
                    <div style={{ color: 'var(--muted)', textAlign: 'left' }}>{fa(r.sellers)} فروشنده</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* sellers — فقط فروشندگانِ واقعیِ مصالح */}
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', fontSize: 14, fontWeight: 700 }}>
              فروشگاه‌های مصالح {facets ? <span style={{ fontSize: 11, color: 'var(--faint)', fontWeight: 400 }}>({fa(shops.length)} از {fa(facets.shopCount)})</span> : null}
            </div>
            {shops.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>فروشگاهی با این فیلترها یافت نشد.</div>
            ) : (
              <div style={{ maxHeight: 520, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {shops.slice(0, 30).map((s, i) => (
                  <div key={s.slug} style={{ padding: '12px 16px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, background: s.logo ? `center/cover no-repeat url(${s.logo})` : 'linear-gradient(135deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#16140f' }}>{!s.logo && (s.name.charAt(0) || 'ف')}</div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <a href={`/store/${s.slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', color: 'inherit', textDecoration: 'none' }}>{s.name}</a>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>📦 {fa(s.productCount)} کالا{s.city ? ` · ${s.city}` : ''}{s.neighborhood ? `، ${s.neighborhood}` : ''}{s.rating > 0 ? ` · ${fa(s.rating)}★` : ''}</div>
                      </div>
                    </div>
                    {/* تماس + چت/استعلام — زیرِ هر فروشنده */}
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      {s.phone && <a href={`tel:${s.phone}`} style={{ flex: 1, textAlign: 'center', fontSize: 11.5, fontWeight: 800, color: '#16140f', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', borderRadius: 8, padding: '7px 0', textDecoration: 'none' }}>☎ تماس</a>}
                      <a href={`/store/${s.slug}#inquiry`} target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: 'var(--gold)', border: '1px solid var(--gold)', borderRadius: 8, padding: '6px 0', textDecoration: 'none' }}>💬 چت و استعلام</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <style>{`@media(max-width:760px){.mjb-supply{grid-template-columns:1fr!important}}`}</style>
    </div>
  )
}

const linkBtn: React.CSSProperties = { fontSize: 12.5, color: 'var(--gold)', textDecoration: 'none', border: '1px solid var(--gold)', borderRadius: 9, padding: '8px 14px', fontFamily: FONT }
