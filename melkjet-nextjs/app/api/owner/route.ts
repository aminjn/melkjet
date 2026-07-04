import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import {
  ownerStats, listProperties, listInquiries, listViewings, listOffers,
  addProperty, updateProperty, deleteProperty,
  setInquiryStatus, addInquiry, setViewingStatus, addViewing, setOfferStatus, updateOwnerProfile,
} from '@/app/lib/owner-store'

// همهٔ دادهٔ پنل مالک، مخصوص کاربرِ واردشده (per-profile).
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  const o = s.phone
  return NextResponse.json({
    stats: await ownerStats(o),
    properties: await listProperties(o),
    inquiries: await listInquiries(o),
    viewings: await listViewings(o),
    offers: await listOffers(o),
  })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای انجام این عملیات وارد شوید' }, { status: 401 })
  const o = s.phone
  const b = await req.json().catch(() => ({} as any))
  switch (b.action as string) {
    case 'addProperty':
      return NextResponse.json({ ok: true, property: await addProperty(o, b) })
    case 'updateProperty':
      if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
      { const p = await updateProperty(o, String(b.id), b.patch || {}); return p ? NextResponse.json({ ok: true, property: p }) : NextResponse.json({ error: 'ملک یافت نشد' }, { status: 404 }) }
    case 'deleteProperty':
      if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
      await deleteProperty(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'setInquiryStatus':
      { const q = await setInquiryStatus(o, String(b.id), b.status); return q ? NextResponse.json({ ok: true, inquiry: q }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'addInquiry':
      if (!b.propertyId || !b.name) return NextResponse.json({ error: 'ملک و نام الزامی است' }, { status: 400 })
      return NextResponse.json({ ok: true, inquiry: await addInquiry(o, { propertyId: String(b.propertyId), name: String(b.name), phone: b.phone, message: b.message }) })
    case 'setViewingStatus':
      { const v = await setViewingStatus(o, String(b.id), b.status); return v ? NextResponse.json({ ok: true, viewing: v }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'addViewing':
      if (!b.propertyId || !b.visitor || !b.date) return NextResponse.json({ error: 'ملک، نام و تاریخ الزامی است' }, { status: 400 })
      return NextResponse.json({ ok: true, viewing: await addViewing(o, { propertyId: String(b.propertyId), visitor: String(b.visitor), phone: b.phone, date: String(b.date) }) })
    case 'setOfferStatus':
      { const of = await setOfferStatus(o, String(b.id), b.status); return of ? NextResponse.json({ ok: true, offer: of }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'updateProfile':
      return NextResponse.json({ ok: true, profile: await updateOwnerProfile(o, b.patch || {}) })
    default:
      return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
}
