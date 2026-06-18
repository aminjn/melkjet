'use client'
import { useEffect, useState } from 'react'

// نام پنل هر مسیر داشبورد
const DASH_LABEL: Record<string, string> = {
  '/admin': 'پنل مدیریت', '/builder': 'پنل سازنده', '/pros': 'پنل مشاور',
  '/agency': 'پنل آژانس', '/materials': 'پنل فروشگاه', '/owner': 'پنل من',
  '/buyer': 'پنل من', '/legal': 'پنل حقوقی',
}

// نوار شناور «بازگشت به پنل» — همیشه پیداست تا کاربر از پنل خودش گم نشود.
// فقط برای کاربرِ واردشده نمایش داده می‌شود و دقیقاً به داشبورد خودش برمی‌گردد.
export default function PanelReturnBar({ tool }: { tool: string }) {
  const [dash, setDash] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/profile')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d && d.dash) setDash(d.dash as string) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  if (!dash) return null
  const label = DASH_LABEL[dash] || 'پنل من'
  return (
    <a
      href={dash}
      dir="rtl"
      style={{
        position: 'fixed', top: 10, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 16px', borderRadius: 999, textDecoration: 'none',
        background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f',
        fontSize: 12.5, fontWeight: 800, fontFamily: 'inherit',
        boxShadow: '0 8px 24px -8px rgba(0,0,0,.5)', whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 15, lineHeight: 1 }}>‹</span>
      <span>بازگشت به {label}</span>
      <span style={{ opacity: .6, fontWeight: 600 }}>• {tool}</span>
    </a>
  )
}
