'use client'
import { useState } from 'react'

// نمایشِ شمارهٔ سازنده فقط برای کاربرِ واردشده. تا قبلِ ورود، شماره اصلاً به مرورگر نمی‌رود.
// با کلیک، اگر کاربر وارد نشده باشد به /auth می‌رود؛ وگرنه شماره از سرور می‌آید و تماس ثبت می‌شود.
export default function RevealPhone({
  builderId, projectHashId, projectName, variant = 'solid', label = 'نمایشِ شمارهٔ تماس',
}: {
  builderId: string; projectHashId?: string; projectName?: string
  variant?: 'solid' | 'ghost'; label?: string
}) {
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const reveal = async () => {
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/contact-reveal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ builderId, projectHashId, projectName }) })
      const d = await r.json().catch(() => ({}))
      if (r.status === 401 || d.login) { window.location.href = `/auth?next=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/')}`; return }
      if (d.ok && d.phone) setPhone(d.phone)
      else setErr(d.error || 'خطا در دریافتِ شماره')
    } catch { setErr('خطا در ارتباط') } finally { setBusy(false) }
  }

  const base: React.CSSProperties = {
    display: 'block', width: '100%', boxSizing: 'border-box', textAlign: 'center', borderRadius: 12,
    padding: '13px 18px', fontWeight: 800, fontSize: 14.5, fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'none',
  }
  const solid: React.CSSProperties = { ...base, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', border: 'none' }
  const ghost: React.CSSProperties = { ...base, background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--line2)' }
  const st = variant === 'ghost' ? ghost : solid

  if (phone) return <a href={`tel:${phone}`} style={{ ...solid, direction: 'ltr' }}>☎ {phone}</a>
  return (
    <div>
      <button onClick={reveal} disabled={busy} style={st}>{busy ? 'در حال دریافت…' : `☎ ${label}`}</button>
      <div style={{ fontSize: 11, color: 'var(--faint)', textAlign: 'center', marginTop: 6 }}>{err || 'برای دیدنِ شماره باید وارد شوید'}</div>
    </div>
  )
}
