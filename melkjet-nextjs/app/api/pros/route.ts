import { NextRequest, NextResponse } from 'next/server'
import { requireQuota } from '@/app/lib/plan-gate'
import {
  listTasks, addTask, toggleTask, deleteTask,
  listClients, addClient, deleteClient,
  type Priority,
} from '@/app/lib/pros-store'
import { getSession } from '@/app/lib/session'

// Persistent professionals store (tasks + clients). A `kind` query/body param
// selects the collection. Reads are open; writes require a logged-in session.
export async function GET(req: NextRequest) {
  const kind = new URL(req.url).searchParams.get('kind')
  if (kind === 'clients') return NextResponse.json({ clients: await listClients() })
  return NextResponse.json({ tasks: await listTasks() })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))

  if (body.kind === 'client') {
    const name = String(body.name || '').trim()
    if (!name) return NextResponse.json({ error: 'نام مشتری خالی است' }, { status: 400 })
    { const q52 = requireQuota(session as any, 'crmCustomers', (await listClients()).length); if (q52) return NextResponse.json(q52, { status: 403 }) }   // فاز ۵۲: سقفِ داینامیکِ پلن
    const client = await addClient({
      name,
      phone: body.phone ? String(body.phone) : undefined,
      need: body.need ? String(body.need) : undefined,
      status: body.status ? String(body.status) : undefined,
    })
    return NextResponse.json({ client })
  }

  // default: task
  const title = String(body.title || '').trim()
  if (!title) return NextResponse.json({ error: 'عنوان وظیفه خالی است' }, { status: 400 })
  const priority = (['high', 'medium', 'low'] as const).includes(body.priority) ? body.priority as Priority : undefined
  const due = body.due ? String(body.due) : undefined
  const task = await addTask({ title, priority, due })
  return NextResponse.json({ task })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const id = String(body.id || '')
  if (!id) return NextResponse.json({ error: 'شناسه نامعتبر' }, { status: 400 })
  // only tasks support toggle
  await toggleTask(id)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const params = new URL(req.url).searchParams
  const kind = params.get('kind')
  const id = params.get('id') || ''
  if (!id) return NextResponse.json({ error: 'شناسه نامعتبر' }, { status: 400 })
  if (kind === 'clients') await deleteClient(id)
  else await deleteTask(id)
  return NextResponse.json({ ok: true })
}
