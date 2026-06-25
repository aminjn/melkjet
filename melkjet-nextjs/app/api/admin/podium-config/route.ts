import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'
import { podConfigured, podMissing } from '@/app/lib/podium'

const mask = (s?: string) => s ? '***' + s.slice(-6) : ''

export async function GET() {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const p = getAdminData().podium || {}
  return NextResponse.json({
    token: mask(p.token), idKey: mask(p.idKey), matchKey: mask(p.matchKey),
    idProduct: p.idProduct || '46659320', matchProduct: p.matchProduct || '46645324', url: p.url || '',
    enabled: !!p.enabled, configured: podConfigured(), missing: podMissing(),
  })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  const data = getAdminData()
  const cur = data.podium || {}
  const keep = (v: any, prev?: string) => (v && !String(v).startsWith('***')) ? String(v).trim() : prev
  data.podium = {
    token: keep(b.token, cur.token),
    idKey: keep(b.idKey, cur.idKey),
    matchKey: keep(b.matchKey, cur.matchKey),
    idProduct: b.idProduct !== undefined ? String(b.idProduct).trim() : cur.idProduct,
    matchProduct: b.matchProduct !== undefined ? String(b.matchProduct).trim() : cur.matchProduct,
    url: b.url !== undefined ? String(b.url).trim() : cur.url,
    enabled: b.enabled !== undefined ? !!b.enabled : cur.enabled,
  }
  saveAdminData(data)
  return NextResponse.json({ ok: true, configured: podConfigured(), missing: podMissing() })
}
