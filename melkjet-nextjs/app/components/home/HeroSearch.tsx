'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// جزیرهٔ تعاملیِ هیروی صفحهٔ اصلی.
// فاز ۲۹۸ی۵ (ری‌برند): حالتِ glass = پنلِ شیشه‌ایِ موکاپ — جعبهٔ زبانِ طبیعی + سه فیلترِ
// برچسب‌دار (نوع ملک/موقعیت/نوع) + دکمهٔ جستجو + نوارِ دستیار با دکمهٔ گردِ ارسال.
// همه واقعی‌اند و به /search می‌روند (قانونِ آهنین: هیچ ورودیِ تزئینیِ بی‌کار).

const KINDS = ['آپارتمان', 'ویلا و خانه', 'زمین و کلنگی', 'دفتر و اداری', 'مغازه و تجاری']
const DEALS: { l: string; v: string }[] = [
  { l: 'خرید', v: '' }, { l: 'رهن و اجاره', v: 'rent' }, { l: 'پیش‌فروش', v: 'presale' },
]

export default function HeroSearch({ examples, glass = false }: { examples: string[]; glass?: boolean }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState(KINDS[0])
  const [deal, setDeal] = useState('')
  const [loc, setLoc] = useState('')
  const [chat, setChat] = useState('')

  const go = (params: Record<string, string>) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v && v.trim()) qs.set(k, v.trim()) })
    const s = qs.toString()
    router.push(s ? `/search?${s}` : '/search')
  }
  const runSearch = () => go({ q: query, kind, type: deal, loc })
  const runChat = () => go({ q: chat.trim() || query })
  const fillQuery = (text: string) => { setQuery(text); go({ q: text }) }

  // ── حالتِ ساده (غیرِ هیرو) — دست‌نخورده از نسخهٔ قبلی ──
  if (!glass) {
    return (
      <div style={{ margin: '34px auto 0', maxWidth: 740, width: '100%', textAlign: 'right' }}>
        <div style={{ position: 'relative', background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 18, padding: 18, boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <textarea value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runSearch() } }} placeholder="مثلاً: آپارتمان ۱۳۰ متری در سعادت‌آباد، زیر ۱۸ میلیارد، با آسانسور و پارکینگ، نزدیک مترو…" rows={2} style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontFamily: 'inherit', fontSize: 16, lineHeight: 1.7, paddingTop: 8 }} />
            <button onClick={runSearch} style={{ flexShrink: 0, height: 48, padding: '0 22px', border: 'none', borderRadius: 13, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontFamily: 'inherit', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 10px 24px -10px var(--gold)' }}>جستجو</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
            <span style={{ fontSize: 12.5, color: 'var(--faint)', alignSelf: 'center' }}>امتحان کنید:</span>
            {examples.map(ex => (<button key={ex} onClick={() => fillQuery(ex)} style={{ padding: '7px 13px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer' }}>{ex}</button>))}
          </div>
        </div>
      </div>
    )
  }

  // ── حالتِ glass — پنلِ هیروی سینمایی (مطابقِ موکاپ) ──
  const GOLD = '#F7DE92'
  const pill: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: 48, padding: '0 16px', borderRadius: 14, border: '1px solid rgba(247,222,146,.3)', background: 'rgba(247,222,146,.07)', color: '#f3ede0', overflow: 'hidden', boxSizing: 'border-box' }
  const pillLabel: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: GOLD, whiteSpace: 'nowrap', flexShrink: 0 }
  const selStyle: React.CSSProperties = { flex: 1, width: 0, minWidth: 0, appearance: 'none', WebkitAppearance: 'none', border: 'none', outline: 'none', background: 'transparent', color: '#f3ede0', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'right', direction: 'rtl', textOverflow: 'ellipsis' }

  return (
    <div style={{ width: '100%', textAlign: 'right' }}>
      <div style={{ position: 'relative', background: 'rgba(18,20,28,.5)', border: '1px solid rgba(247,222,146,.26)', borderRadius: 26, padding: 'clamp(16px,2.2vw,22px)', boxShadow: '0 40px 90px -34px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,.06)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)' }}>
        {/* ردیفِ بالا: فیلترها (راست) + جعبهٔ زبانِ طبیعی (چپ). Flexbox تا هیچ‌وقت روی هم نیفتند؛ در تنگی wrap می‌شود. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'stretch' }}>
          {/* ستونِ فیلترها */}
          <div style={{ flex: '1 1 208px', minWidth: 196, display: 'grid', gap: 10, alignContent: 'start' }}>
            <label style={pill}>
              <span style={pillLabel}>نوع ملک:</span>
              <select value={kind} onChange={e => setKind(e.target.value)} style={selStyle}>
                {KINDS.map(k => <option key={k} value={k} style={{ color: '#111' }}>{k}</option>)}
              </select>
            </label>
            <label style={pill}>
              <span style={pillLabel}>موقعیت:</span>
              <input value={loc} onChange={e => setLoc(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') runSearch() }} placeholder="تهران" style={{ ...selStyle, cursor: 'text', minWidth: 0 }} />
            </label>
            <label style={pill}>
              <span style={pillLabel}>نوع:</span>
              <select value={deal} onChange={e => setDeal(e.target.value)} style={selStyle}>
                {DEALS.map(d => <option key={d.l} value={d.v} style={{ color: '#111' }}>{d.l}</option>)}
              </select>
            </label>
            <button onClick={runSearch} style={{ height: 48, border: 'none', borderRadius: 14, background: 'linear-gradient(140deg,#F7DE92,#D9AD3E 60%,#A9761D)', color: '#16140f', fontFamily: 'inherit', fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 12px 28px -10px rgba(217,173,62,.7)' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16140f" strokeWidth="2.4" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
              جستجو
            </button>
          </div>
          {/* جعبهٔ زبانِ طبیعی */}
          <textarea value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runSearch() } }} placeholder="به زبان خودت بگو چه می‌خواهی… مثلاً: آپارتمان ۱۳۰ متری در سعادت‌آباد، زیر ۱۸ میلیارد، با آسانسور و پارکینگ، نزدیک مترو" style={{ flex: '2 1 240px', minWidth: 0, minHeight: 176, resize: 'none', borderRadius: 16, border: '1px solid rgba(247,222,146,.3)', outline: 'none', background: 'rgba(247,222,146,.08)', color: '#f6f1e6', fontFamily: 'inherit', fontSize: 15.5, lineHeight: 1.85, padding: '14px 16px' }} />
        </div>

        {/* نوارِ دستیارِ هوشمند با دکمهٔ گردِ ارسال */}
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, height: 56, padding: '0 8px 0 18px', borderRadius: 16, border: '1px solid rgba(247,222,146,.2)', background: 'rgba(255,255,255,.04)' }}>
          <input value={chat} onChange={e => setChat(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') runChat() }} placeholder="از دستیارِ هوشمندِ ملک‌جت بپرس…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: '#f3ede0', fontFamily: 'inherit', fontSize: 14.5 }} />
          <button onClick={runChat} aria-label="ارسال به دستیار" style={{ flexShrink: 0, width: 42, height: 42, borderRadius: '50%', border: '1px solid rgba(247,222,146,.5)', background: 'linear-gradient(140deg,#F7DE92,#D9AD3E)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px -8px rgba(217,173,62,.8)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16140f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'scaleX(-1)' }}><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </div>

        {/* نمونه‌های پیشنهادی */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          <span style={{ fontSize: 12.5, color: 'rgba(244,238,225,.6)', alignSelf: 'center' }}>امتحان کنید:</span>
          {examples.slice(0, 3).map(ex => (
            <button key={ex} onClick={() => fillQuery(ex)} style={{ padding: '7px 13px', borderRadius: 999, border: '1px solid rgba(247,222,146,.22)', background: 'rgba(255,255,255,.05)', color: 'rgba(244,238,225,.85)', fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer' }}>{ex}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
