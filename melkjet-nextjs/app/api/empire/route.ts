// Empire · API — تمامِ سفرِ سند (جلد۲ فصل ۱–۶) روی دادهٔ واقعی: فرصت‌ها = آگهی‌های واقعی،
// مأموریت‌ها = رفتارِ واقعی (رویدادهای REOS)، تحلیل = مقایسهٔ واقعیِ قیمت با محله. مهمان → فقط پیش‌نمایش.
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import {
  getEmpire, createEmpire, renameEmpire, buyAsset, chooseAssetAction, recordGuess,
  claimEmpireMission, spendAiToken, setSuspense, addJournal, bumpRejects, setPersona, setMentor,
  setStylePicks, setHunterPair, answerHunter, empireLevel, netWorthOf, empireCount, assetKindOf,
  getBrief, markBriefOpened, dayNumberOf,
  sellAsset, setLandPlan, chooseBusiness, accrueIncome, claimDailyChest, chestRewardOf, BUSINESS_TYPES,
  landProjection, empireScoreOf, listEmpiresPublic, applyUpkeep,
  creditScoreOf, loanTermsFor, takeLoan, repayLoan, accrueLoanInterest,
  negotiationOutcome, questOf, nextDreamOf,
  applyHiddenBadges, HIDDEN_BADGES, snapshotNetWorth, markComeback, claimComeback,
  buyFundUnits, sellFundUnits, accrueFundDividends, joinCrowd, exitCrowd,
  companyReputationOf, hireCandidatesOf, teamSkillOf, ownerPersonaOf, permitTermsOf, permitDueAt,
  foundCompany, hireEngineer, applyWages, requestPermit, settleObjection, defendObjection, progressPermits,
  buildPlanOf, buildStageOf, BUILD_STRUCTURES, BUILD_QUALITIES,
  startBuild, progressBuild, resolveBuildEvent, presellUnits, sellUnits,
  PROJECT_GOALS, goalPricePct, AMENITY_LABELS, amenityValueFactorOf, bulkPriceOf,
  projectLessonsOf, engineerEffectsOf, addAmenity, rentOutUnits, stopRentUnits,
  negoMemoryOf, bumpNegoTries, dailyDealPickOf, maxProjectsOf, sellProject,
  applyLevelUpReward, setWeekSnap, setTitle, giveKudos, eventActive, streakMilestonesOf,
  buildingUnitsOf, assemblyUnitPriceOf, buyBuildingUnit, demolishAsset, boostBuild, boostPermit,
  proPersonaOf, designPlanOf, commissionDesign, boostDesign, resolveM100, renovateAsset, designBuildPlanOf,
  activeCoinPacks, buyCosmetic, setCosmetic, offerOf, dismissOffer, areaFromText, rateHit,
  setForSale, tradeAsset, openPartnership, joinPartnership, settlePartnerShares, chargeClanFee,
  setAutoRule, delAutoRule, toggleAutoRule, recordRuleFires,
  bigDealPickOf, bigDealNegoOf, BIG_DEAL_STRATEGIES, noteCrisis, recordBigDealTry,
  auctionPickOf, auctionSetupOf, auctionInfluenceOf, auctionNextBidOf, startAuction, applyAuctionMove, consumeAuctionWin, AUCTION_RIVALS,
  markRewardClaimed,
  floorsOfMeta, legalFloorsOf, BUILD_FACADES, setAssetNickname,
  type EmpireData, type AssetKind, type LandPlan,
} from '@/app/lib/empire-store'
import {
  getMarketState, segmentQuote, marketIndices, psychologyOf, fundFeeOf, portfolioOf,
  reservePoolUnits, releasePoolUnits, recordFundVolume,
} from '@/app/lib/empire-market'
import { masteryOf, newsOf } from '@/app/lib/empire-engage'
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
import { ownerOfListing, claimListing, releaseListing, transferListing, myClanOf, listClans, createClan, joinClan, leaveClan, postClanMsg, clanView, deleteClanIfOwner } from '@/app/lib/empire-social'
// فاز ۳۹ (سند ۲۶ فصل ۱۶ Cognitive AI): هوشِ سرمایه‌گذاری — ارزش‌گذاری/تصمیم‌یار/روندِ محله/سلامتِ مالی/اولویت‌ها؛ همه از دادهٔ واقعی.
import { compStatsOf, valuationOf, decisionOf, marketIntelOf, cashflowOf, financialHealthOf, prioritiesOf, evalRules, RULE_TEMPLATES, tradeAskCheckOf, jvOfferCheckOf, crisisOf, rarityOf } from '@/app/lib/empire-intel'
// فاز ۴۸ (جوایزِ پولِ واقعی): نردبان/استخر/صفِ تأیید + کیف‌پولِ یکپارچهٔ سایت (سطلِ «پاداش»)
import { rewardLadderOf, requestPayout, userPayoutsOf } from '@/app/lib/empire-rewards'
import { bucketBalance } from '@/app/lib/reos/wallet'
import { loadSnapshots } from '@/app/lib/empire-metrics'

const hoodOf = (loc?: string) => { const p = String(loc || '').split(/[،,]/).map(x => x.trim()).filter(Boolean); return p.length > 1 ? p[p.length - 1] : (p[0] || '') }
// سپرِ نرخِ درخواست (فاز ۳۴ — سند ۲۳): پنجرهٔ یک‌دقیقه‌ایِ هر بازیکن، در حافظهٔ همین اینستنس
const RATE_BUCKET = new Map<string, { m: number; n: number }>()
// آیکنِ قاب/نشانِ فعالِ بازیکن (فاز ۳۳): ارزشِ آیتمِ ظاهری = دیده‌شدن توسطِ دیگران (سند ۲۲ فصل ۳)
const cosmeticIconOf = (e: Pick<EmpireData, 'cosmetics'>, kind: 'frame' | 'flair') => {
  const id = e.cosmetics?.[kind]
  return id ? ((config().empire.cosmetics?.items || []).find(i => i.id === id)?.icon || '') : ''
}
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

// 🎪 رویدادهای زندهٔ ادمین (سند ۱۸ — LiveOps): تعریف از پنل بدونِ دیپلوی؛ پیشرفت فقط از رفتارِ واقعیِ
// ثبت‌شدهٔ REOS در بازهٔ خودِ رویداد — هیچ شمارندهٔ ساختگی.
async function liveEventsOf(userId: string, e: EmpireData, now = Date.now()) {
  const defs = (config().empire.events || []).filter(d => eventActive(d, now))
  if (!defs.length) return []
  const evs = await recentEvents({ userId, limit: 300 }).catch(() => [])
  const out = []
  for (const d of defs) {
    const win = evs.filter(x => x.at >= d.startAt && x.at < d.endAt)
    const viewIds = [...new Set(win.filter(x => x.type === 'user_clicked_property' && x.propertyId).map(x => x.propertyId!))]
    let progress = 0
    if (d.metric === 'views') progress = viewIds.length
    else if (d.metric === 'saves') progress = win.filter(x => x.type === 'user_saved_property').length
    else if (d.metric === 'searches') progress = win.filter(x => x.type === 'user_searched').length
    else if (d.metric === 'hoods') {
      const hs = new Set<string>()
      for (const id of viewIds.slice(0, 15)) { const it = await getItemById(id).catch(() => null); const h = it ? hoodOf(it.location) : ''; if (h) hs.add(h) }
      progress = hs.size
    }
    progress = Math.min(Math.max(1, d.target), progress)
    out.push({ id: d.id, title: d.title, desc: d.desc, icon: d.icon || '🎪', endAt: d.endAt, target: d.target, progress, done: progress >= d.target, claimed: !!e.claims['ev_' + d.id], rewardXp: d.rewardXp || 0, rewardCoins: d.rewardCoins || 0 })
  }
  return out
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

// قیمت + مختصات + واحدها/متراژِ واقعیِ دارایی‌ها در یک پاس — نقشهٔ شهر (فصل ۹) + تجمیع/تخریب (فاز ۲۵).
async function liveInfoOf(e: EmpireData): Promise<{ prices: Record<string, number>; coords: Record<string, { lat: number; lng: number }>; units: Record<string, number>; areas: Record<string, number> }> {
  const asm = config().empire.assembly
  const prices: Record<string, number> = {}
  const coords: Record<string, { lat: number; lng: number }> = {}
  const units: Record<string, number> = {}
  const areas: Record<string, number> = {}
  for (const a of e.assets) {
    const it = await getItemById(a.listingId).catch(() => null)
    if (!it) continue
    const p = priceOf(it)
    if (p > 0) prices[a.listingId] = p
    const lat = Number(it.meta?.['__lat']), lng = Number(it.meta?.['__lng'])
    if (lat && lng) coords[a.listingId] = { lat, lng }
    units[a.listingId] = buildingUnitsOf(a.listingId, it.meta, asm.unitsMin, asm.unitsMax)
    areas[a.listingId] = parseFaNum((it.meta || {})['متراژ']) || 0
  }
  return { prices, coords, units, areas }
}

// اجارهٔ ماهانهٔ یک آگهیِ اجاره‌ای («ودیعه X · اجاره Y» یا متنِ مشابه) — فقط بخشِ اجاره.
function monthlyRentOf(it: Item): number {
  const m = (it.price || '').match(/اجاره[^\d۰-۹]*([\d,٬۰-۹]+)/)
  return m ? parseFaNum(m[1]) : 0
}
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }

// جدولِ میانهٔ اجاره‌های واقعی — با کشِ ۱۰ دقیقه‌ای در حافظه: هر بازدیدِ داشبورد/تصمیمِ اجاره
// نباید دوباره صدها آگهی را اسکن کند (اجاره‌های بازار در این بازه عوض نمی‌شوند).
let RENT_CACHE: { at: number; byHood: Map<string, number>; global: number } | null = null
async function rentTable(): Promise<{ byHood: Map<string, number>; global: number }> {
  if (RENT_CACHE && Date.now() - RENT_CACHE.at < 600_000) return RENT_CACHE
  const items = await candidateListings(500).catch(() => [] as Item[])
  const byHoodRaw = new Map<string, number[]>()
  const all: number[] = []
  for (const it of items) {
    if (isSale(it)) continue
    const r = monthlyRentOf(it)
    if (!(r > 0)) continue
    all.push(r)
    const h = hoodOf(it.location)
    if (h) { if (!byHoodRaw.has(h)) byHoodRaw.set(h, []); byHoodRaw.get(h)!.push(r) }
  }
  const byHood = new Map<string, number>()
  for (const [h, xs] of byHoodRaw) byHood.set(h, median(xs))
  RENT_CACHE = { at: Date.now(), byHood, global: median(all) }
  return RENT_CACHE
}
// میانهٔ اجارهٔ ماهانهٔ واقعیِ محله (برای کمیسیونِ مشاورِ اجاره — فاز ۲۹)؛ نبود → میانهٔ کلِ شهر.
async function hoodMonthlyRentOf(hood: string): Promise<number> {
  const t = await rentTable()
  return t.byHood.get(hood) || t.global
}
// برچسب‌های بازسازی (فاز ۲۹) — گزینه‌ها/اعدادش از config می‌آید.
const RENOV_LABELS: Record<string, { label: string; icon: string }> = {
  kitchen: { label: 'آشپزخانه و سرویس‌ها', icon: '🍳' }, facade: { label: 'نمای ساختمان', icon: '🏢' }, full: { label: 'بازسازیِ کامل', icon: '🛠' },
}

// مهارتِ مؤثرِ مذاکره (سند ۱۴): هویت + شخصیتِ مالک + تیمِ مهندسی + حافظهٔ مذاکره + اعتبارِ ⭐ برند —
// یک منبعِ واحد برای «مذاکره» و «خرید» تا نتیجهٔ هر دو یکی باشد.
// سطح‌گشایی (سند ۱۵ — GDD فصل ۴ بخش ۱۹ «امکانات باید بیشتر شوند، نه اعداد»): فقط ورودی‌های جدید بسته‌اند؛
// دارایی‌ها و خروج (فروش/بازخرید) هرگز قفل نمی‌شوند.
async function lockedMsg(userId: string, needLevel: number, what: string): Promise<string | null> {
  if (!(needLevel > 1)) return null
  const e = await getEmpire(userId)
  if (!e) return 'اول امپراتوری‌ات را بساز'
  const lv = empireLevel(e.xp).level
  return lv >= needLevel ? null : `${what} از سطحِ ${needLevel.toLocaleString('fa-IR')} باز می‌شود — الان سطحِ ${lv.toLocaleString('fa-IR')} هستی. با تصمیم‌های واقعی XP بگیر.`
}

function negoSkillOf(e: EmpireData, personaMod: number): { skill: number; memory: { mod: number; note: string | null }; repBonus: number } {
  const memory = negoMemoryOf(e.stats)
  const repBonus = e.company
    ? Math.max(0, companyReputationOf(e, config().empire.build.repProjectScore).stars - 1) * Math.max(0, config().empire.reputation.negoBonusPerStar)
    : 0
  return { skill: (e.identity.negotiation || 0) + personaMod + Math.round(teamSkillOf(e) / 10) + memory.mod + repBonus, memory, repBonus }
}

// عرفِ واقعیِ ساختِ محله (ضابطهٔ «منطقه» — فیدبکِ کاربر): میانهٔ کلِ طبقاتِ ساختمان‌ها از متای واقعیِ
// «طبقه: X از Y» آگهی‌های هم‌محله؛ کمتر از ۳ نمونهٔ واقعی → بدونِ تعدیل (نه عددِ ساختگی).
async function hoodFloorsNorm(hood: string): Promise<number | null> {
  if (!hood) return null
  const items = await candidateListings(600).catch(() => [] as Item[])
  const fs = items.filter(x => hoodOf(x.location) === hood).map(x => floorsOfMeta(x.meta)).filter((n): n is number => !!n)
  if (fs.length < 3) return null
  const s = [...fs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

// میانهٔ قیمتِ هر مترِ فروش در یک محله (از آگهی‌های واقعی) — مبنای قیمت‌گذاریِ پیش‌فروش/فروشِ واحد (جلد ۷۱/۷۲).
async function hoodPerM(hood: string): Promise<{ perM: number; samples: number }> {
  const items = await candidateListings(600).catch(() => [] as Item[])
  const rates: number[] = []
  for (const x of items) {
    if (!isSale(x) || (hood && hoodOf(x.location) !== hood)) continue
    const a = parseFaNum((x.meta || {})['متراژ']) || 0
    const p = priceOf(x)
    if (a > 0 && p >= MIN_SALE) rates.push(p / a)
  }
  return { perM: Math.round(median(rates)), samples: rates.length }
}

// متراژِ زمین وقتی فیلدِ متراژِ آگهی خالی است (فیدبکِ کاربر: بن‌بست ممنوع، برآوردِ شفاف از دادهٔ واقعی):
// ۱) متایِ آگهی ۲) متنِ خودِ آگهی («کلنگی ۲۱۰ متری…») ۳) قیمت ÷ میانهٔ متریِ واقعیِ محله (وگرنه کلِ شهر).
// برآورد همیشه با برچسبِ صادقانهٔ note به UI اعلام می‌شود — عددِ ساختگی نداریم، استنتاج از دادهٔ واقعی داریم.
async function landAreaWithEstimate(a: { listingId: string; title?: string; buyPrice: number; hood: string; landAreaOverride?: number }, it: Item | null): Promise<{ area: number; note?: string }> {
  if ((a.landAreaOverride || 0) > 0) return { area: a.landAreaOverride! }
  const meta = it ? (parseFaNum((it.meta || {})['متراژ']) || 0) : 0
  if (meta > 0) return { area: meta }
  const t = areaFromText(it?.title, a.title)
  if (t > 0) return { area: t, note: 'برآورد از متنِ آگهی' }
  let { perM } = await hoodPerM(a.hood)
  if (!(perM > 0)) ({ perM } = await hoodPerM(''))
  if (perM > 0 && a.buyPrice > 0) return { area: Math.max(30, Math.round(a.buyPrice / perM)), note: 'برآورد از قیمتِ متریِ محله' }
  return { area: 0 }
}

// واریزِ درآمدِ اجاره/کسب‌وکار: برآورد از میانهٔ اجارهٔ واقعیِ هم‌محله‌ها (Real Estate Simulation — فصل ۵).
// بدونِ دادهٔ اجاره در محله/شهر → هیچ واریزی (صادقانه). حداقل یک روزِ کامل باید گذشته باشد.
async function accrueRentFor(userId: string, e: EmpireData, now = Date.now()): Promise<EmpireData> {
  if (!config().empire.rentIncome) return e
  const earners = e.assets.filter(a => a.action === 'rent' || a.business)
  // «نگه‌دار و اجاره بده» (GDD فصل ۴): واحدهای اجاره‌رفتهٔ پروژه‌های تکمیل‌شده هم از میانهٔ واقعیِ محله درآمد دارند
  const bldRenters = e.assets.filter(a => a.construction?.done && (a.construction.rented || 0) > 0 && !(a.action === 'rent' || a.business))
  if (!earners.length && !bldRenters.length) return e
  // جدولِ اجاره‌های واقعی از کشِ ۱۰دقیقه‌ای (فاز ۳۰ کارایی) — قبلاً هر بازدید ۵۰۰ آگهی اسکن می‌شد.
  const rt = await rentTable()
  const globalMed = rt.global
  const accruals: Array<{ assetId: string; amount: number }> = []
  for (const a of earners) {
    const monthly0 = rt.byHood.get(a.hood) || globalMed
    if (!(monthly0 > 0)) continue
    const monthly = a.business ? Math.round(monthly0 * ((a.businessProb || 50) / 100) * 2) : monthly0   // کسب‌وکار: ~۲ برابرِ اجارهٔ مسکونی × احتمالِ موفقیت
    const since = a.lastAccrualAt || a.actionAt || a.boughtAt
    const days = Math.floor((now - since) / 864e5)
    if (days < 1) continue
    accruals.push({ assetId: a.id, amount: Math.round(monthly * days / 30) })
  }
  for (const a of bldRenters) {
    const c = a.construction!
    const monthly0 = rt.byHood.get(a.hood) || globalMed
    if (!(monthly0 > 0)) continue   // بدونِ نمونهٔ واقعیِ اجاره → هیچ واریزی (صادقانه)
    const monthly = Math.round(monthly0 * (c.rented || 0) * c.qualityFactor * amenityValueFactorOf(c, config().empire.build.amenities))
    const since = a.lastAccrualAt || c.rentStartAt || c.doneAt || a.boughtAt
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
  const e0a = await upkeepFor(userId, e00).catch(() => e00)   // هزینهٔ مالکیت (GDD جلد۵)
  // شرکتِ ساختمانی (جلد ۶۱/۶۳): حقوقِ روزشمارِ تیم + صدورِ پروانه‌های سررسیدشده
  const wg = e0a.company?.engineers.length ? await applyWages(userId).catch(() => null) : null
  const e0b = wg?.ok && wg.empire ? wg.empire : e0a
  const pp = e0b.assets.some(a => a.permit?.status === 'pending') ? await progressPermits(userId).catch(() => null) : null
  const e0c = pp?.ok && pp.empire ? pp.empire : e0b
  // موتورِ ساخت (جلد ۶۴–۷۲): هزینهٔ روزشمارِ کارگاه + رویدادها + تکمیل
  const pb = config().empire.build.enabled && e0c.assets.some(a => a.construction && !a.construction.done && !a.construction.pendingEvent)
    ? await progressBuild(userId).catch(() => null) : null
  const e0 = pb?.ok && pb.empire ? pb.empire : e0c
  const e1 = await accrueRentFor(userId, e0).catch(() => e0)  // درآمدِ اجاره/کسب‌وکار از بازارِ واقعی
  // بازار سرمایه (جلد ۴۰): قیمتِ روزِ واحدها + سودِ دوره‌ای از اجارهٔ واقعی
  const mc = await marketCtx(e1).catch(() => null)
  const e1b = mc ? await accrueDividendsFor(userId, e1, mc.rentPerM).catch(() => e1) : e1
  // بهرهٔ روزشمارِ وام (جلد ۱۶) — روزی یک‌بار
  const li = e1b.loan ? await accrueLoanInterest(userId).catch(() => null) : null
  const e2 = li?.ok && li.empire ? li.empire : e1b
  // کشفِ مأموریت‌های مخفی (جلد ۲۶) — از رفتارِ واقعیِ همین لحظه
  const hb = await applyHiddenBadges(userId).catch(() => null)
  const e3 = hb?.ok && hb.empire ? hb.empire : e2
  // پاداشِ Level Up (سند ۱۶): سطحِ جدید از XPِ واقعی → کوین + نقطهٔ تایم‌لاین (هر سطح یک‌بار)
  const lvr = await applyLevelUpReward(userId, config().empire.levelUpCoins).catch(() => null)
  const e = lvr?.ok && lvr.empire ? lvr.empire : e3
  const [info, missions, total] = await Promise.all([liveInfoOf(e), missionsOf(userId, e), empireCount()])
  const prices = info.prices
  const nw = netWorthOf(e, prices, mc || undefined)
  const asmCfg = config().empire.assembly
  // فاز ۴۷ (فیدبک: «اجاره/کسب‌وکار مبهم است»): نرخِ شفافِ درآمدِ روزشمار — دقیقاً همان فرمول‌های accrueRentFor
  const rt47 = await rentTable().catch(() => ({ at: 0, byHood: new Map<string, number>(), global: 0 }))
  const assets = e.assets.map(a => {
    const rentM0 = rt47.byHood.get(a.hood) || rt47.global
    const incomeMonthly = a.business ? Math.round(rentM0 * ((a.businessProb || 50) / 100) * 2)
      : a.action === 'rent' ? rentM0
      : a.construction?.done && (a.construction.rented || 0) > 0
        ? Math.round(rentM0 * (a.construction.rented || 0) * a.construction.qualityFactor * amenityValueFactorOf(a.construction, config().empire.build.amenities))
        : 0
    const incomeSince = a.lastAccrualAt || a.actionAt || a.boughtAt
    const owned = a.unitsOwned || 1
    const unitP = prices[a.listingId] || Math.round(a.buyPrice / owned)
    // تخریب‌شده = بهای تمام‌شده تا ساخت؛ تجمیع = × واحدها (فاز ۲۵)؛ بازسازی = × (۱+ارزش‌افزوده) (فاز ۲۹)
    const cur = a.demolishedAt ? a.buyPrice : Math.round(unitP * owned * (1 + (a.renovBoostPct || 0) / 100))
    // تجمیع: وضعیتِ ساختمان + قیمتِ واحدِ بعدی + شرط/هزینهٔ تخریب — همه شفاف
    const total = a.unitsTotal || info.units[a.listingId] || 0
    // متراژ: فیلدِ آگهی → متنِ خودِ آگهی («۲۱۰ متری») — فیدبکِ کاربر: بن‌بستِ «متراژ ثبت نشده» ممنوع
    const area = info.areas[a.listingId] || areaFromText(a.title) || 0
    const demolishCost = Math.max(1, Math.round(cur * asmCfg.demolishCostPct / 100))
    const assembly = asmCfg.enabled && !a.demolishedAt && !a.construction && (a.kind === 'apartment' || a.kind === 'commercial') && total >= 2 ? {
      total, owned, premiumPct: asmCfg.extraUnitPremiumPct,
      nextPrice: owned < total ? assemblyUnitPriceOf(unitP, asmCfg.extraUnitPremiumPct) : 0,
      canDemolish: owned >= total, demolishCost,
      landArea: Math.max(20, Math.round(area * total / Math.max(1, config().empire.build.buildFactor))),
    } : undefined
    const villaDemolish = asmCfg.enabled && !a.demolishedAt && !a.construction && a.kind === 'villa' && area > 0 ? {
      demolishCost, landArea: Math.max(20, Math.round(area)),
    } : undefined
    // فاز ۲۹: زمینِ برنامهٔ ساخت بدونِ نقشه → نیازِ قراردادِ معمار (فرمِ طراحی در UI با designPlan پر می‌شود)
    const needsDesign = config().empire.design.enabled && a.kind === 'land' && a.landPlan === 'build' && !a.design && !a.permit
    // فاز ۲۹: گزینه‌های بازسازیِ واقعی با هزینه/ارزشِ شفاف — هر گزینه یک‌بار
    const renovCfg = config().empire.renovation
    const renovOptions = renovCfg.enabled && a.kind !== 'land' && !a.demolishedAt && !a.construction ? Object.entries(renovCfg.options).map(([k, v]) => ({
      key: k, ...(RENOV_LABELS[k] || { label: k, icon: '🛠' }), costPct: v.costPct, valuePct: v.valuePct,
      cost: Math.max(1, Math.round(cur * v.costPct / 100)), done: (a.renovDone || []).includes(k),
    })) : undefined
    return {
    ...a,
    current: cur,
    // فاز ۴۷: شفافیتِ درآمد — ماهانه از میانهٔ واقعیِ اجارهٔ محله (کسب‌وکار: ×۲ × احتمالِ موفقیت)، روزشمار واریز می‌شود
    incomeMonthly: incomeMonthly > 0 ? incomeMonthly : undefined,
    incomeDaily: incomeMonthly > 0 ? Math.max(1, Math.round(incomeMonthly / 30)) : undefined,
    rentSampled: rentM0 > 0,   // false = در محله/شهر نمونهٔ اجارهٔ واقعی نیست → صادقانه «واریزی نداریم»
    incomeSinceH: (a.action === 'rent' || a.business) ? Math.max(0, Math.floor((Date.now() - incomeSince) / 36e5)) : undefined,   // ساعت از آخرین واریز — برای «قسطِ بعدی»
    assembly, villaDemolish, needsDesign, renovOptions,
    designReadyInDays: a.design && Date.now() < a.design.readyAt ? Math.max(1, Math.ceil((a.design.readyAt - Date.now()) / 864e5)) : 0,
    lat: info.coords[a.listingId]?.lat, lng: info.coords[a.listingId]?.lng,   // برای پینِ نقشهٔ شهر
    growthPct: a.buyPrice ? Math.round((cur - a.buyPrice) / a.buyPrice * 1000) / 10 : 0,
    // زمینِ بدونِ برنامه → سه گزینهٔ سند (§6.7) با برآوردِ شفاف
    plans: a.kind === 'land' && !a.landPlan ? landProjection(prices[a.listingId] || a.buyPrice) : undefined,
    permitDue: a.permit?.status === 'pending' ? permitDueAt(a.permit) : undefined,   // شمارشِ معکوسِ پروانه (جلد ۶۳)
    build: a.construction ? {
      stage: buildStageOf(a.construction),
      progressPct: Math.min(100, Math.round(a.construction.paidDays / Math.max(1, a.construction.days) * 100)),
      dailyCost: Math.max(1, Math.round(a.construction.costTotal / Math.max(1, a.construction.days))),
      // GDD فصل ۴: هدفِ پروژه + امکاناتِ خریده‌شده + گزینه‌های باقی‌مانده (با هزینه/ارزشِ شفاف) + واحدهای اجاره‌ای
      goal: a.construction.goal, goalLabel: a.construction.goal ? PROJECT_GOALS[a.construction.goal]?.label : undefined,
      amenities: (a.construction.amenities || []).map(k => AMENITY_LABELS[k]?.label || k),
      amenityOptions: a.construction.done ? [] : Object.entries(config().empire.build.amenities)
        .filter(([k]) => AMENITY_LABELS[k] && !(a.construction!.amenities || []).includes(k))
        .map(([k, v]) => ({ key: k, label: AMENITY_LABELS[k].label, icon: AMENITY_LABELS[k].icon, cost: Math.max(1, Math.round(a.construction!.costTotal * v.costPct / 100)), valuePct: v.valuePct })),
      rented: a.construction.rented || 0,
      freeUnits: Math.max(0, a.construction.totalUnits - a.construction.presold - a.construction.sold - (a.construction.rented || 0)),
    } : undefined,
    url: listingHref(a.listingId, a.title, a.hood),   // پلِ بازی→واقعیت (جلد ۲۸)
  } })
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
  // اعتبارِ برند روی شرایطِ بانک اثرِ واقعی دارد (سند ۱۴): هر ⭐ بالای ۱ → نرخِ بهتر
  const repStars = e.company ? companyReputationOf(e, config().empire.build.repProjectScore).stars : 0
  const repArg = repStars > 1 ? { stars: repStars, cutPctPerStar: config().empire.reputation.loanRateCutPctPerStar } : undefined
  const bank = config().empire.bank.enabled ? { credit, loan: e.loan || null, terms: e.loan ? null : loanTermsFor(credit.score, Math.max(0, nw.netWorth), config().empire.bank, repArg) } : null
  const quests = await questsOf(userId, e).catch(() => null)
  // 🎪 رویدادهای زندهٔ فعال (سند ۱۸) + پاداشِ نقاطِ عطفِ استریکِ واقعی (بخش ۱)
  const liveEvents = await liveEventsOf(userId, e).catch(() => [])
  const streakBonuses = streak ? streakMilestonesOf(streak.streak || 0, today, e.claims, config().empire.streakBonus) : []
  const chestAvailable = config().empire.chest.enabled && !e.claims['chest_' + today]
  // «امروز فقط N دقیقه لازم داری» (فصل ۴ Real Life Time Engine): از کارهای بازِ واقعی.
  const openActions = [quests?.daily && !quests.daily.claimed, quests?.weekly && !quests.weekly.claimed, chestAvailable, missions?.m1?.done && !missions.m1.claimed, brief && !brief.openedAt].filter(Boolean).length
  // «سود/زیانِ دیروز» (جلد ۲۶): اسنپ‌شاتِ روزانه — اولین بازدیدِ روز ثبت، دلتا نسبت به روزِ قبل.
  let dayDelta: number | null = null
  if (!e.snap || e.snap.day < today) { await snapshotNetWorth(userId, today, nw.netWorth).catch(() => {}); dayDelta = e.snap ? nw.netWorth - e.snap.netWorth : null }
  else dayDelta = nw.netWorth - e.snap.prev
  // اسنپ‌شاتِ هفتگی (سند ۱۶): مبنای لیدربوردِ «رشدِ این هفته» — از نقطهٔ ورودِ خودِ بازیکن در این هفته
  const thisWeek = Math.floor(today / 7)
  if (!e.weekSnap || e.weekSnap.week < thisWeek) await setWeekSnap(userId, thisWeek, nw.netWorth).catch(() => {})
  return {
    enabled: true, empire: { ...e, assets }, level: empireLevel(e.xp), ...nw, missions, bank, quests,
    liveEvents, streakBonuses,
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
    bizTypes: BUSINESS_TYPES,   // فاز ۴۷: کسب‌وکارها از نقش‌های واقعیِ سایت — احتمالِ موفقیت از رقبای واقعیِ محله
    dealsEnabled: config().empire.deals.enabled,   // Hook روزانه (سند ۱۴)
    speed: config().empire.speed,                  // زمان‌خری (فاز ۲۷): نرخِ کوین برای نمایشِ شفاف در UI
    pros: config().empire.pros,                    // کارمزدِ نقش‌های حرفه‌ای (فاز ۲۹) — برای نمایشِ شفاف
    soundEnabled: config().empire.sound?.enabled !== false,   // 🔊 بازخوردِ صوتی (فاز ۳۲)
    // 🪙 فروشگاهِ کوین (فاز ۲۸): فقط بسته‌های فعال — قیمت‌ها شفاف؛ کوین هرگز قدرت نمی‌خرد
    // فاز ۳۳: بستهٔ زمان‌دار (until) بعدِ تاریخش خودکار حذف می‌شود — تایمرِ واقعی، نه نمایشی
    coinShop: config().empire.coinShop?.enabled ? { enabled: true, packs: activeCoinPacks(config().empire.coinShop.packs || []) } : { enabled: false, packs: [] },
    // 🎨 فروشگاهِ ظاهری (فاز ۳۳ — سند ۲۲ فصل ۳): قاب/نشان فقط برای نمایش؛ صفر اثرِ اقتصادی
    cosmetics: config().empire.cosmetics?.enabled ? {
      enabled: true,
      items: (config().empire.cosmetics.items || []).filter(i => i.enabled && i.priceCoins > 0),
      owned: e.cosmetics?.owned || [], frame: e.cosmetics?.frame || '', flair: e.cosmetics?.flair || '',
    } : { enabled: false, items: [], owned: [], frame: '', flair: '' },
    // 🎁 پیشنهادِ هوشمند (فاز ۳۳ — سند ۲۲ فصل ۹): حداکثر ۱ در روز، قطعی از رفتارِ واقعی، قابلِ‌بستن
    offer: offerOf(e, dayNumberOf(Date.now()), config().empire.offers, config().empire.cosmetics?.enabled ? (config().empire.cosmetics.items || []).filter(i => i.enabled) : [], config().empire.coinShop?.enabled ? activeCoinPacks(config().empire.coinShop.packs || []) : []),
    // سطح‌گشایی (سند ۱۵): چه چیزی از چه سطحی باز می‌شود + ظرفیتِ پروژهٔ همزمان — شفاف در UI
    unlocks: (() => {
      const u = config().empire.unlocks
      const lv = empireLevel(e.xp).level
      return {
        level: lv,
        capital: { need: u.capitalLevel, ok: lv >= u.capitalLevel },
        company: { need: u.companyLevel, ok: lv >= u.companyLevel },
        crowd: { need: u.crowdLevel, ok: lv >= u.crowdLevel },
        // فاز ۳۷: بازارِ بازیکنان/مشارکتِ ساخت و اتحاد — سطح‌گشا (درخواستِ مستقیم)
        trade: { need: u.tradeLevel, ok: lv >= u.tradeLevel, enabled: config().empire.social?.tradeEnabled !== false },
        clan: { need: u.clanLevel, ok: lv >= u.clanLevel, enabled: config().empire.social?.clanEnabled !== false },
        projects: { max: maxProjectsOf(lv, u), active: e.assets.filter(x => x.construction && !x.construction.done).length, exitPct: u.projectExitPct },
      }
    })(),
    mastery: masteryOf(e),   // استادیِ چندمحوره (جلد ۴۹ فصل ۵) — از شمارنده‌های واقعیِ رفتار
    // شرکتِ ساختمانی (جلد ۶۱): اعتبارِ ستاره‌ای از رفتارِ واقعی + مهارتِ تیم
    companyEnabled: config().empire.company.enabled,
    company: e.company ? { ...e.company, engineers: e.company.engineers.map(x => ({ ...x, effects: engineerEffectsOf(x.skill, config().empire.build.eventSkillCutPct, config().empire.company.permit.engineerSpeedupDays) })), reputation: companyReputationOf(e, config().empire.build.repProjectScore), teamSkill: teamSkillOf(e), wagesPaid: e.wagesPaid || 0 } : null,
    // کارنامهٔ پروژه‌های تحویل‌شده (GDD فصل ۴): هر پروژه یک درس — از اعدادِ واقعیِ خودش
    projectHist: (e.projectHist || []).slice(-6).reverse().map(r => ({ ...r, goalLabel: r.goal ? PROJECT_GOALS[r.goal]?.label : undefined, lessons: projectLessonsOf(r) })),
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
  // سپرِ API (فاز ۳۴ — سند ۲۳ Part 04): بازیِ عادی هرگز به سقف نمی‌رسد؛ فقط اسکریپت/سوءاستفاده را می‌بندد.
  {
    const limit = config().empire.api?.rateLimitPerMin ?? 120
    const r = rateHit(RATE_BUCKET.get(userId), Math.floor(Date.now() / 60_000), limit)
    RATE_BUCKET.set(userId, r.state)
    if (RATE_BUCKET.size > 5000) RATE_BUCKET.clear()
    if (r.limited) return NextResponse.json({ error: 'تعدادِ درخواست‌ها زیاد شد — یک دقیقه صبر کن و دوباره امتحان کن' }, { status: 429 })
  }
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
      // کلِ بازار را می‌گردیم (نه فقط ۳۰۰ آگهیِ اخیر — آن‌ها ممکن است همه گران‌تر از سرمایه باشند)؛
      // «در حدِ سرمایه» یعنی قیمت + مالیاتِ انتقال، تا فرصتی پیشنهاد نشود که خریدش رد شود.
      const taxPct = config().empire.transferTaxPct
      const priced = (await candidateListings(1500)).filter(isPricedSale)
      const items = priced.filter(it => { const p = priceOf(it); return p + Math.round(p * taxPct / 100) <= e.capital })
      // هیچ آگهیِ هم‌بودجه‌ای در کلِ بازار نیست → صادقانه ارزان‌ترین‌های واقعی را با پرچمِ «هنوز نمی‌رسد» نشان بده.
      if (!items.length) {
        const cheapest = [...priced].sort((a, x) => priceOf(a) - priceOf(x)).slice(0, 4)
        if (!cheapest.length) return NextResponse.json({ ok: true, opportunities: [], locked: false })
        return NextResponse.json({
          ok: true, locked: true, capital: e.capital,
          opportunities: cheapest.map((it, i) => ({ ...lite(it), recommended: i === 0, locked: true, reason: 'ارزان‌ترین فرصتِ واقعیِ فعلی — سرمایهٔ نقدِ تو هنوز به آن نمی‌رسد' })),
        })
      }
      const stats = await forIds(items.slice(0, 400).map(i => i.id)).catch(() => ({} as Record<string, { views: number; contacts: number }>))
      const cityMatch = (it: Item) => e.answers.city && (it.location || '').includes(e.answers.city) ? 1 : 0
      const engagement = (it: Item) => (stats[it.id]?.views || 0) + 3 * (stats[it.id]?.contacts || 0)
      const byKind = new Map<AssetKind, Item[]>()
      for (const it of items) { const k = assetKindOf(ptypeOf(it)); if (!byKind.has(k)) byKind.set(k, []); byKind.get(k)!.push(it) }
      const picks: Array<ReturnType<typeof lite> & { recommended: boolean; reason: string; why?: string[] }> = []
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
        // توضیح‌پذیریِ AI (جلد ۵۴ «AI Explainability»): چرا این پیشنهاد — فقط سیگنال‌های واقعی.
        const why: string[] = []
        if (cityMatch(it)) why.push(`در «${e.answers.city}» — شهرِ انتخابیِ تو`)
        const s = stats[it.id]
        if ((s?.views || 0) + (s?.contacts || 0) > 0) why.push(`استقبالِ واقعی: ${(s?.views || 0).toLocaleString('fa-IR')} بازدید${s?.contacts ? ` و ${s.contacts.toLocaleString('fa-IR')} تماس` : ''}`)
        why.push(`${Math.max(1, Math.round(priceOf(it) / e.capital * 100)).toLocaleString('fa-IR')}٪ از سرمایهٔ نقدِ تو`)
        if (rec) why.push(`هم‌راستا با پروفایلِ ${e.profile.title}`)
        picks.push({ ...lite(it), recommended: rec, reason: rec ? 'اگر جای تو بودم از اینجا شروع می‌کردم' : (cityMatch(it) ? `در شهرِ انتخابیِ تو` : 'فرصتِ فعال در بازار'), why })
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
      // جلد ۶۲: «زمین قیمتِ ثابت ندارد؛ مالک دارد» — شخصیت + تیم + حافظهٔ مذاکره + اعتبارِ برند (سند ۱۴) روی شانس اثر دارند.
      // تجمیع (فاز ۲۵): هر واحدِ ساختمان مالکِ خودش را دارد — b.unit کلیدِ قطعیِ همان واحد می‌شود.
      const negoKey = Number(b.unit) > 1 ? `${it.id}#u${Number(b.unit)}` : it.id
      const persona = ownerPersonaOf(negoKey)
      const ns = negoSkillOf(e, persona.mod)
      const out = negotiationOutcome(userId, negoKey, ns.skill)
      bumpNegoTries(userId, it.id).catch(() => {})   // حافظهٔ مذاکره: هر آگهی یک بار شمرده می‌شود
      const price = priceOf(it)
      return NextResponse.json({ ok: true, ...out, owner: { name: persona.name, age: persona.age, type: persona.type, desc: persona.desc }, memoryNote: ns.memory.note, repBonus: ns.repBonus || undefined, price, finalPrice: Math.round(price * (1 - out.discountPct / 100)) })
    }

    // خرید (فصل ۳): آگهیِ واقعی با قیمتِ واقعی؛ اگر مذاکره کرده، همان تخفیفِ قطعی سمتِ سرور اعمال می‌شود.
    case 'buy': {
      const it = await getItemById(String(b.listingId || ''))
      if (!it || it.type !== 'listing') return NextResponse.json({ error: 'آگهی یافت نشد' }, { status: 404 })
      let price = priceOf(it)
      if (!(price > 0) || !isSale(it)) return NextResponse.json({ error: 'این آگهی قیمتِ فروشِ مشخص ندارد' }, { status: 400 })
      const me0 = await getEmpire(userId)
      let negotiatedWin = false
      if (b.negotiated) {
        // همان فرمولِ اکشنِ «مذاکره» (negoSkillOf) — تا تخفیفی که کاربر دیده، سرِ خرید هم همان باشد.
        const out = me0 ? negotiationOutcome(userId, it.id, negoSkillOf(me0, ownerPersonaOf(it.id).mod).skill) : { success: false, discountPct: 0 }
        if (out.success) { price = Math.round(price * (1 - out.discountPct / 100)); negotiatedWin = true }
      }
      // فاز ۴۱ (سند ۲۸ Part 07): خریدِ معاملهٔ بزرگِ هفته با تخفیفِ بردهٔ ذخیره‌شده در سرور — فقط روی همان ملکِ هفته.
      if (b.bigDeal && me0) {
        const bdCfg = config().empire.bigDeal
        const week = Math.floor(dayNumberOf(Date.now()) / 7)
        const win = me0.bigDealWin
        if (!bdCfg.enabled || !win || win.week !== week) return NextResponse.json({ error: 'تخفیفِ معتبرِ معاملهٔ بزرگ نداری — اول مذاکره را ببر' }, { status: 400 })
        const items41 = await candidateListings(800).catch(() => [] as Item[])
        const pick41 = bigDealPickOf(week, items41.filter(isPricedSale).map(x => ({ id: x.id, price: priceOf(x) })), bdCfg.topPct)
        if (pick41 !== it.id) return NextResponse.json({ error: 'این آگهی معاملهٔ بزرگِ این هفته نیست' }, { status: 400 })
        price = Math.round(price * (1 - win.discountPct / 100))
        negotiatedWin = true
      }
      // فاز ۴۵ (سند ۲۹ Auction Saga): خریدِ برندهٔ چکش — قیمت همان قیمتِ نهاییِ تالار است (سرور ذخیره کرده)؛
      // ممکن است زیرِ قیمتِ آگهی باشد (پاداشِ نبرد) یا بالاترش (ریسکِ گران‌خری — عمداً واقعی).
      let auctionBuy = false
      if (b.auction && me0) {
        const week45 = Math.floor(dayNumberOf(Date.now()) / 7)
        const win45 = me0.auctionWin
        if (!config().empire.auction.enabled || !win45 || win45.week !== week45 || win45.listingId !== it.id) {
          return NextResponse.json({ error: 'بردِ معتبرِ مزایده روی این ملک نداری — اول چکش باید به نامت بخورد' }, { status: 400 })
        }
        price = win45.price
        auctionBuy = true
      }
      // فاز ۳۷ — مالکیتِ انحصاری: یک آگهیِ واقعی فقط یک مالکِ بازیکن دارد؛ ادعای اتمیک پیش از خرید.
      const exclusive = config().empire.social?.exclusiveEnabled !== false
      if (exclusive && me0) {
        const claim = await claimListing(it.id, { userId, no: me0.no, name: me0.name })
        if (!claim.ok) return NextResponse.json({ error: `این ملک را «${claim.by?.name}» (#${(claim.by?.no || 0).toLocaleString('fa-IR')}) زودتر خریده — هر آگهیِ واقعی فقط یک مالک دارد. اگر عرضه‌اش کند، در «🏪 بازارِ بازیکنان» می‌بینی‌اش` }, { status: 409 })
      }
      // دفترخانه (فاز ۲۹): ثبتِ سند با حق‌الثبتِ knob — سیستم نقشِ دفترخانه را بازی می‌کند.
      const r = await buyAsset(userId, { id: it.id, title: it.title, hood: hoodOf(it.location), price, ptype: ptypeOf(it) }, { negotiated: negotiatedWin, notaryFeePct: config().empire.pros.notaryFeePct })
      if (!r.ok) {
        // خریدِ ناموفق: ادعای تازه آزاد شود (اگر از قبل مالِ خودش بود، دست نمی‌خورَد)
        if (exclusive && me0 && !me0.assets.some(a => a.listingId === it.id)) await releaseListing(it.id, userId).catch(() => {})
        return NextResponse.json({ error: r.reason }, { status: 400 })
      }
      // جلد ۲۸: رفتارِ بازی = دادهٔ رفتاری برای ML — تعامل با همین آگهیِ واقعی ثبت می‌شود.
      recordEvent({ type: 'user_clicked_property', userId, propertyId: it.id, meta: { src: 'empire_buy' } }).catch(() => {})
      if (auctionBuy) {
        await consumeAuctionWin(userId).catch(() => {})
        await addJournal(userId, `سندِ «${it.title.slice(0, 30)}» بعد از نبردِ تالارِ مزایده به نامت خورد — این معامله داستان دارد.`).catch(() => {})
      }
      return NextResponse.json({ ok: true, ...(await stateOf(userId, r.empire!)) })
    }
    // 🏷 نامِ دلخواهِ دارایی (قانونِ ۱۳ رویاپردازی) — هویتی، صفر اثرِ اقتصادی؛ خالی = پاک‌کردن
    case 'nickname': {
      const r = await setAssetNickname(userId, String(b.assetId || ''), String(b.name || ''))
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, ...(await stateOf(userId, r.empire!)) })
    }

    case 'assetAction': {
      const act = String(b.act || '')
      if (!['renovate', 'rent', 'hold'].includes(act)) return NextResponse.json({ error: 'تصمیمِ نامعتبر' }, { status: 400 })
      // اجاره (فاز ۲۹): از طریقِ مشاورِ املاک — کمیسیون = ٪ knob از یک ماه اجارهٔ میانهٔ واقعیِ محله.
      let fee = 0
      if (act === 'rent') {
        const e0 = await getEmpire(userId)
        const a0 = e0?.assets.find(x => x.id === String(b.assetId || ''))
        if (a0) {
          const monthly = await hoodMonthlyRentOf(a0.hood)
          if (!(monthly > 0)) return NextResponse.json({ error: 'هیچ نمونهٔ اجارهٔ واقعی در بازار نیست — مشاور نمی‌تواند نرخ بدهد؛ بعداً امتحان کن' }, { status: 400 })
          fee = Math.round(monthly * Math.max(0, config().empire.pros.advisorRentCommissionPct) / 100)
        }
      }
      const r = await chooseAssetAction(userId, String(b.assetId || ''), act as any, fee > 0 ? { fee, feeLabel: 'کمیسیونِ اجاره (٪ یک ماه)' } : {})
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      if (act === 'rent' && fee > 0) {
        const viaR = String(b.via || 'advisor') === 'agency' ? 'agency' : 'advisor'
        const aR = r.empire!.assets.find(x => x.id === String(b.assetId || ''))
        await addJournal(userId, `«${(aR?.title || '').slice(0, 30)}» از طریقِ ${proPersonaOf(viaR, String(b.assetId || ''))} اجاره داده شد — کمیسیون ${Math.round(fee / 1e6).toLocaleString('fa-IR')}م تومان`).catch(() => {})
      }
      return NextResponse.json({ ok: true, advisorFee: fee || undefined, ...(await stateOf(userId, r.empire!)) })
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
      // 🎪 رویدادِ زنده (سند ۱۸): سرور خودش پیشرفتِ واقعی را دوباره می‌سنجد — claim فقط با هدفِ کامل
      let evDef: { xp: number; coins: number } | null = null
      if (key.startsWith('ev_')) {
        const le = (await liveEventsOf(userId, e).catch(() => [])).find(x => 'ev_' + x.id === key)
        if (le && le.done) evDef = { xp: le.rewardXp, coins: le.rewardCoins }
      } else if (key.startsWith('sm_')) {
        // پاداشِ نقطهٔ عطفِ استریک (سند ۱۸ بخش ۱): از استریکِ واقعیِ همین دوره
        const stk = await getStreak(userId).catch(() => ({ streak: 0 }))
        const sb = streakMilestonesOf(stk.streak || 0, dayNumberOf(Date.now()), e.claims, config().empire.streakBonus).find(x => x.claimKey === key)
        if (sb && sb.done) evDef = { xp: 0, coins: sb.coins }
      }
      const def = evDef ? evDef
        : key === 'm1_explore' ? (ms.m1.done ? { xp: ms.m1.rewardXp, coins: ms.m1.rewardCoins } : null)
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
      // فاز ۳۹ (سند ۲۶ Part 03+05): ارزش‌گذاریِ کامل (منصفانه/نشان/سناریو از پراکندگیِ واقعی/Confidence از حجمِ داده)
      // + تصمیم‌یارِ «اگر بخری» از وضعیتِ مالیِ واقعیِ خودِ بازیکن. متراژِ جاافتاده → برآوردِ شفاف از متنِ آگهی (فاز ۳۴).
      const iCfg = config().empire.intel
      let valuation = null, decision = null
      if (iCfg.enabled) {
        const fresh = twins.filter(x => (Date.now() - (x.scrapedAt || 0)) < 14 * 864e5).length
        const vArea = area > 0 ? area : areaFromText(it.title)
        valuation = valuationOf(price, vArea, compStatsOf(rates, fresh), iCfg)
        const me = t.empire!
        decision = decisionOf({ capital: me.capital, loanBalance: me.loan?.balance || 0, netWorth: netWorthOf(me, {}).netWorth, dailyBurn: Math.max(0, cashflowOf(me).dailyOut) }, price, iCfg)
      }
      return NextResponse.json({ ok: true, tokensLeft: t.empire!.aiTokens, analysis: { hood, samples: rates.length, avgPerM: Math.round(avg), minePerM: Math.round(mine), diffPct, verdict, valuation, decision } })
    }

    // 🤝 پیش‌فاکتورِ مشاور/آژانس (فیدبکِ مستقیم: «کاربر نمی‌بیند چه هزینه‌ای می‌دهد»):
    // پیش از فروش/اجاره، دو کانالِ واقعیِ محله (مشاورِ املاک و آژانسِ املاک — پرسونای قطعی از هش) با
    // کمیسیونِ «به تومان» نشان داده می‌شود؛ اجاره از میانهٔ اجارهٔ واقعیِ هم‌محله‌ها. بدونِ داده → پیامِ صادقانه.
    case 'agentQuote': {
      const e = await getEmpire(userId)
      const a = e?.assets.find(x => x.id === String(b.assetId || ''))
      if (!e || !a) return NextResponse.json({ error: 'دارایی یافت نشد' }, { status: 404 })
      const kind = String(b.kind || 'sell')
      const pros = config().empire.pros
      const agents = [
        { via: 'advisor', icon: '🧑‍💼', name: proPersonaOf('advisor', a.id) },
        { via: 'agency', icon: '🏢', name: proPersonaOf('agency', a.id) },
      ]
      if (kind === 'rent') {
        const monthly = await hoodMonthlyRentOf(a.hood)
        if (!(monthly > 0)) return NextResponse.json({ error: `در «${a.hood || 'این محله'}» هنوز نمونهٔ اجارهٔ واقعی نداریم — مشاور نمی‌تواند نرخ بدهد؛ بعداً امتحان کن` }, { status: 400 })
        const fee = Math.round(monthly * Math.max(0, pros.advisorRentCommissionPct) / 100)
        return NextResponse.json({ ok: true, kind, agents, monthly, commissionPct: pros.advisorRentCommissionPct, fee, note: `کمیسیون = ${pros.advisorRentCommissionPct.toLocaleString('fa-IR')}٪ از یک ماه اجارهٔ میانهٔ واقعیِ محله` })
      }
      const it = await getItemById(a.listingId).catch(() => null)
      const live = it ? priceOf(it) : 0
      const price = live > 0 ? live : a.buyPrice
      const commission = Math.round(price * Math.max(0, pros.advisorSellCommissionPct) / 100)
      return NextResponse.json({ ok: true, kind, agents, price, priceIsLive: live > 0, commissionPct: pros.advisorSellCommissionPct, commission, net: price - commission })
    }

    // فروش (چرخهٔ عمر — فصل ۵): به قیمتِ روزِ واقعیِ آگهی؛ سود → XP، زیانِ اول → درسِ آموزشی.
    case 'sell': {
      const e = await getEmpire(userId)
      const a = e?.assets.find(x => x.id === String(b.assetId || ''))
      if (!e || !a) return NextResponse.json({ error: 'دارایی یافت نشد' }, { status: 404 })
      const it = await getItemById(a.listingId).catch(() => null)
      // فروش از طریقِ مشاورِ املاک (فاز ۲۹): کمیسیونِ knob از قیمتِ فروش — سیستم نقش را بازی می‌کند.
      const r = await sellAsset(userId, a.id, it ? priceOf(it) : 0, { commissionPct: config().empire.pros.advisorSellCommissionPct })
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      // ردِ شفافِ کانالِ فروش (فیدبکِ کاربر): چه کسی فروخت و چقدر کمیسیون گرفت — در دفترچهٔ امپراتوری.
      const via = String(b.via || 'advisor') === 'agency' ? 'agency' : 'advisor'
      const agentName = proPersonaOf(via, a.id)
      const commission = Math.round((r.salePrice || 0) * Math.max(0, config().empire.pros.advisorSellCommissionPct) / 100)
      await addJournal(userId, `«${a.title.slice(0, 30)}» از طریقِ ${agentName} فروخته شد — کمیسیون ${Math.round(commission / 1e6).toLocaleString('fa-IR')}م تومان`).catch(() => {})
      // فاز ۳۷: فروش به بازار = آزادشدنِ مالکیتِ انحصاری — آگهی دوباره برای بقیه قابلِ‌خرید است.
      await releaseListing(a.listingId, userId).catch(() => {})
      return NextResponse.json({ ok: true, profit: r.profit, salePrice: r.salePrice, agent: agentName, commission, ...(await stateOf(userId, r.empire!)) })
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
      // فاز ۴۷: واژهٔ هم‌صنفیِ هر نوع (BUSINESS_TYPES.q) — «دفتر معماری» با «معماری» شمرده شود نه «دفتر»
      const bizQ = BUSINESS_TYPES.find(t => t.key === biz)?.q || biz.split(/[\s/]/)[0]
      const competitors = dirs.filter(it => it.status !== 'rejected' && (it.location || '').includes(a.hood) && (it.title + ' ' + (it.category || '')).includes(bizQ)).length
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
      const weekNow = Math.floor(dayNumberOf(Date.now()) / 7)
      const rows = empires.map(e => {
        const nw = netWorthOf(e, prices, gMarket)
        // «رشدِ این هفته» (سند ۱۶): دلتا از اسنپ‌شاتِ همین هفتهٔ خودِ بازیکن — بازیکنِ تازه هم شانس دارد
        const weekly = e.weekSnap && e.weekSnap.week === weekNow ? nw.netWorth - e.weekSnap.netWorth : null
        return { name: e.name, title: e.title, persona: e.persona, no: e.no, me: e.userId === userId, assets: e.assets.length, netWorth: nw.netWorth, growth: nw.growth, correct: e.guess.correct, score: empireScoreOf(e, prices), weekly, hoods: e.assets.map(a => a.hood).filter(Boolean), frame: cosmeticIconOf(e, 'frame'), flair: cosmeticIconOf(e, 'flair') }
      })
      const top = (key: 'netWorth' | 'growth' | 'assets' | 'correct' | 'score' | 'weekly', filter?: (r: typeof rows[0]) => boolean) =>
        [...rows].filter(r => (!filter || filter(r)) && r[key] != null).sort((a, x) => ((x[key] as number) || 0) - ((a[key] as number) || 0)).slice(0, 10)
          .map((r, i) => ({ rank: i + 1, name: r.name, title: r.title, persona: r.persona, no: r.no, me: r.me, value: r[key], frame: r.frame, flair: r.flair }))
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
          weekly: top('weekly'),   // دوره‌ای (سند ۱۶): در کنارِ دائمی‌ها — شانسِ بازیکنِ جدید
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
      const stars = e.company ? companyReputationOf(e, config().empire.build.repProjectScore).stars : 0
      const terms = loanTermsFor(credit.score, Math.max(0, nw.netWorth), config().empire.bank, stars > 1 ? { stars, cutPctPerStar: config().empire.reputation.loanRateCutPctPerStar } : undefined)
      const amount = Math.round(Number(b.amount) || 0)
      if (!terms.eligible) return NextResponse.json({ error: 'با این امتیازِ اعتباری فعلاً وام تعلق نمی‌گیرد' }, { status: 400 })
      if (amount <= 0 || amount > terms.maxLoan) return NextResponse.json({ error: `سقفِ وامِ تو ${Math.round(terms.maxLoan / 1e6).toLocaleString('fa-IR')} میلیون تومان است` }, { status: 400 })
      // کارشناسِ رسمی (فاز ۲۹): بانک بدونِ ارزیابی وام نمی‌دهد — هزینه از مبلغِ وام کسر می‌شود.
      const r = await takeLoan(userId, amount, terms.ratePctYear, terms.termDays, { appraisalFee: config().empire.pros.appraisalFee })
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
      const lk = await lockedMsg(userId, config().empire.unlocks.capitalLevel, 'بازارِ سرمایه')
      if (lk) return NextResponse.json({ error: lk }, { status: 403 })
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
      const lk = await lockedMsg(userId, config().empire.unlocks.crowdLevel, 'سرمایه‌گذاریِ جمعی')
      if (lk) return NextResponse.json({ error: lk }, { status: 403 })
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

    // ══════ شرکتِ ساختمانی (جلد ۶۱) + پروانه (جلد ۶۳): «از یک اتاقِ کوچک تا امپراتوری» ══════
    case 'company': {
      const cfg = config().empire.company
      if (!cfg.enabled) return NextResponse.json({ error: 'ثبتِ شرکت فعلاً فعال نیست' }, { status: 403 })
      const lk = await lockedMsg(userId, config().empire.unlocks.companyLevel, 'ثبتِ شرکتِ ساختمانی')
      if (lk) return NextResponse.json({ error: lk }, { status: 403 })
      const r = await foundCompany(userId, { name: String(b.name || ''), kind: String(b.kind || ''), color: String(b.color || '') }, cfg.regFee)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, ...(await stateOf(userId, r.empire!)) })
    }
    // ۳ نامزدِ استخدامِ این هفته (قطعی از هش — «رزومه، حقوق، شخصیت»)؛ استخدام‌شده‌ها حذف می‌شوند.
    case 'hireList': {
      const e = await getEmpire(userId)
      if (!e?.company) return NextResponse.json({ error: 'اول شرکتت را ثبت کن' }, { status: 400 })
      const week = Math.floor(dayNumberOf(Date.now()) / 7)
      const hired = new Set(e.company.engineers.map(x => x.id))
      // کارتِ استخدام با اثرِ عددیِ مشخص (GDD فصل ۴ بخش ۳) — هر سطر یک اثرِ واقعیِ موتور است
      const cands = hireCandidatesOf(userId, week, config().empire.company.engineerSalaryBase)
        .filter(c => !hired.has(c.id))
        .map(c => ({ ...c, effects: engineerEffectsOf(c.skill, config().empire.build.eventSkillCutPct, config().empire.company.permit.engineerSpeedupDays) }))
      return NextResponse.json({ ok: true, candidates: cands, maxEngineers: config().empire.company.maxEngineers, team: e.company.engineers.length })
    }
    case 'hire': {
      const e = await getEmpire(userId)
      if (!e?.company) return NextResponse.json({ error: 'اول شرکتت را ثبت کن' }, { status: 400 })
      const week = Math.floor(dayNumberOf(Date.now()) / 7)
      const cand = hireCandidatesOf(userId, week, config().empire.company.engineerSalaryBase).find(c => c.id === String(b.candId || ''))
      if (!cand) return NextResponse.json({ error: 'این نامزد دیگر در دسترس نیست — نامزدهای هفتهٔ جدید را ببین' }, { status: 404 })
      const r = await hireEngineer(userId, cand, config().empire.company.maxEngineers)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, ...(await stateOf(userId, r.empire!)) })
    }
    // ══════ طراحیِ معمار (فاز ۲۹): پیش از پروانه — طبقات/واحد با تراکمِ قانونی؛ مازاد = تخلفِ آگاهانه ══════
    // محدوده‌های قانونیِ نقشه برای این زمین (برای فرمِ UI)
    case 'designPlan': {
      const dc = config().empire.design
      if (!dc.enabled) return NextResponse.json({ error: 'طراحی فعلاً فعال نیست' }, { status: 403 })
      const e = await getEmpire(userId)
      const a = e?.assets.find(x => x.id === String(b.assetId || ''))
      if (!e || !a) return NextResponse.json({ error: 'دارایی یافت نشد' }, { status: 404 })
      const it = await getItemById(a.listingId).catch(() => null)
      const la = await landAreaWithEstimate(a, it)
      if (!(la.area > 0)) return NextResponse.json({ error: 'متراژِ این زمین نه در آگهی هست، نه از متن/قیمتش قابل‌برآورد بود' }, { status: 400 })
      const landArea = la.area
      // ضابطهٔ واقعی (فیدبکِ کاربر): طبقاتِ مجاز پلکانی با متراژ + تعدیل از عرفِ واقعیِ ساختِ همین محله.
      const hoodNorm = await hoodFloorsNorm(a.hood)
      const lf = legalFloorsOf(landArea, hoodNorm, dc)
      const probe = designPlanOf(landArea, 1, 1, { ...dc, buildFactor: config().empire.build.buildFactor }, lf.floors)
      if (!probe.ok) return NextResponse.json({ error: probe.reason }, { status: 400 })
      const ruleNote = `ضابطه: اشغال ${dc.occupancyPct.toLocaleString('fa-IR')}٪ زمین · زمینِ ${landArea.toLocaleString('fa-IR')} متری → ${lf.areaFloors.toLocaleString('fa-IR')} طبقهٔ مجاز${lf.hoodApplied ? ` · عرفِ ساختِ ${a.hood || 'محله'} (میانهٔ ${hoodNorm!.toLocaleString('fa-IR')} طبقه از آگهی‌های واقعی) → ${lf.floors.toLocaleString('fa-IR')} طبقه` : ''} · هر واحد یک پارکینگ`
      return NextResponse.json({
        ok: true, landArea, areaNote: la.note, occupancyPct: dc.occupancyPct, footprint: probe.footprint,
        legalFloors: probe.legalFloors, maxFloors: probe.maxFloors, minUnitArea: dc.minUnitArea,
        maxUnitsPerFloor: Math.max(1, Math.floor(probe.footprint / Math.max(1, dc.minUnitArea))),
        parkingCap: probe.parkingCap, ruleNote, hoodFloors: hoodNorm, areaFloors: lf.areaFloors,
        designDays: dc.designDays, architectFeePct: dc.architectFeePct, costPerM: config().empire.build.costPerM,
        finePerM2: Math.round(config().empire.build.costPerM * config().empire.m100.finePerM2Mult),
        architect: proPersonaOf('architect', a.id),
      })
    }
    // قراردادِ طراحی: انتخابِ طبقات/واحد → حق‌الزحمهٔ معمار → طراحی چند روز طول می‌کشد
    case 'designStart': {
      const dc = config().empire.design
      if (!dc.enabled) return NextResponse.json({ error: 'طراحی فعلاً فعال نیست' }, { status: 403 })
      const e = await getEmpire(userId)
      const a = e?.assets.find(x => x.id === String(b.assetId || ''))
      if (!e || !a) return NextResponse.json({ error: 'دارایی یافت نشد' }, { status: 404 })
      const it = await getItemById(a.listingId).catch(() => null)
      const landArea = (await landAreaWithEstimate(a, it)).area
      // همان ضابطه‌ای که در پیش‌نمایش دیده (متراژ + عرفِ محله) — تا عددِ قرارداد با عددِ نمایش یکی باشد.
      const lfS = legalFloorsOf(landArea, await hoodFloorsNorm(a.hood), dc)
      const d = designPlanOf(landArea, Math.round(Number(b.floors) || 0), Math.round(Number(b.unitsPerFloor) || 0), { ...dc, buildFactor: config().empire.build.buildFactor }, lfS.floors)
      if (!d.ok) return NextResponse.json({ error: d.reason }, { status: 400 })
      const fee = Math.max(1, Math.round(d.builtArea * config().empire.build.costPerM * Math.max(0, dc.architectFeePct) / 100))
      // متراژِ زمین داخلِ خودِ نقشه ذخیره می‌شود — کلنگ دیگر به زنده‌ماندنِ آگهیِ واقعی وابسته نیست
      const r = await commissionDesign(userId, a.id, { floors: Math.round(Number(b.floors)), unitsPerFloor: Math.round(Number(b.unitsPerFloor)), legalFloors: d.legalFloors, footprint: d.footprint, unitArea: d.unitArea, illegalFloors: d.illegalFloors, fee, days: dc.designDays, landArea })
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, fee, illegalFloors: d.illegalFloors, ...(await stateOf(userId, r.empire!)) })
    }
    // ⚡ جلسهٔ فشرده با معمار — کوین انتظارِ طراحی را کوتاه می‌کند (همان نرخِ پیگیریِ پروانه)
    case 'designBoost': {
      const sp = config().empire.speed
      if (!sp.enabled) return NextResponse.json({ error: 'تسریع فعلاً فعال نیست' }, { status: 403 })
      const r = await boostDesign(userId, String(b.assetId || ''), Math.max(1, Math.min(30, Number(b.days) || 1)), sp.permitCoinsPerDay)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, cut: r.cut, ...(await stateOf(userId, r.empire!)) })
    }
    // ⚖️ کمیسیونِ ماده۱۰۰: جریمه → شهرداری (خزانه) / وکیل (یک‌بار، قطعی از هش) / تخریبِ طبقاتِ مازاد
    case 'm100': {
      const choice = String(b.choice || '')
      if (!['pay', 'lawyer', 'demolish'].includes(choice)) return NextResponse.json({ error: 'انتخابِ نامعتبر' }, { status: 400 })
      const e = await getEmpire(userId)
      const a = e?.assets.find(x => x.id === String(b.assetId || ''))
      if (!e || !a?.m100) return NextResponse.json({ error: 'پروندهٔ ماده۱۰۰ باز نیست' }, { status: 404 })
      const pc = config().empire.pros
      const r = await resolveM100(userId, a.id, choice as any, {
        lawyerFee: Math.max(1, Math.round(a.m100.fine * Math.max(0, pc.lawyerFeePct) / 100)),
        lawyerCutPct: pc.lawyerCutPct, lawyerWinChancePct: pc.lawyerWinChancePct,
        demolishCost: Math.max(1, Math.round(a.m100.illegalArea * config().empire.build.costPerM * 0.1)),   // تخریب ~۱۰٪ هزینهٔ ساختِ همان متراژ
      })
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, lawyerWon: r.lawyerWon, ...(await stateOf(userId, r.empire!)) })
    }
    // 🛠 بازسازیِ واقعی: گزینه‌های knob — هزینهٔ الان (به بهای تمام‌شده)، ارزش‌افزودهٔ شفاف
    case 'renovate': {
      const rc = config().empire.renovation
      if (!rc.enabled) return NextResponse.json({ error: 'بازسازی فعلاً فعال نیست' }, { status: 403 })
      const opt = rc.options[String(b.option || '')]
      if (!opt) return NextResponse.json({ error: 'گزینهٔ نامعتبر' }, { status: 400 })
      const e = await getEmpire(userId)
      const a = e?.assets.find(x => x.id === String(b.assetId || ''))
      if (!e || !a) return NextResponse.json({ error: 'دارایی یافت نشد' }, { status: 404 })
      const it = await getItemById(a.listingId).catch(() => null)
      const cur = ((it ? priceOf(it) : 0) || Math.round(a.buyPrice / (a.unitsOwned || 1))) * (a.unitsOwned || 1)
      const cost = Math.max(1, Math.round(cur * Math.max(0, opt.costPct) / 100))
      const r = await renovateAsset(userId, a.id, String(b.option), { cost, valuePct: opt.valuePct, maxBoostPct: rc.maxBoostPct })
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, cost, ...(await stateOf(userId, r.empire!)) })
    }

    // درخواستِ پروانه (جلد ۶۳): مهلت/عوارض/اعتراض قطعی از هش؛ عوارض → خزانه.
    case 'permit': {
      const e = await getEmpire(userId)
      const a = e?.assets.find(x => x.id === String(b.assetId || ''))
      if (!e || !a) return NextResponse.json({ error: 'دارایی یافت نشد' }, { status: 404 })
      const it = await getItemById(a.listingId).catch(() => null)
      // تخریب‌شده (فاز ۲۵): قیمتِ آگهیِ واحدِ قدیمی دیگر ارزشِ زمین نیست — بهای تمام‌شدهٔ کلِ ساختمان مبناست.
      const landValue = a.demolishedAt ? a.buyPrice : (it ? priceOf(it) : a.buyPrice)
      const terms = permitTermsOf(userId, a.id, config().empire.company.permit, teamSkillOf(e), landValue > 0 ? landValue : a.buyPrice)
      // فاز ۲۹: پروانه روی نقشهٔ معمار صادر می‌شود — بدونِ طراحیِ آماده، درخواست رد می‌شود.
      const r = await requestPermit(userId, a.id, terms, { requireDesign: config().empire.design.enabled })
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, terms, ...(await stateOf(userId, r.empire!)) })
    }
    case 'permitSettle': {
      const r = await settleObjection(userId, String(b.assetId || ''))
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, ...(await stateOf(userId, r.empire!)) })
    }
    // دفاع در کمیسیون (فیدبک: «دفاع قابلِ کلیک نیست») — انتخابِ رایگانِ صبر به‌جای غرامت؛ راهِ توافق بسته می‌شود.
    case 'permitDefend': {
      const r = await defendObjection(userId, String(b.assetId || ''))
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, ...(await stateOf(userId, r.empire!)) })
    }

    // ══════ زمان‌خری (فاز ۲۷ — قانون ۵ «پرداخت فقط برای سرعت»): کوین انتظار را کوتاه می‌کند، نه نتیجه را ══════
    case 'permitBoost': {
      const sp = config().empire.speed
      if (!sp.enabled) return NextResponse.json({ error: 'تسریع فعلاً فعال نیست' }, { status: 403 })
      const r = await boostPermit(userId, String(b.assetId || ''), Math.max(1, Math.min(30, Number(b.days) || 1)), sp.permitCoinsPerDay)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, cut: r.cut, ...(await stateOf(userId, r.empire!)) })
    }
    case 'buildBoost': {
      const sp = config().empire.speed
      if (!sp.enabled) return NextResponse.json({ error: 'تسریع فعلاً فعال نیست' }, { status: 403 })
      const r = await boostBuild(userId, String(b.assetId || ''), Math.max(1, Math.min(30, Number(b.days) || 1)), sp.buildCoinsPerDay)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, advanced: r.advanced, ...(await stateOf(userId, r.empire!)) })
    }

    // ══════ تجمیع و تخریب (فاز ۲۵): «۶ واحدی؟ تک‌تک بخر؛ تا همه مالِ تو نشد، تخریب نه» ══════
    // خریدِ واحدِ بعدیِ همان ساختمان — قیمتِ روزِ واقعیِ آگهی + پرمیومِ تجمیع؛ مالکِ هر واحد شخصیتِ خودش را دارد.
    case 'buyUnit': {
      const asm = config().empire.assembly
      if (!asm.enabled) return NextResponse.json({ error: 'تجمیع فعلاً فعال نیست' }, { status: 403 })
      const e = await getEmpire(userId)
      const a = e?.assets.find(x => x.id === String(b.assetId || ''))
      if (!e || !a) return NextResponse.json({ error: 'دارایی یافت نشد' }, { status: 404 })
      const it = await getItemById(a.listingId).catch(() => null)
      const owned = a.unitsOwned || 1
      const unitP = (it ? priceOf(it) : 0) || Math.round(a.buyPrice / owned)
      const total = a.unitsTotal || buildingUnitsOf(a.listingId, it?.meta, asm.unitsMin, asm.unitsMax)
      let price = assemblyUnitPriceOf(unitP, asm.extraUnitPremiumPct)
      if (b.negotiated) {
        // همان کلیدِ قطعیِ اکشنِ «مذاکره» با unit — تخفیفی که کاربر دیده، سرِ خرید هم همان است.
        const negoKey = `${a.listingId}#u${owned + 1}`
        const out = negotiationOutcome(userId, negoKey, negoSkillOf(e, ownerPersonaOf(negoKey).mod).skill)
        if (out.success) price = Math.round(price * (1 - out.discountPct / 100))
      }
      const r = await buyBuildingUnit(userId, a.id, { price, taxPct: config().empire.transferTaxPct, total })
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      recordEvent({ type: 'user_clicked_property', userId, propertyId: a.listingId, meta: { src: 'empire_assembly' } }).catch(() => {})
      return NextResponse.json({ ok: true, ...(await stateOf(userId, r.empire!)) })
    }
    // تخریب: آپارتمان/تجاری فقط با مالکیتِ کاملِ واحدها؛ ویلایی مستقیم. هزینه = ٪ ارزشِ روز — مصرفِ شفافِ پول.
    case 'demolish': {
      const asm = config().empire.assembly
      if (!asm.enabled) return NextResponse.json({ error: 'تخریب فعلاً فعال نیست' }, { status: 403 })
      const e = await getEmpire(userId)
      const a = e?.assets.find(x => x.id === String(b.assetId || ''))
      if (!e || !a) return NextResponse.json({ error: 'دارایی یافت نشد' }, { status: 404 })
      const it = await getItemById(a.listingId).catch(() => null)
      const owned = a.unitsOwned || 1
      const unitP = (it ? priceOf(it) : 0) || Math.round(a.buyPrice / owned)
      const cur = unitP * owned
      const cost = Math.max(1, Math.round(cur * asm.demolishCostPct / 100))
      // متراژِ واحد: متایِ آگهی → متنِ آگهی → قیمتِ واحد ÷ متریِ محله (بن‌بست ممنوع — برآوردِ شفاف از دادهٔ واقعی)
      let area = (it ? (parseFaNum((it.meta || {})['متراژ']) || 0) : 0) || areaFromText(it?.title, a.title)
      if (!(area > 0)) {
        let { perM } = await hoodPerM(a.hood)
        if (!(perM > 0)) ({ perM } = await hoodPerM(''))
        if (perM > 0 && unitP > 0) area = Math.max(30, Math.round(unitP / perM))
      }
      const total = a.unitsTotal || owned
      // برآوردِ زمین: ویلایی = متراژِ آگهی (عرصه)؛ ساختمان = کلِ بنا ÷ تراکمِ knob — شفاف در UI اعلام می‌شود.
      const landArea = a.kind === 'villa' ? area : Math.round(area * total / Math.max(1, config().empire.build.buildFactor))
      if (!(landArea > 0)) return NextResponse.json({ error: 'متراژِ این ملک نه در آگهی هست، نه از متن/قیمتش قابل‌برآورد بود — تخریب فعلاً ممکن نیست' }, { status: 400 })
      const r = await demolishAsset(userId, a.id, { cost, landArea })
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, ...(await stateOf(userId, r.empire!)) })
    }

    // ══════ موتورِ ساخت (جلد ۶۴–۷۲): کلنگ → هزینهٔ روزشمار → رویداد → پیش‌فروش → تکمیل → فروشِ واحد ══════
    // پیش‌نمایشِ نقشهٔ ساخت: همهٔ ترکیب‌های سازه/کیفیت با روز و هزینهٔ شفاف.
    case 'buildPlan': {
      const cfg = config().empire.build
      if (!cfg.enabled) return NextResponse.json({ error: 'ساخت فعلاً فعال نیست' }, { status: 403 })
      const e = await getEmpire(userId)
      const a = e?.assets.find(x => x.id === String(b.assetId || ''))
      if (!e || !a) return NextResponse.json({ error: 'دارایی یافت نشد' }, { status: 404 })
      if (a.permit?.status !== 'granted') return NextResponse.json({ error: 'اول پروانهٔ ساخت را بگیر' }, { status: 400 })
      const it = await getItemById(a.listingId).catch(() => null)
      // زمینِ حاصل از تخریب (فاز ۲۵): مساحتِ برآوردیِ خودش؛ نقشهٔ امضاشده هم متراژِ خودش را دارد
      const landArea = a.design?.landArea || (await landAreaWithEstimate(a, it)).area
      if (!a.design && !(landArea > 0)) return NextResponse.json({ error: 'متراژِ این زمین نه در آگهی هست، نه از متن/قیمتش قابل‌برآورد بود' }, { status: 400 })
      // فاز ۲۹: اگر نقشهٔ معمار هست، ابعاد از انتخابِ خودِ بازیکن می‌آید (طبقات × واحد در طبقه)
      const mkPlan = (sk: string, qk: string) => a.design ? designBuildPlanOf(sk, qk, landArea, a.design, cfg) : buildPlanOf(sk, qk, landArea, cfg)
      const options: any[] = []
      for (const [sk, s] of Object.entries(BUILD_STRUCTURES)) for (const [qk, q] of Object.entries(BUILD_QUALITIES)) {
        const p = mkPlan(sk, qk)
        if (p) options.push({ structure: sk, structureLabel: s.label, quality: qk, qualityLabel: q.label, days: p.days, costTotal: p.costTotal, qualityFactor: p.qualityFactor, contractor: proPersonaOf('contractor', a.id + sk) })
      }
      const base = mkPlan('concrete', 'standard')!
      // هدفِ پروژه (GDD فصل ۴ بخش ۸): تصمیمِ استراتژیکِ سرِ کلنگ — اثرِ هر گزینه شفاف اعلام می‌شود
      const goals = Object.entries(PROJECT_GOALS).map(([k, g]) => ({ key: k, ...g, pricePct: goalPricePct(k, cfg), presaleBonusPp: k === 'fast' ? cfg.goalFastPresaleBonusPp : 0 }))
      // قانونِ ۱۳ (رویاپردازی): برآوردِ «رؤیا» از دادهٔ واقعی — فروشِ کلِ برآوردی و سودِ برآوردیِ هر گزینه
      // از میانهٔ متریِ واقعیِ محله (بدونِ نمونهٔ کافی → بدونِ عدد، نه عددِ ساختگی) + نام و نمای انتخابی.
      let { perM: dreamPerM, samples: dreamN } = await hoodPerM(a.hood)
      if (!(dreamPerM > 0)) ({ perM: dreamPerM, samples: dreamN } = await hoodPerM(''))
      const illegal43 = a.design ? Math.max(0, a.design.illegalFloors * a.design.unitsPerFloor) : 0
      for (const o of options) {
        const pl = mkPlan(o.structure, o.quality)
        if (dreamPerM > 0 && pl) {
          const sellable = Math.max(0, pl.totalUnits - illegal43)
          const estSale = Math.round(dreamPerM * pl.unitArea * pl.qualityFactor) * sellable
          o.estSale = estSale
          o.estProfit = estSale - pl.costTotal
        }
      }
      return NextResponse.json({
        ok: true, landArea, builtArea: base.builtArea, unitArea: base.unitArea, totalUnits: base.totalUnits, options, goals,
        facades: BUILD_FACADES, suggestedName: `برجِ ${e.name}`.slice(0, 28), hood: a.hood,
        estNote: dreamPerM > 0 ? `برآورد از میانهٔ متریِ واقعیِ ${dreamN.toLocaleString('fa-IR')} آگهی — قولِ قطعی نیست` : 'برای برآوردِ فروش هنوز نمونهٔ قیمتیِ کافی در بازار نداریم',
      })
    }
    case 'startBuild': {
      const cfg = config().empire.build
      if (!cfg.enabled) return NextResponse.json({ error: 'ساخت فعلاً فعال نیست' }, { status: 403 })
      const e = await getEmpire(userId)
      const a = e?.assets.find(x => x.id === String(b.assetId || ''))
      if (!e || !a) return NextResponse.json({ error: 'دارایی یافت نشد' }, { status: 404 })
      // ظرفیتِ پروژهٔ همزمان (سند ۱۵ — فصل ۵ «منابع»): ظرفیت هم یک دارایی است و با سطح رشد می‌کند
      const active = e.assets.filter(x => x.construction && !x.construction.done).length
      const maxP = maxProjectsOf(empireLevel(e.xp).level, config().empire.unlocks)
      if (active >= maxP) return NextResponse.json({ error: `ظرفیتِ شرکتت ${maxP.toLocaleString('fa-IR')} پروژهٔ همزمان است — پروژه‌ای را تحویل بده یا با سطحِ بالاتر ظرفیت بگیر` }, { status: 400 })
      const it = await getItemById(a.listingId).catch(() => null)
      // نقشهٔ امضاشده خودکفاست — اگر آگهیِ زمین از استخر افتاده باشد، متراژ از خودِ نقشه می‌آید
      const landArea = a.design?.landArea || (await landAreaWithEstimate(a, it)).area
      const plan = a.design
        ? designBuildPlanOf(String(b.structure || ''), String(b.quality || ''), landArea, a.design, cfg)
        : buildPlanOf(String(b.structure || ''), String(b.quality || ''), landArea, cfg)
      if (!plan) return NextResponse.json({ error: 'سازه/کیفیتِ نامعتبر یا متراژِ نامشخص' }, { status: 400 })
      const r = await startBuild(userId, a.id, plan, { structure: String(b.structure), quality: String(b.quality), goal: String(b.goal || ''), name: String(b.name || ''), facade: String(b.facade || '') })
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, ...(await stateOf(userId, r.empire!)) })
    }
    case 'buildEvent': {
      const choice = String(b.choice || '')
      if (!['pay', 'wait'].includes(choice)) return NextResponse.json({ error: 'انتخابِ نامعتبر' }, { status: 400 })
      const r = await resolveBuildEvent(userId, String(b.assetId || ''), choice as 'pay' | 'wait')
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, ...(await stateOf(userId, r.empire!)) })
    }
    // پیش‌فروش (جلد ۷۱): قیمت = میانهٔ متریِ واقعیِ محله × متراژِ واحد × کیفیت − تخفیفِ شفاف.
    case 'presell': {
      const cfg = config().empire.build
      const e = await getEmpire(userId)
      const a = e?.assets.find(x => x.id === String(b.assetId || ''))
      if (!e || !a?.construction) return NextResponse.json({ error: 'ساختی در جریان نیست' }, { status: 404 })
      const { perM, samples } = await hoodPerM(a.hood)
      if (!samples || !(perM > 0)) return NextResponse.json({ error: `برای قیمت‌گذاری در «${a.hood || 'این محله'}» نمونهٔ واقعیِ کافی نیست` }, { status: 400 })
      const c = a.construction
      // قیمت = میانهٔ واقعی × کیفیت × امکانات × هدفِ پروژه − تخفیفِ پیش‌فروش؛ هدفِ «فروشِ سریع» سقفِ پیش‌فروش را بالا می‌برد
      const unitPrice = Math.round(perM * c.unitArea * c.qualityFactor * amenityValueFactorOf(c, cfg.amenities) * (goalPricePct(c.goal, cfg) / 100) * (1 - cfg.presaleDiscountPct / 100))
      const maxPct = Math.min(90, cfg.presaleMaxPct + (c.goal === 'fast' ? Math.max(0, cfg.goalFastPresaleBonusPp) : 0))
      const r = await presellUnits(userId, a.id, Math.floor(Number(b.units) || 0), unitPrice, cfg.presaleMinPct, maxPct)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      // فاز ۳۷ — پروژهٔ مشترک: سهمِ شرکا از همین عایدی خودکار تسویه می‌شود (اتمیک، با تایم‌لاینِ دو طرف)
      const shares = a.partners?.length ? await settlePartnerShares(userId, a.partners, r.revenue || 0, 'پیش‌فروش').catch(() => []) : []
      const eF = shares.length ? await getEmpire(userId) : r.empire!
      return NextResponse.json({ ok: true, revenue: r.revenue, unitPrice, samples, shares: shares.length ? shares : undefined, ...(await stateOf(userId, eF!)) })
    }
    // فروشِ واحد بعد از تکمیل (جلد ۷۲): قیمتِ کامل از میانهٔ متریِ واقعیِ همان لحظهٔ محله.
    case 'sellUnit': {
      const cfg = config().empire.build
      const e = await getEmpire(userId)
      const a = e?.assets.find(x => x.id === String(b.assetId || ''))
      if (!e || !a?.construction) return NextResponse.json({ error: 'پروژه‌ای یافت نشد' }, { status: 404 })
      const { perM, samples } = await hoodPerM(a.hood)
      if (!samples || !(perM > 0)) return NextResponse.json({ error: `برای قیمت‌گذاری در «${a.hood || 'این محله'}» نمونهٔ واقعیِ کافی نیست` }, { status: 400 })
      const c = a.construction
      const units = Math.floor(Number(b.units) || 0)
      const unitPrice = Math.round(perM * c.unitArea * c.qualityFactor * amenityValueFactorOf(c, cfg.amenities) * (goalPricePct(c.goal, cfg) / 100))
      // اشباعِ عرضهٔ خودِ بازیکن (GDD فصل ۴ بخش ۵): فروشِ یکجای زیاد → هر واحدِ اضافه کمی ارزان‌تر — تصمیمِ سرعت/سود
      const bulk = bulkPriceOf(unitPrice, units, cfg.bulkFreeUnits, cfg.bulkStepPct)
      const r = await sellUnits(userId, a.id, units, bulk.avgUnit > 0 ? bulk.avgUnit : unitPrice, config().empire.transferTaxPct)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      const shares = a.partners?.length ? await settlePartnerShares(userId, a.partners, r.proceeds || 0, 'فروشِ واحدها').catch(() => []) : []
      const eF = shares.length ? await getEmpire(userId) : r.empire!
      return NextResponse.json({ ok: true, proceeds: r.proceeds, pnl: r.pnl, completed: r.completed, unitPrice, bulkDiscounted: bulk.discounted, samples, shares: shares.length ? shares : undefined, ...(await stateOf(userId, eF!)) })
    }
    // فروشِ پروژهٔ نیمه‌کاره (سند ۱۵ — فصل ۵ «پروژهٔ در حالِ ساخت هم دارایی است»): خروج به ٪ شفافِ بهای تمام‌شده.
    case 'sellProject': {
      const e0 = await getEmpire(userId)
      const a0 = e0?.assets.find(x => x.id === String(b.assetId || ''))
      const r = await sellProject(userId, String(b.assetId || ''), config().empire.unlocks.projectExitPct, config().empire.transferTaxPct)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      // فاز ۳۷: سهمِ شرکای پروژه از عایدیِ خروج + آزادشدنِ مالکیتِ انحصاریِ آگهی
      const shares = a0?.partners?.length ? await settlePartnerShares(userId, a0.partners, r.proceeds || 0, 'فروشِ پروژه').catch(() => []) : []
      if (a0) await releaseListing(a0.listingId, userId).catch(() => {})
      const eF = shares.length ? await getEmpire(userId) : r.empire!
      return NextResponse.json({ ok: true, proceeds: r.proceeds, pnl: r.pnl, shares: shares.length ? shares : undefined, ...(await stateOf(userId, eF!)) })
    }
    // امکاناتِ میان‌ساخت (GDD فصل ۴ بخش ۴): هزینه = ٪ شفافی از هزینهٔ کلِ پروژه؛ ارزشِ فروش/اجاره بالاتر می‌رود.
    case 'amenity': {
      const cfg = config().empire.build
      const e = await getEmpire(userId)
      const a = e?.assets.find(x => x.id === String(b.assetId || ''))
      if (!e || !a?.construction) return NextResponse.json({ error: 'ساختی در جریان نیست' }, { status: 404 })
      const am = cfg.amenities[String(b.key || '')]
      if (!am) return NextResponse.json({ error: 'امکاناتِ نامعتبر' }, { status: 400 })
      const cost = Math.max(1, Math.round(a.construction.costTotal * am.costPct / 100))
      const r = await addAmenity(userId, a.id, String(b.key), cost)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, cost, ...(await stateOf(userId, r.empire!)) })
    }
    // «بفروش یا نگه‌دار و اجاره بده» (GDD فصل ۴ بخش ۴) — درآمدِ اجاره از میانهٔ واقعیِ هم‌محله واریز می‌شود.
    case 'rentUnits': {
      const r = await rentOutUnits(userId, String(b.assetId || ''), Math.floor(Number(b.units) || 0))
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, ...(await stateOf(userId, r.empire!)) })
    }
    case 'stopRent': {
      const r = await stopRentUnits(userId, String(b.assetId || ''), Math.floor(Number(b.units) || 0))
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, ...(await stateOf(userId, r.empire!)) })
    }

    // فرصت‌های طلاییِ امروز (سند ۱۴ — Hook): آگهی‌های واقعی، انتخابِ قطعی از هشِ کاربر+روز، شمارشِ معکوسِ واقعی.
    // بعضی واقعاً زیرِ میانهٔ محله‌اند، بعضی نه — کارت قضاوت نمی‌کند؛ فکرکردن یا ژتونِ تحلیل کارِ بازیکن است.
    case 'deals': {
      const cfg = config().empire.deals
      if (!cfg.enabled) return NextResponse.json({ error: 'فرصت‌های روزانه فعلاً فعال نیست' }, { status: 403 })
      const e = await getEmpire(userId)
      if (!e) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      const items = await candidateListings(800).catch(() => [] as Item[])
      const owned = new Set(e.assets.map(a => a.listingId))
      const pool = items.filter(it => isPricedSale(it) && !owned.has(it.id) && (parseFaNum((it.meta || {})['متراژ']) || 0) > 0 && priceOf(it) >= MIN_SALE)
      const day = dayNumberOf(Date.now())
      const expiresAt = (day + 1) * 864e5   // همان مرزِ روزِ صندوقچه/کوئست — فردا فرصت‌های دیگری می‌آیند
      if (!pool.length) return NextResponse.json({ ok: true, deals: [], expiresAt })
      // فاز ۴۱ (سند ۲۸ Part 10 «Rare Level»): میانهٔ متریِ هر محله از همین آگهی‌های واقعی — برچسبِ کمیابیِ صادقانه.
      const hoodRates = new Map<string, number[]>()
      for (const it of items) {
        if (!isPricedSale(it)) continue
        const a2 = parseFaNum((it.meta || {})['متراژ']) || 0
        if (!(a2 > 0)) continue
        const h2 = hoodOf(it.location)
        if (!h2) continue
        if (!hoodRates.has(h2)) hoodRates.set(h2, [])
        hoodRates.get(h2)!.push(priceOf(it) / a2)
      }
      const medOf = (rs: number[]) => { const s = [...rs].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
      const byId = new Map(pool.map(it => [it.id, it] as const))
      const deals = dailyDealPickOf(userId, day, pool.map(it => it.id), cfg.count).map(id => {
        const it = byId.get(id)!
        const area = parseFaNum((it.meta || {})['متراژ']) || 0
        const price = priceOf(it)
        const perM = area > 0 ? Math.round(price / area) : 0
        const rates = hoodRates.get(hoodOf(it.location)) || []
        const rarity = rarityOf(perM, rates.length ? medOf(rates) : 0, rates.length, config().empire.intel.minComps)
        return { id, title: it.title, hood: hoodOf(it.location), price, area, perM, rarity, lat: Number(it.meta?.['__lat']) || undefined, lng: Number(it.meta?.['__lng']) || undefined, url: listingHref(id, it.title, hoodOf(it.location)) }
      })
      return NextResponse.json({ ok: true, deals, expiresAt })
    }

    // 🔥 معاملهٔ بزرگِ هفته (فاز ۴۱ — سند ۲۸ فصل ۱۷ Part 07 «Big Deals»): یک ملکِ واقعی از سگمنتِ گرانِ بازار،
    // برای «همه» یکی است (انتخابِ قطعیِ شهری از هشِ هفته) — رقابتِ واقعی: اولین برندهٔ مذاکره که بخرد، مالک می‌شود.
    case 'bigDeal': {
      const cfg = config().empire.bigDeal
      if (!cfg.enabled) return NextResponse.json({ error: 'معاملهٔ بزرگ فعلاً فعال نیست' }, { status: 403 })
      const e = await getEmpire(userId)
      if (!e) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      const week = Math.floor(dayNumberOf(Date.now()) / 7)
      const items = await candidateListings(800).catch(() => [] as Item[])
      const pickId = bigDealPickOf(week, items.filter(isPricedSale).map(it => ({ id: it.id, price: priceOf(it) })), cfg.topPct)
      const it = pickId ? items.find(x => x.id === pickId) : null
      if (!it) return NextResponse.json({ ok: true, deal: null, note: 'این هفته آگهیِ قیمت‌دارِ کافی برای انتخابِ معاملهٔ بزرگ نداریم' })
      const owner = await ownerOfListing(it.id).catch(() => null)
      const persona = ownerPersonaOf(it.id)
      const tried = !!e.claims[`bd_${week}`]
      const wonPct = e.bigDealWin?.week === week ? e.bigDealWin.discountPct : 0
      const unlocked = empireLevel(e.xp).level >= cfg.level
      return NextResponse.json({
        ok: true,
        deal: {
          id: it.id, title: it.title, hood: hoodOf(it.location), price: priceOf(it),
          url: listingHref(it.id, it.title, hoodOf(it.location)),
          owner: { name: persona.name, type: persona.type, desc: persona.desc },
          expiresAt: (week + 1) * 7 * 864e5,
          soldTo: owner && owner.userId !== userId ? { name: owner.name, no: owner.no } : null,
          mine: !!(owner && owner.userId === userId),
        },
        unlocked, need: cfg.level,
        tried, wonPct, strategies: BIG_DEAL_STRATEGIES,
      })
    }
    // مذاکرهٔ معاملهٔ بزرگ: یک تلاش در هفته؛ استراتژی (شانس↔تخفیف) دستِ بازیکن؛ نتیجه قطعی از هش + تیپِ مالک + مهارت.
    case 'bigDealNego': {
      const cfg = config().empire.bigDeal
      if (!cfg.enabled) return NextResponse.json({ error: 'معاملهٔ بزرگ فعلاً فعال نیست' }, { status: 403 })
      const e = await getEmpire(userId)
      if (!e) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      const gate = await lockedMsg(userId, cfg.level, 'معاملهٔ بزرگ')
      if (gate) return NextResponse.json({ error: gate }, { status: 403 })
      const week = Math.floor(dayNumberOf(Date.now()) / 7)
      if (e.claims[`bd_${week}`]) return NextResponse.json({ error: 'این هفته تلاشِ مذاکره‌ات را کرده‌ای — هفتهٔ بعد معاملهٔ بزرگِ تازه‌ای می‌آید' }, { status: 400 })
      const items = await candidateListings(800).catch(() => [] as Item[])
      const pickId = bigDealPickOf(week, items.filter(isPricedSale).map(it => ({ id: it.id, price: priceOf(it) })), cfg.topPct)
      const it = pickId ? items.find(x => x.id === pickId) : null
      if (!it) return NextResponse.json({ error: 'معاملهٔ بزرگِ این هفته در دسترس نیست' }, { status: 404 })
      const owner = await ownerOfListing(it.id).catch(() => null)
      if (owner && owner.userId !== userId) return NextResponse.json({ error: `دیر رسیدی — «${owner.name}» (#${(owner.no || 0).toLocaleString('fa-IR')}) زودتر آن را خریده` }, { status: 409 })
      const persona = ownerPersonaOf(it.id)
      const out = bigDealNegoOf(userId, it.id, week, String(b.strategy || 'balanced'), negoSkillOf(e, persona.mod).skill, cfg)
      const r = await recordBigDealTry(userId, week, it.title, out.success, out.discountPct)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      recordEvent({ type: 'user_clicked_property', userId, propertyId: it.id, meta: { src: 'empire_bigdeal' } }).catch(() => {})
      return NextResponse.json({ ok: true, ...out, price: priceOf(it), discounted: out.success ? Math.round(priceOf(it) * (1 - out.discountPct / 100)) : null })
    }

    // 🏛 تالارِ مزایدهٔ هفته (فاز ۴۵ — سند ۲۹ Auction Saga): یک ملکِ واقعی از باندِ میانیِ بازار، برای همه یکی.
    // «ارزشِ واقعی هیچ‌وقت گفته نمی‌شود» → فقط برآوردِ بازه‌ای از نمونه‌های واقعیِ محله؛ قیمتِ آگهی تا چکش پنهان است.
    case 'auction': {
      const cfg = config().empire.auction
      if (!cfg.enabled) return NextResponse.json({ error: 'تالارِ مزایده فعلاً بسته است' }, { status: 403 })
      const e = await getEmpire(userId)
      if (!e) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      const week = Math.floor(dayNumberOf(Date.now()) / 7)
      const items = await candidateListings(800).catch(() => [] as Item[])
      const pricedIds = items.filter(isPricedSale).map(it => ({ id: it.id, price: priceOf(it) }))
      const bdPick = bigDealPickOf(week, pricedIds, config().empire.bigDeal.topPct)
      const pickId = auctionPickOf(week, pricedIds, bdPick)
      const it = pickId ? items.find(x => x.id === pickId) : null
      if (!it) return NextResponse.json({ ok: true, auction: null, note: 'این هفته آگهیِ قیمت‌دارِ کافی برای برپاییِ تالار نداریم' })
      const anchor = priceOf(it)
      const setup = auctionSetupOf(week, it.id, anchor, e.rivalScore || {}, cfg)
      // برآوردِ بازه‌ای از نمونه‌های واقعیِ هم‌محله (قانون ۱: فقط دادهٔ واقعی، با برچسبِ «برآورد») — نه قیمتِ آگهی.
      const area = parseFaNum((it.meta || {})['متراژ']) || 0
      const hood = hoodOf(it.location)
      const rates: number[] = []
      for (const x of items) {
        if (!isPricedSale(x) || hoodOf(x.location) !== hood || x.id === it.id) continue
        const a2 = parseFaNum((x.meta || {})['متراژ']) || 0
        if (a2 > 0) rates.push(priceOf(x) / a2)
      }
      const medOf = (rs: number[]) => { const s = [...rs].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
      const est = area > 0 && rates.length >= config().empire.intel.minComps ? Math.round(medOf(rates) * area) : null
      const estBand = est ? { lo: Math.round(est * (1 - cfg.estBandPct / 100)), hi: Math.round(est * (1 + cfg.estBandPct / 100)), samples: rates.length } : null
      const owner = await ownerOfListing(it.id).catch(() => null)
      const infl = auctionInfluenceOf(e, cfg.influenceMax)
      const run = e.auctionRun && e.auctionRun.week === week ? e.auctionRun : null
      const rivalCards = setup.rivals.map(rv => {
        const d = AUCTION_RIVALS.find(x => x.key === rv.key)!
        const grudge = Math.min(3, Math.max(0, (e.rivalScore || {})[rv.key] || 0))
        return { key: d.key, name: d.name, ceo: d.ceo, icon: d.icon, style: d.style, desc: d.desc, grudge }
      })
      return NextResponse.json({
        ok: true,
        auction: {
          id: it.id, title: it.title, hood, area,
          url: listingHref(it.id, it.title, hoodOf(it.location)),
          type: { key: setup.type.key, fa: setup.type.fa, icon: setup.type.icon, desc: setup.type.desc, influence: setup.type.influence },
          start: setup.start, estBand,
          estNote: estBand ? `برآوردِ کارشناسی از ${estBand.samples.toLocaleString('fa-IR')} نمونهٔ واقعیِ همین محله — عددِ دقیق را هیچ‌کس نمی‌داند` : 'نمونهٔ واقعیِ کافی در این محله نیست — برآوردی در کار نیست؛ چشم‌بسته واردِ نبرد می‌شوی',
          rivals: rivalCards,
          rumors: setup.rumors.map(r => r.text),
          expiresAt: (week + 1) * 7 * 864e5,
          soldTo: owner && owner.userId !== userId ? { name: owner.name, no: owner.no } : null,
          mine: !!(owner && owner.userId === userId),
        },
        influence: infl,
        entered: !!e.claims[`au_${week}`],
        run: run ? { ...run, anchor: run.done ? run.anchor : 0 } : null,   // لنگر (قیمتِ واقعی) تا پایان پنهان می‌ماند
        win: e.auctionWin && e.auctionWin.week === week ? e.auctionWin : null,
        nextBid: run && !run.done ? { bid: auctionNextBidOf(run, 'bid', cfg), power: auctionNextBidOf(run, 'power', cfg) } : null,
        unlocked: empireLevel(e.xp).level >= cfg.level, need: cfg.level,
        capital: e.capital,
      })
    }
    // ورود به تالار: یک ورود در هفته — خودِ «شرکت کنم یا نه؟» اولین تصمیمِ سند است.
    case 'auctionEnter': {
      const cfg = config().empire.auction
      if (!cfg.enabled) return NextResponse.json({ error: 'تالارِ مزایده فعلاً بسته است' }, { status: 403 })
      const e = await getEmpire(userId)
      if (!e) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      const gate = await lockedMsg(userId, cfg.level, 'تالارِ مزایده')
      if (gate) return NextResponse.json({ error: gate }, { status: 403 })
      const week = Math.floor(dayNumberOf(Date.now()) / 7)
      const items = await candidateListings(800).catch(() => [] as Item[])
      const pricedIds = items.filter(isPricedSale).map(it => ({ id: it.id, price: priceOf(it) }))
      const bdPick = bigDealPickOf(week, pricedIds, config().empire.bigDeal.topPct)
      const pickId = auctionPickOf(week, pricedIds, bdPick)
      const it = pickId ? items.find(x => x.id === pickId) : null
      if (!it) return NextResponse.json({ error: 'مزایدهٔ این هفته در دسترس نیست' }, { status: 404 })
      const owner = await ownerOfListing(it.id).catch(() => null)
      if (owner && owner.userId !== userId) return NextResponse.json({ error: `دیر رسیدی — «${owner.name}» (#${(owner.no || 0).toLocaleString('fa-IR')}) زودتر این ملک را خریده` }, { status: 409 })
      const anchor = priceOf(it)
      const setup = auctionSetupOf(week, it.id, anchor, e.rivalScore || {}, cfg)
      const r = await startAuction(userId, week, {
        week, listingId: it.id, title: it.title, hood: hoodOf(it.location),
        type: setup.type.key, anchor, start: setup.start,
        rivals: setup.rivals, rumors: setup.rumors, at: Date.now(),
      })
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      recordEvent({ type: 'user_clicked_property', userId, propertyId: it.id, meta: { src: 'empire_auction' } }).catch(() => {})
      const run = r.empire!.auctionRun!
      return NextResponse.json({ ok: true, run: { ...run, anchor: 0 }, nextBid: { bid: auctionNextBidOf(run, 'bid', cfg), power: auctionNextBidOf(run, 'power', cfg) }, capital: r.empire!.capital })
    }
    // یک حرکت در تالار: bid/power/wait/quit — سبک از رفتار تفسیر می‌شود؛ نتیجه قطعی و سمتِ سرور.
    case 'auctionMove': {
      const cfg = config().empire.auction
      if (!cfg.enabled) return NextResponse.json({ error: 'تالارِ مزایده فعلاً بسته است' }, { status: 403 })
      const move = String(b.move || '')
      if (!['bid', 'power', 'wait', 'quit'].includes(move)) return NextResponse.json({ error: 'حرکتِ نامعتبر' }, { status: 400 })
      const e = await getEmpire(userId)
      if (!e) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      const week = Math.floor(dayNumberOf(Date.now()) / 7)
      const infl = auctionInfluenceOf(e, cfg.influenceMax)
      const r = await applyAuctionMove(userId, week, move as 'bid' | 'power' | 'wait' | 'quit', infl.pct, cfg)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      const run = r.empire!.auctionRun!
      if (run.done && run.won) await applyHiddenBadges(userId).catch(() => {})
      return NextResponse.json({
        ok: true,
        run: { ...run, anchor: run.done ? run.anchor : 0 },
        nextBid: !run.done ? { bid: auctionNextBidOf(run, 'bid', cfg), power: auctionNextBidOf(run, 'power', cfg) } : null,
        win: r.empire!.auctionWin && r.empire!.auctionWin!.week === week ? r.empire!.auctionWin : null,
        capital: r.empire!.capital,
      })
    }

    // 🎁 مسیرِ جوایزِ واقعی (فاز ۴۸): نردبانِ مرحله‌ای از ارزشِ خالصِ واقعی → جایزهٔ تومانی به کیف‌پولِ سایت.
    case 'rewards': {
      const cfg = config().empire.rewards
      if (!cfg.enabled) return NextResponse.json({ error: 'مسیرِ جوایز فعلاً فعال نیست' }, { status: 403 })
      const e = await getEmpire(userId)
      if (!e) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      const info = await liveInfoOf(e)
      const nw = netWorthOf(e, info.prices).netWorth
      const ladder = rewardLadderOf(cfg)
      const mine = await userPayoutsOf(userId).catch(() => ({} as Record<number, string>))
      const lv = empireLevel(e.xp).level
      const ageDays = Math.floor((Date.now() - e.createdAt) / 864e5)
      const gateOk = lv >= cfg.minLevel && ageDays >= cfg.minAccountDays
      const steps = ladder.map(s => {
        const claimed = !!e.claims[`rw_${s.step}`]
        const st = mine[s.step]   // pending/approved/rejected
        const prevOk = s.step === 1 || !!e.claims[`rw_${s.step - 1}`]
        return {
          ...s,
          status: st === 'approved' ? 'paid' : st === 'rejected' ? 'rejected' : claimed ? 'pending'
            : nw >= s.threshold && prevOk && gateOk ? 'claimable' : 'locked',
        }
      })
      const rewardBalance = await bucketBalance(userId, 'reward').catch(() => 0)
      return NextResponse.json({
        ok: true, steps, netWorth: nw, rewardBalance,
        gate: gateOk ? null : `برای فعال‌شدنِ جوایز: حداقل سطحِ ${cfg.minLevel.toLocaleString('fa-IR')} و ${cfg.minAccountDays.toLocaleString('fa-IR')} روز عضویت لازم است (الان: سطح ${lv.toLocaleString('fa-IR')}، ${ageDays.toLocaleString('fa-IR')} روز)`,
      })
    }
    // ادعای جایزهٔ یک مرحله → صفِ تأییدِ انسانیِ ادمین؛ گاردها: سطح/سنِ اکانت/ترتیبِ مراحل/ظرفیتِ استخر/سقفِ ماهانه.
    case 'rewardClaim': {
      const cfg = config().empire.rewards
      if (!cfg.enabled) return NextResponse.json({ error: 'مسیرِ جوایز فعلاً فعال نیست' }, { status: 403 })
      const e = await getEmpire(userId)
      if (!e) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      const step = Math.floor(Number(b.step) || 0)
      const ladder = rewardLadderOf(cfg)
      const s = ladder.find(x => x.step === step)
      if (!s) return NextResponse.json({ error: 'مرحلهٔ نامعتبر' }, { status: 400 })
      const lv = empireLevel(e.xp).level
      const ageDays = Math.floor((Date.now() - e.createdAt) / 864e5)
      if (lv < cfg.minLevel) return NextResponse.json({ error: `جوایز از سطحِ ${cfg.minLevel.toLocaleString('fa-IR')} فعال می‌شود` }, { status: 403 })
      if (ageDays < cfg.minAccountDays) return NextResponse.json({ error: `جوایز از ${cfg.minAccountDays.toLocaleString('fa-IR')} روز عضویت فعال می‌شود` }, { status: 403 })
      if (step > 1 && !e.claims[`rw_${step - 1}`]) return NextResponse.json({ error: 'مراحل به ترتیب باز می‌شوند — اول مرحلهٔ قبلی را بگیر' }, { status: 400 })
      if (e.claims[`rw_${step}`]) return NextResponse.json({ error: 'برای این مرحله قبلاً درخواست داده‌ای' }, { status: 400 })
      const info = await liveInfoOf(e)
      const nw = netWorthOf(e, info.prices).netWorth
      if (nw < s.threshold) return NextResponse.json({ error: `هنوز به آستانهٔ این مرحله نرسیده‌ای (${Math.round(s.threshold / 1e9).toLocaleString('fa-IR')} میلیارد)` }, { status: 400 })
      const rq = await requestPayout({ userId, no: e.no, name: e.name, step, amount: s.reward, netWorth: nw, level: lv, ageDays }, cfg.payoutPct, cfg.monthlyCapToman)
      if (!rq.ok) return NextResponse.json({ error: rq.reason }, { status: 400 })
      await markRewardClaimed(userId, step, s.reward).catch(() => {})
      return NextResponse.json({ ok: true, request: rq.request, note: 'درخواستت ثبت شد — پس از تأییدِ ملک‌جت، مبلغ به کیف‌پولت واریز می‌شود' })
    }

    // 🧭 هوشِ سرمایه‌گذاری (فاز ۳۹ — سند ۲۶ فصل ۱۶): روندِ محله‌ها از تاریخچهٔ واقعیِ رصدخانه +
    // جریانِ نقدی/سلامتِ مالی از جریان‌های ثبت‌شدهٔ خودِ بازیکن + حداکثر ۵ اولویتِ امروز از وضعیتِ واقعی.
    // فقط «پیشنهاددهنده» است (قانونِ سند: AI تصمیم نمی‌گیرد) — هیچ اکشنی را خودش اجرا نمی‌کند.
    case 'intel': {
      const iCfg = config().empire.intel
      if (!iCfg.enabled) return NextResponse.json({ error: 'تحلیلِ هوشمند فعلاً فعال نیست' }, { status: 403 })
      const e = await getEmpire(userId)
      if (!e) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      const snaps = await loadSnapshots(60).catch(() => [])
      const flow = cashflowOf(e)
      const health = financialHealthOf(e, netWorthOf(e, {}).netWorth, flow)
      // فاز ۴۱ (سند ۲۸ Part 13): تشخیصِ بحران از سیگنال‌های واقعی + ثبتِ ورود/خروج (خروج = شمارندهٔ ققنوس + نشانِ مخفی)
      const crisis = crisisOf(e, flow, Date.now(), iCfg)
      if (crisis.active !== !!e.crisis) {
        await noteCrisis(userId, crisis.active).catch(() => {})
        if (!crisis.active) await applyHiddenBadges(userId).catch(() => {})
      }
      // فاز ۴۰ (سند ۲۷ Part 13): ارزیابیِ قوانینِ خودِ بازیکن روی وضعیت/قیمت‌های واقعی — فقط هشدار/پیشنهاد.
      const auCfg = config().empire.automation
      let rules = null
      if (auCfg.enabled) {
        const prices: Record<string, number> = {}
        for (const a of e.assets) {
          const it = await getItemById(a.listingId).catch(() => null)
          const p = it ? priceOf(it) : 0
          if (p > 0) prices[a.listingId] = p
        }
        const alerts = evalRules(e, e.autoRules || [], prices)
        await recordRuleFires(userId, alerts, dayNumberOf(Date.now()), auCfg.logCap).catch(() => {})
        rules = { templates: RULE_TEMPLATES, list: e.autoRules || [], alerts, log: (e.ruleLog || []).slice(0, 10), max: auCfg.maxRules }
      }
      return NextResponse.json({
        ok: true,
        market: marketIntelOf(snaps, iCfg),
        flow, health, rules, crisis,
        priorities: prioritiesOf(e, Date.now(), iCfg),
        capital: e.capital,
      })
    }

    // ⚙️ مرکزِ خودکارسازی (فاز ۴۰ — سند ۲۷ Part 13): CRUD قوانینِ بازیکن — «هیچ اقدامِ مالی خودکار انجام نمی‌شود».
    case 'ruleSet': {
      const auCfg = config().empire.automation
      if (!auCfg.enabled) return NextResponse.json({ error: 'خودکارسازی فعلاً فعال نیست' }, { status: 403 })
      const kind = String(b.kind || '')
      if (!RULE_TEMPLATES.some(t => t.kind === kind)) return NextResponse.json({ error: 'نوعِ قانون نامعتبر است' }, { status: 400 })
      const level = b.level === 'recommend' ? 'recommend' as const : 'notify' as const
      const r = await setAutoRule(userId, { id: b.id ? String(b.id) : undefined, kind, threshold: Number(b.threshold) || 0, level }, auCfg.maxRules)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, list: r.empire!.autoRules || [] })
    }
    case 'ruleDel': {
      const r = await delAutoRule(userId, String(b.ruleId || ''))
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, list: r.empire!.autoRules || [] })
    }
    case 'ruleToggle': {
      const r = await toggleAutoRule(userId, String(b.ruleId || ''))
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, list: r.empire!.autoRules || [] })
    }

    // 🏗 بازارِ زمین (فاز ۲۴): دروازهٔ موتورِ ساخت — زمین‌های «واقعیِ» قیمت‌دار با متراژِ ثبت‌شده.
    // بدونِ این ورودی، پروانه/کلنگ/پیش‌فروش هرگز در دسترس نبود (فرصت‌های روزانه اغلب آپارتمان‌اند).
    // ══════ فاز ۳۷ — بازارِ بازیکنان، مشارکتِ ساخت، اتحاد (درخواستِ مستقیم — همه سطح‌گشا) ══════
    // عرضهٔ دارایی به بازیکنانِ دیگر (قیمت ۰ = لغو)
    case 'forSale': {
      const soc = config().empire.social, u = config().empire.unlocks
      if (soc?.tradeEnabled === false) return NextResponse.json({ error: 'بازارِ بازیکنان فعلاً فعال نیست' }, { status: 403 })
      const me = await getEmpire(userId)
      if (!me) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      if (empireLevel(me.xp).level < u.tradeLevel) return NextResponse.json({ error: `بازارِ بازیکنان از سطحِ ${u.tradeLevel.toLocaleString('fa-IR')} باز می‌شود — الان سطحِ ${empireLevel(me.xp).level.toLocaleString('fa-IR')} هستی` }, { status: 403 })
      const r = await setForSale(userId, String(b.assetId || ''), Math.round(Number(b.price) || 0))
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, ...(await stateOf(userId, r.empire!)) })
    }
    // پیشنهادِ مشارکتِ ساخت: سهمِ ٪ در برابرِ آوردهٔ نقدی (pct ۰ = لغو)
    case 'jvOpen': {
      const soc = config().empire.social, u = config().empire.unlocks
      if (soc?.jvEnabled === false) return NextResponse.json({ error: 'مشارکتِ ساخت فعلاً فعال نیست' }, { status: 403 })
      const me = await getEmpire(userId)
      if (!me) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      if (empireLevel(me.xp).level < u.tradeLevel) return NextResponse.json({ error: `مشارکتِ ساخت از سطحِ ${u.tradeLevel.toLocaleString('fa-IR')} باز می‌شود` }, { status: 403 })
      const r = await openPartnership(userId, String(b.assetId || ''), Math.round(Number(b.pct) || 0), Math.round(Number(b.amount) || 0), soc?.jvMaxPct || 49)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, ...(await stateOf(userId, r.empire!)) })
    }
    // بازارِ بازیکنان: عرضه‌ها و مشارکت‌های بازِ بازیکنانِ واقعیِ دیگر — بدونِ افشای شماره (فقط نام و #)
    case 'playerMarket': {
      const me = await getEmpire(userId)
      if (!me) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      const soc = config().empire.social, u = config().empire.unlocks
      const empires = await listEmpiresPublic(500)
      const sales: any[] = [], jvs: any[] = []
      for (const e of empires) {
        if (e.userId === userId) continue
        for (const a of e.assets) {
          // فاز ۴۰ (سند ۲۷ Part 21 — هوشِ قرارداد): تحلیلِ پیش از امضا از اعدادِ «واقعیِ» خودِ قرارداد —
          // قیمتِ درخواستی در برابرِ قیمتِ خریدِ ثبت‌شدهٔ فروشنده؛ آورده در برابرِ سهمِ منصفانه از هزینهٔ واقعیِ ساخت.
          if ((a.forSale || 0) > 0 && soc?.tradeEnabled !== false)
            sales.push({ no: e.no, seller: e.name, assetId: a.id, title: a.title, hood: a.hood, kind: a.kind, price: a.forSale, renov: a.renovBoostPct || 0, designed: !!a.design, check: config().empire.intel.enabled ? tradeAskCheckOf(a.forSale!, a.buyPrice) : null })
          if (a.jvOffer && soc?.jvEnabled !== false)
            jvs.push({ no: e.no, owner: e.name, assetId: a.id, title: a.title, hood: a.hood, pct: a.jvOffer.pct, amount: a.jvOffer.amount, building: !!(a.construction && !a.construction.done), check: config().empire.intel.enabled ? jvOfferCheckOf(a.jvOffer.pct, a.jvOffer.amount, a.construction && !a.construction.done ? a.construction.costTotal : null) : null })
        }
      }
      return NextResponse.json({ ok: true, unlocked: empireLevel(me.xp).level >= u.tradeLevel, need: u.tradeLevel, sales: sales.slice(0, 40), jvs: jvs.slice(0, 40) })
    }
    // خرید از بازیکنِ دیگر — تراکنشِ اتمیکِ دو-کاربره + انتقالِ مالکیتِ انحصاری
    case 'tradeBuy': {
      const soc = config().empire.social, u = config().empire.unlocks
      if (soc?.tradeEnabled === false) return NextResponse.json({ error: 'بازارِ بازیکنان فعلاً فعال نیست' }, { status: 403 })
      const me = await getEmpire(userId)
      if (!me) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      if (empireLevel(me.xp).level < u.tradeLevel) return NextResponse.json({ error: `بازارِ بازیکنان از سطحِ ${u.tradeLevel.toLocaleString('fa-IR')} باز می‌شود` }, { status: 403 })
      const seller = (await listEmpiresPublic(1000)).find(x => x.no === Math.floor(Number(b.no) || 0))
      if (!seller) return NextResponse.json({ error: 'فروشنده یافت نشد' }, { status: 404 })
      const r = await tradeAsset(seller.userId, userId, String(b.assetId || ''), { taxPct: config().empire.transferTaxPct, commissionPct: config().empire.pros.advisorSellCommissionPct })
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      if (r.listingId) {
        await transferListing(r.listingId, seller.userId, { userId, no: me.no, name: me.name }).catch(() => {})
        recordEvent({ type: 'user_clicked_property', userId, propertyId: r.listingId, meta: { src: 'empire_trade' } }).catch(() => {})
      }
      const eF = await getEmpire(userId)
      return NextResponse.json({ ok: true, price: r.price, ...(await stateOf(userId, eF!)) })
    }
    // پیوستن به مشارکتِ ساختِ یک بازیکنِ دیگر (آورده → تأمینِ مالیِ پروژهٔ او؛ سهم از فروش‌ها خودکار)
    case 'jvJoin': {
      const soc = config().empire.social, u = config().empire.unlocks
      if (soc?.jvEnabled === false) return NextResponse.json({ error: 'مشارکتِ ساخت فعلاً فعال نیست' }, { status: 403 })
      const me = await getEmpire(userId)
      if (!me) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      if (empireLevel(me.xp).level < u.tradeLevel) return NextResponse.json({ error: `مشارکتِ ساخت از سطحِ ${u.tradeLevel.toLocaleString('fa-IR')} باز می‌شود` }, { status: 403 })
      const owner = (await listEmpiresPublic(1000)).find(x => x.no === Math.floor(Number(b.no) || 0))
      if (!owner) return NextResponse.json({ error: 'سازنده یافت نشد' }, { status: 404 })
      const r = await joinPartnership(owner.userId, userId, String(b.assetId || ''))
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      const eF = await getEmpire(userId)
      return NextResponse.json({ ok: true, pct: r.pct, amount: r.amount, ...(await stateOf(userId, eF!)) })
    }
    // 🏰 اتحاد (کلن): فهرست/ساخت/پیوستن/خروج/پیام — هزینهٔ ثبت → خزانه؛ همه knob و سطح‌گشا
    case 'clanList': {
      const me = await getEmpire(userId)
      if (!me) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      const soc = config().empire.social, u = config().empire.unlocks
      const mine = await myClanOf(userId).catch(() => null)
      return NextResponse.json({
        ok: true, enabled: soc?.clanEnabled !== false,
        unlocked: empireLevel(me.xp).level >= u.clanLevel, need: u.clanLevel,
        createFee: soc?.clanCreateFee || 0, maxMembers: soc?.clanMaxMembers || 20,
        mine: mine ? clanView(mine, userId) : null,
        clans: await listClans(50).catch(() => []),
      })
    }
    case 'clanCreate': {
      const soc = config().empire.social, u = config().empire.unlocks
      if (soc?.clanEnabled === false) return NextResponse.json({ error: 'اتحادها فعلاً فعال نیستند' }, { status: 403 })
      const me = await getEmpire(userId)
      if (!me) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      if (empireLevel(me.xp).level < u.clanLevel) return NextResponse.json({ error: `اتحاد از سطحِ ${u.clanLevel.toLocaleString('fa-IR')} باز می‌شود — الان سطحِ ${empireLevel(me.xp).level.toLocaleString('fa-IR')} هستی` }, { status: 403 })
      const fee = Math.max(0, Math.round(soc?.clanCreateFee || 0))
      if (me.capital < fee) return NextResponse.json({ error: `هزینهٔ ثبتِ اتحاد ${Math.round(fee / 1e6).toLocaleString('fa-IR')}م تومان است — سرمایه کافی نیست` }, { status: 400 })
      const c = await createClan({ userId, no: me.no, name: me.name }, String(b.name || ''))
      if (!c.ok) return NextResponse.json({ error: c.reason }, { status: 400 })
      // هزینهٔ ثبت → خزانه (بقای پول)؛ اگر کسر شکست خورد، اتحادِ تازه پاک می‌شود
      const charged = await chargeClanFee(userId, fee, c.clan!.name)
      if (!charged.ok) { await deleteClanIfOwner(c.clan!.id, userId).catch(() => {}); return NextResponse.json({ error: charged.reason }, { status: 400 }) }
      return NextResponse.json({ ok: true, clan: clanView(c.clan!, userId) })
    }
    case 'clanJoin': {
      const soc = config().empire.social, u = config().empire.unlocks
      if (soc?.clanEnabled === false) return NextResponse.json({ error: 'اتحادها فعلاً فعال نیستند' }, { status: 403 })
      const me = await getEmpire(userId)
      if (!me) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      if (empireLevel(me.xp).level < u.clanLevel) return NextResponse.json({ error: `اتحاد از سطحِ ${u.clanLevel.toLocaleString('fa-IR')} باز می‌شود` }, { status: 403 })
      const r = await joinClan({ userId, no: me.no, name: me.name }, String(b.id || ''), soc?.clanMaxMembers || 20)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, clan: clanView(r.clan!, userId) })
    }
    case 'clanLeave': {
      const r = await leaveClan(userId)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true })
    }
    case 'clanPost': {
      const r = await postClanMsg(userId, String(b.text || ''))
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, clan: clanView(r.clan!, userId) })
    }

    case 'lands': {
      const e = await getEmpire(userId)
      if (!e) return NextResponse.json({ error: 'اول امپراتوری‌ات را بساز' }, { status: 400 })
      const taxPct = config().empire.transferTaxPct
      const owned = new Set(e.assets.map(a => a.listingId))
      const all = (await candidateListings(1500).catch(() => [] as Item[]))
        .filter(it => isPricedSale(it) && !owned.has(it.id)
          && assetKindOf(ptypeOf(it)) === 'land'
          && ((parseFaNum((it.meta || {})['متراژ']) || 0) > 0 || areaFromText(it.title) > 0))   // متراژ از فیلد یا متنِ آگهی — لازمهٔ برآوردِ ساخت
      const affordable = (it: Item) => { const p = priceOf(it); return p + Math.round(p * taxPct / 100) <= e.capital }
      const sorted = [...all].sort((a, x) => priceOf(a) - priceOf(x))
      // اول در حدِ سرمایه؛ بعد ارزان‌ترین‌های بالاتر با پرچمِ صادقانهٔ «هنوز نمی‌رسد»
      const rows: Item[] = sorted.filter(affordable).slice(0, 6)
      for (const it of sorted) { if (rows.length >= 8) break; if (!rows.includes(it)) rows.push(it) }
      return NextResponse.json({
        ok: true, total: all.length, capital: e.capital,
        lands: rows.map(it => {
          const area = parseFaNum((it.meta || {})['متراژ']) || areaFromText(it.title) || 0
          const price = priceOf(it)
          return { ...lite(it), area, perM: area > 0 ? Math.round(price / area) : 0, locked: !affordable(it), lat: Number(it.meta?.['__lat']) || undefined, lng: Number(it.meta?.['__lng']) || undefined }
        }),
      })
    }

    // روزنامهٔ ملک‌جت (جلد ۵۲) + آرشیوِ تمدن (جلد ۵۱ فصل ۹): خبر فقط از اتفاقِ واقعیِ دنیا.
    case 'news': {
      const [items, empires] = await Promise.all([candidateListings(800).catch(() => [] as Item[]), listEmpiresPublic(300)])
      const prices: Record<string, number> = {}
      for (const it of items) { const p = priceOf(it); if (p > 0) prices[it.id] = p }
      const listings = items.filter(isPricedSale).map(it => {
        const area = parseFaNum((it.meta || {})['متراژ']) || 0
        const price = priceOf(it)
        return { id: it.id, title: it.title, hood: hoodOf(it.location), price, perM: area > 0 ? Math.round(price / area) : 0, scrapedAt: it.scrapedAt || 0 }
      })
      return NextResponse.json({ ok: true, ...newsOf({ now: Date.now(), listings, empires, prices }) })
    }

    // بازدید از امپراتوریِ دیگران (سند ۱۷ — فصل ۷): پروفایلِ عمومیِ یک بازیکنِ واقعی از روی لیدربورد.
    case 'viewEmpire': {
      const no = Math.floor(Number(b.no) || 0)
      if (!(no > 0)) return NextResponse.json({ error: 'شمارهٔ امپراتوری نامعتبر' }, { status: 400 })
      const target = (await listEmpiresPublic(500)).find(x => x.no === no)
      if (!target) return NextResponse.json({ error: 'این امپراتوری یافت نشد' }, { status: 404 })
      const tPrices = await livePrices(target)
      const tnw = netWorthOf(target, tPrices)
      const me = await getEmpire(userId)
      return NextResponse.json({
        ok: true,
        profile: {
          no: target.no, name: target.name, persona: target.persona, title: target.title,
          frame: cosmeticIconOf(target, 'frame'), flair: cosmeticIconOf(target, 'flair'),
          level: empireLevel(target.xp), badges: target.badges, kudos: target.kudos || 0,
          score: empireScoreOf(target, tPrices), netWorth: tnw.netWorth, assets: target.assets.length,
          hoods: [...new Set(target.assets.map(a => a.hood).filter(Boolean))].slice(0, 8),
          skyline: target.assets.map(a => ({ v: tPrices[a.listingId] || a.buyPrice, kind: a.kind })).slice(0, 24),
          company: target.company ? { name: target.company.name, color: target.company.color, stars: companyReputationOf(target, config().empire.build.repProjectScore).stars, delivered: target.stats?.projectsDelivered || 0 } : null,
          memberSince: target.createdAt,
          myKudos: !!me?.claims['kudos_' + target.no],
          mine: target.userId === userId,
        },
      })
    }
    // 👏 تحسین (سند ۱۷): هر بازیکنِ واقعی یک‌بار برای هر امپراتوری — بدونِ پاداشِ پولی.
    case 'kudos': {
      const no = Math.floor(Number(b.no) || 0)
      const target = (await listEmpiresPublic(500)).find(x => x.no === no)
      if (!target) return NextResponse.json({ error: 'این امپراتوری یافت نشد' }, { status: 404 })
      const r = await giveKudos(userId, target)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, kudos: r.kudos })
    }

    // 🎨 فروشگاهِ ظاهری (فاز ۳۳ — سند ۲۲ فصل ۳): خرید با ملک‌کوین؛ فقط ظاهر، صفر اثرِ اقتصادی.
    case 'cosmeticBuy': {
      const shop = config().empire.cosmetics
      if (!shop?.enabled) return NextResponse.json({ error: 'فروشگاهِ ظاهری فعال نیست' }, { status: 400 })
      const item = (shop.items || []).find(i => i.enabled && i.priceCoins > 0 && i.id === String(b.id || ''))
      if (!item) return NextResponse.json({ error: 'این آیتم موجود نیست' }, { status: 404 })
      const r = await buyCosmetic(userId, item)
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, ...(await stateOf(userId, r.empire!)) })
    }
    case 'cosmeticSet': {
      const kind = b.kind === 'flair' ? 'flair' as const : 'frame' as const
      const r = await setCosmetic(userId, kind, String(b.id || ''))
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, ...(await stateOf(userId, r.empire!)) })
    }
    // 🎁 بستنِ پیشنهادِ هوشمند با یک لمس (فاز ۳۳ — سند ۲۲ فصل ۹): تا cooldownDays برنمی‌گردد.
    case 'offerDismiss': {
      const r = await dismissOffer(userId, String(b.id || ''), dayNumberOf(Date.now()))
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true })
    }

    // عنوانِ فعال (سند ۱۶ بخش ۹): فقط از نشان‌های واقعاً کسب‌شده — در سربرگ و لیدربوردها نمایش داده می‌شود.
    case 'setTitle': {
      const r = await setTitle(userId, String(b.title || ''))
      if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 })
      return NextResponse.json({ ok: true, ...(await stateOf(userId, r.empire!)) })
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
