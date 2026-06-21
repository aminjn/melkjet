'use client'
import { useEffect, useState } from 'react'

// نوارِ شناورِ «شما در حال مشاهدهٔ پنلِ کاربر هستید» — وقتی سوپرادمین
// با «ورود به پنل کاربر» وارد حساب دیگری شده باشد، در همهٔ صفحات دیده می‌شود.
interface ImpStatus { active: boolean; target?: string; name?: string }

export default function ImpersonationBar() {
  const [st, setSt] = useState<ImpStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/impersonate')
      .then(r => r.ok ? r.json() : { active: false })
      .then(d => { if (!cancelled) setSt(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (!st?.active) return null

  const stop = async () => {
    await fetch('/api/admin/impersonate', { method: 'DELETE' }).catch(() => {})
    window.location.href = '/admin'
  }

  return (
    <div style={{
      position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, display: 'flex', alignItems: 'center', gap: 14,
      background: 'linear-gradient(135deg,#3a2a00,#241a00)',
      border: '1px solid var(--gold)', borderRadius: 999,
      padding: '9px 10px 9px 18px', boxShadow: '0 10px 30px -8px rgba(0,0,0,.6)',
      maxWidth: '94vw',
    }} dir="rtl">
      <span style={{ fontSize: 13, color: '#f3d98a', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        👁 مشاهدهٔ پنل: <b style={{ color: '#fff' }}>{st.name || st.target}</b>
      </span>
      <button onClick={stop} style={{
        background: 'var(--gold)', color: '#1a1200', border: 'none', borderRadius: 999,
        padding: '7px 16px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
        whiteSpace: 'nowrap', flexShrink: 0,
      }}>
        خروج و بازگشت به ادمین
      </button>
    </div>
  )
}
