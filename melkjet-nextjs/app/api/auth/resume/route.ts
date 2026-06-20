import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, createSession, SESSION_COOKIE } from '@/app/lib/session'

// بازیابی نشست از روی توکنِ ذخیره‌شده در localStorage.
// روی موبایل/PWA گاهی مرورگر کوکی را بعد از بستن اپ پاک می‌کند؛ این مسیر اجازه می‌دهد
// کلاینت با توکنی که نگه داشته دوباره کوکی نشست را بسازد (تا کاربر مجبور به ورود مجدد نشود).
export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({} as any))
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ ok: false }, { status: 400, headers: { 'Cache-Control': 'no-store, private' } })
  }
  const payload = await verifyToken(token)
  if (!payload?.phone) {
    return NextResponse.json({ ok: false }, { status: 401, headers: { 'Cache-Control': 'no-store, private' } })
  }
  // کوکی تازه با عمر کامل صادر می‌شود
  const fresh = await createSession(payload.phone)
  const res = NextResponse.json({ ok: true, role: payload.role || 'user' })
  res.headers.set('Cache-Control', 'no-store, private')
  res.cookies.set(SESSION_COOKIE, fresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}
