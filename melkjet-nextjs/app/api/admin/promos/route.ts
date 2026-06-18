import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import {
  listPromos, addPromo, updatePromo, deletePromo, findByCode,
  type PromoType, type PromoPatch,
} from '@/app/lib/promo-store'

async function guard() {
  const s = await getSession()
  return s && s.role === 'super_admin'
}

// GET → { promos }
export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ promos: listPromos() })
}

// POST { code, type, value, description?, maxUses?, expiresAt?, active? } → { promo }
export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const code = String(b.code || '').trim()
  if (!code) return NextResponse.json({ error: 'کد تخفیف الزامی است' }, { status: 400 })
  if (b.value == null || isNaN(Number(b.value))) return NextResponse.json({ error: 'مقدار تخفیف الزامی است' }, { status: 400 })
  if (findByCode(code)) return NextResponse.json({ error: 'این کد تخفیف قبلاً ثبت شده است' }, { status: 400 })
  const type: PromoType = b.type === 'amount' ? 'amount' : 'percent'
  const promo = addPromo({
    code,
    type,
    value: Number(b.value),
    description: b.description ? String(b.description) : undefined,
    maxUses: b.maxUses != null && b.maxUses !== '' ? Number(b.maxUses) : undefined,
    expiresAt: b.expiresAt != null && b.expiresAt !== '' ? Number(b.expiresAt) : undefined,
    active: b.active !== undefined ? !!b.active : undefined,
  })
  return NextResponse.json({ promo })
}

// PATCH { id, ...patch } → { promo }
export async function PATCH(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const id = String(b.id || '')
  if (!id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  // If code is being changed, reject duplicates against a different promo.
  if (b.code != null && String(b.code).trim()) {
    const existing = findByCode(String(b.code))
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: 'این کد تخفیف قبلاً ثبت شده است' }, { status: 400 })
    }
  }
  const { id: _id, ...patch } = b as { id?: string } & PromoPatch
  const promo = updatePromo(id, patch as PromoPatch)
  if (!promo) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
  return NextResponse.json({ promo })
}

// DELETE ?id= → { ok }
export async function DELETE(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id') || ''
  if (!id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  deletePromo(id)
  return NextResponse.json({ ok: true })
}
