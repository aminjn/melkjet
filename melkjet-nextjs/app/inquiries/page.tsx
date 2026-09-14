'use client'
import { useEffect, useState, useCallback } from 'react'

// «استعلام‌ها» — یک صفحه برای هر دو نقش. پیش از این پاسخِ فروشنده فقط در سندِ خودش
// می‌نشست و پرسنده هیچ جایی برای دیدنش نداشت؛ و صفحه‌ای که ساخته شد به هیچ منویی وصل
// نبود. حالا از منوی همهٔ پنل‌ها در دسترس است.

type Kind = 'materials' | 'property' | 'pro'
type Item = { id: string; kind: Kind; title: string; sub?: string; note?: string; status: 'new' | 'answered'; reply?: string; createdAt: number; counterparty: string; href?: string; answerHref?: string; role?: string }

const KIND_LABEL: Record<Kind, string> = { materials: '\u0645\u0635\u0627\u0644\u062d', property: '\u0645\u0644\u06a9', pro: '\u0645\u062a\u062e\u0635\u0635' }
function KindChip({ k }: { k: Kind }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 6, padding: '2px 7px', color: 'var(--muted)', border: '1px solid var(--line)' }}>{KIND_LABEL[k]}</span>
}

const fa = (n: number) => n.toLocaleString('fa-IR')
const dateFa = (ms: number) => new Date(ms).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })
const CARD: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px' }

function Pill({ done }: { done: boolean }) {
  return <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '3px 10px', color: done ? '#2f7d4f' : '#8a6a1e', background: done ? 'rgba(95,180,120,.12)' : 'rgba(200,160,60,.12)', border: `1px solid ${done ? 'rgba(95,180,120,.45)' : 'rgba(200,160,60,.45)'}` }}>{done ? 'پاسخ داده شد' : 'در انتظارِ پاسخ'}</span>
}

// One reply box for all three flows. Replying used to be possible only inside
// each role's own panel, and the professional flow had nowhere at all.
function ReplyBox({ item, onDone }: { item: Item; onDone: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const send = async () => {
    const t = text.trim()
    if (!t) return
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/inquiries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: item.kind, id: item.id, role: item.role, reply: t }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || d.error) { setErr(d.error || `\u062e\u0637\u0627\u06cc ${r.status}`); return }
      setText(''); onDone()
    } catch { setErr('\u0627\u0631\u0633\u0627\u0644 \u0646\u0634\u062f') } finally { setBusy(false) }
  }
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={'\u067e\u0627\u0633\u062e\u0650 \u062e\u0648\u062f \u0631\u0627 \u0628\u0646\u0648\u06cc\u0633\u06cc\u062f\u2026'}
          style={{ flex: 1, padding: '8px 10px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13 }} />
        <button onClick={send} disabled={busy} style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: 'var(--gold)', color: '#16140f', fontSize: 12.5, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
          {'\u0627\u0631\u0633\u0627\u0644\u0650 \u067e\u0627\u0633\u062e'}
        </button>
      </div>
      {err ? <div style={{ fontSize: 11.5, color: '#f87171', marginTop: 6 }}>{err}</div> : null}
      {item.answerHref ? <div style={{ fontSize: 11.5, marginTop: 6 }}><a href={item.answerHref} style={{ color: 'var(--muted)' }}>{'\u06cc\u0627 \u062f\u0631 \u067e\u0646\u0644 \u067e\u0627\u0633\u062e \u0628\u062f\u0647 \u2190'}</a></div> : null}
    </div>
  )
}

export default function InquiriesPage() {
  const [tab, setTab] = useState<'sent' | 'recv'>('sent')
  const [sent, setSent] = useState<Item[] | null>(null)
  const [recv, setRecv] = useState<Item[] | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(() => {
    fetch('/api/inquiries').then(async r => {
      if (r.status === 401) { window.location.href = `/auth?next=${encodeURIComponent('/inquiries')}`; return }
      const d = await r.json().catch(() => ({}))
      if (d?.ok) { setSent(d.sent || []); setRecv(d.received || []) } else setFailed(true)
    }).catch(() => setFailed(true))
  }, [])
  useEffect(() => { load() }, [load])

  const tabBtn = (k: 'sent' | 'recv', label: string, n: number | null) => (
    <button onClick={() => setTab(k)} style={{ padding: '8px 16px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: tab === k ? 800 : 600, border: `1px solid ${tab === k ? 'var(--gold)' : 'var(--line)'}`, background: tab === k ? 'var(--goldDim)' : 'transparent', color: tab === k ? 'var(--gold)' : 'var(--muted)' }}>
      {label}{n !== null && n > 0 ? ` (${fa(n)})` : ''}
    </button>
  )

  return (
    <main dir="rtl" style={{ maxWidth: 780, margin: '0 auto', padding: '28px 16px 80px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>استعلام‌ها</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 2 }}>
          استعلام‌هایی که فرستاده‌ای و آنهایی که دریافت کرده‌ای. وقتی طرفِ مقابل پاسخ بدهد، اعلان هم برایت می‌آید.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {tabBtn('sent', 'فرستاده‌ها', sent ? sent.length : null)}
        {tabBtn('recv', 'دریافتی‌ها', recv ? recv.length : null)}
      </div>

      {failed && <div style={{ fontSize: 13, color: 'var(--muted)' }}>فهرست نیامد — صفحه را تازه کن.</div>}
      {!failed && sent === null && <div style={{ fontSize: 13, color: 'var(--muted)' }}>در حالِ بارگذاری…</div>}

      {tab === 'sent' && sent && sent.length === 0 && (
        <div style={{ ...CARD, fontSize: 13.5, color: 'var(--muted)', lineHeight: 2 }}>
          {'\u0647\u0646\u0648\u0632 \u0627\u0633\u062a\u0639\u0644\u0627\u0645\u06cc \u0646\u0641\u0631\u0633\u062a\u0627\u062f\u0647\u200c\u0627\u06cc \u2014 \u0627\u0632 \u0635\u0641\u062d\u0647\u0654 \u0647\u0631 \u0641\u0631\u0648\u0634\u0646\u062f\u0647\u0654 \u0645\u0635\u0627\u0644\u062d \u06cc\u0627 \u0647\u0631 \u0645\u0644\u06a9 \u0645\u06cc\u200c\u062a\u0648\u0627\u0646\u06cc \u0628\u067e\u0631\u0633\u06cc.'}{' '}
          <a href="/materials" style={{ color: 'var(--gold)' }}>{'\u0641\u0631\u0648\u0634\u0646\u062f\u06af\u0627\u0646\u0650 \u0645\u0635\u0627\u0644\u062d'}</a>
        </div>
      )}

      {tab === 'sent' && sent && sent.map(q => {
        const ok = q.status === 'answered' && !!q.reply
        return (
          <div key={q.id} style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <b style={{ fontSize: 14.5 }}>{q.title}</b><KindChip k={q.kind} />
              {q.sub ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>· {q.sub}</span> : null}
              <span style={{ flex: 1 }} /><Pill done={ok} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
              {q.href ? <a href={q.href} style={{ color: 'var(--gold)', textDecoration: 'none' }}>{q.counterparty}</a> : q.counterparty}
              {' · '}{dateFa(q.createdAt)}
            </div>
            {q.note ? <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.9 }}>یادداشتِ تو: {q.note}</div> : null}
            {ok && (
              <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(95,180,120,.07)', border: '1px solid rgba(95,180,120,.3)', fontSize: 13, lineHeight: 2 }}>
                <b style={{ fontSize: 12 }}>{'\u067e\u0627\u0633\u062e:'}</b>
                <div style={{ marginTop: 4 }}>{q.reply}</div>
              </div>
            )}
          </div>
        )
      })}

      {tab === 'recv' && recv && recv.length === 0 && (
        <div style={{ ...CARD, fontSize: 13.5, color: 'var(--muted)', lineHeight: 2 }}>
          {'\u0627\u0633\u062a\u0639\u0644\u0627\u0645\u06cc \u062f\u0631\u06cc\u0627\u0641\u062a \u0646\u06a9\u0631\u062f\u0647\u200c\u0627\u06cc.'}
        </div>
      )}

      {tab === 'recv' && recv && recv.map(q => {
        const ok = q.status === 'answered' && !!q.reply
        return (
          <div key={q.id} style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <b style={{ fontSize: 14.5 }}>{q.title}</b><KindChip k={q.kind} />
              {q.sub ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>· {q.sub}</span> : null}
              <span style={{ flex: 1 }} /><Pill done={ok} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{'\u0627\u0632 '}{q.counterparty} · {dateFa(q.createdAt)}</div>
            {q.note ? <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.9 }}>{q.note}</div> : null}
            {ok
              ? <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(95,180,120,.07)', border: '1px solid rgba(95,180,120,.3)', fontSize: 13, lineHeight: 2 }}>
                  <b style={{ fontSize: 12 }}>پاسخِ تو:</b><div style={{ marginTop: 4 }}>{q.reply}</div>
                </div>
              : <ReplyBox item={q} onDone={load} />}
          </div>
        )
      })}
    </main>
  )
}
