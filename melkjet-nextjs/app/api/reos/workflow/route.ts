import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { createWorkflow, listWorkflows, setWorkflowActive, runWorkflows, type WfTrigger, type WfCondition, type WfAction } from '@/app/lib/reos/workflow-builder'

// GET /api/reos/workflow — گردش‌کارهای کاربر.
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  return NextResponse.json({ ok: true, workflows: await listWorkflows(s.phone) }, { headers: { 'Cache-Control': 'no-store, private' } })
}

// POST /api/reos/workflow — {action: create|toggle|run}
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const a = String(b.action || 'create')
  if (a === 'create') {
    const wf = await createWorkflow({ ownerId: s.phone, name: String(b.name || 'گردش‌کار'), trigger: (String(b.trigger || 'lead_idle') as WfTrigger), conditions: (b.conditions as WfCondition[]) || [], actions: (b.actions as WfAction[]) || [] })
    return NextResponse.json({ ok: true, workflow: wf })
  }
  if (a === 'toggle') { await setWorkflowActive(String(b.id), b.active !== false); return NextResponse.json({ ok: true }) }
  if (a === 'run') { const r = await runWorkflows(s.phone, (String(b.trigger || 'manual') as WfTrigger)); return NextResponse.json({ ok: true, ...r }) }
  return NextResponse.json({ error: 'اکشن نامعتبر' }, { status: 400 })
}
