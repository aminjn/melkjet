import { NextRequest, NextResponse } from 'next/server'
import { getRealSession, createImpersonationToken, verifyImpersonation, IMPERSONATE_COOKIE } from '@/app/lib/session'
import { getAccount, dashForRole } from '@/app/lib/account-store'
import { logAudit } from '@/app/lib/audit-store'

// فاز ۱۲۱: سوپرادمین همیشه؛ پرسنل فقط با بخشِ اعطاشدهٔ «ورود به محیطِ کاربر»
const allowed = (real: { role: string; staff?: string[] } | null) =>
  !!real && (real.role === 'super_admin' || (real.staff || []).includes('impersonate'))
import { getRole, dashForRoleId } from '@/app/lib/role-store'
import { cookies } from 'next/headers'

const PREVIEW_PREFIX = '__preview_'

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
  if (!allowed(real) || !tok) return NextResponse.json({ active: false })
  const target = await verifyImpersonation(tok)
  if (!target) return NextResponse.json({ active: false })
  // حالتِ پیش‌نمایشِ نقش (بدون کاربرِ واقعی)
  if (target.startsWith(PREVIEW_PREFIX)) {
    const roleId = target.slice(PREVIEW_PREFIX.length)
    const role = getRole(roleId)
    return NextResponse.json({
      active: true, target, preview: true,
      name: `پیش‌نمایش نقش: ${role?.name || roleId}`,
      dashboard: dashForRoleId(roleId),
    }, { headers: { 'Cache-Control': 'no-store, private' } })
  }
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
// body: { phone } برای کاربرِ واقعی، یا { role } برای پیش‌نمایشِ نقش با دادهٔ نمونه.
export async function POST(req: NextRequest) {
  const real = await getRealSession()
  if (!real || !allowed(real)) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as { phone?: string; role?: string }))

  // ── پیش‌نمایشِ نقش ──
  const roleId = String(b.role || '').trim()
  if (roleId) {
    const role = getRole(roleId)
    if (!role) return NextResponse.json({ error: 'نقش یافت نشد' }, { status: 404 })
    const target = PREVIEW_PREFIX + roleId
    const token = await createImpersonationToken(target)
    const res = NextResponse.json({ ok: true, dashboard: role.dashboard || dashForRoleId(roleId) })
    res.headers.set('Cache-Control', 'no-store, private')
    res.cookies.set(IMPERSONATE_COOKIE, token, cookieOpts)
    return res
  }

  // ── کاربرِ واقعی ──
  const phone = String(b.phone || '').trim()
  if (!phone) return NextResponse.json({ error: 'شماره یا نقش الزامی است' }, { status: 400 })
  if (phone === real.phone) return NextResponse.json({ error: 'این حساب خود شماست' }, { status: 400 })
  const a = getAccount(phone)
  if (!a) return NextResponse.json({ error: 'پروفایل یافت نشد' }, { status: 404 })
  // فاز ۱۲۱ — گاردِ امنیتی: پرسنل هرگز واردِ محیطِ سوپرادمین یا پرسنلِ دیگر نمی‌شوند + هر ورود در ممیزی
  if (real.role !== 'super_admin' && (phone === '09122862184' || (a.adminSections || []).length > 0))
    return NextResponse.json({ error: 'ورود به محیطِ مدیر یا همکارِ دیگر مجاز نیست' }, { status: 403 })
  logAudit(real.phone, 'ورود به محیطِ کاربر', `${a.name || ''} (${phone})`)

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
