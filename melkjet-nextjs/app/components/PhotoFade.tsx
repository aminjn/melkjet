/**
 * لبهٔ محوِ شیشه‌ایِ عکس — «حسِ لوکس» (۸ اکتبر).
 *
 * چرا یک کامپوننتِ روکش و نه کپیِ لایه‌ها در هر کارت: عکسِ کارت‌های ما سه شکلِ
 * متفاوت پیوست می‌شود — `background: url(...)` در PropertyCard و ReosFeed،
 * تگِ <img> از CardImg در جست‌وجو، و گرادیان وقتی عکسی نیست. اگر برای هرکدام
 * لایه‌ها را جدا بنویسیم، همان «نسخهٔ موازیِ فقیر»ی می‌شود که CLAUDE.md دو بار
 * ثبتش کرده: ایرادِ یکی اصلاح می‌شود و بقیه عقب می‌مانند.
 *
 * راهِ حل: این روکش **خودش عکس را نمی‌شناسد**. با `backdrop-filter` هر چیزی را
 * که پشتش هست تار می‌کند، و `mask-image` باعث می‌شود تاریْ از بالا به پایین
 * کم‌کم بالا بیاید (نه یک مرزِ تیز). پس داخلِ هر جعبهٔ عکسِ `position:relative`
 * بیفتد — با هر روشی که عکس رنگ شده باشد — کار می‌کند.
 *
 * یک عکس، یک decode: نسخهٔ تارِ جداگانه‌ای لود نمی‌شود. روی صفحهٔ جست‌وجو که
 * ده‌ها کارت دارد این تفاوتِ ارزانی و گرانی است.
 *
 * مرورگرِ بدونِ backdrop-filter فقط گرادیانِ `to` را می‌بیند — لبهٔ محوِ سالم،
 * بدونِ تاری. هیچ‌چیز نمی‌شکند.
 */
import type { CSSProperties } from 'react'

// تاری از بالای نوار صفر است و تا پایین کامل می‌شود؛ همین «رمپ» است که لبه را
// نرم می‌کند. بدونِ ماسک، خودِ نوار یک خطِ تیزِ تازه می‌ساخت.
const RAMP = 'linear-gradient(180deg,transparent 0%,rgba(0,0,0,.26) 24%,rgba(0,0,0,.72) 56%,#000 84%,#000 100%)'

export default function PhotoFade({
  to = 'var(--surface)', blur = 30, height = '60%', style,
}: {
  /** رنگی که عکس در آن حل می‌شود — پیش‌فرض سطحِ کارت؛ روی هیرو رنگِ خودِ هیرو. */
  to?: string
  blur?: number
  height?: number | string
  style?: CSSProperties
}) {
  return (
    <span aria-hidden style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, height, pointerEvents: 'none',
      backdropFilter: `blur(${blur}px) saturate(1.12)`, WebkitBackdropFilter: `blur(${blur}px) saturate(1.12)`,
      maskImage: RAMP, WebkitMaskImage: RAMP,
      background: `linear-gradient(180deg,transparent 0%,color-mix(in srgb,${to} 34%,transparent) 58%,color-mix(in srgb,${to} 86%,transparent) 86%,${to} 100%)`,
      ...style,
    }} />
  )
}
