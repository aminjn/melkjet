'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { type CompareEntry, readCompare, onCompareChange, clearCompare, removeCompare } from '../lib/compare'

// نوارِ شناورِ مقایسه — وقتی موردی انتخاب شده در پایینِ همهٔ صفحات نشان داده می‌شود.
export default function CompareBar() {
  const [list, setList] = useState<CompareEntry[]>([])
  const pathname = usePathname()
  useEffect(() => { const u = () => setList(readCompare()); u(); return onCompareChange(u) }, [])
  if (!list.length || pathname === '/compare') return null

  return (
    <div style={{ position: 'fixed', bottom: 16, insetInlineStart: '50%', transform: 'translateX(50%)', zIndex: 300, background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: 16, boxShadow: '0 10px 40px -10px rgba(0,0,0,.6)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, maxWidth: '94vw', fontFamily: 'Vazirmatn, sans-serif' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {list.map(e => (
          <div key={e.kind + e.id} title={e.title} style={{ position: 'relative', width: 42, height: 42, borderRadius: 8, overflow: 'hidden', background: 'var(--bg2)', flexShrink: 0 }}>
            {e.photo ? <img src={e.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'var(--faint)' }}>{e.kind === 'project' ? '🏗' : '🏠'}</div>}
            <button onClick={() => removeCompare(e.kind, e.id)} style={{ position: 'absolute', top: 0, insetInlineEnd: 0, width: 16, height: 16, border: 'none', borderRadius: '0 0 0 6px', background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 11, lineHeight: 1, cursor: 'pointer', padding: 0 }}>×</button>
          </div>
        ))}
      </div>
      <a href="/compare" style={{ background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 13.5, padding: '10px 18px', borderRadius: 11, textDecoration: 'none', whiteSpace: 'nowrap' }}>مقایسه ({(list.length).toLocaleString('fa-IR')}) ←</a>
      <button onClick={clearCompare} title="پاک‌کردن" style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>×</button>
    </div>
  )
}
