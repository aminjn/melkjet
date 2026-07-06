import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { leadValue, dynamicMultiplier, effectiveBoost, predictPlanUpsell, agentRankingScore, type Promotion } from '@/app/lib/reos/monetization'

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
  return NextResponse.json({ error: 'action نامعتبر (leadValue|dynamic|boost|upsell|agentRank)' }, { status: 400 })
}
