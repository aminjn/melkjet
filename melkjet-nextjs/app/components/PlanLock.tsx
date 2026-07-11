'use client'
import { useEffect, useState } from 'react'

// فاز ۵۵ — قفلِ سراسریِ داشبورد بر اساسِ پلن (فیدبک: «هر کسی وارد می‌شود همه‌چیز دارد»).
// فقط روی مسیرهای داشبوردِ نقش‌ها فعال می‌شود (روی صفحاتِ عمومی هیچ fetch اضافه‌ای نمی‌زند).
// تصمیمِ قفل کاملاً سمتِ سرور است (access.dashLocked در /api/auth/profile — از اجتماعِ ماژول‌های
// پلن‌های فعالِ همان داشبورد)؛ این‌جا فقط نمایش است. سوپرادمین و حالتِ خاموشِ enforce معاف‌اند.
const DASH_PATHS: Record<string, string> = {
  '/pros': 'پنل مشاور', '/agency': 'پنل آژانس', '/builder': 'پنل سازنده', '/materials': 'پنل فروشگاه',
  '/buyer': 'پنل من', '/owner': 'پنل مالک', '/legal': 'پنل حقوقی', '/architect': 'پنل معمار',
  '/contractor': 'پنل پیمانکار', '/appraiser': 'پنل کارشناس', '/lawfirm': 'پنل دفتر حقوقی',
  '/finance': 'پنل بانک و بیمه', '/notary': 'پنل دفترخانه',
}

export default function PlanLock() {
  const [access, setAccess] = useState<any>(null)
  const [path, setPath] = useState('')
  useEffect(() => {
    const p = window.location.pathname
    setPath(p)
    const hit = Object.keys(DASH_PATHS).some(k => p === k || p.startsWith(k + '/'))
    if (!hit) return
    let cancelled = false
    fetch('/api/auth/profile', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d?.access) setAccess(d.access) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  if (!access || !access.dashLocked) return null
  const dashKey = Object.keys(DASH_PATHS).find(k => path === k || path.startsWith(k + '/'))
  // قفل فقط روی داشبوردِ خودِ کاربر — صفحاتِ دیگر گیت‌های خودشان را دارند
  if (!dashKey || dashKey !== access.dashboard) return null
  const label = DASH_PATHS[dashKey] || 'پنل'
  return (
    <div dir="rtl" style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(8,9,12,.95)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 440, textAlign: 'center', background: 'var(--surface, #14161c)', border: '1px solid var(--goldDim, #8a743a)', borderRadius: 18, padding: '36px 28px', boxShadow: '0 16px 48px -12px rgba(0,0,0,.6)' }}>
        <div style={{ fontSize: 44 }}>🔒</div>
        <div style={{ fontSize: 17.5, fontWeight: 800, marginTop: 12, color: 'var(--text, #eee)' }}>{label} با پلنِ فعال باز می‌شود</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted, #9aa)', marginTop: 10, lineHeight: 2.1 }}>
          پلنِ فعلی: <b style={{ color: 'var(--text, #ddd)' }}>{access.planName || 'بدون پلن'}</b>
          {access.paid && access.expiresAt ? ' (منقضی‌شده)' : ''} — برای استفاده از امکاناتِ این پنل یکی از پلن‌ها را فعال کن.
          همهٔ داده‌هایت محفوظ می‌ماند و بلافاصله بعد از فعال‌سازی همین‌جا در دسترس است.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
          <a href="/pricing" style={{ background: 'linear-gradient(140deg,var(--gold2,#e8c96a),var(--gold,#d4af37))', color: '#16140f', borderRadius: 12, padding: '11px 24px', fontWeight: 800, fontSize: 13.5, textDecoration: 'none' }}>⭐ مشاهدهٔ پلن‌ها و فعال‌سازی</a>
          <a href="/" style={{ border: '1px solid var(--line2, #333)', color: 'var(--text, #eee)', borderRadius: 12, padding: '11px 18px', fontSize: 13, textDecoration: 'none' }}>بازگشت به سایت</a>
        </div>
      </div>
    </div>
  )
}
