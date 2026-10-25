// پیش‌نمایشِ سبکِ تصاویر کارت‌ها (فاز ۹۵ — Lighthouse «Improve image delivery»).
// تصاویر آگهی‌ها نسخهٔ کاملِ CDN دیوار هستند (چند صد کیلوبایت) ولی داخل کارت‌های
// ~۱۵۶px نمایش داده می‌شوند. این تابع آدرس را به بهینه‌ساز داخلی Next
// (/_next/image) می‌برد تا نسخهٔ webp کوچک‌شده و کش‌شده از دامنهٔ خودمان سرو شود
// (بدونِ DNS/TLS جداگانه به divarcdn در مسیرِ LCP).
// فقط دامنه‌های مجاز در next.config (divarcdn) بازنویسی می‌شوند؛ بقیه دست‌نخورده.

const DIVAR_CDN = /^https:\/\/([a-z0-9-]+\.)+divarcdn\.com\//i
// آپلودهای خودمان (بنر/مدیا) — مسیرِ لوکال، بدونِ نیاز به remotePatterns
const LOCAL_MEDIA = /^\/api\/media\//

// w باید عضو deviceSizes/imageSizes پیش‌فرض Next باشد و q عضو qualities در next.config
export function previewSrc(url: string | undefined, w: 384 | 640 | 1080 = 640, q: 60 | 75 = 60): string {
  if (!url) return ''
  if (!DIVAR_CDN.test(url) && !LOCAL_MEDIA.test(url)) return url
  return `/_next/image?url=${encodeURIComponent(url)}&w=${w}&q=${q}`
}

// فاز ۳۲۷ — placeholderِ تمیز به‌جای آیکونِ شکستهٔ مرورگر وقتی عکسِ آگهی مرده/حذف شده
// (اقلیتِ آگهی‌هایی که عکسشان روی divarcdn پاک شده و کپیِ محلی ندارند). SVGِ درون‌خطیِ خانه،
// هم‌رنگِ برند — همیشه بدونِ درخواستِ شبکه لود می‌شود و هرگز خطا نمی‌دهد (ضدِ حلقهٔ onError).
export const IMG_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><rect width="600" height="450" fill="#2b2824"/>' +
  '<g fill="none" stroke="#c9a84c" stroke-width="12" stroke-linejoin="round" opacity="0.28">' +
  '<path d="M300 150 L430 258 L430 338 L170 338 L170 258 Z"/><path d="M262 338 L262 288 L338 288 L338 338"/></g></svg>')
