'use client'
import { useState, useEffect, useCallback } from 'react'

// دستیار هوشمندِ چندگفتگویی، قابل‌استفاده در همهٔ پنل‌ها.
// فقط panel و (اختیاری) پیشنهادها را بده؛ بقیه را خودش مدیریت می‌کند.
interface AiMsg { id: string; role: 'user' | 'assistant'; text: string; createdAt: number }
interface AiChat { id: string; title: string; messages: AiMsg[]; createdAt: number; updatedAt: number }

const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => n.toLocaleString('fa-IR')
const faDate = (ts: number) => { try { return new Date(ts).toLocaleDateString('fa-IR') } catch { return '' } }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }
const inputStyle: React.CSSProperties = { padding: '9px 11px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT, width: '100%' }

export default function AssistantPanel({ panel, title = 'دستیار هوشمند ملک‌جت', subtitle = 'مشاور AI شخصیِ تو', suggestions = [] }: { panel: string; title?: string; subtitle?: string; suggestions?: string[] }) {
  const [chats, setChats] = useState<AiChat[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/assistant?panel=${encodeURIComponent(panel)}`)
      if (r.ok) { const d = await r.json(); setChats(d.chats || []) }
    } catch {}
  }, [panel])
  useEffect(() => { refresh() }, [refresh])

  const ask = async (text: string) => {
    const t = text.trim(); if (!t || sending) return
    setInput(''); setSending(true)
    try {
      const r = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ panel, action: 'ask', chatId: active || undefined, text: t }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { alert(d.error || 'خطا'); return }
      if (d.chat?.id) setActive(d.chat.id)
      if (Array.isArray(d.chats)) setChats(d.chats)
    } catch { alert('اتصال برقرار نشد') } finally { setSending(false) }
  }
  const newChat = () => { setActive(null); setInput('') }
  const del = async (id: string) => {
    if (!confirm('این گفتگو حذف شود؟')) return
    if (active === id) setActive(null)
    const r = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ panel, action: 'delete', id }) })
    const d = await r.json().catch(() => ({}))
    if (Array.isArray(d.chats)) setChats(d.chats); else refresh()
  }

  const current = chats.find(c => c.id === active) || null
  const thread = current?.messages || []
  const actionBtn: React.CSSProperties = { padding: '5px 12px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: FONT }

  return (
    <div className="mjap-cols" style={{ display: 'flex', gap: 16, height: '100%', minHeight: 420, fontFamily: FONT }}>
      <style>{`@media(max-width:760px){.mjap-cols{flex-direction:column!important}.mjap-list{flex:0 0 auto!important;max-height:200px}}`}</style>
      {/* history */}
      <div className="mjap-list" style={{ ...card, padding: 14, flex: '0 0 250px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={newChat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 10, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 13.5, border: 'none', cursor: 'pointer', fontFamily: FONT }}>＋ گفتگوی جدید</button>
        <div style={{ fontSize: 11.5, color: 'var(--faint)', padding: '2px 4px' }}>گفتگوهای گذشته</div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {chats.map(c => (
            <div key={c.id} onClick={() => setActive(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 11px', borderRadius: 10, border: '1px solid var(--line)', background: active === c.id ? 'var(--goldDim)' : 'var(--bg)', cursor: 'pointer' }}>
              <span style={{ fontSize: 13, flexShrink: 0 }}>✨</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: active === c.id ? 'var(--gold)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</div>
                <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>{faDate(c.updatedAt)} · {fa(c.messages.length)} پیام</div>
              </div>
              <button onClick={e => { e.stopPropagation(); del(c.id) }} title="حذف" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--faint)', fontSize: 14, flexShrink: 0, padding: 2 }}>×</button>
            </div>
          ))}
          {chats.length === 0 && <div style={{ color: 'var(--faint)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>هنوز گفتگویی نداری.</div>}
        </div>
      </div>

      {/* thread */}
      <div style={{ ...card, padding: 0, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 11, background: 'linear-gradient(135deg, color-mix(in srgb,var(--gold) 12%,var(--surface)), var(--surface) 80%)' }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>✨</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current ? current.title : title}</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{subtitle}</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 280 }}>
          {thread.length === 0 ? (
            <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 460 }}>
              <div style={{ fontSize: 38, marginBottom: 10 }}>✨</div>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>چطور می‌تونم کمکت کنم؟</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18, lineHeight: 1.8 }}>یکی از پیشنهادهای زیر را بزن یا سؤالت را تایپ کن. هر گفتگو جداگانه ذخیره می‌شود.</div>
              {suggestions.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {suggestions.map(s => (
                  <button key={s} onClick={() => ask(s)} disabled={sending} style={{ ...actionBtn, textAlign: 'right', padding: '11px 14px', background: 'var(--bg)', color: 'var(--text)', borderColor: 'color-mix(in srgb,var(--gold) 25%,transparent)' }}>{s}</button>
                ))}
              </div>}
            </div>
          ) : thread.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-start' : 'flex-end' }}>
              <div style={{ maxWidth: '82%', padding: '11px 14px', borderRadius: 14, fontSize: 13.5, lineHeight: 1.85, whiteSpace: 'pre-wrap', ...(m.role === 'user'
                ? { background: 'var(--bg2)', border: '1px solid var(--line)', borderTopRightRadius: 4 }
                : { background: 'linear-gradient(135deg, color-mix(in srgb,var(--gold) 18%,var(--surface)), var(--surface))', border: '1px solid color-mix(in srgb,var(--gold) 30%,transparent)', borderTopLeftRadius: 4 }) }}>
                {m.role === 'assistant' && <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gold)', marginBottom: 5 }}>✨ دستیار هوشمند</div>}
                {m.text}
              </div>
            </div>
          ))}
          {sending && <div style={{ alignSelf: 'flex-end', fontSize: 12.5, color: 'var(--gold)', padding: '6px 4px' }}>✨ در حال فکر کردن…</div>}
        </div>

        <form onSubmit={e => { e.preventDefault(); ask(input) }} style={{ padding: 14, borderTop: '1px solid var(--line)', display: 'flex', gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="سؤالت را بنویس…" style={{ ...inputStyle, flex: 1 }} />
          <button type="submit" disabled={sending || !input.trim()} style={{ padding: '9px 22px', borderRadius: 10, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 14, border: 'none', cursor: sending ? 'default' : 'pointer', fontFamily: FONT, opacity: sending || !input.trim() ? .6 : 1 }}>ارسال</button>
        </form>
      </div>
    </div>
  )
}
