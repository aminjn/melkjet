import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'
import { stats } from '@/app/lib/tracker-store'

const DEFAULT_TEMPLATE = 'سلام👋 «%title%» را در ملک‌جت دیدید و مشتاقانه منتظرِ شما هستیم. برای پیگیری همین حالا اقدام کنید.'

export async function GET() {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const t = getAdminData().tracker || {}
  return NextResponse.json({
    enabled: !!t.enabled,
    template: t.template || DEFAULT_TEMPLATE,
    pattern: t.pattern || '',
    patternVar: t.patternVar || 'message',
    delayMin: t.delayMin ?? 2,
    throttleHours: t.throttleHours ?? 6,
    paths: t.paths || '',
    stats: stats(),
  })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  const data = getAdminData()
  const cur = data.tracker || {}
  data.tracker = {
    enabled: b.enabled !== undefined ? !!b.enabled : !!cur.enabled,
    template: b.template !== undefined ? String(b.template) : (cur.template || DEFAULT_TEMPLATE),
    pattern: b.pattern !== undefined ? String(b.pattern).trim() : (cur.pattern || ''),
    patternVar: (b.patternVar ? String(b.patternVar) : (cur.patternVar || 'message')).trim() || 'message',
    delayMin: b.delayMin !== undefined ? Math.max(0, Math.round(Number(b.delayMin) || 0)) : (cur.delayMin ?? 2),
    throttleHours: b.throttleHours !== undefined ? Math.max(0, Math.round(Number(b.throttleHours) || 0)) : (cur.throttleHours ?? 6),
    paths: b.paths !== undefined ? String(b.paths) : (cur.paths || ''),
  }
  saveAdminData(data)
  return NextResponse.json({ ok: true })
}
