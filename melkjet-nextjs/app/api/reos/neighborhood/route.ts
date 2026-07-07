import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { neighborhoodProfile } from '@/app/lib/reos/neighborhood'

// GET /api/reos/neighborhood?area=تهران|سعادت آباد — پروفایلِ محله (قیمت/تقاضا/روند/فعال‌ترین مشاوران).
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const area = new URL(req.url).searchParams.get('area')
  if (!area) return NextResponse.json({ error: 'area لازم است' }, { status: 400 })
  const profile = await neighborhoodProfile(area)
  if (!profile) return NextResponse.json({ error: 'داده‌ای برای این محله نیست' }, { status: 404 })
  return NextResponse.json({ ok: true, profile }, { headers: { 'Cache-Control': 'no-store, private' } })
}
