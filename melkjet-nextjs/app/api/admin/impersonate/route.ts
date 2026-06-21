import { NextRequest, NextResponse } from 'next/server'
import { getRealSession, createImpersonationToken, verifyImpersonation, IMPERSONATE_COOKIE } from '@/app/lib/session'
import { getAccount, dashForRole } from '@/app/lib/account-store'
import { cookies } from 'next/headers'

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24,
  path: '/',
}

// وضعیتِ فعلیِ impersonation (برای نوار خروج).
export async function GET() {
  const real = await getRealSession()
  const store = await cookies()
  const tok = store.get(IMPERSONATE_COOKIE)?.value
  if (!real || real.role !== 'super_admin' || !tok) return NextResponse.json({ active: false })
  const target = await verifyImpersonation(tok)
  if (!target) return NextResponse.json({ active: false })
  const a = getAccount(target)
  return NextResponse.json({
    active: true,
    target,
    name: a?.name || '',
    roleLabel: a?.role || '',
    dashboard: dashForRole(a?.role),
  }, { headers: { 'Cache-Control': 'no-store, private' } })
}

// شروعِ «ورود به پنل کاربر». فقط سوپرادمینِ واقعی.
export async function POST(req: NextRequest) {
  const real = await getRealSession()
  if (!real || real.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as { phone?: string }))
  const phone = String(b.phone || '').trim()
  if (!phone) return NextResponse.json({ error: 'شماره الزامی است' }, { status: 400 })
  if (phone === real.phone) return NextResponse.json({ error: 'این حساب خود شماست' }, { status: 400 })
  const a = getAccount(phone)
  if (!a) return NextResponse.json({ error: 'پروفایل یافت نشد' }, { status: 404 })

  const token = await createImpersonationToken(phone)
  const res = NextResponse.json({ ok: true, dashboard: dashForRole(a.role) })
  res.headers.set('Cache-Control', 'no-store, private')
  res.cookies.set(IMPERSONATE_COOKIE, token, cookieOpts)
  return res
}

// خروج از حالتِ مشاهده.
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.headers.set('Cache-Control', 'no-store, private')
  res.cookies.set(IMPERSONATE_COOKIE, '', { ...cookieOpts, maxAge: 0 })
  return res
}
