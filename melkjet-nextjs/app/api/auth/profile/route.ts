import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAccount, setProfile, dashForRole, isValidRole } from '@/app/lib/account-store'
import { getProfile, completeness } from '@/app/lib/profile-store'
import { ensureCronStarted } from '@/app/lib/cron-runner'
import { resolveAccess } from '@/app/lib/plan-gate'

// حساب کاربری فعلی
export async function GET() {
  ensureCronStarted()   // اطمینان از روشن‌بودنِ زمان‌بندِ اتوماسیون (پیامکِ خودکار، هشدار، تکمیل پروفایل)
  const s = await getSession()
  if (!s) return NextResponse.json({ account: null }, { status: 401 })
  const a = getAccount(s.phone)
  const isSuper = s.role === 'super_admin'
  const dash = isSuper ? '/admin' : dashForRole(a?.role)
  const profileCompletion = completeness(getProfile(s.phone))
  // فاز ۵۱ (اعمالِ پلن‌ها): خلاصهٔ دسترسیِ پلن برای UI — قفل/بنرِ ارتقا از همین ساخته می‌شود
  const access = (() => { try { const x = resolveAccess(s as any); return { enforce: x.enforce, isAdmin: x.isAdmin, planName: x.planName, paid: x.paid, expiresAt: x.expiresAt, permissions: x.permissions, quotas: x.quotas } } catch { return null } })()
  return NextResponse.json({ account: a, phone: s.phone, role: s.role, dash, name: a?.name || '', suspended: !!a?.suspended, profileCompletion, access })
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
