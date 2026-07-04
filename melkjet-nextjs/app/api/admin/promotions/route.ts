import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { PROMO_SLOTS, listPromotions, addPromotion, updatePromotion, deletePromotion } from '@/app/lib/promotion-store'
import { logAudit } from '@/app/lib/audit-store'

async function guard() { const s = await getSession(); return s && s.role === 'super_admin' }
async function actor() { const s = await getSession(); return (s as any)?.name || (s as any)?.phone || 'مدیر' }

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ slots: PROMO_SLOTS, promotions: listPromotions() })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  if (!b.slot || !b.targetId) return NextResponse.json({ error: 'جایگاه و آیتم الزامی است' }, { status: 400 })
  const p = await addPromotion(String(b.slot), String(b.targetId), b.expiresAt ? Number(b.expiresAt) : undefined)
  if (!p) return NextResponse.json({ error: 'جایگاه یا آیتم نامعتبر است' }, { status: 400 })
  logAudit(await actor(), 'پروموت', `${p.title} → ${b.slot}`)
  return NextResponse.json({ ok: true, promotion: p })
}

export async function PATCH(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  const p = updatePromotion(b.id, b)
  if (!p) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
  return NextResponse.json({ ok: true, promotion: p })
}

export async function DELETE(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  deletePromotion(id); return NextResponse.json({ ok: true })
}
