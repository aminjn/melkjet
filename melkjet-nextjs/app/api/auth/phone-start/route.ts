import { NextRequest, NextResponse } from 'next/server'
import { getAccount } from '@/app/lib/account-store'
import { SUPER_ADMIN_PHONE } from '@/app/lib/session'
import { getAdminData } from '@/app/lib/admin-store'
import { sendOtpSms } from '@/app/lib/send-otp'

// قدمِ ۱: شماره.
//  • سوپرادمین یا شاهکارِ خاموش → OTP و ورودِ ساده.
//  • حسابِ موجودِ «تأییدشده» → OTP و ورود.
//  • حسابِ جدید، یا حسابِ موجودِ تأییدنشده (ساختهٔ سوپرادمین) → باید با شاهکار احراز شود.
export async function POST(req: NextRequest) {
  const { phone } = await req.json().catch(() => ({}))
  if (!phone || !/^09[0-9]{9}$/.test(phone)) return NextResponse.json({ error: 'شماره موبایل معتبر نیست' }, { status: 400 })

  const isSuper = phone === SUPER_ADMIN_PHONE
  const shahkarOn = !!getAdminData().podium?.enabled
  const acc = getAccount(phone)
  const verified = !!acc?.identityVerifiedAt

  if (isSuper || !shahkarOn || (acc && verified)) {
    const r = await sendOtpSms(phone)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 200 })
    return NextResponse.json({ ok: true, exists: !!acc, otpSent: true, dev: r.dev, code: r.code })
  }
  // جدید یا تأییدنشده → احرازِ شاهکار (OTP بعد از احراز فرستاده می‌شود)
  return NextResponse.json({ ok: true, exists: !!acc, needsShahkar: true })
}
