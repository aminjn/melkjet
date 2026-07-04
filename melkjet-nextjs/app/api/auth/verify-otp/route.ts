import { NextRequest, NextResponse } from 'next/server'
import { verifyOTP } from '@/app/lib/otp-store'
import { createSession, SESSION_COOKIE, SUPER_ADMIN_PHONE } from '@/app/lib/session'
import { ensureAccount, dashForRole, getAccount, createVerifiedAccount, applyIdentity, touchLogin } from '@/app/lib/account-store'
import { linkPhone } from '@/app/lib/tracker-store'
import { attachPhone } from '@/app/lib/push-store'
import { getPending, deletePending } from '@/app/lib/pending-reg-store'
import { podConfigured } from '@/app/lib/podium'

export async function POST(req: NextRequest) {
  const { phone, code } = await req.json()
  if (!phone || !code) return NextResponse.json({ error: 'اطلاعات ناقص' }, { status: 400 })

  const result = verifyOTP(phone, code)
  if (result === 'expired') return NextResponse.json({ error: 'کد منقضی شده، دوباره ارسال کنید' }, { status: 400 })
  if (result === 'too_many') return NextResponse.json({ error: 'تعداد تلاش‌ها بیش از حد' }, { status: 429 })
  if (result === 'invalid') return NextResponse.json({ error: 'کد اشتباه است' }, { status: 400 })

  const isSuper = phone === SUPER_ADMIN_PHONE
  const role = isSuper ? 'super_admin' : 'user'
  const shahkarOn = podConfigured()
  // ── تعیین/ساختِ حساب ──
  let account; let isNew = false
  if (isSuper) { const r = ensureAccount(phone); account = r.account; isNew = r.isNew }
  else {
    const pending = getPending(phone)
    const existing = getAccount(phone)
    if (pending && pending.matched) {
      // هویتِ تأییدشده: روی حسابِ موجود اعمال کن، یا حسابِ جدید بساز
      account = existing ? applyIdentity(phone, pending) : createVerifiedAccount(phone, pending)
      deletePending(phone); if (!existing) isNew = true
    } else if (existing) {
      // بدونِ pending: حسابِ تأییدشده یا (شاهکار خاموش) ⇒ ورود؛ وگرنه فعال نمی‌شود
      if (existing.identityVerifiedAt || !shahkarOn) { account = existing; touchLogin(phone) }
      else return NextResponse.json({ error: 'برای فعال‌سازیِ حساب، ابتدا هویتِ خود را با شاهکار تأیید کنید.' }, { status: 400 })
    } else if (!shahkarOn) { const r = ensureAccount(phone); account = r.account; isNew = r.isNew }
    else return NextResponse.json({ error: 'ابتدا هویتِ خود را با شاهکار تأیید کنید.' }, { status: 400 })
  }
  if (!account) return NextResponse.json({ error: 'خطا در ساختِ حساب؛ دوباره تلاش کنید.' }, { status: 500 })

  const token = await createSession(phone)
  // اتصالِ شمارهٔ کاربر به کوکیِ دائمیِ ترکر (mj_vid) — برای پیامکِ هدفمندِ بعدی
  const vid = req.cookies.get('mj_vid')?.value || ''
  if (vid && vid.length >= 8) { try { await linkPhone(vid, phone) } catch {}; try { attachPhone(vid, phone) } catch {} }
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
