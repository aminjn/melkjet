'use client'
import { useEffect } from 'react'

// مرزِ خطای ریشه — وقتی خودِ layout.tsx خطا بدهد فعال می‌شود (باید html/body خودش را داشته باشد).
// جایگزینِ صفحهٔ پیش‌فرضِ «Something went wrong!» با نسخهٔ فارسیِ برندشده.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try { console.error('[app/global-error]', error) } catch {}
    try {
      fetch('/api/client-error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ message: error?.message, stack: error?.stack, digest: error?.digest, url: typeof location !== 'undefined' ? location.href : '' }) }).catch(() => {})
    } catch {}
  }, [error])
  return (
    <html lang="fa" dir="rtl">
      <body style={{ margin: 0, fontFamily: 'Vazirmatn, system-ui, sans-serif', background: '#0f0d0a', color: '#e8e2d8' }}>
        <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 54, lineHeight: 1 }}>⚠️</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>خطایی رخ داد</div>
          <div style={{ color: '#a89f8f', fontSize: 14, maxWidth: 440, lineHeight: 1.9 }}>
            مشکلی در بارگذاریِ صفحه پیش آمد. لطفاً دوباره تلاش کنید.
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
            <button onClick={() => reset()} style={{ background: '#c9a84c', color: '#1a1510', padding: '11px 26px', borderRadius: 10, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
              تلاش دوباره
            </button>
            <a href="/" style={{ background: 'transparent', color: '#e8e2d8', padding: '11px 26px', borderRadius: 10, fontWeight: 700, textDecoration: 'none', border: '1px solid #3a352c', fontSize: 14 }}>
              بازگشت به خانه
            </a>
          </div>
          {error?.digest && <div style={{ marginTop: 10, fontSize: 11.5, color: '#6f6858', direction: 'ltr' }}>کد پیگیری: {error.digest}</div>}
        </main>
      </body>
    </html>
  )
}
