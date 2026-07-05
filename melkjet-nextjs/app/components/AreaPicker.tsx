'use client'
import { useEffect, useMemo, useState } from 'react'

// انتخاب‌گرِ محله‌ها — لیستِ همهٔ محله‌ها را از /api/geo می‌گیرد و به‌صورتِ چیپ نمایش می‌دهد.
const FONT = 'Vazirmatn, system-ui, sans-serif'

export default function AreaPicker({ value, onChange, max = 8 }: { value: string[]; onChange: (v: string[]) => void; max?: number }) {
  const [all, setAll] = useState<string[]>([])
  const [q, setQ] = useState('')

  useEffect(() => {
    fetch('/api/geo').then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.provinces) return
      const set = new Set<string>()
      for (const p of d.provinces || []) {
        for (const c of p.cities || []) {
          for (const dist of c.districts || []) {
            for (const n of dist.neighborhoods || []) {
              const name = String(n || '').trim()
              if (name) set.add(name)
            }
          }
        }
      }
      setAll(Array.from(set).sort((a, b) => a.localeCompare(b, 'fa')))
    }).catch(() => {})
  }, [])

  const atMax = value.length >= max
  const matches = useMemo(() => {
    const term = q.trim()
    if (!term) return []
    return all.filter(n => n.includes(term) && !value.includes(n)).slice(0, 12)
  }, [q, all, value])

  const add = (n: string) => { if (!value.includes(n) && value.length < max) { onChange([...value, n]); setQ('') } }
  const remove = (n: string) => onChange(value.filter(x => x !== n))

  return (
    <div dir="rtl" style={{ fontFamily: FONT, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {value.map(n => (
            <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--goldDim)', border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: 999, padding: '5px 6px 5px 11px', fontSize: 12, fontWeight: 700 }}>
              {n}
              <button onClick={() => remove(n)} aria-label="حذف" style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0, fontFamily: FONT }}>×</button>
            </span>
          ))}
        </div>
      )}

      {atMax ? (
        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>به بیشینهٔ {(max).toLocaleString('fa-IR')} محله رسیده‌اید.</div>
      ) : (
        <>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="جستجوی محله… (مثلاً سعادت‌آباد)"
            style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT, boxSizing: 'border-box' }}
          />
          {matches.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {matches.map(n => (
                <button key={n} onClick={() => add(n)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--text)', borderRadius: 999, padding: '5px 11px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                  <span style={{ color: 'var(--gold)', fontWeight: 900 }}>＋</span> {n}
                </button>
              ))}
            </div>
          )}
          {q.trim() && matches.length === 0 && all.length > 0 && (
            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>محله‌ای با این نام یافت نشد.</div>
          )}
        </>
      )}
    </div>
  )
}
