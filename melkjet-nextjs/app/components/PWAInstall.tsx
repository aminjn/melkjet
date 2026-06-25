'use client'
import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstall() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(() => { import('@/app/lib/push-client').then(m => m.ensurePushSubscribed(false)).catch(() => {}) })
        .catch(() => {})
    }

    if (window.matchMedia('(display-mode: standalone)').matches) return

    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
      if (!localStorage.getItem('pwa-dismissed')) setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
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
    localStorage.setItem('pwa-dismissed', '1')
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
        style={{
          position: 'absolute', top: 10, left: 12,
          background: 'none', border: 'none',
          color: 'var(--muted)', cursor: 'pointer',
          fontSize: 18, lineHeight: 1, padding: 2,
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
          برای دسترسی سریع‌تر به صفحه اصلی اضافه کن
        </div>
      </div>

      {/* Install button */}
      <button
        onClick={install}
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
        افزودن
      </button>
    </div>
  )
}
