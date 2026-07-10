import { NextRequest, NextResponse } from 'next/server'
import { sendOtpSms } from '@/app/lib/send-otp'

// ارسال/ارسالِ مجددِ کدِ ورود — منطقِ واحد در lib (کولداونِ سمتِ سرور + ذخیرهٔ اشتراکیِ کد بینِ اینستنس‌ها).
// قبلاً این مسیر منطقِ خودش را داشت و کد را در حافظهٔ همان اینستنس می‌گذاشت — ریشهٔ «کد اشتباه است».
export async function POST(req: NextRequest) {
  const { phone } = await req.json()
  if (!phone || !/^09[0-9]{9}$/.test(phone)) {
    return NextResponse.json({ error: 'شماره موبایل معتبر نیست' }, { status: 400 })
  }
  const r = await sendOtpSms(phone)
  if (!r.ok) {
    // کولداون → 429 با retryIn (کلاینت تایمر را از همین تنظیم می‌کند)؛ خطای سرویسِ پیامک → مثلِ قبل 200 با error.
    return NextResponse.json({ error: r.error, retryIn: r.retryIn }, { status: r.retryIn ? 429 : 200 })
  }
  return NextResponse.json({ ok: true, dev: r.dev, code: r.code, retryIn: r.retryIn })
}
