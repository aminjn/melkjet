import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { loadUser, itemToProperty } from '@/app/lib/reos/data'
import { buildHomeFeed, explain, type FeedCard } from '@/app/lib/reos/feed'
import { listItems } from '@/app/lib/scraper-store'
import { forIds } from '@/app/lib/listing-stats-store'
import { listingHref } from '@/app/lib/listing-url'
import { promotedListingKinds } from '@/app/lib/promotion-store'

// نوعِ پروموتِ فارسی → boostِ خام (۰..۱). گیتِ کیفیت داخلِ موتور اعمال می‌شود (pay-to-spam نمی‌شود).
function rawBoost(kind?: string): number {
  if (!kind) return 0
  if (kind.includes('VIP')) return 1
  if (kind.includes('ویژه') || kind.includes('صفحه اول') || kind.includes('برتر') || kind.includes('منتخب')) return 0.75
  return 0.5   // نردبان / ترند
}

// GET /api/reos/recommendations — فیدِ خانهٔ چندبخشی + اطلاعاتِ نمایشیِ ملک برای UI.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای دریافتِ پیشنهاد وارد شوید' }, { status: 401 })
  // ?userId= فقط برای سوپرادمین؛ کاربرِ عادی همیشه فیدِ خودش را می‌بیند (نه بودجه/نیتِ دیگران).
  const isAdmin = s.role === 'super_admin' || s.phone === '09122862184'
  const userId = (isAdmin && sp.get('userId')) ? String(sp.get('userId')) : s.phone
  const limit = Math.min(Number(sp.get('limit')) || 12, 40)

  // بارگذاریِ آگهی‌ها + آمار + پروموت‌های فعال (یک پاس؛ بدونِ feature-store به‌ازای هر ملک).
  const items = (await listItems('listing', { publicOnly: true })).slice(0, 300)
  const [stats, promoted] = await Promise.all([forIds(items.map(i => i.id)), promotedListingKinds()])
  const properties = items.map(it => itemToProperty(it, stats[it.id]))
  // Monetization در رتبه‌بندی: boostِ آگهی‌های ویژه (با گیتِ کیفیت در خودِ موتور).
  const boosts: Record<string, number> = {}
  for (const it of items) { const p = promoted.get(it.id); if (p) boosts[it.id] = rawBoost(p.kind) }
  const disp = new Map(items.map(it => [it.id, {
    title: it.title, price: it.price || '', image: it.image || (typeof it.meta?.__gallery === 'string' ? String(it.meta.__gallery).split('\n')[0] : undefined),
    location: it.location || '', deal: it.meta?.['نوع معامله'] || '', href: listingHref(it.id, it.title, it.location),
    promoted: promoted.get(it.id)?.kind || undefined,
  }]))

  const user = await loadUser(userId)
  const feed = buildHomeFeed(user, properties, boosts, new Set(), limit)
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
