import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listRoles, addRole, updateRole, deleteRole, PERMISSIONS } from '@/app/lib/role-store'

async function guard() { const s = await getSession(); return s && s.role === 'super_admin' }

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ roles: listRoles(), permissions: PERMISSIONS })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  if (!b.name || !String(b.name).trim()) return NextResponse.json({ error: 'نام نقش الزامی است' }, { status: 400 })
  const r = addRole({ name: String(b.name).trim(), dashboard: String(b.dashboard || '/buyer'), planId: b.planId || undefined, permissions: Array.isArray(b.permissions) ? b.permissions : [] })
  return NextResponse.json({ ok: true, role: r })
}

export async function PATCH(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  const r = updateRole(b.id, b.patch || {})
  if (!r) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
  return NextResponse.json({ ok: true, role: r })
}

export async function DELETE(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  const ok = deleteRole(id)
  if (!ok) return NextResponse.json({ error: 'نقش پایه قابل حذف نیست' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
