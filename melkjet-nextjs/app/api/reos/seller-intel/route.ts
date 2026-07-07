import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { buildSellerInsight } from '@/app/lib/reos/seller-intel'

// GET /api/reos/seller-intel?propertyId=… — هوشِ فروشنده (احتمالِ کاهشِ قیمت + پیشنهاد).
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const propertyId = new URL(req.url).searchParams.get('propertyId')
  if (!propertyId) return NextResponse.json({ error: 'propertyId لازم است' }, { status: 400 })
  const insight = await buildSellerInsight(propertyId)
  if (!insight) return NextResponse.json({ error: 'ملک یافت نشد' }, { status: 404 })
  return NextResponse.json({ ok: true, insight }, { headers: { 'Cache-Control': 'no-store, private' } })
}
