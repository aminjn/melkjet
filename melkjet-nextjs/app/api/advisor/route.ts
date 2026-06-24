import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { warmEnrichment } from '@/app/lib/enrich-warm'
import { checkDuplicate, advisorScope } from '@/app/lib/duplicate-check'
import {
  advisorStats, listLeads, listListings, listAppts, listCommissions,
  addLead, updateLead, setLeadStage, deleteLead, addListing, updateListing, setListingStatus, deleteListing, publishListing, unpublishListing,
  addAppt, setApptStatus, addCommission, deleteCommission, setCommissionStatus, updateAdvisorProfile,
} from '@/app/lib/advisor-store'

// همهٔ دادهٔ پنل مشاور، مخصوص کاربرِ واردشده (per-profile).
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  const o = s.phone
  return NextResponse.json({ stats: advisorStats(o), leads: listLeads(o), listings: listListings(o), appts: listAppts(o), commissions: listCommissions(o) })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای انجام این عملیات وارد شوید' }, { status: 401 })
  const o = s.phone
  const b = await req.json().catch(() => ({} as any))
  switch (b.action as string) {
    case 'addLead': return NextResponse.json({ ok: true, lead: addLead(o, b) })
    case 'updateLead': { if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); const l = updateLead(o, String(b.id), b.patch || {}); return l ? NextResponse.json({ ok: true, lead: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'setLeadStage': { const l = setLeadStage(o, String(b.id), b.stage); return l ? NextResponse.json({ ok: true, lead: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'deleteLead': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); deleteLead(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'addListing': {
      const listing = addListing(o, b)
      let duplicate: { id: string; title: string; ownerName: string } | undefined
      try {
        const dup = await checkDuplicate(advisorScope(o), { deal: listing.deal, title: listing.title, location: listing.location, neighborhood: listing.neighborhood, area: listing.area, price: listing.price, rooms: listing.rooms }, listing.id)
        if (dup.isDuplicate) duplicate = dup.match
      } catch { /* اخطارِ تکراری اختیاری است */ }
      return NextResponse.json({ ok: true, listing, duplicate })
    }
    case 'updateListing': { if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); const l = updateListing(o, String(b.id), b.patch || {}); return l ? NextResponse.json({ ok: true, listing: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'setListingStatus': { const l = setListingStatus(o, String(b.id), b.status); return l ? NextResponse.json({ ok: true, listing: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'deleteListing': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); deleteListing(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'publishListing': { if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); const l = publishListing(o, String(b.id)); if (l?.publicId) warmEnrichment(l.publicId); return l ? NextResponse.json({ ok: true, listing: l, publicId: l.publicId }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'unpublishListing': { if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); const l = unpublishListing(o, String(b.id)); return l ? NextResponse.json({ ok: true, listing: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'addAppt': if (!b.client || !b.date) return NextResponse.json({ error: 'مشتری و تاریخ الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, appt: addAppt(o, { client: String(b.client), listingTitle: b.listingTitle, date: String(b.date), type: b.type }) })
    case 'setApptStatus': { const x = setApptStatus(o, String(b.id), b.status); return x ? NextResponse.json({ ok: true, appt: x }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'addCommission': if (!b.dealTitle) return NextResponse.json({ error: 'عنوان معامله الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, commission: addCommission(o, { dealTitle: String(b.dealTitle), amount: Number(b.amount) || 0, date: b.date, percent: Number(b.percent) || undefined, dealAmount: Number(b.dealAmount) || undefined }) })
    case 'deleteCommission': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); deleteCommission(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'setCommissionStatus': { const c = setCommissionStatus(o, String(b.id), b.status); return c ? NextResponse.json({ ok: true, commission: c }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'updateProfile': return NextResponse.json({ ok: true, profile: updateAdvisorProfile(o, b.patch || {}) })
    default: return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
}
