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
  negotiationOutcome, questOf, nextDreamOf,
  applyHiddenBadges, HIDDEN_BADGES, snapshotNetWorth, markComeback, claimComeback,
  buyFundUnits, sellFundUnits, accrueFundDividends, joinCrowd, exitCrowd,
  type EmpireData, type AssetKind, type LandPlan,
} from '@/app/lib/empire-store'
import {
  getMarketState, segmentQuote, marketIndices, psychologyOf, fundFeeOf, portfolioOf,
  reservePoolUnits, releasePoolUnits, recordFundVolume,
} from '@/app/lib/empire-market'
import { listingHref } from '@/app/lib/listing-url'
import { recordEvent } from '@/app/lib/reos/store'
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
    // پلِ بازی→واقعیت (جلد ۲۸ «Game → Lead → Sale»): لینکِ صفحهٔ واقعیِ آگهی
    url: listingHref(it.id, it.title, it.location),
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

// کوئستِ روزانه/هفتگی (GDD جلد۲): تعریفِ قطعیِ چرخشی + پیشرفت از رویدادهای واقعیِ همان دوره.
async function questsOf(userId: string, e: EmpireData, now = Date.now()) {
  const cfg = config().empire.quests
  const day = dayNumberOf(now), week = Math.floor(day / 7)
  const dayStart = day * 864e5, weekStart = week * 7 * 864e5
  const evs = await recentEvents({ userId, limit: 300 }).catch(() => [])
  const metric = async (since: number) => {
    const win = evs.filter(x => x.at >= since)
    const viewIds = [...new Set(win.filter(x => x.type === 'user_clicked_property' && x.propertyId).map(x => x.propertyId!))]
    const hoods = new Set<string>()
    for (const id of viewIds.slice(0, 15)) { const it = await getItemById(id).catch(() => null); const h = it ? hoodOf(it.location) : ''; if (h) hoods.add(h) }
    return { views: viewIds.length, hoods: hoods.size, saves: win.filter(x => x.type === 'user_saved_property').length, searches: win.filter(x => x.type === 'user_searched').length }
  }
  const [dm, wm] = [await metric(dayStart), await metric(weekStart)]
  const dq = questOf(userId, day, 'daily'), wq = questOf(userId, week, 'weekly')
  const dp = Math.min(dq.target, (dm as any)[dq.metric] || 0), wp = Math.min(wq.target, (wm as any)[wq.metric] || 0)
  return {
    daily: { ...dq, progress: dp, done: dp >= dq.target, claimed: !!e.claims[`dq_${day}`], claimKey: `dq_${day}`, rewardXp: cfg.dailyXp, rewardCoins: cfg.dailyCoins },
    weekly: { ...wq, progress: wp, done: wp >= wq.target, claimed: !!e.claims[`wq_${week}`], claimKey: `wq_${week}`, rewardXp: cfg.weeklyXp, rewardCoins: cfg.weeklyCoins },
  }
}

// پیام‌آغازیِ دستیار (سند: proactive اما با اجازه — کلیدِ mentorInitiates): اولین موردِ مهم، قطعی.
function mentorLineOf(e: EmpireData, bank: any, missions: any, chestAvailable: boolean): string | null {
  if (!config().empire.mentorInitiates) return null
  if (bank?.loan && Date.now() > bank.loan.dueAt) return 'وامت از سررسید گذشته — هر روز تأخیر، هم بهرهٔ بیشتر هم آسیب به اعتبارت. امروز تسویه کن.'
  if (missions?.m1?.done && !missions.m1.claimed) return 'مأموریتِ «شهرت را کشف کن» کامل شده — پاداشت منتظر است.'
  if (chestAvailable) return 'صندوقچهٔ امروزت هنوز بسته است — هیچ‌کس نمی‌داند داخلش چیست.'
  if (e.assets.length && !e.assets.some(a => a.action || a.landPlan || a.business)) return 'دارایی‌ات بدونِ برنامه مانده — اجاره، بازسازی یا نگه‌داری؟ تصمیمت آینده را می‌سازد.'
  return null
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

// زمینهٔ بازار سرمایه (جلد ۴۰) برای دارنده‌های صندوق/مشارکت: قیمتِ روزِ هر واحد + اجارهٔ واقعیِ هر متر.
async function marketCtx(e: EmpireData): Promise<{ fundUnit: Record<string, number>; crowdUnit: Record<string, number>; rentPerM: Record<string, number> } | null> {
  const cfg = config().empire.capital
  if (!cfg.enabled || !(e.funds?.length || e.crowd?.length)) return null
  const [state, items] = await Promise.all([getMarketState(), candidateListings(600).catch(() => [] as Item[])])
  const fundUnit: Record<string, number> = {}, rentPerM: Record<string, number> = {}, crowdUnit: Record<string, number> = {}
  for (const h of e.funds || []) {
    const f = state.funds.find(x => x.id === h.fundId)
    if (!f) continue
    const q = segmentQuote(items, f.seg, cfg.fundMinSamples)
    if (q) { fundUnit[h.fundId] = q.unit; rentPerM[h.fundId] = q.rentPerM }
  }
  for (const h of e.crowd || []) {
    const p = state.pools[h.listingId]
    if (!p || !(p.totalUnits > 0)) continue
    const it = await getItemById(h.listingId).catch(() => null)
    const live = it ? priceOf(it) : 0
    crowdUnit[h.listingId] = Math.round((live > 0 ? live : p.unitToman * p.totalUnits) / p.totalUnits)
  }
  return { fundUnit, crowdUnit, rentPerM }
}

// سودِ دوره‌ایِ صندوق‌ها (جلد ۴۰ فصل ۱۵): هر واحد = یک مترِ مجازی → سودِ ماهانه = میانهٔ اجارهٔ واقعیِ هر متر.
// بدونِ دادهٔ اجاره در آن بخش → هیچ واریزی (صادقانه).
async function accrueDividendsFor(userId: string, e: EmpireData, rentPerM: Record<string, number>, now = Date.now()): Promise<EmpireData> {
  if (!config().empire.capital.dividends || !e.funds?.length) return e
  const accruals = e.funds.map(h => {
    const rm = rentPerM[h.fundId] || 0
    const days = Math.floor((now - (h.lastDivAt || h.boughtAt)) / 864e5)
    return { fundId: h.fundId, amount: rm > 0 && days >= 1 ? Math.round(h.units * rm * days / 30) : 0 }
  }).filter(a => a.amount > 0)
  if (!accruals.length) return e
  const r = await accrueFundDividends(userId, accruals, now)
  return r.ok && r.empire ? r.empire : e
}

// وضعیتِ کاملِ امپراتوری برای UI.
async function stateOf(userId: string, e00: EmpireData) {
  // پیامِ بازگشت (فصل ۴): غیبتِ ۷+ روزه — قبل از هر جهشی سنجیده می‌شود تا سیگنال از بین نرود.
  const absentDays = Math.floor((Date.now() - (e00.updatedAt || e00.createdAt)) / 864e5)
  if (absentDays >= 7 && !e00.pendingComeback) await markComeback(userId, dayNumberOf(Date.now())).catch(() => {})
  const e0 = await upkeepFor(userId, e00).catch(() => e00)    // هزینهٔ مالکیت (GDD جلد۵)
  const e1 = await accrueRentFor(userId, e0).catch(() => e0)  // درآمدِ اجاره/کسب‌وکار از بازارِ واقعی
  // بازار سرمایه (جلد ۴۰): قیمتِ روزِ واحدها + سودِ دوره‌ای از اجارهٔ واقعی
  const mc = await marketCtx(e1).catch(() => null)
  const e1b = mc ? await accrueDividendsFor(userId, e1, mc.rentPerM).catch(() => e1) : e1
  // بهرهٔ روزشمارِ وام (جلد ۱۶) — روزی یک‌بار
  const li = e1b.loan ? await accrueLoanInterest(userId).catch(() => null) : null
  const e2 = li?.ok && li.empire ? li.empire : e1b
  // کشفِ مأموریت‌های مخفی (جلد ۲۶) — از رفتارِ واقعیِ همین لحظه
  const hb = await applyHiddenBadges(userId).catch(() => null)
  const e = hb?.ok && hb.empire ? hb.empire : e2
  const [prices, missions, total] = await Promise.all([livePrices(e), missionsOf(userId, e), empireCount()])
  const nw = netWorthOf(e, prices, mc || undefined)
  const assets = e.assets.map(a => ({
    ...a,
    current: prices[a.listingId] || a.buyPrice,
    growthPct: a.buyPrice ? Math.round(((prices[a.listingId] || a.buyPrice) - a.buyPrice) / a.buyPrice * 1000) / 10 : 0,
    // زمینِ بدونِ برنامه → سه گزینهٔ سند (§6.7) با برآوردِ شفاف
    plans: a.kind === 'land' && !a.landPlan ? landProjection(prices[a.listingId] || a.buyPrice) : undefined,
    url: listingHref(a.listingId, a.title, a.hood),   // پلِ بازی→واقعیت (جلد ۲۸)
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
  const quests = await questsOf(userId, e).catch(() => null)
  const chestAvailable = config().empire.chest.enabled && !e.claims['chest_' + today]
  // «امروز فقط N دقیقه لازم داری» (فصل ۴ Real Life Time Engine): از کارهای بازِ واقعی.
  const openActions = [quests?.daily && !quests.daily.claimed, quests?.weekly && !quests.weekly.claimed, chestAvailable, missions?.m1?.done && !missions.m1.claimed, brief && !brief.openedAt].filter(Boolean).length
  // «سود/زیانِ دیروز» (جلد ۲۶): اسنپ‌شاتِ روزانه — اولین بازدیدِ روز ثبت، دلتا نسبت به روزِ قبل.
  let dayDelta: number | null = null
  if (!e.snap || e.snap.day < today) { await snapshotNetWorth(userId, today, nw.netWorth).catch(() => {}); dayDelta = e.snap ? nw.netWorth - e.snap.netWorth : null }
  else dayDelta = nw.netWorth - e.snap.prev
  return {
    enabled: true, empire: { ...e, assets }, level: empireLevel(e.xp), ...nw, missions, bank, quests,
    empireScore: empireScoreOf(e, prices),
    chest: config().empire.chest.enabled ? { available: chestAvailable } : null,
    othersBuilding: Math.max(0, total - 1),
    suspense: e.suspense && e.suspense.dueAt > Date.now() ? e.suspense : null,
    brief, streak,
    nextDream: nextDreamOf(e),
    mentorLine: mentorLineOf(e, bank, missions, chestAvailable),
    welcomeBack: absentDays >= 7 || e.pendingComeback ? { days: Math.max(absentDays, 7), gift: !!e.pendingComeback } : null,
    minutesToday: openActions * 3,
    dayDelta,
    hiddenLeft: HIDDEN_BADGES.filter(b => !e.badges.includes(b.key)).length,
    collection: ['apartment', 'villa', 'commercial', 'land'].map(k => ({ kind: k, owned: e.assets.some(a => a.kind === k) })),
    capitalEnabled: config().empire.capital.enabled,
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
      const e = await createEmpire(userId, { name: b.name, persona: b.persona, path: b.path, ref: Number(b.ref) || 0, answers: b.answers || {}, dreamPicks: Array.isArray(b.dreamPicks) ? b.dreamPicks : [] })
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

    // مذاکره (GDD جلد۱ مرحلهٔ ۵): نتیجه قطعی از هش + مهارتِ مذاکره — قابلِ‌سوءاستفاده نیست.
    case 'negotiate': {
      const it = await getItemById(String(b.listingId || ''))
      if (!it) return NextResponse.json({ error: 'آگهی یافت نشد' }, { status: 404 })
      const e = await getEmpire(userId)
      if (!e) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      const out = negotiationOutcome(userId, it.id, e.identity.negotiation || 0)
      const price = priceOf(it)
      return NextResponse.json({ ok: true, ...out, price, finalPrice: Math.round(price * (1 - out.discountPct / 100)) })
    }

    // خرید (فصل ۳): آگهیِ واقعی با قیمتِ واقعی؛ اگر مذاکره کرده، همان تخفیفِ قطعی سمتِ سرور اعمال می‌شود.
    case 'buy': {
      const it = await getItemById(String(b.listingId || ''))
      if (!it || it.type !== 'listing') return NextResponse.json({ error: 'آگهی یافت نشد' }, { status: 404 })
      let price = priceOf(it)
      if (!(price > 0) || !isSale(it)) return NextResponse.json({ error: 'این آگهی قیمتِ فروشِ مشخص ندارد' }, { status: 400 })
      let negotiatedWin = false
      if (b.negotiated) {
        const e = await getEmpire(userId)
        const out = e ? negotiationOutcome(userId, it.id, e.identity.negotiation || 0) : { success: false, discountPct: 0 }
        if (out.success) { price = Math.round(price * (1 - out.discountPct / 100)); negotiatedWin = true }
      }
      const r = await buyAsset(userId, { id: it.id, title: it.title, hood: hoodOf(it.location), price, ptype: ptypeOf(it) }, { negotiated: negotiatedWin })
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      // جلد ۲۸: رفتارِ بازی = دادهٔ رفتاری برای ML — تعامل با همین آگهیِ واقعی ثبت می‌شود.
      recordEvent({ type: 'user_clicked_property', userId, propertyId: it.id, meta: { src: 'empire_buy' } }).catch(() => {})
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
      recordEvent({ type: 'user_clicked_property', userId, propertyId: it.id, meta: { src: 'empire_guess' } }).catch(() => {})
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

    // دریافتِ پاداشِ مأموریت/کوئست — فقط بعد از راستی‌آزماییِ سمتِ سرور از رفتارِ واقعی.
    case 'claim': {
      const e = await getEmpire(userId)
      if (!e) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      const ms = await missionsOf(userId, e)
      const qs = await questsOf(userId, e).catch(() => null)
      const key = String(b.key || '')
      const def = key === 'm1_explore' ? (ms.m1.done ? { xp: ms.m1.rewardXp, coins: ms.m1.rewardCoins } : null)
        : key === 'm2_style' ? (ms.m2.done ? { xp: ms.m2.rewardXp, coins: ms.m2.rewardCoins } : null)
        : qs && key === qs.daily.claimKey ? (qs.daily.done ? { xp: qs.daily.rewardXp, coins: qs.daily.rewardCoins } : null)
        : qs && key === qs.weekly.claimKey ? (qs.weekly.done ? { xp: qs.weekly.rewardXp, coins: qs.weekly.rewardCoins } : null)
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
      recordEvent({ type: 'user_clicked_property', userId, propertyId: it.id, meta: { src: 'empire_analyze' } }).catch(() => {})
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
      const [empires, items, mstate] = await Promise.all([listEmpiresPublic(300), candidateListings(800).catch(() => [] as Item[]), getMarketState().catch(() => null)])
      const prices: Record<string, number> = {}
      for (const it of items) { const p = priceOf(it); if (p > 0) prices[it.id] = p }
      // ارزش‌گذاریِ سراسریِ بازار سرمایه (جلد ۴۰) — یک‌بار برای همهٔ بازیکنان (قیمتِ واحدها سراسری است)
      const capCfg = config().empire.capital
      const gFundUnit: Record<string, number> = {}, gCrowdUnit: Record<string, number> = {}
      if (mstate && capCfg.enabled) {
        for (const f of mstate.funds) { const q = segmentQuote(items, f.seg, capCfg.fundMinSamples); if (q) gFundUnit[f.id] = q.unit }
        for (const p of Object.values(mstate.pools)) { if (p.totalUnits > 0) gCrowdUnit[p.listingId] = Math.round((prices[p.listingId] || p.unitToman * p.totalUnits) / p.totalUnits) }
      }
      const gMarket = { fundUnit: gFundUnit, crowdUnit: gCrowdUnit }
      const rows = empires.map(e => {
        const nw = netWorthOf(e, prices, gMarket)
        return { name: e.name, persona: e.persona, no: e.no, me: e.userId === userId, assets: e.assets.length, netWorth: nw.netWorth, growth: nw.growth, correct: e.guess.correct, score: empireScoreOf(e, prices), hoods: e.assets.map(a => a.hood).filter(Boolean) }
      })
      const top = (key: 'netWorth' | 'growth' | 'assets' | 'correct' | 'score', filter?: (r: typeof rows[0]) => boolean) =>
        [...rows].filter(r => !filter || filter(r)).sort((a, x) => (x[key] as number) - (a[key] as number)).slice(0, 10)
          .map((r, i) => ({ rank: i + 1, name: r.name, persona: r.persona, no: r.no, me: r.me, value: r[key] }))
      const myHood = me?.assets[0]?.hood || ''
      const hoodLeague = myHood ? top('score', r => r.hoods.includes(myHood)) : []
      // گذرنامهٔ امپراتوری (GDD جلد۶ «Empire Passport»): نفوذِ من در هر محله = سهمِ ارزشِ من از کلِ بازیکنان.
      const hoodTotal = new Map<string, number>(), myHoodVal = new Map<string, number>()
      for (const em of empires) for (const a of em.assets) {
        if (!a.hood) continue
        const v = prices[a.listingId] || a.buyPrice
        hoodTotal.set(a.hood, (hoodTotal.get(a.hood) || 0) + v)
        if (em.userId === userId) myHoodVal.set(a.hood, (myHoodVal.get(a.hood) || 0) + v)
      }
      const passport = [...myHoodVal.entries()].map(([hood, v]) => ({ hood, value: v, influence: Math.round(v / Math.max(1, hoodTotal.get(hood) || v) * 100) })).sort((a, x) => x.influence - a.influence)
      return NextResponse.json({
        ok: true,
        boards: {
          invest: top('netWorth'), growth: top('growth', r => r.assets > 0), builder: top('assets'),
          explorer: top('correct'), score: top('score'),
        },
        hoodLeague: { hood: myHood, rows: hoodLeague },
        passport,
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
      const nw = netWorthOf(e, prices, (await marketCtx(e).catch(() => null)) || undefined)
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

    // ══════ بازار سرمایه (جلد ۴۰) — همه‌چیز از دادهٔ واقعی: صندوق = میانهٔ متریِ بازار، مشارکت = آگهیِ واقعی ══════
    // نمای کاملِ بازار: شاخص‌ها + ترس/طمع + صندوق‌ها + استخرهای مشارکت + پرتفوی.
    case 'market': {
      const cfg = config().empire.capital
      if (!cfg.enabled) return NextResponse.json({ error: 'بازار سرمایه فعلاً فعال نیست' }, { status: 403 })
      const e = await getEmpire(userId)
      if (!e) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      const [state, items, evs] = await Promise.all([
        getMarketState(), candidateListings(800).catch(() => [] as Item[]),
        recentEvents({ limit: 400 }).catch(() => []),
      ])
      const indices = marketIndices(items)
      const psychology = psychologyOf(evs.map(x => ({ type: x.type, at: x.at })), Date.now())
      // صندوق‌ها: فقط آن‌هایی که قیمتِ روزِ معتبر دارند (نمونهٔ واقعیِ کافی) یا کاربر در آن‌ها واحد دارد.
      const funds = state.funds.map(f => {
        const q = segmentQuote(items, f.seg, cfg.fundMinSamples)
        const my = (e.funds || []).find(h => h.fundId === f.id)
        return {
          id: f.id, name: f.name, seg: f.seg, feePctYear: f.feePctYear, enabled: f.enabled, quote: q,
          my: my ? { units: my.units, cost: my.cost, value: q ? Math.round(my.units * q.unit) : my.cost, boughtAt: my.boughtAt } : null,
        }
      }).filter(f => (f.enabled && f.quote) || f.my)
      // استخرهای فعالِ مشارکت + سهمِ من
      const pools = [] as any[]
      for (const p of Object.values(state.pools)) {
        const it = await getItemById(p.listingId).catch(() => null)
        const live = it ? priceOf(it) : 0
        const unitNow = p.totalUnits > 0 ? Math.round((live > 0 ? live : p.unitToman * p.totalUnits) / p.totalUnits) : 0
        const my = (e.crowd || []).find(h => h.listingId === p.listingId)
        pools.push({
          listingId: p.listingId, title: p.title, hood: p.hood, unitToman: p.unitToman,
          totalUnits: p.totalUnits, soldUnits: p.soldUnits, available: p.totalUnits - p.soldUnits,
          investors: Object.keys(p.investors).length, live, unitNow,
          url: listingHref(p.listingId, p.title, p.hood),
          my: my ? { units: my.units, cost: my.cost, value: Math.round(my.units * unitNow) } : null,
        })
      }
      // نامزدهای مشارکتِ جدید: آگهی‌های واقعیِ گران‌قیمت (فصل ۷ «پروژهٔ ۵۰۰ میلیاردی، هر واحد کوچک»)
      const candidates = cfg.crowd.enabled
        ? items.filter(it => isPricedSale(it) && priceOf(it) >= cfg.crowd.minPrice && !state.pools[it.id] && !e.assets.some(a => a.listingId === it.id))
            .sort((a, x) => priceOf(x) - priceOf(a)).slice(0, 6)
            .map(it => ({ ...lite(it), totalUnits: Math.ceil(priceOf(it) / cfg.crowd.unitToman), unitToman: cfg.crowd.unitToman }))
        : []
      // پرتفوی (فصل ۱۳) + شاخصِ تنوع
      const prices = await livePrices(e)
      const mc = await marketCtx(e).catch(() => null)
      const nw = netWorthOf(e, prices, mc || undefined)
      const fundsValue = (e.funds || []).reduce((s, h) => s + (mc?.fundUnit?.[h.fundId] ? Math.round(h.units * mc.fundUnit[h.fundId]) : h.cost), 0)
      const crowdValue = (e.crowd || []).reduce((s, h) => s + (mc?.crowdUnit?.[h.listingId] ? Math.round(h.units * mc.crowdUnit[h.listingId]) : h.cost), 0)
      const portfolio = portfolioOf({ cash: e.capital, properties: nw.assetsValue, funds: fundsValue, crowd: crowdValue, debt: e.loan?.balance || 0 })
      return NextResponse.json({ ok: true, indices, psychology, funds, pools, candidates, portfolio, vol: state.vol, crowd: { enabled: cfg.crowd.enabled, unitToman: cfg.crowd.unitToman, minPrice: cfg.crowd.minPrice } })
    }

    // خریدِ واحدِ صندوق: قیمتِ هر واحد همین لحظه از میانهٔ متریِ واقعیِ همان بخش محاسبه می‌شود (سمتِ سرور).
    case 'fundBuy': {
      const cfg = config().empire.capital
      if (!cfg.enabled) return NextResponse.json({ error: 'بازار سرمایه فعلاً فعال نیست' }, { status: 403 })
      const units = Math.floor(Number(b.units) || 0)
      const state = await getMarketState()
      const f = state.funds.find(x => x.id === String(b.fundId || ''))
      if (!f || !f.enabled) return NextResponse.json({ error: 'صندوق یافت نشد یا غیرفعال است' }, { status: 404 })
      const items = await candidateListings(800).catch(() => [] as Item[])
      const q = segmentQuote(items, f.seg, cfg.fundMinSamples)
      if (!q) return NextResponse.json({ error: 'برای این صندوق فعلاً نمونهٔ واقعیِ کافی در بازار نیست' }, { status: 400 })
      const r = await buyFundUnits(userId, { id: f.id, name: f.name }, units, q.unit, cfg.investRewardXp)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      recordFundVolume('buy', units * q.unit).catch(() => {})
      return NextResponse.json({ ok: true, unit: q.unit, cost: Math.round(units * q.unit), ...(await stateOf(userId, r.empire!)) })
    }

    // بازخریدِ واحدِ صندوق (بازارِ ثانویه — فصل ۱۱): به ارزشِ روز؛ کارمزدِ مدیریت به‌نسبتِ روزهای نگه‌داری → خزانه.
    case 'fundSell': {
      const cfg = config().empire.capital
      const units = Math.floor(Number(b.units) || 0)
      const e = await getEmpire(userId)
      const h = e?.funds?.find(x => x.fundId === String(b.fundId || ''))
      if (!e || !h) return NextResponse.json({ error: 'واحدی از این صندوق نداری' }, { status: 404 })
      const state = await getMarketState()
      const f = state.funds.find(x => x.id === h.fundId)
      if (!f) return NextResponse.json({ error: 'تعریفِ صندوق یافت نشد' }, { status: 404 })
      const items = await candidateListings(800).catch(() => [] as Item[])
      const q = segmentQuote(items, f.seg, cfg.fundMinSamples)
      if (!q) return NextResponse.json({ error: 'قیمتِ روزِ این صندوق فعلاً قابل‌محاسبه نیست — بعداً دوباره امتحان کن' }, { status: 400 })
      const heldDays = Math.floor((Date.now() - h.boughtAt) / 864e5)
      const fee = fundFeeOf(units * q.unit, f.feePctYear, heldDays)
      const r = await sellFundUnits(userId, f.id, units, q.unit, fee)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      recordFundVolume('sell', r.proceeds || 0).catch(() => {})
      return NextResponse.json({ ok: true, proceeds: r.proceeds, pnl: r.pnl, fee, ...(await stateOf(userId, r.empire!)) })
    }

    // پیوستن به مشارکتِ جمعی (فصل ۷): سهمِ کسری از یک آگهیِ واقعیِ گران — ظرفیت اتمیک، مالیات → خزانه.
    case 'crowdJoin': {
      const cfg = config().empire.capital
      if (!cfg.enabled || !cfg.crowd.enabled) return NextResponse.json({ error: 'سرمایه‌گذاریِ جمعی فعلاً فعال نیست' }, { status: 403 })
      const units = Math.floor(Number(b.units) || 0)
      const it = await getItemById(String(b.listingId || ''))
      if (!it || it.type !== 'listing') return NextResponse.json({ error: 'آگهی یافت نشد' }, { status: 404 })
      const price = priceOf(it)
      if (!isPricedSale(it) || price < cfg.crowd.minPrice) return NextResponse.json({ error: 'این آگهی در سقفِ سرمایه‌گذاریِ جمعی نیست' }, { status: 400 })
      const init = { title: it.title, hood: hoodOf(it.location), unitToman: cfg.crowd.unitToman, totalUnits: Math.ceil(price / cfg.crowd.unitToman) }
      // اول رزروِ اتمیکِ ظرفیت، بعد کسرِ سرمایه؛ اگر سرمایه نرسید، رزرو آزاد می‌شود.
      const res = await reservePoolUnits(it.id, userId, units, init, cfg.crowd.maxPools)
      if (!res.ok) return NextResponse.json({ error: res.reason }, { status: 400 })
      const unitToman = Number((res.out as { unitToman?: number } | undefined)?.unitToman) || cfg.crowd.unitToman
      const r = await joinCrowd(userId, { listingId: it.id, title: it.title, hood: init.hood }, units, unitToman, config().empire.transferTaxPct)
      if (!r.ok) { await releasePoolUnits(it.id, userId, units).catch(() => {}); return NextResponse.json({ error: r.reason }, { status: 400 }) }
      recordFundVolume('buy', units * unitToman).catch(() => {})
      recordEvent({ type: 'user_clicked_property', userId, propertyId: it.id, meta: { src: 'empire_crowd' } }).catch(() => {})
      return NextResponse.json({ ok: true, ...(await stateOf(userId, r.empire!)) })
    }

    // خروج از مشارکت: به ارزشِ روزِ سهم (قیمتِ زندهٔ آگهی ÷ کلِ واحدها) — بازارِ ثانویهٔ صادقانه.
    case 'crowdExit': {
      const units = Math.floor(Number(b.units) || 0)
      const e = await getEmpire(userId)
      const h = e?.crowd?.find(x => x.listingId === String(b.listingId || ''))
      if (!e || !h) return NextResponse.json({ error: 'سهمی در این مشارکت نداری' }, { status: 404 })
      const state = await getMarketState()
      const p = state.pools[h.listingId]
      if (!p || !(p.totalUnits > 0)) return NextResponse.json({ error: 'استخرِ این مشارکت یافت نشد' }, { status: 404 })
      const it = await getItemById(h.listingId).catch(() => null)
      const live = it ? priceOf(it) : 0
      const unitNow = Math.round((live > 0 ? live : p.unitToman * p.totalUnits) / p.totalUnits)
      const r = await exitCrowd(userId, h.listingId, units, unitNow, config().empire.transferTaxPct)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      await releasePoolUnits(h.listingId, userId, units).catch(() => {})
      recordFundVolume('sell', r.proceeds || 0).catch(() => {})
      return NextResponse.json({ ok: true, proceeds: r.proceeds, pnl: r.pnl, ...(await stateOf(userId, r.empire!)) })
    }

    case 'journal': { const r = await addJournal(userId, String(b.text || '')); return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.reason }, { status: 400 }) }

    // بازکردنِ نامهٔ روزانه (opened_at طبق طرحِ سند ثبت می‌شود).
    case 'briefOpen': { await markBriefOpened(userId, dayNumberOf(Date.now())); return NextResponse.json({ ok: true }) }

    // هدیهٔ بازگشت (جلد ۲۶ Comeback Engine) — فقط وقتی غیبتِ واقعی کشف شده باشد.
    case 'comeback': {
      const r = await claimComeback(userId, config().empire.quests.weeklyCoins)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, coins: config().empire.quests.weeklyCoins, ...(await stateOf(userId, r.empire!)) })
    }

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
