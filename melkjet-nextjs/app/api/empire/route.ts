// Empire · API — تمامِ سفرِ سند (جلد۲ فصل ۱–۶) روی دادهٔ واقعی: فرصت‌ها = آگهی‌های واقعی،
// مأموریت‌ها = رفتارِ واقعی (رویدادهای REOS)، تحلیل = مقایسهٔ واقعیِ قیمت با محله. مهمان → فقط پیش‌نمایش.
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import {
  getEmpire, createEmpire, renameEmpire, buyAsset, chooseAssetAction, recordGuess,
  claimEmpireMission, spendAiToken, setSuspense, addJournal, bumpRejects, setPersona, setMentor,
  setStylePicks, setHunterPair, answerHunter, empireLevel, netWorthOf, empireCount, assetKindOf,
  getBrief, markBriefOpened, dayNumberOf,
  sellAsset, setLandPlan, chooseBusiness, accrueIncome, claimDailyChest, chestRewardOf,
  landProjection, empireScoreOf, listEmpiresPublic, applyUpkeep,
  creditScoreOf, loanTermsFor, takeLoan, repayLoan, accrueLoanInterest,
  type EmpireData, type AssetKind, type LandPlan,
} from '@/app/lib/empire-store'
import { buildBriefFor } from '@/app/lib/empire-brief'
import { touchStreak, getStreak } from '@/app/lib/reos/achievements'
import { candidateListings, getItemById, type Item } from '@/app/lib/scraper-store'
import { parseFaNum } from '@/app/lib/reos/features'
import { recentEvents } from '@/app/lib/reos/store'
import { forIds } from '@/app/lib/listing-stats-store'
import { flagEnabled } from '@/app/lib/reos/flags'
import { config, primeConfig } from '@/app/lib/reos/reos-config'

const hoodOf = (loc?: string) => { const p = String(loc || '').split(/[،,]/).map(x => x.trim()).filter(Boolean); return p.length > 1 ? p[p.length - 1] : (p[0] || '') }
const ptypeOf = (it: Item) => (it.meta || {})['نوع ملک'] || it.category || ''
const priceOf = (it: Item) => parseFaNum(it.price)
const isSale = (it: Item) => !/اجاره|رهن|ودیعه/.test(it.price || '') && (it.meta || {})['نوع معامله'] !== 'اجاره'
// قیمتِ فروشِ معتبر: زیر این کف یعنی قیمتِ آگهی درست پارس نشده («۱۹٫۶ میلیارد» متنی) — کاندیدِ بازی نشود.
const MIN_SALE = 100_000_000
const isPricedSale = (it: Item) => isSale(it) && priceOf(it) >= MIN_SALE

// نمای سبکِ یک آگهی برای کلاینت (بدونِ چیزی جز دادهٔ واقعی).
function lite(it: Item, opts: { hidePrice?: boolean } = {}) {
  const m = it.meta || {}
  return {
    id: it.id, title: it.title, hood: hoodOf(it.location), location: it.location || '',
    price: opts.hidePrice ? 0 : priceOf(it), priceStr: opts.hidePrice ? '' : (it.price || ''),
    image: it.image || '', area: parseFaNum(m['متراژ']) || 0, rooms: parseFaNum(m['اتاق خواب'] || m['اتاق']) || 0,
    ptype: ptypeOf(it), kind: assetKindOf(ptypeOf(it)),
  }
}

// وضعیتِ مأموریت‌ها از رفتارِ واقعی (رویدادهای REOS + خودِ امپراتوری) — هیچ شمارندهٔ ساختگی.
async function missionsOf(userId: string, e: EmpireData) {
  const cfg = config().empire
  const evs = await recentEvents({ userId, limit: 200 }).catch(() => [])
  const clicked = [...new Set(evs.filter(x => x.type === 'user_clicked_property' && x.propertyId).map(x => x.propertyId!))]
  const saved = evs.some(x => x.type === 'user_saved_property')
  // محله‌های واقعیِ آگهی‌های دیده‌شده (برای «۲ منطقه مقایسه کن»)
  const hoods = new Set<string>()
  for (const id of clicked.slice(0, 20)) { const it = await getItemById(id).catch(() => null); const h = it ? hoodOf(it.location) : ''; if (h) hoods.add(h) }
  const aiUsed = cfg.welcomeAiTokens - e.aiTokens
  const m1 = { views: Math.min(5, clicked.length), hoods: Math.min(2, hoods.size), saved: saved ? 1 : 0, ai: Math.min(1, Math.max(0, aiUsed)) }
  const m1Done = m1.views >= 5 && m1.hoods >= 2 && m1.saved >= 1 && m1.ai >= 1
  return {
    m1: { ...m1, done: m1Done, claimed: !!e.claims['m1_explore'], rewardXp: cfg.missionRewardXp, rewardCoins: cfg.missionRewardCoins },
    m2: { picks: e.stylePicks?.length || 0, done: (e.stylePicks?.length || 0) >= 3, claimed: !!e.claims['m2_style'], rewardXp: Math.round(cfg.missionRewardXp / 2), rewardCoins: Math.round(cfg.missionRewardCoins / 2) },
    m3: { tries: e.guess.tries, correct: e.guess.correct, done: e.guess.tries >= 1, rewardXp: cfg.guessRewardXp, rewardCoins: cfg.guessRewardCoins },
    hunter: { active: !!e.hunter, claimed: !!e.claims['property_hunter'], rewardXp: cfg.missionRewardXp, rewardCoins: cfg.missionRewardCoins },
  }
}

// ارزشِ روزِ دارایی‌ها از آگهی‌های واقعی (اگر آگهی حذف شده باشد، قیمتِ خرید مبنا می‌ماند).
async function livePrices(e: EmpireData): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const a of e.assets) { const it = await getItemById(a.listingId).catch(() => null); const p = it ? priceOf(it) : 0; if (p > 0) out[a.listingId] = p }
  return out
}

// اجارهٔ ماهانهٔ یک آگهیِ اجاره‌ای («ودیعه X · اجاره Y» یا متنِ مشابه) — فقط بخشِ اجاره.
function monthlyRentOf(it: Item): number {
  const m = (it.price || '').match(/اجاره[^\d۰-۹]*([\d,٬۰-۹]+)/)
  return m ? parseFaNum(m[1]) : 0
}
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }

// واریزِ درآمدِ اجاره/کسب‌وکار: برآورد از میانهٔ اجارهٔ واقعیِ هم‌محله‌ها (Real Estate Simulation — فصل ۵).
// بدونِ دادهٔ اجاره در محله/شهر → هیچ واریزی (صادقانه). حداقل یک روزِ کامل باید گذشته باشد.
async function accrueRentFor(userId: string, e: EmpireData, now = Date.now()): Promise<EmpireData> {
  if (!config().empire.rentIncome) return e
  const earners = e.assets.filter(a => a.action === 'rent' || a.business)
  if (!earners.length) return e
  const items = await candidateListings(500).catch(() => [] as Item[])
  const rentByHood = new Map<string, number[]>()
  const allRents: number[] = []
  for (const it of items) {
    if (isSale(it)) continue
    const r = monthlyRentOf(it)
    if (!(r > 0)) continue
    allRents.push(r)
    const h = hoodOf(it.location)
    if (h) { if (!rentByHood.has(h)) rentByHood.set(h, []); rentByHood.get(h)!.push(r) }
  }
  const globalMed = median(allRents)
  const accruals: Array<{ assetId: string; amount: number }> = []
  for (const a of earners) {
    const monthly0 = median(rentByHood.get(a.hood) || []) || globalMed
    if (!(monthly0 > 0)) continue
    const monthly = a.business ? Math.round(monthly0 * ((a.businessProb || 50) / 100) * 2) : monthly0   // کسب‌وکار: ~۲ برابرِ اجارهٔ مسکونی × احتمالِ موفقیت
    const since = a.lastAccrualAt || a.actionAt || a.boughtAt
    const days = Math.floor((now - since) / 864e5)
    if (days < 1) continue
    accruals.push({ assetId: a.id, amount: Math.round(monthly * days / 30) })
  }
  if (!accruals.length) return e
  const r = await accrueIncome(userId, accruals, now)
  return r.ok && r.empire ? r.empire : e
}

// هزینهٔ مالکیت (GDD جلد۵): نگهداری/مالیاتِ سالانه به‌نسبتِ روزهای گذشته — اقتصاد در گردش می‌ماند.
async function upkeepFor(userId: string, e: EmpireData, now = Date.now()): Promise<EmpireData> {
  const pct = config().empire.maintenancePctYear
  if (!(pct > 0) || !e.assets.length) return e
  const since = e.lastUpkeepAt || e.createdAt
  const days = Math.floor((now - since) / 864e5)
  if (days < 1) return e
  const assetsValue = e.assets.reduce((s, a) => s + a.buyPrice, 0)
  const cost = Math.round(assetsValue * (pct / 100) * (days / 365))
  if (!(cost > 0)) return e
  const r = await applyUpkeep(userId, cost, now)
  return r.ok && r.empire ? r.empire : e
}

// وضعیتِ کاملِ امپراتوری برای UI.
async function stateOf(userId: string, e00: EmpireData) {
  const e0 = await upkeepFor(userId, e00).catch(() => e00)    // هزینهٔ مالکیت (GDD جلد۵)
  const e1 = await accrueRentFor(userId, e0).catch(() => e0)  // درآمدِ اجاره/کسب‌وکار از بازارِ واقعی
  // بهرهٔ روزشمارِ وام (جلد ۱۶) — روزی یک‌بار
  const li = e1.loan ? await accrueLoanInterest(userId).catch(() => null) : null
  const e = li?.ok && li.empire ? li.empire : e1
  const [prices, missions, total] = await Promise.all([livePrices(e), missionsOf(userId, e), empireCount()])
  const nw = netWorthOf(e, prices)
  const assets = e.assets.map(a => ({
    ...a,
    current: prices[a.listingId] || a.buyPrice,
    growthPct: a.buyPrice ? Math.round(((prices[a.listingId] || a.buyPrice) - a.buyPrice) / a.buyPrice * 1000) / 10 : 0,
    // زمینِ بدونِ برنامه → سه گزینهٔ سند (§6.7) با برآوردِ شفاف
    plans: a.kind === 'land' && !a.landPlan ? landProjection(prices[a.listingId] || a.buyPrice) : undefined,
  }))
  const today = dayNumberOf(Date.now())
  // نامهٔ امروزِ ملک‌جت (اگر cron هنوز نساخته، همین‌جا از دادهٔ واقعی ساخته می‌شود) + استریک (ورودِ امروز = حفظِ زنجیره)
  let brief = null, streak = null
  try {
    if (config().empire.dailyBrief) { await buildBriefFor(userId); brief = await getBrief(userId, dayNumberOf(Date.now())) }
    await touchStreak(userId)
    streak = await getStreak(userId)
  } catch { /* نامه/استریک اختیاری است */ }
  // بانک (جلد ۱۶): امتیازِ اعتباری از رفتارِ واقعی + شرایطِ وامِ در دسترس
  const credit = creditScoreOf(e, streak?.streak || 0)
  const bank = config().empire.bank.enabled ? { credit, loan: e.loan || null, terms: e.loan ? null : loanTermsFor(credit.score, Math.max(0, nw.netWorth)) } : null
  return {
    enabled: true, empire: { ...e, assets }, level: empireLevel(e.xp), ...nw, missions, bank,
    empireScore: empireScoreOf(e, prices),
    chest: config().empire.chest.enabled ? { available: !e.claims['chest_' + today] } : null,
    othersBuilding: Math.max(0, total - 1),
    suspense: e.suspense && e.suspense.dueAt > Date.now() ? e.suspense : null,
    brief, streak,
  }
}

export async function GET() {
  await primeConfig()
  const s = await getSession()
  if (!s) return NextResponse.json({ guest: true, enabled: true })
  const userId = String(s.phone)
  if (!await flagEnabled('empire', { userId, role: (s as any).role })) return NextResponse.json({ enabled: false })
  const e = await getEmpire(userId)
  if (!e) return NextResponse.json({ enabled: true, empire: null, count: await empireCount() })
  return NextResponse.json(await stateOf(userId, e))
}

export async function POST(req: NextRequest) {
  await primeConfig()
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای ساختِ امپراتوری وارد شوید' }, { status: 401 })
  const userId = String(s.phone)
  if (!await flagEnabled('empire', { userId, role: (s as any).role })) return NextResponse.json({ error: 'این بخش فعلاً در دسترس نیست' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  const action = String(b.action || '')

  switch (action) {
    // تولد (فصل ۲): پاسخ‌ها → هویت → بستهٔ خوش‌آمد.
    case 'create': {
      const e = await createEmpire(userId, { name: b.name, persona: b.persona, path: b.path, answers: b.answers || {}, dreamPicks: Array.isArray(b.dreamPicks) ? b.dreamPicks : [] })
      return NextResponse.json(await stateOf(userId, e))
    }
    case 'rename': { const r = await renameEmpire(userId, String(b.name || '')); return r.ok ? NextResponse.json({ ok: true, name: r.empire!.name }) : NextResponse.json({ error: r.reason }, { status: 400 }) }
    case 'persona': { const r = await setPersona(userId, String(b.persona || '')); return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.reason }, { status: 400 }) }
    case 'mentor': { const r = await setMentor(userId, String(b.mentor || '')); return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.reason }, { status: 400 }) }
    case 'style': {
      const r = await setStylePicks(userId, Array.isArray(b.picks) ? b.picks : [])
      return r.ok ? NextResponse.json({ ok: true, picks: r.empire!.stylePicks }) : NextResponse.json({ error: r.reason }, { status: 400 })
    }

    // ۴ فرصتِ واقعی (فصل ۳): از آگهی‌های زندهٔ سایت، یکی برجسته بر اساسِ هویتِ کاربر.
    case 'suggest': {
      const e = await getEmpire(userId)
      if (!e) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      const items = (await candidateListings(300)).filter(it => isPricedSale(it) && priceOf(it) <= e.capital)
      const stats = await forIds(items.map(i => i.id)).catch(() => ({} as Record<string, { views: number; contacts: number }>))
      const cityMatch = (it: Item) => e.answers.city && (it.location || '').includes(e.answers.city) ? 1 : 0
      const engagement = (it: Item) => (stats[it.id]?.views || 0) + 3 * (stats[it.id]?.contacts || 0)
      const byKind = new Map<AssetKind, Item[]>()
      for (const it of items) { const k = assetKindOf(ptypeOf(it)); if (!byKind.has(k)) byKind.set(k, []); byKind.get(k)!.push(it) }
      const picks: Array<ReturnType<typeof lite> & { recommended: boolean; reason: string }> = []
      const wanted: AssetKind[] = ['apartment', 'villa', 'commercial', 'land']
      // نوعِ برجسته از هویت (Identity Engine): investor→آپارتمان، builder→زمین، commercial→تجاری، luxury→ویلا.
      const id = e.identity
      const domKind: AssetKind = (id.builder || 0) >= Math.max(id.investor || 0, id.commercial || 0, id.luxury || 0) ? 'land'
        : (id.commercial || 0) >= Math.max(id.investor || 0, id.luxury || 0) ? 'commercial'
        : (id.luxury || 0) > (id.investor || 0) ? 'villa' : 'apartment'
      for (const k of wanted) {
        const list = (byKind.get(k) || []).sort((a, x) => (cityMatch(x) - cityMatch(a)) || (engagement(x) - engagement(a)))
        const it = list[0]
        if (!it) continue
        const rec = k === domKind
        picks.push({ ...lite(it), recommended: rec, reason: rec ? 'اگر جای تو بودم از اینجا شروع می‌کردم' : (cityMatch(it) ? `در شهرِ انتخابیِ تو` : 'فرصتِ فعال در بازار') })
      }
      // اگر نوعِ برجسته در بازار نبود، اولین فرصت برجسته شود.
      if (picks.length && !picks.some(p => p.recommended)) { picks[0].recommended = true; picks[0].reason = 'اگر جای تو بودم از اینجا شروع می‌کردم' }
      return NextResponse.json({ ok: true, opportunities: picks })
    }
    case 'reject': {
      const r = await bumpRejects(userId)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, rejects: r.empire!.rejects, free: r.empire!.rejects >= 2 })
    }

    // خرید (فصل ۳): آگهیِ واقعی با قیمتِ واقعی؛ سرمایه کم، پاداشِ سند اعطا.
    case 'buy': {
      const it = await getItemById(String(b.listingId || ''))
      if (!it || it.type !== 'listing') return NextResponse.json({ error: 'آگهی یافت نشد' }, { status: 404 })
      const price = priceOf(it)
      if (!(price > 0) || !isSale(it)) return NextResponse.json({ error: 'این آگهی قیمتِ فروشِ مشخص ندارد' }, { status: 400 })
      const r = await buyAsset(userId, { id: it.id, title: it.title, hood: hoodOf(it.location), price, ptype: ptypeOf(it) })
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, ...(await stateOf(userId, r.empire!)) })
    }
    case 'assetAction': {
      const act = String(b.act || '')
      if (!['renovate', 'rent', 'hold'].includes(act)) return NextResponse.json({ error: 'تصمیمِ نامعتبر' }, { status: 400 })
      const r = await chooseAssetAction(userId, String(b.assetId || ''), act as any)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, ...(await stateOf(userId, r.empire!)) })
    }

    // Beat AI (M3): آگهیِ واقعی بدونِ قیمت → حدس → مقایسه با قیمتِ واقعی.
    case 'guessNext': {
      const e = await getEmpire(userId)
      if (!e) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      const items = (await candidateListings(120)).filter(it => isPricedSale(it))
      if (!items.length) return NextResponse.json({ error: 'فعلاً آگهیِ مناسبی برای حدس نیست' }, { status: 404 })
      const pick = items[(e.guess.tries + e.assets.length) % items.length]   // قطعی (بدونِ تصادف) و هر بار متفاوت
      return NextResponse.json({ ok: true, listing: lite(pick, { hidePrice: true }) })
    }
    case 'guess': {
      const it = await getItemById(String(b.listingId || ''))
      if (!it) return NextResponse.json({ error: 'آگهی یافت نشد' }, { status: 404 })
      const actual = priceOf(it)
      const r = await recordGuess(userId, actual, Number(b.guess) || 0)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, correct: r.correct, deltaPct: r.deltaPct, actual, rewardXp: r.rewardXp, rewardCoins: r.rewardCoins })
    }

    // Property Hunter (§6.4): دو آگهیِ واقعیِ هم‌محله → کدام بهتر است؟ «بهتر» = استقبالِ واقعیِ بازار.
    case 'hunterStart': {
      const items = (await candidateListings(200)).filter(it => isPricedSale(it))
      const stats = await forIds(items.map(i => i.id)).catch(() => ({} as Record<string, { views: number; contacts: number }>))
      const eng = (it: Item) => (stats[it.id]?.views || 0) + 3 * (stats[it.id]?.contacts || 0)
      // جفتِ هم‌محله با بیشترین تفاوتِ استقبال (تا «بهتر» معنادار باشد)
      const byHood = new Map<string, Item[]>()
      for (const it of items) { const h = hoodOf(it.location); if (h) { if (!byHood.has(h)) byHood.set(h, []); byHood.get(h)!.push(it) } }
      let pair: [Item, Item] | null = null
      for (const list of byHood.values()) {
        if (list.length < 2) continue
        const sorted = [...list].sort((a, x) => eng(x) - eng(a))
        if (!pair || eng(sorted[0]) - eng(sorted[sorted.length - 1]) > eng(pair[0]) - eng(pair[1])) pair = [sorted[0], sorted[sorted.length - 1]]
      }
      if (!pair) { const sorted = [...items].sort((a, x) => eng(x) - eng(a)); if (sorted.length >= 2) pair = [sorted[0], sorted[sorted.length - 1]] }
      if (!pair) return NextResponse.json({ error: 'آگهیِ کافی برای مقایسه نیست' }, { status: 404 })
      const r = await setHunterPair(userId, pair[0].id, pair[1].id, pair[0].id)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      // ترتیبِ نمایش قطعی ولی نامشخص برای کاربر (بر اساسِ id تا جواب لو نرود)
      const show = [pair[0], pair[1]].sort((a, x) => a.id.localeCompare(x.id))
      return NextResponse.json({ ok: true, pair: show.map(it => lite(it)) })
    }
    case 'hunterAnswer': {
      const r = await answerHunter(userId, String(b.pick || ''))
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, correct: r.correct, better: r.better, rewardXp: r.rewardXp, rewardCoins: r.rewardCoins })
    }

    // دریافتِ پاداشِ مأموریت — فقط بعد از راستی‌آزماییِ سمتِ سرور از رفتارِ واقعی.
    case 'claim': {
      const e = await getEmpire(userId)
      if (!e) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      const ms = await missionsOf(userId, e)
      const key = String(b.key || '')
      const def = key === 'm1_explore' ? (ms.m1.done ? { xp: ms.m1.rewardXp, coins: ms.m1.rewardCoins } : null)
        : key === 'm2_style' ? (ms.m2.done ? { xp: ms.m2.rewardXp, coins: ms.m2.rewardCoins } : null)
        : null
      if (!def) return NextResponse.json({ error: 'این مأموریت هنوز کامل نشده یا قابلِ دریافت نیست' }, { status: 400 })
      const r = await claimEmpireMission(userId, key, def.xp, def.coins)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, rewardXp: def.xp, rewardCoins: def.coins, ...(await stateOf(userId, r.empire!)) })
    }

    // تحلیلِ AI (یک ژتون): مقایسهٔ واقعیِ قیمت با میانگینِ هم‌محله‌ای‌ها — بدونِ عددِ ساختگی.
    case 'analyze': {
      const it = await getItemById(String(b.listingId || ''))
      if (!it) return NextResponse.json({ error: 'آگهی یافت نشد' }, { status: 404 })
      const t = await spendAiToken(userId)
      if (!t.ok) return NextResponse.json({ error: t.reason }, { status: 400 })
      const hood = hoodOf(it.location), price = priceOf(it), area = parseFaNum((it.meta || {})['متراژ']) || 0
      const twins = (await candidateListings(300)).filter(x => x.id !== it.id && isSale(x) && priceOf(x) > 0 && hoodOf(x.location) === hood)
      const perM = (x: Item) => { const a = parseFaNum((x.meta || {})['متراژ']) || 0; const p = priceOf(x); return a > 0 && p > 0 ? p / a : 0 }
      const rates = twins.map(perM).filter(v => v > 0)
      const avg = rates.length ? rates.reduce((a, v) => a + v, 0) / rates.length : 0
      const mine = area > 0 && price > 0 ? price / area : 0
      const diffPct = avg && mine ? Math.round((mine - avg) / avg * 100) : null
      const verdict = diffPct == null ? `در «${hood || 'این محله'}» هنوز نمونهٔ هم‌متراژِ کافی برای مقایسه نداریم — قیمت را با بازدیدِ حضوری بسنج.`
        : diffPct > 8 ? `قیمتِ هر متر حدود ${Math.abs(diffPct)}٪ بالاتر از میانگینِ ${rates.length} آگهیِ هم‌محله است — جای چانه‌زنی دارد.`
        : diffPct < -8 ? `قیمتِ هر متر حدود ${Math.abs(diffPct)}٪ پایین‌تر از میانگینِ ${rates.length} آگهیِ هم‌محله است — فرصتِ قابلِ‌بررسی.`
        : `قیمت با میانگینِ ${rates.length} آگهیِ هم‌محله هم‌خوان است (اختلاف ${Math.abs(diffPct)}٪).`
      return NextResponse.json({ ok: true, tokensLeft: t.empire!.aiTokens, analysis: { hood, samples: rates.length, avgPerM: Math.round(avg), minePerM: Math.round(mine), diffPct, verdict } })
    }

    // فروش (چرخهٔ عمر — فصل ۵): به قیمتِ روزِ واقعیِ آگهی؛ سود → XP، زیانِ اول → درسِ آموزشی.
    case 'sell': {
      const e = await getEmpire(userId)
      const a = e?.assets.find(x => x.id === String(b.assetId || ''))
      if (!e || !a) return NextResponse.json({ error: 'دارایی یافت نشد' }, { status: 404 })
      const it = await getItemById(a.listingId).catch(() => null)
      const r = await sellAsset(userId, a.id, it ? priceOf(it) : 0)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, profit: r.profit, salePrice: r.salePrice, ...(await stateOf(userId, r.empire!)) })
    }

    // سیستمِ زمین (§6.7): فروشِ فوری / ساخت / مشارکت.
    case 'landPlan': {
      const plan = String(b.plan || '') as LandPlan
      if (!['sell', 'build', 'partner'].includes(plan)) return NextResponse.json({ error: 'برنامهٔ نامعتبر' }, { status: 400 })
      const r = await setLandPlan(userId, String(b.assetId || ''), plan)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, ...(await stateOf(userId, r.empire!)) })
    }

    // لایهٔ کسب‌وکارِ تجاری (§6.9): ٪ موفقیت از دادهٔ واقعی — استقبالِ محله و رقابتِ کسب‌وکارهای واقعیِ همان محله.
    case 'business': {
      const biz = String(b.biz || '').slice(0, 40)
      if (!biz) return NextResponse.json({ error: 'نوعِ کسب‌وکار را انتخاب کنید' }, { status: 400 })
      const e = await getEmpire(userId)
      const a = e?.assets.find(x => x.id === String(b.assetId || ''))
      if (!e || !a) return NextResponse.json({ error: 'دارایی یافت نشد' }, { status: 404 })
      // سیگنال‌های واقعی: تعدادِ آگهی‌های فعالِ محله (استقبال) و کسب‌وکارهای هم‌صنفِ همان محله (رقابت).
      const { listItems } = await import('@/app/lib/scraper-store')
      const [all, dirs] = await Promise.all([candidateListings(400).catch(() => [] as Item[]), listItems('directory').catch(() => [] as Item[])])
      const hoodListings = all.filter(it => hoodOf(it.location) === a.hood).length
      const competitors = dirs.filter(it => it.status !== 'rejected' && (it.location || '').includes(a.hood) && (it.title + ' ' + (it.category || '')).includes(biz.split(/[\s/]/)[0])).length
      const prob = Math.round(Math.max(20, Math.min(92, 45 + Math.min(30, hoodListings) - competitors * 5)))
      const r = await chooseBusiness(userId, a.id, biz, prob)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, prob, signals: { hoodListings, competitors }, ...(await stateOf(userId, r.empire!)) })
    }

    // صندوقچهٔ روزانه (فصل ۴ Variable Rewards) — یک‌بار در روز، جایزهٔ قطعی از هش.
    case 'chest': {
      if (!config().empire.chest.enabled) return NextResponse.json({ error: 'صندوقچه فعال نیست' }, { status: 403 })
      const r = await claimDailyChest(userId, dayNumberOf(Date.now()))
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, reward: r.reward })
    }

    // ۵ جدولِ رتبه (فصل ۵) + لیگِ محله (فصل ۷ §7.2) — نمایشِ عمومی فقط نام/نشان.
    case 'boards': {
      const me = await getEmpire(userId)
      const [empires, items] = await Promise.all([listEmpiresPublic(300), candidateListings(800).catch(() => [] as Item[])])
      const prices: Record<string, number> = {}
      for (const it of items) { const p = priceOf(it); if (p > 0) prices[it.id] = p }
      const rows = empires.map(e => {
        const nw = netWorthOf(e, prices)
        return { name: e.name, persona: e.persona, no: e.no, me: e.userId === userId, assets: e.assets.length, netWorth: nw.netWorth, growth: nw.growth, correct: e.guess.correct, score: empireScoreOf(e, prices), hoods: e.assets.map(a => a.hood).filter(Boolean) }
      })
      const top = (key: 'netWorth' | 'growth' | 'assets' | 'correct' | 'score', filter?: (r: typeof rows[0]) => boolean) =>
        [...rows].filter(r => !filter || filter(r)).sort((a, x) => (x[key] as number) - (a[key] as number)).slice(0, 10)
          .map((r, i) => ({ rank: i + 1, name: r.name, persona: r.persona, no: r.no, me: r.me, value: r[key] }))
      const myHood = me?.assets[0]?.hood || ''
      const hoodLeague = myHood ? top('score', r => r.hoods.includes(myHood)) : []
      return NextResponse.json({
        ok: true,
        boards: {
          invest: top('netWorth'), growth: top('growth', r => r.assets > 0), builder: top('assets'),
          explorer: top('correct'), score: top('score'),
        },
        hoodLeague: { hood: myHood, rows: hoodLeague },
        total: rows.length,
      })
    }

    // بانک (جلد ۱۶): وام با سقف/نرخِ اعتباری — سرور خودش شرایط را از امتیازِ واقعی محاسبه می‌کند.
    case 'loan': {
      if (!config().empire.bank.enabled) return NextResponse.json({ error: 'بانک فعال نیست' }, { status: 403 })
      const e = await getEmpire(userId)
      if (!e) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      if (e.loan) return NextResponse.json({ error: 'یک وامِ فعال داری — اول تسویه کن' }, { status: 400 })
      const prices = await livePrices(e)
      const nw = netWorthOf(e, prices)
      const credit = creditScoreOf(e, (await getStreak(userId).catch(() => ({ streak: 0 }))).streak)
      const terms = loanTermsFor(credit.score, Math.max(0, nw.netWorth))
      const amount = Math.round(Number(b.amount) || 0)
      if (!terms.eligible) return NextResponse.json({ error: 'با این امتیازِ اعتباری فعلاً وام تعلق نمی‌گیرد' }, { status: 400 })
      if (amount <= 0 || amount > terms.maxLoan) return NextResponse.json({ error: `سقفِ وامِ تو ${Math.round(terms.maxLoan / 1e6).toLocaleString('fa-IR')} میلیون تومان است` }, { status: 400 })
      const r = await takeLoan(userId, amount, terms.ratePctYear, terms.termDays)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, ...(await stateOf(userId, r.empire!)) })
    }
    case 'repay': {
      const r = await repayLoan(userId, Number(b.amount) || 0)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, paid: r.paid, settled: r.settled, ...(await stateOf(userId, r.empire!)) })
    }

    case 'journal': { const r = await addJournal(userId, String(b.text || '')); return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.reason }, { status: 400 }) }

    // بازکردنِ نامهٔ روزانه (opened_at طبق طرحِ سند ثبت می‌شود).
    case 'briefOpen': { await markBriefOpened(userId, dayNumberOf(Date.now())); return NextResponse.json({ ok: true }) }

    // «هیچ جلسه‌ای بی‌دلیلِ برگشت تمام نشود» (فصل ۴): تعلیقِ فردا ساعتِ ۹.
    case 'suspend': {
      const due = new Date(); due.setDate(due.getDate() + 1); due.setHours(9, 0, 0, 0)
      const r = await setSuspense(userId, 'فردا ساعت ۹ ارزشِ روزِ دارایی‌هایت دوباره از بازارِ واقعی محاسبه می‌شود.', due.getTime())
      return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.reason }, { status: 400 })
    }

    default:
      return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
}
