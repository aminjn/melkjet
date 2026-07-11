'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

// فاز ۵۸ (فیدبک: «خیلی بد است مستقیم برود توی پلن‌ها؛ اول باید یک چیزی ببیند بعد پول بدهد»):
// دیگر قفلِ تمام‌صفحه نیست — کاربرِ بدونِ پلن واردِ پنلش می‌شود و همه‌چیز را «می‌بیند»
// (GETها آزادند)، فقط اقدام‌ها در API قفل‌اند. این کامپوننت صرفاً بنرِ غیرمسدودکنندهٔ
// «حالتِ مشاهده» را پایینِ داشبورد نشان می‌دهد، با دکمهٔ ارتقا و قابلِ بستن.
// تصمیمِ قفل سمتِ سرور است (access.dashLocked از /api/auth/profile — اجتماعِ ماژول‌های
// پلن‌های فعالِ همان داشبورد)؛ سوپرادمین و حالتِ خاموشِ enforce معاف‌اند.
const DASH_PATHS: Record<string, string> = {
  '/pros': 'پنل مشاور', '/agency': 'پنل آژانس', '/builder': 'پنل سازنده', '/materials': 'پنل فروشگاه',
  '/buyer': 'پنل من', '/owner': 'پنل مالک', '/legal': 'پنل حقوقی', '/architect': 'پنل معمار',
  '/contractor': 'پنل پیمانکار', '/appraiser': 'پنل کارشناس', '/lawfirm': 'پنل دفتر حقوقی',
  '/finance': 'پنل بانک و بیمه', '/notary': 'پنل دفترخانه',
}

export default function PlanLock() {
  const [access, setAccess] = useState<any>(null)
  const [hidden, setHidden] = useState(false)
  // فاز ۶۱: مسیر با usePathname تا با ناوبریِ کلاینتی به‌روز بماند —
  // قبلاً یک‌بار موقعِ mount خوانده می‌شد و بنر بعد از رفتن به صفحاتِ دیگر (مثلاً بازی) می‌ماند.
  const path = usePathname() || ''
  const hit = Object.keys(DASH_PATHS).some(k => path === k || path.startsWith(k + '/'))
  useEffect(() => {
    if (!hit) { setAccess(null); return }
    try { if (sessionStorage.getItem('mj_planbanner_hide') === '1') setHidden(true) } catch {}
    let cancelled = false
    fetch('/api/auth/profile', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d?.access) setAccess(d.access) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [path, hit])
  if (hidden || !access || !access.dashLocked) return null
  const dashKey = Object.keys(DASH_PATHS).find(k => path === k || path.startsWith(k + '/'))
  // بنر فقط روی داشبوردِ خودِ کاربر — صفحاتِ دیگر گیت‌های خودشان را دارند
  if (!dashKey || dashKey !== access.dashboard) return null
  const dismiss = () => { setHidden(true); try { sessionStorage.setItem('mj_planbanner_hide', '1') } catch {} }
  return (
    <div dir="rtl" style={{ position: 'fixed', bottom: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 9990, width: 'min(680px, calc(100vw - 24px))', background: 'var(--surface, #14161c)', border: '1px solid var(--goldDim, #8a743a)', borderRadius: 14, padding: '12px 16px', boxShadow: '0 12px 36px -10px rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 20, lineHeight: 1 }}>👀</span>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text, #eee)' }}>حالتِ مشاهده — پلنِ فعال نداری</div>
        <div style={{ fontSize: 11.5, color: 'var(--muted, #9aa)', marginTop: 2, lineHeight: 1.9 }}>همه‌چیز را می‌توانی ببینی؛ برای «انجامِ» کارها (ثبت، ارسال، ایمپورت، AI و…) یکی از پلن‌ها را فعال کن. داده‌هایت همیشه محفوظ است.</div>
      </div>
      <a href="/pricing" style={{ background: 'linear-gradient(140deg,var(--gold2,#e8c96a),var(--gold,#d4af37))', color: '#16140f', borderRadius: 10, padding: '9px 18px', fontWeight: 800, fontSize: 12.5, textDecoration: 'none', whiteSpace: 'nowrap' }}>⭐ مشاهدهٔ پلن‌ها</a>
      <button onClick={dismiss} title="بستن" style={{ background: 'transparent', border: '1px solid var(--line2, #333)', color: 'var(--muted, #9aa)', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', fontSize: 14, lineHeight: 1, flexShrink: 0 }}>×</button>
    </div>
  )
}
