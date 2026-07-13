import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { staffApiAllowed } from './app/lib/admin-access'

const SESSION_COOKIE = 'mj_session'
const SUPER_ADMIN_PHONE = '09122862184'
const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'melkjet-default-secret-change-in-prod'
)

// فاز ۱۱۵ — تنها گلوگاهِ دسترسیِ پنلِ مدیریت:
//   سوپرادمین → همه‌چیز. پرسنل (claim `staff` داخلِ JWT — اعطا در کشوی کاربر) → صفحهٔ /admin آزاد
//   (خودِ صفحه منو را به بخش‌های مجاز محدود می‌کند) و /api/admin/* فقط برای بخش‌های اعطاشده؛
//   هر مسیرِ نگاشت‌نشده (impersonate، تغییرِ رمز، نقش‌ها، درگاه‌ها، کلیدها…) = فقط سوپرادمین.
export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isAdminPage = path.startsWith('/admin')
  const isAdminApi = path.startsWith('/api/admin')
  if (!isAdminPage && !isAdminApi) return NextResponse.next()

  const deny = () => isAdminApi
    ? NextResponse.json({ error: 'دسترسی به این بخش برای شما فعال نیست' }, { status: 403 })
    : NextResponse.redirect(new URL('/', req.url))

  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) {
    return isAdminApi
      ? NextResponse.json({ error: 'برای دسترسی وارد شوید' }, { status: 401 })
      : NextResponse.redirect(new URL('/auth?next=/admin', req.url))
  }
  try {
    const { payload } = await jwtVerify(token, secret)
    if (payload.phone === SUPER_ADMIN_PHONE) return NextResponse.next()
    const staff = Array.isArray(payload.staff) ? (payload.staff as string[]) : []
    // صفحهٔ /admin: کاربرِ واردشدهٔ بدونِ دسترسی را layout با صفحهٔ صریحِ «⛔ عدمِ دسترسی» جواب می‌دهد
    // (فیدبکِ مستقیم) — API ولی همین‌جا بسته می‌شود.
    if (isAdminPage) return NextResponse.next()
    if (!staff.length) return deny()
    return staffApiAllowed(staff, path) ? NextResponse.next() : deny()
  } catch {
    return isAdminApi
      ? NextResponse.json({ error: 'نشستِ نامعتبر — دوباره وارد شوید' }, { status: 401 })
      : NextResponse.redirect(new URL('/auth?next=/admin', req.url))
  }
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
