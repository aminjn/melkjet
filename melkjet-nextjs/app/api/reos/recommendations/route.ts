import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { loadUser, itemToProperty } from '@/app/lib/reos/data'
import { buildHomeFeed, explain, type FeedCard } from '@/app/lib/reos/feed'
import { listItems } from '@/app/lib/scraper-store'
import { forIds } from '@/app/lib/listing-stats-store'
import { listingHref } from '@/app/lib/listing-url'

// GET /api/reos/recommendations — فیدِ خانهٔ چندبخشی + اطلاعاتِ نمایشیِ ملک برای UI.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const s = await getSession()
  const userId = sp.get('userId') || s?.phone
  if (!userId) return NextResponse.json({ error: 'برای دریافتِ پیشنهاد وارد شوید' }, { status: 401 })
  const limit = Math.min(Number(sp.get('limit')) || 12, 40)

  // بارگذاریِ آگهی‌ها + آمار (یک پاس؛ بدونِ feature-store به‌ازای هر ملک).
  const items = (await listItems('listing', { publicOnly: true })).slice(0, 300)
  const stats = await forIds(items.map(i => i.id))
  const properties = items.map(it => itemToProperty(it, stats[it.id]))
  const disp = new Map(items.map(it => [it.id, {
    title: it.title, price: it.price || '', image: it.image || (typeof it.meta?.__gallery === 'string' ? String(it.meta.__gallery).split('\n')[0] : undefined),
    location: it.location || '', deal: it.meta?.['نوع معامله'] || '', href: listingHref(it.id, it.title, it.location),
  }]))

  const user = await loadUser(userId)
  const feed = buildHomeFeed(user, properties, {}, new Set(), limit)
  const interactedSimilar = (user.interactedPropertyIds || []).length
  const render = (cards: FeedCard[]) => cards.map(c => ({ ...c, why: explain(user, c, interactedSimilar), listing: disp.get(c.id) || null }))

  return NextResponse.json({
    ok: true,
    user: { intent: user.intent, budget: user.budget, engagement: Math.round((user.engagementScore || 0) * 100) },
    feed: {
      forYou: render(feed.forYou), hotInArea: render(feed.hotInArea),
      freshMatches: render(feed.freshMatches), priceDrops: render(feed.priceDrops), investment: render(feed.investment),
    },
  }, { headers: { 'Cache-Control': 'no-store, private' } })
}
