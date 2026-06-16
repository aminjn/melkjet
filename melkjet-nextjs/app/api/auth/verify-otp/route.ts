import { NextRequest, NextResponse } from 'next/server'
import { verifyOTP } from '@/app/lib/otp-store'
import { createSession, SESSION_COOKIE, SUPER_ADMIN_PHONE } from '@/app/lib/session'

export async function POST(req: NextRequest) {
  const { phone, code } = await req.json()

  if (!phone || !code) {
    return NextResponse.json({ error: 'اطلاعات ناقص است' }, { status: 400 })
  }

  const result = verifyOTP(phone, code)

  if (result === 'expired') {
    return NextResponse.json({ error: 'کد منقضی شده، دوباره درخواست کنید' }, { status: 400 })
  }
  if (result === 'too_many') {
    return NextResponse.json({ error: 'تعداد تلاش‌ها بیش از حد مجاز است' }, { status: 429 })
  }
  if (result === 'invalid') {
    return NextResponse.json({ error: 'کد وارد شده اشتباه است' }, { status: 400 })
  }

  const token = await createSession(phone)
  const role = phone === SUPER_ADMIN_PHONE ? 'super_admin' : 'user'

  const response = NextResponse.json({ ok: true, role })
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })

  return response
}
