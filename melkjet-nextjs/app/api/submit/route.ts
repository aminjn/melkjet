import { NextRequest, NextResponse } from 'next/server'
import { addUserListing } from '@/app/lib/scraper-store'
import { moderateOne, moderationModel } from '@/app/lib/moderation'

// ثبت آگهی توسط کاربر → بلافاصله وارد صف تأیید AI می‌شود و تأیید/رد می‌گردد.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const title = String(b.title || '').trim()
  if (!title) return NextResponse.json({ error: 'عنوان آگهی الزامی است' }, { status: 400 })

  const meta: Record<string, string> = {}
  for (const [k, v] of Object.entries({
    'نوع معامله': b.dealType, 'نوع ملک': b.propertyType, 'استان': b.province, 'شهر': b.city,
    'منطقه': b.district, 'محله': b.neighborhood, 'متراژ': b.area, 'اتاق': b.rooms,
    'طبقه': b.floor, 'سن بنا': b.buildingAge,
    'پارکینگ': b.parking === 'yes' ? 'دارد' : b.parking === 'no' ? 'ندارد' : '',
    'آسانسور': b.elevator === 'yes' ? 'دارد' : b.elevator === 'no' ? 'ندارد' : '',
    'انباری': b.storage === 'yes' ? 'دارد' : b.storage === 'no' ? 'ندارد' : '',
  })) { if (v != null && String(v).trim()) meta[k] = String(v).trim() }

  const price = b.dealType === 'اجاره'
    ? [b.deposit && `ودیعه ${b.deposit}`, b.rent && `اجاره ${b.rent}`].filter(Boolean).join(' · ')
    : (b.totalPrice ? String(b.totalPrice) : undefined)
  const location = [b.city, b.neighborhood || b.district].filter(Boolean).join('، ') || b.address || undefined

  const item = addUserListing({
    title, price, location,
    excerpt: String(b.description || '').slice(0, 2000) || undefined,
    phone: b.phone ? String(b.phone) : undefined,
    owner: b.owner ? String(b.owner) : undefined,
    image: b.image ? String(b.image) : undefined,
    meta,
  })

  // تأیید/رد فوری: مدلِ یادگیرنده اول، در صورتِ نبودِ اطمینان هوش مصنوعی (اگر تنظیم شده).
  let verdict: any = { status: 'pending', reason: 'در صف بررسی', score: 0 }
  try { verdict = await moderateOne(item, moderationModel()) } catch { /* بماند در صف */ }

  return NextResponse.json({ ok: true, id: item.id, status: verdict.status, reason: verdict.reason, score: verdict.score })
}
