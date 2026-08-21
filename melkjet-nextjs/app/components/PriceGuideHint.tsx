'use client'
import { useEffect, useState } from 'react'

// راهنمای قیمت هنگامِ ثبتِ آگهی — میانه و بازهٔ واقعیِ همان محله/نوع/معامله.
// منبع و تعدادِ نمونه همیشه نشان داده می‌شود تا مشاور بداند عدد از کجا آمده.
type Guide = {
  perM: { median: number; p25: number; p75: number }
  samples: number; basis: string; deal: string
  suggested?: number; suggestedDeposit?: number
}
const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
const M = (n: number) => fa(Math.round((n || 0) / 1e6))
const K = (n: number) => fa(Math.round((n || 0) / 1e3))

export default function PriceGuideHint(
  { city, hood, deal, ptype, area }:
  { city?: string; hood?: string; deal?: string; ptype?: string; area?: number },
) {
  const [g, setG] = useState<Guide | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!deal || !ptype) { setG(null); return }
    let on = true
    setLoading(true)
    const qs = new URLSearchParams({ guide: '1', deal, ptype })
    if (city) qs.set('city', city)
    if (hood) qs.set('hood', hood)
    if (area && area > 0) qs.set('area', String(area))
    const t = setTimeout(() => {
      fetch('/api/reos/area-stats?' + qs.toString())
        .then(r => r.json())
        .then(d => { if (on) { setG(d?.guide || null); setLoading(false) } })
        .catch(() => { if (on) setLoading(false) })
    }, 300)   // تایپ‌کردنِ متراژ نباید به‌ازای هر رقم درخواست بزند
    return () => { on = false; clearTimeout(t) }
  }, [city, hood, deal, ptype, area])

  if (!deal || !ptype) return null
  if (loading && !g) return <div style={{ fontSize: 11.5, color: 'var(--muted)', padding: '8px 0' }}>در حالِ محاسبهٔ قیمتِ محله…</div>
  if (!g) return null

  const rent = g.deal === 'اجاره'
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 14,
      padding: 14, marginTop: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--gold)' }} />
        <span style={{ fontSize: 12.5, fontWeight: 800 }}>قیمتِ واقعیِ این محله</span>
        <span style={{ fontSize: 11, color: 'var(--faint)' }}>{g.basis} · {fa(g.samples)} فایل</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(118px,1fr))', gap: 9 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>
            {rent ? `${K(g.perM.median)} هزار/متر` : `${M(g.perM.median)} م/متر`}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>میانهٔ محله</div>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            {rent ? `${K(g.perM.p25)}–${K(g.perM.p75)}` : `${M(g.perM.p25)}–${M(g.perM.p75)}`}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>بازهٔ متعارف</div>
        </div>
        {g.suggested ? (
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>
              {rent ? `${K(g.suggested)} هزار` : `${M(g.suggested)} م`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
              {rent ? 'اجارهٔ مؤثرِ این متراژ' : 'قیمتِ متناسبِ این متراژ'}
            </div>
            {rent && g.suggestedDeposit ? (
              <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 2 }}>ودیعهٔ رایج {M(g.suggestedDeposit)}م</div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 10, lineHeight: 1.8 }}>
        پیشنهاد است نه الزام — از قیمتِ فایل‌های واقعیِ همین محله حساب شده.
      </div>
    </div>
  )
}
