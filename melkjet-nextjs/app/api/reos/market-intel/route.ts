import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { topMarketIntel, getMarketIntel, computeMarketIntel } from '@/app/lib/reos/market-intel'

// GET /api/reos/market-intel            → سالم‌ترین مناطق (شاخص‌های بازار)
// GET /api/reos/market-intel?area=…     → شاخص‌های یک منطقه
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const area = new URL(req.url).searchParams.get('area')
  if (area) return NextResponse.json({ ok: true, intel: await getMarketIntel(area) }, { headers: { 'Cache-Control': 'no-store, private' } })
  return NextResponse.json({ ok: true, areas: await topMarketIntel(30) }, { headers: { 'Cache-Control': 'no-store, private' } })
}

// POST — بازمحاسبه (مدیر).
export async function POST() {
  const s = await getSession()
  if (!s || (s.role !== 'super_admin' && s.phone !== '09122862184')) return NextResponse.json({ error: 'دسترسی فقط برای مدیر' }, { status: 403 })
  return NextResponse.json({ ok: true, areas: await computeMarketIntel() })
}
