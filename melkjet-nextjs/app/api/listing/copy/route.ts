import { NextRequest, NextResponse } from 'next/server'
import { generateListingCopy, ListingFields } from '@/app/lib/listing-copy'

export const dynamic = 'force-dynamic'

// فاز ۲۵۹ — عنوان + توضیحاتِ حرفه‌ای برای فرمِ ثبتِ آگهی (سایت و تلگرام از همین‌جا می‌گیرند).
const norm3 = (v: unknown): boolean | undefined => {
  const s = String(v ?? '').toLowerCase()
  if (v === true || s === 'yes' || s === 'true' || s === 'دارد') return true
  if (v === false || s === 'no' || s === 'false' || s === 'ندارد') return false
  return undefined
}
const dealOf = (v: unknown): string | undefined => {
  const s = String(v ?? '').trim().toLowerCase()
  if (!s) return undefined
  if (s === 'rent' || s.includes('اجاره')) return 'اجاره'
  if (s === 'sale' || s === 'sell' || s.includes('فروش') || s.includes('خرید')) return 'فروش'
  return String(v).trim()
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const price = dealOf(b.dealType) === 'اجاره'
    ? [b.deposit && `ودیعه ${b.deposit}`, b.rent && `اجاره ${b.rent}`].filter(Boolean).join(' · ')
    : (b.totalPrice ? String(b.totalPrice) : (b.price ? String(b.price) : undefined))
  const f: ListingFields = {
    deal: dealOf(b.dealType ?? b.deal),
    propertyType: b.propertyType ? String(b.propertyType).trim() : undefined,
    city: b.city ? String(b.city).trim() : undefined,
    hood: (b.neighborhood || b.district || b.hood) ? String(b.neighborhood || b.district || b.hood).trim() : undefined,
    area: b.area ? String(b.area).trim() : undefined,
    rooms: (b.rooms != null && b.rooms !== '') ? String(b.rooms).trim() : undefined,
    floor: b.floor ? String(b.floor).trim() : undefined,
    totalFloors: b.totalFloors ? String(b.totalFloors).trim() : undefined,
    age: (b.age || b.buildingAge) ? String(b.age || b.buildingAge).trim() : undefined,
    parking: norm3(b.parking),
    elevator: norm3(b.elevator),
    storage: norm3(b.storage),
    price: price || undefined,
    advisorName: (b.advisorName || b.owner) ? String(b.advisorName || b.owner).trim() : undefined,
  }
  try {
    const copy = await generateListingCopy(f)
    return NextResponse.json({ ok: true, ...copy })
  } catch (e) {
    return NextResponse.json({ error: (e as Error)?.message || 'خطا در تولیدِ متن' }, { status: 500 })
  }
}
