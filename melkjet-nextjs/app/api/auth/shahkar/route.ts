import { NextRequest, NextResponse } from 'next/server'
import { accountExists, accountByNationalId } from '@/app/lib/account-store'
import { getIdentity, shahkarMatch, isValidNationalId, podConfigured, podMissing } from '@/app/lib/podium'
import { upsertPending } from '@/app/lib/pending-reg-store'
import { sendOtpSms } from '@/app/lib/send-otp'

const faToEn = (v: string) => (v || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))

// ثبت‌نامِ کاربرِ جدید: استعلامِ ثبت‌احوال (کد ملی + تاریخ تولدِ شمسی) → تطبیقِ شاهکار (موبایل↔کدملی).
// jBirthDate: تاریخِ شمسیِ ۸ رقمی "YYYYMMDD".
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({} as any))
  const phone = String(b.phone || '')
  if (!/^09[0-9]{9}$/.test(phone)) return NextResponse.json({ error: 'شماره موبایل معتبر نیست' }, { status: 400 })
  const nid = faToEn(String(b.nationalCode || '')).replace(/[^0-9]/g, '')
  if (nid.length !== 10 || !isValidNationalId(nid)) return NextResponse.json({ error: 'کد ملی نامعتبر است.' }, { status: 400 })
  const jbd = faToEn(String(b.jBirthDate || '')).replace(/[^0-9]/g, '')
  if (jbd.length !== 8) return NextResponse.json({ error: 'تاریخ تولد (شمسی) را کامل وارد کنید: مثل ۱۳۷۰/۰۱/۰۱' }, { status: 400 })

  if (accountExists(phone)) return NextResponse.json({ error: 'این شماره قبلاً ثبت شده؛ از گزینهٔ ورود استفاده کنید.' }, { status: 400 })
  if (accountByNationalId(nid)) return NextResponse.json({ error: 'با این کد ملی و شماره‌ای دیگر قبلاً ثبت‌نام شده؛ با همان شماره وارد شوید.' }, { status: 400 })

  if (!podConfigured()) return NextResponse.json({ error: 'سرویسِ احرازِ هویت پیکربندی نشده: ' + podMissing().join('، ') }, { status: 400 })

  const idn = await getIdentity(nid, jbd)
  if (!idn.ok || !idn.identity) return NextResponse.json({ error: idn.error || 'استعلامِ هویت ناموفق بود.' }, { status: 400 })

  const m = await shahkarMatch(nid, phone)
  if (!m.ok) return NextResponse.json({ error: m.error || 'سرویسِ شاهکار پاسخ نداد.' }, { status: 400 })
  if (!m.matched) return NextResponse.json({ error: 'این شماره موبایل به نامِ این کد ملی نیست؛ با شماره‌ای که به نامِ خودتان است اقدام کنید.' }, { status: 400 })

  const i = idn.identity
  upsertPending({ phone, nationalId: nid, firstName: i.firstName, lastName: i.lastName, gender: i.gender, fatherName: i.fatherName, birthDate: i.birthDate || jbd, birthPlace: i.birthPlace, matched: true, createdAt: Date.now() })

  const sent = await sendOtpSms(phone)
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 200 })
  return NextResponse.json({ ok: true, name: `${i.firstName || ''} ${i.lastName || ''}`.trim(), dev: sent.dev, code: sent.code })
}
