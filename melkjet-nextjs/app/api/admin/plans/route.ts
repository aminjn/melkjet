import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import {
  listPlans, addPlan, updatePlan, deletePlan,
  type PlanPatch,
} from '@/app/lib/plan-store'

async function guard() {
  const s = await getSession()
  return s && s.role === 'super_admin'
}

// GET → { plans }  (all plans, ordered)
export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ plans: listPlans() })
}

// POST { name, priceMonthly, priceYearly, features?, highlighted?, cta?, order?, active? } → { plan }
export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const name = String(b.name || '').trim()
  if (!name) return NextResponse.json({ error: 'نام پلن الزامی است' }, { status: 400 })
  const plan = addPlan({
    name,
    priceMonthly: b.priceMonthly != null ? Number(b.priceMonthly) : 0,
    priceYearly: b.priceYearly != null ? Number(b.priceYearly) : 0,
    currency: b.currency ? String(b.currency) : undefined,
    features: Array.isArray(b.features) ? b.features.map((f: unknown) => String(f)) : undefined,
    highlighted: b.highlighted !== undefined ? !!b.highlighted : undefined,
    cta: b.cta ? String(b.cta) : undefined,
    order: b.order != null && b.order !== '' ? Number(b.order) : undefined,
    active: b.active !== undefined ? !!b.active : undefined,
  })
  return NextResponse.json({ plan })
}

// PATCH { id, ...patch } → { plan }
export async function PATCH(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const id = String(b.id || '')
  if (!id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  const { id: _id, ...patch } = b as { id?: string } & PlanPatch
  const plan = updatePlan(id, patch as PlanPatch)
  if (!plan) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
  return NextResponse.json({ plan })
}

// DELETE ?id= → { ok }
export async function DELETE(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id') || ''
  if (!id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  deletePlan(id)
  return NextResponse.json({ ok: true })
}
