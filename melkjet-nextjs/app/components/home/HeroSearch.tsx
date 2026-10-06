'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// جزیرهٔ تعاملیِ جعبهٔ جستجوی صفحهٔ اصلی. بقیهٔ صفحه server-render می‌شود؛ فقط همین
// (به‌همراه FAQ و دکمهٔ لایک) در مرورگر hydrate می‌شود تا main-thread سبک بماند.
// فاز ۲۹۸ی۴ (ری‌برند): حالتِ glass — پنلِ شیشه‌ایِ هیروی سینماییِ تیره (مطابقِ موکاپ).
export default function HeroSearch({ examples, glass = false }: { examples: string[]; glass?: boolean }) {
  const [query, setQuery] = useState('')
  const router = useRouter()
  const runSearch = () => { const q = query.trim(); router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search') }
  const fillQuery = (text: string) => { setQuery(text); router.push(`/search?q=${encodeURIComponent(text)}`) }

  const card: React.CSSProperties = glass
    ? { position: 'relative', background: 'rgba(20,22,30,.52)', border: '1px solid rgba(247,222,146,.26)', borderRadius: 24, padding: 20, boxShadow: '0 30px 80px -30px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.06)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }
    : { position: 'relative', background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 18, padding: 18, boxShadow: 'var(--shadow)' }
  const taColor = glass ? '#f3ede0' : 'var(--text)'
  const sendBtn: React.CSSProperties = { flexShrink: 0, height: 48, padding: '0 22px', border: 'none', borderRadius: 13, background: 'linear-gradient(140deg,#F7DE92,#D9AD3E 60%,#A9761D)', color: '#16140f', fontFamily: 'inherit', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 12px 28px -10px rgba(217,173,62,.7)' }
  const hintColor = glass ? 'rgba(244,238,225,.6)' : 'var(--faint)'
  const chip: React.CSSProperties = glass
    ? { padding: '7px 13px', borderRadius: 999, border: '1px solid rgba(247,222,146,.22)', background: 'rgba(255,255,255,.05)', color: 'rgba(244,238,225,.85)', fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer' }
    : { padding: '7px 13px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer' }
  const divider = glass ? '1px solid rgba(247,222,146,.16)' : '1px solid var(--line)'

  return (
    <div style={{ margin: glass ? 0 : '34px auto 0', maxWidth: glass ? undefined : 740, width: '100%', textAlign: 'right' }}>
      <div style={card}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <textarea value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runSearch() } }} placeholder="مثلاً: آپارتمان ۱۳۰ متری در سعادت‌آباد، زیر ۱۸ میلیارد، با آسانسور و پارکینگ، نزدیک مترو…" rows={glass ? 3 : 2} style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: taColor, fontFamily: 'inherit', fontSize: 16, lineHeight: 1.7, paddingTop: 8 }} />
          <button onClick={runSearch} style={sendBtn}>جستجو</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14, paddingTop: 14, borderTop: divider }}>
          <span style={{ fontSize: 12.5, color: hintColor, alignSelf: 'center' }}>امتحان کنید:</span>
          {examples.map(ex => (
            <button key={ex} onClick={() => fillQuery(ex)} style={chip}>{ex}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
