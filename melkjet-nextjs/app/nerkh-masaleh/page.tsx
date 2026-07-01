'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => n.toLocaleString('fa-IR')
const money = (t: number) => t >= 1e9 ? `${fa(Math.round(t / 1e8) / 10)} میلیارد` : t >= 1e6 ? `${fa(Math.round(t / 1e5) / 10)} م` : fa(t)

interface Row { name: string; category: string; unit: string; min: number; max: number; median: number; avg: number; sellers: number; count: number; lastAt: number }

export default function MaterialPrices() {
  const [rows, setRows] = useState<Row[]>([])
  const [cats, setCats] = useState<string[]>([])
  const [updatedAt, setUpdatedAt] = useState(0)
  const [cat, setCat] = useState('همه')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const p = new URLSearchParams()
    if (cat !== 'همه') p.set('category', cat)
    if (search.trim()) p.set('search', search.trim())
    const t = setTimeout(() => {
      fetch(`/api/materials/prices?${p}`).then(r => r.ok ? r.json() : null).then(d => {
        if (d?.ok) { setRows(d.rows || []); setCats(d.categories || []); setUpdatedAt(d.updatedAt || 0) }
        setLoading(false)
      }).catch(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [cat, search])

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: FONT }}>
      <Nav />
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>📊 نرخِ روزِ مصالح</h1>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 8, maxWidth: 620, lineHeight: 1.9 }}>
              میانگینِ قیمتِ هر کالا از رویِ قیمتِ واقعیِ فروشگاه‌های ملک‌جت محاسبه می‌شود — نه نرخِ ثابت. برای سازنده‌ها و پیمانکارها جهتِ برآوردِ هزینه، و استعلامِ مستقیم از فروشنده.
            </p>
          </div>
          <Link href="/forushgaha" style={{ fontSize: 13, color: 'var(--gold)', textDecoration: 'none', border: '1px solid var(--gold)', borderRadius: 9, padding: '8px 16px', whiteSpace: 'nowrap' }}>🧱 فروشگاه‌های مصالح ↗</Link>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <input placeholder="جستجوی کالا (میلگرد، سیمان…)" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200, height: 44, padding: '0 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 13.5, outline: 'none', fontFamily: FONT }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {['همه', ...cats].map(c => (
            <button key={c} onClick={() => setCat(c)} style={{ padding: '7px 14px', borderRadius: 999, border: `1px solid ${cat === c ? 'var(--gold)' : 'var(--line2)'}`, background: cat === c ? 'var(--goldDim)' : 'transparent', color: cat === c ? 'var(--gold)' : 'var(--muted)', fontSize: 12.5, fontWeight: cat === c ? 700 : 400, cursor: 'pointer', fontFamily: FONT }}>{c}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>در حال بارگذاری…</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: 16 }}>
            هنوز قیمتی ثبت نشده — وقتی فروشندگان محصولاتشان را با قیمت وارد کنند، نرخِ روز این‌جا ساخته می‌شود.
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
            <div className="mjn-row" style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr 1fr 1fr 0.9fr', padding: '12px 18px', background: 'var(--bg2)', borderBottom: '1px solid var(--line)', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
              <div>کالا</div><div>کمترین</div><div>میانگین</div><div>بیشترین</div><div>فروشنده</div>
            </div>
            <div style={{ maxHeight: 640, overflowY: 'auto' }}>
              {rows.map((r, i) => (
                <div key={r.name + r.unit + i} className="mjn-row" style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr 1fr 1fr 0.9fr', padding: '13px 18px', borderBottom: i < rows.length - 1 ? '1px solid var(--line)' : 'none', fontSize: 13, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{r.category} · هر {r.unit}</div>
                  </div>
                  <div style={{ color: '#5fd98a', fontWeight: 600, whiteSpace: 'nowrap' }}>{money(r.min)}</div>
                  <div style={{ fontWeight: 800, color: 'var(--gold)', whiteSpace: 'nowrap' }}>{money(r.avg)}</div>
                  <div style={{ color: '#f0a35f', fontWeight: 600, whiteSpace: 'nowrap' }}>{money(r.max)}</div>
                  <div style={{ color: 'var(--muted)' }}>{fa(r.sellers)} فروشنده</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 12, textAlign: 'center' }}>
          قیمت‌ها به تومان‌اند و از قیمتِ اعلامیِ فروشندگان محاسبه شده‌اند{updatedAt ? ` · آخرین به‌روزرسانی: ${new Date(updatedAt).toLocaleDateString('fa-IR')}` : ''}. برای قیمتِ دقیق و خرید، به فروشگاهِ موردنظر مراجعه کنید.
        </div>
      </div>
      <Footer />
    </div>
  )
}
