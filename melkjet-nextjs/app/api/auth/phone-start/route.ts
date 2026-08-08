import { NextRequest, NextResponse } from 'next/server'
import { getAccount } from '@/app/lib/account-store'
import { sendOtpSms } from '@/app/lib/send-otp'

// قدمِ ۱: شماره → ارسالِ OTP.
// فاز ۲۶۰ — شاهکار از ورود/ثبت‌نام برداشته شد (کاربر اول فقط با شماره وارد می‌شود، نمی‌ترسد).
// احرازِ هویتِ شاهکار حالا «اختیاری» و داخلِ پنل است (با پاداش).
export async function POST(req: NextRequest) {
  const { phone } = await req.json().catch(() => ({}))
  if (!phone || !/^09[0-9]{9}$/.test(phone)) return NextResponse.json({ error: 'شماره موبایل معتبر نیست' }, { status: 400 })

  const acc = getAccount(phone)
  const r = await sendOtpSms(phone)
  if (!r.ok) return NextResponse.json({ error: r.error, retryIn: r.retryIn }, { status: 200 })
  return NextResponse.json({ ok: true, exists: !!acc, otpSent: true, dev: r.dev, code: r.code, retryIn: r.retryIn })
}
