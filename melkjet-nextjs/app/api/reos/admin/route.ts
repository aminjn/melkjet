import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { eventStats, topFeatures, recentEvents, getFeatures } from '@/app/lib/reos/store'
import { listItems, getItemById } from '@/app/lib/scraper-store'
import { HYBRID_WEIGHTS } from '@/app/lib/reos/hybrid'
import { RANK_WEIGHTS } from '@/app/lib/reos/feed'
import { WEIGHTS } from '@/app/lib/reos/scoring'
import { DEFAULT_ENGAGE, type EngageWeights } from '@/app/lib/reos/train'
import { queueDepth } from '@/app/lib/reos/queue'
import { graphStats } from '@/app/lib/reos/graph'
import { usageStats } from '@/app/lib/reos/gateway'

// GET /api/reos/admin — داشبوردِ observabilityِ REOS (فقط سوپرادمین).
export async function GET(req: Request) {
  const s = await getSession()
  const isAdmin = !!s && (s.role === 'super_admin' || s.phone === '09122862184')
  if (!isAdmin) return NextResponse.json({ error: 'دسترسی فقط برای مدیر' }, { status: 403 })

  // 👤 فاز ۱۸۹ — شناختِ یک کاربرِ مشخص از رفتارِ واقعی‌اش (?profile=phone)
  const profilePhone = new URL(req.url).searchParams.get('profile')
  if (profilePhone) {
    const { userProfileOf } = await import('@/app/lib/reos/user-profile')
    return NextResponse.json({ ok: true, profile: await userProfileOf(profilePhone.trim()) }, { headers: { 'Cache-Control': 'no-store, private' } })
  }

  const [evStats, recent, topProps, propsCount, modelF, graph] = await Promise.all([
    eventStats(),
    recentEvents({ limit: 30 }),
    topFeatures('property', 'engagement_score', 12),
    listItems('listing', { publicOnly: true }).then(a => a.length),
    getFeatures('model', 'engage_v1').catch(() => ({} as Record<string, number>)),
    graphStats().catch(() => ({ nodes: 0, edges: 0, byType: {}, byRel: {} })),
  ])
  const ai = await usageStats().catch(() => ({ calls: 0, tokens: 0, cost: 0, cacheHitRate: 0, avgMs: 0, byModel: {} }))
  const model = modelF && modelF.trainedAt ? ({ ...DEFAULT_ENGAGE, ...modelF } as unknown as EngageWeights) : null

  // غنی‌سازیِ پرتعامل‌ترین املاک با عنوان
  const enriched = await Promise.all(topProps.map(async t => {
    const it = await getItemById(t.id).catch(() => null)
    return { id: t.id, title: it?.title || t.id, engagement: t.value, clicks: t.features.click_count || 0, saves: t.features.save_count || 0, contacts: t.features.contact_count || 0 }
  }))

  // 🏋️ فاز ۱۸۹ — دفترِ ترین + تازگیِ هر منبعِ رویداد (اثباتِ «واقعاً کار می‌کند»)
  const { trainLog } = await import('@/app/lib/reos/train-log')
  const tlog = await trainLog().catch(() => ({ lastAt: 0, runs: [] }))
  const { primeConfig } = await import('@/app/lib/reos/reos-config')
  const trainCfg = (await primeConfig().catch(() => null))?.training || { autoHours: 6, enabled: true }
  const coverage = await Promise.all(Object.entries(evStats.byType).map(async ([type, count]) => {
    const last = await recentEvents({ type: type as any, limit: 1 }).catch(() => [])
    return { type, count, lastAt: last[0]?.at || 0 }
  }))
  const topUsers = await topFeatures('user', 'engagement_score', 8).catch(() => [])

  return NextResponse.json({
    ok: true,
    engine: { publicListings: propsCount, weights: { global: WEIGHTS, hybrid: HYBRID_WEIGHTS, feedRank: RANK_WEIGHTS } },
    model, queue: queueDepth(), graph, ai,
    events: { total: evStats.total, byType: evStats.byType, recent },
    topProperties: enriched,
    training: { lastAt: tlog.lastAt, runs: (tlog.runs || []).slice(0, 20), autoHours: trainCfg.autoHours, enabled: trainCfg.enabled, nextAt: tlog.lastAt ? tlog.lastAt + Math.max(1, trainCfg.autoHours) * 3600e3 : 0 },
    coverage,
    topUsers: topUsers.map(u => ({ userId: u.id, engagement: u.value })),
  }, { headers: { 'Cache-Control': 'no-store, private' } })
}

// POST /api/reos/admin {action:'train'} — 🏋️ فاز ۱۸۹: ترینِ فوریِ دستی؛ نتیجهٔ واقعی (n/auc) همان لحظه برمی‌گردد
// تا ادمین بتواند با یک دکمه «واقعاً کار می‌کند» را ببیند. هر اجرا در دفترِ ترین هم ثبت می‌شود.
export async function POST(req: Request) {
  const s = await getSession()
  const isAdmin = !!s && (s.role === 'super_admin' || s.phone === '09122862184')
  if (!isAdmin) return NextResponse.json({ error: 'دسترسی فقط برای مدیر' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  if (String(b.action) !== 'train') return NextResponse.json({ error: 'اکشن نامعتبر' }, { status: 400 })
  const { logTrainRun } = await import('@/app/lib/reos/train-log')
  const out: Record<string, unknown> = {}
  let t = Date.now()
  try {
    const { trainEngageModel } = await import('@/app/lib/reos/train')
    const w = await trainEngageModel()
    out.engage = { n: w.n, auc: w.auc, usedDefault: w.usedDefault }
    await logTrainRun({ at: Date.now(), kind: 'engage', ok: true, ms: Date.now() - t, n: w.n, auc: w.auc, note: 'دستی' })
  } catch (e) { out.engage = { error: String((e as Error)?.message || e).slice(0, 160) }; await logTrainRun({ at: Date.now(), kind: 'engage', ok: false, ms: Date.now() - t, note: 'دستی: ' + String((e as Error)?.message || e).slice(0, 100) }).catch(() => {}) }
  t = Date.now()
  try {
    const { trainLeadModel, primeLeadModel } = await import('@/app/lib/reos/lead-model')
    const lw = await trainLeadModel(); await primeLeadModel()
    out.lead = { n: lw.n, auc: lw.auc, usedDefault: lw.usedDefault }
    await logTrainRun({ at: Date.now(), kind: 'lead', ok: true, ms: Date.now() - t, n: lw.n, auc: lw.auc, note: 'دستی' })
  } catch (e) { out.lead = { error: String((e as Error)?.message || e).slice(0, 160) } }
  t = Date.now()
  try {
    const { syncGraphFromEvents } = await import('@/app/lib/reos/graph')
    const g = await syncGraphFromEvents(5000)
    out.graph = g
    await logTrainRun({ at: Date.now(), kind: 'graph', ok: true, ms: Date.now() - t, n: (g.nodes || 0) + (g.edges || 0), note: 'دستی' })
  } catch (e) { out.graph = { error: String((e as Error)?.message || e).slice(0, 160) } }
  return NextResponse.json({ ok: true, results: out }, { headers: { 'Cache-Control': 'no-store, private' } })
}
