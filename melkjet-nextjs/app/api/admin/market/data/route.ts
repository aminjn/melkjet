import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listPoints, addPoints, deletePoint, clearPoints, dataStats } from '@/app/lib/market-data'

async function guard() {
  const s = await getSession()
  return s && s.role === 'super_admin'
}

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ points: listPoints().slice(0, 300), stats: dataStats() })
}

// manual add: { metric, value, city?, district?, period?, unit?, note? }
export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json()
  if (!b.metric || b.value == null || !isFinite(Number(b.value))) return NextResponse.json({ error: 'متریک و مقدار الزامی است' }, { status: 400 })
  const added = addPoints([{ metric: String(b.metric), value: Number(b.value), city: b.city, district: b.district, period: b.period, unit: b.unit, note: b.note, source: 'دستی' }])
  return NextResponse.json({ ok: true, added })
}

export async function DELETE(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 400 })
  const id = new URL(req.url).searchParams.get('id')
  if (id) { deletePoint(id); return NextResponse.json({ ok: true }) }
  const b = await req.json().catch(() => ({}))
  if (b.clearAll) { clearPoints(); return NextResponse.json({ ok: true }) }
  return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
}
