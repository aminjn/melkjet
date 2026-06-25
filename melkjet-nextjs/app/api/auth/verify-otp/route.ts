import { NextRequest, NextResponse } from 'next/server'
import { verifyOTP } from '@/app/lib/otp-store'
import { createSession, SESSION_COOKIE, SUPER_ADMIN_PHONE } from '@/app/lib/session'
import { ensureAccount, dashForRole, accountExists, getAccount, createVerifiedAccount, touchLogin } from '@/app/lib/account-store'
import { linkPhone } from '@/app/lib/tracker-store'
import { attachPhone } from '@/app/lib/push-store'
import { getPending, deletePending } from '@/app/lib/pending-reg-store'
import { getAdminData } from '@/app/lib/admin-store'

export async function POST(req: NextRequest) {
  const { phone, code } = await req.json()
  if (!phone || !code) return NextResponse.json({ error: 'اطلاعات ناقص' }, { status: 400 })

  const result = verifyOTP(phone, code)
  if (result === 'expired') return NextResponse.json({ error: 'کد منقضی شده، دوباره ارسال کنید' }, { status: 400 })
  if (result === 'too_many') return NextResponse.json({ error: 'تعداد تلاش‌ها بیش از حد' }, { status: 429 })
  if (result === 'invalid') return NextResponse.json({ error: 'کد اشتباه است' }, { status: 400 })

  const isSuper = phone === SUPER_ADMIN_PHONE
  const role = isSuper ? 'super_admin' : 'user'
  // ── تعیین/ساختِ حساب: کاربرِ موجود، یا هویتِ تأییدشدهٔ شاهکار، یا (اگر شاهکار خاموش) ثبت‌نامِ ساده ──
  let account; let isNew = false
  if (accountExists(phone)) { account = getAccount(phone)!; touchLogin(phone) }
  else if (isSuper) { const r = ensureAccount(phone); account = r.account; isNew = r.isNew }
  else {
    const pending = getPending(phone)
    if (pending && pending.matched) { account = createVerifiedAccount(phone, pending); deletePending(phone); isNew = true }
    else if (!getAdminData().podium?.enabled) { const r = ensureAccount(phone); account = r.account; isNew = r.isNew }
    else return NextResponse.json({ error: 'ابتدا هویتِ خود را با شاهکار تأیید کنید.' }, { status: 400 })
  }

  const token = await createSession(phone)
  // اتصالِ شمارهٔ کاربر به کوکیِ دائمیِ ترکر (mj_vid) — برای پیامکِ هدفمندِ بعدی
  const vid = req.cookies.get('mj_vid')?.value || ''
  if (vid && vid.length >= 8) { try { linkPhone(vid, phone) } catch {}; try { attachPhone(vid, phone) } catch {} }
  // کاربر جدید یا بدون نقش → باید آنبورد شود؛ وگرنه مستقیم به داشبورد نقشش
  const needsOnboarding = !isSuper && (isNew || !account.onboarded)
  const redirect = isSuper ? '/admin' : (needsOnboarding ? '' : dashForRole(account.role))

  const res = NextResponse.json({ ok: true, role, isNew, needsOnboarding, name: account.name || '', nameVerified: !!account.identityVerifiedAt, profileRole: account.role || '', redirect, token })
  // مهم: مطمئن می‌شویم CDN این پاسخ (که کوکی ورود را ست می‌کند) را کش/حذف نکند
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
