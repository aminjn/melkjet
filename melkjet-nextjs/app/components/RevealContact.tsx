'use client'
import { useState } from 'react'

// نمایشِ شمارهٔ آگهی/مشاور فقط برای کاربرِ واردشده (از /api/listing-reveal). تا قبلِ ورود،
// شماره به مرورگر نمی‌رود؛ کلیک = ورود یا دریافتِ شماره + ثبتِ تماس برای صاحبِ آگهی/مشاور.
export default function RevealContact({
  kind, id, label = 'نمایشِ شماره', compact, style,
}: { kind: 'item' | 'advisor'; id: string; label?: string; compact?: boolean; style?: React.CSSProperties }) {
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)

  const reveal = async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/listing-reveal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id }) })
      const d = await r.json().catch(() => ({}))
      if (r.status === 401 || d.login) { window.location.href = `/auth?next=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/')}`; return }
      if (d.ok && d.phone) setPhone(d.phone)
    } catch {} finally { setBusy(false) }
  }

  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: compact ? 9 : 12, padding: compact ? '7px 12px' : '11px 18px',
    fontWeight: 800, fontSize: compact ? 12.5 : 14, fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'none',
    background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', border: 'none', ...style,
  }
  if (phone) return <a href={`tel:${phone}`} style={{ ...base, direction: 'ltr' }}>☎ {phone}</a>
  return <button onClick={reveal} disabled={busy} style={base}>☎ {busy ? '...' : label}</button>
}
