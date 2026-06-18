import { NextRequest, NextResponse } from 'next/server'
import { listTasks, addTask, toggleTask, deleteTask, type Priority } from '@/app/lib/crm-store'
import { getSession } from '@/app/lib/session'

// Persistent CRM task store, scoped per-user by session phone.
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json({ tasks: listTasks(session.phone) })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const title = String(body.title || '').trim()
  if (!title) return NextResponse.json({ error: 'عنوان وظیفه خالی است' }, { status: 400 })
  const priority = (['high', 'medium', 'low'] as const).includes(body.priority) ? body.priority as Priority : undefined
  const due = body.due ? String(body.due) : undefined
  const task = addTask(session.phone, { title, priority, due })
  return NextResponse.json({ task })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const id = String(body.id || '')
  if (!id) return NextResponse.json({ error: 'شناسه نامعتبر' }, { status: 400 })
  toggleTask(session.phone, id)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id') || ''
  if (!id) return NextResponse.json({ error: 'شناسه نامعتبر' }, { status: 400 })
  deleteTask(session.phone, id)
  return NextResponse.json({ ok: true })
}
