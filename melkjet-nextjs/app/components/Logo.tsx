'use client'
import { useId } from 'react'

// ── لوگوی ملک‌جت (ری‌برندِ ۲۹۸ی۴) ───────────────────────────────────────────
// لوگومارکِ «M» با دو شِورونِ طلایی (چپ روشن، راست برنزیِ تیره‌تر) — وکتورِ قطعی،
// از روی پیکسل‌های فایلِ طراحیِ کاربر تریس شده (viewBox 0 0 118 103، قرینه حولِ x=59).
// SVG است تا در هر اندازه تیز بماند و با تم کار کند؛ «ملک‌جت» با فونتِ برند (Vazirmatn)
// در طلایی رندر می‌شود (طبقِ قاعدهٔ برند: هرگز حروفِ فارسیِ دست‌کشیده).

interface LogoProps {
  height?: number
  /** نمایشِ نام‌وارهٔ «ملک‌جت» کنارِ لوگومارک */
  word?: boolean
  /** رنگِ متنِ نام‌واره؛ پیش‌فرض گرادیانِ طلایی */
  wordTone?: 'gold' | 'text'
  className?: string
  title?: string
}

export default function Logo({ height = 34, word = true, wordTone = 'gold', className, title = 'ملک‌جت' }: LogoProps) {
  // شناسهٔ یکتا و پایدار (SSR-safe) برای گرادیان‌ها تا چند لوگو در یک صفحه تداخل نکنند.
  const uid = `mjl${useId().replace(/:/g, '')}`
  const markW = (height * 118) / 103
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(height * 0.34), lineHeight: 1 }} aria-label={title}>
      <svg width={markW} height={height} viewBox="0 0 118 103" role="img" aria-hidden={word ? true : undefined} style={{ display: 'block', flexShrink: 0 }}>
        <defs>
          <linearGradient id={`${uid}L`} x1="0" y1="0" x2="0.85" y2="1">
            <stop offset="0" stopColor="#F7E39A" />
            <stop offset="0.45" stopColor="#E3BC52" />
            <stop offset="1" stopColor="#B07F26" />
          </linearGradient>
          <linearGradient id={`${uid}R`} x1="0.2" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#C89A34" />
            <stop offset="0.5" stopColor="#8E691C" />
            <stop offset="1" stopColor="#573E0E" />
          </linearGradient>
        </defs>
        {/* نیمهٔ چپ (روشن) */}
        <path fill={`url(#${uid}L)`} d="M49 3 L56 3 L56 56 L54 66 L44 59 L39 57 L34 60 L34 96 L30 99 L0 82 L0 36 Z" />
        {/* نیمهٔ راست (برنزیِ تیره) — قرینهٔ x'=118-x */}
        <path fill={`url(#${uid}R)`} d="M69 3 L62 3 L62 56 L64 66 L74 59 L79 57 L84 60 L84 96 L88 99 L118 82 L118 36 Z" />
      </svg>
      {word && (
        <span style={{
          fontFamily: 'Vazirmatn, system-ui, sans-serif',
          fontWeight: 800,
          fontSize: Math.round(height * 0.62),
          letterSpacing: '-.5px',
          ...(wordTone === 'gold'
            ? { background: 'linear-gradient(100deg,#F7DE92,#D9AD3E 55%,#A9761D)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' as const }
            : { color: 'var(--text)' }),
        }}>ملک‌جت</span>
      )}
    </span>
  )
}
