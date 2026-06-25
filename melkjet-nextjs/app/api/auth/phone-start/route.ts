import { NextRequest, NextResponse } from 'next/server'
import { accountExists } from '@/app/lib/account-store'
import { SUPER_ADMIN_PHONE } from '@/app/lib/session'
import { getAdminData } from '@/app/lib/admin-store'
import { sendOtpSms } from '@/app/lib/send-otp'

// قدمِ ۱: شماره. اگر کاربر هست (یا شاهکار خاموش است) → OTP بفرست (ورود). اگر نیست → کلاینت فرمِ شاهکار را نشان دهد.
export async function POST(req: NextRequest) {
  const { phone } = await req.json().catch(() => ({}))
  if (!phone || !/^09[0-9]{9}$/.test(phone)) return NextResponse.json({ error: 'شماره موبایل معتبر نیست' }, { status: 400 })

  const isSuper = phone === SUPER_ADMIN_PHONE
  const exists = isSuper || accountExists(phone)
  const shahkarOn = !!getAdminData().podium?.enabled

  // کاربرِ موجود، یا سوپرادمین، یا وقتی شاهکار خاموش است → مستقیم OTP و ورود/ثبت‌نامِ ساده
  if (exists || !shahkarOn) {
    const r = await sendOtpSms(phone)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 200 })
    return NextResponse.json({ ok: true, exists, otpSent: true, dev: r.dev, code: r.code })
  }
  // کاربرِ جدید و شاهکار روشن → باید هویت تأیید شود (OTP هنوز فرستاده نمی‌شود)
  return NextResponse.json({ ok: true, exists: false, needsShahkar: true })
}
