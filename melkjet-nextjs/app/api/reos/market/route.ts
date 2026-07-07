import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { topMarkets, getMarketFeature, computeMarketFeatures } from '@/app/lib/reos/market-features'

// GET /api/reos/market            → پرتقاضاترین مناطق (market intelligence)
// GET /api/reos/market?area=تهران|سعادت آباد → ویژگی‌های یک منطقه
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const area = new URL(req.url).searchParams.get('area')
  if (area) return NextResponse.json({ ok: true, market: await getMarketFeature(area) }, { headers: { 'Cache-Control': 'no-store, private' } })
  return NextResponse.json({ ok: true, markets: await topMarkets(30) }, { headers: { 'Cache-Control': 'no-store, private' } })
}

// POST /api/reos/market — بازمحاسبهٔ ویژگی‌های بازار (مدیر).
export async function POST() {
  const s = await getSession()
  if (!s || (s.role !== 'super_admin' && s.phone !== '09122862184')) return NextResponse.json({ error: 'دسترسی فقط برای مدیر' }, { status: 403 })
  const n = await computeMarketFeatures()
  return NextResponse.json({ ok: true, areas: n })
}
