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
  // فاز ۵۸ («اول ببین، بعد پول بده»): دیگر قفلِ تمام‌صفحه نیست — مشاهده آزاد است و
  // اقدام‌ها در API قفل‌اند؛ این‌جا فقط بنرِ غیرمسدودکنندهٔ ارتقا نشان داده می‌شود.
  const need = typeof window !== 'undefined' ? TOOL_PERM[Object.keys(TOOL_PERM).find(k => window.location.pathname.startsWith(k)) || ''] : undefined
  const banner = need && access && access.enforce && !access.isAdmin && !(access.permissions || []).includes(need.perm) ? (
    <div dir="rtl" style={{ position: 'fixed', bottom: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 9990, width: 'min(640px, calc(100vw - 24px))', background: 'var(--surface, #14161c)', border: '1px solid var(--goldDim, #8a743a)', borderRadius: 14, padding: '11px 16px', boxShadow: '0 12px 36px -10px rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 18, lineHeight: 1 }}>👀</span>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text, #eee)' }}>«{need.label}» در پلنِ فعلی‌ات ({access.planName || 'رایگان'}) فعال نیست</div>
        <div style={{ fontSize: 11, color: 'var(--muted, #9aa)', marginTop: 2 }}>مشاهده آزاد است — برای انجامِ عملیات، پلن را ارتقا بده.</div>
      </div>
      <a href="/pricing" style={{ background: 'linear-gradient(140deg,var(--gold2,#e8c96a),var(--gold,#d4af37))', color: '#16140f', borderRadius: 10, padding: '8px 16px', fontWeight: 800, fontSize: 12, textDecoration: 'none', whiteSpace: 'nowrap' }}>⭐ ارتقا</a>
    </div>
  ) : null
  return (<>
    {banner}
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
  </>)
}
