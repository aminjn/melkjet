import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAccount, accountByNationalId, applyIdentity } from '@/app/lib/account-store'
import { getIdentity, shahkarMatch, isValidNationalId, podConfigured, podMissing } from '@/app/lib/podium'
import { grantCoins } from '@/app/lib/empire-store'

// فاز ۲۶۲ — احرازِ هویتِ «اختیاری» داخلِ پنلِ کاربرِ واردشده (نه در ثبت‌نام). موفقیت → علامتِ تأیید + پاداشِ ملک‌کوین.
export const IDENTITY_REWARD = 500
const faToEn = (v: string) => (v || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'ابتدا وارد شوید.' }, { status: 401 })
  const phone = s.phone
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const nid = faToEn(String(b.nationalCode || '')).replace(/[^0-9]/g, '')
  if (nid.length !== 10 || !isValidNationalId(nid)) return NextResponse.json({ error: 'کد ملی نامعتبر است.' }, { status: 400 })
  const jbd = faToEn(String(b.jBirthDate || '')).replace(/[^0-9]/g, '')
  if (jbd.length !== 8) return NextResponse.json({ error: 'تاریخ تولد (شمسی) را کامل وارد کنید: مثل ۱۳۷۰/۰۱/۰۱' }, { status: 400 })

  const existing = getAccount(phone)
  if (existing?.identityVerifiedAt) return NextResponse.json({ ok: true, already: true, verified: true })
  const dup = accountByNationalId(nid)
  if (dup && dup.phone !== phone) return NextResponse.json({ error: 'این کد ملی قبلاً با شماره‌ای دیگر ثبت شده است.' }, { status: 400 })

  if (!podConfigured()) return NextResponse.json({ error: 'سرویسِ احرازِ هویت فعلاً پیکربندی نشده: ' + podMissing().join('، ') }, { status: 400 })

  const idn = await getIdentity(nid, jbd)
  if (!idn.ok || !idn.identity) return NextResponse.json({ error: idn.error || 'استعلامِ هویت ناموفق بود؛ کد ملی و تاریخ تولد را بررسی کنید.' }, { status: 400 })
  const m = await shahkarMatch(nid, phone)
  if (!m.ok) return NextResponse.json({ error: m.error || 'سرویسِ شاهکار پاسخ نداد؛ بعداً دوباره تلاش کنید.' }, { status: 400 })
  if (!m.matched) return NextResponse.json({ error: 'این شماره موبایل به نامِ این کد ملی نیست؛ با شمارهٔ خودتان اقدام کنید.' }, { status: 400 })

  const i = idn.identity
  applyIdentity(phone, {
    nationalId: nid, firstName: i.firstName, lastName: i.lastName, gender: i.gender, fatherName: i.fatherName,
    birthDate: i.birthDate || jbd, birthPlace: i.birthPlace, idNumber: i.idNumber, idSerial: i.idSerial,
    birthPlaceCode: i.birthPlaceCode, fullName: i.fullName, issuancePlace: i.issuancePlace,
    issuancePlaceCode: i.issuancePlaceCode, officeCode: i.officeCode, raw: i.raw,
  })
  // پاداشِ یک‌بارهٔ احراز (چون قبلِ applyIdentity گِیتِ already داشتیم، دوباره داده نمی‌شود)
  try { await grantCoins(phone, IDENTITY_REWARD, 'پاداشِ احرازِ هویت') } catch {}

  return NextResponse.json({ ok: true, verified: true, reward: IDENTITY_REWARD, name: `${i.firstName || ''} ${i.lastName || ''}`.trim() })
}
