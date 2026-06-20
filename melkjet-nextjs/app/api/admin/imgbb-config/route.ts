import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'

async function guard() { const s = await getSession(); return s && s.role === 'super_admin' }

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const a = getAdminData().imgbb
  return NextResponse.json({
    apiKey: a?.apiKey ? '***' + a.apiKey.slice(-4) : '',
    configured: !!a?.apiKey,
  })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const data = getAdminData()
  const apiKey = (b.apiKey && !String(b.apiKey).startsWith('***')) ? String(b.apiKey).trim() : (data.imgbb?.apiKey || '')
  if (!apiKey) return NextResponse.json({ error: 'API key الزامی است' }, { status: 400 })
  data.imgbb = { apiKey }
  saveAdminData(data)
  return NextResponse.json({ ok: true })
}
