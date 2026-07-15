import { NextResponse } from 'next/server'

// فاز ۱۲۸ (Search Console): /ads/* نشانی‌های سایتِ وردپرسیِ قدیمیِ دامنه‌اند (از جمله /ads/<slug>/feed)
// که گوگل هنوز می‌خزد و با noindex در گزارشِ «Excluded by noindex» می‌مانند.
// پاسخِ استاندارد برای محتوای برای‌همیشه‌حذف‌شده: 410 Gone → گوگل سریع و دائمی حذفشان می‌کند.
// هیچ مسیرِ داخلی/عمومیِ سایت به /ads اشاره نمی‌کند (چک‌شده) — این پیشوند کاملاً متروکه است.
const gone = () =>
  new NextResponse('این نشانی متعلق به نسخهٔ قدیمیِ سایت است و برای همیشه حذف شده. صفحهٔ اصلی: https://melkjet.com', {
    status: 410,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'public, max-age=86400' },
  })

export function GET() { return gone() }
export function HEAD() { return gone() }
