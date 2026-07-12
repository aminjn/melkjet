// پیش‌نمایشِ سبکِ تصاویر کارت‌ها (فاز ۹۵ — Lighthouse «Improve image delivery»).
// تصاویر آگهی‌ها نسخهٔ کاملِ CDN دیوار هستند (چند صد کیلوبایت) ولی داخل کارت‌های
// ~۱۵۶px نمایش داده می‌شوند. این تابع آدرس را به بهینه‌ساز داخلی Next
// (/_next/image) می‌برد تا نسخهٔ webp کوچک‌شده و کش‌شده از دامنهٔ خودمان سرو شود
// (بدونِ DNS/TLS جداگانه به divarcdn در مسیرِ LCP).
// فقط دامنه‌های مجاز در next.config (divarcdn) بازنویسی می‌شوند؛ بقیه دست‌نخورده.

const DIVAR_CDN = /^https:\/\/([a-z0-9-]+\.)+divarcdn\.com\//i

// w باید عضو deviceSizes/imageSizes پیش‌فرض Next باشد و q عضو qualities در next.config
export function previewSrc(url: string | undefined, w: 384 | 640 = 640, q: 60 | 75 = 60): string {
  if (!url) return ''
  if (!DIVAR_CDN.test(url)) return url
  return `/_next/image?url=${encodeURIComponent(url)}&w=${w}&q=${q}`
}
