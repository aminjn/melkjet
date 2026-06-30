'use client'
import { useEffect, useState } from 'react'
import { type CompareEntry, inCompare, toggleCompare, onCompareChange, COMPARE_MAX } from '../lib/compare'

// دکمهٔ «افزودن به مقایسه» — روی کارتِ آگهی/پروژه و صفحاتِ جزئیات.
export default function CompareButton({ entry, variant = 'chip' }: { entry: CompareEntry; variant?: 'chip' | 'overlay' | 'full' }) {
  const [on, setOn] = useState(false)
  useEffect(() => { const u = () => setOn(inCompare(entry.kind, entry.id)); u(); return onCompareChange(u) }, [entry.kind, entry.id])

  const click = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const r = toggleCompare(entry)
    if (r.full) alert(`حداکثر ${COMPARE_MAX} مورد را می‌توان هم‌زمان مقایسه کرد.`)
  }

  if (variant === 'overlay') return (
    <button onClick={click} title="افزودن به مقایسه" style={{ position: 'absolute', top: 12, left: 12, zIndex: 3, height: 34, padding: '0 12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: on ? 'var(--gold)' : 'rgba(20,18,14,0.6)', backdropFilter: 'blur(6px)', color: on ? '#16140f' : 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: 800, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>⇄ {on ? 'در مقایسه' : 'مقایسه'}</button>
  )
  if (variant === 'full') return (
    <button onClick={click} style={{ width: '100%', padding: '12px', borderRadius: 13, border: `1px solid ${on ? 'var(--gold)' : 'var(--line2)'}`, background: on ? 'var(--goldDim)' : 'transparent', color: on ? 'var(--gold)' : 'var(--text)', fontFamily: 'inherit', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>⇄ {on ? 'در فهرستِ مقایسه ✓' : 'افزودن به مقایسه'}</button>
  )
  return (
    <button onClick={click} style={{ padding: '6px 12px', borderRadius: 9, border: `1px solid ${on ? 'var(--gold)' : 'var(--line2)'}`, background: on ? 'var(--goldDim)' : 'var(--bg2)', color: on ? 'var(--gold)' : 'var(--muted)', fontFamily: 'inherit', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>⇄ {on ? 'در مقایسه' : 'مقایسه'}</button>
  )
}
