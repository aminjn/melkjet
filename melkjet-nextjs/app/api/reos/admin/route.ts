import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { eventStats, topFeatures, recentEvents } from '@/app/lib/reos/store'
import { listItems, getItemById } from '@/app/lib/scraper-store'
import { HYBRID_WEIGHTS } from '@/app/lib/reos/hybrid'
import { RANK_WEIGHTS } from '@/app/lib/reos/feed'
import { WEIGHTS } from '@/app/lib/reos/scoring'

// GET /api/reos/admin — داشبوردِ observabilityِ REOS (فقط سوپرادمین).
export async function GET() {
  const s = await getSession()
  const isAdmin = !!s && (s.role === 'super_admin' || s.phone === '09122862184')
  if (!isAdmin) return NextResponse.json({ error: 'دسترسی فقط برای مدیر' }, { status: 403 })

  const [evStats, recent, topProps, propsCount] = await Promise.all([
    eventStats(),
    recentEvents({ limit: 30 }),
    topFeatures('property', 'engagement_score', 12),
    listItems('listing', { publicOnly: true }).then(a => a.length),
  ])

  // غنی‌سازیِ پرتعامل‌ترین املاک با عنوان
  const enriched = await Promise.all(topProps.map(async t => {
    const it = await getItemById(t.id).catch(() => null)
    return { id: t.id, title: it?.title || t.id, engagement: t.value, clicks: t.features.click_count || 0, saves: t.features.save_count || 0, contacts: t.features.contact_count || 0 }
  }))

  return NextResponse.json({
    ok: true,
    engine: { publicListings: propsCount, weights: { global: WEIGHTS, hybrid: HYBRID_WEIGHTS, feedRank: RANK_WEIGHTS } },
    events: { total: evStats.total, byType: evStats.byType, recent },
    topProperties: enriched,
  }, { headers: { 'Cache-Control': 'no-store, private' } })
}
