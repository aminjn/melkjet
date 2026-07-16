'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import { readCity, writeCity } from '../components/CitySelector'

// ─── فاز ۱۵۳ — تحلیل بازار مسکن (طرحِ تیره/طلایی، به‌ازای هر شهر) ────────────
// قانونِ نشکن: هر عددِ صفحه از API واقعی می‌آید؛ کارتِ بدونِ داده اصلاً رندر نمی‌شود.

const fa = (n: number) => n.toLocaleString('fa-IR')
const mln = (toman: number) => `${Math.round(toman / 1e6).toLocaleString('fa-IR')} م`      // میلیون تومان بر متر
const pct = (g: number) => `${g > 0 ? '+' : g < 0 ? '−' : ''}${(Math.round(Math.abs(g) * 10) / 10).toLocaleString('fa-IR')}٪`
const GREEN = '#5fd98a', RED = '#f87171'
const gColor = (g: number) => (g > 0 ? GREEN : g < 0 ? RED : 'var(--muted)')
const faMonth = (key: string) => {   // 'YYYY-M' میلادی → نامِ ماهِ شمسیِ همان تاریخ
  const [y, m] = key.split('-').map(Number)
  if (!y || !m) return key
  try { return new Intl.DateTimeFormat('fa-IR', { month: 'short' }).format(new Date(y, m - 1, 15)) } catch { return key }
}

interface Row { district: string; city: string; count: number; avg: number; median: number; min: number; max: number; growthPct: number | null }
interface Sold { total: number; last30: number; avgDays: number | null }
interface Overview { ok?: boolean; totalSaleListings: number; neighbourhoods: number; cityAvg: number; rows: Row[]; sold: Sold | null; analysis?: string | null }
interface Trend { month: string; avg: number }
interface DStats { count: number; avg: number; median: number; min: number; max: number; trend: Trend[] }
interface Forecast {
  points: { label: string; value: number; kind: 'real' | 'estimate' | 'current' | 'forecast' }[]
  currentAvg: number; monthlyGrowthPct: number; yearGrowthPct: number
  method: string; confidence: 'high' | 'medium' | 'low'; samples: number; forecastNext: number
}
const CONF_FA: Record<Forecast['confidence'], string> = { high: 'بالا', medium: 'متوسط', low: 'کم' }
const RISK_FA: Record<Forecast['confidence'], string> = { high: 'کم', medium: 'متوسط', low: 'زیاد' }

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }

export default function MarketPage() {
  const [city, setCity] = useState('')
  const [data, setData] = useState<Overview | null>(null)
  const [allRows, setAllRows] = useState<Row[]>([])            // فقط برای فهرستِ شهرهای <select>
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState('')
  const [dStats, setDStats] = useState<DStats | null>(null)
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [dLoading, setDLoading] = useState(false)
  const [q, setQ] = useState('')
  const [aiOpen, setAiOpen] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [analysis, setAnalysis] = useState('')

  useEffect(() => { setCity(readCity()); const u = () => setCity(readCity()); window.addEventListener('mj-city-updated', u); return () => window.removeEventListener('mj-city-updated', u) }, [])

  // فهرستِ شهرها (یک‌بار، از کلِ داده) — فقط برای پر کردنِ <select>
  useEffect(() => {
    let dead = false
    fetch('/api/market/overview').then(r => r.json()).then(d => { if (!dead && d.ok) setAllRows(d.rows || []) }).catch(() => {})
    return () => { dead = true }
  }, [])

  // نمای کلیِ شهرِ انتخاب‌شده
  useEffect(() => {
    let dead = false; setLoading(true); setAnalysis(''); setAiOpen(false)
    fetch(`/api/market/overview${city ? `?city=${encodeURIComponent(city)}` : ''}`)
      .then(r => r.json())
      .then(d => { if (!dead && d.ok) { setData(d); setSelected((d.rows || [])[0]?.district || '') } })
      .catch(() => {})
      .finally(() => { if (!dead) setLoading(false) })
    return () => { dead = true }
  }, [city])

  const rows: Row[] = data?.rows || []
  const top30 = useMemo(() => [...rows].sort((a, b) => b.count - a.count).slice(0, 30), [rows])
  const listRows = useMemo(() => top30.filter(r => !q.trim() || r.district.includes(q.trim())), [top30, q])
  const selRow = rows.find(r => r.district === selected) || null
  const cities = useMemo(() => {
    const set = new Set(allRows.map(r => r.city).filter(c => c && c !== '—'))
    if (city) set.add(city)
    return Array.from(set)
  }, [allRows, city])

  // آمار + پیش‌بینیِ محلهٔ انتخاب‌شده (شهرِ خودِ رکورد برای تطبیقِ دقیق)
  useEffect(() => {
    if (!selected) { setDStats(null); setForecast(null); return }
    let dead = false; setDLoading(true); setDStats(null); setForecast(null)
    const qCity = selRow && selRow.city && selRow.city !== '—' ? selRow.city : city
    const qs = `city=${encodeURIComponent(qCity)}&district=${encodeURIComponent(selected)}`
    Promise.all([
      fetch(`/api/market/stats?${qs}`).then(r => r.json()).catch(() => null),
      fetch(`/api/market/forecast?${qs}`).then(r => r.json()).catch(() => null),
    ]).then(([s, f]) => {
      if (dead) return
      setDStats(s && s.stats ? s.stats : null)
      setForecast(f && f.ok && f.forecast ? f.forecast : null)
    }).finally(() => { if (!dead) setDLoading(false) })
    return () => { dead = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, city])

  const runAI = async () => {
    setAiBusy(true)
    try { const r = await fetch(`/api/market/overview?ai=1${city ? `&city=${encodeURIComponent(city)}` : ''}`); const d = await r.json(); if (d.ok && d.analysis) setAnalysis(d.analysis) } catch {} finally { setAiBusy(false) }
  }
  const toggleAI = () => { const next = !aiOpen; setAiOpen(next); if (next && !analysis && !aiBusy) runAI() }

  // ─── مقایسه با محلاتِ همرده: ۴ محلهٔ نزدیک‌ترین میانگین ───
  const peers = useMemo(() => {
    if (!selRow) return []
    return rows.filter(r => r.district !== selRow.district).sort((a, b) => Math.abs(a.avg - selRow.avg) - Math.abs(b.avg - selRow.avg)).slice(0, 4)
  }, [rows, selRow])
  const peerMax = Math.max(selRow?.avg || 0, ...peers.map(p => p.avg), 1)

  const trend = dStats?.trend || []
  const trendMax = trend.reduce((m, t) => Math.max(m, t.avg), 1)
  const latest = trend.length ? trend[trend.length - 1] : null

  // ─── گزارشِ چاپیِ PDF (همان آمارِ واقعی، RTL) ───
  const printReport = () => {
    if (!dStats || !selected) return
    const w = window.open('', '_blank', 'width=800,height=1000'); if (!w) { alert('اجازهٔ باز شدنِ پنجرهٔ چاپ داده نشد.'); return }
    const td = 'padding:6px;border:1px solid #ddd'
    const t = (toman: number) => `${toman.toLocaleString('fa-IR')} تومان`
    const statRows = [
      ['تعداد آگهیِ فعالِ مبنا', fa(dStats.count)],
      ['میانگینِ قیمتِ هر متر', t(dStats.avg)],
      ['میانهٔ قیمتِ هر متر', t(dStats.median)],
      ['کمینهٔ قیمتِ هر متر', t(dStats.min)],
      ['بیشینهٔ قیمتِ هر متر', t(dStats.max)],
      ...(selRow && selRow.growthPct !== null ? [['تغییرِ مشاهده‌شده در بازهٔ ثبتِ داده', pct(selRow.growthPct)]] : []),
      ...(data?.sold ? [['معامله‌های ثبت‌شده' + (city ? ` در ${city}` : ' در کلِ بازار'), `${fa(data.sold.total)} (۳۰ روز اخیر: ${fa(data.sold.last30)})`]] : []),
      ...(data?.sold?.avgDays !== null && data?.sold?.avgDays !== undefined ? [['میانگینِ زمانِ فروش', `${fa(data.sold.avgDays)} روز`]] : []),
    ]
    const trendRows = trend.map(x => `<tr><td style="${td}">${faMonth(x.month)}</td><td style="${td}">${t(x.avg)}</td></tr>`).join('')
    w.document.write(`<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>گزارشِ بازارِ ${selected}</title>
      <style>@page{margin:2cm} body{font-family:Vazirmatn,Tahoma,sans-serif;line-height:1.9;color:#111;font-size:14px}</style></head>
      <body>
      <h2 style="text-align:center;margin:0 0 4px">گزارشِ بازارِ مسکن — ${selected}${city ? ` (${city})` : ''}</h2>
      <div style="text-align:center;color:#666;font-size:12px;margin-bottom:16px">تاریخ: ${new Date().toLocaleDateString('fa-IR')} · بر پایهٔ آگهی‌های واقعیِ ثبت‌شده در ملک‌جت</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        ${statRows.map(r => `<tr><td style="${td};width:45%"><b>${r[0]}</b></td><td style="${td}">${r[1]}</td></tr>`).join('')}
      </table>
      ${trend.length >= 2 ? `<h3 style="margin:18px 0 6px">روندِ ماهانهٔ میانگینِ قیمتِ هر متر</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <tr style="background:#f4f4f4"><th style="${td}">ماه</th><th style="${td}">میانگینِ هر متر</th></tr>${trendRows}
      </table>` : ''}
      ${forecast && forecast.samples >= 3 ? `<h3 style="margin:18px 0 6px">برآوردِ روند (مدلِ رگرسیونی)</h3>
      <div style="font-size:13px">بر پایهٔ ${forecast.method}، روندِ ماهانه حدودِ ${pct(forecast.monthlyGrowthPct)} و روندِ سالانه حدودِ ${pct(forecast.yearGrowthPct)} برآورد می‌شود (اطمینانِ مدل: ${CONF_FA[forecast.confidence]}).</div>` : ''}
      <div style="margin-top:30px;font-size:11px;color:#888;border-top:1px dashed #ccc;padding-top:8px">ارقام از آگهی‌های فروشِ ثبت‌شده محاسبه شده و با افزایشِ داده دقیق‌تر می‌شود. تولیدشده با سامانهٔ ملک‌جت.</div>
      </body></html>`)
    w.document.close(); w.focus(); setTimeout(() => w.print(), 350)
  }

  const citySelect = (
    <select value={city} onChange={e => writeCity(e.target.value)} style={{ background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
      <option value="">همهٔ شهرها</option>
      {cities.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  )

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 18px 70px' }}>

        {/* ─── سربرگ ─── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 14, marginBottom: 24 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 999, padding: '5px 12px', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>
              <span style={{ color: GREEN, fontSize: 9 }}>●</span> دادهٔ زنده
            </div>
            <h1 style={{ fontSize: 27, fontWeight: 900, margin: 0 }}>تحلیل بازار مسکن{city ? ` — ${city}` : ''}</h1>
            <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 8 }}>
              دادهٔ زندهٔ قیمت، روند و پیش‌بینی برای هر محله{data ? <> — بر پایهٔ <b style={{ color: 'var(--gold)' }}>{fa(data.totalSaleListings)}</b> آگهیِ فعال</> : null}
            </div>
          </div>
          {citySelect}
        </div>

        {loading ? (
          <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '70px 0' }}>در حال محاسبه از دادهٔ واقعی…</div>
        ) : !rows.length ? (
          <div style={{ ...card, padding: '54px 20px', textAlign: 'center', color: 'var(--faint)' }}>
            برای {city || 'این شهر'} هنوز دادهٔ کافی ثبت نشده.
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {citySelect}
              <Link href="/search" style={{ color: 'var(--gold)', textDecoration: 'none', fontSize: 13 }}>مشاهدهٔ آگهی‌ها →</Link>
            </div>
          </div>
        ) : (
          <div className="mjmkt-grid" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 18, alignItems: 'start' }}>

            {/* ─── سایدبار (راست در RTL): فهرستِ محلات ─── */}
            <aside className="mjmkt-side" style={{ ...card, padding: 14, position: 'sticky', top: 86, maxHeight: 'calc(100vh - 110px)', overflowY: 'auto' }}>
              <div style={{ fontSize: 14, fontWeight: 800, margin: '4px 4px 10px' }}>محلات {city || 'بازار'}</div>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="جستجوی محله…" style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', marginBottom: 10 }} />
              <div style={{ display: 'grid', gap: 4 }}>
                {listRows.map(r => {
                  const sel = r.district === selected
                  return (
                    <button key={r.district + r.city} onClick={() => setSelected(r.district)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, width: '100%', textAlign: 'right', background: sel ? 'var(--goldDim, rgba(201,169,106,.12))' : 'transparent', border: sel ? '1px solid var(--gold)' : '1px solid transparent', borderRadius: 10, padding: '9px 11px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)' }}>
                      <span style={{ fontSize: 12.5, fontWeight: sel ? 800 : 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.district}</span>
                      {r.growthPct !== null
                        ? <span style={{ fontSize: 11.5, fontWeight: 800, color: gColor(r.growthPct), flexShrink: 0 }}>{pct(r.growthPct)}</span>
                        : <span style={{ fontSize: 11, color: 'var(--faint)', flexShrink: 0 }}>{fa(r.count)} آگهی</span>}
                    </button>
                  )
                })}
                {!listRows.length && <div style={{ fontSize: 12, color: 'var(--faint)', padding: '14px 4px', textAlign: 'center' }}>محله‌ای با این نام پیدا نشد.</div>}
              </div>
            </aside>

            {/* ─── ستونِ اصلی ─── */}
            <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>

              {/* عنوانِ محله + KPI ها (فقط کارت‌های دارای داده) */}
              <div>
                <h2 style={{ fontSize: 19, fontWeight: 900, margin: '2px 0 12px' }}>{selected || '—'}{selRow && selRow.city && selRow.city !== '—' ? <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}> · {selRow.city}</span> : null}</h2>
                {dLoading ? (
                  <div style={{ ...card, color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '26px 16px' }}>در حال دریافتِ آمارِ محله…</div>
                ) : (
                  <div className="mjmkt-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
                    {dStats && dStats.avg > 0 && (
                      <div style={{ ...card, padding: '16px 14px' }}>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>میانگین هر متر</div>
                        <div style={{ fontSize: 21, fontWeight: 900, color: 'var(--gold)', marginTop: 6 }}>{mln(dStats.avg)}</div>
                        {selRow && selRow.growthPct !== null && <div style={{ fontSize: 11, fontWeight: 700, color: gColor(selRow.growthPct), marginTop: 6 }}>{pct(selRow.growthPct)} در بازهٔ ثبت‌شده</div>}
                      </div>
                    )}
                    {dStats && dStats.count > 0 && (
                      <div style={{ ...card, padding: '16px 14px' }}>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>آگهی فعال</div>
                        <div style={{ fontSize: 21, fontWeight: 900, marginTop: 6 }}>{fa(dStats.count)}</div>
                        <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 6 }}>آگهیِ فروشِ مبنای محاسبه</div>
                      </div>
                    )}
                    {data?.sold && (
                      <div style={{ ...card, padding: '16px 14px' }}>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>معاملهٔ ثبت‌شده</div>
                        <div style={{ fontSize: 21, fontWeight: 900, marginTop: 6 }}>{fa(data.sold.total)}</div>
                        <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 6 }}>۳۰ روز اخیر: {fa(data.sold.last30)} · {city ? `در ${city}` : 'کلِ بازار'}</div>
                      </div>
                    )}
                    {data?.sold && data.sold.avgDays !== null && (
                      <div style={{ ...card, padding: '16px 14px' }}>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>میانگین زمان فروش</div>
                        <div style={{ fontSize: 21, fontWeight: 900, marginTop: 6 }}>{fa(data.sold.avgDays)} روز</div>
                        <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 6 }}>{city ? `در ${city}` : 'کلِ بازار'}</div>
                      </div>
                    )}
                    {!dStats && <div style={{ ...card, color: 'var(--faint)', fontSize: 12.5, textAlign: 'center', padding: '24px 14px' }}>برای این محله هنوز آمارِ کافی ثبت نشده.</div>}
                  </div>
                )}
              </div>

              {/* روندِ قیمت (فقط با ≥۲ ماه دادهٔ واقعی) */}
              {trend.length >= 2 && latest && (
                <section style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>روند قیمت</h3>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--gold)' }}>{mln(latest.avg)}</span>
                      {selRow && selRow.growthPct !== null && <span style={{ fontSize: 12, fontWeight: 800, color: gColor(selRow.growthPct) }}>{pct(selRow.growthPct)}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 16 }}>میانگینِ قیمتِ آگهی‌های ثبت‌شده در هر ماه (میلیون تومان بر متر) — بازهٔ دادهٔ موجود</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 168 }}>
                    {trend.map((t, i) => {
                      const last = i === trend.length - 1
                      const h = Math.max(8, Math.round((t.avg / trendMax) * 118))
                      return (
                        <div key={t.month} title={`${faMonth(t.month)} — ${mln(t.avg)}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: last ? 'var(--gold)' : 'var(--faint)' }}>{fa(Math.round(t.avg / 1e6))}</div>
                          <div style={{ width: '100%', maxWidth: 38, height: h, borderRadius: '7px 7px 3px 3px', background: last ? 'linear-gradient(180deg,var(--gold2),var(--gold))' : 'var(--line2)', opacity: last ? 1 : 0.55 }} />
                          <div style={{ fontSize: 10, color: last ? 'var(--gold)' : 'var(--muted)', whiteSpace: 'nowrap' }}>{faMonth(t.month)}</div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* پیش‌بینی (فقط وقتی مدل روی دادهٔ واقعی رگرسیون زده — نه تخمینِ پیش‌فرض) */}
              {forecast && forecast.samples >= 3 && (
                <section style={{ ...card, border: '1px solid var(--gold)', background: 'linear-gradient(120deg, rgba(201,169,106,.09), transparent 55%), var(--surface)' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
                    <span style={{ color: 'var(--gold)', fontSize: 17 }}>✦</span>
                    <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>پیش‌بینی</h3>
                  </div>
                  <div className="mjmkt-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 14 }}>
                    <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '13px 14px' }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>برآوردِ روندِ سالانه</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: gColor(forecast.yearGrowthPct), marginTop: 5 }}>{pct(forecast.yearGrowthPct)}</div>
                    </div>
                    <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '13px 14px' }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>روندِ ماهانه</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: gColor(forecast.monthlyGrowthPct), marginTop: 5 }}>{pct(forecast.monthlyGrowthPct)}</div>
                    </div>
                    <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '13px 14px' }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>اطمینان مدل</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--gold)', marginTop: 5 }}>{CONF_FA[forecast.confidence]}</div>
                    </div>
                    <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '13px 14px' }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>عدمِ قطعیتِ مدل</div>
                      <div style={{ fontSize: 18, fontWeight: 900, marginTop: 5 }}>{RISK_FA[forecast.confidence]}</div>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', lineHeight: 2 }}>
                    بر پایهٔ {forecast.method}، روندِ ماهانه حدودِ {pct(forecast.monthlyGrowthPct)} و روندِ سالانه حدودِ {pct(forecast.yearGrowthPct)} برآورد می‌شود.
                  </p>
                </section>
              )}

              {/* مقایسه با محلاتِ همرده */}
              {selRow && peers.length > 0 && (
                <section style={card}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 14px' }}>مقایسه با محلات همرده</h3>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {[selRow, ...peers].map((p, idx) => (
                      <div key={p.district + p.city} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 120, flexShrink: 0, fontSize: 12.5, fontWeight: idx === 0 ? 900 : 700, color: idx === 0 ? 'var(--gold)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.district}>{p.district}</div>
                        <div style={{ flex: 1, height: 8, borderRadius: 5, background: 'var(--bg2)', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(5, Math.round((p.avg / peerMax) * 100))}%`, height: '100%', borderRadius: 5, background: idx === 0 ? 'linear-gradient(90deg,var(--gold2),var(--gold))' : 'var(--line2)' }} />
                        </div>
                        <div style={{ width: 62, flexShrink: 0, textAlign: 'left', fontSize: 12.5, fontWeight: 800, color: idx === 0 ? 'var(--gold)' : 'var(--text)' }}>{mln(p.avg)}</div>
                        <div style={{ width: 58, flexShrink: 0, textAlign: 'left' }}>
                          {p.growthPct !== null && <span style={{ fontSize: 10.5, fontWeight: 800, color: gColor(p.growthPct), background: 'var(--bg2)', borderRadius: 999, padding: '3px 8px' }}>{pct(p.growthPct)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* CTA */}
              {selected && (
                <div className="mjmkt-cta" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Link href={`/search?${city ? `city=${encodeURIComponent(city)}&` : ''}q=${encodeURIComponent(selected)}`} style={{ flex: '1 1 220px', textAlign: 'center', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', borderRadius: 12, padding: '13px 20px', fontSize: 14, fontWeight: 800, textDecoration: 'none' }}>مشاهده املاک این محله</Link>
                  {dStats && <button onClick={printReport} style={{ flex: '1 1 220px', background: 'transparent', color: 'var(--text)', border: '1px solid var(--line2)', borderRadius: 12, padding: '13px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>دریافت گزارش کامل PDF</button>}
                </div>
              )}

              {/* تحلیلِ ملک‌جت (AI) — بازشونده */}
              <section style={{ ...card, padding: 0, overflow: 'hidden' }}>
                <button onClick={toggleAI} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'transparent', border: 'none', padding: '15px 18px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)' }}>
                  <span style={{ fontSize: 14, fontWeight: 800 }}><span style={{ color: 'var(--gold)' }}>✦</span> تحلیل ملک‌جت</span>
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>{aiOpen ? '▴' : '▾'}</span>
                </button>
                {aiOpen && (
                  <div style={{ padding: '0 18px 18px' }}>
                    {aiBusy ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>در حال تحلیل از دادهٔ واقعی…</div>
                      : analysis ? <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted)', lineHeight: 2, whiteSpace: 'pre-wrap' }}>{analysis}</p>
                        : <div style={{ fontSize: 13, color: 'var(--faint)' }}>تحلیل در دسترس نیست. <button onClick={runAI} style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, padding: 0 }}>تلاشِ دوباره</button></div>}
                  </div>
                )}
              </section>

              <div style={{ fontSize: 11, color: 'var(--faint)', textAlign: 'center' }}>ارقام از آگهی‌های فروشِ ثبت‌شده در سایت محاسبه می‌شود و با افزایشِ داده دقیق‌تر می‌شود.</div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
