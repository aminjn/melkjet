import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listLeads, addLead, updateLead, deleteLead, Stage } from '@/app/lib/leads-store'

const STAGES: Stage[] = ['new', 'review', 'offered', 'contract', 'lost']

// GET → { leads } — open read for the CRM panel.
export async function GET() {
  return NextResponse.json({ leads: listLeads() })
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
  const lead = addLead({
    name: b.name,
    phone: b.phone,
    need: b.need,
    budget: b.budget,
    stage,
    score: typeof b.score === 'number' ? b.score : undefined,
    note: b.note,
    owner: s.phone,
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
  const lead = updateLead(id, patch)
  if (!lead) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
  return NextResponse.json({ lead })
}

// DELETE ?id= → { ok }
export async function DELETE(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  deleteLead(id)
  return NextResponse.json({ ok: true })
}
