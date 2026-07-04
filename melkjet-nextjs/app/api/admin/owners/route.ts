import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listOwners, updateOwner, deleteOwner } from '@/app/lib/scraper-store'

async function guard() {
  const s = await getSession()
  return s && s.role === 'super_admin'
}

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ owners: listOwners() })
}

// PATCH { id, name?, phone? }
export async function PATCH(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json()
  if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  const o = await updateOwner(b.id, { name: b.name, phone: b.phone })
  if (!o) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
  return NextResponse.json({ ok: true, owner: o })
}

export async function DELETE(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  await deleteOwner(id)
  return NextResponse.json({ ok: true })
}
