'use client'
import { useEffect, useState, useCallback } from 'react'

// پنلِ پشتیبانیِ یک‌جا — قابلِ استفاده در همهٔ پنل‌ها و صفحهٔ /support. تو در تو نیست:
// فهرستِ تیکت‌ها + «تیکتِ جدید»؛ کلیک روی هر تیکت گفتگو را همان‌جا باز می‌کند.
const fa = (n: number | string) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])
const CATEGORIES = ['حساب و امنیت', 'پلن و پرداخت', 'خرید و فروش', 'شروع کار', 'فنی', 'سایر']
const STATUS: Record<string, { l: string; c: string }> = { open: { l: 'باز', c: 'var(--gold)' }, answered: { l: 'پاسخ داده‌شده', c: '#5fd98a' }, closed: { l: 'بسته', c: 'var(--muted)' } }

interface Msg { id: string; from: 'user' | 'admin'; text: string; at: number }
interface Ticket { id: string; subject: string; category?: string; status: string; messages: Msg[]; updatedAt: number; userUnread?: boolean }

function timeAgo(at: number) { const s = Math.floor((Date.now() - at) / 1000); if (s < 60) return 'لحظاتی پیش'; if (s < 3600) return `${fa(Math.floor(s / 60))} دقیقه پیش`; if (s < 86400) return `${fa(Math.floor(s / 3600))} ساعت پیش`; return `${fa(Math.floor(s / 86400))} روز پیش` }

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14 }
const inp: React.CSSProperties = { width: '100%', border: '1px solid var(--line2)', borderRadius: 10, background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13, padding: '11px 12px', outline: 'none', boxSizing: 'border-box' }
const btn: React.CSSProperties = { background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', border: 'none', borderRadius: 11, padding: '11px 18px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }

export default function SupportPanel({ panel }: { panel?: string }) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [active, setActive] = useState<Ticket | null>(null)
  const [view, setView] = useState<'list' | 'new'>('list')
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(true)
  const [busy, setBusy] = useState(false)
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('')
  const [text, setText] = useState('')
  const [reply, setReply] = useState('')

  const loadList = useCallback(async () => {
    try {
      const r = await fetch('/api/support', { cache: 'no-store' })
      if (r.status === 401) { setLoggedIn(false); return }
      const d = await r.json(); if (d.ok) { setLoggedIn(true); setTickets(d.tickets || []) }
    } catch {} finally { setLoading(false) }
  }, [])
  useEffect(() => { loadList() }, [loadList])

  const openTicket = async (id: string) => {
    setBusy(true)
    try { const r = await fetch(`/api/support?id=${id}`, { cache: 'no-store' }); const d = await r.json(); if (d.ok) setActive(d.ticket) } finally { setBusy(false) }
  }
  const submitNew = async () => {
    if (!subject.trim() || !text.trim()) return
    setBusy(true)
    try {
      const r = await fetch('/api/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject, category, text, panel }) })
      const d = await r.json()
      if (d.ok) { setSubject(''); setCategory(''); setText(''); setView('list'); setActive(d.ticket); loadList() }
      else if (d.login) { window.location.href = '/auth' }
    } finally { setBusy(false) }
  }
  const sendReply = async () => {
    if (!reply.trim() || !active) return
    setBusy(true)
    try { const r = await fetch('/api/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reply', id: active.id, text: reply }) }); const d = await r.json(); if (d.ok) { setActive(d.ticket); setReply(''); loadList() } } finally { setBusy(false) }
  }

  if (loading) return <div style={{ color: 'var(--muted)', padding: '40px 0', textAlign: 'center' }}>در حال بارگذاری…</div>
  if (!loggedIn) return (
    <div style={{ ...card, padding: 22, textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>پشتیبانی</div>
      <p style={{ color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.9, margin: '0 0 16px' }}>برای ثبت و پیگیریِ تیکتِ پشتیبانی وارد شوید.</p>
      <a href="/auth" style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>ورود</a>
    </div>
  )

  // گفتگوی یک تیکت
  if (active) return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 760 }}>
      <button onClick={() => { setActive(null); loadList() }} style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>← بازگشت به تیکت‌ها</button>
      <div style={{ ...card, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{active.subject}</div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: STATUS[active.status]?.c, border: `1px solid ${STATUS[active.status]?.c}55`, borderRadius: 999, padding: '3px 11px' }}>{STATUS[active.status]?.l}</span>
        </div>
        {active.category && <div style={{ fontSize: 12, color: 'var(--faint)' }}>دسته: {active.category}</div>}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {active.messages.map(m => (
          <div key={m.id} style={{ ...card, padding: 14, background: m.from === 'admin' ? 'var(--goldDim)' : 'var(--surface)', border: m.from === 'admin' ? '1px solid var(--gold)' : '1px solid var(--line)' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: m.from === 'admin' ? 'var(--gold)' : 'var(--muted)', marginBottom: 6 }}>{m.from === 'admin' ? '🛡 پشتیبانی ملک‌جت' : 'شما'} · {timeAgo(m.at)}</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{m.text}</div>
          </div>
        ))}
      </div>
      {active.status !== 'closed' && (
        <div style={{ ...card, padding: 14 }}>
          <textarea value={reply} onChange={e => setReply(e.target.value)} rows={3} placeholder="پاسخِ شما…" style={{ ...inp, resize: 'vertical' }} />
          <div style={{ marginTop: 10, textAlign: 'left' }}><button onClick={sendReply} disabled={busy || !reply.trim()} style={btn}>ارسالِ پاسخ</button></div>
        </div>
      )}
    </div>
  )

  // تیکتِ جدید
  if (view === 'new') return (
    <div style={{ ...card, padding: 20, maxWidth: 560 }}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>تیکتِ جدید</div>
      <div style={{ display: 'grid', gap: 12 }}>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="موضوع" style={inp} />
        <select value={category} onChange={e => setCategory(e.target.value)} style={inp}><option value="">انتخابِ دسته</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={5} placeholder="مشکل یا سؤال را بنویس…" style={{ ...inp, resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={submitNew} disabled={busy || !subject.trim() || !text.trim()} style={btn}>ارسالِ تیکت</button>
          <button onClick={() => setView('list')} style={{ background: 'transparent', border: '1px solid var(--line2)', color: 'var(--muted)', borderRadius: 11, padding: '11px 18px', fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>انصراف</button>
        </div>
      </div>
    </div>
  )

  // فهرستِ تیکت‌ها
  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 760 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>تیکت‌های من</div>
        <button onClick={() => setView('new')} style={btn}>+ تیکتِ جدید</button>
      </div>
      {tickets.length === 0 ? (
        <div style={{ ...card, padding: '40px 18px', textAlign: 'center', color: 'var(--faint)' }}>هنوز تیکتی ثبت نکرده‌اید. برای ارتباط با پشتیبانی «تیکتِ جدید» بزنید.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {tickets.map(t => (
            <button key={t.id} onClick={() => openTicket(t.id)} style={{ ...card, padding: 14, textAlign: 'right', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>{t.subject}{t.userUnread && <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--gold)' }} />}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{t.category || 'پشتیبانی'} · {timeAgo(t.updatedAt)}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: STATUS[t.status]?.c, border: `1px solid ${STATUS[t.status]?.c}55`, borderRadius: 999, padding: '3px 10px', flexShrink: 0 }}>{STATUS[t.status]?.l}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
