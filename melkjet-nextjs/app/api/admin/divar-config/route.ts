import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'

export async function GET() {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const d = (getAdminData().divar || {}) as { proxyUrl?: string; direct?: boolean }
  return NextResponse.json({ configured: !!d.proxyUrl, proxyUrl: d.proxyUrl || '', direct: d.direct === true })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const data = getAdminData()
  const cur = (data.divar || {}) as Record<string, unknown>
  // فیلدهای دیگرِ divar (proxyPool…) حفظ می‌شوند؛ فقط آنچه فرستاده شده عوض می‌شود.
  if ('proxyUrl' in body) cur.proxyUrl = body.proxyUrl ? String(body.proxyUrl).trim() : ''
  if ('direct' in body) cur.direct = body.direct === true
  data.divar = cur
  saveAdminData(data)
  return NextResponse.json({ ok: true })
}
