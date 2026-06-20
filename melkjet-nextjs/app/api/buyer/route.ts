import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import {
  buyerStats, listSaved, listSearches, listViewings, listOffers, listMessages,
  addSaved, removeSaved, addSearch, toggleSearchAlerts, deleteSearch,
  addViewing, setViewingStatus, addOffer, withdrawOffer, markMessageRead, markAllRead, updateBuyerProfile,
} from '@/app/lib/buyer-store'

// همهٔ دادهٔ پنل خریدار، مخصوص کاربرِ واردشده (per-profile).
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  const o = s.phone
  return NextResponse.json({
    stats: buyerStats(o),
    saved: listSaved(o),
    searches: listSearches(o),
    viewings: listViewings(o),
    offers: listOffers(o),
    messages: listMessages(o),
  })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای انجام این عملیات وارد شوید' }, { status: 401 })
  const o = s.phone
  const b = await req.json().catch(() => ({} as any))
  switch (b.action as string) {
    case 'addSaved': return NextResponse.json({ ok: true, item: addSaved(o, b) })
    case 'removeSaved': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); removeSaved(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'addSearch': if (!b.query) return NextResponse.json({ error: 'عبارت جستجو الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, search: addSearch(o, b) })
    case 'toggleSearchAlerts': { const q = toggleSearchAlerts(o, String(b.id)); return q ? NextResponse.json({ ok: true, search: q }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'deleteSearch': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); deleteSearch(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'addViewing': if (!b.propertyTitle || !b.date) return NextResponse.json({ error: 'ملک و تاریخ الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, viewing: addViewing(o, { propertyTitle: String(b.propertyTitle), advisor: b.advisor, date: String(b.date) }) })
    case 'setViewingStatus': { const v = setViewingStatus(o, String(b.id), b.status); return v ? NextResponse.json({ ok: true, viewing: v }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'addOffer': if (!b.propertyTitle) return NextResponse.json({ error: 'ملک الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, offer: addOffer(o, { propertyTitle: String(b.propertyTitle), amount: Number(b.amount) || 0 }) })
    case 'withdrawOffer': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); withdrawOffer(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'markMessageRead': { const m = markMessageRead(o, String(b.id)); return m ? NextResponse.json({ ok: true, message: m }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'markAllRead': markAllRead(o); return NextResponse.json({ ok: true })
    case 'updateProfile': return NextResponse.json({ ok: true, profile: updateBuyerProfile(o, b.patch || {}) })
    default: return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
}
