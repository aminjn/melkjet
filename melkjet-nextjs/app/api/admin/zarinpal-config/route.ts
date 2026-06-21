import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'

async function guard() { const s = await getSession(); return s && s.role === 'super_admin' }

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const z = getAdminData().zarinpal
  return NextResponse.json({
    merchantId: z?.merchantId ? '***' + z.merchantId.slice(-6) : '',
    sandbox: !!z?.sandbox,
    configured: !!z?.merchantId,
  })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const data = getAdminData()
  const merchantId = (b.merchantId && !String(b.merchantId).startsWith('***')) ? String(b.merchantId).trim() : (data.zarinpal?.merchantId || '')
  const sandbox = !!b.sandbox
  if (!merchantId) return NextResponse.json({ error: 'مرچنت‌کد الزامی است' }, { status: 400 })
  data.zarinpal = { merchantId, sandbox }
  saveAdminData(data)
  return NextResponse.json({ ok: true })
}
