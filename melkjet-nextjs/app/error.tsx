'use client'
import { useEffect } from 'react'

// مرزِ خطای سطحِ‌route — جایگزینِ پیامِ پیش‌فرضِ Next («Something went wrong!»).
// هر خطای رندرِ سرور/کلاینت در صفحه‌ها اینجا گرفته می‌شود؛ کاربر پیامِ فارسیِ برندشده،
// دکمهٔ «تلاش دوباره» و کدِ خطا (digest) برای پیگیری می‌بیند.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try { console.error('[app/error]', error) } catch {}
    // گزارش به سرور تا متن/stackِ خطای واقعی در لاگ ثبت شود (برای پیگیری).
    try {
      fetch('/api/client-error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ message: error?.message, stack: error?.stack, digest: error?.digest, url: typeof location !== 'undefined' ? location.href : '' }) }).catch(() => {})
    } catch {}
  }, [error])
  return (
    <main style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center', padding: '48px 24px', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ fontSize: 54, lineHeight: 1 }}>⚠️</div>
      <div style={{ fontSize: 20, fontWeight: 800 }}>خطایی رخ داد</div>
      <div style={{ color: 'var(--muted)', fontSize: 14, maxWidth: 440, lineHeight: 1.9 }}>
        در بارگذاریِ این بخش مشکلی پیش آمد. لطفاً دوباره تلاش کنید؛ اگر ادامه داشت، صفحه را تازه کنید یا به خانه بازگردید.
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
        <button onClick={() => reset()} style={{ background: 'var(--gold)', color: '#1a1a1a', padding: '11px 26px', borderRadius: 10, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
          تلاش دوباره
        </button>
        <a href="/" style={{ background: 'transparent', color: 'var(--text)', padding: '11px 26px', borderRadius: 10, fontWeight: 700, textDecoration: 'none', border: '1px solid var(--line2)', fontSize: 14 }}>
          بازگشت به خانه
        </a>
      </div>
      {error?.digest && <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--faint)', direction: 'ltr' }}>کد پیگیری: {error.digest}</div>}
    </main>
  )
}
