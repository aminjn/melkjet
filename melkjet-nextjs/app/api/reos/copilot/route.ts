import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { copilotForListing } from '@/app/lib/reos/copilot'

// GET /api/reos/copilot?propertyId=… — پیشنهادهای بهبودِ آگهی (AI Copilot).
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const propertyId = new URL(req.url).searchParams.get('propertyId')
  if (!propertyId) return NextResponse.json({ error: 'propertyId لازم است' }, { status: 400 })
  const r = await copilotForListing(propertyId)
  if (!r) return NextResponse.json({ error: 'ملک یافت نشد' }, { status: 404 })
  return NextResponse.json({ ok: true, ...r }, { headers: { 'Cache-Control': 'no-store, private' } })
}
