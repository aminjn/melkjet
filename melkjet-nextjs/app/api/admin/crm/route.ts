import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listTasks, deleteTask } from '@/app/lib/crm-store'
import { listClients, deleteClient } from '@/app/lib/pros-store'
import { listLeads, updateLead, deleteLead, leadAnalytics, LeadPatch } from '@/app/lib/leads-store'

async function guard() {
  const s = await getSession()
  return s && s.role === 'super_admin' ? s : null
}

// GET → aggregated super-admin CRM control center (scoped to the admin's own records).
export async function GET() {
  const s = await guard()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const leads = await listLeads(s.phone)
  const tasks = await listTasks(s.phone)
  const clients = await listClients()
  const analytics = await leadAnalytics(s.phone)
  const stats = {
    totalLeads: leads.length,
    byStage: analytics.byStage,
    conversionRate: analytics.conversionRate,
    revenue: analytics.revenue,
    totalTasks: tasks.length,
    openTasks: tasks.filter(t => !t.done).length,
    totalClients: clients.length,
  }
  return NextResponse.json({ leads, tasks, clients, stats })
}

// PATCH { kind:'lead', id, ...patch } → { lead }
export async function PATCH(req: NextRequest) {
  const s = await guard()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  if (b.kind !== 'lead') return NextResponse.json({ error: 'نوع نامعتبر' }, { status: 400 })
  if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  const { kind, id, ...patch } = b
  const lead = await updateLead(s.phone, id, patch as LeadPatch)
  if (!lead) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
  return NextResponse.json({ lead })
}

// DELETE ?kind=lead|task|client&id= → { ok }
export async function DELETE(req: NextRequest) {
  const s = await guard()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const sp = new URL(req.url).searchParams
  const kind = sp.get('kind')
  const id = sp.get('id')
  if (!id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  switch (kind) {
    case 'lead': await deleteLead(s.phone, id); break
    case 'task': await deleteTask(s.phone, id); break
    case 'client': await deleteClient(id); break
    default: return NextResponse.json({ error: 'نوع نامعتبر' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
