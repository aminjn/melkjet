'use client'
import { useEffect, useState } from 'react'
import { previewSrc } from '@/app/lib/img-preview'

// تصویرِ کارتِ آگهی: نسخهٔ بهینه (webp کوچک‌شده از /_next/image) با بازگشتِ
// خودکار به آدرسِ اصلیِ CDN اگر بهینه‌سازِ سمتِ سرور در دسترس نبود (مثلاً
// دسترسیِ سرور به divarcdn بسته بود). خرابی یک‌بار در sessionStorage ثبت
// می‌شود تا بقیهٔ کارت‌ها در همان نشست مستقیم آدرسِ اصلی را بگیرند.
const OPT_OFF_KEY = 'mj_img_opt_off'

export default function CardImg({ src, alt, eager, priority, w, style }: {
  src: string
  alt: string
  eager?: boolean
  priority?: 'high' | 'low'
  w?: 384 | 640
  style?: React.CSSProperties
}) {
  const [direct, setDirect] = useState(false)
  useEffect(() => {
    try { if (sessionStorage.getItem(OPT_OFF_KEY) === '1') setDirect(true) } catch { /* SSR/بدون storage */ }
  }, [])
  const url = direct ? src : previewSrc(src, w || 640)
  return (
    <img src={url} alt={alt} loading={eager ? 'eager' : 'lazy'} fetchPriority={priority} decoding="async"
      onError={() => {
        if (direct || url === src) return
        try { sessionStorage.setItem(OPT_OFF_KEY, '1') } catch { /* حالت خصوصی مرورگر */ }
        setDirect(true)
      }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...style }} />
  )
}
