import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listPlans, savePlan, deletePlan } from '@/app/lib/floorplan-store'

// پلان‌های ذخیره‌شدهٔ ویرایشگر آفلاین — مخصوص کاربرِ واردشده (per-profile).
// روی سرور خودمان ذخیره می‌شود؛ پس حتی با اینترنت ملی هم کار می‌کند.
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  return NextResponse.json({ plans: await listPlans(s.phone) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای ذخیره وارد شوید' }, { status: 401 })
  const b = await req.json().catch(() => ({} as any))
  const plan = await savePlan(s.phone, {
    id: b.id ? String(b.id) : undefined,
    name: b.name, area: b.area, cols: b.cols, rows: b.rows, rooms: b.rooms, doors: b.doors,
  })
  return NextResponse.json({ ok: true, plan }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای حذف وارد شوید' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id') || ''
  if (!id) return NextResponse.json({ error: 'شناسه نامعتبر' }, { status: 400 })
  await deletePlan(s.phone, id)
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
