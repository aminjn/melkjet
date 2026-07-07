'use client'
import { useEffect, useState } from 'react'

// هوشِ بازار (REOS Market Intelligence): سالم‌ترین مناطق با شاخصِ تقاضا/عرضه/نقدشوندگی/روند.
const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
type Area = { area: string; demandIndex: number; supplyIndex: number; liquidityIndex: number; competition: number; trend: 'up' | 'down' | 'flat'; healthScore: number; listings: number }
const trendIcon = (t: string) => t === 'up' ? '📈' : t === 'down' ? '📉' : '➡️'
const bar = (v: number, c: string) => <div style={{ height: 5, background: 'var(--bg2)', borderRadius: 99, overflow: 'hidden' }}><div style={{ width: `${Math.round(v * 100)}%`, height: 5, background: c, borderRadius: 99 }} /></div>

export default function ReosMarketIntel({ title = 'هوشِ بازار (REOS)' }: { title?: string }) {
  const [areas, setAreas] = useState<Area[] | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let on = true
    fetch('/api/reos/market-intel', { cache: 'no-store' }).then(r => r.ok ? r.json() : null)
      .then(d => { if (on) { setAreas(d?.areas || []); setLoading(false) } }).catch(() => { if (on) setLoading(false) })
    return () => { on = false }
  }, [])

  if (loading) return null
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18, fontFamily: FONT, direction: 'rtl' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>🌆</span><span style={{ fontSize: 15, fontWeight: 800 }}>{title}</span>
        <span style={{ fontSize: 11, color: 'var(--faint)' }}>سالم‌ترین مناطق</span>
      </div>
      {!areas || !areas.length ? (
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>هنوز داده‌ای نیست — با انباشتِ آگهی/تعامل هر ۶ ساعت خودکار محاسبه می‌شود.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 0.6fr 0.5fr', gap: 8, fontSize: 10.5, color: 'var(--faint)', padding: '0 4px 4px' }}>
            <span>منطقه</span><span>تقاضا</span><span>نقدشوندگی</span><span>سلامت</span><span>روند</span>
          </div>
          {areas.slice(0, 10).map(a => (
            <div key={a.area} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 0.6fr 0.5fr', gap: 8, alignItems: 'center', padding: '8px 4px', borderTop: '1px solid var(--line)' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.area.replace('|', ' · ')}</span>
              <span title={fa(Math.round(a.demandIndex * 100)) + '٪'}>{bar(a.demandIndex, '#e7a14a')}</span>
              <span title={fa(Math.round(a.liquidityIndex * 100)) + '٪'}>{bar(a.liquidityIndex, '#60a5fa')}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: a.healthScore >= 60 ? '#34d399' : a.healthScore >= 40 ? '#e7a14a' : '#e74c3c' }}>{fa(a.healthScore)}</span>
              <span style={{ fontSize: 14 }}>{trendIcon(a.trend)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
