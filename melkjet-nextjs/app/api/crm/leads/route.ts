import { NextRequest, NextResponse } from 'next/server'
import { requireModule, requireQuota } from '@/app/lib/plan-gate'
import { getSession } from '@/app/lib/session'
import { listLeads, addLead, updateLead, deleteLead, leadAnalytics, followUpNeeded, addActivity } from '@/app/lib/leads-store'
import { getCrmSettings } from '@/app/lib/crm-settings-store'
import { sendServiceSms } from '@/app/lib/sms'

// GET → { leads, analytics?, followUp? } — scoped to the current user's own leads.
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  const leads = await listLeads(s.phone)
  if (sp.get('analytics')) {
    const settings = await getCrmSettings(s.phone)
    return NextResponse.json({
      leads,
      analytics: await leadAnalytics(s.phone),
      followUp: (await followUpNeeded(s.phone, settings.followUpHours)).map(l => ({ id: l.id, name: l.name, phone: l.phone, stage: l.stage, score: l.score, lastActivityAt: l.lastActivityAt })),
    })
  }
  return NextResponse.json({ leads })
}

// POST { name, phone?, need?, budget?, area?, region?, dealType?, stage?, status?, tags?, note?, source? } → { lead }
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  { const pg51 = requireModule(s as any, 'crm'); if (pg51) return NextResponse.json(pg51, { status: 403 }) }   // فاز ۵۱: اعمالِ پلن
  const b = await req.json().catch(() => ({}))
  if (!b.name || !String(b.name).trim()) {
    return NextResponse.json({ error: 'نام الزامی است' }, { status: 400 })
  }
  { const q52 = requireQuota(s as any, 'leads', (await listLeads(s.phone)).length); if (q52) return NextResponse.json(q52, { status: 403 }) }   // فاز ۵۲: سقفِ داینامیکِ پلن
  const lead = await addLead(s.phone, {
    name: b.name, phone: b.phone, need: b.need,
    budget: b.budget, area: b.area, region: b.region, dealType: b.dealType,
    stage: b.stage, status: b.status,
    tags: Array.isArray(b.tags) ? b.tags : undefined,
    note: b.note, source: b.source,
  })
  // اتوماسیون: لیدِ جدید با شماره → پیامکِ خوش‌آمدِ خودکار (فقط اگر کاربر فعالش کرده باشد).
  let welcomed = false
  try {
    const cfg = await getCrmSettings(s.phone)
    if (cfg.autoWelcomeSms && lead.phone) {
      const text = cfg.welcomeTemplate.replace(/\{name\}/g, lead.name || '')
      const r = await sendServiceSms(lead.phone, text, 'خوش‌آمدِ لید')
      welcomed = r.ok
      await addActivity(s.phone, lead.id, { type: 'sms', note: r.ok ? `پیامکِ خوش‌آمدِ خودکار` : `پیامکِ خوش‌آمد ناموفق: ${r.error || ''}`, meta: { auto: true, ok: r.ok } })
    }
  } catch { /* اتوماسیون نباید ثبتِ لید را خراب کند */ }
  return NextResponse.json({ lead, welcomed })
}

// PATCH { id, ...patch } → { lead } — also used to move pipeline stage.
export async function PATCH(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  { const pg51 = requireModule(s as any, 'crm'); if (pg51) return NextResponse.json(pg51, { status: 403 }) }   // فاز ۵۱: اعمالِ پلن
  const b = await req.json().catch(() => ({}))
  if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  const { id, ...patch } = b
  const lead = await updateLead(s.phone, id, patch)
  if (!lead) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
  return NextResponse.json({ lead })
}

// DELETE ?id= → { ok }
export async function DELETE(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  { const pg51 = requireModule(s as any, 'crm'); if (pg51) return NextResponse.json(pg51, { status: 403 }) }   // فاز ۵۱: اعمالِ پلن
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  await deleteLead(s.phone, id)
  return NextResponse.json({ ok: true })
}
