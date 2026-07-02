'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => n.toLocaleString('fa-IR')
const money = (t: number) => t >= 1e9 ? `${fa(Math.round(t / 1e8) / 10)} میلیارد` : t >= 1e6 ? `${fa(Math.round(t / 1e5) / 10)} م` : fa(t)

interface SellerRow { name: string; category: string; unit: string; min: number; max: number; avg: number; sellers: number }
interface RefRow { id: string; name: string; image: string; brand: string; category: string; unit: string; price: number; changePct: number; spark: number[]; updatedAt: string; sellerCount: number; sourceLabel: string }

export default function MaterialPrices() {
  const [tab, setTab] = useState<'ref' | 'sellers'>('ref')
  const [cat, setCat] = useState('همه')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [cats, setCats] = useState<string[]>([])
  const [refRows, setRefRows] = useState<RefRow[]>([])
  const [sellerRows, setSellerRows] = useState<SellerRow[]>([])

  useEffect(() => {
    setLoading(true)
    const p = new URLSearchParams()
    if (cat !== 'همه') p.set('category', cat)
    if (search.trim()) p.set('search', search.trim())
    const url = tab === 'ref' ? `/api/catalog/reference-prices?${p}` : `/api/materials/prices?${p}`
    const t = setTimeout(() => {
      fetch(url).then(r => r.ok ? r.json() : null).then(d => {
        if (d?.ok) {
          setCats(d.categories || [])
          if (tab === 'ref') setRefRows(d.rows || []); else setSellerRows(d.rows || [])
        }
        setLoading(false)
      }).catch(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [tab, cat, search])

  const rows = tab === 'ref' ? refRows : sellerRows

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: FONT }}>
      <Nav />
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>📊 نرخِ روزِ مصالح</h1>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 8, maxWidth: 640, lineHeight: 1.9 }}>
              نرخِ مرجعِ مصالح با روندِ تاریخیِ قیمت + قیمتِ واقعیِ فروشگاه‌های ملک‌جت. برای سازنده‌ها و پیمانکارها جهتِ برآوردِ هزینه.
            </p>
          </div>
          <Link href="/forushgaha" style={{ fontSize: 13, color: 'var(--gold)', textDecoration: 'none', border: '1px solid var(--gold)', borderRadius: 9, padding: '8px 16px', whiteSpace: 'nowrap' }}>🧱 فروشگاه‌های مصالح ↗</Link>
        </div>

        {/* tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {([['ref', 'نرخِ مرجع (روندِ تاریخی)'], ['sellers', 'نرخِ فروشندگان']] as const).map(([k, l]) => (
            <button key={k} onClick={() => { setTab(k); setCat('همه') }} style={{ padding: '9px 16px', borderRadius: 11, border: `1px solid ${tab === k ? 'var(--gold)' : 'var(--line2)'}`, background: tab === k ? 'var(--goldDim)' : 'transparent', color: tab === k ? 'var(--gold)' : 'var(--muted)', fontSize: 13.5, fontWeight: tab === k ? 700 : 400, cursor: 'pointer', fontFamily: FONT }}>{l}</button>
          ))}
        </div>

        <input placeholder="جستجوی کالا (میلگرد، سیمان، سردوش…)" value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', height: 44, padding: '0 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 13.5, outline: 'none', fontFamily: FONT, marginBottom: 10 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {['همه', ...cats].slice(0, 20).map(c => (
            <button key={c} onClick={() => setCat(c)} style={{ padding: '7px 14px', borderRadius: 999, border: `1px solid ${cat === c ? 'var(--gold)' : 'var(--line2)'}`, background: cat === c ? 'var(--goldDim)' : 'transparent', color: cat === c ? 'var(--gold)' : 'var(--muted)', fontSize: 12.5, fontWeight: cat === c ? 700 : 400, cursor: 'pointer', fontFamily: FONT }}>{c}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>در حال بارگذاری…</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: 16 }}>
            {tab === 'ref' ? 'هنوز کالای مرجعی با روندِ قیمت ثبت نشده.' : 'هنوز فروشنده‌ای قیمت ثبت نکرده است.'}
          </div>
        ) : tab === 'ref' ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
            <div className="mjn-r" style={{ display: 'grid', gridTemplateColumns: '2.4fr 1.2fr 1fr 0.9fr', padding: '12px 18px', background: 'var(--bg2)', borderBottom: '1px solid var(--line)', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
              <div>کالا</div><div>روند</div><div>قیمتِ مرجع</div><div>تغییر</div>
            </div>
            <div style={{ maxHeight: 660, overflowY: 'auto' }}>
              {(refRows).map((r, i) => (
                <Link key={r.id} href={`/mahsul/${r.id}`} className="mjn-r" style={{ display: 'grid', gridTemplateColumns: '2.4fr 1.2fr 1fr 0.9fr', padding: '11px 18px', borderBottom: i < refRows.length - 1 ? '1px solid var(--line)' : 'none', fontSize: 13, alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0, background: r.image ? `center/contain no-repeat url(${r.image}) var(--bg2)` : 'var(--bg2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{!r.image && '🧱'}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span>{r.category}{r.brand ? ` · ${r.brand}` : ''}</span>
                        {r.sellerCount > 0
                          ? <span style={{ color: '#5fd98a' }}>● {fa(r.sellerCount)} فروشنده</span>
                          : <span style={{ color: 'var(--faint)' }}>○ بدون فروشنده</span>}
                      </div>
                    </div>
                  </div>
                  <div><Spark data={r.spark} up={r.changePct >= 0} /></div>
                  <div style={{ fontWeight: 800, color: 'var(--gold)', whiteSpace: 'nowrap' }}>{money(r.price)} <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400 }}>ت/{r.unit}</span></div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: r.changePct >= 0 ? '#5fd98a' : '#f87171' }}>{r.changePct >= 0 ? '▲' : '▼'} {fa(Math.abs(r.changePct))}٪</div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
            <div className="mjn-r" style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr 1fr 1fr 0.9fr', padding: '12px 18px', background: 'var(--bg2)', borderBottom: '1px solid var(--line)', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
              <div>کالا</div><div>کمترین</div><div>میانگین</div><div>بیشترین</div><div>فروشنده</div>
            </div>
            <div style={{ maxHeight: 660, overflowY: 'auto' }}>
              {sellerRows.map((r, i) => (
                <div key={r.name + i} className="mjn-r" style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr 1fr 1fr 0.9fr', padding: '13px 18px', borderBottom: i < sellerRows.length - 1 ? '1px solid var(--line)' : 'none', fontSize: 13, alignItems: 'center' }}>
                  <div><div style={{ fontWeight: 700 }}>{r.name}</div><div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{r.category} · هر {r.unit}</div></div>
                  <div style={{ color: '#5fd98a', fontWeight: 600 }}>{money(r.min)}</div>
                  <div style={{ fontWeight: 800, color: 'var(--gold)' }}>{money(r.avg)}</div>
                  <div style={{ color: '#f0a35f', fontWeight: 600 }}>{money(r.max)}</div>
                  <div style={{ color: 'var(--muted)' }}>{fa(r.sellers)} فروشنده</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 12, textAlign: 'center' }}>
          {tab === 'ref' ? 'نرخِ مرجع بر اساسِ روندِ تاریخیِ قیمتِ تأمین‌کننده (به تومان). روی هر کالا بزنید تا نمودار و فروشندگان را ببینید.' : 'قیمت‌ها به تومان و از قیمتِ اعلامیِ فروشندگان است.'}
        </div>
      </div>
      <Footer />
    </div>
  )
}

// اسپارک‌لاینِ کوچک (روندِ قیمت)
function Spark({ data, up }: { data: number[]; up: boolean }) {
  if (!data || data.length < 2) return <span style={{ color: 'var(--faint)', fontSize: 11 }}>—</span>
  const W = 90, H = 28
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / span) * (H - 4) - 2}`).join(' ')
  const color = up ? '#5fd98a' : '#f87171'
  return <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block' }}><polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" /></svg>
}
