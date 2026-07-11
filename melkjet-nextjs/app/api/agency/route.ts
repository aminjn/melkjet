import { NextRequest, NextResponse } from 'next/server'
import { requireModule, requireQuota } from '@/app/lib/plan-gate'
import { getSession } from '@/app/lib/session'
import {
  agencyStats, listAgents, listListings, listLeads, listDeals, getAgency,
  addAgent, toggleAgent, deleteAgent, addListing, setListingStatus, assignListing, deleteListing,
  addLead, assignLead, setLeadStage, deleteLead, addDeal, updateAgencyProfile, resolveAgencyName,
  getCommissionConfig, setDefaultCommission, setAgentCommission, clearAgentCommission,
  addLeadActivity, agencyAiInsights, agencyLeadAdvice, setLeadReminder, backfillAssignedPhones, type ActivityType,
} from '@/app/lib/agency-store'
import { getCrmSettings, setCrmSettings } from '@/app/lib/crm-settings-store'
import { sendServiceSms } from '@/app/lib/sms'
import { agencyAdvisorFiles } from '@/app/lib/agency-team'
import { planDistribution, findConflicts } from '@/app/lib/agency-distribution'
import { forecastIncome, advisorPerformance, teamInsights } from '@/app/lib/agency-ai'
import { agentModel, agentProvider, chatCompleteSafe } from '@/app/lib/gapgpt'
import { getAdvisor, setListingStatus as advSetStatus, deleteListing as advDeleteListing, addLead as advAddLead, listLeads as advListLeads } from '@/app/lib/advisor-store'
import { listAgencyMembers } from '@/app/lib/agency-link-store'
import { loadAgentsForAgency } from '@/app/lib/reos/data'
import { assignLeadToAgent } from '@/app/lib/reos/engine'
import { ingest } from '@/app/lib/reos/events'
import { parseFaNum } from '@/app/lib/reos/features'

// وقتی آژانس یک لید را به مشاور تخصیص می‌دهد، همان لید در پنلِ خودِ آن مشاور (advisor-store)
// هم ساخته می‌شود تا واقعاً در «/pros → لیدها» ببیندش. dedup: اگر مشاور از قبل لیدی با همان
// شماره (یا همان نام، اگر شماره نبود) دارد، دوباره ساخته نمی‌شود.
// لینک بر اساسِ آیدیِ پروفایل (شماره)، نه نام. lead در store خودِ آن مشاور ساخته می‌شود.
async function pushLeadToAdvisor(agencyName: string, lead: { name: string; phone?: string; email?: string; need?: string; budget?: string; stage?: string }, advisorPhone?: string): Promise<void> {
  if (!advisorPhone) return   // فقط مشاورِ واقعیِ لینک‌شده (اکانت‌دار) پنل دارد
  try {
    const nm = (s?: string) => (s || '').replace(/\s+/g, ' ').trim()
    const existing = await advListLeads(advisorPhone)
    const key = (l: { phone?: string; name?: string }) => (l.phone || '').replace(/\D/g, '') || nm(l.name)
    const want = key(lead)
    if (want && existing.some(l => key(l) === want)) return   // قبلاً ساخته شده
    const stageMap: Record<string, string> = { new: 'new', assigned: 'contacted', visit: 'visit', negotiation: 'negotiation', closed: 'closed', lost: 'lost' }
    await advAddLead(advisorPhone, {
      name: lead.name, phone: lead.phone, email: lead.email, need: lead.need, budget: lead.budget,
      source: `آژانس${agencyName ? ': ' + agencyName : ''}`,
      stage: (stageMap[lead.stage || 'new'] || 'new') as any,
    })
  } catch { /* تخصیص نباید به‌خاطرِ خطای push خراب شود */ }
}

// نامِ مشاور → آیدیِ پروفایل (شماره) از عضویت. تنها نقطه‌ای که نام درگیر است، همین‌جاست
// (تبدیلِ انتخابِ کشو به آیدی)؛ از این به بعد همه‌چیز با آیدی کار می‌کند.
async function advisorPhoneOf(agencyOwner: string, advisorName: string): Promise<string | undefined> {
  const nm = (s?: string) => (s || '').replace(/\s+/g, ' ').trim()
  if (!nm(advisorName)) return undefined
  try { const members = await listAgencyMembers(agencyOwner); return members.find(x => nm(x.advisorName) === nm(advisorName))?.advisorPhone } catch { return undefined }
}
import { checkDuplicate, advisorScope } from '@/app/lib/duplicate-check'

// همهٔ دادهٔ پنل آژانس، مخصوص کاربرِ واردشده (per-profile).
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  { const pg51 = requireModule(s as any, 'crm'); if (pg51) return NextResponse.json(pg51, { status: 403 }) }   // فاز ۵۱: اعمالِ پلن
  const o = s.phone
  // مهاجرتِ یک‌بارهٔ لینکِ لیدهای قدیمی از «نام» به «آیدیِ پروفایل» (فقط وقتی لازم است می‌نویسد).
  try {
    const ag = await getAgency(o)
    if (ag.leads.some(l => l.assignedTo && !l.assignedToPhone)) {
      const nm2 = (x?: string) => (x || '').replace(/\s+/g, ' ').trim()
      const map: Record<string, string> = {}
      for (const m of await listAgencyMembers(o)) if (m.advisorPhone) map[nm2(m.advisorName)] = m.advisorPhone
      if (Object.keys(map).length) await backfillAssignedPhones(o, map)
    }
  } catch {}
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
  { const pg51 = requireModule(s as any, 'crm'); if (pg51) return NextResponse.json(pg51, { status: 403 }) }   // فاز ۵۱: اعمالِ پلن
  const o = s.phone
  const b = await req.json().catch(() => ({} as any))
  switch (b.action as string) {
    case 'addAgent': {
      { const q52 = requireQuota(s as any, 'agents', (await listAgents(o)).length); if (q52) return NextResponse.json(q52, { status: 403 }) }   // فاز ۵۲: سقفِ داینامیکِ پلن
      if (!b.name) return NextResponse.json({ error: 'نام الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, agent: await addAgent(o, { name: String(b.name), phone: b.phone }) })
    }
    case 'toggleAgent': { const g = await toggleAgent(o, String(b.id)); return g ? NextResponse.json({ ok: true, agent: g }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'deleteAgent': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); await deleteAgent(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'addListing': {
      { const q52 = requireQuota(s as any, 'files', (await listListings(o)).length); if (q52) return NextResponse.json(q52, { status: 403 }) }   // فاز ۵۲: سقفِ داینامیکِ پلن
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
    case 'addLead': {
      { const q52 = requireQuota(s as any, 'leads', (await listLeads(o)).length); if (q52) return NextResponse.json(q52, { status: 403 }) }   // فاز ۵۲: سقفِ داینامیکِ پلن
      if (!b.name) return NextResponse.json({ error: 'نام الزامی است' }, { status: 400 })
      const lead = await addLead(o, b)
      let welcomed = false
      try {
        const cfg = await getCrmSettings(o)
        if (cfg.autoWelcomeSms && lead.phone) {
          const r = await sendServiceSms(lead.phone, cfg.welcomeTemplate.replace(/\{name\}/g, lead.name || ''), 'خوش‌آمدِ لید')
          welcomed = r.ok
          await addLeadActivity(o, lead.id, { type: 'sms', note: r.ok ? 'پیامکِ خوش‌آمدِ خودکار' : `پیامکِ خوش‌آمد ناموفق: ${r.error || ''}` })
        }
      } catch {}
      return NextResponse.json({ ok: true, lead, welcomed })
    }
    case 'setReminder': { if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); const l = await setLeadReminder(o, String(b.id), b.at ? Number(b.at) : null); return l ? NextResponse.json({ ok: true, lead: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'getCrmSettings': return NextResponse.json({ ok: true, settings: await getCrmSettings(o) })
    case 'setCrmSettings': return NextResponse.json({ ok: true, settings: await setCrmSettings(o, b.patch || {}) })
    case 'assignLead': {
      const agent = String(b.agent || '')
      const agentPhone = agent ? await advisorPhoneOf(o, agent) : undefined   // آیدیِ پروفایل
      const l = await assignLead(o, String(b.id), agent, agentPhone)
      if (!l) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
      if (agentPhone) { const agencyName = await resolveAgencyName(o); await pushLeadToAdvisor(agencyName, l, agentPhone) }
      return NextResponse.json({ ok: true, lead: l })
    }
    case 'setLeadStage': { const l = await setLeadStage(o, String(b.id), b.stage); return l ? NextResponse.json({ ok: true, lead: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'deleteLead': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); await deleteLead(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'addActivity': { if (!b.id || !b.type) return NextResponse.json({ error: 'شناسه و نوع الزامی است' }, { status: 400 }); const l = await addLeadActivity(o, String(b.id), { type: b.type as ActivityType, note: b.note ? String(b.note) : undefined }); return l ? NextResponse.json({ ok: true, lead: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'crmInsights': { const r = await agencyAiInsights(o); return NextResponse.json({ ok: true, ...r }) }
    case 'leadAdvice': { if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); const advice = await agencyLeadAdvice(o, String(b.id)); return NextResponse.json({ ok: true, advice }) }
    case 'addDeal': if (!b.title || !b.agent) return NextResponse.json({ error: 'عنوان و مشاور الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, deal: await addDeal(o, { title: String(b.title), amount: Number(b.amount) || 0, agent: String(b.agent), date: String(b.date || '') }) })
    case 'updateProfile': return NextResponse.json({ ok: true, profile: await updateAgencyProfile(o, b.patch || {}) })
    case 'setDefaultCommission': return NextResponse.json({ ok: true, commission: await setDefaultCommission(o, b.mode, Number(b.value) || 0) })
    case 'setAgentCommission': if (!b.advisorPhone) return NextResponse.json({ error: 'مشاور الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, commission: await setAgentCommission(o, String(b.advisorPhone), b.mode, Number(b.value) || 0) })
    case 'clearAgentCommission': if (!b.advisorPhone) return NextResponse.json({ error: 'مشاور الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, commission: await clearAgentCommission(o, String(b.advisorPhone)) })
    case 'distributeLeads': {
      // موتورِ تقسیمِ خودکارِ لید: لیدهای تقسیم‌نشده را بینِ مشاورانِ فعال پخش کن.
      // استخرِ مشاوران = مشاورانِ محلیِ فعال + مشاورانِ واقعیِ لینک‌شده (با آمارِ عملکردِ واقعی‌شان).
      const agency = await getAgency(o)
      const af = await agencyAdvisorFiles(o)
      const localNames = new Set(agency.agents.filter(a => a.active).map(a => a.name))
      const memberAgents = af.rows.filter(r => !localNames.has(r.advisorName)).map(r => ({
        id: 'm_' + r.advisorPhone, name: r.advisorName, phone: r.advisorPhone,
        deals: r.closedCount, leads: r.leads.total, commission: r.advisorCommission, active: true, createdAt: 0,
      }))
      const pool = [...agency.agents.filter(a => a.active), ...memberAgents]
      const plan = planDistribution(agency.leads, pool, agency.listings)
      const preview = b.preview === true
      if (!preview) for (const a of plan) await assignLead(o, a.leadId, a.agentName)
      return NextResponse.json({ ok: true, assignments: plan, applied: !preview, leads: await listLeads(o) })
    }
    case 'autoAssignLead': {
      // تخصیصِ خودکارِ یک لید به «مناسب‌ترین» مشاور با موتورِ مرکزیِ REOS (perf+ظرفیت+تخصص).
      // مزیت: آیدیِ مشاور (شماره) مستقیم از موتور می‌آید → لینکِ ID-based بدونِ جستجوی نام.
      if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
      const agency = await getAgency(o)
      const lead = agency.leads.find(l => l.id === String(b.id))
      if (!lead) return NextResponse.json({ ok: false, error: 'لید یافت نشد' }, { status: 404 })
      if (lead.stage === 'closed' || lead.stage === 'lost') return NextResponse.json({ ok: false, error: 'این لید بسته/ازدست‌رفته است.' })
      const agents = await loadAgentsForAgency(o)   // آداپتورِ REOS: اعضا (id=شماره) + مشاورِ محلی (id=local:..)
      if (!agents.length) return NextResponse.json({ ok: false, error: 'مشاورِ فعالی برای تخصیص وجود ندارد — اول یک مشاور اضافه/لینک کنید.' })
      const matches = assignLeadToAgent({ need: lead.need, budget: parseFaNum(lead.budget), locationText: lead.need }, agents)
      const best = matches[0]
      if (!best) return NextResponse.json({ ok: false, error: 'تخصیصِ خودکار ممکن نشد.' })
      const agent = agents.find(x => x.id === best.targetId)
      const agentPhone = agent && !agent.id.startsWith('local:') ? agent.id : undefined   // فقط اکانتِ واقعی شماره دارد
      const agentName = agent?.name || best.targetId
      const assigned = await assignLead(o, lead.id, agentName, agentPhone)
      if (assigned && agentPhone) { const agencyName = await resolveAgencyName(o); await pushLeadToAdvisor(agencyName, assigned, agentPhone) }
      // REOS event: تخصیصِ مشاور → flywheel
      try { await ingest({ type: 'agent_assigned', leadId: lead.id, agentId: agentPhone || best.targetId, userId: o }) } catch {}
      return NextResponse.json({ ok: true, assignedTo: agentName, reasons: best.reasons, score: best.score, leads: await listLeads(o) })
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
