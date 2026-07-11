import { NextRequest, NextResponse } from 'next/server'
import { requireModule, requireQuota } from '@/app/lib/plan-gate'
import { getSession } from '@/app/lib/session'
import { warmEnrichment } from '@/app/lib/enrich-warm'
import { checkDuplicate, advisorScope } from '@/app/lib/duplicate-check'
import { moderateFields } from '@/app/lib/moderation'
import { setModeration } from '@/app/lib/scraper-store'
import {
  advisorStats, listLeads, listListings, listAppts, listCommissions,
  addLead, updateLead, setLeadStage, deleteLead, addListing, updateListing, setListingStatus, deleteListing, publishListing, unpublishListing,
  addAppt, setApptStatus, addCommission, deleteCommission, setCommissionStatus, setCommissionAmount, updateAdvisorProfile,
  addLeadActivity, advisorAiInsights, advisorLeadAdvice, setLeadReminder, type ActivityType,
} from '@/app/lib/advisor-store'
import { getCrmSettings, setCrmSettings } from '@/app/lib/crm-settings-store'
import { sendServiceSms } from '@/app/lib/sms'
import { getAdvisorMembership } from '@/app/lib/agency-link-store'
import { getAgency } from '@/app/lib/agency-store'

// آشتی‌سازی: لیدهای آژانسی که به این مشاور تخصیص یافته‌اند را در پنلِ خودش می‌سازد (گذشته‌نگر +
// خوددرمان). با هر بار بازکردنِ پنل اجرا می‌شود، پس مهم نیست تخصیص کِی انجام شده. مطابقت بر اساسِ
// نامِ عضویت (همان نامی که آژانس در کشوی «تخصیص به…» می‌بیند) → مستقل از مغایرتِ نامِ نمایشیِ اکانت.
async function syncAgencyLeads(advisorPhone: string): Promise<void> {
  try {
    const mem = await getAdvisorMembership(advisorPhone)
    if (!mem) return
    const agency = await getAgency(mem.agencyPhone)
    const nm = (x?: string) => (x || '').replace(/\s+/g, ' ').trim()
    const digits = (x?: string) => (x || '').replace(/\D/g, '')
    const myId = digits(advisorPhone)
    // مطابقت فقط با آیدیِ پروفایل (شماره) — نه نام. سیستم هیچ‌وقت بهم نمی‌ریزد.
    const assigned = agency.leads.filter(l => digits(l.assignedToPhone) === myId && myId && l.stage !== 'lost')
    if (!assigned.length) return
    const existing = await listLeads(advisorPhone)
    const key = (l: { phone?: string; name?: string }) => (l.phone || '').replace(/\D/g, '') || nm(l.name)
    const have = new Set(existing.map(key))
    const stageMap: Record<string, string> = { new: 'new', assigned: 'contacted', visit: 'visit', negotiation: 'negotiation', closed: 'closed', lost: 'lost' }
    for (const l of assigned) {
      const k = key(l)
      if (!k || have.has(k)) continue
      await addLead(advisorPhone, { name: l.name, phone: l.phone, email: (l as { email?: string }).email, need: l.need, budget: l.budget, source: `آژانس${mem.agencyName ? ': ' + mem.agencyName : ''}`, stage: (stageMap[l.stage] || 'new') as any })
      have.add(k)
    }
  } catch { /* آشتی‌سازی نباید بارگذاریِ پنل را خراب کند */ }
}

// همهٔ دادهٔ پنل مشاور، مخصوص کاربرِ واردشده (per-profile).
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  const o = s.phone
  await syncAgencyLeads(o)   // لیدهای تخصیص‌یافتهٔ آژانس را قبل از خواندن، در پنلِ مشاور بساز
  const [stats, leads, listings, appts, commissions] = await Promise.all([advisorStats(o), listLeads(o), listListings(o), listAppts(o), listCommissions(o)])
  return NextResponse.json({ stats, leads, listings, appts, commissions })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای انجام این عملیات وارد شوید' }, { status: 401 })
  { const pg51 = requireModule(s as any, 'crm'); if (pg51) return NextResponse.json(pg51, { status: 403 }) }   // فاز ۵۱: اعمالِ پلن
  const o = s.phone
  const b = await req.json().catch(() => ({} as any))
  switch (b.action as string) {
    case 'addLead': {
      { const q52 = requireQuota(s as any, 'leads', (await listLeads(o)).length); if (q52) return NextResponse.json(q52, { status: 403 }) }   // فاز ۵۲: سقفِ داینامیکِ پلن
      const lead = await addLead(o, b)
      // اتوماسیون: لیدِ جدید با شماره → پیامکِ خوش‌آمدِ خودکار (اگر فعال باشد).
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
    case 'updateLead': { if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); const l = await updateLead(o, String(b.id), b.patch || {}); return l ? NextResponse.json({ ok: true, lead: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'setLeadStage': { const l = await setLeadStage(o, String(b.id), b.stage); return l ? NextResponse.json({ ok: true, lead: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'deleteLead': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); await deleteLead(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'addActivity': { if (!b.id || !b.type) return NextResponse.json({ error: 'شناسه و نوع الزامی است' }, { status: 400 }); const l = await addLeadActivity(o, String(b.id), { type: b.type as ActivityType, note: b.note ? String(b.note) : undefined }); return l ? NextResponse.json({ ok: true, lead: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'aiInsights': { const r = await advisorAiInsights(o); return NextResponse.json({ ok: true, ...r }) }
    case 'leadAdvice': { if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); const advice = await advisorLeadAdvice(o, String(b.id)); return NextResponse.json({ ok: true, advice }) }
    case 'addListing': {
      { const q52 = requireQuota(s as any, 'files', (await listListings(o)).length); if (q52) return NextResponse.json(q52, { status: 403 }) }   // فاز ۵۲: سقفِ داینامیکِ پلن
      const listing = await addListing(o, b)
      let duplicate: { id: string; title: string; ownerName: string } | undefined
      try {
        const dup = await checkDuplicate(await advisorScope(o), { deal: listing.deal, title: listing.title, location: listing.location, neighborhood: listing.neighborhood, area: listing.area, price: listing.price, rooms: listing.rooms }, listing.id)
        if (dup.isDuplicate) duplicate = dup.match
      } catch { /* اخطارِ تکراری اختیاری است */ }
      return NextResponse.json({ ok: true, listing, duplicate })
    }
    case 'updateListing': { if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); const l = await updateListing(o, String(b.id), b.patch || {}); return l ? NextResponse.json({ ok: true, listing: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'setListingStatus': { const l = await setListingStatus(o, String(b.id), b.status); return l ? NextResponse.json({ ok: true, listing: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'deleteListing': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); await deleteListing(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'publishListing': {
      if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
      const lst = (await listListings(o)).find(x => x.id === String(b.id))
      if (!lst) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
      // ممیزیِ قبل از انتشار (مدلِ یادگیرنده → در صورتِ نبودِ اطمینان، AI). فقط ردِ قطعی جلوی انتشار را می‌گیرد.
      const mod = await moderateFields({
        title: lst.title,
        price: lst.deal === 'rent' ? `ودیعه ${lst.price} تومان${lst.rentMonthly ? ` اجاره ماهانه ${lst.rentMonthly} تومان` : ''}` : `${lst.price} تومان`,
        location: [lst.city, lst.neighborhood].filter(Boolean).join('، ') || lst.location,
        excerpt: lst.description,
        meta: { 'نوع معامله': lst.deal === 'rent' ? 'اجاره' : 'فروش', 'متراژ': lst.area ? `${lst.area} متر` : '', 'اتاق خواب': String(lst.rooms || '') },
      }, { excludeId: lst.publicId })
      if (mod.status === 'rejected') return NextResponse.json({ blocked: true, reason: mod.reason, error: `این آگهی در ممیزی رد شد: ${mod.reason}` })
      // آگهیِ تکراری هرگز منتشر نمی‌شود (تشخیصِ خودکار — پیش از انتشار).
      if (mod.status === 'duplicate') return NextResponse.json({ blocked: true, duplicate: true, reason: mod.reason, error: `این آگهی تکراری است و منتشر نشد: ${mod.reason}` })
      const l = await publishListing(o, String(b.id))
      if (l?.publicId) { warmEnrichment(l.publicId); if (mod.status === 'approved') await setModeration(l.publicId, 'approved', mod.reason, mod.score) }
      return l ? NextResponse.json({ ok: true, listing: l, publicId: l.publicId, moderation: mod }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
    }
    case 'unpublishListing': { if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); const l = await unpublishListing(o, String(b.id)); return l ? NextResponse.json({ ok: true, listing: l }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'addAppt': if (!b.client || !b.date) return NextResponse.json({ error: 'مشتری و تاریخ الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, appt: await addAppt(o, { client: String(b.client), leadId: b.leadId ? String(b.leadId) : undefined, listingTitle: b.listingTitle, date: String(b.date), type: b.type }) })
    case 'setApptStatus': { const x = await setApptStatus(o, String(b.id), b.status); return x ? NextResponse.json({ ok: true, appt: x }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'addCommission': if (!b.dealTitle) return NextResponse.json({ error: 'عنوان معامله الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, commission: await addCommission(o, { dealTitle: String(b.dealTitle), amount: Number(b.amount) || 0, date: b.date, percent: Number(b.percent) || undefined, dealAmount: Number(b.dealAmount) || undefined }) })
    case 'deleteCommission': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); await deleteCommission(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'setCommissionStatus': { const c = await setCommissionStatus(o, String(b.id), b.status); return c ? NextResponse.json({ ok: true, commission: c }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'setCommissionAmount': { const c = await setCommissionAmount(o, String(b.id), Number(b.amount) || 0); return c ? NextResponse.json({ ok: true, commission: c }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'updateProfile': return NextResponse.json({ ok: true, profile: await updateAdvisorProfile(o, b.patch || {}) })
    default: return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
}
