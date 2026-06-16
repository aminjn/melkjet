import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

export const SUPER_ADMIN_PHONE = '09122862184'
export const SESSION_COOKIE = 'mj_session'

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'melkjet-default-secret-change-in-prod'
)

export interface SessionPayload {
  phone: string
  role: 'super_admin' | 'user'
}

export async function createSession(phone: string): Promise<string> {
  const role = phone === SUPER_ADMIN_PHONE ? 'super_admin' : 'user'
  return new SignJWT({ phone, role })
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

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}
