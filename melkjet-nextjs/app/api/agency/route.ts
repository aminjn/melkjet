import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import {
  agencyStats, listAgents, listListings, listLeads, listDeals,
  addAgent, toggleAgent, deleteAgent, addListing, setListingStatus, assignListing, deleteListing,
  addLead, assignLead, setLeadStage, deleteLead, addDeal, updateAgencyProfile,
} from '@/app/lib/agency-store'

// همهٔ دادهٔ پنل آژانس، مخصوص کاربرِ واردشده (per-profile).
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  const o = s.phone
  return NextResponse.json({ stats: agencyStats(o), agents: listAgents(o), listings: listListings(o), leads: listLeads(o), deals: listDeals(o) })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای انجام این عملیات وارد شوید' }, { status: 401 })
  const o = s.phone
  const b = await req.json().catch(() => ({} as any))
  switch (b.action as string) {
    case 'addAgent': if (!b.name) return NextResponse.json({ error: 'نام الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, agent: addAgent(o, { name: String(b.name), phone: b.phone }) })
    case 'toggleAgent': { const g = toggleAgent(o, String(b.id)); return g ? NextResponse.json({ ok: true, agent: g }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'deleteAgent': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); deleteAgent(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'addListing': return NextResponse.json({ ok: true, listing: addListing(o, b) })
    case 'setListingStatus': { const l = setListingStatus(o, String(b.id), b.status); return l ? NextResponse.json({ ok: true, listing: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'assignListing': { const l = assignListing(o, String(b.id), String(b.agent || '')); return l ? NextResponse.json({ ok: true, listing: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'deleteListing': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); deleteListing(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'addLead': if (!b.name) return NextResponse.json({ error: 'نام الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, lead: addLead(o, b) })
    case 'assignLead': { const l = assignLead(o, String(b.id), String(b.agent || '')); return l ? NextResponse.json({ ok: true, lead: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'setLeadStage': { const l = setLeadStage(o, String(b.id), b.stage); return l ? NextResponse.json({ ok: true, lead: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'deleteLead': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); deleteLead(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'addDeal': if (!b.title || !b.agent) return NextResponse.json({ error: 'عنوان و مشاور الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, deal: addDeal(o, { title: String(b.title), amount: Number(b.amount) || 0, agent: String(b.agent), date: String(b.date || '') }) })
    case 'updateProfile': return NextResponse.json({ ok: true, profile: updateAgencyProfile(o, b.patch || {}) })
    default: return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
}
