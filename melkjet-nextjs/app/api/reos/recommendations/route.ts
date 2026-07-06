import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { loadUser, loadProperties } from '@/app/lib/reos/data'
import { buildHomeFeed, explain, type FeedCard } from '@/app/lib/reos/feed'

// GET /api/reos/recommendations — فیدِ خانهٔ چندبخشی برای کاربرِ واردشده (یا ?userId=).
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const s = await getSession()
  const userId = sp.get('userId') || s?.phone
  if (!userId) return NextResponse.json({ error: 'برای دریافتِ پیشنهاد وارد شوید' }, { status: 401 })
  const limit = Math.min(Number(sp.get('limit')) || 12, 40)

  const [user, properties] = await Promise.all([loadUser(userId), loadProperties(400)])
  const feed = buildHomeFeed(user, properties, {}, new Set(), limit)

  // لایهٔ توضیحِ AI: «چرا این ملک؟» بر اساسِ رفتارِ واقعی
  const interactedSimilar = (user.interactedPropertyIds || []).length
  const withWhy = (cards: FeedCard[]) => cards.map(c => ({ ...c, why: explain(user, c, interactedSimilar) }))

  return NextResponse.json({
    ok: true,
    user: { intent: user.intent, budget: user.budget, engagement: Math.round((user.engagementScore || 0) * 100) },
    feed: { forYou: withWhy(feed.forYou), hotInArea: withWhy(feed.hotInArea), freshMatches: withWhy(feed.freshMatches), priceDrops: withWhy(feed.priceDrops), investment: withWhy(feed.investment) },
  }, { headers: { 'Cache-Control': 'no-store, private' } })
}
