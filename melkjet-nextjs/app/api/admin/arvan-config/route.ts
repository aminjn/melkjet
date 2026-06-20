import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'

async function guard() { const s = await getSession(); return s && s.role === 'super_admin' }

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const a = getAdminData().arvan
  return NextResponse.json({
    endpoint: a?.endpoint || 's3.ir-thr-at1.arvanstorage.ir',
    bucket: a?.bucket || '',
    accessKey: a?.accessKey ? '***' + a.accessKey.slice(-4) : '',
    secretKey: a?.secretKey ? '***' : '',
    region: a?.region || '',
    configured: !!(a?.bucket && a?.accessKey && a?.secretKey),
  })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const data = getAdminData()
  const cur = data.arvan
  // مقادیر ماسک‌شده → همان قبلی حفظ شود
  const accessKey = (b.accessKey && !String(b.accessKey).startsWith('***')) ? String(b.accessKey) : (cur?.accessKey || '')
  const secretKey = (b.secretKey && !String(b.secretKey).startsWith('***')) ? String(b.secretKey) : (cur?.secretKey || '')
  const endpoint = (b.endpoint ? String(b.endpoint) : (cur?.endpoint || 's3.ir-thr-at1.arvanstorage.ir')).trim()
  const bucket = (b.bucket !== undefined ? String(b.bucket) : (cur?.bucket || '')).trim()
  const region = (b.region !== undefined ? String(b.region) : (cur?.region || '')).trim()

  if (!endpoint || !bucket || !accessKey || !secretKey) {
    return NextResponse.json({ error: 'endpoint، bucket، access key و secret key الزامی است' }, { status: 400 })
  }
  data.arvan = { endpoint, bucket, accessKey, secretKey, region: region || undefined }
  saveAdminData(data)
  return NextResponse.json({ ok: true })
}
