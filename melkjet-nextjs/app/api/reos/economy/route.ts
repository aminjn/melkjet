import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { primeConfig } from '@/app/lib/reos/reos-config'
import { xpStatus, seasonLeaderboard, seasonKey } from '@/app/lib/reos/xp'
import { listMissions, claimMission } from '@/app/lib/reos/missions'
import { walletSummary, walletLedger, creditBucket, refundTxn, type Bucket, BUCKETS } from '@/app/lib/reos/wallet'

// GET /api/reos/economy — گیمیفیکیشن + کیفِ پولِ چندسطلی.
//   ?view=profile (پیش‌فرض) → سطح/فصل/رتبه + مأموریت‌ها + خلاصهٔ کیف پول
//   ?view=season            → لیگِ فصلی (جدولِ XP)
//   ?view=wallet            → خلاصه + دفترِ تراکنش
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  await primeConfig().catch(() => {})
  const view = new URL(req.url).searchParams.get('view') || 'profile'
  const agentId = String(s.phone || '').replace(/\D/g, '')
  const H = { headers: { 'Cache-Control': 'no-store, private' } }

  if (view === 'season') {
    const season = seasonKey(Date.now())
    return NextResponse.json({ ok: true, season, leaderboard: await seasonLeaderboard(season, 30) }, H)
  }
  if (view === 'wallet') {
    return NextResponse.json({ ok: true, wallet: await walletSummary(agentId), ledger: await walletLedger(agentId, 60) }, H)
  }
  const [xp, missions, wallet] = await Promise.all([xpStatus(agentId), listMissions(agentId), walletSummary(agentId)])
  return NextResponse.json({ ok: true, agentId, xp, missions, wallet }, H)
}

// POST /api/reos/economy
//   {action:'claim', missionKey}   → دریافتِ پاداشِ مأموریت
//   {action:'credit', ownerId, bucket, amount} (سوپرادمین) → شارژِ سطل
//   {action:'refund', txnId} (سوپرادمین)                  → برگشتِ تراکنش
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  await primeConfig().catch(() => {})
  const body = await req.json().catch(() => ({})) as { action?: string; missionKey?: string; ownerId?: string; bucket?: string; amount?: number; txnId?: string }
  const agentId = String(s.phone || '').replace(/\D/g, '')
  const isAdmin = String(s.phone) === '09122862184'

  if (body.action === 'claim') {
    if (!body.missionKey) return NextResponse.json({ error: 'missionKey لازم است' }, { status: 400 })
    const r = await claimMission(agentId, body.missionKey)
    return NextResponse.json(r.ok ? { ok: true, rewardXp: r.rewardXp, rewardCredit: r.rewardCredit } : { error: r.reason }, { status: r.ok ? 200 : 400 })
  }
  if (body.action === 'credit') {
    if (!isAdmin) return NextResponse.json({ error: 'دسترسی محدود' }, { status: 403 })
    const bucket = body.bucket as Bucket
    if (!BUCKETS.includes(bucket) || !body.ownerId || !body.amount) return NextResponse.json({ error: 'ورودی نامعتبر' }, { status: 400 })
    return NextResponse.json({ ok: true, result: await creditBucket(String(body.ownerId).replace(/\D/g, ''), bucket, Number(body.amount), 'شارژِ سوپرادمین') })
  }
  if (body.action === 'refund') {
    if (!isAdmin) return NextResponse.json({ error: 'دسترسی محدود' }, { status: 403 })
    if (!body.txnId) return NextResponse.json({ error: 'txnId لازم است' }, { status: 400 })
    const r = await refundTxn(body.txnId)
    return NextResponse.json(r.ok ? { ok: true } : { error: r.reason }, { status: r.ok ? 200 : 400 })
  }
  return NextResponse.json({ error: 'action نامعتبر' }, { status: 400 })
}
