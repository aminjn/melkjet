import { NextRequest, NextResponse } from 'next/server'
import { requireAndBumpUsage } from '@/app/lib/plan-usage'
import { requireModule } from '@/app/lib/plan-gate'
import { getSession } from '@/app/lib/session'
import { listLeads, getLead, followUpNeeded, STAGE_LABEL } from '@/app/lib/leads-store'
import { listItems } from '@/app/lib/scraper-store'
import { getAccount } from '@/app/lib/account-store'
import { matchListingsForLead } from '@/app/lib/crm-matching'
import { agentModel, agentProvider, chatCompleteSafe } from '@/app/lib/gapgpt'

// دستیارِ هوشمندِ فروش. همه چیز پایهٔ heuristic دارد (بدونِ AI هم کار می‌کند)؛
// اگر مدلِ AI تنظیم باشد، یک توصیهٔ کوتاهِ طبیعی هم اضافه می‌شود.
async function aiText(prompt: string): Promise<string | null> {
  const model = agentModel('chat', 'text') || agentModel('content', 'text')
  if (!model) return null
  try {
    const r = await chatCompleteSafe(model, [
      { role: 'system', content: 'تو دستیارِ فروشِ املاک هستی. کوتاه، فارسی، عملی و بدونِ حاشیه پاسخ بده.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.5, max_tokens: 220 }, agentProvider('chat', 'text'))
    return (r || '').trim() || null
  } catch { return null }
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  { const pg51 = requireModule(s as any, 'crm'); if (pg51) return NextResponse.json(pg51, { status: 403 }) }   // فاز ۵۱: اعمالِ پلن
  { const u52 = await requireAndBumpUsage(s as any, 'aiRequests', 1); if (u52) return NextResponse.json(u52, { status: 403 }) }   // فاز ۵۲: سهمیهٔ ماهانهٔ پلن
  const b = await req.json().catch(() => ({}))
  const action = String(b.action || 'next')

  // ۱) با کدام لید تماس بگیرم؟
  if (action === 'next') {
    const open = (await listLeads(s.phone)).filter(l => l.stage !== 'contract' && l.stage !== 'won' && l.stage !== 'lost')
    const stale = new Set((await followUpNeeded(s.phone)).map(l => l.id))
    const ranked = open
      .map(l => ({ l, urgency: l.score + (stale.has(l.id) ? 20 : 0) + (l.status === 'hot' ? 15 : 0) }))
      .sort((a, b) => b.urgency - a.urgency)
      .slice(0, 5)
      .map(({ l }) => ({
        id: l.id, name: l.name, phone: l.phone, score: l.score, stage: STAGE_LABEL[l.stage], status: l.status,
        reason: stale.has(l.id) ? 'مدتی پیگیری نشده' : l.status === 'hot' ? 'لیدِ داغ' : l.score >= 60 ? 'امتیازِ بالا' : 'در جریان',
      }))
    const advice = ranked.length ? await aiText(`این لیدها منتظرند: ${ranked.map(r => `${r.name} (${r.reason}، امتیاز ${r.score})`).join('، ')}. با کدام و چطور تماس بگیرم؟`) : null
    return NextResponse.json({ ok: true, action, leads: ranked, advice })
  }

  // ۲) بهترین فایل برای این مشتری چیست؟
  if (action === 'best') {
    const lead = await getLead(s.phone, String(b.leadId || ''))
    if (!lead) return NextResponse.json({ error: 'لید یافت نشد' }, { status: 404 })
    const name = getAccount(s.phone)?.name || ''
    const all = await listItems('listing', { publicOnly: true })
    const n = name.replace(/\s+/g, ' ').trim().toLocaleLowerCase()
    const mine = name ? all.filter(i => (i.owner || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase() === n) : all
    const matches = matchListingsForLead(lead, (mine.length ? mine : all).slice(0, 400), 5)
    const listings = matches.map(m => ({ id: m.listing.id, title: m.listing.title, price: m.listing.price, location: m.listing.location, score: m.score, reasons: m.reasons }))
    const advice = listings.length ? await aiText(`مشتری «${lead.name}» بودجه ${lead.budgetText || '—'}، منطقه ${lead.region || '—'}. بهترین فایل‌ها: ${listings.map(l => l.title).join('، ')}. کدام را اول پیشنهاد بدهم و چرا؟`) : null
    return NextResponse.json({ ok: true, action, listings, advice })
  }

  // ۳) احتمالِ تبدیلِ لید
  if (action === 'convert') {
    const lead = await getLead(s.phone, String(b.leadId || ''))
    if (!lead) return NextResponse.json({ error: 'لید یافت نشد' }, { status: 404 })
    const stageIdx = ['new', 'contacted', 'review', 'sent', 'offered', 'visited', 'negotiation', 'contract'].indexOf(lead.stage)
    const base = (lead.stage === 'contract' || lead.stage === 'won') ? 100 : lead.stage === 'lost' ? 2 : Math.round(lead.score * 0.6 + Math.max(0, stageIdx) * 6)
    const prob = Math.max(2, Math.min(98, base))
    const advice = await aiText(`لید «${lead.name}» در مرحلهٔ ${STAGE_LABEL[lead.stage]}، امتیاز ${lead.score}. برای بستنِ معامله چه قدمِ بعدی را پیشنهاد می‌دهی؟`)
    return NextResponse.json({ ok: true, action, probability: prob, advice })
  }

  return NextResponse.json({ error: 'action نامعتبر' }, { status: 400 })
}
