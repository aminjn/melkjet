'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import { readCity } from '../components/CitySelector'

const fa = (n: number | string) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])
const mt = (toman: number) => `${fa(Math.round(toman / 1e6).toLocaleString('en-US'))} م.ت`   // میلیون تومان بر متر

interface Row { district: string; city: string; count: number; avg: number; median: number; min: number; max: number }
interface Overview { totalSaleListings: number; neighbourhoods: number; cityAvg: number; rows: Row[]; analysis?: string | null }

export default function MarketPage() {
  const [city, setCity] = useState('')
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiBusy, setAiBusy] = useState(false)
  const [analysis, setAnalysis] = useState('')

  useEffect(() => { setCity(readCity()); const u = () => setCity(readCity()); window.addEventListener('mj-city-updated', u); return () => window.removeEventListener('mj-city-updated', u) }, [])

  useEffect(() => {
    let dead = false; setLoading(true); setAnalysis('')
    fetch(`/api/market/overview${city ? `?city=${encodeURIComponent(city)}` : ''}`).then(r => r.json()).then(d => { if (!dead && d.ok) setData(d) }).catch(() => {}).finally(() => { if (!dead) setLoading(false) })
    return () => { dead = true }
  }, [city])

  const runAI = async () => {
    setAiBusy(true)
    try { const r = await fetch(`/api/market/overview?ai=1${city ? `&city=${encodeURIComponent(city)}` : ''}`); const d = await r.json(); if (d.ok && d.analysis) setAnalysis(d.analysis) } catch {} finally { setAiBusy(false) }
  }

  const rows = data?.rows || []
  const sortedByPrice = [...rows].sort((a, b) => b.avg - a.avg)
  const maxAvg = rows.reduce((m, r) => Math.max(m, r.avg), 1)
  const priciest = sortedByPrice.slice(0, 3)
  const cheapest = [...sortedByPrice].reverse().filter(r => r.count >= 2).slice(0, 3)

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 18px 70px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gold)', marginBottom: 6 }}>📊 کلان‌داده و پیش‌بینی</div>
            <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>تحلیلِ بازارِ مسکن{city ? ` — ${city}` : ''}</h1>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>میانگینِ قیمتِ هر متر به تفکیکِ محله، از دادهٔ واقعیِ آگهی‌های فروش.</div>
          </div>
          {rows.length > 0 && <button onClick={runAI} disabled={aiBusy} style={{ background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', border: 'none', borderRadius: 12, padding: '12px 20px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>✦ {aiBusy ? 'در حال تحلیل…' : 'تحلیلِ هوش مصنوعی'}</button>}
        </div>

        {loading ? (
          <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '60px 0' }}>در حال محاسبه از دادهٔ واقعی…</div>
        ) : !rows.length ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '50px 20px', textAlign: 'center', color: 'var(--faint)' }}>
            هنوز دادهٔ کافی برای تحلیلِ {city || 'این شهر'} ثبت نشده است.
            <div style={{ marginTop: 14 }}><Link href="/search" style={{ color: 'var(--gold)', textDecoration: 'none' }}>مشاهدهٔ آگهی‌ها →</Link></div>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 22 }}>
              {[
                { v: data!.cityAvg ? `${mt(data!.cityAvg)}/متر` : '—', l: 'میانگینِ قیمتِ هر متر' },
                { v: fa(data!.neighbourhoods.toLocaleString('en-US')), l: 'محله‌های تحلیل‌شده' },
                { v: fa(data!.totalSaleListings.toLocaleString('en-US')), l: 'آگهیِ فروشِ مبنا' },
                { v: priciest[0] ? priciest[0].district : '—', l: 'گران‌ترین محله' },
              ].map((k, i) => (
                <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '18px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 19, fontWeight: 900, color: 'var(--gold)' }}>{k.v}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>{k.l}</div>
                </div>
              ))}
            </div>

            {analysis && (
              <div style={{ background: 'linear-gradient(120deg, rgba(201,169,106,.1), transparent 60%), var(--surface)', border: '1px solid var(--gold)', borderRadius: 16, padding: 18, marginBottom: 22, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--gold)', fontSize: 18, flexShrink: 0 }}>✦</span>
                <div><div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 6 }}>تحلیلِ هوش مصنوعی</div><p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted)', lineHeight: 2, whiteSpace: 'pre-wrap' }}>{analysis}</p></div>
              </div>
            )}

            {/* By-district bars */}
            <section style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 20, marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 16px' }}>قیمتِ هر متر به تفکیکِ محله</h2>
              <div style={{ display: 'grid', gap: 10 }}>
                {sortedByPrice.slice(0, 30).map(r => (
                  <Link key={r.district + r.city} href={`/search?q=${encodeURIComponent(r.district)}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 130, flexShrink: 0, fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.district}>{r.district}</div>
                    <div style={{ flex: 1, height: 22, borderRadius: 6, background: 'var(--bg2)', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(6, (r.avg / maxAvg) * 100)}%`, height: '100%', background: 'linear-gradient(90deg,var(--gold2),var(--gold))', borderRadius: 6 }} />
                    </div>
                    <div style={{ width: 92, flexShrink: 0, textAlign: 'left', fontSize: 12.5, fontWeight: 800, color: 'var(--gold)' }}>{mt(r.avg)}</div>
                    <div style={{ width: 56, flexShrink: 0, textAlign: 'left', fontSize: 11, color: 'var(--faint)' }}>{fa(r.count)} آگهی</div>
                  </Link>
                ))}
              </div>
            </section>

            {/* Priciest / cheapest */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="mk-tc">
              <section style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
                <h3 style={{ fontSize: 14.5, fontWeight: 800, margin: '0 0 12px' }}>گران‌ترین محله‌ها</h3>
                {priciest.map((r, i) => <div key={r.district} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', borderBottom: i < priciest.length - 1 ? '1px solid var(--line)' : 'none' }}><span>{r.district}</span><span style={{ color: 'var(--gold)', fontWeight: 700 }}>{mt(r.avg)}/متر</span></div>)}
              </section>
              <section style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
                <h3 style={{ fontSize: 14.5, fontWeight: 800, margin: '0 0 12px' }}>مقرون‌به‌صرفه‌ترین محله‌ها</h3>
                {cheapest.map((r, i) => <div key={r.district} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', borderBottom: i < cheapest.length - 1 ? '1px solid var(--line)' : 'none' }}><span>{r.district}</span><span style={{ color: '#5fd98a', fontWeight: 700 }}>{mt(r.avg)}/متر</span></div>)}
              </section>
            </div>
            <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 14, textAlign: 'center' }}>ارقام میانگینِ قیمتِ هر متر مربع از آگهی‌های فروشِ ثبت‌شده در سایت است و با افزایشِ داده دقیق‌تر می‌شود.</div>
          </>
        )}
      </main>
      <style>{`@media(max-width:680px){.mk-tc{grid-template-columns:1fr!important}}`}</style>
      <Footer />
    </>
  )
}
