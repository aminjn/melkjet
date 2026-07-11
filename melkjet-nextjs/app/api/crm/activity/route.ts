import { NextRequest, NextResponse } from 'next/server'
import { requireModule } from '@/app/lib/plan-gate'
import { getSession } from '@/app/lib/session'
import { addActivity, getLead, ActivityType } from '@/app/lib/leads-store'

const TYPES: ActivityType[] = ['created', 'call', 'visit', 'message', 'sms', 'email', 'whatsapp', 'click', 'note', 'stage', 'match']

// GET ?leadId= → تایم‌لاینِ فعالیتِ یک لید
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  { const pg51 = requireModule(s as any, 'crm'); if (pg51) return NextResponse.json(pg51, { status: 403 }) }   // فاز ۵۱: اعمالِ پلن
  const leadId = new URL(req.url).searchParams.get('leadId') || ''
  const lead = await getLead(s.phone, leadId)
  if (!lead) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
  return NextResponse.json({ activities: (lead.activities || []).slice().sort((a, b) => b.at - a.at) })
}

// POST { leadId, type, note?, meta? } → ثبتِ فعالیت (تماس/بازدید/یادداشت/کلیک…)
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  { const pg51 = requireModule(s as any, 'crm'); if (pg51) return NextResponse.json(pg51, { status: 403 }) }   // فاز ۵۱: اعمالِ پلن
  const b = await req.json().catch(() => ({}))
  if (!b.leadId) return NextResponse.json({ error: 'شناسهٔ لید الزامی است' }, { status: 400 })
  const type: ActivityType = TYPES.includes(b.type) ? b.type : 'note'
  const lead = await addActivity(s.phone, String(b.leadId), { type, note: b.note ? String(b.note) : undefined, meta: b.meta })
  if (!lead) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
  return NextResponse.json({ lead })
}
