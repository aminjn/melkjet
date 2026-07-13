import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getIdentity, shahkarMatch, isValidNationalId, podConfigured, podMissing } from '@/app/lib/podium'

const faToEn = (v: string) => (v || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))

// استعلامِ شاهکار برای سوپرادمین (هنگامِ ساختِ کاربر): هویت از کد ملی + تاریخ تولد، و تطبیقِ موبایل (اختیاری).
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || !(s.role === 'super_admin' || (s.staff || []).includes('users'))) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })   // فاز ۱۲۴: پرسنلِ بخشِ کاربران هم
  if (!podConfigured()) return NextResponse.json({ error: 'سرویسِ شاهکار پیکربندی نشده: ' + podMissing().join('، ') }, { status: 400 })

  const b = await req.json().catch(() => ({} as any))
  const nid = faToEn(String(b.nationalCode || '')).replace(/[^0-9]/g, '')
  if (nid.length !== 10 || !isValidNationalId(nid)) return NextResponse.json({ error: 'کد ملی نامعتبر است.' }, { status: 400 })
  const jbd = faToEn(String(b.jBirthDate || '')).replace(/[^0-9]/g, '')
  if (jbd.length !== 8) return NextResponse.json({ error: 'تاریخ تولد (شمسی) را کامل وارد کنید.' }, { status: 400 })

  const idn = await getIdentity(nid, jbd)
  if (!idn.ok || !idn.identity) return NextResponse.json({ error: idn.error || 'استعلامِ هویت ناموفق بود.' }, { status: 400 })

  let matched: boolean | null = null
  const phone = faToEn(String(b.phone || '')).replace(/\D/g, '')
  if (/^09\d{9}$/.test(phone)) { const m = await shahkarMatch(nid, phone); matched = m.ok ? m.matched : null }

  const i = idn.identity
  return NextResponse.json({ ok: true, matched, identity: { nationalId: nid, firstName: i.firstName, lastName: i.lastName, gender: i.gender, fatherName: i.fatherName, birthDate: i.birthDate || jbd, birthPlace: i.birthPlace, idNumber: i.idNumber, idSerial: i.idSerial, birthPlaceCode: i.birthPlaceCode } })
}
