'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// ترکرِ بازدید — هر تغییرِ مسیر را به /api/track گزارش می‌کند (با عنوانِ صفحه).
// سرور کوکیِ دائمیِ mj_vid را نگه می‌دارد و در صورتِ شناخته‌بودنِ شماره، پیامکِ هدفمند صف می‌کند.
export default function Tracker() {
  const pathname = usePathname()
  const last = useRef('')
  useEffect(() => {
    if (!pathname) return
    const t = setTimeout(() => {
      const url = pathname + (typeof window !== 'undefined' ? window.location.search : '')
      if (url === last.current) return
      last.current = url
      const title = typeof document !== 'undefined' ? document.title : ''
      try {
        fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, title }), keepalive: true }).catch(() => {})
      } catch { /* بی‌صدا */ }
    }, 1200) // کمی صبر تا عنوانِ صفحه ست شود
    return () => clearTimeout(t)
  }, [pathname])
  return null
}
