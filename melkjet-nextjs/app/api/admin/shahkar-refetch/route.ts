import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAccount, refreshIdentity } from '@/app/lib/account-store'
import { getIdentity, isValidNationalId, podConfigured, podMissing } from '@/app/lib/podium'

// بازخوانیِ کاملِ هویت از شاهکار برای یک کاربرِ احرازشده — همهٔ فیلدها را دوباره می‌گیرد و ذخیره می‌کند.
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || !(s.role === 'super_admin' || (s.staff || []).includes('users'))) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })   // فاز ۱۲۴: پرسنلِ بخشِ کاربران هم
  if (!podConfigured()) return NextResponse.json({ error: 'سرویسِ شاهکار پیکربندی نشده: ' + podMissing().join('، ') }, { status: 400 })
  const b = await req.json().catch(() => ({} as any))
  const phone = String(b.phone || '')
  const a = getAccount(phone)
  if (!a) return NextResponse.json({ error: 'کاربر یافت نشد' }, { status: 404 })
  const nid = String(a.nationalId || '').replace(/[^0-9]/g, '')
  if (nid.length !== 10 || !isValidNationalId(nid)) return NextResponse.json({ error: 'کد ملیِ ذخیره‌شدهٔ این کاربر معتبر نیست؛ کاربر باید دوباره احراز کند.' }, { status: 400 })
  const jbd = String(a.birthDate || '').replace(/[^0-9]/g, '')
  if (jbd.length !== 8) return NextResponse.json({ error: 'تاریخِ تولدِ ذخیره‌شده برای بازخوانی کافی نیست؛ کاربر باید دوباره احراز کند.' }, { status: 400 })
  const idn = await getIdentity(nid, jbd)
  if (!idn.ok || !idn.identity) return NextResponse.json({ error: idn.error || 'استعلامِ هویت ناموفق بود.' }, { status: 400 })
  const updated = refreshIdentity(phone, { nationalId: nid, ...idn.identity })
  return NextResponse.json({ ok: true, account: updated, fields: idn.identity.raw ? Object.keys(idn.identity.raw).length : 0 })
}
