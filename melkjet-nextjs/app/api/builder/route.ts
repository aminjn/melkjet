import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listProjects, getProject, addProject, updateProject, addUnit, updateUnit, deleteUnit, addInvestor, deleteInvestor, updateMilestone } from '@/app/lib/builder-store'

// میز کار سازنده — پروژه‌ها، واحدها، سرمایه‌گذاران، مراحل ساخت.
export async function GET(req: NextRequest) {
  const pid = new URL(req.url).searchParams.get('id')
  if (pid) { const p = getProject(pid); return NextResponse.json({ project: p }) }
  return NextResponse.json({ projects: listProjects() })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای تغییر باید وارد شوید' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const a = b.action
  try {
    if (a === 'project') return NextResponse.json({ ok: true, project: addProject(String(b.name || 'پروژهٔ جدید'), String(b.location || '')) })
    if (a === 'updateProject') return NextResponse.json({ ok: true, project: updateProject(b.pid, b.patch || {}) })
    if (a === 'addUnit') return NextResponse.json({ ok: true, unit: addUnit(b.pid, { number: String(b.number || ''), floor: Number(b.floor) || 1, area: Number(b.area) || 0, price: Number(b.price) || 0, status: b.status || 'available', buyer: b.buyer }) })
    if (a === 'updateUnit') return NextResponse.json({ ok: true, unit: updateUnit(b.pid, b.uid, b.patch || {}) })
    if (a === 'deleteUnit') { deleteUnit(b.pid, b.uid); return NextResponse.json({ ok: true }) }
    if (a === 'addInvestor') return NextResponse.json({ ok: true, investor: addInvestor(b.pid, { name: String(b.name || ''), phone: b.phone, amount: Number(b.amount) || 0, units: Number(b.units) || 0 }) })
    if (a === 'deleteInvestor') { deleteInvestor(b.pid, b.vid); return NextResponse.json({ ok: true }) }
    if (a === 'milestone') { updateMilestone(b.pid, b.mid, b.status); return NextResponse.json({ ok: true }) }
    return NextResponse.json({ error: 'اقدام نامعتبر' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا' }, { status: 500 })
  }
}
