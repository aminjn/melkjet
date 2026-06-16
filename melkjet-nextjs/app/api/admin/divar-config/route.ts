import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'

export async function GET() {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const url = getAdminData().divar?.proxyUrl || ''
  return NextResponse.json({ configured: !!url, proxyUrl: url })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const { proxyUrl } = await req.json()
  const data = getAdminData()
  data.divar = { proxyUrl: proxyUrl ? String(proxyUrl).trim() : '' }
  saveAdminData(data)
  return NextResponse.json({ ok: true })
}
