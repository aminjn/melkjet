import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SESSION_COOKIE = 'mj_session'
const SUPER_ADMIN_PHONE = '09122862184'
const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'melkjet-secret-key-change-in-production-2024'
)

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/admin')) {
    const token = req.cookies.get(SESSION_COOKIE)?.value
    if (!token) {
      return NextResponse.redirect(new URL('/auth?next=/admin', req.url))
    }
    try {
      const { payload } = await jwtVerify(token, secret)
      if (payload.phone !== SUPER_ADMIN_PHONE && payload.role !== 'super_admin') {
        return NextResponse.redirect(new URL('/?error=access_denied', req.url))
      }
    } catch {
      return NextResponse.redirect(new URL('/auth?next=/admin', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
