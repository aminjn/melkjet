import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listTasks, deleteTask } from '@/app/lib/crm-store'
import { listClients, deleteClient } from '@/app/lib/pros-store'
import { listLeads, updateLead, deleteLead, Stage, LeadPatch } from '@/app/lib/leads-store'

async function guard() {
  const s = await getSession()
  return s && s.role === 'super_admin'
}

// GET → aggregated super-admin CRM control center.
export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const leads = listLeads()
  const tasks = listTasks()
  const clients = listClients()
  const byStage: Record<Stage, number> = { new: 0, review: 0, offered: 0, contract: 0, lost: 0 }
  for (const l of leads) byStage[l.stage] = (byStage[l.stage] || 0) + 1
  const stats = {
    totalLeads: leads.length,
    byStage,
    totalTasks: tasks.length,
    openTasks: tasks.filter(t => !t.done).length,
    totalClients: clients.length,
  }
  return NextResponse.json({ leads, tasks, clients, stats })
}

// PATCH { kind:'lead', id, ...patch } → { lead }
export async function PATCH(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  if (b.kind !== 'lead') return NextResponse.json({ error: 'نوع نامعتبر' }, { status: 400 })
  if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  const { kind, id, ...patch } = b
  const lead = updateLead(id, patch as LeadPatch)
  if (!lead) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
  return NextResponse.json({ lead })
}

// DELETE ?kind=lead|task|client&id= → { ok }
export async function DELETE(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const sp = new URL(req.url).searchParams
  const kind = sp.get('kind')
  const id = sp.get('id')
  if (!id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  switch (kind) {
    case 'lead': deleteLead(id); break
    case 'task': deleteTask(id); break
    case 'client': deleteClient(id); break
    default: return NextResponse.json({ error: 'نوع نامعتبر' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
