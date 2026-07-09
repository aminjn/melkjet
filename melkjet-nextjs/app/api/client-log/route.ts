// لاگِ خطاهای مرورگرِ کاربران (فاز ۳۱): وقتی صفحه‌ای در مرورگرِ کاربر کرش می‌کند («می‌زنم هیچ اتفاقی نمی‌افتد»)،
// خطا اینجا می‌آید و در لاگِ pm2 سرور دیده می‌شود — دیگر برای ریشه‌یابی به اسکرین‌شاتِ کنسولِ کاربر نیازی نیست.
import { NextRequest, NextResponse } from 'next/server'

let count = 0
export async function POST(req: NextRequest) {
  if (count++ > 5000) return new NextResponse(null, { status: 204 })   // سقفِ ساده در برابرِ سیل
  const b = await req.json().catch(() => ({} as any))
  console.error('[client-error]', JSON.stringify({
    msg: String(b.msg || '').slice(0, 500), url: String(b.url || '').slice(0, 200),
    ua: (req.headers.get('user-agent') || '').slice(0, 120), at: new Date().toISOString(),
  }))
  return new NextResponse(null, { status: 204 })
}
