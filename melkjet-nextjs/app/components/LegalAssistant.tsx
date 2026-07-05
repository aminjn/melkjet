'use client'
import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'

// دستیارِ حقوقیِ شناور — روی همهٔ پنل‌ها/داشبوردها دیده می‌شود تا کاربر بدونِ ترکِ پنل،
// سؤالِ حقوقی (قرارداد، سند، حقوقِ خریدار/فروشنده) بپرسد. همان مغزِ صفحهٔ /legal
// (agent=chat با پیش‌وندِ «مشاور حقوقی») را می‌زند.
interface Msg { role: 'user' | 'assistant'; content: string }

// مسیرهای پنل/داشبورد که دستیار باید در آن‌ها باشد. خودِ /legal مستثناست (پنلِ مشاورِ حقوقی، تبِ دستیارِ خودش را دارد).
const PANEL_ROUTES = ['/admin', '/agency', '/pros', '/builder', '/materials', '/owner', '/buyer', '/crm', '/marketing', '/workflow', '/website-builder', '/content', '/plan-ai', '/architect', '/contractor', '/appraiser', '/lawfirm', '/finance', '/notary']

const chips = ['سند مالکیت', 'قرارداد اجاره', 'حقوق مستاجر', 'مبایعه‌نامه', 'کد رهگیری']

export default function LegalAssistant() {
  const pathname = usePathname() || ''
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [messages, setMessages] = useState<Msg[]>([])
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, sending])

  const onPanel = PANEL_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))
  if (!onPanel) return null

  const send = async (text?: string) => {
    const content = (text ?? msg).trim()
    if (!content || sending) return
    setMsg('')
    setMessages(m => [...m, { role: 'user', content }])
    setSending(true)
    try {
      const r = await fetch('/api/ai/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'chat', input: `به‌عنوان مشاور حقوقی املاک پاسخ بده: ${content}` }),
      })
      const d = await r.json().catch(() => ({}))
      setMessages(m => [...m, { role: 'assistant', content: d.ok && d.text ? d.text : `⚠ ${d.error || 'خطا در پاسخ'}` }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: '⚠ خطا در ارتباط با سرور' }])
    } finally { setSending(false) }
  }

  return (
    <>
      <button onClick={() => setOpen(o => !o)} aria-label="دستیار حقوقی" className="mj-legal-btn"
        style={{ position: 'fixed', bottom: 24, insetInlineEnd: 24, zIndex: 70, width: 54, height: 54, borderRadius: 16, border: '1px solid var(--gold)', cursor: 'pointer', background: 'var(--surface)', color: 'var(--gold)', fontSize: 24, fontWeight: 800, boxShadow: '0 14px 34px -12px rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '.2s' }}>
        ⚖️
      </button>
      {open && (
        <div className="mj-legal-panel" style={{ position: 'fixed', bottom: 88, insetInlineEnd: 24, zIndex: 70, width: 'min(380px,calc(100vw - 48px))', background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 20, boxShadow: 'var(--shadow)', overflow: 'hidden', animation: 'rise .3s both', display: 'flex', flexDirection: 'column', maxHeight: 'min(560px, calc(100vh - 140px))' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 11, flexShrink: 0, background: 'var(--bg2)' }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16140f', fontWeight: 800, fontSize: 18 }}>⚖️</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text)' }}>دستیار حقوقی</div>
              <div style={{ fontSize: 11.5, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
                آنلاین · مشاورهٔ حقوقی ملکی
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
          </div>

          <div ref={scrollRef} style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
            <div style={{ background: 'var(--bg2)', borderRadius: '13px 13px 13px 4px', padding: '12px 14px', fontSize: 13.5, lineHeight: 1.8, color: 'var(--text)' }}>
              سلام ⚖️ من دستیارِ حقوقیِ ملک‌جت هستم. دربارهٔ قراردادها، سند مالکیت، مبایعه‌نامه، حقوقِ خریدار و مستاجر بپرس.
            </div>
            {messages.length === 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
                {chips.map(c => (
                  <button key={c} onClick={() => send(c)} style={{ padding: '7px 12px', borderRadius: 999, border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)', fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer' }}>{c}</button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-start' : 'flex-end', marginTop: 12 }}>
                <div style={{ maxWidth: '85%', background: m.role === 'user' ? 'linear-gradient(140deg,var(--gold2),var(--gold))' : 'var(--bg2)', color: m.role === 'user' ? '#16140f' : 'var(--text)', borderRadius: m.role === 'user' ? '13px 13px 4px 13px' : '13px 13px 13px 4px', padding: '10px 13px', fontSize: 13.5, lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{m.content}</div>
              </div>
            ))}
            {sending && <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--gold)' }}>در حال بررسی…</div>}
          </div>

          <div style={{ padding: '12px 16px 16px', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 8, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 13, padding: '8px 8px 8px 14px', alignItems: 'center' }}>
              <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }} placeholder="سؤالِ حقوقی‌ات را بنویس…"
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13.5 }} />
              <button onClick={() => send()} disabled={sending} style={{ width: 34, height: 34, border: 'none', borderRadius: 9, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', cursor: 'pointer', fontWeight: 800, opacity: sending ? 0.6 : 1 }}>↑</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
