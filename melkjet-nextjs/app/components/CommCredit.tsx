'use client'
import { useEffect, useState } from 'react'

// کارتِ اعتبارِ پیامک/ایمیل — فقط اعتبار + راهنمای ساده. تهیهٔ پکیج در منوی «پلن‌ها و اشتراک» است.
const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')

export default function CommCredit({ channel }: { channel: 'sms' | 'email' }) {
  const [credit, setCredit] = useState<{ sms: number; email: number; token: number }>({ sms: 0, email: 0, token: 0 })

  useEffect(() => {
    fetch('/api/comm').then(r => r.ok ? r.json() : null).then(d => { if (d?.credit) setCredit(d.credit) }).catch(() => {})
  }, [channel])

  const label = channel === 'sms' ? 'پیامک' : 'ایمیل'
  const bal = credit[channel]

  return (
    <div dir="rtl" style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18, fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>{channel === 'sms' ? '✆' : '✉'}</span>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>اعتبارِ {label}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>برای افزایشِ اعتبار، به منوی «پلن‌ها و اشتراک» مراجعه کنید.</div>
        </div>
      </div>
      <div style={{ background: 'var(--goldDim)', border: '1px solid var(--gold)', borderRadius: 999, padding: '7px 16px', fontSize: 15, fontWeight: 900, color: 'var(--gold)' }}>{fa(bal)} <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span></div>
    </div>
  )
}
