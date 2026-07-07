import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { buildTwin } from '@/app/lib/reos/digital-twin'

// GET /api/reos/twin?propertyId=… — Property Digital Twin (تحلیلِ زندهٔ ملک).
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const propertyId = new URL(req.url).searchParams.get('propertyId')
  if (!propertyId) return NextResponse.json({ error: 'propertyId لازم است' }, { status: 400 })
  const twin = await buildTwin(propertyId)
  if (!twin) return NextResponse.json({ error: 'ملک یافت نشد' }, { status: 404 })
  return NextResponse.json({ ok: true, twin }, { headers: { 'Cache-Control': 'no-store, private' } })
}
