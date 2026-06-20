'use client'
import { useEffect } from 'react'

// نگه‌دارندهٔ نشست برای موبایل/PWA:
// اگر بعد از بستن اپ کوکی نشست پاک شده باشد، با توکنِ ذخیره‌شده در localStorage
// به‌صورت خودکار و بی‌صدا کوکی را دوباره می‌سازد تا کاربر مجبور به ورود مجدد نشود.
export default function SessionKeeper() {
  useEffect(() => {
    // در هر بار باز شدن اپ فقط یک‌بار تلاش می‌کنیم (جلوگیری از حلقهٔ ریلود)
    if (sessionStorage.getItem('mj_resume_tried')) return
    let token: string | null = null
    try { token = localStorage.getItem('mj_token') } catch {}
    if (!token) return

    fetch('/api/auth/profile')
      .then(r => {
        if (r.ok) return // نشست برقرار است؛ کاری لازم نیست
        // کوکی از بین رفته → بازیابی از روی توکن
        sessionStorage.setItem('mj_resume_tried', '1')
        return fetch('/api/auth/resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        }).then(rr => {
          if (rr.ok) {
            // کوکی دوباره ساخته شد → صفحه را تازه می‌کنیم تا همه‌جا لاگین دیده شود
            window.location.reload()
          } else {
            // توکن نامعتبر/منقضی → پاکش می‌کنیم
            try { localStorage.removeItem('mj_token') } catch {}
          }
        })
      })
      .catch(() => {})
  }, [])
  return null
}
