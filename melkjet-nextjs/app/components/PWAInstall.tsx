'use client'
import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstall() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(() => { import('@/app/lib/push-client').then(m => m.ensurePushSubscribed(false)).catch(() => {}) })
        .catch(() => {})
    }

    // display-mode فقط داخلِ خودِ اپِ نصب‌شده درست است و در تبِ مرورگر همیشه false —
    // پس نصب‌بودن با رویدادِ appinstalled ثبت می‌شود (در layout).
    const installed = () => {
      try { if (localStorage.getItem('pwa-installed')) return true } catch {}
      return window.matchMedia('(display-mode: standalone)').matches
        || (navigator as unknown as { standalone?: boolean }).standalone === true
    }
    // بستنِ نوار دیگر همیشگی نیست: هفت روز بعد دوباره پیشنهاد می‌شود، چون تا وقتی
    // کاربر نصب نکرده باید ببیندش.
    const snoozed = () => { try { return Number(localStorage.getItem('pwa-snooze') || 0) > Date.now() } catch { return false } }
    if (installed() || snoozed()) return

    // سافاریِ آی‌اواس هرگز beforeinstallprompt نمی‌دهد؛ آنجا راهنمای دستی می‌آید.
    if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent)) {
      setIos(true); setShow(true); return
    }

    // رویداد را layout قبل از hydration گرفته و روی window نگه داشته است.
    const w = window as unknown as { __bip?: BeforeInstallPromptEvent | null }
    const take = () => { if (w.__bip) { setPrompt(w.__bip); setShow(true) } }
    take()
    const onDirect = (e: Event) => { e.preventDefault(); setPrompt(e as BeforeInstallPromptEvent); setShow(true) }
    const onInstalled = () => { setShow(false); try { localStorage.setItem('pwa-installed', '1') } catch {} }
    window.addEventListener('bip', take)
    window.addEventListener('beforeinstallprompt', onDirect)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('bip', take)
      window.removeEventListener('beforeinstallprompt', onDirect)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = async () => {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setShow(false)
    setPrompt(null)
  }

  const dismiss = () => {
    setShow(false)
    try { localStorage.setItem('pwa-snooze', String(Date.now() + 7 * 86400000)) } catch {}
  }

  if (!show) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 72,
      left: 12, right: 12,
      zIndex: 200,
      background: 'var(--surface)',
      border: '1px solid var(--line2)',
      borderRadius: 18,
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      boxShadow: '0 8px 40px -8px rgba(0,0,0,0.6)',
      animation: 'drop .25s ease',
    }}>
      {/* Close */}
      <button
        onClick={dismiss}
        aria-label="بستن"
        style={{
          position: 'absolute', top: 6, left: 8,
          width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none',
          color: 'var(--muted)', cursor: 'pointer',
          fontSize: 18, lineHeight: 1, padding: 0,
        }}
      >×</button>

      {/* Icon */}
      <div style={{
        width: 46, height: 46, borderRadius: 13, flexShrink: 0,
        background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 12px -4px var(--gold)',
      }}>
        <div style={{ width: 17, height: 17, background: 'var(--bg)', transform: 'rotate(45deg)', borderRadius: 3 }} />
      </div>

      {/* Text */}
      <div style={{ flex: 1, marginRight: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>نصب اپلیکیشن ملک‌جت</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
          {ios ? 'دکمهٔ اشتراک‌گذاری ← افزودن به صفحهٔ اصلی' : 'برای دسترسی سریع‌تر به صفحه اصلی اضافه کن'}
        </div>
      </div>

      {/* Install button */}
      <button
        onClick={ios ? dismiss : install}
        style={{
          padding: '9px 16px',
          borderRadius: 10,
          border: 'none',
          background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
          color: '#16140f',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {ios ? 'باشه' : 'افزودن'}
      </button>
    </div>
  )
}
