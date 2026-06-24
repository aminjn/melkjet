import { NextRequest, NextResponse } from 'next/server'
import { verifyOTP } from '@/app/lib/otp-store'
import { createSession, SESSION_COOKIE, SUPER_ADMIN_PHONE } from '@/app/lib/session'
import { ensureAccount, dashForRole } from '@/app/lib/account-store'
import { linkPhone } from '@/app/lib/tracker-store'

export async function POST(req: NextRequest) {
  const { phone, code } = await req.json()
  if (!phone || !code) return NextResponse.json({ error: 'اطلاعات ناقص' }, { status: 400 })

  const result = verifyOTP(phone, code)
  if (result === 'expired') return NextResponse.json({ error: 'کد منقضی شده، دوباره ارسال کنید' }, { status: 400 })
  if (result === 'too_many') return NextResponse.json({ error: 'تعداد تلاش‌ها بیش از حد' }, { status: 429 })
  if (result === 'invalid') return NextResponse.json({ error: 'کد اشتباه است' }, { status: 400 })

  const token = await createSession(phone)
  // اتصالِ شمارهٔ کاربر به کوکیِ دائمیِ ترکر (mj_vid) — برای پیامکِ هدفمندِ بعدی
  const vid = req.cookies.get('mj_vid')?.value || ''
  if (vid && vid.length >= 8) { try { linkPhone(vid, phone) } catch {} }
  const isSuper = phone === SUPER_ADMIN_PHONE
  const role = isSuper ? 'super_admin' : 'user'
  const { account, isNew } = ensureAccount(phone)
  // کاربر جدید یا بدون نقش → باید آنبورد شود؛ وگرنه مستقیم به داشبورد نقشش
  const needsOnboarding = !isSuper && (isNew || !account.onboarded)
  const redirect = isSuper ? '/admin' : (needsOnboarding ? '' : dashForRole(account.role))

  const res = NextResponse.json({ ok: true, role, isNew, needsOnboarding, name: account.name || '', profileRole: account.role || '', redirect, token })
  // مهم: مطمئن می‌شویم CDN این پاسخ (که کوکی ورود را ست می‌کند) را کش/حذف نکند
  res.headers.set('Cache-Control', 'no-store, private')
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}
