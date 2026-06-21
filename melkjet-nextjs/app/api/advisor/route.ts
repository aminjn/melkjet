import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import {
  advisorStats, listLeads, listListings, listAppts, listCommissions,
  addLead, setLeadStage, deleteLead, addListing, setListingStatus, deleteListing,
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
    case 'setLeadStage': { const l = setLeadStage(o, String(b.id), b.stage); return l ? NextResponse.json({ ok: true, lead: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'deleteLead': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); deleteLead(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'addListing': return NextResponse.json({ ok: true, listing: addListing(o, b) })
    case 'setListingStatus': { const l = setListingStatus(o, String(b.id), b.status); return l ? NextResponse.json({ ok: true, listing: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'deleteListing': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); deleteListing(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'addAppt': if (!b.client || !b.date) return NextResponse.json({ error: 'مشتری و تاریخ الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, appt: addAppt(o, { client: String(b.client), listingTitle: b.listingTitle, date: String(b.date), type: b.type }) })
    case 'setApptStatus': { const x = setApptStatus(o, String(b.id), b.status); return x ? NextResponse.json({ ok: true, appt: x }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'addCommission': if (!b.dealTitle) return NextResponse.json({ error: 'عنوان معامله الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, commission: addCommission(o, { dealTitle: String(b.dealTitle), amount: Number(b.amount) || 0, date: b.date }) })
    case 'deleteCommission': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); deleteCommission(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'setCommissionStatus': { const c = setCommissionStatus(o, String(b.id), b.status); return c ? NextResponse.json({ ok: true, commission: c }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'updateProfile': return NextResponse.json({ ok: true, profile: updateAdvisorProfile(o, b.patch || {}) })
    default: return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
}
