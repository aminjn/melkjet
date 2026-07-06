import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import {
  agencyStats, listAgents, listListings, listLeads, listDeals, getAgency,
  addAgent, toggleAgent, deleteAgent, addListing, setListingStatus, assignListing, deleteListing,
  addLead, assignLead, setLeadStage, deleteLead, addDeal, updateAgencyProfile, resolveAgencyName,
  getCommissionConfig, setDefaultCommission, setAgentCommission, clearAgentCommission,
} from '@/app/lib/agency-store'
import { agencyAdvisorFiles } from '@/app/lib/agency-team'
import { planDistribution, findConflicts } from '@/app/lib/agency-distribution'
import { forecastIncome, advisorPerformance, teamInsights } from '@/app/lib/agency-ai'
import { agentModel, agentProvider, chatCompleteSafe } from '@/app/lib/gapgpt'
import { getAdvisor, setListingStatus as advSetStatus, deleteListing as advDeleteListing } from '@/app/lib/advisor-store'
import { checkDuplicate, advisorScope } from '@/app/lib/duplicate-check'

// همهٔ دادهٔ پنل آژانس، مخصوص کاربرِ واردشده (per-profile).
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  const o = s.phone
  const stats = await agencyStats(o)
  // فایل‌های آژانس در دو جا ذخیره می‌شوند: فرمِ «افزودن فایل» → agency-store، و
  // ایمپورتِ دیوار (ابزارِ مشترکِ مشاور) → advisor-store[همین آژانس]. هر دو باید در «فایل‌ها» دیده شوند.
  const own = await listListings(o)
  const seen = new Set(own.map(l => l.id))
  let imported: typeof own = []
  try {
    imported = ((await getAdvisor(o)).listings || [])
      .filter(l => !seen.has(l.id))
      .map(l => ({
        id: l.id, title: l.title, ptype: l.ptype, location: l.location, price: l.price,
        deal: l.deal, status: l.status, createdAt: l.createdAt,
        province: l.province, city: l.city, district: l.district, neighborhood: l.neighborhood,
        address: l.address, rentMonthly: l.rentMonthly, area: l.area, rooms: l.rooms, floor: l.floor,
        totalFloors: l.totalFloors, yearBuilt: l.yearBuilt, facing: l.facing, docType: l.docType,
        phone: l.phone, description: l.description, parking: l.parking, elevator: l.elevator,
        storage: l.storage, balcony: l.balcony, furnished: l.furnished, amenities: l.amenities, images: l.images,
      })) as typeof own
  } catch {}
  const listings = [...own, ...imported]
  // KPIِ «فایل‌های فعال» هم واقعیت را نشان دهد (شاملِ ایمپورت‌ها).
  if ((stats as any)?.kpis) (stats as any).kpis.activeListings = listings.filter(l => l.status === 'active').length
  const leads = await listLeads(o)
  return NextResponse.json({
    stats, agents: await listAgents(o), listings, leads, deals: await listDeals(o),
    advisorFiles: await agencyAdvisorFiles(o), commission: await getCommissionConfig(o),
    conflicts: findConflicts(leads),   // مدیریتِ تداخلِ لید
  }, { headers: { 'Cache-Control': 'no-store, private' } })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای انجام این عملیات وارد شوید' }, { status: 401 })
  const o = s.phone
  const b = await req.json().catch(() => ({} as any))
  switch (b.action as string) {
    case 'addAgent': if (!b.name) return NextResponse.json({ error: 'نام الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, agent: await addAgent(o, { name: String(b.name), phone: b.phone }) })
    case 'toggleAgent': { const g = await toggleAgent(o, String(b.id)); return g ? NextResponse.json({ ok: true, agent: g }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'deleteAgent': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); await deleteAgent(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'addListing': {
      const listing = await addListing(o, b)
      let duplicate: { id: string; title: string; ownerName: string } | undefined
      try {
        const ag = await getAgency(o)
        const agName = await resolveAgencyName(o, ag.profile?.name) || 'آژانس'
        const scope = [
          ...(await advisorScope(o)),
          ...ag.listings.filter(x => x.id !== listing.id).map(x => ({ id: x.id, ownerName: agName, deal: x.deal, title: x.title, location: x.location, price: x.price })),
        ]
        const dup = await checkDuplicate(scope, { deal: listing.deal, title: listing.title, location: listing.location, price: listing.price }, listing.id)
        if (dup.isDuplicate) duplicate = dup.match
      } catch { /* اختیاری */ }
      return NextResponse.json({ ok: true, listing, duplicate })
    }
    case 'setListingStatus': {
      // اول در فایل‌های خودِ آژانس؛ اگر نبود، فایلِ ایمپورت‌شده از دیوار (advisor-store) است.
      let l: any = await setListingStatus(o, String(b.id), b.status)
      if (!l) { try { l = await advSetStatus(o, String(b.id), b.status) } catch {} }
      return l ? NextResponse.json({ ok: true, listing: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
    }
    case 'assignListing': { const l = await assignListing(o, String(b.id), String(b.agent || '')); return l ? NextResponse.json({ ok: true, listing: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'deleteListing':
      if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
      await deleteListing(o, String(b.id))
      try { await advDeleteListing(o, String(b.id)) } catch {}   // اگر فایلِ ایمپورت‌شده بود، از advisor-store هم حذف شود
      return NextResponse.json({ ok: true })
    case 'addLead': if (!b.name) return NextResponse.json({ error: 'نام الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, lead: await addLead(o, b) })
    case 'assignLead': { const l = await assignLead(o, String(b.id), String(b.agent || '')); return l ? NextResponse.json({ ok: true, lead: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'setLeadStage': { const l = await setLeadStage(o, String(b.id), b.stage); return l ? NextResponse.json({ ok: true, lead: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'deleteLead': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); await deleteLead(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'addDeal': if (!b.title || !b.agent) return NextResponse.json({ error: 'عنوان و مشاور الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, deal: await addDeal(o, { title: String(b.title), amount: Number(b.amount) || 0, agent: String(b.agent), date: String(b.date || '') }) })
    case 'updateProfile': return NextResponse.json({ ok: true, profile: await updateAgencyProfile(o, b.patch || {}) })
    case 'setDefaultCommission': return NextResponse.json({ ok: true, commission: await setDefaultCommission(o, b.mode, Number(b.value) || 0) })
    case 'setAgentCommission': if (!b.advisorPhone) return NextResponse.json({ error: 'مشاور الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, commission: await setAgentCommission(o, String(b.advisorPhone), b.mode, Number(b.value) || 0) })
    case 'clearAgentCommission': if (!b.advisorPhone) return NextResponse.json({ error: 'مشاور الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, commission: await clearAgentCommission(o, String(b.advisorPhone)) })
    case 'distributeLeads': {
      // موتورِ تقسیمِ خودکارِ لید: لیدهای تقسیم‌نشده را بینِ مشاورانِ فعال پخش کن.
      const agency = await getAgency(o)
      const plan = planDistribution(agency.leads, agency.agents, agency.listings)
      const preview = b.preview === true
      if (!preview) for (const a of plan) await assignLead(o, a.leadId, a.agentName)
      return NextResponse.json({ ok: true, assignments: plan, applied: !preview, leads: await listLeads(o) })
    }
    case 'conflicts': return NextResponse.json({ ok: true, conflicts: findConflicts(await listLeads(o)) })
    case 'aiInsights': {
      // تحلیلِ هوشمندِ تیم: پیش‌بینیِ درآمد + عملکردِ مشاوران + پیشنهادها (+ توصیهٔ AI اختیاری).
      const agency = await getAgency(o)
      const forecast = forecastIncome(agency)
      const performance = advisorPerformance(agency)
      const insights = teamInsights(agency)
      let advice: string | null = null
      const model = agentModel('chat', 'text') || agentModel('content', 'text')
      if (model) {
        try {
          const weak = performance.rows.filter(r => r.weak).map(r => r.name).join('، ') || 'ندارد'
          advice = (await chatCompleteSafe(model, [
            { role: 'system', content: 'تو مشاورِ مدیریتِ فروشِ املاک هستی. کوتاه، فارسی و عملی پاسخ بده.' },
            { role: 'user', content: `آژانس با ${agency.agents.filter(a => a.active).length} مشاورِ فعال، ${(agency.leads || []).length} لید، ${(agency.deals || []).length} معامله. مشاورِ ضعیف: ${weak}. برای بهبودِ درآمدِ ماهِ آینده چه کنم؟` },
          ], { temperature: 0.5, max_tokens: 220 }, agentProvider('chat', 'text'))).trim() || null
        } catch {}
      }
      return NextResponse.json({ ok: true, forecast, performance, insights, advice })
    }
    default: return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
}
