'use client'
import { useState } from 'react'

// addPublicRequest is reached from here. Kept as a client island so the
// provider page stays static (revalidate = 1800).
export default function ProInquiryForm({ type, slug }: { type: string; slug: string }) {
  const [kind, setKind] = useState('')
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<{ text: string; href?: string; cta?: string } | null>(null)

  const send = async () => {
    if (!detail.trim()) return
    setBusy(true); setErr(null)
    try {
      const r = await fetch('/api/pro-inquiry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, slug, kind, detail }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.status === 401) {
        setErr({ text: d.error || '\u0628\u0631\u0627\u06cc \u0627\u0631\u0633\u0627\u0644\u0650 \u0627\u0633\u062a\u0639\u0644\u0627\u0645 \u0648\u0627\u0631\u062f \u0634\u0648\u06cc\u062f',
          href: '/auth?next=' + encodeURIComponent(location.pathname), cta: '\u0648\u0631\u0648\u062f' })
        return
      }
      if (!r.ok || d.error) { setErr({ text: d.error || '\u0627\u0631\u0633\u0627\u0644 \u0646\u0634\u062f' }); return }
      setSent(true); setKind(''); setDetail('')
    } catch { setErr({ text: '\u0627\u0631\u0633\u0627\u0644 \u0646\u0634\u062f' }) } finally { setBusy(false) }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13 }

  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 20, marginBottom: 22 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 6px' }}>{'\u0627\u0633\u062a\u0639\u0644\u0627\u0645 \u0627\u0632 \u0627\u06cc\u0646 \u0645\u062a\u062e\u0635\u0635'}</h2>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 14px', lineHeight: 1.9 }}>
        {'\u067e\u0631\u0633\u0634\u0650 \u062e\u0648\u062f \u0631\u0627 \u0628\u0646\u0648\u06cc\u0633\u06cc\u062f\u061b \u067e\u0627\u0633\u062e \u0628\u0627 \u0627\u0639\u0644\u0627\u0646 \u0648 \u062f\u0631 \u00ab\u0627\u0633\u062a\u0639\u0644\u0627\u0645\u200c\u0647\u0627\u06cc \u0645\u0646\u00bb \u0628\u0647 \u0634\u0645\u0627 \u0645\u06cc\u200c\u0631\u0633\u062f.'}
      </p>
      {sent ? (
        <div style={{ fontSize: 13, color: '#5fb478', lineHeight: 2 }}>
          {'\u2713 \u0627\u0633\u062a\u0639\u0644\u0627\u0645 \u0641\u0631\u0633\u062a\u0627\u062f\u0647 \u0634\u062f.'}{' '}
          <a href="/inquiries" style={{ color: 'var(--gold)' }}>{'\u0627\u0633\u062a\u0639\u0644\u0627\u0645\u200c\u0647\u0627\u06cc \u0645\u0646'}</a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={kind} onChange={e => setKind(e.target.value)} placeholder={'\u0645\u0648\u0636\u0648\u0639 (\u0627\u062e\u062a\u06cc\u0627\u0631\u06cc)'} style={inp} />
          <textarea value={detail} onChange={e => setDetail(e.target.value)} rows={3} placeholder={'\u067e\u0631\u0633\u0634\u0650 \u062e\u0648\u062f \u0631\u0627 \u0628\u0646\u0648\u06cc\u0633\u06cc\u062f\u2026'} style={{ ...inp, resize: 'vertical' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={send} disabled={busy || !detail.trim()} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'var(--gold)', color: '#16140f', fontSize: 13, fontWeight: 700, cursor: busy || !detail.trim() ? 'default' : 'pointer', opacity: busy || !detail.trim() ? 0.55 : 1, fontFamily: 'inherit' }}>
              {'\u0627\u0631\u0633\u0627\u0644\u0650 \u0627\u0633\u062a\u0639\u0644\u0627\u0645'}
            </button>
            {err ? (
              <span style={{ fontSize: 12, color: '#f87171' }}>
                {err.text}{err.href ? <> {' '}<a href={err.href} style={{ color: 'var(--gold)' }}>{err.cta}</a></> : null}
              </span>
            ) : null}
          </div>
        </div>
      )}
    </section>
  )
}
