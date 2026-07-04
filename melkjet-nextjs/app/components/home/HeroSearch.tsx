'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// جزیرهٔ تعاملیِ جعبهٔ جستجوی صفحهٔ اصلی. بقیهٔ صفحه server-render می‌شود؛ فقط همین
// (به‌همراه FAQ و دکمهٔ لایک) در مرورگر hydrate می‌شود تا main-thread سبک بماند.
export default function HeroSearch({ examples }: { examples: string[] }) {
  const [query, setQuery] = useState('')
  const router = useRouter()
  const runSearch = () => { const q = query.trim(); router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search') }
  const fillQuery = (text: string) => { setQuery(text); router.push(`/search?q=${encodeURIComponent(text)}`) }
  return (
    <div style={{ margin: '34px auto 0', maxWidth: 740, textAlign: 'right' }}>
      <div style={{ position: 'relative', background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 18, padding: 18, boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <textarea value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runSearch() } }} placeholder="مثلاً: آپارتمان ۱۳۰ متری در سعادت‌آباد، زیر ۱۸ میلیارد، با آسانسور و پارکینگ، نزدیک مترو…" rows={2} style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontFamily: 'inherit', fontSize: 16, lineHeight: 1.7, paddingTop: 8 }} />
          <button onClick={runSearch} style={{ flexShrink: 0, height: 48, padding: '0 22px', border: 'none', borderRadius: 13, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontFamily: 'inherit', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 10px 24px -10px var(--gold)' }}>جستجو</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <span style={{ fontSize: 12.5, color: 'var(--faint)', alignSelf: 'center' }}>امتحان کنید:</span>
          {examples.map(ex => (
            <button key={ex} onClick={() => fillQuery(ex)} style={{ padding: '7px 13px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer' }}>{ex}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
