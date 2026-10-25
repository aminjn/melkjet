'use client'
import { useState, useRef, useEffect } from 'react'

interface Card { id: string; title: string; price: string; location: string; image?: string; url: string; facts: string }
interface Ad { enabled?: boolean; title?: string; text?: string; imageUrl?: string; linkUrl?: string; cta?: string }
interface Msg { role: 'user' | 'assistant'; content: string; cards?: Card[]; ad?: Ad }

const DEFAULT_GREETING = 'سلام 👋 من می‌توانم در خرید، فروش، اجاره، تحلیل قیمت و سرمایه‌گذاری کمکت کنم و فایل‌های مناسب را نشانت بدهم. از کجا شروع کنیم؟'
const DEFAULT_CHIPS = ['خونه زیر ۱۰ میلیارد تو تهران', 'آپارتمان برای اجاره', 'تحلیل قیمت یک محله']

export default function AIAssistant() {
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [messages, setMessages] = useState<Msg[]>([])
  const [sending, setSending] = useState(false)
  const [greeting, setGreeting] = useState(DEFAULT_GREETING)
  const [chips, setChips] = useState<string[]>(DEFAULT_CHIPS)
  const [enabled, setEnabled] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const loadedCfg = useRef(false)

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, sending])
  // پیکربندیِ ویجت (خوش‌آمد/دکمه‌ها/روشن‌بودن) را یک‌بار هنگامِ بازشدن بگیر.
  useEffect(() => {
    if (!open || loadedCfg.current) return
    loadedCfg.current = true
    fetch('/api/assistant/ask').then(r => r.ok ? r.json() : null).then(d => {
      if (!d) return
      if (d.enabled === false) setEnabled(false)
      if (d.greeting) setGreeting(d.greeting)
      if (Array.isArray(d.chips) && d.chips.length) setChips(d.chips)
    }).catch(() => {})
  }, [open])

  const send = async (text?: string) => {
    const content = (text ?? msg).trim()
    if (!content || sending) return
    const history = messages.map(m => ({ role: m.role, content: m.content }))
    setMsg('')
    setMessages(m => [...m, { role: 'user', content }])
    setSending(true)
    try {
      const r = await fetch('/api/assistant/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: content, history }) })
      const d = await r.json().catch(() => ({}))
      if (d.ok) setMessages(m => [...m, { role: 'assistant', content: d.reply || '', cards: d.cards || [], ad: d.ad }])
      else setMessages(m => [...m, { role: 'assistant', content: `⚠ ${d.error || 'خطا در پاسخ'}` }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: '⚠ خطا در ارتباط با سرور' }])
    } finally { setSending(false) }
  }

  return (
    <>
      <button onClick={() => setOpen(o => !o)} aria-label="دستیار هوشمند" className="mj-ai-btn"
        style={{ position: 'fixed', bottom: 24, left: 24, zIndex: 60, width: 58, height: 58, borderRadius: 18, border: 'none', cursor: 'pointer', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontSize: 22, fontWeight: 800, boxShadow: '0 14px 34px -10px var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '.2s' }}>
        ✦
      </button>
      {open && (
        <div className="mj-ai-panel" style={{ position: 'fixed', bottom: 92, left: 24, zIndex: 60, width: 'min(380px,calc(100vw - 48px))', background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 20, boxShadow: 'var(--shadow)', overflow: 'hidden', animation: 'rise .35s both', display: 'flex', flexDirection: 'column', maxHeight: 'min(560px, calc(100vh - 140px))' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 11, flexShrink: 0 }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16140f', fontWeight: 800 }}>✦</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text)' }}>دستیار ملک‌جت</div>
              <div style={{ fontSize: 11.5, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3fbf6f', display: 'inline-block' }}></span>
                آنلاین · پاسخ‌گوی شما
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
          </div>

          <div ref={scrollRef} style={{ padding: '18px', overflowY: 'auto', flex: 1 }}>
            <div style={{ background: 'var(--bg2)', borderRadius: '13px 13px 13px 4px', padding: '12px 14px', fontSize: 13.5, lineHeight: 1.8, color: 'var(--text)' }}>
              {enabled ? greeting : 'دستیار موقتاً غیرفعال است.'}
            </div>
            {messages.length === 0 && enabled && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
                {chips.map(c => (
                  <button key={c} onClick={() => send(c)} style={{ padding: '8px 12px', borderRadius: 999, border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer' }}>{c}</button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-start' : 'flex-end', marginTop: 12 }}>
                  <div style={{ maxWidth: '85%', background: m.role === 'user' ? 'linear-gradient(140deg,var(--gold2),var(--gold))' : 'var(--bg2)', color: m.role === 'user' ? '#16140f' : 'var(--text)', borderRadius: m.role === 'user' ? '13px 13px 4px 13px' : '13px 13px 13px 4px', padding: '10px 13px', fontSize: 13.5, lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{m.content}</div>
                </div>
                {!!m.cards?.length && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    {m.cards.map(c => (
                      <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', gap: 10, textDecoration: 'none', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 13, overflow: 'hidden', transition: '.15s' }}>
                        <div style={{ width: 86, height: 86, flexShrink: 0, background: c.image ? `center/cover no-repeat url(${c.image})` : 'linear-gradient(135deg,#3a3530,#211e1b)' }} />
                        <div style={{ flex: 1, minWidth: 0, padding: '9px 10px 9px 0', display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                          {!!c.price && <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--gold)' }}>{c.price}</div>}
                          {!!c.facts && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.facts}</div>}
                          {!!c.location && <div style={{ fontSize: 10.5, color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.location}</div>}
                        </div>
                      </a>
                    ))}
                  </div>
                )}
                {m.ad?.enabled && (m.ad.title || m.ad.text) && (
                  <a href={m.ad.linkUrl || '#'} target={m.ad.linkUrl ? '_blank' : undefined} rel="noopener noreferrer"
                    style={{ display: 'flex', gap: 10, alignItems: 'center', textDecoration: 'none', marginTop: 8, background: 'linear-gradient(135deg,color-mix(in srgb,var(--gold) 14%,transparent),transparent)', border: '1px solid var(--gold)', borderRadius: 13, padding: '10px 12px' }}>
                    {m.ad.imageUrl && <img src={m.ad.imageUrl} alt="" style={{ width: 40, height: 40, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, color: 'var(--faint)', marginBottom: 1 }}>تبلیغ</div>
                      {m.ad.title && <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{m.ad.title}</div>}
                      {m.ad.text && <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6 }}>{m.ad.text}</div>}
                    </div>
                    <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: '#16140f', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', borderRadius: 999, padding: '5px 11px' }}>{m.ad.cta || 'بیشتر'}</span>
                  </a>
                )}
              </div>
            ))}
            {sending && <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--muted)' }}>در حال نوشتن…</div>}
          </div>

          {enabled && (
            <div style={{ padding: '12px 18px 18px', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 8, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 13, padding: '8px 8px 8px 14px', alignItems: 'center' }}>
                <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }} placeholder="پیامت را بنویس…"
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13.5 }} />
                <button onClick={() => send()} disabled={sending} style={{ width: 34, height: 34, border: 'none', borderRadius: 9, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', cursor: 'pointer', fontWeight: 800, opacity: sending ? 0.6 : 1 }}>↑</button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
