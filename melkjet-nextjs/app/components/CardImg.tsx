'use client'
import { useState } from 'react'
import { previewSrc } from '@/app/lib/img-preview'

// تصویرِ کارتِ آگهی: remote (divarcdn) اول مستقیم (سریع — فاز ۲۸۳)، و اگر divar هات‌لینک را
// بلاک کرد → بازگشتِ خودکار به /_next/image (سرور خودش عکس را می‌گیرد). محلی (/api/media) اول
// بهینه‌ساز، بعد مستقیم. بدونِ طوفانِ بهینه‌ساز چون مسیرِ سریع همچنان اول است.

export default function CardImg({ src, alt, eager, priority, w, style }: {
  src: string
  alt: string
  eager?: boolean
  priority?: 'high' | 'low'
  w?: 384 | 640
  style?: React.CSSProperties
}) {
  // فاز ۳۲۷ — ریشهٔ «خیلی از آگهی‌ها عکس ندارند»: divar هات‌لینکِ مستقیم از دامنهٔ ما را بلاک می‌کند،
  // و onErrorِ قبلی برای remote «هیچ‌کاری» نمی‌کرد (چون url===src) → عکسِ شکسته می‌ماند. حالا:
  //   remote → اول مستقیم (سریع)، اگر شکست خورد → /_next/image (سرور خودش از divar می‌گیرد).
  //   محلی  → اول بهینه‌ساز، اگر شکست خورد → مستقیم.
  // مسیرِ سریع اول است؛ fallback فقط وقتی لازم شد (بدونِ طوفانِ بهینه‌ساز که فاز ۲۸۳ حذفش کرد).
  const [fallback, setFallback] = useState(false)
  const remote = /^https?:\/\//i.test(src)
  const optimized = previewSrc(src, w || 640) || src
  const primary = remote ? src : optimized
  const secondary = remote ? optimized : src
  const url = fallback ? secondary : primary
  return (
    <img src={url} alt={alt} loading={eager ? 'eager' : 'lazy'} fetchPriority={priority} decoding="async"
      onError={() => { if (!fallback && secondary !== primary) setFallback(true) }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...style }} />
  )
}
