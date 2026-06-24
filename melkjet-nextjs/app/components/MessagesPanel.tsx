'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

// صندوقِ پیامِ گفتگوی واقعی (خریدار ↔ صاحبِ آگهی). در پنل خریدار با role="buyer" و
// در پنل‌های صاحب‌آگهی (مشاور/آژانس/مالک) با role="owner" استفاده می‌شود.

const FONT = 'Vazirmatn, system-ui, sans-serif'
type Side = 'buyer' | 'owner'
interface Msg { from: Side; text: string; at: number }
interface Conversation {
  id: string; listingId: string; listingTitle: string
  buyerName: string; ownerName: string
  messages: Msg[]; buyerUnread: number; ownerUnread: number; updatedAt: number
}

export default function MessagesPanel({ role }: { role: Side }) {
  const [convs, setConvs] = useState<Conversation[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const endRef = useRef<HTMLDivElement | null>(null)

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/messages?role=${role}`, { cache: 'no-store' })
      if (r.ok) { const d = await r.json(); setConvs(d.conversations || []) }
    } catch {} finally { setLoading(false) }
  }, [role])
  useEffect(() => { refresh() }, [refresh])
  // به‌روزرسانیِ دوره‌ای تا پاسخِ طرفِ مقابل دیده شود.
  useEffect(() => { const t = setInterval(refresh, 12000); return () => clearInterval(t) }, [refresh])

  const current = convs.find(c => c.id === active) || null
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [current?.messages.length])

  // علامت‌گذاریِ خوانده‌شده هنگام بازکردنِ گفتگو.
  useEffect(() => {
    if (!active) return
    fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'read', convId: active }) })
      .then(() => setConvs(cs => cs.map(c => c.id === active ? { ...c, [role === 'owner' ? 'ownerUnread' : 'buyerUnread']: 0 } : c))).catch(() => {})
  }, [active, role])

  const send = async () => {
    const t = input.trim(); if (!t || !active || sending) return
    setInput(''); setSending(true)
    try {
      const r = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reply', convId: active, text: t }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.conversation) setConvs(cs => cs.map(c => c.id === active ? d.conversation : c))
    } catch {} finally { setSending(false) }
  }

  const unread = (c: Conversation) => role === 'owner' ? c.ownerUnread : c.buyerUnread
  const other = (c: Conversation) => role === 'owner' ? c.buyerName : c.ownerName

  return (
    <div dir="rtl" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14, height: 'calc(100vh - 150px)', minHeight: 420, fontFamily: FONT }}>
      {/* لیستِ گفتگوها */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'auto', padding: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, padding: '8px 10px' }}>{role === 'owner' ? 'پیام‌های دریافتی' : 'گفتگوها'}</div>
        {loading && <div style={{ color: 'var(--faint)', fontSize: 12.5, textAlign: 'center', padding: 20 }}>در حال بارگذاری…</div>}
        {!loading && convs.length === 0 && <div style={{ color: 'var(--faint)', fontSize: 12.5, textAlign: 'center', padding: '24px 12px', lineHeight: 1.8 }}>{role === 'owner' ? 'هنوز پیامی از خریداران دریافت نکرده‌اید. وقتی کسی روی آگهی‌تان «چت با صاحب آگهی» را بزند، اینجا می‌بینید.' : 'هنوز گفتگویی ندارید — از صفحهٔ یک آگهی «چت با صاحب آگهی» را بزنید.'}</div>}
        {convs.map(c => (
          <button key={c.id} onClick={() => setActive(c.id)} style={{ width: '100%', textAlign: 'right', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: active === c.id ? 'var(--goldDim)' : 'var(--bg)', cursor: 'pointer', fontFamily: FONT, marginBottom: 6, display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: active === c.id ? 'var(--gold)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.listingTitle}</div>
              {unread(c) > 0 && <span style={{ background: 'var(--gold)', color: '#16140f', fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: '1px 7px' }}>{unread(c).toLocaleString('fa-IR')}</span>}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{other(c) || (role === 'owner' ? 'خریدار' : 'صاحب آگهی')}{c.messages.length ? ` · ${c.messages[c.messages.length - 1].text.slice(0, 24)}` : ''}</div>
          </button>
        ))}
      </div>

      {/* پنجرهٔ گفتگو */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!current ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 13.5, padding: 20, textAlign: 'center' }}>یک گفتگو را از فهرستِ کنار انتخاب کنید.</div>
        ) : (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontSize: 13.5, fontWeight: 800 }}>{current.listingTitle}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{role === 'owner' ? `خریدار: ${current.buyerName}` : `صاحب آگهی: ${current.ownerName}`}</div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {current.messages.map((m, i) => {
                const mine = m.from === role
                return (
                  <div key={i} style={{ alignSelf: mine ? 'flex-start' : 'flex-end', maxWidth: '76%', background: mine ? 'linear-gradient(135deg,var(--gold2),var(--gold))' : 'var(--bg2)', color: mine ? '#16140f' : 'var(--text)', borderRadius: 12, padding: '9px 13px', fontSize: 13, lineHeight: 1.8 }}>
                    {m.text}
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>
            <form onSubmit={e => { e.preventDefault(); send() }} style={{ padding: 12, borderTop: '1px solid var(--line)', display: 'flex', gap: 8 }}>
              <input value={input} onChange={e => setInput(e.target.value)} placeholder="پیام خود را بنویسید…" style={{ flex: 1, padding: '10px 13px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT }} />
              <button type="submit" disabled={sending || !input.trim()} style={{ padding: '0 20px', borderRadius: 10, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: FONT, opacity: sending ? 0.6 : 1 }}>{sending ? '…' : 'ارسال'}</button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
