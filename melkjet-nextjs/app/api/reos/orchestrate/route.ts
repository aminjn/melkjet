import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { loadUser, loadProperties, loadAgentsForAgency } from '@/app/lib/reos/data'
import { orchestrateBuyerJourney } from '@/app/lib/reos/orchestrator'
import { primeEngageModel } from '@/app/lib/reos/train'
import { getItemById } from '@/app/lib/scraper-store'
import { listingHref } from '@/app/lib/listing-url'

// GET /api/reos/orchestrate?monthlyIncome=&agencyPhone= — سفرِ کاملِ خریدار (AI Orchestrator):
// تطبیقِ ملک → بهترین مشاور → توانِ مالی/وام → cross-sell → ارزشِ لید. اتصالِ همهٔ نقش‌ها.
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  const monthlyIncome = Number(sp.get('monthlyIncome')) || 0
  const agencyPhone = sp.get('agencyPhone') || ''

  await primeEngageModel().catch(() => {})
  const [user, properties] = await Promise.all([loadUser(s.phone), loadProperties(300)])
  const agents = agencyPhone ? await loadAgentsForAgency(agencyPhone).catch(() => []) : []
  const journey = orchestrateBuyerJourney(user, properties, agents, { monthlyIncome })

  // غنی‌سازیِ املاکِ پیشنهادی با اطلاعاتِ نمایشی.
  const topProperties = await Promise.all(journey.topProperties.map(async t => {
    const it = await getItemById(t.id).catch(() => null)
    return { ...t, title: it?.title || t.id, price: it?.price || '', location: it?.location || '', image: it?.image || undefined, href: it ? listingHref(it.id, it.title, it.location) : '#' }
  }))

  return NextResponse.json({ ok: true, journey: { ...journey, topProperties } }, { headers: { 'Cache-Control': 'no-store, private' } })
}
