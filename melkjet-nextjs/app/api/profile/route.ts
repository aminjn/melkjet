import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAccount } from '@/app/lib/account-store'
import { getProfile, saveProfile, completeness } from '@/app/lib/profile-store'

// پروفایلِ کاملِ کاربر/کسب‌وکار + هویتِ تأییدشدهٔ شاهکار (فقط‌خواندنی).
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  const a = getAccount(s.phone)
  const profile = getProfile(s.phone)
  return NextResponse.json({
    phone: s.phone,
    identity: {
      verified: !!a?.identityVerifiedAt, name: a?.name || '', nationalId: a?.nationalId || '',
      firstName: a?.firstName || '', lastName: a?.lastName || '', fatherName: a?.fatherName || '',
      gender: a?.gender || '', birthDate: a?.birthDate || '', birthPlace: a?.birthPlace || '',
      idNumber: a?.idNumber || '', idSerial: a?.idSerial || '', birthPlaceCode: a?.birthPlaceCode || '',
    },
    role: a?.role || '', plan: a?.plan || '',
    profile, completeness: completeness(profile),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای ذخیره وارد شوید' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const profile = saveProfile(s.phone, b.profile || b)
  return NextResponse.json({ ok: true, profile, completeness: completeness(profile) })
}
