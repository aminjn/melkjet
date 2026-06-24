'use client'
import { useEffect, useRef, useState } from 'react'
import { CITIES } from '@/app/lib/taxonomy'

// انتخابگرِ شهر — در نوارِ بالای همهٔ صفحاتِ پابلیک. شهرِ انتخابی در کوکیِ mj_city می‌ماند.
// چون محله‌ها در شهرهای مختلف هم‌نام‌اند، اول باید شهر مشخص شود.

const PRIORITY = ['تهران', 'مشهد', 'اصفهان', 'کرج', 'شیراز', 'تبریز', 'قم', 'اهواز', 'رشت', 'کرمان']
const ALL_CITIES = (() => {
  const set = new Set<string>(Object.values(CITIES).flat())
  const rest = Array.from(set).filter(c => !PRIORITY.includes(c)).sort((a, b) => a.localeCompare(b, 'fa'))
  return [...PRIORITY.filter(c => set.has(c) || true), ...rest]
})()

export function readCity(): string {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(/(?:^|; )mj_city=([^;]*)/)
  if (m) { try { const v = decodeURIComponent(m[1]); if (v) return v } catch {} }
  const lm = document.cookie.match(/(?:^|; )mj_loc=([^;]*)/)
  if (lm) { try { return JSON.parse(decodeURIComponent(lm[1]))?.city || '' } catch {} }
  return ''
}
export function writeCity(city: string) {
  if (typeof document === 'undefined') return
  document.cookie = `mj_city=${encodeURIComponent(city)};path=/;max-age=${365 * 86400};SameSite=Lax`
  window.dispatchEvent(new CustomEvent('mj-city-updated'))
}

export default function CitySelector({ compact = false }: { compact?: boolean }) {
  const [city, setCity] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setCity(readCity())
    const upd = () => setCity(readCity())
    window.addEventListener('mj-city-updated', upd)
    window.addEventListener('mj-loc-updated', upd)
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => { window.removeEventListener('mj-city-updated', upd); window.removeEventListener('mj-loc-updated', upd); document.removeEventListener('mousedown', onDoc) }
  }, [])

  const pick = (c: string) => { setCity(c); writeCity(c); setOpen(false) }

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} title="انتخاب شهر" style={{ display: 'flex', alignItems: 'center', gap: 6, height: compact ? 38 : 40, padding: '0 12px', borderRadius: 11, border: `1px solid ${city ? 'var(--gold)' : 'var(--line2)'}`, background: city ? 'var(--goldDim)' : 'var(--surface)', color: city ? 'var(--gold)' : 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 14 }}>📍</span>
        <span>{city || 'انتخاب شهر'}</span>
        <span style={{ fontSize: 10, opacity: .7 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '110%', insetInlineStart: 0, zIndex: 100, width: 200, maxHeight: 320, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 12, boxShadow: '0 14px 40px -12px rgba(0,0,0,.5)', padding: 6 }}>
          {ALL_CITIES.map(c => (
            <button key={c} onClick={() => pick(c)} style={{ display: 'block', width: '100%', textAlign: 'right', padding: '9px 11px', borderRadius: 8, border: 'none', background: city === c ? 'var(--goldDim)' : 'transparent', color: city === c ? 'var(--gold)' : 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: city === c ? 700 : 500 }}>{c}</button>
          ))}
        </div>
      )}
    </div>
  )
}
