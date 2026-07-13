import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

export const SUPER_ADMIN_PHONE = '09122862184'
export const SESSION_COOKIE = 'mj_session'
// کوکیِ «ورود به پنل کاربر» (impersonation) — فقط سوپرادمین آن را ست می‌کند.
export const IMPERSONATE_COOKIE = 'mj_imp'

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'melkjet-default-secret-change-in-prod'
)

export interface SessionPayload {
  phone: string
  role: 'super_admin' | 'user'
  staff?: string[]            // فاز ۱۱۵: بخش‌های مجازِ پنلِ ادمین برای پرسنل (اعطا توسطِ سوپرادمین)
  // وقتی سوپرادمین در حال مشاهدهٔ پنلِ کاربرِ دیگری است:
  impersonating?: boolean
  realPhone?: string
}

export async function createSession(phone: string): Promise<string> {
  const role = phone === SUPER_ADMIN_PHONE ? 'super_admin' : 'user'
  // فاز ۱۱۵: بخش‌های اعطاشدهٔ پنلِ ادمین (پرسنل) داخلِ خودِ توکن — proxy بدونِ store اجرایش می‌کند
  let staff: string[] | undefined
  if (role !== 'super_admin') {
    try {
      const { getAccount } = await import('./account-store')
      const secs = getAccount(phone)?.adminSections
      if (secs?.length) staff = secs.slice(0, 40)
    } catch {}
  }
  return new SignJWT({ phone, role, ...(staff ? { staff } : {}) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret)
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

// توکنِ impersonation: شمارهٔ هدف را امضا می‌کند (اعتبار کوتاه‌تر).
export async function createImpersonationToken(target: string): Promise<string> {
  return new SignJWT({ target })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(secret)
}
export async function verifyImpersonation(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    const t = (payload as { target?: unknown }).target
    return typeof t === 'string' ? t : null
  } catch {
    return null
  }
}

// نشستِ واقعی — بدون درنظرگرفتنِ impersonation (برای محافظت از endpointهای ادمین).
export async function getRealSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

export async function getSession(): Promise<SessionPayload | null> {
  const real = await getRealSession()
  if (!real) return null
  // سوپرادمین + پرسنلِ دارای بخشِ «ورود به محیطِ کاربر» (فاز ۱۲۱ — اعطا در کشوی کاربر)
  if (real.role === 'super_admin' || (real.staff || []).includes('impersonate')) {
    const cookieStore = await cookies()
    const impToken = cookieStore.get(IMPERSONATE_COOKIE)?.value
    if (impToken) {
      const target = await verifyImpersonation(impToken)
      if (target && target !== real.phone) {
        return { phone: target, role: 'user', impersonating: true, realPhone: real.phone }
      }
    }
  }
  return real
}
