import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import {
  agencyStats, listAgents, listListings, listLeads, listDeals, getAgency,
  addAgent, toggleAgent, deleteAgent, addListing, setListingStatus, assignListing, deleteListing,
  addLead, assignLead, setLeadStage, deleteLead, addDeal, updateAgencyProfile, resolveAgencyName,
  getCommissionConfig, setDefaultCommission, setAgentCommission, clearAgentCommission,
} from '@/app/lib/agency-store'
import { agencyAdvisorFiles } from '@/app/lib/agency-team'
import { checkDuplicate, advisorScope } from '@/app/lib/duplicate-check'

// همهٔ دادهٔ پنل آژانس، مخصوص کاربرِ واردشده (per-profile).
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  const o = s.phone
  return NextResponse.json({
    stats: agencyStats(o), agents: listAgents(o), listings: listListings(o), leads: listLeads(o), deals: listDeals(o),
    advisorFiles: agencyAdvisorFiles(o), commission: getCommissionConfig(o),
  }, { headers: { 'Cache-Control': 'no-store, private' } })
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
    case 'addListing': {
      const listing = addListing(o, b)
      let duplicate: { id: string; title: string; ownerName: string } | undefined
      try {
        const ag = getAgency(o)
        const agName = resolveAgencyName(o, ag.profile?.name) || 'آژانس'
        const scope = [
          ...advisorScope(o),
          ...ag.listings.filter(x => x.id !== listing.id).map(x => ({ id: x.id, ownerName: agName, deal: x.deal, title: x.title, location: x.location, price: x.price })),
        ]
        const dup = await checkDuplicate(scope, { deal: listing.deal, title: listing.title, location: listing.location, price: listing.price }, listing.id)
        if (dup.isDuplicate) duplicate = dup.match
      } catch { /* اختیاری */ }
      return NextResponse.json({ ok: true, listing, duplicate })
    }
    case 'setListingStatus': { const l = setListingStatus(o, String(b.id), b.status); return l ? NextResponse.json({ ok: true, listing: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'assignListing': { const l = assignListing(o, String(b.id), String(b.agent || '')); return l ? NextResponse.json({ ok: true, listing: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'deleteListing': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); deleteListing(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'addLead': if (!b.name) return NextResponse.json({ error: 'نام الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, lead: addLead(o, b) })
    case 'assignLead': { const l = assignLead(o, String(b.id), String(b.agent || '')); return l ? NextResponse.json({ ok: true, lead: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'setLeadStage': { const l = setLeadStage(o, String(b.id), b.stage); return l ? NextResponse.json({ ok: true, lead: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'deleteLead': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); deleteLead(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'addDeal': if (!b.title || !b.agent) return NextResponse.json({ error: 'عنوان و مشاور الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, deal: addDeal(o, { title: String(b.title), amount: Number(b.amount) || 0, agent: String(b.agent), date: String(b.date || '') }) })
    case 'updateProfile': return NextResponse.json({ ok: true, profile: updateAgencyProfile(o, b.patch || {}) })
    case 'setDefaultCommission': return NextResponse.json({ ok: true, commission: setDefaultCommission(o, b.mode, Number(b.value) || 0) })
    case 'setAgentCommission': if (!b.advisorPhone) return NextResponse.json({ error: 'مشاور الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, commission: setAgentCommission(o, String(b.advisorPhone), b.mode, Number(b.value) || 0) })
    case 'clearAgentCommission': if (!b.advisorPhone) return NextResponse.json({ error: 'مشاور الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, commission: clearAgentCommission(o, String(b.advisorPhone)) })
    default: return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
}
