import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listTasks, deleteTask } from '@/app/lib/crm-store'
import { listClients, deleteClient } from '@/app/lib/pros-store'
import { listLeads, updateLead, deleteLead, leadAnalytics, LeadPatch } from '@/app/lib/leads-store'

async function guard() {
  const s = await getSession()
  return s && (s.role === 'super_admin' || (s.staff || []).length > 0) ? s : null
}

// فاز ۱۲۰ (فیدبکِ مستقیم: «CRM که خودشان استفاده می‌کنند را در سوپرادمین ببینم») — نظارتِ سراسری:
// تجمیعِ لیدها/وظایفِ «همهٔ» کاربرانِ سیستم + drill-down فقط‌خواندنیِ CRM هر کاربر. قبلاً فقط دادهٔ
// اکانتِ خودِ ادمین را می‌خواند و همیشه صفر بود — ریشهٔ گزارشِ «به کلِ سیستم وصل نیست».
export async function GET(req: NextRequest) {
  const s = await guard()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const { listAllLeads } = await import('@/app/lib/leads-store')
  const { listAllTasks } = await import('@/app/lib/crm-store')
  const { getAccount } = await import('@/app/lib/account-store')
  const owner = new URL(req.url).searchParams.get('owner') || ''

  // drill-down: CRM کاملِ یک کاربرِ مشخص — فقط‌خواندنی
  if (owner) {
    const [leads, tasks] = await Promise.all([listLeads(owner), listTasks(owner)])
    const a = getAccount(owner)
    return NextResponse.json({
      ok: true, owner: { phone: owner, name: a?.name || '' },
      leads: leads.slice(0, 200).map(l => ({ id: l.id, name: l.name, phone: l.phone || '', need: l.need || '', budgetText: l.budgetText || '', region: l.region || '', stage: l.stage, status: l.status, score: l.score, at: l.lastActivityAt || l.updatedAt || l.createdAt, acts: (l.activities || []).length })),
      tasks: tasks.slice(0, 50).map(t => ({ title: t.title, done: !!t.done, due: t.due || '', createdAt: t.createdAt })),
    })
  }

  // نمای سراسری: همهٔ لیدهای سیستم گروه‌بندی‌شده به‌ازای هر کاربر
  const [allLeads, allTasks, clients] = await Promise.all([listAllLeads(), listAllTasks(), listClients()])
  const now = Date.now(), weekAgo = now - 7 * 864e5
  const byOwner = new Map<string, { leads: number; hot: number; won: number; week: number; lastAt: number }>()
  for (const l of allLeads) {
    const o = l.owner || '؟'
    const g = byOwner.get(o) || { leads: 0, hot: 0, won: 0, week: 0, lastAt: 0 }
    g.leads++
    if (l.status === 'hot') g.hot++
    if (l.stage === 'won' || l.status === 'converted') g.won++
    if ((l.createdAt || 0) >= weekAgo) g.week++
    g.lastAt = Math.max(g.lastAt, l.lastActivityAt || l.updatedAt || l.createdAt || 0)
    byOwner.set(o, g)
  }
  const owners = [...byOwner.entries()].map(([phone, g]) => {
    const a = getAccount(phone)
    return { phone, name: a?.name || '', ...g }
  }).sort((a, b) => b.lastAt - a.lastAt)
  const stats = {
    totalLeads: allLeads.length,
    weekLeads: allLeads.filter(l => (l.createdAt || 0) >= weekAgo).length,
    hot: allLeads.filter(l => l.status === 'hot').length,
    won: allLeads.filter(l => l.stage === 'won' || l.status === 'converted').length,
    owners: owners.length,
    openTasks: allTasks.filter(t => !t.done).length,
    totalClients: clients.length,
  }
  return NextResponse.json({ ok: true, stats, owners: owners.slice(0, 300) })
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
