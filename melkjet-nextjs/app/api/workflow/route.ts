import { NextRequest, NextResponse } from 'next/server'
import { requireModule } from '@/app/lib/plan-gate'
import {
  listWorkflows,
  getWorkflow,
  saveWorkflow,
  removeWorkflow,
  ensureDefaultWorkflows,
} from '@/app/lib/workflow-store'
import { getSession } from '@/app/lib/session'
import { resetWfState } from '@/app/lib/workflow-runner-store'
import { getAccount, dashForRole } from '@/app/lib/account-store'

// Persistent workflow store, scoped per-user by session phone.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  { const pg51 = requireModule(session as any, 'automation'); if (pg51) return NextResponse.json(pg51, { status: 403 }) }   // فاز ۵۱: اعمالِ پلن
  const id = new URL(req.url).searchParams.get('id')
  if (id) {
    const workflow = getWorkflow(session.phone, id)
    if (!workflow) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
    return NextResponse.json({ workflow })
  }
  // اولین بار: اتوماسیون‌های پیش‌فرضِ متناسب با نقش را بساز (خاموش).
  const dash = session.role === 'super_admin' ? '/pros' : dashForRole(getAccount(session.phone)?.role)
  await ensureDefaultWorkflows(session.phone, dash)
  return NextResponse.json({ workflows: await listWorkflows(session.phone) })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  { const pg51 = requireModule(session as any, 'automation'); if (pg51) return NextResponse.json(pg51, { status: 403 }) }   // فاز ۵۱: اعمالِ پلن
  const body = await req.json().catch(() => ({}))
  const wasEnabled = body.id ? !!(await getWorkflow(session.phone, String(body.id)))?.enabled : false
  const workflow = await saveWorkflow(session.phone, {
    id: body.id ? String(body.id) : undefined,
    name: String(body.name || ''),
    nodes: Array.isArray(body.nodes) ? body.nodes : [],
    connections: Array.isArray(body.connections) ? body.connections : [],
    enabled: body.enabled !== undefined ? !!body.enabled : undefined,
  })
  // با فعال‌سازی (خاموش→روشن)، وضعیتِ اجرا ریست می‌شود تا فقط رویدادهای بعد از این لحظه شلیک کنند.
  if (workflow.enabled && !wasEnabled) resetWfState(workflow.id, Date.now())
  return NextResponse.json({ workflow })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  { const pg51 = requireModule(session as any, 'automation'); if (pg51) return NextResponse.json(pg51, { status: 403 }) }   // فاز ۵۱: اعمالِ پلن
  const id = new URL(req.url).searchParams.get('id') || ''
  if (!id) return NextResponse.json({ error: 'شناسه نامعتبر' }, { status: 400 })
  await removeWorkflow(session.phone, id)
  return NextResponse.json({ ok: true })
}
