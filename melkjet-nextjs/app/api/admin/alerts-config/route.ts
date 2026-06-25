import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'

// تنظیماتِ هشدارِ «آگهی جدید اومد خبرم کن» (سوپرادمین): پترنِ پیامک.
export async function GET() {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const a = getAdminData().alerts || {}
  return NextResponse.json({ enabled: !!a.enabled, pattern: a.pattern || '', patternVar: a.patternVar || 'message' })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  const data = getAdminData()
  data.alerts = {
    enabled: b.enabled !== undefined ? !!b.enabled : !!data.alerts?.enabled,
    pattern: b.pattern !== undefined ? String(b.pattern).trim() : (data.alerts?.pattern || ''),
    patternVar: (b.patternVar ? String(b.patternVar) : (data.alerts?.patternVar || 'message')).trim() || 'message',
  }
  saveAdminData(data)
  return NextResponse.json({ ok: true })
}
