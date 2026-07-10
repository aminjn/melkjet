// Empire Control Center · API سوپرادمین (GDD جلد ۹) — همهٔ اعداد از دادهٔ واقعیِ بازیکنان و بازار.
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import {
  listEmpiresPublic, getEmpire, adminAdjustEmpire, deleteEmpire, briefStatsForDay, dayNumberOf,
  empireLevel, empireScoreOf, netWorthOf, renameEmpire, type EmpireData,
} from '@/app/lib/empire-store'
import { candidateListings, getItemById, type Item } from '@/app/lib/scraper-store'
import { parseFaNum } from '@/app/lib/reos/features'
import { logAudit } from '@/app/lib/audit-store'
import { getMarketState, segmentQuote, marketIndices, psychologyOf, createFund, setFundEnabled, deleteFund } from '@/app/lib/empire-market'
import { engagementStats, churnRisk } from '@/app/lib/empire-engage'
import { loadSnapshots, takeDailySnapshot, economyHealthOf, iesOf } from '@/app/lib/empire-metrics'
import { recentEvents } from '@/app/lib/reos/store'
import { config, primeConfig } from '@/app/lib/reos/reos-config'

async function guard() { const s = await getSession(); return s && s.role === 'super_admin' }
async function actor() { const s = await getSession(); return (s as any)?.name || (s as any)?.phone || 'مدیر' }

const priceOf = (it: Item) => parseFaNum(it.price)
// نقشهٔ قیمتِ زندهٔ آگهی‌ها (یک‌بار برای همهٔ محاسبات این درخواست)
async function livePriceMap(): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const it of await candidateListings(800).catch(() => [] as Item[])) { const p = priceOf(it); if (p > 0) out[it.id] = p }
  return out
}

// ردیفِ فشردهٔ یک امپراتوری برای جدولِ بازیکنان
function rowOf(e: EmpireData, prices: Record<string, number>) {
  const nw = netWorthOf(e, prices)
  const lv = empireLevel(e.xp)
  return {
    userId: e.userId, no: e.no, name: e.name, persona: e.persona, path: e.path || '',
    level: lv.level, stage: lv.titleFa, xp: e.xp, coins: e.coins, aiTokens: e.aiTokens,
    capital: e.capital, netWorth: nw.netWorth, growth: nw.growth, realized: e.realized || 0,
    debt: e.loan?.balance || 0, taxPaid: e.taxPaid || 0,
    assets: e.assets.length, incomes: e.assets.reduce((s, a) => s + (a.income || 0), 0),
    score: empireScoreOf(e, prices), badges: e.badges, guess: e.guess,
    ies: iesOf(e, dayNumberOf(Date.now())),   // درگیریِ واقعی در اقتصاد (فاز ۳۵ — سند ۲۴ Part 07)
    createdAt: e.createdAt, updatedAt: e.updatedAt,
  }
}

export async function GET(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const sp = new URL(req.url).searchParams
  const view = sp.get('view') || 'overview'

  // پروندهٔ کاملِ یک بازیکن (Ghost Mode — مشاهدهٔ دنیای او بدونِ دخالت)
  if (view === 'player') {
    const e = await getEmpire(String(sp.get('id') || ''))
    if (!e) return NextResponse.json({ error: 'امپراتوری یافت نشد' }, { status: 404 })
    const prices = await livePriceMap()
    const assets = e.assets.map(a => ({ ...a, current: prices[a.listingId] || a.buyPrice }))
    return NextResponse.json({ empire: { ...e, assets }, row: rowOf(e, prices), level: empireLevel(e.xp) })
  }

  // کنسولِ سرمایه (جلد ۴۰ فصل ۱۹): صندوق‌ها + استخرهای مشارکت + شاخص‌ها + KPIها — همه از دادهٔ واقعی.
  if (view === 'capital') {
    await primeConfig()
    const cfg = config().empire.capital
    const [state, items, empires, evs] = await Promise.all([
      getMarketState(), candidateListings(800).catch(() => [] as Item[]), listEmpiresPublic(500),
      recentEvents({ limit: 400 }).catch(() => []),
    ])
    const priceMap: Record<string, number> = {}
    for (const it of items) { const p = priceOf(it); if (p > 0) priceMap[it.id] = p }
    const funds = state.funds.map(f => {
      const q = segmentQuote(items, f.seg, cfg.fundMinSamples)
      let aum = 0, holders = 0
      for (const e of empires) { const h = (e.funds || []).find(x => x.fundId === f.id); if (h) { holders++; aum += q ? Math.round(h.units * q.unit) : h.cost } }
      return { ...f, quote: q, aum, holders }
    })
    const pools = Object.values(state.pools).map(p => {
      const live = priceMap[p.listingId] || 0
      return { ...p, investors: Object.keys(p.investors).length, live, fundedPct: p.totalUnits ? Math.round(p.soldUnits / p.totalUnits * 100) : 0 }
    })
    // بخش‌های واقعیِ قابلِ‌صندوق‌شدن: شهرهایی با نمونهٔ کافی که هنوز صندوق ندارند
    const idx = marketIndices(items)
    const segments = idx.cities.filter(c => c.samples >= cfg.fundMinSamples && !state.funds.some(f => f.seg === c.city))
    const poolsValue = pools.reduce((s, p) => s + p.soldUnits * p.unitToman, 0)
    return NextResponse.json({
      cfg, funds, pools, segments, indices: idx,
      psychology: psychologyOf(evs.map(x => ({ type: x.type, at: x.at })), Date.now()),
      kpis: {
        marketCap: funds.reduce((s, f) => s + f.aum, 0) + poolsValue,
        fundAum: funds.reduce((s, f) => s + f.aum, 0), poolsValue,
        holders: new Set(empires.filter(e => (e.funds?.length || 0) + (e.crowd?.length || 0) > 0).map(e => e.userId)).size,
        vol: state.vol,
      },
    })
  }

  // 📊 رصدخانهٔ اقتصاد (فاز ۳۵ — سند ۲۴): تاریخچهٔ روزانهٔ بازارِ واقعی + اقتصادِ بازیکنان + هشدارهای سلامت.
  if (view === 'metrics') {
    await primeConfig()
    const mCfg = config().empire.metrics
    const snaps = await loadSnapshots(90)
    return NextResponse.json({ enabled: mCfg.enabled, snaps: snaps.slice(-30), total: snaps.length, health: economyHealthOf(snaps, mCfg) })
  }

  // کنسولِ تعامل و بازگشت (جلد ۴۹ فصل ۱۹/۲۰): DAU/WAU/MAU و Retention از ردِ فعالیتِ واقعیِ بازیکنان.
  if (view === 'engage') {
    const [empires, prices] = await Promise.all([listEmpiresPublic(1000), livePriceMap()])
    const today = dayNumberOf(Date.now())
    const stats = engagementStats(empires, today)
    // تکمیلِ مأموریت: چند بازیکن کوئستِ امروز/صندوقچهٔ امروز را زده‌اند (نرخِ واقعی)
    const dqToday = empires.filter(e => e.claims[`dq_${today}`]).length
    const chestToday = empires.filter(e => e.claims[`chest_${today}`]).length
    return NextResponse.json({
      total: empires.length, today, stats,
      missions: { dqToday, chestToday },
      churn: churnRisk(empires, prices, today),
    })
  }

  const empires = await listEmpiresPublic(500)
  const prices = await livePriceMap()
  const rows = empires.map(e => rowOf(e, prices))

  if (view === 'players') {
    const q = (sp.get('q') || '').trim()
    let out = rows
    if (q) out = out.filter(r => r.name.includes(q) || r.userId.includes(q) || String(r.no) === q.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))))
    const sort = sp.get('sort') || 'new'
    if (sort === 'new') out = [...out].sort((a, b) => b.createdAt - a.createdAt)
    if (sort === 'active') out = [...out].sort((a, b) => b.updatedAt - a.updatedAt)
    if (sort === 'score') out = [...out].sort((a, b) => b.score - a.score)
    if (sort === 'netWorth') out = [...out].sort((a, b) => b.netWorth - a.netWorth)
    return NextResponse.json({ rows: out.slice(0, 200), total: rows.length })
  }

  if (view === 'world') {
    // مانیتورِ همگام‌سازی با بازارِ واقعی: چند دارایی هنوز آگهیِ زنده دارند؟
    const allAssets = empires.flatMap(e => e.assets)
    let live = 0, dead = 0
    const seen = new Map<string, boolean>()
    for (const a of allAssets) {
      if (!seen.has(a.listingId)) seen.set(a.listingId, prices[a.listingId] != null ? true : !!(await getItemById(a.listingId).catch(() => null)))
      seen.get(a.listingId) ? live++ : dead++
    }
    // توزیعِ محله‌ها (نقشهٔ نفوذ — نسخهٔ فهرستی)
    const hoodMap = new Map<string, { assets: number; value: number; players: Set<string> }>()
    for (const e of empires) for (const a of e.assets) {
      if (!a.hood) continue
      if (!hoodMap.has(a.hood)) hoodMap.set(a.hood, { assets: 0, value: 0, players: new Set() })
      const h = hoodMap.get(a.hood)!
      h.assets++; h.value += prices[a.listingId] || a.buyPrice; h.players.add(e.userId)
    }
    const hoods = [...hoodMap.entries()].map(([hood, h]) => ({ hood, assets: h.assets, value: h.value, players: h.players.size })).sort((a, b) => b.value - a.value).slice(0, 30)
    const top = [...rows].sort((a, b) => b.score - a.score).slice(0, 10)
    return NextResponse.json({ sync: { live, dead }, hoods, top })
  }

  if (view === 'liveops') {
    const today = dayNumberOf(Date.now())
    const [t0, t1, t2] = await Promise.all([briefStatsForDay(today), briefStatsForDay(today - 1), briefStatsForDay(today - 2)])
    const chestToday = empires.filter(e => e.claims['chest_' + today]).length
    return NextResponse.json({ briefs: [{ day: 'امروز', ...t0 }, { day: 'دیروز', ...t1 }, { day: 'پریروز', ...t2 }], chestToday, empires: empires.length })
  }

  // overview — آمارِ زندهٔ کلِ اقتصادِ بازی
  const now = Date.now()
  const sum = (f: (r: typeof rows[0]) => number) => rows.reduce((s, r) => s + f(r), 0)
  const stageDist: Record<string, number> = {}
  for (const r of rows) stageDist[r.stage] = (stageDist[r.stage] || 0) + 1
  const briefs = await briefStatsForDay(dayNumberOf(now))
  return NextResponse.json({
    empires: rows.length,
    activeToday: rows.filter(r => now - r.updatedAt < 864e5).length,
    active7d: rows.filter(r => now - r.updatedAt < 7 * 864e5).length,
    newToday: rows.filter(r => now - r.createdAt < 864e5).length,
    totals: {
      capital: sum(r => r.capital), netWorth: sum(r => r.netWorth), coins: sum(r => r.coins),
      xp: sum(r => r.xp), aiTokens: sum(r => r.aiTokens), assets: sum(r => r.assets),
      realized: sum(r => r.realized), incomes: sum(r => r.incomes), debt: sum(r => r.debt), treasury: sum(r => r.taxPaid),
    },
    avgScore: rows.length ? Math.round(sum(r => r.score) / rows.length) : 0,
    stageDist, briefs,
    recent: [...rows].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8),
  })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  const action = String(b.action || '')

  // تنظیمِ منابعِ یک بازیکن (هدیه/جبران) — در تایم‌لاینِ خودِ بازیکن هم شفاف ثبت می‌شود.
  // 📸 اسنپ‌شاتِ دستیِ رصدخانه (فاز ۳۵): همان کارِ کرانِ روزانه، همین حالا — ایدمپوتنت.
  if (action === 'snapshotNow') {
    const sn = await takeDailySnapshot()
    logAudit(await actor(), 'اسنپ‌شاتِ رصدخانهٔ اقتصاد', `روز ${sn.day} · ${sn.players} بازیکن · متری ${sn.perM}`)
    return NextResponse.json({ ok: true, snap: sn })
  }

  if (action === 'adjust') {
    const r = await adminAdjustEmpire(String(b.userId || ''), { coins: Number(b.coins) || 0, xp: Number(b.xp) || 0, capital: Number(b.capital) || 0, aiTokens: Number(b.aiTokens) || 0 }, String(b.reason || ''))
    if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
    logAudit(await actor(), 'تنظیمِ منابعِ امپراتوری', `${b.userId} — ${b.reason || ''}`)
    return NextResponse.json({ ok: true })
  }
  // ویرایشِ نامِ امپراتوریِ یک بازیکن (نامِ نامناسب/درخواستِ خودِ کاربر) — با ثبت در ممیزی.
  if (action === 'rename') {
    const r = await renameEmpire(String(b.userId || ''), String(b.name || ''))
    if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
    logAudit(await actor(), 'ویرایشِ نامِ امپراتوری', `${b.userId} → ${b.name}`)
    return NextResponse.json({ ok: true, name: r.empire!.name })
  }
  if (action === 'delete') {
    const ok = await deleteEmpire(String(b.userId || ''))
    if (!ok) return NextResponse.json({ error: 'امپراتوری یافت نشد' }, { status: 404 })
    logAudit(await actor(), 'حذفِ امپراتوری', String(b.userId || ''))
    return NextResponse.json({ ok: true })
  }
  // ── کنسولِ سرمایه (جلد ۴۰): مدیریتِ صندوق‌های شاخصی ──
  if (action === 'fundCreate') {
    const r = await createFund(String(b.name || ''), String(b.seg || ''), Number(b.feePctYear))
    if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
    logAudit(await actor(), 'ساختِ صندوقِ املاک', `${r.fund!.name} (${r.fund!.seg || 'کل بازار'})`)
    return NextResponse.json({ ok: true, fund: r.fund })
  }
  if (action === 'fundToggle') {
    const r = await setFundEnabled(String(b.id || ''), !!b.enabled)
    if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
    logAudit(await actor(), 'تغییرِ وضعیتِ صندوق', `${b.id} → ${b.enabled ? 'فعال' : 'غیرفعال'}`)
    return NextResponse.json({ ok: true })
  }
  if (action === 'fundDelete') {
    // اگر کسی واحد دارد، حذف ممنوع — دارایی‌اش بی‌قیمت می‌ماند؛ اول باید همه بازخرید کنند (غیرفعالش کن).
    const empires = await listEmpiresPublic(500)
    if (empires.some(e => (e.funds || []).some(h => h.fundId === String(b.id || '') && h.units > 0)))
      return NextResponse.json({ error: 'این صندوق دارندهٔ واحد دارد — اول غیرفعالش کن تا همه بازخرید کنند' }, { status: 400 })
    const r = await deleteFund(String(b.id || ''))
    if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
    logAudit(await actor(), 'حذفِ صندوقِ املاک', String(b.id || ''))
    return NextResponse.json({ ok: true })
  }
  // ساختِ فوریِ نامه‌های امروز (بدونِ انتظار برای cron)
  if (action === 'runBriefs') {
    const { runEmpireBriefs } = await import('@/app/lib/empire-brief')
    const made = await runEmpireBriefs()
    logAudit(await actor(), 'اجرای دستیِ نامهٔ روزانهٔ امپراتوری', `${made} نامه`)
    return NextResponse.json({ ok: true, made })
  }
  return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
}
