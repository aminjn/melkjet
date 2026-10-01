'use client'
import { useEffect } from 'react'

// فاز ۲۹۶ب — بیکنِ بازدید: یک POST سبک بعد از لودِ صفحه (فقط مرورگرِ واقعی؛ بات بدونِ JS نمی‌شمارد).
export default function Beacon({ slug }: { slug: string }) {
  useEffect(() => {
    try {
      const body = JSON.stringify({ slug, kind: 'view' })
      if (navigator.sendBeacon) navigator.sendBeacon('/api/sites/hit', new Blob([body], { type: 'application/json' }))
      else fetch('/api/sites/hit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
    } catch { /* آمار هرگز صفحه را نشکند */ }
  }, [slug])
  return null
}
