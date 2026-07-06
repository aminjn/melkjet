import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { loadUser, loadProperties, loadAgentsForAgency } from '@/app/lib/reos/data'
import { matchUserToProperties, matchPropertyToUsers, assignLeadToAgent } from '@/app/lib/reos/engine'
import { itemToProperty } from '@/app/lib/reos/data'
import { getItemById } from '@/app/lib/scraper-store'

// GET /api/reos/match?userId=  → user→properties (top-K)
// GET /api/reos/match?propertyId= → property→users (هدف‌گیریِ کمپین)
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const s = await getSession()
  const propertyId = sp.get('propertyId')
  const userId = sp.get('userId') || (!propertyId ? s?.phone : undefined)

  if (propertyId) {
    const it = await getItemById(propertyId)
    if (!it) return NextResponse.json({ error: 'ملک یافت نشد' }, { status: 404 })
    // property→users فقط برای مالکِ آگهی/ادمین (نمونهٔ MVP: نیازمندِ session)
    if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
    const p = itemToProperty(it)
    const u = await loadUser(s.phone)
    const matches = matchPropertyToUsers(p, [u], { limit: 50 })   // در محیطِ واقعی: فهرستِ کاربران
    return NextResponse.json({ ok: true, target: 'users', propertyId, matches })
  }

  if (!userId) return NextResponse.json({ error: 'userId یا propertyId لازم است' }, { status: 400 })
  const [user, properties] = await Promise.all([loadUser(userId), loadProperties(400)])
  const matches = matchUserToProperties(user, properties, { limit: Math.min(Number(sp.get('limit')) || 20, 50) })
  return NextResponse.json({ ok: true, target: 'properties', userId, matches }, { headers: { 'Cache-Control': 'no-store, private' } })
}

// POST /api/reos/match  {agencyPhone, lead:{need,budget,lat,lng,locationText}} → lead→best agents
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const b = await req.json().catch(() => ({} as any))
  const agencyPhone = String(b.agencyPhone || s.phone)
  const agents = await loadAgentsForAgency(agencyPhone)
  if (!agents.length) return NextResponse.json({ ok: false, error: 'مشاورِ فعالی برای این آژانس نیست' })
  const lead = { need: String(b.lead?.need || ''), budget: Number(b.lead?.budget) || 0, lat: b.lead?.lat, lng: b.lead?.lng, locationText: b.lead?.locationText }
  const matches = assignLeadToAgent(lead, agents)
  return NextResponse.json({ ok: true, target: 'agents', matches })
}
