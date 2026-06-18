import { NextRequest, NextResponse } from 'next/server'
import {
  listWorkflows,
  getWorkflow,
  saveWorkflow,
  removeWorkflow,
} from '@/app/lib/workflow-store'
import { getSession } from '@/app/lib/session'

// Persistent workflow store, scoped per-user by session phone.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (id) {
    const workflow = getWorkflow(session.phone, id)
    if (!workflow) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
    return NextResponse.json({ workflow })
  }
  return NextResponse.json({ workflows: listWorkflows(session.phone) })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const workflow = saveWorkflow(session.phone, {
    id: body.id ? String(body.id) : undefined,
    name: String(body.name || ''),
    nodes: Array.isArray(body.nodes) ? body.nodes : [],
    connections: Array.isArray(body.connections) ? body.connections : [],
  })
  return NextResponse.json({ workflow })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id') || ''
  if (!id) return NextResponse.json({ error: 'شناسه نامعتبر' }, { status: 400 })
  removeWorkflow(session.phone, id)
  return NextResponse.json({ ok: true })
}
