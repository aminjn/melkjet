import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'
import { processProfileGate } from '@/app/lib/profile-gate-runner'

export async function GET() {
  const s = await getSession()
  if (!s || !(s.role === 'super_admin' || (s.staff || []).some(x => x === 'profiles' || x === 'sms'))) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })   // فاز ۱۲۵: پرسنلِ بخشِ مربوط هم
  const g = getAdminData().profileGate || {}
  return NextResponse.json({ enabled: !!g.enabled, minPercent: g.minPercent ?? 70, graceDays: g.graceDays ?? 3, pattern: g.pattern || '', patternVar: g.patternVar || 'message' })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || !(s.role === 'super_admin' || (s.staff || []).some(x => x === 'profiles' || x === 'sms'))) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })   // فاز ۱۲۵: پرسنلِ بخشِ مربوط هم
  const b = await req.json().catch(() => ({} as any))
  const data = getAdminData()
  const cur = data.profileGate || {}
  data.profileGate = {
    enabled: b.enabled !== undefined ? !!b.enabled : !!cur.enabled,
    minPercent: b.minPercent !== undefined ? Math.max(0, Math.min(100, Math.round(Number(b.minPercent) || 0))) : (cur.minPercent ?? 70),
    graceDays: b.graceDays !== undefined ? Math.max(0, Math.round(Number(b.graceDays) || 0)) : (cur.graceDays ?? 3),
    pattern: b.pattern !== undefined ? String(b.pattern).trim() : (cur.pattern || ''),
    patternVar: (b.patternVar ? String(b.patternVar) : (cur.patternVar || 'message')).trim() || 'message',
  }
  saveAdminData(data)
  // اجرای فوریِ بررسی (دکمهٔ «اجرای فوری») — صرف‌نظر از فعال‌بودنِ زمان‌بند
  if (b.run || new URL(req.url).searchParams.get('run')) {
    const result = await processProfileGate(Date.now())
    return NextResponse.json({ ok: true, result })
  }
  return NextResponse.json({ ok: true })
}
