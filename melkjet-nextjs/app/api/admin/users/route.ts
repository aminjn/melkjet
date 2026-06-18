import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listAccounts, adminUpdate, deleteAccount, bulkUpdate, bulkDelete } from '@/app/lib/account-store'
import { listRoles } from '@/app/lib/role-store'
import { listPlans } from '@/app/lib/plan-store'

async function guard() { const s = await getSession(); return s && s.role === 'super_admin' }

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const roles = listRoles().map(r => ({ id: r.id, name: r.name }))
  const plans = listPlans().map(p => ({ id: p.id, name: p.name }))
  return NextResponse.json({ users: listAccounts(), roles, plans })
}

export async function PATCH(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  // عملیات دسته‌جمعی
  if (Array.isArray(b.phones)) { bulkUpdate(b.phones, b.patch || {}); return NextResponse.json({ ok: true }) }
  if (!b.phone) return NextResponse.json({ error: 'شماره الزامی است' }, { status: 400 })
  const a = adminUpdate(b.phone, b.patch || {})
  if (!a) return NextResponse.json({ error: 'کاربر یافت نشد' }, { status: 404 })
  return NextResponse.json({ ok: true, user: a })
}

export async function DELETE(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const phone = new URL(req.url).searchParams.get('phone')
  if (phone) { deleteAccount(phone); return NextResponse.json({ ok: true }) }
  const b = await req.json().catch(() => ({}))
  if (Array.isArray(b.phones)) { bulkDelete(b.phones); return NextResponse.json({ ok: true }) }
  return NextResponse.json({ error: 'شماره الزامی است' }, { status: 400 })
}
