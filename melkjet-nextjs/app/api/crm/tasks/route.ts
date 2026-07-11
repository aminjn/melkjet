import { NextRequest, NextResponse } from 'next/server'
import { requireModule } from '@/app/lib/plan-gate'
import { listTasks, addTask, toggleTask, deleteTask, updateTask, type Priority } from '@/app/lib/crm-store'
import { getSession } from '@/app/lib/session'

// Persistent CRM task store, scoped per-user by session phone.
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json({ tasks: await listTasks(session.phone) })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  { const pg51 = requireModule(session as any, 'crm'); if (pg51) return NextResponse.json(pg51, { status: 403 }) }   // فاز ۵۱: اعمالِ پلن
  const body = await req.json().catch(() => ({}))
  const title = String(body.title || '').trim()
  if (!title) return NextResponse.json({ error: 'عنوان وظیفه خالی است' }, { status: 400 })
  const priority = (['high', 'medium', 'low'] as const).includes(body.priority) ? body.priority as Priority : undefined
  const due = body.due ? String(body.due) : undefined
  const dueTs = typeof body.dueTs === 'number' && isFinite(body.dueTs) ? body.dueTs : undefined
  const task = await addTask(session.phone, { title, priority, due, dueTs })
  return NextResponse.json({ task })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  { const pg51 = requireModule(session as any, 'crm'); if (pg51) return NextResponse.json(pg51, { status: 403 }) }   // فاز ۵۱: اعمالِ پلن
  const body = await req.json().catch(() => ({}))
  const id = String(body.id || '')
  if (!id) return NextResponse.json({ error: 'شناسه نامعتبر' }, { status: 400 })
  // If the body carries any editable field, apply it via updateTask; otherwise toggle (back-compat).
  const hasPatch = ['title', 'priority', 'due', 'dueTs', 'done'].some(k => body[k] !== undefined)
  if (hasPatch) {
    const priority = (['high', 'medium', 'low'] as const).includes(body.priority) ? body.priority as Priority : undefined
    const task = await updateTask(session.phone, id, {
      title: body.title !== undefined ? String(body.title) : undefined,
      priority,
      due: body.due !== undefined ? String(body.due) : undefined,
      dueTs: typeof body.dueTs === 'number' && isFinite(body.dueTs) ? body.dueTs : undefined,
      done: typeof body.done === 'boolean' ? body.done : undefined,
    })
    if (!task) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
    return NextResponse.json({ task })
  }
  await toggleTask(session.phone, id)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  { const pg51 = requireModule(session as any, 'crm'); if (pg51) return NextResponse.json(pg51, { status: 403 }) }   // فاز ۵۱: اعمالِ پلن
  const id = new URL(req.url).searchParams.get('id') || ''
  if (!id) return NextResponse.json({ error: 'شناسه نامعتبر' }, { status: 400 })
  await deleteTask(session.phone, id)
  return NextResponse.json({ ok: true })
}
