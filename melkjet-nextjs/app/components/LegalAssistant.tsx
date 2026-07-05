'use client'
import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'

// دستیارِ حقوقیِ شناور — روی همهٔ پنل‌ها/داشبوردها دیده می‌شود. علاوه بر پاسخِ AI، کاربر را
// به سمتِ «وکلای برتر/پروموت‌شده» (بر اساسِ امتیاز) هدایت می‌کند تا مشاورهٔ انسانی هم بگیرد.
interface Msg { role: 'user' | 'assistant'; content: string }
interface Pro { id: string; name: string; area?: string; rating?: string; tags?: string[]; url?: string; hasPhone?: boolean; promoted?: boolean }

const PANEL_ROUTES = ['/admin', '/agency', '/pros', '/builder', '/materials', '/owner', '/buyer', '/crm', '/marketing', '/workflow', '/website-builder', '/content', '/plan-ai', '/architect', '/contractor', '/appraiser', '/lawfirm', '/finance', '/notary']
const chips = ['سند مالکیت', 'قرارداد اجاره', 'حقوق مستاجر', 'مبایعه‌نامه', 'کد رهگیری']
const ratingNum = (r?: string) => { const n = parseFloat(String(r || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))); return isNaN(n) ? -1 : n }

export default function LegalAssistant() {
  const pathname = usePathname() || ''
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [messages, setMessages] = useState<Msg[]>([])
  const [sending, setSending] = useState(false)
  const [pros, setPros] = useState<Pro[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, sending])
  // وکلای حقوقی را یک‌بار (هنگامِ بازشدن) بگیر و بر اساسِ «پروموت‌شده، سپس امتیاز» مرتب کن.
  useEffect(() => {
    if (!open || pros.length) return
    fetch('/api/directory?category=حقوقی', { cache: 'no-store' }).then(r => r.ok ? r.json() : { items: [] }).then(d => {
      const items: Pro[] = (d.items || []).map((it: any) => ({ id: it.id, name: it.title, area: it.location, rating: it.rating, tags: it.tags, url: it.url, hasPhone: it.hasPhone, promoted: !!it.promoted }))
      items.sort((a, b) => (Number(!!b.promoted) - Number(!!a.promoted)) || (ratingNum(b.rating) - ratingNum(a.rating)))
      setPros(items.slice(0, 3))
    }).catch(() => {})
  }, [open, pros.length])

  const onPanel = PANEL_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))
  if (!onPanel) return null

  const send = async (text?: string) => {
    const content = (text ?? msg).trim()
    if (!content || sending) return
    setMsg('')
    setMessages(m => [...m, { role: 'user', content }])
    setSending(true)
    try {
      const r = await fetch('/api/ai/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: 'chat', input: `به‌عنوان مشاور حقوقی املاک پاسخ بده: ${content}` }) })
      const d = await r.json().catch(() => ({}))
      setMessages(m => [...m, { role: 'assistant', content: d.ok && d.text ? d.text : `⚠ ${d.error || 'خطا در پاسخ'}` }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: '⚠ خطا در ارتباط با سرور' }])
    } finally { setSending(false) }
  }

  return (
    <>
      <style>{`@keyframes mjLegalPulse{0%{box-shadow:0 0 0 0 rgba(201,168,76,.5)}70%{box-shadow:0 0 0 14px rgba(201,168,76,0)}100%{box-shadow:0 0 0 0 rgba(201,168,76,0)}}@media(max-width:560px){.mjlegal-label{display:none!important}}`}</style>
      {/* دکمهٔ پررنگ: قرصِ طلاییِ برچسب‌دار با هالهٔ تپنده */}
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="دستیار حقوقی" className="mj-legal-btn"
          style={{ position: 'fixed', bottom: 24, insetInlineEnd: 24, zIndex: 70, height: 56, padding: '0 20px 0 8px', borderRadius: 30, border: 'none', cursor: 'pointer', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 16px 38px -10px rgba(201,168,76,.6)', animation: 'mjLegalPulse 2.4s infinite', fontFamily: 'inherit' }}>
          <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>⚖️</span>
          <span className="mjlegal-label" style={{ fontSize: 14.5, fontWeight: 800 }}>دستیارِ حقوقی</span>
        </button>
      )}
      {open && (
        <div className="mj-legal-panel" style={{ position: 'fixed', bottom: 24, insetInlineEnd: 24, zIndex: 70, width: 'min(390px,calc(100vw - 48px))', background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 20, boxShadow: 'var(--shadow)', overflow: 'hidden', animation: 'rise .3s both', display: 'flex', flexDirection: 'column', maxHeight: 'min(600px, calc(100vh - 100px))' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 11, flexShrink: 0, background: 'linear-gradient(135deg, color-mix(in srgb,var(--gold) 16%,var(--bg2)), var(--bg2) 75%)' }}>
            <span style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16140f', fontWeight: 800, fontSize: 19 }}>⚖️</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>دستیارِ حقوقیِ ملک‌جت</div>
              <div style={{ fontSize: 11.5, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
                آنلاین · پاسخِ فوری + اتصال به وکیل
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
          </div>

          <div ref={scrollRef} style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
            <div style={{ background: 'var(--bg2)', borderRadius: '13px 13px 13px 4px', padding: '12px 14px', fontSize: 13.5, lineHeight: 1.8, color: 'var(--text)' }}>
              سلام ⚖️ من دستیارِ حقوقیِ ملک‌جت هستم. دربارهٔ قراردادها، سند مالکیت، مبایعه‌نامه، حقوقِ خریدار و مستاجر بپرس — و در صورتِ نیاز، تو را به بهترین وکلا وصل می‌کنم.
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

            {/* وکلای پیشنهادی — پروموت‌شده‌ها اول، سپس امتیاز */}
            {pros.length > 0 && (
              <div style={{ marginTop: 16, borderTop: '1px dashed var(--line2)', paddingTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gold)', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 6 }}>⚖️ وکلای پیشنهادیِ ملک‌جت</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pros.map(p => (
                    <a key={p.id} href={p.url || '#'} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', background: 'var(--bg2)', border: `1px solid ${p.promoted ? 'var(--gold)' : 'var(--line)'}`, borderRadius: 11, textDecoration: 'none', color: 'inherit' }}>
                      <span style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{(p.name || '؟').trim().charAt(0)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                          {p.promoted && <span style={{ fontSize: 9, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, padding: '1px 6px', borderRadius: 999, flexShrink: 0 }}>★ ویژه</span>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{[p.area, ratingNum(p.rating) >= 0 ? `★ ${p.rating}` : null].filter(Boolean).join(' · ')}</div>
                      </div>
                      <span style={{ fontSize: 11.5, color: 'var(--gold)', fontWeight: 700, whiteSpace: 'nowrap' }}>مشاوره ←</span>
                    </a>
                  ))}
                </div>
                <a href="/directory?category=حقوقی" style={{ display: 'block', textAlign: 'center', marginTop: 9, fontSize: 11.5, color: 'var(--muted)', textDecoration: 'none' }}>مشاهدهٔ همهٔ وکلا ↗</a>
              </div>
            )}
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
