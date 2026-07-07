'use client'
import { useState } from 'react'

// ابزارِ تحلیلِ سرمایه‌گذاری/ساخت (REOS Investor OS). به /api/reos/investor وصل است.
const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => Math.round(n || 0).toLocaleString('fa-IR')

export default function ReosInvestorTool({ defaultMode = 'investment' }: { defaultMode?: 'investment' | 'construction' }) {
  const [mode, setMode] = useState<'investment' | 'construction'>(defaultMode)
  const [f, setF] = useState<Record<string, string>>({})
  const [res, setRes] = useState<Record<string, unknown> | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string) => setF(s => ({ ...s, [k]: v }))

  const run = async () => {
    setBusy(true); setRes(null)
    const body: Record<string, unknown> = { mode }
    for (const k in f) body[k] = Number(f[k].replace(/[^\d.]/g, '')) || 0
    try { const r = await fetch('/api/reos/investor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const d = await r.json(); setRes(d.result || null) } catch { setRes(null) }
    setBusy(false)
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontFamily: FONT, fontSize: 12.5 }
  const label = (t: string) => <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 4 }}>{t}</div>
  const field = (k: string, t: string, ph = '') => <div>{label(t)}<input value={f[k] || ''} onChange={e => set(k, e.target.value)} placeholder={ph} inputMode="numeric" style={inputStyle} /></div>
  const stat = (t: string, v: string, c = 'var(--gold)') => <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px' }}><div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{t}</div><div style={{ fontSize: 16, fontWeight: 800, color: c }}>{v}</div></div>

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18, fontFamily: FONT, direction: 'rtl' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>💰</span><span style={{ fontSize: 15, fontWeight: 800 }}>تحلیلِ سرمایه‌گذاریِ REOS</span>
        <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 6 }}>
          {(['investment', 'construction'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setRes(null) }} style={{ fontSize: 11.5, padding: '5px 11px', borderRadius: 999, border: '1px solid var(--line2)', background: mode === m ? 'var(--goldDim)' : 'transparent', color: mode === m ? 'var(--gold)' : 'var(--muted)', cursor: 'pointer', fontFamily: FONT, fontWeight: 700 }}>{m === 'investment' ? 'خرید/اجاره' : 'ساخت‌وساز'}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 12 }}>
        {mode === 'investment' ? <>
          {field('price', 'قیمتِ ملک (تومان)', 'مثلاً ۱۰۰۰۰۰۰۰۰۰۰')}
          {field('monthlyRent', 'اجارهٔ ماهانه')}
          {field('downPayment', 'آورده (پیش‌فرض: کل)')}
          {field('holdYears', 'سال‌های نگه‌داری', '۵')}
          {field('annualAppreciation', 'رشدِ سالانه (۰.۲=۲۰٪)', '۰.۲')}
        </> : <>
          {field('landCost', 'هزینهٔ زمین (تومان)')}
          {field('buildCostPerM', 'هزینهٔ ساختِ هر متر')}
          {field('totalArea', 'متراژِ کل')}
          {field('sellPricePerM', 'قیمتِ فروشِ هر متر')}
          {field('months', 'مدتِ ساخت (ماه)', '۲۴')}
        </>}
      </div>
      <button onClick={run} disabled={busy} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, cursor: busy ? 'default' : 'pointer', fontFamily: FONT }}>{busy ? 'در حال محاسبه…' : 'تحلیل کن'}</button>

      {res && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10, marginTop: 14 }}>
          {mode === 'investment' ? <>
            {stat('بازده (ROI)', fa(res.roi as number) + '٪')}
            {stat('IRR', res.irr != null ? fa(res.irr as number) + '٪' : '—')}
            {stat('بازده اجاره', fa(res.rentalYield as number) + '٪', '#60a5fa')}
            {stat('بازگشتِ سرمایه', (res.paybackYears as number) > 0 ? fa(res.paybackYears as number) + ' سال' : '—', '#34d399')}
            {stat('جریانِ ماهانه', fa(res.monthlyCashflow as number), (res.monthlyCashflow as number) >= 0 ? '#34d399' : '#e74c3c')}
          </> : <>
            {stat('سود', fa(res.profit as number))}
            {stat('حاشیهٔ سود', fa(res.margin as number) + '٪')}
            {stat('بازده کل', fa(res.yieldPct as number) + '٪', '#60a5fa')}
            {stat('بازده سالانه', fa(res.annualizedReturn as number) + '٪', '#34d399')}
            {stat('ریسک', String(res.riskLabel || ''), (res.risk as number) < 35 ? '#34d399' : (res.risk as number) < 60 ? '#e7a14a' : '#e74c3c')}
          </>}
        </div>
      )}
      {res && (res.note as string) && <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 10 }}>{res.note as string}</div>}
    </div>
  )
}
