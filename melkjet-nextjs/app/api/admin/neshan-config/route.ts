import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'

export async function GET() {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const n = getAdminData().neshan
  const mask = (k?: string) => (k ? '***' + k.slice(-4) : '')
  return NextResponse.json({
    configured: !!n?.serviceKey, masked: mask(n?.serviceKey),
    mapConfigured: !!n?.mapKey, mapMasked: mask(n?.mapKey),
  })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const body = await req.json()
  const data = getAdminData()
  const cur = data.neshan || { serviceKey: '' }
  // پشتیبانی از ذخیرهٔ مستقل هر کلید
  const serviceKey = body.serviceKey !== undefined ? String(body.serviceKey).trim() : cur.serviceKey
  const mapKey = body.mapKey !== undefined ? String(body.mapKey).trim() : cur.mapKey
  if (!serviceKey && !mapKey) return NextResponse.json({ error: 'حداقل یک کلید الزامی است' }, { status: 400 })
  data.neshan = { serviceKey: serviceKey || '', mapKey: mapKey || undefined }
  saveAdminData(data)
  return NextResponse.json({ ok: true })
}
