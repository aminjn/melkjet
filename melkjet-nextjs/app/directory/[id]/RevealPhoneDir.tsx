'use client'
import { useState } from 'react'

// فاز ۳۰۴د — دکمهٔ «نمایشِ شماره» برای متخصصِ دایرکتوری. شمارهٔ کامل در HTML نیست (فقط توکنِ
// رمزنگاری‌شده)؛ با کلیک از سرور می‌آید و همان کلیک در آمارِ متخصص شمرده می‌شود.
const faDigit = (s: string) => String(s || '').replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])
type Ph = { token: string; mask: string; label?: string }

export default function RevealPhoneDir({ id, phones }: { id: string; phones: Ph[] }) {
  const [shown, setShown] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState<number | null>(null)
  if (!phones.length) return null

  const reveal = async (i: number, token: string) => {
    if (busy !== null || shown[i]) return
    setBusy(i)
    try {
      const r = await fetch('/api/directory/reveal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, token }) })
      const d = await r.json().catch(() => null)
      if (d?.ok && d.phone) setShown(s => ({ ...s, [i]: String(d.phone) }))
    } catch { /* شبکه قطع — دکمه دوباره قابلِ کلیک می‌ماند */ } finally { setBusy(null) }
  }

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {phones.map((p, i) => {
        const val = shown[i]
        if (val) return (
          <a key={i} href={`tel:${val.replace(/[^\d+]/g, '')}`} style={{ background: 'var(--gold)', color: '#241a06', fontWeight: 800, borderRadius: 11, padding: '9px 16px', fontSize: 13.5, textDecoration: 'none', direction: 'ltr', letterSpacing: '.3px' }}>☎ {faDigit(val)}</a>
        )
        return (
          <button key={i} type="button" onClick={() => reveal(i, p.token)} disabled={busy !== null} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--gold)', color: '#241a06', fontWeight: 800, borderRadius: 11, padding: '9px 16px', fontSize: 13.5, border: 'none', cursor: busy !== null ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
            <span style={{ direction: 'ltr', letterSpacing: '1px', opacity: .8 }}>{faDigit(p.mask)} ··· ····</span>
            <span>{busy === i ? 'یک لحظه…' : `نمایشِ شماره${p.label ? ` (${p.label})` : ''}`}</span>
          </button>
        )
      })}
    </div>
  )
}
