import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listLeads, addLead, updateLead, deleteLead, Stage } from '@/app/lib/leads-store'

const STAGES: Stage[] = ['new', 'review', 'offered', 'contract', 'lost']

// GET → { leads } — scoped to the current user's own leads.
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  return NextResponse.json({ leads: await listLeads(s.phone) })
}

// POST { name, phone?, need?, budget?, stage?, score?, note? } → { lead }
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  if (!b.name || !String(b.name).trim()) {
    return NextResponse.json({ error: 'نام الزامی است' }, { status: 400 })
  }
  const stage: Stage | undefined = b.stage && STAGES.includes(b.stage) ? b.stage : undefined
  const lead = await addLead(s.phone, {
    name: b.name,
    phone: b.phone,
    need: b.need,
    budget: b.budget,
    stage,
    score: typeof b.score === 'number' ? b.score : undefined,
    note: b.note,
  })
  return NextResponse.json({ lead })
}

// PATCH { id, ...patch } → { lead } — also used to move pipeline stage.
export async function PATCH(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  const { id, ...patch } = b
  const lead = await updateLead(s.phone, id, patch)
  if (!lead) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
  return NextResponse.json({ lead })
}

// DELETE ?id= → { ok }
export async function DELETE(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  await deleteLead(s.phone, id)
  return NextResponse.json({ ok: true })
}
