import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { leadValue, dynamicMultiplier, effectiveBoost, predictPlanUpsell, agentRankingScore, revenueSuggestions, type Promotion } from '@/app/lib/reos/monetization'
import { listItems } from '@/app/lib/scraper-store'
import { forIds } from '@/app/lib/listing-stats-store'
import { promotedListingKinds } from '@/app/lib/promotion-store'
import { itemToProperty } from '@/app/lib/reos/data'
import { demandScore } from '@/app/lib/reos/features'

// POST /api/reos/monetize  {action, ...}
// action: leadValue | dynamic | boost | upsell | agentRank
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const b = await req.json().catch(() => ({} as any))
  const action = String(b.action || '')

  if (action === 'leadValue') {
    return NextResponse.json({ ok: true, result: leadValue({ intentScore: Number(b.intentScore) || 0.5, budget: Number(b.budget) || 0, regionDemand: Number(b.regionDemand) ?? 0.5, exclusive: !!b.exclusive }) })
  }
  if (action === 'dynamic') {
    return NextResponse.json({ ok: true, multiplier: dynamicMultiplier({ hour: b.hour, weekend: !!b.weekend, regionHotness: Number(b.regionHotness) || 0 }) })
  }
  if (action === 'boost') {
    const promo = b.promotion as Promotion | undefined
    return NextResponse.json({ ok: true, effectiveBoost: effectiveBoost(promo, Number(b.qualityScore) || 0.5) })
  }
  if (action === 'upsell') {
    return NextResponse.json({ ok: true, result: predictPlanUpsell({ listings: Number(b.listings) || 0, leads: Number(b.leads) || 0, aiUses: Number(b.aiUses) || 0, loginDays: Number(b.loginDays) || 0 }) })
  }
  if (action === 'agentRank') {
    return NextResponse.json({ ok: true, score: agentRankingScore(b.agent || {}, Number(b.paidBoost) || 0) })
  }
  if (action === 'suggest') {
    // AI Revenue Optimization: پیشنهادِ درآمدزا برای آگهی‌های کم‌بازدیدِ خودِ فروشنده.
    const items = (await listItems('listing')).filter(it => String(it.meta?.__ownerPhone || '') === s.phone && it.status !== 'rejected' && it.status !== 'duplicate')
    if (!items.length) return NextResponse.json({ ok: true, suggestions: [] })
    const [stats, promoted] = await Promise.all([forIds(items.map(i => i.id)), promotedListingKinds()])
    const views = items.map(i => stats[i.id].views).sort((a, b) => a - b)
    const medianViews = views.length ? views[Math.floor(views.length / 2)] : 0
    const suggestions = items.map(it => {
      const p = itemToProperty(it, stats[it.id])
      const tips = revenueSuggestions({ kind: 'property', demand: demandScore(p), views: stats[it.id].views, medianViews, hasPromotion: promoted.has(it.id) })
      return { id: it.id, title: it.title, views: stats[it.id].views, promoted: promoted.get(it.id)?.kind, tips }
    }).filter(x => x.tips.length)
    return NextResponse.json({ ok: true, medianViews, suggestions })
  }
  return NextResponse.json({ error: 'action نامعتبر (leadValue|dynamic|boost|upsell|agentRank|suggest)' }, { status: 400 })
}
