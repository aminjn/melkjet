'use client'
import { useState } from 'react'

// دستیارِ هوشمندِ REOS — چتِ ایجنت (memory/planner/executor/tools). به /api/reos/agent وصل است.
const FONT = 'Vazirmatn, system-ui, sans-serif'
type Msg = { role: 'user' | 'agent'; text: string; trace?: { tool: string; ok: boolean }[] }

const SUGGEST = ['یک ملک مناسب پیشنهاد بده', 'یادت باشه بودجه‌ام ۵ میلیارد است', 'یادت هست دنبالِ چه بودم؟']

export default function ReosAgentChat({ title = 'دستیارِ هوشمندِ REOS' }: { title?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async (text: string) => {
    const q = text.trim(); if (!q || busy) return
    setMsgs(m => [...m, { role: 'user', text: q }]); setInput(''); setBusy(true)
    try {
      const r = await fetch('/api/reos/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: q }) })
      const d = await r.json()
      setMsgs(m => [...m, { role: 'agent', text: d.answer || d.error || 'پاسخی دریافت نشد', trace: (d.trace || []).map((t: { tool: string; ok: boolean }) => ({ tool: t.tool, ok: t.ok })) }])
    } catch { setMsgs(m => [...m, { role: 'agent', text: 'خطا در ارتباط با دستیار' }]) }
    setBusy(false)
  }

  const bubble = (m: Msg, i: number) => (
    <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-start' : 'flex-end', maxWidth: '85%' }}>
      <div style={{ background: m.role === 'user' ? 'var(--bg2)' : 'var(--goldDim)', border: `1px solid ${m.role === 'user' ? 'var(--line)' : 'var(--gold)'}`, borderRadius: 12, padding: '9px 12px', fontSize: 13, lineHeight: 1.7, color: 'var(--text)' }}>{m.text}</div>
      {m.trace && m.trace.length > 0 && <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 4, textAlign: m.role === 'user' ? 'right' : 'left' }}>ابزار: {m.trace.map(t => `${t.tool}${t.ok ? '✓' : '✗'}`).join(' · ')}</div>}
    </div>
  )

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 16, fontFamily: FONT, direction: 'rtl' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>✦</span><span style={{ fontSize: 15, fontWeight: 800 }}>{title}</span>
        <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>حافظه + ابزار + استدلال</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 60, maxHeight: 320, overflowY: 'auto', marginBottom: 12 }}>
        {msgs.length === 0
          ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>بپرسید: پیشنهادِ ملک، برآوردِ قیمت، تطبیقِ مشاور، یا چیزی را به حافظه بسپارید.</div>
          : msgs.map(bubble)}
        {busy && <div style={{ alignSelf: 'flex-end', fontSize: 12, color: 'var(--muted)' }}>در حال فکر…</div>}
      </div>
      {msgs.length === 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {SUGGEST.map(s => <button key={s} onClick={() => send(s)} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 999, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: FONT }}>{s}</button>)}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(input) }} placeholder="پیامِ خود را بنویسید…" style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontFamily: FONT, fontSize: 13 }} />
        <button onClick={() => send(input)} disabled={busy} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, cursor: busy ? 'default' : 'pointer', fontFamily: FONT }}>ارسال</button>
      </div>
    </div>
  )
}
