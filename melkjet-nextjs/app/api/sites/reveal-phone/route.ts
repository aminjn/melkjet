import { NextRequest, NextResponse } from 'next/server'
import { getSite } from '@/app/lib/sites-store'
import { recordSiteHit } from '@/app/lib/site-stats-store'
import { openPhone } from '@/app/lib/phone-token'

export const runtime = 'nodejs'

// فاز ۲۹۸ز — بازگشاییِ شمارهٔ سایتِ خودکار «بعد از کلیک» (نه در HTML). عمومی است (سایت‌های
// بازاریابیِ کاربر باید بدونِ ورود قابلِ‌تماس باشند) ولی شماره فقط با توکنِ معتبرِ همین سرور باز
// می‌شود، پس اسکرپرِ HTML به عدد نمی‌رسد. هر بازگشایی مثلِ قبل در پنلِ سایت‌سازها «نمایشِ شماره» ثبت می‌شود.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({} as any))
  const token = String(b.token || '')
  const slug = String(b.slug || '').slice(0, 120)
  const phone = openPhone(token)
  if (!phone) return NextResponse.json({ ok: false }, { status: 400 })
  // ثبتِ آمارِ «نمایشِ شماره» فقط برای slugِ موجود (مثلِ بیکنِ hit) — fire-and-forget.
  if (slug) {
    const site = await getSite(slug)
    if (site) recordSiteHit(site.slug, 'phone').catch(() => {})
  }
  return NextResponse.json({ ok: true, phone }, { headers: { 'Cache-Control': 'no-store, private' } })
}
