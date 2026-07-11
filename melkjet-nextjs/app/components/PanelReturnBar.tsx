'use client'
import { useEffect, useState } from 'react'

// نام پنل هر مسیر داشبورد
const DASH_LABEL: Record<string, string> = {
  '/admin': 'پنل مدیریت', '/builder': 'پنل سازنده', '/pros': 'پنل مشاور',
  '/agency': 'پنل آژانس', '/materials': 'پنل فروشگاه',
  '/buyer': 'پنل من', '/legal': 'پنل حقوقی',
  '/architect': 'پنل معمار', '/contractor': 'پنل پیمانکار', '/appraiser': 'پنل کارشناس',
  '/lawfirm': 'پنل دفتر حقوقی', '/finance': 'پنل بانک و بیمه', '/notary': 'پنل دفترخانه',
}

// نوار شناور «بازگشت به پنل» — همیشه پیداست تا کاربر از پنل خودش گم نشود.
// فقط برای کاربرِ واردشده نمایش داده می‌شود و دقیقاً به داشبورد خودش برمی‌گردد.
// فاز ۵۱ (اعمالِ پلن‌ها): ماژولِ لازمِ هر صفحهٔ ابزار — اگر پلنِ کاربر آن را نداشته باشد، قفلِ تمام‌صفحه.
const TOOL_PERM: Record<string, { perm: string; label: string }> = {
  '/crm': { perm: 'crm', label: 'CRM و لیدها' },
  '/marketing': { perm: 'marketing', label: 'بازاریابی و کمپین' },
  '/workflow': { perm: 'automation', label: 'اتوماسیون' },
  '/website-builder': { perm: 'website', label: 'سایت‌ساز' },
}

export default function PanelReturnBar({ tool }: { tool: string }) {
  const [dash, setDash] = useState<string | null>(null)
  const [access, setAccess] = useState<any>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/profile')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d) { if (d.dash) setDash(d.dash as string); if (d.access) setAccess(d.access) } })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  if (!dash) return null
  const label = DASH_LABEL[dash] || 'پنل من'
  // قفلِ پلن: فقط وقتی enforcement روشن است و پلنِ کاربر ماژولِ این صفحه را ندارد (سوپرادمین معاف)
  const need = typeof window !== 'undefined' ? TOOL_PERM[Object.keys(TOOL_PERM).find(k => window.location.pathname.startsWith(k)) || ''] : undefined
  if (need && access && access.enforce && !access.isAdmin && !(access.permissions || []).includes(need.perm)) {
    return (
      <div dir="rtl" style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(8,9,12,.94)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ maxWidth: 420, textAlign: 'center', background: 'var(--surface, #14161c)', border: '1px solid var(--goldDim, #8a743a)', borderRadius: 18, padding: '34px 26px', boxShadow: '0 16px 48px -12px rgba(0,0,0,.6)' }}>
          <div style={{ fontSize: 42 }}>🔒</div>
          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 10, color: 'var(--text, #eee)' }}>«{need.label}» در پلنِ فعلی‌ات نیست</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted, #9aa)', marginTop: 8, lineHeight: 2 }}>پلنِ فعلی: <b>{access.planName || 'رایگان'}</b> — برای فعال‌شدنِ این بخش، پلنت را ارتقا بده؛ همهٔ داده‌هایت سرِ جایش می‌ماند.</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
            <a href="/pricing" style={{ background: 'linear-gradient(140deg,var(--gold2,#e8c96a),var(--gold,#d4af37))', color: '#16140f', borderRadius: 12, padding: '10px 22px', fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>⭐ مشاهدهٔ پلن‌ها و ارتقا</a>
            <a href={dash} style={{ border: '1px solid var(--line2, #333)', color: 'var(--text, #eee)', borderRadius: 12, padding: '10px 18px', fontSize: 13, textDecoration: 'none' }}>بازگشت به {label}</a>
          </div>
        </div>
      </div>
    )
  }
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
