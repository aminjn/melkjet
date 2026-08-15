'use client'
import { useEffect, useState } from 'react'
import { previewSrc } from '@/app/lib/img-preview'

// تصویرِ کارتِ آگهی (فاز ۲۸۳): آدرسِ remote (divarcdn و هر http/https) مستقیم لود
// می‌شود — CDNِ دیوار سریع و content-addressed است؛ گلوگاه بهینه‌سازِ /_next/image
// بود که روی همان سرورِ ۴هسته‌ایِ اسکرپ/AI هر عکس را بارِ اول دانلود و encode
// می‌کرد (فیدبکِ کاربر: بازشدنِ چند‌دقیقه‌ایِ عکس‌های جست‌وجو). مسیرهای محلی
// (شروع با /، مثل /api/media آپلودهای بزرگِ کاربران) همچنان از previewSrc
// می‌گذرند، با بازگشتِ خودکار به آدرسِ اصلی اگر بهینه‌ساز خطا داد؛ خرابی یک‌بار
// در sessionStorage ثبت می‌شود تا بقیهٔ کارت‌ها در همان نشست مستقیم بگیرند.
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
  // remote → مستقیم؛ فقط مسیرِ محلی از بهینه‌ساز می‌گذرد (برای remote چون url === src
  // است، گاردِ onError هم هیچ‌وقت flag نمی‌نویسد — بدونِ side-effect)
  const remote = /^https?:\/\//i.test(src)
  const url = direct || remote ? src : previewSrc(src, w || 640)
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
