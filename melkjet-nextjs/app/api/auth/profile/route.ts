import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAccount, setProfile, dashForRole, isValidRole } from '@/app/lib/account-store'

// حساب کاربری فعلی
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ account: null }, { status: 401 })
  const a = getAccount(s.phone)
  const isSuper = s.role === 'super_admin'
  const dash = isSuper ? '/admin' : dashForRole(a?.role)
  return NextResponse.json({ account: a, phone: s.phone, role: s.role, dash })
}

// تکمیل پروفایل (آنبوردینگ): نام + نقش
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد نشده‌اید' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const name = String(b.name || '').trim()
  const role = String(b.role || '').trim()
  if (!name) return NextResponse.json({ error: 'نام را وارد کنید' }, { status: 400 })
  if (!isValidRole(role)) return NextResponse.json({ error: 'نقش را انتخاب کنید' }, { status: 400 })
  const a = setProfile(s.phone, { name, role })
  return NextResponse.json({ ok: true, account: a, redirect: dashForRole(role) })
}
