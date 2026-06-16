import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'

export async function GET() {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const k = getAdminData().neshan?.serviceKey
  return NextResponse.json({ configured: !!k, masked: k ? '***' + k.slice(-4) : '' })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const { serviceKey } = await req.json()
  if (!serviceKey || !String(serviceKey).trim()) return NextResponse.json({ error: 'کلید الزامی است' }, { status: 400 })
  const data = getAdminData()
  data.neshan = { serviceKey: String(serviceKey).trim() }
  saveAdminData(data)
  return NextResponse.json({ ok: true })
}
