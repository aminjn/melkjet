'use client'
import { useState, useEffect } from 'react'

const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => n.toLocaleString('fa-IR')
const money = (t: number) => t >= 1e9 ? `${fa(Math.round(t / 1e8) / 10)} میلیارد` : t >= 1e6 ? `${fa(Math.round(t / 1e5) / 10)} م` : fa(t)
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }

interface PriceRow { name: string; category: string; unit: string; min: number; max: number; avg: number; sellers: number }
interface Shop { slug: string; name: string; logo: string; city: string; rating: number; productCount: number; categories: string[]; minPrice: number }

// «تأمینِ مصالح» در پنلِ سازنده — نرخِ روز (تجمیعِ واقعیِ فروشندگان) + فروشگاه‌ها + استعلام.
export default function MaterialsSupplyView() {
  const [rows, setRows] = useState<PriceRow[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => {
      const q = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''
      Promise.all([
        fetch(`/api/materials/prices${q}`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/materials/directory${q}`).then(r => r.ok ? r.json() : null).catch(() => null),
      ]).then(([p, d]) => {
        if (p?.ok) setRows(p.rows || [])
        if (d?.ok) setShops(d.shops || [])
        setLoading(false)
      })
    }, 250)
    return () => clearTimeout(t)
  }, [search])

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

      <input placeholder="جستجوی کالا یا فروشگاه (میلگرد، سیمان…)" value={search} onChange={e => setSearch(e.target.value)} style={{ height: 46, padding: '0 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: FONT }} />

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

          {/* sellers */}
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', fontSize: 14, fontWeight: 700 }}>فروشگاه‌های مصالح</div>
            {shops.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>فروشگاهی یافت نشد.</div>
            ) : (
              <div style={{ maxHeight: 520, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {shops.slice(0, 20).map((s, i) => (
                  <a key={s.slug} href={`/store/${s.slug}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i ? '1px solid var(--line)' : 'none', textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, background: s.logo ? `center/cover no-repeat url(${s.logo})` : 'linear-gradient(135deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#16140f' }}>{!s.logo && (s.name.charAt(0) || 'ف')}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>📦 {fa(s.productCount)} کالا{s.city ? ` · ${s.city}` : ''}{s.rating > 0 ? ` · ${fa(s.rating)}★` : ''}</div>
                    </div>
                    <span style={{ fontSize: 11.5, color: 'var(--gold)', border: '1px solid var(--gold)', borderRadius: 8, padding: '5px 10px', whiteSpace: 'nowrap' }}>استعلام ↗</span>
                  </a>
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
