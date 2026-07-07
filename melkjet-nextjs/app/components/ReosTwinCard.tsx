'use client'
import { useEffect, useState } from 'react'

// Property Digital Twin — کارتِ تحلیلِ زندهٔ ملک (REOS v4). از /api/reos/twin می‌خواند.
const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
type Twin = {
  valuation: { estimate: number; low: number; high: number; confidence: number; pricePerM: number }
  demand: number; liquidity: number; daysToSell: number; saleProbability: number
  priceVsMarket: number; rentalYield: number | null
  risk: { score: number; level: string; factors: string[] }; aiConfidence: number; trend: 'up' | 'down' | 'flat'; note: string
}

export default function ReosTwinCard({ propertyId }: { propertyId: string }) {
  const [d, setD] = useState<Twin | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let on = true
    fetch(`/api/reos/twin?propertyId=${encodeURIComponent(propertyId)}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(x => { if (on) { setD(x?.twin || null); setLoading(false) } }).catch(() => { if (on) setLoading(false) })
    return () => { on = false }
  }, [propertyId])
  if (loading || !d) return null

  const riskColor = d.risk.level === 'کم' ? '#34d399' : d.risk.level === 'متوسط' ? '#e7a14a' : '#e74c3c'
  const trendTxt = d.trend === 'up' ? { t: '▲ صعودی', c: '#34d399' } : d.trend === 'down' ? { t: '▼ نزولی', c: '#e74c3c' } : { t: '— ثابت', c: 'var(--faint)' }
  const tile = (label: string, value: string, color = 'var(--text)', sub = '') => (
    <div style={{ background: 'var(--bg2)', borderRadius: 11, padding: '11px 12px' }}>
      <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color }}>{value}</div>
      {sub ? <div style={{ fontSize: 9.5, color: 'var(--faint)', marginTop: 2 }}>{sub}</div> : null}
    </div>
  )

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: 16, padding: 18, fontFamily: FONT, direction: 'rtl' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>✦</span>
        <span style={{ fontSize: 15, fontWeight: 800 }}>پروفایلِ هوشمندِ ملک (Digital Twin)</span>
        <span style={{ marginInlineStart: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--gold)', background: 'var(--bg2)', borderRadius: 999, padding: '3px 10px' }}>اطمینانِ AI {fa(d.aiConfidence)}٪</span>
      </div>

      {d.valuation.estimate > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>ارزشِ برآوردی</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--gold)' }}>{fa(d.valuation.estimate)} <span style={{ fontSize: 12, color: 'var(--muted)' }}>تومان</span></div>
          <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>بازه: {fa(d.valuation.low)} تا {fa(d.valuation.high)} · اطمینان {fa(d.valuation.confidence)}٪</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10 }}>
        {tile('احتمالِ فروش (۴۵ روز)', fa(d.saleProbability) + '٪', d.saleProbability >= 60 ? '#34d399' : d.saleProbability >= 35 ? '#e7a14a' : '#e74c3c')}
        {tile('زمانِ تخمینیِ فروش', fa(d.daysToSell) + ' روز')}
        {tile('نقدشوندگی', fa(d.liquidity) + '/۱۰', '#60a5fa')}
        {tile('نسبت به بازار', (d.priceVsMarket > 0 ? '+' : '') + fa(d.priceVsMarket) + '٪', d.priceVsMarket > 8 ? '#e74c3c' : d.priceVsMarket < -5 ? '#34d399' : 'var(--text)', d.priceVsMarket > 8 ? 'بالاتر از بازار' : d.priceVsMarket < -5 ? 'زیرِ بازار' : 'نزدیکِ بازار')}
        {tile('ریسک', d.risk.level, riskColor, d.risk.factors[0])}
        {tile('روندِ منطقه', trendTxt.t, trendTxt.c)}
        {d.rentalYield != null ? tile('بازده اجاره', fa(d.rentalYield) + '٪', '#60a5fa') : null}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 12 }}>{d.note} · موتورِ REOS از بازدید/تماس و فایل‌های مشابه یاد می‌گیرد.</div>
    </div>
  )
}
