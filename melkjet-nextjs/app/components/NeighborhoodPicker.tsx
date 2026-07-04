'use client'
import { useState, useEffect, useMemo, useRef } from 'react'

// انتخابگرِ محله با «جستجو» — همهٔ محله‌های شهرِ انتخابی را از دیتای جغرافیا نشان می‌دهد
// (نه فقط محله‌هایی که آگهی دارند، و بدونِ تعداد). کاربر می‌تواند تایپ کند و انتخاب کند.

let geoCache: any = null
const norm = (s: string) => (s || '').replace(/‌/g, '').replace(/\s/g, '')

export default function NeighborhoodPicker({ value, onChange, city, fallback = [] }: {
  value: string; onChange: (v: string) => void; city: string; fallback?: string[]
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [geo, setGeo] = useState<any>(geoCache)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (geoCache) { setGeo(geoCache); return }
    fetch('/api/geo').then(r => r.ok ? r.json() : null).then(d => { if (d) { geoCache = d; setGeo(d) } }).catch(() => {})
  }, [])

  // همهٔ محله‌های شهرِ انتخابی + محله‌هایی که آگهی دارند (fallback) — یکتا و مرتب.
  const all = useMemo(() => {
    const set = new Set<string>()
    const cityN = norm(city)
    if (geo?.provinces && cityN) {
      for (const p of geo.provinces) for (const c of (p.cities || [])) {
        if (norm(c.name) === cityN || norm(c.name).includes(cityN) || cityN.includes(norm(c.name))) {
          for (const d of (c.districts || [])) for (const n of (d.neighborhoods || [])) if (n) set.add(n)
        }
      }
    }
    for (const f of fallback) if (f) set.add(f)
    return [...set].sort((a, b) => a.localeCompare(b, 'fa'))
  }, [geo, city, fallback])

  const filtered = useMemo(() => {
    const qn = norm(q)
    return qn ? all.filter(n => norm(n).includes(qn)) : all
  }, [all, q])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  if (!all.length) return null

  const pick = (v: string) => { onChange(v); setOpen(false); setQ('') }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} title="فیلترِ محله"
        style={{ height: 48, padding: '0 14px', borderRadius: 12, background: value ? 'var(--goldDim)' : 'var(--surface)', border: `1px solid ${value ? 'var(--gold)' : 'var(--line2)'}`, color: value ? 'var(--gold)' : 'var(--text)', fontSize: 13.5, cursor: 'pointer', outline: 'none', fontFamily: 'inherit', fontWeight: value ? 700 : 400, display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}>
        <span>📍</span>{value || 'همهٔ محله‌ها'}<span style={{ fontSize: 10, opacity: .7 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 54, insetInlineStart: 0, zIndex: 40, width: 260, maxWidth: '80vw', background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 14, boxShadow: '0 16px 40px -12px rgba(0,0,0,.5)', overflow: 'hidden' }}>
          <div style={{ padding: 10, borderBottom: '1px solid var(--line)' }}>
            <input value={q} onChange={e => setQ(e.target.value)} autoFocus placeholder="جستجوی محله…"
              style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 9, background: 'var(--bg2)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', textAlign: 'right' }} />
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto', padding: 6 }}>
            <button onClick={() => pick('')} style={rowStyle(!value)}>همهٔ محله‌ها</button>
            {filtered.map(n => (
              <button key={n} onClick={() => pick(n)} style={rowStyle(norm(n) === norm(value))}>{n}</button>
            ))}
            {!filtered.length && <div style={{ padding: '12px', fontSize: 12.5, color: 'var(--faint)', textAlign: 'center' }}>محله‌ای یافت نشد</div>}
          </div>
        </div>
      )}
    </div>
  )
}

function rowStyle(active: boolean): React.CSSProperties {
  return {
    display: 'block', width: '100%', textAlign: 'right', padding: '9px 12px', borderRadius: 8, border: 'none',
    background: active ? 'var(--goldDim)' : 'transparent', color: active ? 'var(--gold)' : 'var(--text)',
    fontSize: 13, fontWeight: active ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit',
  }
}
