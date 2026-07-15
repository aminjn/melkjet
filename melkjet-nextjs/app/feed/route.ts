import { NextResponse } from 'next/server'

// فاز ۱۲۸ — /feed فیدِ RSSِ سایتِ وردپرسیِ قدیمیِ دامنه بود؛ برای همیشه حذف شده → 410 Gone.
const gone = () =>
  new NextResponse('این نشانی متعلق به نسخهٔ قدیمیِ سایت است و برای همیشه حذف شده. صفحهٔ اصلی: https://melkjet.com', {
    status: 410,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'public, max-age=86400' },
  })

export function GET() { return gone() }
export function HEAD() { return gone() }
