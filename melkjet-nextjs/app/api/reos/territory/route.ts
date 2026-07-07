import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { primeConfig } from '@/app/lib/reos/reos-config'
import { leaderboard, standing, agentTerritories, dominanceMap, territoryStats, startBattle, resolveBattle, openBattles, battlesWonBy, getOwner } from '@/app/lib/reos/territory'
import { checkAchievements, nextAchievements, getStreak, touchStreak, fomoAlerts, type AgentStats } from '@/app/lib/reos/achievements'
import { funnel } from '@/app/lib/reos/crm'
import { getTrust } from '@/app/lib/reos/trust'
import { syncTerritories } from '@/app/lib/reos/territory-sync'
import { flagEnabled } from '@/app/lib/reos/flags'

// GET /api/reos/territory — هوشِ رقابتیِ Market Dominance.
//   ?view=profile          → پروفایلِ اعتبارِ آژانسِ جاری (قلمروها، نشان‌ها، زنجیره)
//   ?view=leaderboard&territory=…  → جدولِ ردهٔ قلمرو
//   ?view=standing&territory=…     → جایگاه + هشدارِ FOMO
//   ?view=map              → نقشهٔ اقتدار (مالکِ قلمروها)
//   ?view=territory&territory=…    → آمار + ارزشِ پریمیوم + نبردهای باز
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  await primeConfig().catch(() => {})
  const url = new URL(req.url)
  const view = url.searchParams.get('view') || 'profile'
  const territory = url.searchParams.get('territory') || ''
  const agentId = String(s.phone || '').replace(/\D/g, '')
  const H = { headers: { 'Cache-Control': 'no-store, private' } }
  // Feature Flag: اگر «اقتدارِ بازار» برای این کاربر روشن نباشد، لایه غیرفعال است.
  if (!(await flagEnabled('dominance', { userId: agentId, role: String(s.role || '') }))) return NextResponse.json({ ok: true, disabled: true }, H)

  if (view === 'map') return NextResponse.json({ ok: true, map: await dominanceMap(200) }, H)

  if (view === 'leaderboard') {
    if (!territory) return NextResponse.json({ error: 'territory لازم است' }, { status: 400 })
    return NextResponse.json({ ok: true, territory, owner: await getOwner(territory), leaderboard: await leaderboard(territory, 30) }, H)
  }

  if (view === 'territory') {
    if (!territory) return NextResponse.json({ error: 'territory لازم است' }, { status: 400 })
    return NextResponse.json({ ok: true, territory, stats: await territoryStats(territory), battles: await openBattles(territory) }, H)
  }

  if (view === 'standing') {
    if (!territory) return NextResponse.json({ error: 'territory لازم است' }, { status: 400 })
    const st = await standing(territory, agentId)
    const streak = await getStreak(agentId)
    const fomo = st ? fomoAlerts({ isOwner: st.isOwner, rank: st.rank, toNext: st.toNext, contested: (await getOwner(territory))?.contested || false, nextName: st.nextName, streakAtRisk: streak.atRisk }) : []
    return NextResponse.json({ ok: true, territory, standing: st, streak, fomo }, H)
  }

  // profile (default): اعتبارِ عمومیِ آژانسِ جاری
  const [terrs, f, trust, streak, won] = await Promise.all([
    agentTerritories(agentId),
    funnel(agentId).catch(() => ({ won: 0, conversionRate: 0 } as { won: number; conversionRate: number })),
    getTrust(agentId).catch(() => ({ score: 50, parts: {} as Record<string, number> })),
    getStreak(agentId),
    battlesWonBy(agentId),
  ])
  const stats: AgentStats = {
    transactions: f.won || 0,
    ownedTerritories: terrs.filter(t => t.isOwner).length,
    activeDays: streak.streak,
    avgRating: (trust.parts.rating ?? 50) / 20,
    leadsConverted: f.won || 0,
    contentPieces: 0,
    battlesWon: won,
    responseRate: (trust.parts.response ?? 40) / 100,
  }
  return NextResponse.json({
    ok: true, agentId,
    territories: terrs, ownedCount: stats.ownedTerritories,
    badges: checkAchievements(stats), nextBadges: nextAchievements(stats),
    streak, battlesWon: won,
    trust: { score: trust.score },
  }, H)
}

// POST /api/reos/territory — اقدام‌ها.
//   {action:'touch'}                       → ثبتِ فعالیتِ امروز (زنجیره)
//   {action:'battle', territory, defenderId} → آغازِ نبردِ قلمرو
//   {action:'resolve', id}                  → حلِ نبرد (اگر سررسید شده)
//   {action:'sync'}  (سوپرادمین)            → همگام‌سازیِ امتیازها از دادهٔ واقعی
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  await primeConfig().catch(() => {})
  const body = await req.json().catch(() => ({})) as { action?: string; territory?: string; defenderId?: string; id?: string }
  const agentId = String(s.phone || '').replace(/\D/g, '')

  if (body.action === 'touch') return NextResponse.json({ ok: true, streak: await touchStreak(agentId) })
  if (body.action === 'battle') {
    if (!body.territory || !body.defenderId) return NextResponse.json({ error: 'territory و defenderId لازم است' }, { status: 400 })
    return NextResponse.json({ ok: true, battle: await startBattle(body.territory, agentId, String(body.defenderId).replace(/\D/g, '')) })
  }
  if (body.action === 'resolve') {
    if (!body.id) return NextResponse.json({ error: 'id لازم است' }, { status: 400 })
    return NextResponse.json({ ok: true, battle: await resolveBattle(body.id) })
  }
  if (body.action === 'sync') {
    if (String(s.phone) !== '09122862184') return NextResponse.json({ error: 'دسترسی محدود' }, { status: 403 })
    return NextResponse.json({ ok: true, result: await syncTerritories() })
  }
  return NextResponse.json({ error: 'action نامعتبر' }, { status: 400 })
}
