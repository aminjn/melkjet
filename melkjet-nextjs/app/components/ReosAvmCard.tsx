'use client'
import { useEffect, useState } from 'react'

// کارتِ ارزش‌گذاریِ هوشمند (AVM) روی صفحهٔ ملک. از /api/reos/avm می‌خواند؛ اگر واردنشده/بی‌داده بود، چیزی نشان نمی‌دهد.
const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
type Avm = { estimate: number; low: number; high: number; confidence: number; pricePerM: number; comps: number; method: string; note: string }

export default function ReosAvmCard({ propertyId }: { propertyId: string }) {
  const [d, setD] = useState<Avm | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let on = true
    fetch(`/api/reos/avm?propertyId=${encodeURIComponent(propertyId)}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(x => { if (on) { setD(x?.avm || null); setLoading(false) } })
      .catch(() => { if (on) setLoading(false) })
    return () => { on = false }
  }, [propertyId])

  if (loading || !d || d.method === 'insufficient' || d.method === 'none' || !d.estimate) return null
  const conf = d.confidence
  const confColor = conf >= 60 ? '#34d399' : conf >= 30 ? '#e7a14a' : '#e74c3c'
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: 16, padding: 18, fontFamily: FONT, direction: 'rtl' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>✦</span>
        <span style={{ fontSize: 15, fontWeight: 800 }}>ارزش‌گذاریِ هوشمند (AVM)</span>
        <span style={{ marginInlineStart: 'auto', fontSize: 11, fontWeight: 700, color: confColor, background: 'var(--bg2)', borderRadius: 999, padding: '3px 10px' }}>اطمینان {fa(conf)}٪</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--gold)', marginBottom: 4 }}>{fa(d.estimate)} <span style={{ fontSize: 13, color: 'var(--muted)' }}>تومان</span></div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>بازهٔ منصفانه: {fa(d.low)} تا {fa(d.high)}</div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)' }}>
        <span>قیمتِ هر متر: <b style={{ color: 'var(--text)' }}>{fa(d.pricePerM)}</b></span>
        <span>فایلِ مشابه: <b style={{ color: 'var(--text)' }}>{fa(d.comps)}</b></span>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 10 }}>{d.note} · بر پایهٔ موتورِ REOS</div>
    </div>
  )
}
