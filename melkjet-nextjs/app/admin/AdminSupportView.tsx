'use client'
import { useEffect, useState, useCallback } from 'react'

// پنلِ پشتیبانیِ سوپرادمین — همهٔ تیکت‌ها، پاسخ‌دهی و تغییرِ وضعیت. تیکت‌های جدید برجسته‌اند.
const fa = (n: number | string) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])
const STATUS: Record<string, { l: string; c: string }> = { open: { l: 'باز', c: '#e7674a' }, answered: { l: 'پاسخ داده‌شده', c: '#5fd98a' }, closed: { l: 'بسته', c: '#9a9a98' } }
function timeAgo(at: number) { const s = Math.floor((Date.now() - at) / 1000); if (s < 60) return 'لحظاتی پیش'; if (s < 3600) return `${fa(Math.floor(s / 60))} دقیقه پیش`; if (s < 86400) return `${fa(Math.floor(s / 3600))} ساعت پیش`; return `${fa(Math.floor(s / 86400))} روز پیش` }

interface Msg { id: string; from: string; text: string; at: number }
interface Ticket { id: string; owner: string; name?: string; phone?: string; subject: string; category?: string; status: string; messages: Msg[]; updatedAt: number; adminUnread?: boolean; panel?: string }

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14 }
const inp: React.CSSProperties = { width: '100%', border: '1px solid var(--line2)', borderRadius: 10, background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13, padding: '11px 12px', outline: 'none', boxSizing: 'border-box' }
const btn: React.CSSProperties = { background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', border: 'none', borderRadius: 11, padding: '10px 18px', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }

export default function AdminSupportView() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [unread, setUnread] = useState(0)
  const [active, setActive] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [reply, setReply] = useState('')
  const [filter, setFilter] = useState<'all' | 'open'>('all')

  const load = useCallback(async () => {
    try { const r = await fetch('/api/admin/support', { cache: 'no-store' }); const d = await r.json(); if (d.ok) { setTickets(d.tickets || []); setUnread(d.unread || 0) } } catch {} finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const open = async (id: string) => { setBusy(true); try { const r = await fetch(`/api/admin/support?id=${id}`, { cache: 'no-store' }); const d = await r.json(); if (d.ok) setActive(d.ticket) } finally { setBusy(false); load() } }
  const send = async () => { if (!reply.trim() || !active) return; setBusy(true); try { const r = await fetch('/api/admin/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reply', id: active.id, text: reply }) }); const d = await r.json(); if (d.ok) { setActive(d.ticket); setReply(''); load() } } finally { setBusy(false) } }
  const setStatus = async (status: string) => { if (!active) return; const r = await fetch('/api/admin/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status', id: active.id, status }) }); const d = await r.json(); if (d.ok) { setActive(d.ticket); load() } }

  if (loading) return <div style={{ color: 'var(--muted)', padding: '40px 0', textAlign: 'center' }}>در حال بارگذاری…</div>

  if (active) return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 820 }}>
      <button onClick={() => setActive(null)} style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>← همهٔ تیکت‌ها</button>
      <div style={{ ...card, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{active.subject}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['open', 'answered', 'closed'] as const).map(s => <button key={s} onClick={() => setStatus(s)} style={{ fontSize: 11.5, fontWeight: 700, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${STATUS[s].c}66`, background: active.status === s ? `${STATUS[s].c}22` : 'transparent', color: STATUS[s].c }}>{STATUS[s].l}</button>)}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{active.name || 'کاربر'} · <span style={{ direction: 'ltr', display: 'inline-block' }}>{active.phone}</span>{active.category ? ` · ${active.category}` : ''}{active.panel ? ` · از: ${active.panel}` : ''}</div>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {active.messages.map(m => (
          <div key={m.id} style={{ ...card, padding: 14, background: m.from === 'admin' ? 'var(--goldDim)' : 'var(--surface)', border: m.from === 'admin' ? '1px solid var(--gold)' : '1px solid var(--line)' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: m.from === 'admin' ? 'var(--gold)' : 'var(--muted)', marginBottom: 6 }}>{m.from === 'admin' ? '🛡 پشتیبانی (شما)' : (active.name || 'کاربر')} · {timeAgo(m.at)}</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{m.text}</div>
          </div>
        ))}
      </div>
      <div style={{ ...card, padding: 14 }}>
        <textarea value={reply} onChange={e => setReply(e.target.value)} rows={3} placeholder="پاسخِ شما به کاربر…" style={{ ...inp, resize: 'vertical' }} />
        <div style={{ marginTop: 10, textAlign: 'left' }}><button onClick={send} disabled={busy || !reply.trim()} style={btn}>ارسالِ پاسخ</button></div>
      </div>
    </div>
  )

  const rows = filter === 'open' ? tickets.filter(t => t.status !== 'closed') : tickets
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>پشتیبانی — تیکت‌ها</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>{unread > 0 ? `${fa(unread)} تیکتِ پاسخ‌نداده` : 'همهٔ تیکت‌ها پاسخ داده شده'}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'open'] as const).map(f => <button key={f} onClick={() => setFilter(f)} style={{ fontSize: 12.5, fontWeight: 700, padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${filter === f ? 'var(--gold)' : 'var(--line)'}`, background: filter === f ? 'var(--goldDim)' : 'transparent', color: filter === f ? 'var(--gold)' : 'var(--muted)' }}>{f === 'all' ? 'همه' : 'پاسخ‌نداده'}</button>)}
        </div>
      </div>
      {rows.length === 0 ? (
        <div style={{ ...card, padding: '40px 18px', textAlign: 'center', color: 'var(--faint)' }}>تیکتی نیست.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map(t => (
            <button key={t.id} onClick={() => open(t.id)} style={{ ...card, padding: 14, textAlign: 'right', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit', border: t.adminUnread ? '1px solid var(--gold)' : '1px solid var(--line)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>{t.subject}{t.adminUnread && <span style={{ fontSize: 10, background: 'var(--gold)', color: '#16140f', borderRadius: 999, padding: '2px 8px', fontWeight: 800 }}>جدید</span>}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{t.name || 'کاربر'} · {t.category || 'پشتیبانی'} · {timeAgo(t.updatedAt)}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: STATUS[t.status]?.c, border: `1px solid ${STATUS[t.status]?.c}55`, borderRadius: 999, padding: '3px 10px', flexShrink: 0 }}>{STATUS[t.status]?.l}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
