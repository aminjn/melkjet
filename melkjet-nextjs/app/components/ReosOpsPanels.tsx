'use client'
import { useEffect, useState } from 'react'

// پنل‌های observabilityِ REOS برای ادمین: آزمایش‌های A/B، Attribution، و نقشهٔ حرارتی.
const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18, marginTop: 16, fontFamily: FONT, direction: 'rtl' }

// ── A/B Testing ──
type VarRes = { variant: string; exposures: number; conversions: number; conversionRate: number }
type Exp = { id: string; name: string; variants: string[]; results: { variants: VarRes[]; winner: string | null; lift: number } }
export function ReosExperimentsAdmin() {
  const [exps, setExps] = useState<Exp[]>([])
  const [name, setName] = useState(''); const [vars, setVars] = useState('A,B')
  const load = () => fetch('/api/reos/experiment', { cache: 'no-store' }).then(r => r.ok ? r.json() : { experiments: [] }).then(d => setExps(d.experiments || [])).catch(() => {})
  useEffect(() => { load() }, [])
  const create = async () => { await fetch('/api/reos/experiment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', name: name || 'آزمایش', variants: vars.split(',').map(s => s.trim()).filter(Boolean) }) }); setName(''); load() }
  return (
    <div style={card}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>آزمایش‌های A/B (Experiment Platform)</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="نامِ آزمایش" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontFamily: FONT, fontSize: 12 }} />
        <input value={vars} onChange={e => setVars(e.target.value)} placeholder="واریانت‌ها (A,B)" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontFamily: FONT, fontSize: 12, width: 130 }} />
        <button onClick={create} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--goldDim)', color: 'var(--gold)', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>+ ساخت</button>
      </div>
      {exps.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>آزمایشی نیست.</div> :
        exps.map(e => (
          <div key={e.id} style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 13, fontWeight: 700 }}>{e.name}</span>{e.results.winner && <span style={{ fontSize: 11, color: '#34d399', fontWeight: 700 }}>برنده: {e.results.winner} (+{fa(e.results.lift)}٪)</span>}</div>
            <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>{e.results.variants.map(v => <span key={v.variant} style={{ fontSize: 11.5, color: 'var(--muted)' }}>{v.variant}: {fa(v.conversionRate)}٪ <span style={{ color: 'var(--faint)' }}>({fa(v.conversions)}/{fa(v.exposures)})</span></span>)}</div>
          </div>
        ))}
    </div>
  )
}

// ── Attribution ──
type Ch = { channel: string; touches: number; conversions: number; spend: number; revenue: number; cac: number; roas: number; ltv: number }
export function ReosAttributionAdmin() {
  const [ch, setCh] = useState<Ch[]>([])
  useEffect(() => { fetch('/api/reos/attribution', { cache: 'no-store' }).then(r => r.ok ? r.json() : { channels: [] }).then(d => setCh(d.channels || [])).catch(() => {}) }, [])
  return (
    <div style={card}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Attribution — CAC / ROAS به‌تفکیکِ کانال</div>
      {ch.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>هنوز داده‌ای نیست.</div> : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 0.8fr', gap: 8, fontSize: 10.5, color: 'var(--faint)', paddingBottom: 6 }}><span>کانال</span><span>هزینه</span><span>درآمد</span><span>CAC</span><span>ROAS</span></div>
          {ch.map(c => (
            <div key={c.channel} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 0.8fr', gap: 8, alignItems: 'center', padding: '7px 0', borderTop: '1px solid var(--line)', fontSize: 12 }}>
              <span style={{ fontWeight: 700 }}>{c.channel}</span><span>{fa(c.spend)}</span><span style={{ color: '#34d399' }}>{fa(c.revenue)}</span><span>{fa(c.cac)}</span><span style={{ fontWeight: 800, color: c.roas >= 1 ? '#34d399' : '#e74c3c' }}>{c.roas.toLocaleString('fa-IR')}×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Geo heatmap (فهرستِ داغ‌ترین سلول‌ها) ──
type Cell = { lat: number; lng: number; count: number; avgPrice: number; intensity: number }
export function ReosGeoHeat() {
  const [cells, setCells] = useState<Cell[]>([])
  useEffect(() => { fetch('/api/reos/geo-heatmap?precision=2', { cache: 'no-store' }).then(r => r.ok ? r.json() : { cells: [] }).then(d => setCells(d.cells || [])).catch(() => {}) }, [])
  if (!cells.length) return null
  return (
    <div style={card}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>نقشهٔ حرارتیِ عرضه (Geospatial)</div>
      {cells.slice(0, 12).map((c, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid var(--line)', fontSize: 12 }}>
          <span style={{ fontFamily: 'monospace', direction: 'ltr', color: 'var(--muted)', minWidth: 130 }}>{c.lat}, {c.lng}</span>
          <div style={{ flex: 1, height: 6, background: 'var(--bg2)', borderRadius: 99 }}><div style={{ width: `${Math.round(c.intensity * 100)}%`, height: 6, background: 'linear-gradient(90deg,#e7a14a,#e74c3c)', borderRadius: 99 }} /></div>
          <span style={{ fontWeight: 800, color: 'var(--gold)' }}>{fa(c.count)}</span>
          <span style={{ color: 'var(--faint)' }}>{c.avgPrice ? fa(c.avgPrice) : '—'}</span>
        </div>
      ))}
    </div>
  )
}
