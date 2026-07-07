import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import {
  createLead, listLeads, getLead, moveStage, addActivity, timeline,
  createTask, completeTask, listTasks, createMeeting, listMeetings,
  funnel, createAutomation, listAutomations, type Stage,
} from '@/app/lib/reos/crm'

// GET /api/reos/crm?view=leads|tasks|meetings|funnel|automations|timeline&leadId=…&stage=…
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  const view = sp.get('view') || 'leads'
  const uid = s.phone
  switch (view) {
    case 'leads': return json({ leads: await listLeads(uid, { stage: (sp.get('stage') as Stage) || undefined }) })
    case 'tasks': return json({ tasks: await listTasks(uid, { open: sp.get('open') === '1' }) })
    case 'meetings': return json({ meetings: await listMeetings(uid) })
    case 'funnel': return json({ funnel: await funnel(uid) })
    case 'automations': return json({ automations: await listAutomations(uid) })
    case 'timeline': { const id = sp.get('leadId') || ''; const lead = await getLead(id); if (!lead || lead.ownerId !== uid) return NextResponse.json({ error: 'لید یافت نشد' }, { status: 404 }); return json({ lead, timeline: await timeline(id) }) }
    default: return NextResponse.json({ error: 'view نامعتبر' }, { status: 400 })
  }
}
function json(o: object) { return NextResponse.json({ ok: true, ...o }, { headers: { 'Cache-Control': 'no-store, private' } }) }

// POST /api/reos/crm — {action, ...}
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const uid = s.phone
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const a = String(b.action || '')
  // اکشن‌هایی که به مالکیتِ لید نیاز دارند
  const owns = async (leadId: string) => { const l = await getLead(leadId); return l && l.ownerId === uid }

  if (a === 'createLead') return NextResponse.json({ ok: true, lead: await createLead({ ownerId: uid, name: String(b.name || 'بدون‌نام'), phone: b.phone ? String(b.phone) : undefined, email: b.email ? String(b.email) : undefined, source: b.source ? String(b.source) : undefined, stage: b.stage as Stage, value: b.value ? Number(b.value) : undefined, tags: Array.isArray(b.tags) ? (b.tags as string[]) : undefined }) })
  if (a === 'moveStage') { if (!await owns(String(b.leadId))) return deny(); return NextResponse.json({ ok: true, lead: await moveStage(String(b.leadId), String(b.stage) as Stage) }) }
  if (a === 'addActivity') { if (!await owns(String(b.leadId))) return deny(); return NextResponse.json({ ok: true, activity: await addActivity({ ownerId: uid, leadId: String(b.leadId), type: (String(b.type || 'note') as 'note'), text: String(b.text || '') }) }) }
  if (a === 'createTask') return NextResponse.json({ ok: true, task: await createTask({ ownerId: uid, leadId: b.leadId ? String(b.leadId) : undefined, title: String(b.title || 'کار'), dueAt: b.dueAt ? Number(b.dueAt) : undefined }) })
  if (a === 'completeTask') { await completeTask(String(b.id)); return NextResponse.json({ ok: true }) }
  if (a === 'createMeeting') return NextResponse.json({ ok: true, meeting: await createMeeting({ ownerId: uid, leadId: b.leadId ? String(b.leadId) : undefined, title: String(b.title || 'جلسه'), at: Number(b.at) || Date.now(), location: b.location ? String(b.location) : undefined }) })
  if (a === 'createAutomation') return NextResponse.json({ ok: true, automation: await createAutomation({ ownerId: uid, trigger: (String(b.trigger || 'new_lead') as 'new_lead'), params: (b.params as { days?: number; stage?: Stage }) || {}, action: (String(b.autoAction || 'create_task') as 'create_task'), actionParams: (b.actionParams as { title?: string }) || {} }) })
  return NextResponse.json({ error: 'اکشن نامعتبر' }, { status: 400 })
}
function deny() { return NextResponse.json({ error: 'دسترسی نیست' }, { status: 403 }) }
