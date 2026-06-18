import { NextRequest, NextResponse } from 'next/server'
import { getAdminData, hashPassword } from '@/app/lib/admin-store'
import { createSession, SESSION_COOKIE, SUPER_ADMIN_PHONE } from '@/app/lib/session'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'اطلاعات ناقص' }, { status: 400 })

  const admin = getAdminData()
  if (email.toLowerCase() !== admin.email.toLowerCase()) {
    return NextResponse.json({ error: 'ایمیل یا رمز اشتباه است' }, { status: 401 })
  }
  if (hashPassword(password) !== admin.passwordHash) {
    return NextResponse.json({ error: 'ایمیل یا رمز اشتباه است' }, { status: 401 })
  }

  // Email admin login always gets super_admin role
  const token = await createSession(SUPER_ADMIN_PHONE)
  const res = NextResponse.json({ ok: true, role: 'super_admin' })
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
