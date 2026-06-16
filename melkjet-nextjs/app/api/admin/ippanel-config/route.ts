import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  }
  const data = getAdminData()
  return NextResponse.json({
    apiKey: data.ippanel?.apiKey ? '***' + data.ippanel.apiKey.slice(-4) : '',
    sender: data.ippanel?.sender || '',
    pattern: data.ippanel?.pattern || '',
    configured: !!data.ippanel?.apiKey,
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  }

  const { apiKey, sender, pattern } = await req.json()
  if (!apiKey || !sender || !pattern) {
    return NextResponse.json({ error: 'همه فیلدها الزامی است' }, { status: 400 })
  }

  const data = getAdminData()
  data.ippanel = { apiKey, sender, pattern }
  saveAdminData(data)

  return NextResponse.json({ ok: true })
}
