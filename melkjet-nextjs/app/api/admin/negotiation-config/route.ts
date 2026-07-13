import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'

// تنظیماتِ موتور مذاکره (سوپرادمین): قواعدِ تولیدِ پیام + پترنِ ارسالِ سریعِ پیامک.
export async function GET() {
  const session = await getSession()
  if (!session || !(session.role === 'super_admin' || (session.staff || []).includes('sms'))) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })   // فاز ۱۲۵
  const n = getAdminData().negotiation || {}
  return NextResponse.json({ rules: n.rules || '', pattern: n.pattern || '', patternVar: n.patternVar || 'message' })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !(session.role === 'super_admin' || (session.staff || []).includes('sms'))) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })   // فاز ۱۲۵
  const b = await req.json().catch(() => ({} as any))
  const data = getAdminData()
  data.negotiation = {
    rules: b.rules !== undefined ? String(b.rules) : (data.negotiation?.rules || ''),
    pattern: b.pattern !== undefined ? String(b.pattern).trim() : (data.negotiation?.pattern || ''),
    patternVar: (b.patternVar ? String(b.patternVar) : (data.negotiation?.patternVar || 'message')).trim() || 'message',
  }
  saveAdminData(data)
  return NextResponse.json({ ok: true })
}
