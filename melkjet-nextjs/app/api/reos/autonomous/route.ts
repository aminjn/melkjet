import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { observeState, planAutonomous, runAutonomous } from '@/app/lib/reos/autonomous'

// GET /api/reos/autonomous — مشاهده + برنامهٔ دستیارِ خودران (بدونِ اجرا).
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const state = await observeState(s.phone)
  return NextResponse.json({ ok: true, state, plan: planAutonomous(state) }, { headers: { 'Cache-Control': 'no-store, private' } })
}

// POST /api/reos/autonomous — اجرای حلقه (observe→plan→execute).
export async function POST() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  return NextResponse.json({ ok: true, ...(await runAutonomous(s.phone)) })
}
