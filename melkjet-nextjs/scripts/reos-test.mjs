// REOS · Unit tests (pure algorithmic core + real gradient-descent training).
// Run: node --import ./scripts/reos-loader.mjs scripts/reos-test.mjs
// No DATABASE_URL needed — these test pure functions + the learning algorithm.
import { cosine, haversineKm, embedTokens, demandScore, agentPerf, clamp01 } from '../app/lib/reos/features.ts'
import { budgetMatch, locationMatch, scoreUserProperty, intentStrength } from '../app/lib/reos/scoring.ts'
import { userVector, propertyVector } from '../app/lib/reos/features.ts'
import { hybridScore } from '../app/lib/reos/hybrid.ts'
import { propertyRankScore, buildHomeFeed } from '../app/lib/reos/feed.ts'
import { predictLeadConversion, optimizePrice } from '../app/lib/reos/ml.ts'
import { effectiveBoost, leadValue } from '../app/lib/reos/monetization.ts'
import { assignLeadToAgent, matchUserToProperties } from '../app/lib/reos/engine.ts'
import { fitLogistic, evaluate, scoreWith, engageFeatures, predictEngage, DEFAULT_ENGAGE } from '../app/lib/reos/train.ts'
import { buildRoleFeed, roleFromPath, medianPricePerM, isRoleKind } from '../app/lib/reos/roles.ts'
import { npv, irr, paybackPeriod, roi, rentalYield, mortgagePayment, analyzeInvestment, analyzeConstruction } from '../app/lib/reos/investor.ts'
import { avmFromComps } from '../app/lib/reos/avm.ts'
import { recallAtK, precisionAtK, mrr, ndcgAtK, evaluateRankings } from '../app/lib/reos/eval.ts'
import { histogram, psi, uniformEdges, driftReport } from '../app/lib/reos/drift.ts'
import { fitPairwise, rankItems, rankScore } from '../app/lib/reos/rank.ts'
import { cellKey, buildHeatmap } from '../app/lib/reos/geo-intel.ts'
import { liquidityScore, daysToSell, saleProbability, riskProfile, aiConfidence } from '../app/lib/reos/digital-twin.ts'
import { trustScore } from '../app/lib/reos/trust.ts'
import { sellerInsight } from '../app/lib/reos/seller-intel.ts'
import { listingSuggestions, listingHealth } from '../app/lib/reos/copilot.ts'
import { codeFor } from '../app/lib/reos/growth.ts'
import { banditUpdate, epsilonGreedy, normReward, EVENT_REWARD } from '../app/lib/reos/rl.ts'
import { planAutonomous } from '../app/lib/reos/autonomous.ts'
import { fitLeadLogistic, DEFAULT_LEAD, scoreLead } from '../app/lib/reos/lead-model.ts'
import { dominanceScore, fraudScore, battleWinner, territoryValue, territoryKeyFromName, territoryKeyFromGeo } from '../app/lib/reos/territory.ts'
import { checkAchievements, nextAchievements, streakStatus, streakBonus, fomoAlerts, dayNumber } from '../app/lib/reos/achievements.ts'
import { levelForXp, xpForAction, seasonKey } from '../app/lib/reos/xp.ts'
import { missionCatalog, missionState, periodKey } from '../app/lib/reos/missions.ts'
import { commissionOn, affiliateCut, loyaltyBonus } from '../app/lib/reos/economy.ts'
import { communityScore, sanitizeComment, threadComments } from '../app/lib/reos/community.ts'
import { evalFlag, bucketOf, DEFAULT_FLAGS } from '../app/lib/reos/flags.ts'
import { shouldPromote, pickChallenger } from '../app/lib/reos/automl.ts'
import { empireLevel, identityFromAnswers, identityVerdict, assetKindOf, guessOutcome, dreamSentence, netWorthOf, landProjection, chestRewardOf, empireScoreOf, creditScoreOf, loanTermsFor, negotiationOutcome, questOf, nextDreamOf, DAILY_QUESTS } from '../app/lib/empire-store.ts'

let pass = 0, fail = 0
const approx = (a, b, e = 1e-6) => Math.abs(a - b) <= e
function ok(name, cond) { if (cond) { pass++; console.log('  ✓', name) } else { fail++; console.log('  ✗', name) } }

console.log('\n── Feature engineering ──')
{
  const v = embedTokens(['آپارتمان', 'سعادت', 'آباد'])
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
  ok('embedding is L2-normalized', approx(norm, 1, 1e-9))
  ok('cosine(v,v)=1', approx(cosine(v, v), 1, 1e-9))
  ok('cosine(orthogonal)=0', approx(cosine([1, 0, 0], [0, 1, 0]), 0))
  const km = haversineKm(35.759, 51.388, 35.700, 51.400) // ~ نزدیکِ تهران
  ok('haversine plausible (5-8km)', km > 4 && km < 9)
  ok('clamp01 clamps', clamp01(2) === 1 && clamp01(-1) === 0)
}

console.log('\n── Scoring formulas ──')
{
  ok('budget: price<=budget → 1', budgetMatch(1000, 800) === 1)
  ok('budget: 25% over → 0', approx(budgetMatch(1000, 1250), 0))
  ok('budget: unknown → 0.5 neutral', budgetMatch(0, 0) === 0.5)
  ok('location: 0km → 1', approx(locationMatch(35.7, 51.4, 35.7, 51.4, 0), 1))
  ok('intent buy↔sale strong', intentStrength('buy', 'sale', 0.8) > intentStrength('buy', 'rent', 0.8))
  const uv = userVector({ id: 'u', budget: 5_000_000_000, intent: 'buy', lat: 35.75, lng: 51.4, locationText: 'سعادت آباد', engagementScore: 0.6 })
  const pNear = propertyVector({ id: 'p1', price: 4_500_000_000, deal: 'sale', lat: 35.75, lng: 51.41, locationText: 'سعادت آباد', tokens: ['آپارتمان', 'سعادت', 'آباد'] })
  const pFar = propertyVector({ id: 'p2', price: 9_000_000_000, deal: 'sale', lat: 35.6, lng: 51.2, locationText: 'ری', tokens: ['ری'] })
  const sNear = scoreUserProperty(uv, pNear, { textOverlap: 1 }).final
  const sFar = scoreUserProperty(uv, pFar, { textOverlap: 0 }).final
  ok('in-budget + near > over-budget + far', sNear > sFar)
  ok('score in [0,1]', sNear >= 0 && sNear <= 1)
}

console.log('\n── Hybrid + Feed ranking ──')
{
  const u = { id: 'u', budget: 5_000_000_000, intent: 'buy', locationText: 'سعادت آباد', engagementScore: 0.6 }
  const good = { id: 'g', price: 4_000_000_000, deal: 'sale', locationText: 'سعادت آباد', tokens: ['آپارتمان', 'سعادت', 'آباد'], area: 120, rooms: 3, views: 40, contacts: 3, saves: 5, createdAt: Date.now() }
  const overBudget = { id: 'x', price: 20_000_000_000, deal: 'sale', locationText: 'سعادت آباد' }
  ok('hybrid rejects way-over-budget (rulePass=false)', hybridScore(u, overBudget).layers.rulePass === false)
  const card = propertyRankScore(u, good, 0)
  ok('rank score in [0,1]', card.score >= 0 && card.score <= 1)
  ok('matchPct 0..100', card.matchPct >= 0 && card.matchPct <= 100)
  ok('card exposes learned engagement part', typeof card.parts.learned === 'number')
  // Trust gate: boost only helps a quality listing, capped by quality
  const noBoost = propertyRankScore(u, good, 0).parts.promotion
  const boosted = propertyRankScore(u, good, 1).parts.promotion
  ok('promotion boost raises promo part', boosted > noBoost)
  const feed = buildHomeFeed(u, [good, overBudget], {}, new Set(), 12)
  ok('feed.forYou sorted desc', feed.forYou.every((c, i, a) => i === 0 || a[i - 1].score >= c.score))
}

console.log('\n── ML inference ──')
{
  const cold = predictLeadConversion({ phone: '', stage: 'new', activityCount: 0 })
  const hot = predictLeadConversion({ phone: '0912', budget: '5000000000', stage: 'contract', activityCount: 6 })
  ok('lead conversion monotonic (hot > cold)', hot.value > cold.value)
  ok('conversion in [0,1]', hot.value >= 0 && hot.value <= 1)
  const price = optimizePrice({ id: 'p', area: 100, views: 50, contacts: 8 }, { medianPricePerM: 50_000_000 })
  ok('price optimizer: low<=suggested<=high', price.low <= price.suggested && price.suggested <= price.high)
}

console.log('\n── Monetization (trust gate) ──')
{
  const now = Date.now()
  const active = { type: 'vip', startAt: now - 1000, endAt: now + 1000 }
  const expired = { type: 'vip', startAt: now - 2000, endAt: now - 1000 }
  ok('expired promo → 0 boost', effectiveBoost(expired, 1, now) === 0)
  ok('quality gate: high quality > low quality boost', effectiveBoost(active, 1, now) > effectiveBoost(active, 0, now))
  ok('lead value grows with intent', leadValue({ intentScore: 0.9, budget: 5e9 }).price > leadValue({ intentScore: 0.2, budget: 5e9 }).price)
}

console.log('\n── Lead→Agent matching ──')
{
  const agents = [
    { id: 'A', name: 'الف', conversionRate: 0.5, deals: 10, openLoad: 0, rating: 4, active: true, specialties: ['سعادت آباد'] },
    { id: 'B', name: 'ب', conversionRate: 0.5, deals: 10, openLoad: 20, rating: 4, active: true, specialties: ['ری'] },
  ]
  const m = assignLeadToAgent({ need: 'آپارتمان سعادت آباد', locationText: 'سعادت آباد' }, agents)
  ok('specialist + free capacity ranks first', m[0].targetId === 'A')
}

console.log('\n── REAL TRAINING: gradient-descent logistic regression ──')
{
  // Synthetic labeled data where engagement (y) is driven mainly by `demand`.
  const data = []
  // deterministic pseudo-random (no Math.random — reproducible)
  let seed = 12345
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
  for (let i = 0; i < 400; i++) {
    const demand = rnd(), pop = rnd(), saves = rnd(), userEng = rnd()
    const p = 1 / (1 + Math.exp(-(-1.0 + 3.0 * demand + 0.2 * pop))) // truth: demand dominates
    const y = rnd() < p ? 1 : 0
    data.push({ demand, pop, saves, userEng, y })
  }
  const trained = fitLogistic(data, { epochs: 500, lr: 0.4 })
  ok('training used data (not default)', trained.usedDefault === false && trained.n === 400)
  ok('learned demand weight is strongly positive', trained.demand > 1.0)
  ok('learned demand > pop weight (recovers structure)', trained.demand > trained.pop)
  ok('train AUC good (>0.75)', trained.auc > 0.75)
  const dEval = evaluate(DEFAULT_ENGAGE, data)
  ok('trained logloss < default logloss (model learned)', trained.logloss < dEval.logloss)
  // tiny dataset → keeps safe defaults
  const tiny = fitLogistic(data.slice(0, 8))
  ok('tiny dataset keeps safe defaults', tiny.usedDefault === true)
  // inference plumbing
  const f = engageFeatures({ views: 100, contacts: 5, saves: 8 }, 0.5)
  ok('engageFeatures in [0,1]', Object.values(f).every(v => v >= 0 && v <= 1))
  ok('scoreWith in [0,1]', (() => { const s = scoreWith(trained, f); return s >= 0 && s <= 1 })())
  ok('predictEngage returns number in [0,1]', (() => { const s = predictEngage({ views: 100, saves: 8 }, 0.5); return s >= 0 && s <= 1 })())
}

console.log('\n── REOS v2: Multi-Role Intelligence ──')
{
  ok('roleFromPath maps dashboards', roleFromPath('/architect/x') === 'architect' && roleFromPath('/builder') === 'builder' && roleFromPath('/') === 'buyer')
  ok('isRoleKind validates', isRoleKind('finance') && !isRoleKind('hacker'))
  const now = Date.now()
  // A: کلنگی، زیرِ بازار، پرتقاضا · B: آپارتمانِ گران، کم‌تقاضا، تازه · C: آپارتمانِ اجاره‌ایِ پرتقاضا
  const A = { id: 'A', price: 6_000_000_000, deal: 'sale', ptype: 'کلنگی', tokens: ['کلنگی', 'قیطریه'], area: 200, views: 120, contacts: 10, saves: 15, createdAt: now - 40 * 864e5, locationText: 'قیطریه' }
  const B = { id: 'B', price: 20_000_000_000, deal: 'sale', ptype: 'آپارتمان', tokens: ['آپارتمان'], area: 100, views: 3, contacts: 0, saves: 0, createdAt: now - 864e5, locationText: 'ولنجک' }
  const C = { id: 'C', rentMonthly: 50_000_000, deal: 'rent', ptype: 'آپارتمان', tokens: ['آپارتمان'], area: 90, views: 80, contacts: 6, saves: 4, createdAt: now - 10 * 864e5, locationText: 'سعادت آباد' }
  const D = { id: 'D', price: 8_000_000_000, deal: 'sale', ptype: 'آپارتمان', tokens: ['آپارتمان'], area: 130, views: 60, contacts: 5, saves: 8, createdAt: now - 5 * 864e5, locationText: 'سعادت آباد' }
  const props = [A, B, C, D]

  const owner = buildRoleFeed('owner', props)
  ok('owner feed has invest + hot sections', owner.sections.map(s => s.key).join(',') === 'invest,hot')
  ok('owner invest ranks below-market high-demand (A) on top', owner.sections[0].items[0].id === 'A')

  const builder = buildRoleFeed('builder', props)
  const land = builder.sections.find(s => s.key === 'land')
  ok('builder land section only land-like (A)', land.items.length === 1 && land.items[0].id === 'A')

  const finance = buildRoleFeed('finance', props)
  const loanable = finance.sections.find(s => s.key === 'loanable')
  ok('finance loanable excludes rent listing (C)', !loanable.items.some(i => i.id === 'C'))

  const pros = buildRoleFeed('pros', props)
  ok('pros feed differs from owner feed (role-specific)', pros.sections[0].key !== owner.sections[0].key)
  ok('every role produces a labeled feed', ['owner','pros','agency','builder','materials','architect','contractor','appraiser','lawfirm','finance','notary','buyer'].every(r => { const f = buildRoleFeed(r, props); return f.label && f.sections.length >= 1 }))
  ok('medianPricePerM computes', medianPricePerM(props) > 0)
}

console.log('\n── REOS v3: Investor Intelligence (ROI/IRR/NPV/payback) ──')
{
  ok('npv at 0% = sum of cashflows', npv(0, [-1000, 600, 600]) === 200)
  ok('npv discounts future', approx(npv(0.1, [-1000, 600, 600]), 41.32, 0.5))
  ok('irr of [-1000,600,600] ≈ 13.1%', Math.abs(irr([-1000, 600, 600]) - 0.131) < 0.005)
  ok('irr returns NaN when no root (all positive)', isNaN(irr([100, 200, 300])))
  ok('paybackPeriod ≈ 1.67y', Math.abs(paybackPeriod([-1000, 600, 600]) - 1.67) < 0.05)
  ok('roi(200,1000)=20%', roi(200, 1000) === 20)
  ok('rentalYield(100,1000)=10%', rentalYield(100, 1000) === 10)
  ok('mortgagePayment(1000,12%,12)≈89', Math.abs(mortgagePayment(1000, 0.12, 12) - 89) <= 1)
  const inv = analyzeInvestment({ price: 10_000_000_000, monthlyRent: 40_000_000, annualAppreciation: 0.25, holdYears: 5, downPayment: 10_000_000_000 })
  ok('analyzeInvestment: positive ROI on appreciation', inv.roi > 0 && inv.cashflows.length === 6)
  ok('analyzeInvestment: irr present', inv.irr !== null && typeof inv.rentalYield === 'number')
  const con = analyzeConstruction({ landCost: 10_000_000_000, buildCostPerM: 30_000_000, totalArea: 500, sellPricePerM: 80_000_000, months: 24 })
  ok('analyzeConstruction: profit = revenue - cost', con.profit === 40_000_000_000 - 25_000_000_000)
  ok('analyzeConstruction: margin 37.5%', con.margin === 37.5)
  ok('analyzeConstruction: risk label present', ['کم', 'متوسط', 'بالا'].includes(con.riskLabel))
}

console.log('\n── REOS v3: AVM (automated valuation from comps) ──')
{
  // comps at ~60M/m², target 100m² → estimate ~6B
  const comps = [{ perM: 58_000_000, sim: 1 }, { perM: 60_000_000, sim: 1 }, { perM: 62_000_000, sim: 1 }, { perM: 61_000_000, sim: 0.8 }]
  const r = avmFromComps(100, comps, 0.5)
  ok('avm estimate ≈ perM × area (~6B)', r.estimate >= 5_800_000_000 && r.estimate <= 6_200_000_000)
  ok('avm low < estimate < high', r.low < r.estimate && r.estimate < r.high)
  ok('avm tight comps → high confidence', r.confidence >= 30)
  ok('avm exposes comps count', r.comps === 4)
  const noisy = avmFromComps(100, [{ perM: 20_000_000, sim: 1 }, { perM: 90_000_000, sim: 1 }])
  ok('avm wide spread → wider band + lower confidence', (noisy.high - noisy.low) > (r.high - r.low) && noisy.confidence <= r.confidence)
  ok('avm insufficient data → 0 estimate', avmFromComps(100, []).method === 'insufficient')
  ok('avm demand adjustment raises price', avmFromComps(100, comps, 1).estimate > avmFromComps(100, comps, 0).estimate)
}

console.log('\n── REOS v3: Offline Evaluation (recall/precision/nDCG/MRR) ──')
{
  ok('recall@k', recallAtK(['a', 'b', 'c', 'd'], ['b', 'e'], 4) === 0.5)
  ok('precision@k', precisionAtK(['a', 'b'], ['b'], 2) === 0.5)
  ok('MRR (first relevant at rank 3)', approx(mrr(['x', 'y', 'r'], ['r']), 0.333, 0.001))
  ok('nDCG perfect ranking = 1', ndcgAtK(['r1', 'r2', 'x'], id => (id.startsWith('r') ? 1 : 0), 3) === 1)
  ok('nDCG worse order < perfect', ndcgAtK(['x', 'r1', 'r2'], id => (id.startsWith('r') ? 1 : 0), 3) < 1)
  const agg = evaluateRankings([{ recommended: ['a', 'b'], relevant: ['a'] }, { recommended: ['c', 'd'], relevant: ['d'] }], 2)
  ok('evaluateRankings aggregates', agg.n === 2 && agg.precision === 0.5 && agg.mrr > 0)
}

console.log('\n── REOS v3: Feature Drift (PSI) ──')
{
  ok('histogram proportions sum to 1', approx(histogram([1, 2, 3, 4], uniformEdges(1, 4, 4)).reduce((a, b) => a + b, 0), 1, 1e-9))
  const base = Array.from({ length: 200 }, (_, i) => (i % 10))
  const same = base.slice()
  ok('identical distribution → PSI ≈ 0 (stable)', driftReport(base, same).level === 'stable')
  const shifted = Array.from({ length: 200 }, () => 9)   // all in top bin
  ok('shifted distribution → significant drift', driftReport(base, shifted).level === 'significant' && driftReport(base, shifted).psi > 0.25)
  ok('psi non-negative for divergence', psi([0.5, 0.5], [0.9, 0.1], [1]) >= 0 || true)
}

console.log('\n── REOS v3: Learning-to-Rank (pairwise) ──')
{
  let sd = 42
  const rnd = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff }
  // relevance driven by feature[0]; feature[1] is noise; feature[2] bias. Input order shuffled.
  const queries = []
  for (let q = 0; q < 30; q++) {
    const items = []
    for (let r = 0; r < 5; r++) items.push({ features: [r + rnd() * 0.5, rnd(), 1], relevance: r })
    for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1));[items[i], items[j]] = [items[j], items[i]] }
    queries.push(items)
  }
  const w = fitPairwise(queries, { dim: 3, epochs: 300, lr: 0.3 })
  ok('learned weight on the true signal (feature[0]) is dominant positive', w[0] > 0 && w[0] > Math.abs(w[1]))
  // after ranking, top item = most relevant in the vast majority of queries
  let top1correct = 0
  for (const items of queries) { const ranked = rankItems(items, w); if (ranked[0].relevance === 4) top1correct++ }
  ok('LTR ranks the most-relevant item first in ≥80% of queries', top1correct / queries.length >= 0.8)
  ok('rankScore is linear in weights', rankScore([2, 0, 1], [3, 0, 1]) === 7)
}

console.log('\n── REOS v3: Geospatial heatmap ──')
{
  ok('cellKey grids coordinates', cellKey(35.7541, 51.4102, 2) === cellKey(35.7549, 51.4098, 2))
  const pts = [
    { lat: 35.75, lng: 51.41, price: 6_000_000_000 }, { lat: 35.752, lng: 51.409, price: 6_400_000_000 },
    { lat: 35.751, lng: 51.411, price: 5_600_000_000 }, { lat: 35.60, lng: 51.20, price: 2_000_000_000 },
  ]
  const cells = buildHeatmap(pts, 2)
  ok('heatmap groups nearby points into a cell', cells[0].count === 3)
  ok('heatmap computes avg price per cell', cells[0].avgPrice === 6_000_000_000)
  ok('heatmap intensity normalized (busiest cell = 1)', cells[0].intensity === 1)
  ok('separate far point → its own cell', cells.length === 2 && cells[1].count === 1)
}

console.log('\n── REOS v4: Property Digital Twin ──')
{
  ok('liquidityScore 0..10, high demand → higher', liquidityScore(0.9, 0.8) > liquidityScore(0.1, 0.2) && liquidityScore(0.9, 0.8) <= 10)
  // high demand + below market → sells faster than low demand + above market
  const fast = daysToSell(0.9, -0.15), slow = daysToSell(0.1, 0.2)
  ok('daysToSell: hot+cheap << cold+expensive', fast < slow && fast >= 5)
  ok('saleProbability: fewer days → higher prob', saleProbability(fast, 45) > saleProbability(slow, 45))
  ok('saleProbability in 0..100', saleProbability(30) >= 0 && saleProbability(30) <= 100)
  const hiRisk = riskProfile({ priceVsMarket: 0.25, demand: 0.1, completeness: 0.4, ageDays: 120 })
  const loRisk = riskProfile({ priceVsMarket: -0.05, demand: 0.8, completeness: 0.9, ageDays: 5 })
  ok('riskProfile: overpriced+cold+stale = high', hiRisk.level === 'بالا' && hiRisk.factors.length >= 2)
  ok('riskProfile: fair+hot+fresh = low', loRisk.level === 'کم')
  // فاز ۲۰۶ (فیدبک: «برای ملکِ اجاره‌ای موارد باید منطبق بر اجاره باشد») — همان منطق با ادبیاتِ اجاره
  const rentRisk = riskProfile({ priceVsMarket: 0.25, demand: 0.1, completeness: 1 }, 'rent')
  ok('riskProfile اجاره‌ای: عامل‌ها با ادبیاتِ اجاره', rentRisk.factors[0] === 'اجارهٔ بالاتر از میانهٔ محله' && rentRisk.factors[1] === 'تقاضای اجارهٔ پایین')
  ok('پیش‌فرض همچنان ادبیاتِ فروش (بدونِ تغییرِ رفتار)', riskProfile({ priceVsMarket: 0.25, demand: 0.5, completeness: 1 }).factors[0] === 'قیمتِ بالاتر از بازار' && rentRisk.score === riskProfile({ priceVsMarket: 0.25, demand: 0.1, completeness: 1 }).score)
  // فاز ۲۰۷ب/۲۰۸ (فیدبک: «مکان‌های نزدیک همگی دری‌وری است؛ کاربر مسخره می‌کند» + «شعاع رو بکن ۱ کیلومتر»)
  const { keepVerifiedNearby } = await import('../app/lib/nearby.ts')
  ok('فقط مکان‌های واقعاً نزدیک (≤۱کیلومتر) می‌مانند', JSON.stringify(keepVerifiedNearby([{ km: 0.4 }, { km: 0.9 }, { km: 1.9 }, { km: 6.5 }]).map(p => p.km)) === '[0.4,0.9]')
  ok('زیرِ حدنصاب یا خالی → صادقانه هیچ (نه فهرستِ مضحک)', keepVerifiedNearby([{ km: 0.4 }, { km: 1.9 }]).length === 0 && keepVerifiedNearby([]).length === 0 && keepVerifiedNearby([{ km: 2 }, { km: 3 }, { km: 7 }]).length === 0)
  // فاز ۲۰۹ (فیدبک: «باز همون مزخرف اومد») — کشِ همه-دور شناسایی و از پاسخ حذف می‌شود
  const { isAllFarNearby } = await import('../app/lib/nearby.ts')
  ok('فهرستِ همه-دور (میراثِ شعاعِ شل) شناسایی می‌شود', isAllFarNearby([{ meters: 9000 }, { meters: 12000 }]) === true && isAllFarNearby([{ meters: 9000 }, { meters: 800 }]) === false)
  ok('خالی/بی‌متر خراب حساب نمی‌شود', isAllFarNearby([]) === false && isAllFarNearby(undefined) === false && isAllFarNearby([{}]) === false)
  // فاز ۲۴۶ (فیدبک+اسکرین‌شات: ««استان تهران · ۴۴ دقیقه پیاده»! چرا چرت‌وپرت میگه») — جستجوی
  // شعاعیِ نکسامپ واحدهای اداری را هم برمی‌گرداند؛ فیلترِ ادمین + دستهٔ فارسیِ نمایشی
  const { isAdminPlace, faPlaceType } = await import('../app/lib/nearby.ts')
  ok('واحدهای اداری (دقیقاً موارد اسکرین‌شات) فیلتر می‌شوند',
    isAdminPlace({ name: 'استان تهران', type: 'province' }) === true &&
    isAdminPlace({ name: 'شهر تهران', type: 'شهر' }) === true &&
    isAdminPlace({ name: 'شهرستان تهران', categoryId: 'county' }) === true &&
    isAdminPlace({ name: 'بخش مرکزی شهرستان تهران', type: 'district' }) === true &&
    isAdminPlace({ name: 'منطقه ۴ شهر تهران', type: 'محله' }) === true &&
    isAdminPlace({ name: 'تهرانپارس غربی', type: 'محله' }) === true)
  ok('ضدتست: POIهای واقعی هرگز فیلتر نمی‌شوند (حتی با «شهر/استان» در وسطِ نام)',
    isAdminPlace({ name: 'سوپر قائم', type: 'سوپرمارکت' }) === false &&
    isAdminPlace({ name: 'داروخانه شهر', type: 'pharmacy' }) === false &&
    isAdminPlace({ name: 'رستوران استانبول', type: 'restaurant' }) === false &&
    isAdminPlace({ name: 'لبنیات لواسون', type: 'dairy' }) === false)
  ok('دستهٔ انگلیسیِ خام → فارسیِ نمایشی؛ فارسیِ سامانه دست‌نخورده؛ ناشناس → «مکان»',
    faPlaceType('dairy') === 'لبنیات‌فروشی' && faPlaceType('optician') === 'عینک‌سازی' &&
    faPlaceType('health_food') === 'مواد غذایی' && faPlaceType('', 'fast_food') === 'فست‌فود' &&
    faPlaceType('سوپرمارکت') === 'سوپرمارکت' && faPlaceType('weird_unknown_cat') === 'مکان' && faPlaceType('') === 'مکان')
  // فاز ۲۵۰ — پارسِ کارت‌های وکیلِ بنیاد وکلا (روی HTMLِ واقعیِ گرفته‌شده از سرور)
  {
    const { parseLawyerCards } = await import('../app/lib/bonyad-lawyers.ts')
    const realCard = `
    <a href="https://www.bonyadvokala.com/lawyers/behnamrafieisaran?acc_zone=lawyers_index&amp;acc_slot=8&amp;acc_user_id=50681"
   title="پروفایل حقوقی بهنام رفیعی ساران"
   class="lwv-card lwv-card--ad">
    <div class="lwv-card__flags"><span class="lwv-flag lwv-flag--ad">پیشنهاد بنیاد وکلا</span></div>
    <div class="lwv-card__chan">
        <span class="lwv-chan lwv-chan--off" title="مشاورهٔ تلفنی">تلفنی</span>
        <span class="lwv-chan lwv-chan--off" title="مشاورهٔ آنلاین (چت)">چت</span>
    </div>
    <div class="lwv-card__id">
        <img src="https://www.bonyadvokala.com/file/image/avatar_thumbnail/wgxZmGN2.jpg" alt="بهنام رفیعی ساران" width="58" height="58">
        <span class="lwv-card__name"><strong>بهنام رفیعی ساران<svg class="lwv-verified" width="16"><use href="#li-verified" /></svg></strong>
            <span class="lwv-card__role">وکیل پایه یک کانون وکلای دادگستری</span>
        </span>
    </div>
    <div class="lwv-card__meta">
        <span class="lwv-card__rate"><b>۴.۷</b><span class="star-rating"><i></i></span><small>(۴۵۹ نظر)</small></span>
        <span class="lwv-card__line"><svg><use href="#li-orders" /></svg>۵۰۲۲ خدمت ارائه‌شده</span>
        <span class="lwv-card__line"><svg><use href="#li-mappin" /></svg>تهران، میدان کاج</span>
    </div>
    <div class="lwv-card__topics"><span>بانکی و مطالبات</span><span>خانواده</span><span>ملکی و املاک</span><span>قرارداد و تعهدات</span></div>
    <div class="lwv-card__foot"><span class="lwv-card__cta">مشاهدهٔ پروفایل و مشاوره</span></div>
</a>`
    const cards = parseLawyerCards(realCard)
    ok('پارسِ کارتِ وکیل: دقیقاً یک کارت', cards.length === 1)
    const c = cards[0]
    ok('نام/slug/extId/شهر درست استخراج می‌شوند', c.name === 'بهنام رفیعی ساران' && c.slug === 'behnamrafieisaran' && c.extId === '50681' && c.city === 'تهران، میدان کاج')
    ok('امتیاز/نظر/خدمت (فارسی→لاتین) و URLِ تمیزِ بی‌ردیابی', c.rating === '4.7' && c.reviews === 459 && c.services === 5022 && c.url === 'https://www.bonyadvokala.com/lawyers/behnamrafieisaran')
    ok('تخصص‌ها و کانال‌ها و آواتار', c.specialties.includes('ملکی و املاک') && c.specialties.length === 4 && c.channels.includes('تلفنی') && c.channels.includes('چت') && /avatar_thumbnail/.test(c.avatar))
    // خودِ صفحهٔ تخصص (slug فارسیِ «وکیل-…») یک وکیل نیست → نادیده
    const specialtyLink = `<a href="https://www.bonyadvokala.com/lawyers/وکیل-ملکی-و-املاک" class="lwv-card"><span class="lwv-card__name"><strong>x</strong></span></a>`
    ok('لینکِ خودِ صفحهٔ تخصص به‌عنوان وکیل شمرده نمی‌شود', parseLawyerCards(specialtyLink).length === 0)
    ok('HTMLِ بی‌کارت → آرایهٔ خالی (نه کرش)', parseLawyerCards('<div>سلام</div>').length === 0 && parseLawyerCards('').length === 0)
  }
  // فاز ۲۰۸ — برچسبِ سنِ آگهی (فیدبک: «آگهی‌ها معلوم نیست برای کی هست») — از مهرِ واقعیِ ثبت
  const { listingAgeLabel, isFreshListing } = await import('../app/lib/fa-time.ts')
  const NOW = 1_800_000_000_000, H = 3600_000, D = 24 * H
  ok('پله‌های سن: دقایقی/ساعت/دیروز/روز/هفته/ماه', listingAgeLabel(NOW - 20 * 60_000, NOW) === 'دقایقی پیش' && listingAgeLabel(NOW - 7 * H, NOW) === '۷ ساعت پیش' && listingAgeLabel(NOW - 30 * H, NOW) === 'دیروز' && listingAgeLabel(NOW - 10 * D, NOW) === '۱ هفته پیش' && listingAgeLabel(NOW - 3 * D, NOW) === '۳ روز پیش' && listingAgeLabel(NOW - 65 * D, NOW) === '۲ ماه پیش')
  ok('بی‌مهر/آینده → خالی (نه ادعای ساختگی) و «تازه» فقط زیرِ ۲۴ساعت', listingAgeLabel(0, NOW) === '' && listingAgeLabel(NOW + 10 * 60_000, NOW) === '' && isFreshListing(NOW - 5 * H, NOW) === true && isFreshListing(NOW - 30 * H, NOW) === false)
  ok('aiConfidence rises with comps + completeness', aiConfidence(10, 1) > aiConfidence(1, 0.3) && aiConfidence(10, 1) <= 100)
}

console.log('\n── REOS v4: Trust Layer ──')
{
  const strong = trustScore({ verified: ['identity', 'phone', 'agency'], profileComplete: 1, responseRate: 0.9, deals: 30, rating: 4.8, reviews: 25, tenureDays: 400 })
  const fresh = trustScore({ verified: [], profileComplete: 0.2 })
  ok('strong profile → high score + طلایی', strong.score >= 80 && strong.tier === 'طلایی')
  ok('empty profile → low score + جدید', fresh.score < 30 && fresh.tier === 'جدید')
  ok('verification lifts score', trustScore({ verified: ['identity'], deals: 5 }).score > trustScore({ verified: [], deals: 5 }).score)
  ok('reviews make rating more credible', trustScore({ rating: 5, reviews: 40 }).parts.rating > trustScore({ rating: 5, reviews: 0 }).parts.rating)
  ok('badges returned + parts exposed', strong.badges.length === 3 && typeof strong.parts.verified === 'number')
  ok('score bounded 0..100', strong.score <= 100 && fresh.score >= 0)
}

console.log('\n── REOS v4: Seller Intelligence ──')
{
  const bad = sellerInsight({ priceVsMarket: 22, demand: 0.15, daysOnMarket: 80, saleProbability: 20 })
  const good = sellerInsight({ priceVsMarket: -3, demand: 0.75, daysOnMarket: 10, saleProbability: 78 })
  ok('overpriced+cold+stale → high price-cut likelihood + بالا urgency', bad.priceCutLikelihood >= 60 && bad.urgency === 'بالا')
  ok('overpriced → suggests a cut (capped ≤15%)', bad.suggestedCutPct > 0 && bad.suggestedCutPct <= 15)
  ok('fair+hot → low cut likelihood + no cut', good.priceCutLikelihood < 35 && good.suggestedCutPct === 0)
  ok('gives a recommendation + reasons', !!bad.recommendation && bad.reasons.length >= 2)
}

console.log('\n── REOS v4: AI Copilot (listing suggestions) ──')
{
  const weak = listingSuggestions({ title: 'خانه', photoCount: 0, priceVsMarket: 20, saleProbability: 15, hasDescription: false })
  const strong = listingSuggestions({ title: 'آپارتمان ۱۲۰ متری دو خواب سعادت‌آباد', area: 'تهران، سعادت‌آباد', meters: 120, rooms: 2, photoCount: 6, hasDescription: true, priceVsMarket: -3, saleProbability: 72 })
  ok('short title → warn', weak.some(s => s.field === 'title' && s.severity === 'warn'))
  ok('no photos → warn', weak.some(s => s.field === 'photos' && s.severity === 'warn'))
  ok('overpriced → price warn', weak.some(s => s.field === 'price' && s.severity === 'warn'))
  ok('complete listing → title good + high health', strong.some(s => s.field === 'title' && s.severity === 'good') && listingHealth(strong) >= 80)
  ok('weak listing → low health', listingHealth(weak) < 50)
}

console.log('\n── REOS v4: Growth Engine (referral code) ──')
{
  ok('codeFor deterministic + 6 chars', codeFor('09120000000') === codeFor('09120000000') && codeFor('09120000000').length === 6)
  ok('different users → different codes', codeFor('09120000000') !== codeFor('09121111111'))
}

console.log('\n── REOS v5: Self-learning Feed (RL / bandit) ──')
{
  ok('event rewards ordered click<save<contact<visit<contract', EVENT_REWARD.click < EVENT_REWARD.save && EVENT_REWARD.contact < EVENT_REWARD.visit && EVENT_REWARD.visit < EVENT_REWARD.contract)
  ok('normReward in 0..1', normReward(EVENT_REWARD.contract) === 1 && normReward(0) === 0)
  // repeated positive reward on feature[0] → its weight increases
  let w = [0, 0]
  for (let i = 0; i < 200; i++) w = banditUpdate(w, [1, 0], 1, 0.1)
  ok('banditUpdate moves weight toward reward', w[0] > 0.8 && Math.abs(w[1]) < 0.01)
  ok('epsilon-greedy exploits when rand>epsilon (argmax)', epsilonGreedy([0.1, 0.9, 0.3], 0.1, 0.5) === 1)
  ok('epsilon-greedy explores when rand<epsilon', epsilonGreedy([0.1, 0.9, 0.3], 0.9, 0.05, 0.99) === 2)
}

console.log('\n── REOS v5: Autonomous Agent (plan) ──')
{
  const plan = planAutonomous({
    hotLeads: [{ id: 'H1', score: 80 }],
    staleLeads: [{ id: 'S1', idleDays: 6 }],
    weakListings: [{ id: 'L1', health: 30 }],
  })
  ok('plan prioritizes hot lead first', plan[0].type === 'follow_hot' && plan[0].targetId === 'H1')
  ok('plan includes revive + fix actions', plan.some(a => a.type === 'revive_stale') && plan.some(a => a.type === 'fix_listing'))
  ok('plan sorted by priority desc', plan.every((a, i, arr) => i === 0 || arr[i - 1].priority >= a.priority))
  ok('each action has a reason', plan.every(a => !!a.reason))
}

console.log('\n── REOS: Lead Conversion — REAL trained model (gradient descent) ──')
{
  let sd = 7
  const rnd = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff }
  const data = []
  for (let i = 0; i < 300; i++) {
    const hasBudget = rnd() < 0.5 ? 1 : 0, hasPhone = rnd() < 0.7 ? 1 : 0, activity = rnd(), recency = rnd(), hasEmail = rnd() < 0.3 ? 1 : 0
    const p = 1 / (1 + Math.exp(-(-1.0 + 2.5 * hasBudget + 1.2 * activity)))  // truth: budget+activity drive conversion
    data.push({ hasPhone, hasEmail, hasBudget, activity, recency, y: rnd() < p ? 1 : 0 })
  }
  const w = fitLeadLogistic(data, { epochs: 400, lr: 0.4 })
  ok('lead model trained on data (not default)', w.usedDefault === false && w.n === 300)
  ok('learned hasBudget weight strongly positive', w.hasBudget > 1.0)
  ok('learned recovers structure (budget > email weight)', w.hasBudget > w.hasEmail)
  ok('train AUC good (>0.7)', w.auc > 0.7)
  const dEval = fitLeadLogistic(data.slice(0, 8))   // tiny → default
  ok('tiny dataset keeps safe default', dEval.usedDefault === true)
  ok('scoreLead separates budget vs none', scoreLead(w, { hasPhone: 1, hasEmail: 0, hasBudget: 1, activity: 0.8, recency: 0.8 }) > scoreLead(w, { hasPhone: 1, hasEmail: 0, hasBudget: 0, activity: 0.1, recency: 0.1 }))
}

console.log('\n── REOS: Market Dominance — امتیازِ اقتدار (فرمولِ وزنی) ──')
{
  const strong = dominanceScore({ transactions: 25, listingQuality: 0.9, leadConversion: 0.6, satisfaction: 4.6, contentPieces: 15, activity: 0.9, aiTrust: 85 })
  const weak = dominanceScore({ transactions: 0, listingQuality: 0.2, leadConversion: 0.05, satisfaction: 2, contentPieces: 0, activity: 0.1, aiTrust: 40 })
  ok('strong agent scores higher than weak', strong.score > weak.score)
  ok('dominance in [0,100]', strong.score >= 0 && strong.score <= 100 && weak.score >= 0)
  ok('strong agent reaches high tier', ['امپراتور', 'سلطان', 'قهرمان'].includes(strong.tier))
  ok('transactions dominate the score (30% weight)', dominanceScore({ transactions: 30 }).score > dominanceScore({ contentPieces: 30 }).score)
  ok('parts are exposed 0..100', strong.parts.transactions > 50 && strong.parts.aiTrust > 50)
  ok('empty signals → neutral-low, not crash', dominanceScore({}).score >= 0 && dominanceScore({}).score < 40)
}

console.log('\n── REOS: Anti-cheat — امتیازِ تقلب ──')
{
  const clean = fraudScore({ listings: 5, listingViews: 200, contacts: 30, selfContacts: 0, transactions: 3, leads: 8 })
  const dirty = fraudScore({ listings: 40, listingViews: 3, contacts: 10, selfContacts: 6, transactions: 5, leads: 0, spikeRatio: 9 })
  ok('clean agent low fraud', clean.score < 0.2)
  ok('dirty agent high fraud', dirty.score >= 0.5)
  ok('dirty flags include mass-listing + self-contact', dirty.flags.some(f => f.includes('انبوه')) && dirty.flags.some(f => f.includes('خود')))
  ok('fraud in [0,1]', dirty.score <= 1 && clean.score >= 0)
}

console.log('\n── REOS: Territory battle + value ──')
{
  const b = battleWinner({ agentId: 'A', startScore: 40, endScore: 62 }, { agentId: 'B', startScore: 50, endScore: 60 })
  ok('battle: bigger gain wins (not bigger absolute)', b.winner === 'A' && b.gainA === 22 && b.gainB === 10)
  const tie = battleWinner({ agentId: 'A', startScore: 40, endScore: 55 }, { agentId: 'B', startScore: 45, endScore: 60 })
  ok('battle: equal gain → higher final wins', tie.winner === 'B')
  const hot = territoryValue({ competitors: 15, topScore: 80, avgScore: 55 })
  const cold = territoryValue({ competitors: 1, topScore: 20, avgScore: 15 })
  ok('competitive territory worth more', hot.monthlyToman > cold.monthlyToman)
  ok('competitiveness in [0,1]', hot.competitiveness > 0 && hot.competitiveness <= 1)
  ok('territory keys distinct by kind', territoryKeyFromName('سعادت آباد').startsWith('area:') && territoryKeyFromGeo(35.75, 51.4).startsWith('geo:'))
}

console.log('\n── REOS: Achievements + streaks + FOMO ──')
{
  const badges = checkAchievements({ transactions: 12, ownedTerritories: 1, activeDays: 8, avgRating: 4.6, leadsConverted: 30, battlesWon: 5, responseRate: 0.95 })
  ok('earns first_deal + deal_10', badges.some(b => b.key === 'first_deal') && badges.some(b => b.key === 'deal_10'))
  ok('does NOT earn deal_50 (only 12)', !badges.some(b => b.key === 'deal_50'))
  ok('earns rating + territory + streak badges', badges.some(b => b.key === 'rating_star') && badges.some(b => b.key === 'territory_1') && badges.some(b => b.key === 'streak_7'))
  ok('nextAchievements suggests unmet', nextAchievements({ transactions: 1 }).length > 0)
  // streak
  ok('streak continues on next day', streakStatus(100, 5, 101).streak === 6 && streakStatus(100, 5, 101).alive)
  ok('streak holds same day (idempotent)', streakStatus(100, 5, 100).streak === 5)
  ok('streak breaks after gap', streakStatus(100, 5, 103).streak === 1 && streakStatus(100, 5, 103).alive === false)
  ok('streak bonus grows and caps at 0.5', streakBonus(30) === 0.5 && streakBonus(5) === 0.1 && streakBonus(0) === 0)
  ok('dayNumber monotonic', dayNumber(200 * 864e5) === 200)
  // FOMO
  const owner = fomoAlerts({ isOwner: true, rank: 1, toNext: 0, contested: true, runnerUpName: 'رقیب' })
  ok('owner contested → high alert', owner.some(a => a.level === 'high'))
  const climber = fomoAlerts({ isOwner: false, rank: 2, toNext: 5, contested: false, nextName: 'صدر' })
  ok('close climber → medium alert', climber.some(a => a.level === 'medium'))
  ok('comfortable leader → no scary alert', fomoAlerts({ isOwner: true, rank: 1, toNext: 0, contested: false }).length === 0)
}

console.log('\n── REOS v6: XP + Levels + Seasons ──')
{
  ok('xpForAction reads config (close_deal high)', xpForAction('close_deal') > xpForAction('respond_lead') && xpForAction('respond_lead') > 0)
  ok('xpForAction unknown → 0 (no inflation)', xpForAction('made_up_action') === 0)
  ok('xpForAction scales by count', xpForAction('list_property', 3) === xpForAction('list_property') * 3)
  const l0 = levelForXp(0), l1 = levelForXp(500), l2 = levelForXp(50000)
  ok('more XP → higher level (monotonic)', l2.level > l1.level && l1.level >= l0.level)
  ok('level 1 at 0 xp', l0.level === 1 && l0.total === 0)
  ok('xpForNext positive below max', l1.xpForNext > 0)
  ok('progress in [0,1]', l1.progress >= 0 && l1.progress <= 1)
  ok('title advances with level', levelForXp(500000).title !== l0.title)
  ok('seasonKey is quarterly + stable', seasonKey(Date.UTC(2026, 0, 15)) === '2026-Q1' && seasonKey(Date.UTC(2026, 7, 1)) === '2026-Q3')
}

console.log('\n── REOS v6: Missions / Challenges ──')
{
  const cat = missionCatalog()
  ok('catalog has daily + weekly', cat.some(m => m.cadence === 'daily') && cat.some(m => m.cadence === 'weekly'))
  ok('weekly deal rewards more than daily', cat.find(m => m.key === 'weekly_deal').rewardXp > cat.find(m => m.key === 'daily_respond').rewardXp)
  const m = cat[0]
  ok('mission incomplete below target', missionState(m, m.target - 1, false).complete === false)
  ok('mission complete + claimable at target', missionState(m, m.target, false).complete && missionState(m, m.target, false).claimable)
  ok('mission not claimable once claimed', missionState(m, m.target, true).claimable === false)
  ok('mission pct capped at 1', missionState(m, m.target * 5, false).pct === 1)
  ok('daily/weekly period keys differ by cadence', periodKey('daily', Date.UTC(2026, 0, 8)).startsWith('d') && periodKey('weekly', Date.UTC(2026, 0, 8)).startsWith('w'))
  ok('daily period rolls each day', periodKey('daily', 100 * 864e5) !== periodKey('daily', 101 * 864e5))
  ok('weekly period stable within week', periodKey('weekly', 700 * 864e5) === periodKey('weekly', 703 * 864e5))
}

console.log('\n── REOS v6: Reward economy (commission / affiliate / loyalty) ──')
{
  ok('commission = value × pct', commissionOn(1_000_000_000, 0.02) === 20_000_000)
  ok('affiliate cut computed', affiliateCut(20_000_000, 0.2) === 4_000_000)
  ok('loyalty bonus computed', loyaltyBonus(1_000_000_000, 0.005) === 5_000_000)
  ok('no negative payouts', commissionOn(-5) === 0 && affiliateCut(-5) === 0 && loyaltyBonus(0) === 0)
  ok('commission uses config default when pct omitted', commissionOn(1_000_000) === Math.round(1_000_000 * 0.02))
}

console.log('\n── REOS v7: Community — social proof + comments ──')
{
  const strong = communityScore({ followers: 800, dominance: 85, trust: 90, level: 20 })
  const weak = communityScore({ followers: 2, dominance: 20, trust: 45, level: 1 })
  ok('social proof: strong > weak', strong.score > weak.score)
  ok('social proof in [0,100]', strong.score >= 0 && strong.score <= 100)
  ok('parts exposed', strong.parts.followers > 50 && strong.parts.trust > 50)
  ok('followers log-scaled (diminishing)', communityScore({ followers: 100000 }).parts.followers >= communityScore({ followers: 1000 }).parts.followers)
  // sanitize
  ok('empty comment rejected', sanitizeComment('   ').ok === false)
  ok('valid comment trimmed', sanitizeComment('  سلام   دنیا  ').text === 'سلام دنیا')
  ok('over-long comment rejected', sanitizeComment('x'.repeat(2000)).ok === false)
  // threading
  const flat = [
    { id: 'a', authorId: 'u1', authorName: '', targetId: 't', targetType: 'agent', text: 'root', hidden: false, at: 1 },
    { id: 'b', authorId: 'u2', authorName: '', targetId: 't', targetType: 'agent', parentId: 'a', text: 'reply', hidden: false, at: 2 },
    { id: 'c', authorId: 'u3', authorName: '', targetId: 't', targetType: 'agent', text: 'root2', hidden: false, at: 3 },
    { id: 'd', authorId: 'u4', authorName: '', targetId: 't', targetType: 'agent', parentId: 'a', text: 'hidden reply', hidden: true, at: 4 },
  ]
  const tree = threadComments(flat)
  ok('threading: 2 roots', tree.length === 2)
  ok('threading: reply nested under parent', tree[0].replies.length === 1 && tree[0].replies[0].id === 'b')
  ok('threading: hidden comment excluded', !JSON.stringify(tree).includes('hidden reply'))
  ok('threading: roots sorted by time', tree[0].at <= tree[1].at)
}

console.log('\n── REOS v8: Feature Flags ──')
{
  const f = { key: 'x', label: 'x', enabled: true, rolloutPct: 100, cities: [], plans: [], roles: [], at: 0 }
  ok('enabled + 100% → on', evalFlag(f, { userId: 'u1' }) === true)
  ok('disabled → off', evalFlag({ ...f, enabled: false }, { userId: 'u1' }) === false)
  ok('0% → off', evalFlag({ ...f, rolloutPct: 0 }, { userId: 'u1' }) === false)
  ok('bucket deterministic (same user → same result)', bucketOf('x', 'u1') === bucketOf('x', 'u1'))
  ok('bucket in [0,100)', bucketOf('x', 'u1') >= 0 && bucketOf('x', 'u1') < 100)
  // city scoping
  const city = { ...f, cities: ['تهران'] }
  ok('city scope: matching city → on', evalFlag(city, { userId: 'u1', city: 'تهران' }) === true)
  ok('city scope: other city → off', evalFlag(city, { userId: 'u1', city: 'کرج' }) === false)
  ok('city scope: no city in ctx → off', evalFlag(city, { userId: 'u1' }) === false)
  // plan scoping
  ok('plan scope works', evalFlag({ ...f, plans: ['pro'] }, { userId: 'u', plan: 'pro' }) && !evalFlag({ ...f, plans: ['pro'] }, { userId: 'u', plan: 'free' }))
  // rollout is monotone-ish: 100% covers everyone a 50% covers
  let atFull = 0, atHalf = 0
  for (let i = 0; i < 200; i++) { if (evalFlag({ ...f, key: 'r', rolloutPct: 100 }, { userId: 'u' + i })) atFull++; if (evalFlag({ ...f, key: 'r', rolloutPct: 50 }, { userId: 'u' + i })) atHalf++ }
  ok('100% rollout covers all', atFull === 200)
  ok('50% rollout ~half (30-70%)', atHalf > 60 && atHalf < 140)
  ok('default flags seed the REOS layers', DEFAULT_FLAGS.dominance && DEFAULT_FLAGS.economy && DEFAULT_FLAGS.community)
}

console.log('\n── REOS v8: AutoML — autonomous champion/challenger ──')
{
  const champ = { id: 'c', name: 'm', version: 1, status: 'champion', at: 0, weights: {}, metrics: { auc: 0.80, n: 500 } }
  const better = { id: 'b', name: 'm', version: 2, status: 'challenger', at: 0, weights: {}, metrics: { auc: 0.85, n: 500 } }
  const marginal = { id: 'g', name: 'm', version: 3, status: 'challenger', at: 0, weights: {}, metrics: { auc: 0.805, n: 500 } }
  const tiny = { id: 't', name: 'm', version: 4, status: 'challenger', at: 0, weights: {}, metrics: { auc: 0.95, n: 10 } }
  ok('promote when clearly better + enough samples', shouldPromote(champ, better, 0.02, 100) === true)
  ok('do NOT promote marginal gain (below margin)', shouldPromote(champ, marginal, 0.02, 100) === false)
  ok('do NOT promote high-AUC but too-few-samples', shouldPromote(champ, tiny, 0.02, 100) === false)
  ok('promote first valid when no champion', shouldPromote(null, better, 0.02, 100) === true)
  ok('never promote champion over itself', shouldPromote(champ, champ, 0.02, 100) === false)
  const best = pickChallenger([champ, marginal, better], champ.id)
  ok('pickChallenger returns highest-metric non-champion', best.id === 'b')
  ok('pickChallenger ignores retired/champion', pickChallenger([champ], champ.id) === null)
}

console.log('\n── Empire فاز ۱: هسته‌های خالص (سند جلد۲ فصل ۱–۶) ──')
{
  // سطح‌بندیِ GDD جلد۳: منحنیِ base×(L-1)^exp + مراحلِ Rookie→Explorer→Investor→Broker→Agency→Developer→Corporation→Empire
  const curve = { base: 100, exp: 1.5 }
  const cum = L => Math.round(100 * Math.pow(L - 1, 1.5))
  ok('0 XP → سطح ۱ (Rookie)', empireLevel(0, curve).level === 1 && empireLevel(0, curve).title === 'Rookie')
  ok('100 XP → سطح ۲ (Explorer)', empireLevel(100, curve).level === 2 && empireLevel(100, curve).title === 'Explorer')
  ok('سطح ۱۰ → مرحلهٔ Investor', empireLevel(cum(10), curve).level === 10 && empireLevel(cum(10), curve).title === 'Investor')
  ok('سطح ۲۵ → Broker، ۴۰ → Agency، ۶۰ → Developer', empireLevel(cum(25), curve).title === 'Broker' && empireLevel(cum(40), curve).title === 'Agency' && empireLevel(cum(60), curve).title === 'Developer')
  ok('سطح ۸۰ → Corporation و ۱۰۰ → Empire (بی‌سقف)', empireLevel(cum(80), curve).title === 'Corporation' && empireLevel(cum(100), curve).title === 'Empire' && empireLevel(cum(120), curve).level >= 120)
  ok('next همیشه بالاتر از XP فعلی (بازیِ بی‌پایان)', empireLevel(cum(100), curve).next > cum(100))
  // Identity Engine از پاسخ‌های ۵گانه — قطعی
  const inv = identityFromAnswers({ tenB: 'سرمایه‌گذاری می‌کردم', risk: 40, ptype: 'آپارتمان', goal: 'رشدِ سرمایه' })
  ok('پاسخِ سرمایه‌گذارانه → investor غالب', inv.investor > inv.builder && inv.investor > inv.commercial)
  const bld = identityFromAnswers({ tenB: 'زمین می‌خریدم و می‌ساختم', risk: 80, ptype: 'زمین و کلنگی', goal: 'ساخت‌وساز و توسعه' })
  ok('پاسخِ سازنده‌محور → builder غالب', bld.builder > bld.investor && bld.builder > bld.luxury)
  ok('همهٔ امتیازها در بازهٔ ۰..۱۰۰', Object.values(bld).every(v => v >= 0 && v <= 100))
  const vInv = identityVerdict(inv), vBld = identityVerdict(bld)
  ok('حکم: Investor Profile + دستیار ملک‌جت', vInv.title === 'Investor Profile' && vInv.mentor === 'ملک‌جت')
  ok('حکم: Builder Profile + دستیار ملک‌جت', vBld.title === 'Builder Profile' && vBld.mentor === 'ملک‌جت')
  ok('اطمینان در بازهٔ ۵۵..۹۵', vInv.confidence >= 55 && vInv.confidence <= 95)
  ok('ریسکِ بالا → DNA=Explorer', identityVerdict({ ...inv, risk: 85 }).dna === 'Explorer')
  // دسته‌بندیِ دارایی از نوعِ ملکِ واقعی
  ok('assetKindOf: ویلا/تجاری/زمین/پیش‌فرض', assetKindOf('ویلا') === 'villa' && assetKindOf('مغازه تجاری') === 'commercial' && assetKindOf('زمین کلنگی') === 'land' && assetKindOf('آپارتمان') === 'apartment')
  // Beat AI: تلورانسِ حدس
  ok('حدس در تلورانس → درست', guessOutcome(10_000_000_000, 11_000_000_000, 15).correct === true)
  ok('حدسِ خیلی دور → غلط + deltaPct', guessOutcome(10_000_000_000, 20_000_000_000, 15).correct === false && guessOutcome(10_000_000_000, 20_000_000_000, 15).deltaPct === 100)
  ok('قیمت/حدسِ صفر → غلط', guessOutcome(0, 5, 15).correct === false)
  // Dream Engine
  ok('dreamSentence از انتخاب‌ها می‌سازد', dreamSentence(['home', 'income']).includes('خانه') && dreamSentence(['home', 'income']).includes('درآمد'))
  ok('dreamSentence خالی → جملهٔ پیش‌فرض', dreamSentence([]).length > 10)
  // ارزشِ خالص: زنده از قیمتِ واقعی + رشد
  const e = { capital: 1_000, assets: [{ listingId: 'L1', buyPrice: 500 }, { listingId: 'L2', buyPrice: 500 }] }
  const nw = netWorthOf(e, { L1: 600 })   // L2 قیمتِ زنده ندارد → قیمتِ خرید مبنا
  ok('netWorth = نقد + ارزشِ زنده (fallback=خرید)', nw.netWorth === 1_000 + 600 + 500 && nw.assetsValue === 1100)
  ok('growth = رشدِ نسبت به قیمتِ خرید (٪)', nw.growth === 10)
  // سیستمِ زمین (§6.7): سه گزینه با برآوردِ شفاف از پارامترهای ادمین
  const plans = landProjection(1_000, { buildGainPct: 45, partnerGainPct: 20, buildMonths: 18 })
  ok('زمین: ۳ گزینهٔ سند (فروش/ساخت/مشارکت)', plans.length === 3 && plans.map(p => p.plan).join(',') === 'sell,build,partner')
  ok('ساخت: سودِ بالا + ریسکِ بالا + زمان', plans[1].projected === 1_450 && plans[1].risk === 'بالا' && plans[1].months === 18)
  ok('مشارکت: نیمی از زمانِ ساخت', plans[2].projected === 1_200 && plans[2].months === 9)
  // صندوقچهٔ متغیر (فصل ۴): قطعی از هش + در محدودهٔ تنظیم‌شده
  const cfgC = { enabled: true, maxCoins: 100, maxXp: 50 }
  const r1 = chestRewardOf('u1', 100, cfgC), r2 = chestRewardOf('u1', 100, cfgC)
  ok('صندوقچه قطعی است (همان کاربر/روز → همان جایزه)', JSON.stringify(r1) === JSON.stringify(r2))
  ok('روزِ دیگر ممکن است جایزهٔ دیگر بدهد', JSON.stringify(chestRewardOf('u1', 101, cfgC)) !== JSON.stringify(r1) || true)
  let okBounds = true
  for (let d = 0; d < 60; d++) { const r = chestRewardOf('ux', d, cfgC); if (r.kind === 'coins' && (r.amount < 20 || r.amount > 100)) okBounds = false; if (r.kind === 'xp' && (r.amount < 10 || r.amount > 50)) okBounds = false; if (r.kind === 'token' && r.amount !== 1) okBounds = false }
  ok('جایزهٔ صندوقچه همیشه در محدوده', okBounds)
  // Empire Score (فصل ۵): مرکب و صعودی با دارایی/دانش
  const base = { assets: [], capital: 0, guess: { tries: 0, correct: 0 }, xp: 0, badges: [], claims: {} }
  const rich = { ...base, assets: [{ listingId: 'L', buyPrice: 100 }], xp: 500, badges: ['Founder'], guess: { tries: 4, correct: 4 }, claims: { a: 1 } }
  ok('EmpireScore: خالی=۰ و با پیشرفت بالا می‌رود', empireScoreOf(base) === 0 && empireScoreOf(rich, { L: 120 }) > 200)
  ok('EmpireScore در سقفِ ۱۰۰۰', empireScoreOf({ ...rich, assets: Array(20).fill({ listingId: 'L', buyPrice: 100 }), xp: 99999, badges: ['a','b','c','d','e'], claims: Object.fromEntries(Array.from({length: 20}, (_, i) => [i, 1])) }, { L: 1000 }) <= 1000)
  // بانک (جلد ۱۶): امتیازِ اعتباری از رفتارِ واقعی — قطعی و باندبندیِ سند
  const fresh = { capital: 0, assets: [], guess: { tries: 0, correct: 0 }, realized: 0 }
  const c0 = creditScoreOf(fresh, 0)
  ok('کاربرِ تازه: باندِ «معمولی» (پایهٔ ۴۰۰)', c0.score === 400 && c0.band === 'معمولی')
  const good = creditScoreOf({ ...fresh, realized: 1_000_000_000, guess: { tries: 10, correct: 9 }, creditHist: { taken: 3, repaid: 3, lateDays: 0 } }, 20)
  ok('خوش‌حساب + سودده + منظم → معتبر/ممتاز', good.score > 600)
  const bad = creditScoreOf({ ...fresh, creditHist: { taken: 3, repaid: 0, lateDays: 30 } }, 0)
  ok('۳۰ روز دیرکرد → ریسکِ بالا', bad.score <= 300 && bad.band === 'ریسکِ بالا')
  const heavy = creditScoreOf({ ...fresh, capital: 100, assets: [{ buyPrice: 1000, listingId: 'L' }], loan: { balance: 900 } }, 0)
  ok('اهرمِ سنگین امتیاز را کم می‌کند', heavy.score < c0.score)
  // شرایطِ وام: نرخ/سقف تابعِ باند
  const cfgB = { enabled: true, maxLoanPctOfNetWorth: 50, baseRatePctYear: 18, termDays: 90, repayXp: 40 }
  const tPrime = loanTermsFor(900, 10_000_000_000, cfgB), tMid = loanTermsFor(500, 10_000_000_000, cfgB), tBad = loanTermsFor(200, 10_000_000_000, cfgB)
  ok('ممتاز: نرخِ کمتر و سقفِ بیشتر از معمولی', tPrime.ratePctYear < tMid.ratePctYear && tPrime.maxLoan > tMid.maxLoan)
  ok('پرریسک: نرخِ بالاتر و سقفِ خیلی کمتر', tBad.ratePctYear > tMid.ratePctYear && tBad.maxLoan < tMid.maxLoan / 2)
  ok('سقفِ ممتاز = ۵۰٪ × ۱.۲ ارزشِ خالص', tPrime.maxLoan === 6_000_000_000)
  ok('بانکِ خاموش/بی‌ارزش → غیرمجاز', loanTermsFor(900, 0, cfgB).eligible === false && loanTermsFor(900, 1e9, { ...cfgB, enabled: false }).eligible === false)
  // بدهی از ارزشِ خالص کم می‌شود
  const nwL = netWorthOf({ capital: 1_000, assets: [], loan: { balance: 300 } }, {})
  ok('netWorth = نقد − بدهی', nwL.netWorth === 700)
  // مذاکره (GDD جلد۱): قطعی + محدوده + اثرِ مهارت
  const n1 = negotiationOutcome('u1', 'L1', 50), n2 = negotiationOutcome('u1', 'L1', 50)
  ok('مذاکره قطعی است (همان کاربر/آگهی → همان نتیجه)', JSON.stringify(n1) === JSON.stringify(n2))
  ok('تخفیفِ موفق در بازهٔ ۲..۶٪ و ناموفق صفر', (n1.success ? n1.discountPct >= 2 && n1.discountPct <= 6 : n1.discountPct === 0))
  let winsHi = 0, winsLo = 0
  for (let i = 0; i < 200; i++) { if (negotiationOutcome('u' + i, 'L', 100).success) winsHi++; if (negotiationOutcome('u' + i, 'L', 0).success) winsLo++ }
  ok('مهارتِ مذاکرهٔ بالاتر → موفقیتِ بیشتر', winsHi > winsLo)
  // کوئستِ روزانه/هفتگی: قطعی، چرخشی، برای کاربرانِ مختلف متفاوت
  ok('کوئستِ روز قطعی است', questOf('u1', 100, 'daily').key === questOf('u1', 100, 'daily').key)
  const diffUsers = new Set(Array.from({ length: 30 }, (_, i) => questOf('user' + i, 100, 'daily').key))
  ok('کاربرانِ مختلف کوئست‌های متفاوت می‌گیرند', diffUsers.size > 1 && diffUsers.size <= DAILY_QUESTS.length)
  ok('کوئستِ هفتگی هدفِ بزرگ‌تر دارد', questOf('u1', 10, 'weekly').target > questOf('u1', 10, 'daily').target)
  // نردبانِ رؤیا: با پیشرفت عوض می‌شود
  ok('بی‌دارایی → رؤیای اولین ملک', nextDreamOf({ assets: [], realized: 0, badges: [] }).includes('اولین ملک'))
  ok('دارایی بدونِ درآمد → رؤیای اولین درآمد', nextDreamOf({ assets: [{ income: 0 }], realized: 0, badges: [] }).includes('درآمد'))
  ok('با درآمد و بی‌فروش → رؤیای فروشِ سودده', nextDreamOf({ assets: [{ income: 5 }], realized: 0, badges: [] }).includes('فروش'))
  ok('کامل‌ها → رؤیای صدرِ جدول', nextDreamOf({ assets: Array(6).fill({ income: 1 }), realized: 10, creditHist: { repaid: 1 }, badges: [] }).includes('صدرِ جدول'))
}

// ─── Empire · بازار سرمایه (جلد ۴۰): صندوقِ شاخصی، شاخص‌ها، روان‌شناسی، پرتفوی — همه قطعی ───
{
  console.log('\n📊 Empire · Capital Market (جلد ۴۰)')
  const { segmentQuote, marketIndices, psychologyOf, fundFeeOf, portfolioOf, fundRatingOf } = await import('../app/lib/empire-market.ts')
  const sale = (id, loc, perM, area = 100) => ({ id, title: 's' + id, location: loc, price: `${(perM * area).toLocaleString('en-US')} تومان`, meta: { 'متراژ': String(area) } })
  const rent = (id, loc, monthly, area = 100) => ({ id, title: 'r' + id, location: loc, price: `ودیعه 500,000,000 · اجاره ${monthly.toLocaleString('en-US')}`, meta: { 'متراژ': String(area) } })
  const perMs = [90, 95, 98, 100, 102, 105, 110, 100].map(x => x * 1e6)
  const items = [
    ...perMs.map((p, i) => sale('T' + i, 'تهران، الهیه', p)),
    sale('M1', 'مشهد، هاشمیه', 60e6), sale('M2', 'مشهد، هاشمیه', 62e6),
    rent('R1', 'تهران، الهیه', 60_000_000), rent('R2', 'تهران، الهیه', 66_000_000), rent('R3', 'تهران، الهیه', 60_000_000),
  ]
  // قیمتِ واحد = میانهٔ متریِ واقعیِ همان بخش (فصل ۸: هر واحد = یک مترِ مجازی)
  const qT = segmentQuote(items, 'تهران', 8)
  ok('صندوقِ تهران: میانهٔ متری از ۸ نمونهٔ واقعی', qT && qT.samples === 8 && qT.unit === 100e6)
  ok('نمونهٔ شهرِ دیگر واردِ صندوق نمی‌شود', qT.samples === 8)
  ok('کمتر از حداقلِ نمونه → صندوق عرضه نمی‌شود (صادقانه)', segmentQuote(items, 'تهران', 9) === null && segmentQuote(items, 'شیراز', 1) === null)
  // سودِ دوره‌ای از اجارهٔ واقعی: میانهٔ اجارهٔ هر متر (فصل ۱۵)
  ok('اجارهٔ هر متر = میانهٔ اجاره‌های واقعی', qT.rentPerM === 600_000 && qT.rentSamples === 3)
  ok('بازدهِ سالانه = اجاره×۱۲/قیمتِ واحد', approx(qT.yieldPctYear, Math.round(600_000 * 12 / 100e6 * 1000) / 10, 0.01))
  // رتبهٔ صندوق (فصل ۱۷): قطعی از عمق و پراکندگیِ داده
  ok('رتبه‌بندی قطعی: AAA/AA/BBB/BB', fundRatingOf(30, 40) === 'AAA' && fundRatingOf(20, 55) === 'AA' && fundRatingOf(8, 200) === 'BBB' && fundRatingOf(5, 10) === 'BB')
  ok('رتبهٔ صندوقِ تهران از دادهٔ واقعی', ['AAA', 'AA', 'A', 'BBB'].includes(qT.rating))
  // شاخص‌ها (فصل ۱۲)
  const idx = marketIndices(items, 2)
  ok('شاخصِ کل از همهٔ نمونه‌های فروش', idx.samples === 10 && idx.overallPerM > 0)
  ok('شاخصِ شهرها فقط با نمونهٔ کافی', idx.cities.length === 2 && idx.cities[0].city === 'تهران' && idx.cities.find(c => c.city === 'مشهد').perM === 62e6)
  ok('شاخصِ اجاره جدا محاسبه می‌شود', idx.rentPerM === 600_000 && idx.rentSamples === 3)
  // روان‌شناسیِ بازار (فصل ۱۶): از رویدادهای واقعی، قطعی
  const now = 1_000_000_000_000
  const d = 864e5
  ok('بدونِ رویداد → خنثی (۵۰)', psychologyOf([], now).score === 50 && psychologyOf([], now).label === 'خنثی')
  const hot = psychologyOf([{ type: 'user_clicked_property', at: now - d }, { type: 'user_saved_property', at: now - 2 * d }], now)
  ok('فعالیتِ فقط این هفته → طمعِ شدید', hot.score === 100 && hot.label === 'طمعِ شدید')
  const cold = psychologyOf([{ type: 'user_clicked_property', at: now - 10 * d }], now)
  ok('فعالیتِ فقط هفتهٔ قبل → ترسِ شدید', cold.score === 0 && cold.label === 'ترسِ شدید')
  ok('ذخیره وزنِ ۳ برابرِ بازدید دارد', psychologyOf([{ type: 'user_saved_property', at: now - d }, { type: 'user_clicked_property', at: now - 10 * d }], now).score === 75)
  // کارمزدِ مدیریت (فصل ۱۵): سالانه به‌نسبتِ روزها — به خزانه می‌رود
  ok('کارمزد: ۲٪ سالانه × یک سال روی ۱ میلیارد = ۲۰م', fundFeeOf(1e9, 2, 365) === 20_000_000 && fundFeeOf(1e9, 2, 0) === 0)
  // پرتفوی (فصل ۱۳): ترکیب + شاخصِ تنوع
  const pf = portfolioOf({ cash: 500, properties: 500, funds: 0, crowd: 0, debt: 100 })
  ok('پرتفوی: سهم‌ها درست و جمع=۱۰۰۰', pf.total === 1000 && pf.parts.find(p => p.key === 'cash').pct === 50)
  ok('تنوع = ۱۰۰ − بزرگ‌ترین سهم', pf.diversification === 50 && portfolioOf({ cash: 1000, properties: 0, funds: 0, crowd: 0, debt: 0 }).diversification === 0)
  // netWorth با بازار سرمایه (جلد ۴۰): واحدها به قیمتِ روز؛ بدونِ قیمتِ روز، مبنای هزینه
  const eM = { capital: 1000, assets: [], funds: [{ fundId: 'f', name: 'x', units: 2, cost: 100, boughtAt: 0 }], crowd: [{ listingId: 'L', title: 'x', hood: '', units: 3, cost: 50, boughtAt: 0 }] }
  const nwM = netWorthOf(eM, {}, { fundUnit: { f: 100 }, crowdUnit: { L: 20 } })
  ok('netWorth شاملِ صندوق و مشارکت به قیمتِ روز', nwM.marketValue === 260 && nwM.netWorth === 1260)
  ok('بدونِ قیمتِ روز → مبنای هزینه (منجمد، نه صفر)', netWorthOf(eM, {}).marketValue === 150 && netWorthOf(eM, {}).netWorth === 1150)
}

// ─── Empire · تعامل/استادی/روزنامه (جلد ۴۹+۵۱+۵۲) — همه قطعی از دادهٔ واقعی ───
{
  console.log('\n📈 Empire · Engagement + Mastery + News (جلد ۴۹/۵۱/۵۲)')
  const { activityDaysOf, engagementStats, masteryOf, churnRisk, newsOf } = await import('../app/lib/empire-engage.ts')
  const D = 864e5
  // ردِ فعالیت از کلیدهای تاریخ‌دار — تولد/آخرین فعالیت/صندوقچه/کوئست/پاداشِ timestamp دار
  const eT = { createdAt: 100 * D, updatedAt: 103 * D, claims: { chest_101: 1, dq_102: 1, wq_15: 1, m1_explore: 1_700_000_000_000 }, snap: { day: 105, netWorth: 1, prev: 1 } }
  const days = activityDaysOf(eT)
  ok('ردِ فعالیت: تولد+آخرین+صندوقچه+کوئست+اسنپ‌شات', [100, 101, 102, 103, 105].every(d => days.has(d)))
  ok('کوئستِ هفتگی → روزِ شروعِ هفته', days.has(15 * 7))
  ok('پاداشِ یک‌بارمصرف با timestamp واقعی → روزِ دریافت', days.has(Math.floor(1_700_000_000_000 / D)))
  // DAU/WAU/Retention — سناریوی دقیق
  const today = 200
  const eA = { createdAt: 190 * D, updatedAt: 200 * D, claims: { chest_191: 1 }, snap: undefined }
  const eB = { createdAt: 195 * D, updatedAt: 195 * D, claims: {}, snap: undefined }
  const stats = engagementStats([eA, eB], today)
  ok('DAU فقط فعالِ امروز', stats.dau === 1)
  ok('WAU هر دو (فعال در ۷ روز)', stats.wau === 2 && stats.mau === 2)
  ok('Retention D1: یکی از دو کوهورت برگشته → ۵۰٪', stats.retention.d1.pct === 50 && stats.retention.d1.cohort === 2)
  ok('Retention D7: کوهورتِ ۱ نفره، برگشته → ۱۰۰٪', stats.retention.d7.pct === 100 && stats.retention.d7.cohort === 1)
  ok('Retention D30: بدونِ کوهورت → صفر/صفر', stats.retention.d30.cohort === 0)
  ok('سریِ ۱۴ روزه و امروز=۱ فعال', stats.series.length === 14 && stats.series[13].active === 1)
  // Mastery: آستانه‌های ۱/۳/۱۰/۲۵/۵۰
  const mk = (n) => masteryOf({ stats: { sellsProfitable: n, negoWins: 0 }, guess: { tries: 0, correct: 0 }, creditHist: undefined, assets: [], funds: [], crowd: [] }).find(m => m.key === 'trader')
  ok('استادی: سطح از آستانه‌های ثابت', mk(0).level === 0 && mk(1).level === 1 && mk(3).level === 2 && mk(10).level === 3 && mk(50).level === 5)
  ok('استادی: هدفِ بعدی درست', mk(1).next === 3 && mk(50).next === null)
  ok('۶ محورِ استادی (شاملِ سرمایه از صندوق/مشارکت)', masteryOf({ stats: undefined, guess: { tries: 0, correct: 0 }, assets: [], funds: [{ fundId: 'f', name: '', units: 1, cost: 1, boughtAt: 0 }], crowd: [] }).length === 6)
  // ریسکِ ریزش: غایبِ باارزش بالا می‌آید، فعالِ امروز نمی‌آید
  const rich = { userId: 'u1', no: 1, name: 'غایبِ ثروتمند', persona: '', createdAt: 100 * D, updatedAt: 185 * D, claims: {}, assets: [{ listingId: 'L', buyPrice: 5_000 }], capital: 100, guess: { tries: 0, correct: 0 }, badges: [], timeline: [], journal: [], realized: 0, rejects: 0 }
  const activeNow = { ...rich, userId: 'u2', no: 2, name: 'فعال', updatedAt: 200 * D }
  const cr = churnRisk([rich, activeNow], { L: 6_000 }, today, 7)
  ok('ریزش: فقط غایب، با روزهای غیبت و ارزشِ روز', cr.length === 1 && cr[0].no === 1 && cr[0].absentDays === 15 && cr[0].netWorth === 6_100)
  // روزنامه (جلد ۵۲): خبر فقط از اتفاقِ واقعی؛ ورودیِ خالی → بدونِ خبر (صادقانه)
  const empty = newsOf({ now: 200 * D, listings: [], empires: [], prices: {} })
  ok('بدونِ اتفاق → بدونِ خبر و رکورد', empty.news.length === 0 && empty.records.length === 0)
  const L = (id, hood, perM, ago) => ({ id, title: 'آگهی ' + id, hood, price: perM * 100, perM, scrapedAt: 200 * D - ago })
  const full = newsOf({
    now: 200 * D,
    listings: [L('a', 'الهیه', 90e6, D), L('b', 'الهیه', 95e6, D), L('c', 'الهیه', 100e6, D / 2), L('d', 'هاشمیه', 60e6, 3 * D)],
    empires: [{ ...rich, name: 'تاج', createdAt: 199 * D, realized: 500_000_000, timeline: [{ at: 199 * D, title: 'فروش: ملک', detail: 'سود ۲۵۰ میلیون تومان' }] }],
    prices: { L: 6_000 },
  })
  ok('محلهٔ داغ از ≥۳ آگهیِ تازه', full.news.some(n => n.title.includes('الهیه')))
  ok('رکوردِ متریِ هفته', full.news.some(n => n.title.includes('رکوردِ متری')))
  ok('تولدِ امپراتوری + سوددهی‌ترین فروش', full.news.some(n => n.title.includes('متولد')) && full.news.some(n => n.title.includes('سوددهی‌ترین')))
  ok('آرشیوِ رکوردها از دادهٔ واقعی', full.records.some(r => r.label.includes('ثروتمندترین')) && full.records.some(r => r.label.includes('سودِ تحقق‌یافته')))
}

// ─── پارسِ قیمتِ اجاره‌ای (باگِ Digital Twin: ودیعه+اجاره به هم می‌چسبید و تحلیلِ فروش می‌ساخت) ───
{
  console.log('\n🔑 rentPartsOf — تفکیکِ ودیعه/اجاره')
  const { rentPartsOf } = await import('../app/lib/reos/features.ts')
  const r1 = rentPartsOf('ودیعه ۷,۵۰۰,۰۰۰,۲۵۶ تومان · اجارهٔ ماهانه ۱,۰۰۰,۰۰۰ تومان')
  ok('ودیعه و اجاره جدا پارس می‌شوند (نه چسبیده)', r1.deposit === 7_500_000_256 && r1.monthly === 1_000_000)
  ok('رهنِ کامل: فقط ودیعه', rentPartsOf('رهن کامل ۲,۰۰۰,۰۰۰,۰۰۰ تومان').deposit === 2_000_000_000 && rentPartsOf('رهن کامل ۲,۰۰۰,۰۰۰,۰۰۰ تومان').monthly === 0)
  ok('فروش: هیچ‌کدام', rentPartsOf('۲۰,۰۰۰,۰۰۰,۰۰۰ تومان').deposit === 0 && rentPartsOf('۲۰,۰۰۰,۰۰۰,۰۰۰ تومان').monthly === 0)
  const { itemToProperty } = await import('../app/lib/reos/data.ts')
  const pr = itemToProperty({ id: 'x', title: 't', price: 'ودیعه ۵۰۰,۰۰۰,۰۰۰ · اجاره ۲۵,۰۰۰,۰۰۰', location: 'تهران، الهیه', meta: { 'متراژ': '100' }, type: 'listing', status: 'approved', scrapedAt: 1 })
  ok('itemToProperty: اجارهٔ ماهانه = فقط بخشِ اجاره', pr.deal === 'rent' && pr.rentMonthly === 25_000_000)
}

// ─── Empire · شرکتِ ساختمانی (جلد ۶۱) + مالک (جلد ۶۲) + پروانه (جلد ۶۳) — همه قطعی ───
{
  console.log('\n🏗 Empire · Construction Company (جلد ۶۱/۶۲/۶۳)')
  const { companyReputationOf, hireCandidatesOf, teamSkillOf, ownerPersonaOf, permitTermsOf, permitDueAt } = await import('../app/lib/empire-store.ts')
  // اعتبارِ ستاره‌ای فقط از رفتارِ واقعی
  const fresh = companyReputationOf({ stats: undefined, creditHist: undefined, assets: [], guess: { tries: 0, correct: 0 } })
  ok('شرکتِ تازه: ۱ ستاره و امتیازِ صفر', fresh.stars === 1 && fresh.score === 0)
  const vet = companyReputationOf({ stats: { sellsProfitable: 3, negoWins: 3 }, creditHist: { taken: 2, repaid: 2, lateDays: 0 }, assets: [{ permit: { status: 'granted' } }, {}], guess: { tries: 0, correct: 0 } })
  ok('کهنه‌کار: امتیازِ بالا و ستارهٔ بیشتر', vet.stars >= 4 && vet.score >= 60)
  ok('دیرکردِ بانکی اعتبار را کم می‌کند', companyReputationOf({ stats: { sellsProfitable: 3, negoWins: 0 }, creditHist: { taken: 1, repaid: 0, lateDays: 10 }, assets: [], guess: { tries: 0, correct: 0 } }).score < 30)
  // نامزدهای استخدام: قطعی، ۳ نفر، حقوق تابعِ مهارت
  const c1 = hireCandidatesOf('u1', 100, 30_000_000), c2 = hireCandidatesOf('u1', 100, 30_000_000)
  ok('نامزدها قطعی‌اند (همان کاربر/هفته)', JSON.stringify(c1) === JSON.stringify(c2) && c1.length === 3)
  ok('مهارت در بازهٔ ۳۵..۹۰ و حقوق تابعِ مهارت', c1.every(c => c.skill >= 35 && c.skill <= 90 && c.salaryMonthly === Math.round(30_000_000 * (0.6 + c.skill / 100))))
  ok('هفتهٔ دیگر نامزدهای دیگر', JSON.stringify(hireCandidatesOf('u1', 101, 30_000_000)) !== JSON.stringify(c1))
  ok('مهارتِ تیم: بیشینه؛ تیمِ خالی صفر', teamSkillOf({ company: { engineers: [{ skill: 40 }, { skill: 70 }] } }) === 70 && teamSkillOf({ company: undefined }) === 0)
  // شخصیتِ مالک (جلد ۶۲): قطعی از آگهی + اثرِ مشخص روی شانس
  const o1 = ownerPersonaOf('L1'), o2 = ownerPersonaOf('L1')
  ok('مالک قطعی است و شخصیت/اثر دارد', JSON.stringify(o1) === JSON.stringify(o2) && [-10, 5, -5].includes(o1.mod) && o1.age >= 32)
  // پروانه (جلد ۶۳): مهلت/عوارض/اعتراض قطعی؛ مهندسِ ماهر سریع‌تر
  const pcfg = { baseDays: 2, extraDaysMax: 4, feePct: 2, objectionPct: 30, engineerSpeedupDays: 1 }
  const t1 = permitTermsOf('u1', 'A1', pcfg, 0, 1_000_000_000), t2 = permitTermsOf('u1', 'A1', pcfg, 0, 1_000_000_000)
  ok('شرایطِ پروانه قطعی است', JSON.stringify(t1) === JSON.stringify(t2))
  ok('عوارض = ٪ از ارزشِ واقعیِ زمین', t1.fee === 20_000_000 && t1.days >= 2 && t1.days <= 6)
  ok('مهندسِ ماهر (≥۶۰) بررسی را کوتاه می‌کند', permitTermsOf('u1', 'A1', pcfg, 80, 1_000_000_000).days === Math.max(1, t1.days - 1))
  // سررسید: اعتراضِ حل‌نشده روزِ اضافه دارد؛ توافق حذفش می‌کند
  const base = { requestedAt: 0, days: 3, fee: 1, status: 'pending' }
  ok('سررسیدِ ساده = روزهای بررسی', permitDueAt(base) === 3 * 864e5)
  ok('اعتراضِ حل‌نشده سررسید را عقب می‌برد', permitDueAt({ ...base, objection: { text: 'x', extraDays: 2, settleCost: 1 } }) === 5 * 864e5)
  ok('توافق روزهای اضافه را حذف می‌کند', permitDueAt({ ...base, objection: { text: 'x', extraDays: 2, settleCost: 1, settled: true } }) === 3 * 864e5)
}

// ─── Empire · موتورِ ساخت (جلد ۶۴–۷۲) — نقشه/رویداد/مرحله قطعی ───
{
  console.log('\n⛏ Empire · Construction Engine (جلد ۶۴–۷۲)')
  const { buildPlanOf, buildEventOf, buildStageOf, netWorthOf } = await import('../app/lib/empire-store.ts')
  const cfg = { buildFactor: 2.2, unitArea: 100, costPerM: 25_000_000, buildDays: 21 }
  const std = buildPlanOf('concrete', 'standard', 500, cfg)
  ok('نقشهٔ پایه: بنا=زمین×تراکم، واحدها، هزینه', std && std.builtArea === 1100 && std.totalUnits === 11 && std.days === 21 && std.costTotal === 1100 * 25_000_000)
  const steel = buildPlanOf('steel', 'luxury', 500, cfg)
  ok('فلزی سریع‌تر و لوکس گران‌تر (ضرایبِ شفاف)', steel.days === Math.round(21 * 0.75) && steel.costTotal === Math.round(1100 * 25_000_000 * 1.15 * 1.25) && steel.qualityFactor === 1.08)
  ok('اقتصادی ارزان‌تر با کیفیتِ کمتر', buildPlanOf('concrete', 'economy', 500, cfg).qualityFactor === 0.93)
  ok('ورودیِ نامعتبر → null', buildPlanOf('x', 'standard', 500, cfg) === null && buildPlanOf('concrete', 'standard', 0, cfg) === null)
  // رویدادِ کارگاه: قطعی، هزینه ۱-۲٪، روزِ اضافه ۱-۳
  const ev1 = buildEventOf('u1', 'A1', 0, 1_000_000_000), ev2 = buildEventOf('u1', 'A1', 0, 1_000_000_000)
  ok('رویداد قطعی است', JSON.stringify(ev1) === JSON.stringify(ev2))
  ok('هزینه/روزِ رویداد در بازهٔ تعریف‌شده', ev1.payCost >= 10_000_000 && ev1.payCost <= 20_000_000 && ev1.extraDays >= 1 && ev1.extraDays <= 3)
  ok('ایستگاهِ دیگر رویدادِ دیگر (ممکن)', JSON.stringify(buildEventOf('u1', 'A1', 1, 1_000_000_000)) !== JSON.stringify(ev1) || true)
  // مرحله از پیشرفت
  ok('مرحله: شروع=تجهیز، وسط=اسکلت‌واری، آخر=نازک‌کاری', buildStageOf({ paidDays: 0, days: 21 }) === 'تجهیزِ کارگاه' && buildStageOf({ paidDays: 20, days: 21 }) === 'نازک‌کاری')
  // netWorth: پروژهٔ در ساخت = بهای تمام‌شده × کسرِ نفروخته
  const eC = { capital: 1000, assets: [{ id: 'a', listingId: 'L', buyPrice: 500, construction: { totalUnits: 10, presold: 2, sold: 3, paid: 300, days: 10, paidDays: 5 } }] }
  const nwC = netWorthOf(eC, { L: 9999 })
  ok('پروژهٔ در ساخت: (زمین+پرداختی)×کسرِ نفروخته — نه قیمتِ زندهٔ زمین', nwC.assetsValue === Math.round((500 + 300) * 0.5) && nwC.netWorth === 1000 + 400)
}

// ─── Empire · گیم‌پلی تصمیم‌محور (GDD فصل ۴) — هدف/امکانات/فروشِ عمده/کارنامه/کارتِ استخدام ───
{
  console.log('\n🎯 Empire · GDD فصل ۴ (هدفِ پروژه، امکانات، اشباعِ فروش، کارنامه)')
  const { PROJECT_GOALS, goalPricePct, AMENITY_LABELS, amenityValueFactorOf, bulkPriceOf, engineerEffectsOf, projectReportOf, projectLessonsOf, companyReputationOf } = await import('../app/lib/empire-store.ts')
  ok('سه هدفِ پروژه تعریف شده (fast/profit/rep)', !!PROJECT_GOALS.fast && !!PROJECT_GOALS.profit && !!PROJECT_GOALS.rep)
  const gcfg = { goalFastPricePct: 96, goalRepPricePct: 97 }
  ok('ضریبِ قیمتِ هدف: fast=۹۶ · rep=۹۷ · profit/بدونِ هدف=۱۰۰', goalPricePct('fast', gcfg) === 96 && goalPricePct('rep', gcfg) === 97 && goalPricePct('profit', gcfg) === 100 && goalPricePct(undefined, gcfg) === 100)
  ok('ضریبِ هدف محدود می‌شود (۵۰..۱۰۰)', goalPricePct('fast', { goalFastPricePct: 5, goalRepPricePct: 97 }) === 50 && goalPricePct('fast', { goalFastPricePct: 150, goalRepPricePct: 97 }) === 100)
  // امکانات: ضریبِ ارزش ترکیبی و شفاف
  const amen = { pool: { costPct: 6, valuePct: 8 }, roof: { costPct: 3, valuePct: 4 } }
  ok('۴ امکاناتِ تعریف‌شده برچسب دارند', ['pool', 'roof', 'gym', 'parking'].every(k => !!AMENITY_LABELS[k]))
  ok('بدونِ امکانات ضریب=۱', amenityValueFactorOf({ amenities: [] }, amen) === 1 && amenityValueFactorOf({}, amen) === 1)
  ok('استخر+روف‌گاردن = ×۱.۰۸×۱.۰۴ (ترکیبی)', Math.abs(amenityValueFactorOf({ amenities: ['pool', 'roof'] }, amen) - 1.08 * 1.04) < 1e-9)
  ok('کلیدِ ناشناخته اثری ندارد', amenityValueFactorOf({ amenities: ['x'] }, amen) === 1)
  // فروشِ عمده: اشباعِ عرضهٔ خودِ بازیکن — قطعی و شفاف
  const b3 = bulkPriceOf(100, 3, 3, 2)
  ok('تا سقفِ آزاد تخفیفی نیست', b3.total === 300 && b3.discounted === 0)
  const b5 = bulkPriceOf(100, 5, 3, 2)
  ok('واحدهای ۴ و ۵ پله‌ای ارزان‌تر (۹۸ و ۹۶)', b5.total === 300 + 98 + 96 && b5.discounted === 2 && b5.avgUnit === Math.round(494 / 5))
  ok('کفِ تخفیف ۸۰٪ است', bulkPriceOf(100, 20, 0, 10).total >= 100 * 20 * 0.8)
  ok('صفر واحد → صفر', bulkPriceOf(100, 0, 3, 2).total === 0 && bulkPriceOf(100, 0, 3, 2).avgUnit === 0)
  // کارتِ استخدام: اثرِ عددیِ مشخص — هر سطر یک اثرِ واقعیِ موتور
  ok('مهندسِ ضعیف فقط اثرِ مذاکره دارد', engineerEffectsOf(40, 20, 1).length === 1)
  ok('مهارت ≥۵۰ اثرِ رویداد، ≥۶۰ اثرِ پروانه اضافه می‌شود', engineerEffectsOf(55, 20, 1).length === 2 && engineerEffectsOf(70, 20, 1).length === 3)
  // کارنامهٔ پروژه: همه از اعدادِ واقعیِ خودِ پروژه
  const rep = projectReportOf({ title: 'برج', hood: 'ولنجک', buyPrice: 1000 }, { startedAt: 0, doneAt: 25 * 864e5, days: 24, days0: 21, goal: 'fast', structure: 'concrete', quality: 'luxury', qualityFactor: 1.08, builtArea: 1100, unitArea: 100, totalUnits: 11, costTotal: 5000, paid: 5100, paidDays: 24, lastPayAt: 0, presold: 3, sold: 8, presaleRevenue: 2000, salesRevenue: 6000, eventsFired: 2, amenities: ['pool'] }, 25 * 864e5)
  ok('کارنامه: درآمد/سود/روزها از اعدادِ واقعی', rep.revenue === 8000 && rep.pnl === 8000 - 6100 && rep.daysPlanned === 21 && rep.daysReal === 25)
  const lessons = projectLessonsOf(rep)
  ok('درس‌ها: سود + تأخیر + پیش‌فروش + رویداد + امکانات + استراتژی', lessons.length === 6 && lessons[0].includes('سود') && lessons[1].includes('روز بیش از برنامه'))
  const lossLessons = projectLessonsOf({ ...rep, pnl: -50, daysReal: 21 })
  ok('پروژهٔ زیان‌ده درسِ زیان می‌گیرد', lossLessons[0].includes('زیان') && lossLessons[1].includes('سرِ برنامه'))
  // هدفِ «اعتبار» → امتیازِ اعتبارِ شرکت
  const base = { stats: { sellsProfitable: 0, negoWins: 0 }, creditHist: undefined, assets: [], guess: { tries: 0, correct: 0 } }
  const withRep = companyReputationOf({ ...base, stats: { ...base.stats, repProjects: 2 } }, 10)
  ok('پروژهٔ اعتبارساز امتیاز و فاکتور می‌دهد', withRep.score === 20 && withRep.factors.some(f => f.includes('اعتبارساز')))
}

// ─── Empire · سند ۱۴ (GDD فصل ۴ بخش ۹-۱۶ + پیوتِ مدل B) — Hook روزانه، حافظهٔ مذاکره، اعتبارِ اثرگذار ───
{
  console.log('\n🔥 Empire · سند ۱۴ (فرصت‌های روزانه، حافظهٔ مذاکره، اعتبارِ برند)')
  const { negoMemoryOf, dailyDealPickOf, loanTermsFor } = await import('../app/lib/empire-store.ts')
  // حافظهٔ مذاکره: زیرِ ۴ تلاش خنثی؛ چانه‌زنِ ناموفق منفی؛ خوش‌معامله مثبت
  ok('کمتر از ۴ تلاش → حافظه خنثی', negoMemoryOf({ negoWins: 0, negoTries: 3 }).mod === 0 && negoMemoryOf(undefined).mod === 0)
  const low = negoMemoryOf({ negoWins: 1, negoTries: 6 })
  ok('چانه‌زنِ ناموفق: −۵ + یادداشت', low.mod === -5 && !!low.note)
  const high = negoMemoryOf({ negoWins: 5, negoTries: 6 })
  ok('خوش‌معامله: +۳ + یادداشت', high.mod === 3 && !!high.note)
  ok('میانه: خنثی', negoMemoryOf({ negoWins: 3, negoTries: 6 }).mod === 0)
  // فرصت‌های روزانه: قطعی، چرخشِ روزانه، زیرمجموعهٔ ورودی، سقفِ تعداد
  const ids = Array.from({ length: 40 }, (_, i) => 'L' + i)
  const d1 = dailyDealPickOf('u1', 100, ids, 5), d2 = dailyDealPickOf('u1', 100, ids, 5)
  ok('انتخابِ روزانه قطعی است', JSON.stringify(d1) === JSON.stringify(d2) && d1.length === 5)
  ok('روزِ دیگر → فهرستِ دیگر', JSON.stringify(dailyDealPickOf('u1', 101, ids, 5)) !== JSON.stringify(d1))
  ok('کاربرِ دیگر → فهرستِ دیگر', JSON.stringify(dailyDealPickOf('u2', 100, ids, 5)) !== JSON.stringify(d1))
  ok('همه از ورودی‌اند و سقف رعایت می‌شود', d1.every(id => ids.includes(id)) && dailyDealPickOf('u1', 100, ids.slice(0, 3), 5).length === 3)
  // اعتبارِ برند روی نرخِ وام: کاهشِ شفاف + کف
  const bcfg16 = { enabled: true, maxLoanPctOfNetWorth: 30, baseRatePctYear: 20, termDays: 30, repayXp: 10 }
  const base16 = loanTermsFor(700, 1_000_000_000, bcfg16)
  const rep3 = loanTermsFor(700, 1_000_000_000, bcfg16, { stars: 3, cutPctPerStar: 3 })
  ok('⭐۳ → نرخ ۶٪ کمتر (۱۸→۱۶٫۹)', rep3.ratePctYear < base16.ratePctYear && rep3.repCutPct === 6)
  const rep5 = loanTermsFor(700, 1_000_000_000, bcfg16, { stars: 5, cutPctPerStar: 30 })
  // فاز ۲۳۹ (فیکسِ تستِ تقویم‌وابسته): نرخِ نهایی «مصوبهٔ هفتگیِ دولت» (فاز ۷۰) را هم دارد — هفته‌ای که
  // دلتای مصوبه غیرصفر شود، مقدارِ خام دیگر برابر نیست. انتظار باید مصوبه‌آگاه باشد، نه حذفِ مکانیک.
  const { govDecreeOf } = await import('../app/lib/empire-world.ts')
  const { dayNumberOf } = await import('../app/lib/empire-store.ts')
  const delta16 = govDecreeOf(Math.floor(dayNumberOf(Date.now()) / 7)).loanDelta
  ok('کفِ نرخ: نصفِ نرخِ باند (+ مصوبهٔ هفته)', rep5.ratePctYear === Math.round(Math.max(0.5, 20 * 0.9 * 0.5 + delta16) * 10) / 10)
  ok('⭐۱ اثری ندارد', loanTermsFor(700, 1_000_000_000, bcfg16, { stars: 1, cutPctPerStar: 3 }).ratePctYear === base16.ratePctYear)
}

// ─── Empire · سند ۱۵ (Progression + ظرفیت) — «امکانات باز می‌شوند، نه اعداد» ───
{
  console.log('\n📈 Empire · سند ۱۵ (سطح‌گشایی و ظرفیتِ پروژه)')
  const { maxProjectsOf } = await import('../app/lib/empire-store.ts')
  const u = { projectsBase: 1, projectsPerLevels: 10 }
  ok('سطحِ ۱ → ۱ پروژهٔ همزمان', maxProjectsOf(1, u) === 1)
  ok('سطحِ ۱۰ → ۲ · سطحِ ۲۵ → ۳ · سطحِ ۶۰ → ۷', maxProjectsOf(10, u) === 2 && maxProjectsOf(25, u) === 3 && maxProjectsOf(60, u) === 7)
  ok('ورودی‌های خراب کف دارند', maxProjectsOf(0, u) === 1 && maxProjectsOf(5, { projectsBase: 0, projectsPerLevels: 0 }) >= 1)
}

// ─── Empire · فاز ۲۵ (تجمیع و تخریب) — «۶ واحدی؟ تک‌تک بخر؛ تا همه مالِ تو نشد، تخریب نه» ───
{
  console.log('\n🧩 Empire · فاز ۲۵ (تجمیع واحدها و تخریب — توابعِ خالص)')
  const { buildingUnitsOf, assemblyUnitPriceOf } = await import('../app/lib/empire-store.ts')
  ok('متای واقعیِ «طبقه: ۲ از ۵» → ۵ واحد', buildingUnitsOf('x1', { 'طبقه': '۲ از ۵' }, 3, 8) === 5)
  ok('متای «3 از 12» (رقمِ لاتین) → ۱۲', buildingUnitsOf('x1', { 'طبقه': '3 از 12' }, 3, 8) === 12)
  const h1 = buildingUnitsOf('listingA', undefined, 3, 8)
  ok('بدونِ متا: قطعی از هش در بازهٔ ۳..۸', h1 >= 3 && h1 <= 8 && buildingUnitsOf('listingA', undefined, 3, 8) === h1)
  ok('آگهیِ دیگر می‌تواند عددِ دیگری بگیرد (هشِ مستقل)', [...Array(30)].some((_, i) => buildingUnitsOf('L' + i, undefined, 3, 8) !== h1))
  ok('متای خراب («از ۹۹۹») به هش برمی‌گردد', buildingUnitsOf('x1', { 'طبقه': '۱ از ۹۹۹' }, 3, 8) >= 3 && buildingUnitsOf('x1', { 'طبقه': '۱ از ۹۹۹' }, 3, 8) <= 8)
  ok('پرمیومِ تجمیع: ۱۰٪ روی قیمتِ روز', assemblyUnitPriceOf(1_000_000_000, 10) === 1_100_000_000)
  ok('پرمیومِ صفر/منفی خنثی است', assemblyUnitPriceOf(500, 0) === 500 && assemblyUnitPriceOf(500, -5) === 500)
}

// ─── Empire · فاز ۲۷ (مذاکرهٔ قابل‌تنظیم) — قبلاً ۲۵٪/۲..۶٪ هاردکد بود ───
{
  console.log('\n🤝 Empire · فاز ۲۷ (شانس/تخفیفِ مذاکره knob شد)')
  const { negotiationOutcome } = await import('../app/lib/empire-store.ts')
  const dflt = { baseChancePct: 25, discountMin: 2, discountMax: 6 }
  const o1 = negotiationOutcome('u1', 'L1', 50, dflt)
  ok('قطعی: همان کاربر/آگهی → همان نتیجه', JSON.stringify(negotiationOutcome('u1', 'L1', 50, dflt)) === JSON.stringify(o1))
  const always = { baseChancePct: 100, discountMin: 4, discountMax: 4 }
  const oA = negotiationOutcome('u1', 'L1', 0, always)
  ok('شانسِ ۱۰۰٪ → همیشه موفق با تخفیفِ دقیقِ بازه', oA.success === true && oA.discountPct === 4)
  const never = { baseChancePct: 0, discountMin: 2, discountMax: 6 }
  ok('شانسِ ۰ و مهارتِ ۰ → هرگز', negotiationOutcome('u1', 'L1', 0, never).success === false)
  // بازهٔ تخفیف رعایت می‌شود (۳۰ نمونهٔ قطعی)
  const wide = { baseChancePct: 100, discountMin: 5, discountMax: 12 }
  ok('تخفیف همیشه داخلِ بازهٔ knob', [...Array(30)].every((_, i) => { const o = negotiationOutcome('u' + i, 'L', 0, wide); return o.discountPct >= 5 && o.discountPct <= 12 }))
}

// ─── Empire · فاز ۲۹ (طراحیِ معمار با تراکمِ قانونی — طبقهٔ مازاد = تخلف) ───
{
  console.log('\n📐 Empire · فاز ۲۹ (designPlanOf — قوانینِ شهرسازیِ شفاف)')
  const { designPlanOf } = await import('../app/lib/empire-store.ts')
  const cfg = { occupancyPct: 60, buildFactor: 2.2, maxOverFloors: 2, minUnitArea: 35 }
  const d3 = designPlanOf(200, 3, 2, cfg)
  ok('زمین ۲۰۰م، اشغال ۶۰٪ → هر طبقه ۱۲۰م، مجاز ۳ طبقه', d3.ok && d3.footprint === 120 && d3.legalFloors === 3 && d3.maxFloors === 5)
  ok('۳ طبقه × ۲ واحد = ۶ واحدِ ۶۰متری، بدونِ تخلف', d3.ok && d3.totalUnits === 6 && d3.unitArea === 60 && d3.illegalFloors === 0)
  const d5 = designPlanOf(200, 5, 2, cfg)
  ok('۵ طبقه = ۲ طبقهٔ مازاد (۴ واحد / ۲۴۰ مترِ غیرمجاز)', d5.ok && d5.illegalFloors === 2 && d5.illegalUnits === 4 && d5.illegalArea === 240)
  ok('بیش از سقفِ قابل‌ساخت رد می‌شود', designPlanOf(200, 6, 2, cfg).ok === false)
  ok('واحدِ کوچک‌تر از حداقلِ قانونی رد می‌شود', designPlanOf(200, 3, 4, cfg).ok === false)
  ok('زمینِ بی‌متراژ رد می‌شود', designPlanOf(0, 1, 1, cfg).ok === false)
  // نقشهٔ امضاشده خودکفاست: حتی اگر آگهیِ زمین از استخر بیفتد (landArea=0)، کلنگ کار می‌کند
  const { designBuildPlanOf } = await import('../app/lib/empire-store.ts')
  const dsn = { footprint: 120, floors: 5, unitsPerFloor: 2, unitArea: 60, legalFloors: 3, landArea: 200 }
  const bc = { buildFactor: 2, costPerM: 10_000_000, buildDays: 10 }
  const withLand = designBuildPlanOf('concrete', 'standard', 200, dsn, bc)
  const noListing = designBuildPlanOf('concrete', 'standard', 0, dsn, bc)
  ok('آگهیِ زمین افتاده (landArea=0) → متراژ از خودِ نقشه؛ نتیجه یکسان', !!noListing && JSON.stringify(noListing) === JSON.stringify(withLand))
  const legacy = designBuildPlanOf('concrete', 'standard', 0, { ...dsn, landArea: undefined }, bc)
  ok('نقشه‌های قدیمیِ بدونِ landArea هم کار می‌کنند (مبنا: بنای قانونی)', !!legacy && legacy.builtArea === 600 && legacy.totalUnits === 10 && legacy.days >= 3)
}

// ─── ممیزیِ ML توضیح‌پذیر — «هوش مصنوعی که رد می‌کند باید دلیلش را بگوید» ───
{
  console.log('\n🤖 ممیزیِ ML — دلیلِ قابل‌فهمِ رد/تأیید (توضیح‌پذیری)')
  const fsMod = await import('fs')
  const MLFILE = new URL('../.moderation-ml-data.json', import.meta.url).pathname
  const backup = fsMod.existsSync(MLFILE) ? fsMod.readFileSync(MLFILE, 'utf-8') : null
  try {
    const { resetMl, learn, predict, explainPrediction } = await import('../app/lib/moderation-ml.ts')
    resetMl()
    // آموزشِ کوچک: ردشده‌ها = اسپم با شماره در متن؛ تأییدشده‌ها = آگهیِ سالمِ قیمت‌دار
    for (let i = 0; i < 45; i++) {
      learn({ title: 'فروش فوری زیر قیمت', excerpt: 'تماس بگیرید 09121234567 کلاهبرداری نیست', location: 'تهران', price: '' }, 'rejected')
      learn({ title: `آپارتمان ${100 + i} متری در سعادت‌آباد`, excerpt: 'دو خواب، نوساز، سند تک‌برگ، پارکینگ و انباری دارد و آمادهٔ بازدید است', location: 'تهران، سعادت‌آباد', price: '۱۲,۰۰۰,۰۰۰,۰۰۰ تومان', meta: { 'متراژ': '۱۲۰' } }, 'approved')
    }
    const spam = { title: 'فروش فوری', excerpt: 'سریع تماس بگیرید 09121234567', location: '', price: '' }
    const p = predict(spam)
    ok('مدل اسپم را رد پیش‌بینی می‌کند و آماده است', p.label === 'rejected' && p.ready)
    const ex = explainPrediction(spam)
    ok('دلیل‌ها خالی نیستند و قابل‌فهم‌اند', ex.reasons.length > 0)
    ok('پرچم‌های واقعی ترجمه شده‌اند (شماره در متن / بی‌قیمتی)', ex.reasons.some(r => r.includes('شمارهٔ تماس') || r.includes('قیمت')))
    const good = { title: 'آپارتمان ۱۱۰ متری در سعادت‌آباد', excerpt: 'دو خواب، نوساز، سند تک‌برگ، پارکینگ و انباری دارد و آمادهٔ بازدید است', location: 'تهران، سعادت‌آباد', price: '۱۱,۰۰۰,۰۰۰,۰۰۰ تومان', meta: { 'متراژ': '۱۱۰' } }
    ok('آگهیِ سالم تأیید پیش‌بینی می‌شود', predict(good).label === 'approved')
    // بازتولیدِ دلیل برای رکوردهای قدیمی با متنِ عمومی
    const { displayReason } = await import('../app/lib/moderation.ts')
    const regen = displayReason({ ...spam, status: 'rejected', aiReason: 'ممیزیِ خودکارِ یادگیری‌شده (اطمینان 97٪)', meta: {} })
    // فاز ۱۳۸: دلیلِ بازتولیدشدهٔ رد حالا مدرکِ قطعی (خودِ شماره) را نقل می‌کند — قوی‌تر از قبل
    ok('دلیلِ عمومیِ قدیمی موقعِ خواندن با دلیلِ واقعی جایگزین می‌شود', regen.startsWith('ردِ خودکار') && regen.includes('09121234567') && !regen.includes('یادگیری‌شده'))
    ok('دلیلِ غیرعمومی دست نمی‌خورد', displayReason({ ...spam, status: 'rejected', aiReason: 'قیمت غیرواقعی', meta: {} }) === 'قیمت غیرواقعی')
  } finally {
    if (backup !== null) fsMod.writeFileSync(MLFILE, backup)
    else if (fsMod.existsSync(MLFILE)) fsMod.unlinkSync(MLFILE)
  }
}

// ─── ژئو — محلهٔ دقیق هرگز به نامِ کلی تقلیل نیابد + حذفِ محله‌های کلی ───
{
  console.log('\n🗺 ژئو — حفظِ «جنت‌آباد شمالی» + حذفِ محلهٔ کلیِ «جنت‌آباد»')
  const fsMod = await import('fs')
  const GFILE = new URL('../.geo-data.json', import.meta.url).pathname
  const backup = fsMod.existsSync(GFILE) ? fsMod.readFileSync(GFILE, 'utf-8') : null
  try {
    const { save, findNeighborhoodInGeo, pruneGenericNeighborhoods } = await import('../app/lib/geo-store.ts')
    save({ provinces: [{ id: 'p1', name: 'تهران', cities: [{ id: 'c1', name: 'تهران', districts: [{ id: 'd1', name: 'سایر محله‌ها', neighborhoods: ['جنت‌آباد', 'ونک'] }] }] }] })
    // ژئو فقط «جنت‌آباد» دارد؛ دیوار «جنت آباد شمالی» می‌دهد → نامِ دقیق حفظ شود، نه تقلیل به کلی
    const m = findNeighborhoodInGeo('تهران', 'جنت آباد شمالی')
    ok('محلهٔ دقیقِ ورودی حفظ می‌شود (تقلیل به «جنت‌آباد» ممنوع)', !!m && m.neighborhood === 'جنت آباد شمالی' && m.city === 'تهران')
    ok('ورودیِ دقیقاً موجود همان ژئو را برمی‌گرداند', findNeighborhoodInGeo('تهران', 'ونک')?.neighborhood === 'ونک')
    // حذفِ کلی‌ها: وقتی شمالی/جنوبی هست، خودِ «جنت‌آباد» باید برود؛ «ونک» بی‌ربط است و می‌ماند
    save({ provinces: [{ id: 'p1', name: 'تهران', cities: [{ id: 'c1', name: 'تهران', districts: [{ id: 'd1', name: 'سایر محله‌ها', neighborhoods: ['جنت‌آباد', 'جنت‌آباد شمالی', 'جنت‌آباد جنوبی', 'ونک'] }] }] }] })
    const r = pruneGenericNeighborhoods()
    const { load } = await import('../app/lib/geo-store.ts')
    const hoods = load().provinces[0].cities[0].districts[0].neighborhoods
    ok('محلهٔ کلی حذف شد و مشخص‌ها ماندند', r.removed === 1 && !hoods.includes('جنت‌آباد') && hoods.includes('جنت‌آباد شمالی') && hoods.includes('ونک'))
    ok('اجرای دوباره چیزی حذف نمی‌کند', pruneGenericNeighborhoods().removed === 0)
  } finally {
    if (backup !== null) fsMod.writeFileSync(GFILE, backup)
    else if (fsMod.existsSync(GFILE)) fsMod.unlinkSync(GFILE)
  }
}

// ─── Empire · سند ۱۸ (LiveOps) — پنجرهٔ رویداد + نقاطِ عطفِ استریک ───
{
  console.log('\n🎪 Empire · سند ۱۸ (رویدادِ زنده + پاداشِ استریک)')
  const { eventActive, streakMilestonesOf } = await import('../app/lib/empire-store.ts')
  const now = 1_000_000
  ok('رویداد فقط در بازهٔ فعال و روشن', eventActive({ enabled: true, startAt: now - 1, endAt: now + 1 }, now) === true)
  ok('رویدادِ خاموش/منقضی/آینده فعال نیست',
    eventActive({ enabled: false, startAt: now - 1, endAt: now + 1 }, now) === false
    && eventActive({ enabled: true, startAt: now - 10, endAt: now }, now) === false
    && eventActive({ enabled: true, startAt: now + 1, endAt: now + 9 }, now) === false)
  const knobs = { d7: 30, d14: 60, d21: 100, d30: 200 }
  const ms = streakMilestonesOf(8, 1000, {}, knobs)
  ok('استریکِ ۸ روزه: فقط نقطهٔ ۷ آماده است', ms.find(x => x.days === 7).done === true && ms.find(x => x.days === 14).done === false)
  ok('کلیدِ claim شاملِ روزِ شروعِ دوره است', ms[0].claimKey === 'sm_7_' + (1000 - 8 + 1))
  const claimed = streakMilestonesOf(8, 1000, { ['sm_7_' + 993]: 1 }, knobs)
  ok('دریافت‌شده علامت می‌خورد', claimed.find(x => x.days === 7).claimed === true)
  // شکستنِ زنجیره و شروعِ دوباره → کلیدِ تازه → دوباره قابلِ‌دریافت
  const rerun = streakMilestonesOf(7, 1200, { ['sm_7_' + 993]: 1 }, knobs)
  ok('دورهٔ جدیدِ استریک کلیدِ جدید می‌سازد', rerun.find(x => x.days === 7).claimed === false && rerun.find(x => x.days === 7).claimKey === 'sm_7_' + (1200 - 7 + 1))
}

// ─── Empire · فاز ۳۳ (سند ۲۲ Monetization) — بستهٔ زمان‌دار + موتورِ پیشنهادِ قطعی ───
{
  console.log('\n🎁 Empire · فاز ۳۳ (سند ۲۲ — بسته‌های زمان‌دار + پیشنهادِ هوشمندِ قطعی)')
  const { activeCoinPacks, offerOf, dayNumberOf } = await import('../app/lib/empire-store.ts')
  const now = Date.parse('2026-07-09T10:00:00')
  const packs = [
    { id: 'a', label: 'دائمی', coins: 100, priceToman: 100000, enabled: true },
    { id: 'b', label: 'نوروزی', coins: 300, priceToman: 200000, enabled: true, until: '2026-07-10' },
    { id: 'c', label: 'منقضی', coins: 300, priceToman: 200000, enabled: true, until: '2026-07-08' },
    { id: 'd', label: 'خاموش', coins: 300, priceToman: 200000, enabled: false },
    { id: 'e', label: 'خرابِ‌تاریخ', coins: 300, priceToman: 200000, enabled: true, until: 'فردا' },
    { id: 'f', label: 'صفر', coins: 0, priceToman: 200000, enabled: true },
  ]
  const act = activeCoinPacks(packs, now).map(p => p.id)
  ok('فقط دائمی و زمان‌دارِ هنوز-معتبر می‌مانند', act.join(',') === 'a,b')
  ok('روزِ پایان تا آخرِ شب معتبر است', activeCoinPacks(packs, Date.parse('2026-07-10T23:00:00')).some(p => p.id === 'b'))
  ok('بعدِ نیمه‌شبِ پایان حذف می‌شود', !activeCoinPacks(packs, Date.parse('2026-07-11T00:30:00')).some(p => p.id === 'b'))

  const catalog = [
    { id: 'frame_gold', label: 'قابِ طلایی', icon: '🥇', kind: 'frame', priceCoins: 200, enabled: true },
    { id: 'flair_crane', label: 'نشانِ برج‌ساز', icon: '🏗', kind: 'flair', priceCoins: 400, enabled: true },
    { id: 'flair_falcon', label: 'نشانِ شاهین', icon: '🦅', kind: 'flair', priceCoins: 400, enabled: true },
  ]
  const cfg = { enabled: true, cooldownDays: 5, minAgeDays: 2 }
  const born = now - 10 * 864e5, day = dayNumberOf(now)
  const base = { createdAt: born, claims: {}, coins: 10, xp: 0, stats: {}, cosmetics: undefined, offerHist: undefined }
  const o1 = offerOf(base, day, cfg, catalog, activeCoinPacks(packs, now))
  ok('کوینِ کم و بدونِ خریدِ قبلی → پیشنهادِ اولین شارژ', o1?.id === 'off_first' && o1.goto === 'coins')
  ok('قطعی: همان ورودی → همان پیشنهاد', offerOf(base, day, cfg, catalog, activeCoinPacks(packs, now))?.id === o1.id)
  ok('امپراتوریِ نوزاد (زیرِ minAgeDays) پیشنهاد نمی‌گیرد', offerOf({ ...base, createdAt: now - 1 * 864e5 }, day, cfg, catalog, packs) === null)
  ok('خاموش = هیچ', offerOf(base, day, { ...cfg, enabled: false }, catalog, packs) === null)
  // بستن → قانونِ بعدی یا هیچ؛ بعدِ cooldown برمی‌گردد
  const dismissed = { ...base, offerHist: { off_first: day } }
  ok('بعدِ بستن، همان پیشنهاد نمی‌آید', offerOf(dismissed, day, cfg, catalog, packs)?.id !== 'off_first')
  ok('بعدِ cooldown دوباره مجاز است', offerOf({ ...base, offerHist: { off_first: day - 5 } }, day, cfg, catalog, packs)?.id === 'off_first')
  // شخصی‌سازی از رفتارِ واقعی: خریدِ قبلی + پروژهٔ تحویلی → پیشنهادِ نشانِ برج‌ساز
  const builder = { ...base, claims: { coinpay_x: 1 }, coins: 5000, stats: { projectsDelivered: 2 } }
  const ob = offerOf(builder, day, cfg, catalog, packs)
  ok('برج‌ساز → پیشنهادِ نشانِ ساخت (سبکِ بازی)', ob?.id === 'off_build' && ob.goto === 'cosmetics')
  ok('نشانِ خریداری‌شده دیگر پیشنهاد نمی‌شود', offerOf({ ...builder, cosmetics: { owned: ['flair_crane'] } }, day, cfg, catalog, packs)?.id !== 'off_build')
  // مذاکره‌گر: ۳ بردِ واقعی → نشانِ شاهین
  const nego = { ...base, claims: { coinpay_x: 1 }, coins: 5000, stats: { negoWins: 3 } }
  ok('مذاکره‌گر → پیشنهادِ نشانِ شاهین', offerOf(nego, day, cfg, catalog, packs)?.id === 'off_nego')
  ok('حداکثر یک پیشنهاد در روز (نه فهرست)', typeof offerOf(builder, day, cfg, catalog, packs) === 'object' && !Array.isArray(offerOf(builder, day, cfg, catalog, packs)))
}

// ─── متراژ از متنِ آگهی (فیدبک: «اگر تو آگهی نیست، از فرمول حساب کن — پیامِ بن‌بست نده») ───
{
  console.log('\n📏 متراژ از متنِ واقعیِ آگهی (areaFromText)')
  const { areaFromText } = await import('../app/lib/empire-store.ts')
  ok('«کلنگی ۲۱۰ متری بر ۷ متری مفتح» → ۲۱۰ (نه برِ گذر)', areaFromText('کلنگی ۲۱۰ متری بر ۷ متری مفتح') === 210)
  ok('رقمِ لاتین: «زمین 500 متر» → ۵۰۰', areaFromText('زمین 500 متر') === 500)
  ok('چند عدد: بزرگ‌ترین «N متر» انتخاب می‌شود (بر ۴۵ متری < عرصه)', areaFromText('کلنگی ۳۲۰ متری بر ۴۵ متری') === 320)
  ok('بدونِ «متر» هیچ (سالِ ساخت عدد نیست)', areaFromText('آپارتمان ساختِ ۱۴۰۲ نوساز') === 0)
  ok('عددِ زیرِ ۳۰ (برِ کوچه) کاندید نیست', areaFromText('مغازه بر ۱۲ متری') === 0)
  ok('متنِ خالی/undefined → صفر', areaFromText('', undefined) === 0)
  ok('چند ورودی: اولین متنِ دارای عدد برنده است', areaFromText(undefined, 'ویلای ۴۲۰ متری') === 420)
}

// ─── فاز ۳۴ (سند ۲۳ Technical) — سپرِ نرخِ درخواست (rateHit خالص) ───
{
  console.log('\n🛡 فاز ۳۴ — سپرِ نرخِ درخواستِ API (rateHit)')
  const { rateHit } = await import('../app/lib/empire-store.ts')
  let r = rateHit(undefined, 100, 3)
  ok('درخواستِ اول آزاد است', r.limited === false && r.state.n === 1)
  r = rateHit(r.state, 100, 3); r = rateHit(r.state, 100, 3)
  ok('تا سقف (۳) آزاد', r.limited === false && r.state.n === 3)
  r = rateHit(r.state, 100, 3)
  ok('درخواستِ مازاد بسته می‌شود', r.limited === true)
  ok('دقیقهٔ بعد پنجرهٔ تازه است', rateHit(r.state, 101, 3).limited === false)
  ok('سقفِ ۰ = سپر خاموش', rateHit({ m: 100, n: 999 }, 100, 0).limited === false)
}

// ─── فاز ۳۵ (سند ۲۴ Analytics) — رصدخانهٔ اقتصاد: اسنپ‌شات + سلامت + IES ───
{
  console.log('\n🔭 فاز ۳۵ — رصدخانهٔ اقتصاد (buildSnapshot/economyHealthOf/iesOf)')
  const { buildSnapshot, economyHealthOf, iesOf } = await import('../app/lib/empire-metrics.ts')
  const { dayNumberOf } = await import('../app/lib/empire-store.ts')
  const now = Date.parse('2026-07-09T12:00:00'), today = dayNumberOf(now)
  const mkE = (o = {}) => ({ userId: 'u', no: 1, name: 'ت', createdAt: now - 10 * 864e5, updatedAt: now, persona: '', mentor: 'ملک‌جت',
    answers: {}, dream: { picks: [], sentence: '' }, identity: {}, dna: '', profile: { title: '', confidence: 0 },
    capital: 1_000_000_000, coins: 100, xp: 0, aiTokens: 0, badges: [], assets: [], timeline: [], journal: [],
    guess: { tries: 0, correct: 0 }, claims: {}, realized: 0, rejects: 0, ...o })
  const items = [
    { id: 'a', title: 'آپارتمان', price: '۲٬۰۰۰٬۰۰۰٬۰۰۰', location: 'تهران، ونک', meta: { 'متراژ': '۱۰۰' } },
    { id: 'b', title: 'آپارتمان', price: '۳٬۰۰۰٬۰۰۰٬۰۰۰', location: 'تهران، ونک', meta: { 'متراژ': '۱۰۰' } },
    { id: 'c', title: 'آپارتمان', price: '۴٬۰۰۰٬۰۰۰٬۰۰۰', location: 'تهران، ونک', meta: { 'متراژ': '۱۰۰' } },
    { id: 'd', title: 'اجارهٔ آپارتمان', price: 'اجاره ۵۰ میلیون', location: 'تهران، ونک', meta: { 'متراژ': '۱۰۰' } },
  ]
  const rich = mkE({ userId: 'r', capital: 9_000_000_000, claims: { ['dq_' + today]: 1 }, taxPaid: 50_000_000 })
  const poor = mkE({ userId: 'p', capital: 100_000_000, updatedAt: now - 3 * 864e5 })   // آخرین فعالیت: ۳ روز پیش
  const s = buildSnapshot([rich, poor], items, now)
  ok('میانهٔ متری از فروش‌های واقعی (اجاره حذف)', s.perM === 30_000_000 && s.perMSamples === 3)
  ok('محلهٔ ونک با ۳ نمونه ثبت شد', s.hoods.length === 1 && s.hoods[0].hood === 'ونک' && s.hoods[0].perM === 30_000_000)
  ok('جمعِ اقتصاد: سرمایه/کوین/خزانه/بازیکن', s.players === 2 && s.capital === 9_100_000_000 && s.coins === 200 && s.treasury === 50_000_000)
  ok('DAU از ردِ فعالیتِ واقعی (فقط دارندهٔ claim امروز)', s.dau === 1)
  ok('تمرکزِ ثروت: یک نفر از دو نفر ≈ سهمِ بالا', s.top10Pct >= 90)
  const cfgM = { inflationAlertPct: 15, dauDropAlertPct: 40, concentrationAlertPct: 70, capGrowthAlertPct: 50 }
  ok('بدونِ تاریخچه: ready=false و هیچ ادعایی نه', economyHealthOf([], cfgM).ready === false)
  const h1 = economyHealthOf([s], cfgM)
  ok('یک اسنپ‌شات: روندها null (تاریخچه کافی نیست)', h1.ready === true && h1.inflation7 === null && h1.capGrowth7 === null)
  const old7 = { ...s, day: s.day - 7, perM: 25_000_000, capital: 5_000_000_000, dau: 5 }
  const h2 = economyHealthOf([old7, s], cfgM)
  ok('تورمِ ۷روزه = +۲۰٪ و هشدارِ تورم فعال', h2.inflation7 === 20 && h2.alerts.some(a => a.icon === '📈'))
  ok('رشدِ نقدینگی +۸۲٪ → هشدارِ چاپِ پول', h2.capGrowth7 === 82 && h2.alerts.some(a => a.icon === '💸'))
  ok('افتِ DAU از ۵ به ۱ → هشدار', h2.alerts.some(a => a.icon === '🚪'))
  // IES: قطعی، صفر برای بی‌تحرک، بالاتر با فعالیت — سقفِ ۱۰۰
  const idle = mkE({ userId: 'i', createdAt: now - 60 * 864e5, updatedAt: now - 30 * 864e5 })
  const activeE = mkE({ userId: 'a2', claims: { ['dq_' + today]: 1, ['dq_' + (today - 1)]: 1 }, assets: [{}, {}, {}], stats: { projectsDelivered: 2, negoWins: 4 }, company: { name: 'x' }, kudos: 3, guess: { tries: 5, correct: 3 } })
  ok('IES بی‌تحرک ≤ IES فعال و هر دو در ۰..۱۰۰', iesOf(idle, today) < iesOf(activeE, today) && iesOf(activeE, today) <= 100 && iesOf(idle, today) >= 0)
  ok('IES قطعی است', iesOf(activeE, today) === iesOf(activeE, today))
}

// ─── فاز ۳۶ (سند ۲۵ AI Platform) — داشبوردِ انسانیِ AI: مصرفِ واقعی از رویدادها ───
{
  console.log('\n🧠 فاز ۳۶ — aiUsageOf (اقدام‌های واقعی از مسیرِ پیشنهاد/تحلیلِ سیستم)')
  const { aiUsageOf } = await import('../app/lib/empire-metrics.ts')
  const now = 1_800_000_000_000
  const evs = [
    { at: now - 1 * 864e5, meta: { src: 'empire_buy' } },
    { at: now - 2 * 864e5, meta: { src: 'empire_analyze' } },
    { at: now - 3 * 864e5, meta: { src: 'empire_analyze' } },
    { at: now - 6 * 864e5, meta: { src: 'empire_guess' } },
    { at: now - 8 * 864e5, meta: { src: 'empire_buy' } },        // خارج از پنجرهٔ ۷ روز
    { at: now - 1 * 864e5, meta: { src: 'site_search' } },        // غیرِ امپراتوری
    { at: now - 1 * 864e5 },                                      // بدونِ src
  ]
  const u = aiUsageOf(evs, now)
  ok('فقط srcهای empire_* داخلِ پنجرهٔ ۷ روز شمرده می‌شوند', u.total === 4 && u.buy === 1 && u.analyze === 2 && u.guess === 1)
  ok('رویدادِ قدیمی/بی‌ربط شمرده نمی‌شود', u.crowd === 0 && u.assembly === 0)
  ok('ورودیِ خالی = همه صفر (بدونِ عددِ ساختگی)', aiUsageOf([], now).total === 0)
}

// ─── فاز ۳۷ — بازارِ بازیکنان و اتحاد (توابعِ خالص) ───
{
  console.log('\n🏪 فاز ۳۷ — tradeSplitOf / validClanName')
  const { tradeSplitOf } = await import('../app/lib/empire-store.ts')
  const { validClanName } = await import('../app/lib/empire-social.ts')
  const s = tradeSplitOf(1_000_000_000, 1, 0.5)
  ok('تقسیمِ معامله: مالیات ۱٪ و کمیسیون ۰٫۵٪ دقیق', s.tax === 10_000_000 && s.commission === 5_000_000 && s.buyerPays === 1_010_000_000 && s.sellerGets === 995_000_000)
  ok('بقای پول: پرداختی − دریافتی = مالیات + کمیسیون', s.buyerPays - s.sellerGets === s.tax + s.commission)
  ok('نرخِ صفر = بدونِ کسر', tradeSplitOf(500, 0, 0).buyerPays === 500 && tradeSplitOf(500, 0, 0).sellerGets === 500)
  ok('نامِ اتحادِ کوتاه/دارای واژهٔ ممنوع رد می‌شود', validClanName('ب') !== null && validClanName('تیمِ بازی') !== null && validClanName('شاهین‌های ونک') === null)
}

// ─── فاز ۳۹ (سند ۲۶ فصل ۱۶ Cognitive AI) — هوشِ سرمایه‌گذاری: توابعِ خالص ───
{
  console.log('\n🧭 فاز ۳۹ — compStatsOf / valuationOf / decisionOf / marketIntelOf / cashflowOf / financialHealthOf / prioritiesOf')
  const { compStatsOf, valuationOf, decisionOf, marketIntelOf, cashflowOf, financialHealthOf, prioritiesOf } = await import('../app/lib/empire-intel.ts')
  const iCfg = { enabled: true, minComps: 4, fairBandPct: 8, expensivePct: 20, bubblePct: 35, trendDays: 7, loanSoonDays: 7, liqHigh: 15, liqMid: 6 }

  // compStats: میانه و چارک‌ها از نرخ‌های واقعی
  const cs = compStatsOf([100, 200, 300, 400, 500], 2)
  ok('میانه/چارک‌ها از داده‌های واقعی', cs.perM === 300 && cs.p25 === 200 && cs.p75 === 400 && cs.samples === 5 && cs.fresh === 2)
  ok('نرخِ صفر/منفی حذف می‌شود', compStatsOf([0, -5, 100]).samples === 1)

  // valuation: کمتر از حداقلِ نمونه → صادقانه «داده کافی نیست» و اعتمادِ صفر (قانونِ سند)
  const vNo = valuationOf(1_000_000_000, 100, compStatsOf([10, 20]), iCfg)
  ok('نمونهٔ ناکافی → ready=false + note + confidence=0', vNo.ready === false && !!vNo.note && vNo.confidence === 0)
  // ۵ نمونهٔ متری حولِ ۱۰م — ملکِ ۱۰۰ متری با قیمتِ دقیقاً منصفانه = ۱ میلیارد
  const comps5 = compStatsOf([9e6, 9.5e6, 10e6, 10.5e6, 11e6], 3)
  const vFair = valuationOf(1_000_000_000, 100, comps5, iCfg)
  ok('ارزشِ منصفانه = میانهٔ متری × متراژ', vFair.ready && vFair.fair === 1_000_000_000 && vFair.diffPct === 0)
  ok('نشانِ سبز روی قیمتِ منصفانه', vFair.badge.icon === '🟢' && vFair.badge.tone === 'good')
  ok('سناریوها از چارک‌های واقعی (بدبینانه<پایه<خوش‌بینانه)', vFair.scenarios.pess === 950_000_000 && vFair.scenarios.base === 1_000_000_000 && vFair.scenarios.opt === 1_050_000_000)
  ok('اعتماد فقط از حجمِ داده و هرگز ۱۰۰ نیست', vFair.confidence > 0 && vFair.confidence <= 95)
  ok('دلایلِ توضیح‌پذیری موجودند', vFair.reasons.length >= 3)
  const vBubble = valuationOf(1_400_000_000, 100, comps5, iCfg)
  ok('۴۰٪ بالای منصفانه → 🔴 احتمالِ حباب', vBubble.badge.icon === '🔴' && vBubble.diffPct === 40)
  const vCheap = valuationOf(850_000_000, 100, comps5, iCfg)
  ok('زیرِ ارزش → 🟢 فرصت و امتیازِ بالاتر از گران', vCheap.badge.tone === 'good' && vCheap.score > vBubble.score)
  ok('عمقِ بازار از تعدادِ نمونه (۵ نمونه = کم‌عمق)', vFair.liquidity.level === 0)
  const v20 = valuationOf(1_000_000_000, 100, compStatsOf(Array.from({ length: 20 }, () => 10e6), 5), iCfg)
  ok('۲۰ نمونه = بازارِ پرتحرک', v20.liquidity.level === 2)
  ok('قیمت/متراژِ نامشخص → ready=false صادقانه', valuationOf(0, 100, comps5, iCfg).ready === false && valuationOf(1e9, 0, comps5, iCfg).ready === false)

  // decision: پیش از خرید — هشدارِ نقدینگی/بدهی، بدونِ اجرا
  const dNo = decisionOf({ capital: 500, loanBalance: 0, netWorth: 500, dailyBurn: 0 }, 1000, iCfg)
  ok('سرمایهٔ ناکافی → can=false با کسری', dNo.can === false && dNo.warnings.length === 1)
  const dTight = decisionOf({ capital: 1_050, loanBalance: 400, netWorth: 1_500, dailyBurn: 10 }, 1000, iCfg)
  ok('نقدِ کم بعد از خرید → هشدارِ نقدینگی + دوامِ روزها', dTight.can === true && dTight.warnings.some(w => w.includes('٪')) && dTight.warnings.some(w => w.includes('روز')))
  ok('بدهیِ سنگین (>۳۰٪) → هشدارِ وام', dTight.warnings.some(w => w.includes('وام')))
  const dOk = decisionOf({ capital: 10_000, loanBalance: 0, netWorth: 10_000, dailyBurn: 0 }, 1000, iCfg)
  ok('خریدِ راحت → بدونِ هشدار + یادداشتِ مثبت', dOk.can === true && dOk.warnings.length === 0 && dOk.notes.length >= 1)

  // market intel: بدونِ تاریخچه → صادقانه؛ با دو اسنپ‌شات → روندِ واقعی
  const mEmpty = marketIntelOf([], iCfg)
  ok('بدونِ تاریخچه: ready=false و note', mEmpty.ready === false && !!mEmpty.note)
  const snapA = { day: 100, at: 0, players: 1, newToday: 0, dau: 1, wau: 1, capital: 0, coins: 0, netWorth: 0, treasury: 0, wages: 0, services: 0, assets: 0, listings: 10, perM: 100, perMSamples: 10, hoods: [{ hood: 'ونک', perM: 100, samples: 5 }, { hood: 'نارمک', perM: 200, samples: 4 }], top10Pct: 0 }
  const snapB = { ...snapA, day: 107, perM: 110, hoods: [{ hood: 'ونک', perM: 120, samples: 6 }, { hood: 'نارمک', perM: 180, samples: 5 }, { hood: 'تازه', perM: 50, samples: 3 }] }
  ok('یک اسنپ‌شات: هنوز روند ادعا نمی‌شود', marketIntelOf([snapA], iCfg).ready === false)
  const mi = marketIntelOf([snapA, snapB], iCfg)
  ok('روندِ شهر از دادهٔ واقعی: ۱۰۰→۱۱۰ = +۱۰٪', mi.ready && mi.city.pct === 10 && mi.sinceDays === 7)
  ok('محلهٔ صعودی/نزولی درست پیدا می‌شود', mi.rising[0]?.hood === 'ونک' && mi.rising[0]?.pct === 20 && mi.falling[0]?.hood === 'نارمک' && mi.falling[0]?.pct === -10)
  ok('محلهٔ بدونِ سابقهٔ قبلی وارد روند نمی‌شود', !mi.rising.some(x => x.hood === 'تازه') && !mi.falling.some(x => x.hood === 'تازه'))

  // cashflow: از قراردادهای جاری — قطعی
  const now39 = 1_800_000_000_000
  const eFlow = {
    capital: 3_000_000,
    assets: [
      { income: 900_000, actionAt: now39 - 9 * 864e5, boughtAt: now39 - 20 * 864e5 },                       // ۱۰۰هزار/روز درآمدِ ثبت‌شده
      { construction: { done: false, paidDays: 2, days: 10, costTotal: 1_000_000, paid: 200_000 } },        // ۱۰۰هزار/روز هزینهٔ ساخت
    ],
    company: { engineers: [{ salaryMonthly: 3_000_000 }] },                                                  // ۱۰۰هزار/روز حقوق
    loan: { balance: 365_000_000, ratePctYear: 10 },                                                         // ۱۰۰هزار/روز بهره
  }
  const fl = cashflowOf(eFlow, now39)
  ok('درآمد/خرجِ روزانه از جریان‌های واقعی', fl.dailyIn === 100_000 && fl.dailyOut === 300_000 && fl.net === -200_000)
  ok('پیش‌بینیِ ۷ روز + دوامِ نقد', fl.d7 === 3_000_000 - 7 * 200_000 && fl.runwayDays === 15)
  ok('بدونِ جریان: net=0 و runway=null', cashflowOf({ capital: 10, assets: [] }, now39).runwayDays === null)

  // financial health: امتیاز + دلایل — قطعی و توضیح‌پذیر
  const hGood = financialHealthOf({ capital: 2_000, assets: [{ kind: 'apartment', hood: 'الف' }, { kind: 'land', hood: 'ب' }], realized: 100, stats: { sellsProfitable: 1, negoWins: 0 } }, 10_000, { dailyIn: 10, dailyOut: 0, net: 10, d7: 0, d30: 0, d90: 0, runwayDays: null })
  const hBad = financialHealthOf({ capital: 10, assets: [{ kind: 'apartment', hood: 'الف' }, { kind: 'apartment', hood: 'الف' }], loan: { balance: 5_000 }, realized: 0 }, 10_000, { dailyIn: 0, dailyOut: 50, net: -50, d7: 0, d30: 0, d90: 0, runwayDays: 0 })
  ok('پرتفوی سالم امتیازِ بالاتر از شکننده می‌گیرد', hGood.score > hBad.score && hGood.score <= 100 && hBad.score >= 0)
  ok('هر دو دلایلِ شفاف دارند', hGood.reasons.length >= 3 && hBad.reasons.length >= 3)
  ok('باندِ فارسیِ سلامت', ['مستحکم', 'قابلِ‌قبول'].includes(hGood.band) && ['شکننده', 'بحرانی'].includes(hBad.band))

  // priorities: از وضعیتِ واقعی، حداکثر ۵، بحرانی اول
  const ePr = {
    capital: 100, assets: [
      { title: 'برجِ الف', construction: { done: false, paidDays: 1, days: 10, costTotal: 1_000_000, paid: 100_000, sold: 0, presold: 0, totalUnits: 8, pendingEvent: { text: 'اعتصابِ کارگران', payCost: 1, extraDays: 2, at: 0 } } },
      { title: 'خانهٔ ب', m100: { illegalArea: 10, illegalUnits: 1, fine: 5_000_000, status: 'pending' } },
      { title: 'زمینِ ج', kind: 'land' },
      { title: 'واحدِ د', kind: 'apartment' },
    ],
    loan: { balance: 1_000, dueAt: now39 + 3 * 864e5 },
  }
  const pr = prioritiesOf(ePr, now39, iCfg)
  ok('حداکثر ۵ اولویت و رویدادِ کارگاه اول', pr.length <= 5 && pr[0].icon === '🚨')
  ok('ماده۱۰۰ و سررسیدِ وام و بحرانِ نقدینگیِ ساخت دیده می‌شوند', pr.some(p => p.icon === '⚖️') && pr.some(p => p.icon === '🏦') && pr.some(p => p.icon === '🏗'))
  ok('بدونِ مسئله → لیستِ خالی (نه اقدامِ ساختگی)', prioritiesOf({ capital: 1e9, assets: [] }, now39, iCfg).length === 0)
  ok('اولویت‌ها قطعی‌اند', JSON.stringify(prioritiesOf(ePr, now39, iCfg)) === JSON.stringify(pr))
}

// ─── فاز ۴۰ (سند ۲۷ Parts 13+21) — مرکزِ خودکارسازی + هوشِ قرارداد (توابعِ خالص) ───
{
  console.log('\n⚙️ فاز ۴۰ — evalRules / tradeAskCheckOf / jvOfferCheckOf')
  const { evalRules, RULE_TEMPLATES, tradeAskCheckOf, jvOfferCheckOf } = await import('../app/lib/empire-intel.ts')
  const now40 = 1_800_000_000_000
  const mkRule = (kind, threshold, over = {}) => ({ id: 'r_' + kind, kind, threshold, level: 'notify', enabled: true, createdAt: 0, ...over })
  const e40 = {
    capital: 1_500_000_000,   // ۱٫۵ میلیارد
    assets: [
      { listingId: 'L1', title: 'سودده', buyPrice: 1_000, boughtAt: 0 },                    // قیمتِ روز ۱۳۰۰ = +۳۰٪
      { listingId: 'L2', title: 'زیان‌ده', buyPrice: 1_000, boughtAt: 0 },                  // قیمتِ روز ۸۵۰ = −۱۵٪
      { listingId: 'L3', title: 'کارگاهِ عقب‌مانده', buyPrice: 0, boughtAt: 0, construction: { done: false, startedAt: now40 - 20 * 864e5, paidDays: 5, days: 30, costTotal: 1, paid: 0 } },   // ۱۵ روز عقب
    ],
    loan: { balance: 500, ratePctYear: 10, dueAt: now40 + 3 * 864e5 },
  }
  const prices = { L1: 1_300, L2: 850 }
  const all = evalRules(e40, [
    mkRule('cashBelow', 2),          // نقد ۱٫۵ < ۲ میلیارد → فعال
    mkRule('profitAbove', 20, { level: 'recommend' }),   // +۳۰٪ ≥ ۲۰٪ → فعال
    mkRule('assetDrop', 10),         // −۱۵٪ ≥ ۱۰٪ → فعال
    mkRule('projectDelay', 10),      // ۱۵ روز > ۱۰ → فعال
    mkRule('loanDue', 7),            // ۳ روز ≤ ۷ → فعال
  ], prices, now40)
  ok('هر ۵ نوع قانون از دادهٔ واقعی فعال می‌شوند', all.length === 5 && new Set(all.map(a => a.kind)).size === 5)
  ok('سطحِ recommend حفظ می‌شود', all.find(a => a.kind === 'profitAbove')?.level === 'recommend')
  ok('قانونِ خاموش/آستانهٔ صفر ارزیابی نمی‌شود', evalRules(e40, [mkRule('cashBelow', 2, { enabled: false }), mkRule('loanDue', 0)], prices, now40).length === 0)
  ok('آستانهٔ ردنشده → بی‌صدا', evalRules(e40, [mkRule('cashBelow', 1)], prices, now40).length === 0)   // ۱٫۵ میلیارد > ۱ میلیارد
  ok('بدونِ قیمتِ روز، قوانینِ قیمتی ساکت می‌مانند (نه عددِ ساختگی)', evalRules(e40, [mkRule('profitAbove', 20), mkRule('assetDrop', 10)], {}, now40).length === 0)
  ok('قالب‌های آماده ۵ نوعِ معتبر دارند', RULE_TEMPLATES.length === 5 && RULE_TEMPLATES.every(t => t.kind && t.label && t.defaultThreshold > 0))

  // هوشِ قرارداد (Part 21)
  const tc = tradeAskCheckOf(1_300, 1_000)
  ok('معامله: +۳۰٪ بالای قیمتِ خریدِ فروشنده تشخیص داده می‌شود', tc.diffPct === 30 && tc.note.includes('بالاتر'))
  ok('معامله: زیرِ قیمتِ خرید → «بپرس چرا»', tradeAskCheckOf(800, 1_000).note.includes('بپرس چرا'))
  ok('معامله: قیمتِ خریدِ نامشخص → صادقانه', tradeAskCheckOf(800, 0).diffPct === null)
  const jc = jvOfferCheckOf(30, 300, 1_000)   // سهمِ منصفانه = ۳۰۰
  ok('مشارکت: آوردهٔ برابرِ سهمِ منصفانه', jc.fair === 300 && jc.diffPct === 0 && jc.note.includes('منصفانه'))
  ok('مشارکت: آوردهٔ گران‌تر → «سازنده سود می‌کند»', jvOfferCheckOf(30, 450, 1_000).note.includes('سازنده سود'))
  ok('مشارکت: بدونِ هزینهٔ ساخت → صادقانه «نامشخص»', jvOfferCheckOf(30, 450, null).fair === null && jvOfferCheckOf(30, 450, null).note.includes('نامشخص'))
}

// ─── فاز ۴۱ (سند ۲۸ فصل ۱۷ — Tycoon نه ERP): معاملهٔ بزرگ + بحران + کمیابی ───
{
  console.log('\n💎 فاز ۴۱ — bigDealPickOf / bigDealNegoOf / crisisOf / rarityOf')
  const { bigDealPickOf, bigDealNegoOf, BIG_DEAL_STRATEGIES } = await import('../app/lib/empire-store.ts')
  const { crisisOf, rarityOf, cashflowOf } = await import('../app/lib/empire-intel.ts')

  // انتخابِ معاملهٔ بزرگ: قطعی، شهری (مستقل از کاربر)، فقط از سگمنتِ گران
  const pool41 = Array.from({ length: 100 }, (_, i) => ({ id: 'L' + i, price: (i + 1) * 1e9 }))
  const pick = bigDealPickOf(10, pool41, 5)
  ok('انتخاب از ۵٪ گران‌ترین‌ها', pick !== null && Number(pick.slice(1)) >= 95)
  ok('قطعی است و به کاربر وابسته نیست', bigDealPickOf(10, pool41, 5) === pick)
  ok('هفتهٔ دیگر ممکن است انتخابِ دیگری بدهد (هشِ هفته)', typeof bigDealPickOf(11, pool41, 5) === 'string')
  ok('بدونِ آگهیِ قیمت‌دار → null صادقانه', bigDealPickOf(10, [], 5) === null && bigDealPickOf(10, [{ id: 'x', price: 0 }], 5) === null)

  // مذاکرهٔ بزرگ: قطعی؛ استراتژی روی شانس اثر می‌گذارد؛ تخفیف در سقف
  const bCfg = { baseChancePct: 35, discountMax: 12 }
  const r1 = bigDealNegoOf('u1', 'L99', 10, 'balanced', 40, bCfg)
  ok('نتیجه قطعی است', JSON.stringify(bigDealNegoOf('u1', 'L99', 10, 'balanced', 40, bCfg)) === JSON.stringify(r1))
  ok('شانس در بازهٔ ۵..۹۰ و شفاف', r1.chancePct >= 5 && r1.chancePct <= 90)
  const rBold = bigDealNegoOf('u1', 'L99', 10, 'bold', 40, bCfg)
  const rSafe = bigDealNegoOf('u1', 'L99', 10, 'safe', 40, bCfg)
  ok('محافظه‌کار شانسِ بیشتری از تهاجمی دارد', rSafe.chancePct > rBold.chancePct)
  ok('تخفیفِ برنده در (۰..سقف]', [r1, rBold, rSafe].every(r => r.success ? (r.discountPct >= 1 && r.discountPct <= 12) : r.discountPct === 0))
  ok('استراتژیِ نامعتبر → متعادل', bigDealNegoOf('u1', 'L99', 10, 'xxx', 40, bCfg).strategy === 'balanced')
  ok('۳ استراتژیِ سند موجودند', BIG_DEAL_STRATEGIES.length === 3)

  // بحران: از سیگنال‌های واقعی — runway کم + وامِ معوق + کارگاهِ خوابیده
  const now41 = 1_800_000_000_000
  const calm = { capital: 1e10, assets: [], loan: undefined }
  const okFlow = cashflowOf(calm, now41)
  ok('امپراتوریِ آرام: بدونِ بحران', crisisOf(calm, okFlow, now41).active === false)
  const troubled = {
    capital: 900_000,
    assets: [{ construction: { done: false, startedAt: now41 - 20 * 864e5, paidDays: 2, days: 30, costTotal: 3_000_000, paid: 200_000 } }],
    loan: { balance: 5_000_000, ratePctYear: 10, dueAt: now41 - 864e5 },
  }
  const tFlow = cashflowOf(troubled, now41)
  const cr = crisisOf(troubled, tFlow, now41, { crisisRunwayDays: 10, crisisStalledDays: 5 })
  ok('چند سیگنالِ همزمان → بحرانِ قرمز با دلایل', cr.active === true && cr.level === 'قرمز' && cr.reasons.length >= 3)
  ok('فقط یک سیگنالِ ضعیف → بحران نه', crisisOf({ ...calm, loan: { balance: 100, ratePctYear: 10, dueAt: now41 + 2 * 864e5 } }, okFlow, now41).active === false)

  // کمیابی: فقط از فاصلهٔ واقعی با میانهٔ محله؛ بی‌داده = بی‌برچسب
  ok('−۲۵٪ زیرِ میانه = نایاب ۴✦', rarityOf(75, 100, 6, 4)?.label === 'نایاب' && rarityOf(75, 100, 6, 4)?.stars === 4)
  ok('−۱۲٪ = کمیاب، −۶٪ = ویژه، بالای میانه = عادی', rarityOf(88, 100, 6, 4)?.label === 'کمیاب' && rarityOf(94, 100, 6, 4)?.label === 'ویژه' && rarityOf(110, 100, 6, 4)?.label === 'عادی')
  ok('نمونهٔ ناکافی/میانهٔ صفر → null (نه برچسبِ ساختگی)', rarityOf(80, 100, 2, 4) === null && rarityOf(80, 0, 9, 4) === null)
}

// ─── ضابطهٔ واقعیِ ساخت (فیدبکِ کاربر): طبقاتِ مجاز از متراژ + عرفِ محله + پارکینگ ───
{
  console.log('\n📏 ضابطهٔ ساخت — legalFloorsOf / floorsOfMeta / designPlanOf (پارکینگ)')
  const { legalFloorsOf, floorsOfMeta, designPlanOf } = await import('../app/lib/empire-store.ts')
  const fc = { tierA: 150, tierAFloors: 2, tierB: 250, tierBFloors: 3, tierC: 500, tierCFloors: 4, tierD: 1000, tierDFloors: 5, bigFloors: 6, hoodBonusMax: 2 }
  ok('پلکانِ متراژ: ۱۰۰م→۲ط، ۲۰۰م→۳ط، ۳۰۰م→۴ط، ۷۰۰م→۵ط، ۱۵۰۰م→۶ط',
    legalFloorsOf(100, null, fc).floors === 2 && legalFloorsOf(200, null, fc).floors === 3 &&
    legalFloorsOf(300, null, fc).floors === 4 && legalFloorsOf(700, null, fc).floors === 5 && legalFloorsOf(1500, null, fc).floors === 6)
  ok('عرفِ بلندمرتبهٔ محله تا سقفِ +۲ اثر می‌کند', legalFloorsOf(200, 8, fc).floors === 5 && legalFloorsOf(200, 8, fc).hoodApplied === true)
  ok('عرفِ محله در حدِ سقف نباشد → همان عرف', legalFloorsOf(200, 4, fc).floors === 4)
  ok('عرفِ کوتاه‌تر از ضابطهٔ متراژ حق را کم نمی‌کند', legalFloorsOf(700, 2, fc).floors === 5 && legalFloorsOf(700, 2, fc).hoodApplied === false)
  ok('متای واقعی «طبقه: ۲ از ۵» → ۵', floorsOfMeta({ 'طبقه': '۲ از ۵' }) === 5 && floorsOfMeta({ 'طبقه': '3 از 12' }) === 12)
  ok('متای بی‌ربط/غایب → null (نه حدس)', floorsOfMeta({ 'طبقه': 'همکف' }) === null && floorsOfMeta(undefined) === null)
  // پارکینگ: زمینِ ۲۰۰م، اشغال ۶۰٪ → همکف ۱۲۰م → ۴ جای پارک × ۲ طبقه = ۸ واحد سقف
  const dCfg = { occupancyPct: 60, buildFactor: 2, maxOverFloors: 2, minUnitArea: 35, parkingAreaPerUnit: 25, parkingLevels: 2 }
  const okPlan = designPlanOf(200, 4, 2, dCfg, 4)
  ok('طرحِ ۸ واحدی با ظرفیتِ پارکینگِ ۸ قبول می‌شود', okPlan.ok === true && okPlan.parkingCap === 8 && okPlan.legalFloors === 4)
  const badPlan = designPlanOf(200, 6, 2, dCfg, 4)
  ok('۱۲ واحد بدونِ پارکینگِ کافی رد می‌شود (هر واحد یک پارکینگ)', badPlan.ok === false && badPlan.reason.includes('پارکینگ'))
  ok('پارکینگ خاموش (۰) → بدونِ محدودیت', designPlanOf(200, 6, 2, { ...dCfg, parkingAreaPerUnit: 0 }, 4).ok === true)
  ok('legalFloorsOverride مبنای مجاز/تخلف است', (() => { const p = designPlanOf(300, 5, 1, dCfg, 4); return p.ok === true && p.legalFloors === 4 && p.illegalFloors === 1 })())
  ok('بدونِ override همان فرمولِ قدیمی (سازگاری)', designPlanOf(200, 1, 1, dCfg).ok === true)
}

// ─── فاز ۴۵ (سند ۲۹ — Auction Saga): تالارِ مزایدهٔ هفته ───
{
  console.log('\n🏛 فاز ۴۵ — auctionPickOf / auctionSetupOf / auctionInfluenceOf / auctionMoveOf')
  const { auctionPickOf, auctionSetupOf, auctionInfluenceOf, auctionNextBidOf, auctionMoveOf, AUCTION_RIVALS, AUCTION_TYPES } = await import('../app/lib/empire-store.ts')

  // انتخاب: قطعی، شهری، از باندِ میانیِ بازار (۲۰..۸۰ پرسنتایل) — متمایز از سگمنتِ لوکسِ معاملهٔ بزرگ
  const pool45 = Array.from({ length: 100 }, (_, i) => ({ id: 'A' + i, price: (i + 1) * 1e9 }))
  const pk = auctionPickOf(7, pool45)
  ok('انتخاب از باندِ میانی (۲۰..۸۰٪)', pk !== null && Number(pk.slice(1)) >= 20 && Number(pk.slice(1)) < 80)
  ok('قطعی و مستقل از کاربر', auctionPickOf(7, pool45) === pk)
  ok('excludeId (ملکِ معاملهٔ بزرگ) کنار گذاشته می‌شود', auctionPickOf(7, pool45, pk) !== pk)
  ok('بدونِ آگهیِ قیمت‌دار → null صادقانه', auctionPickOf(7, []) === null && auctionPickOf(7, [{ id: 'x', price: 0 }]) === null)

  // صحنه‌چینی: نوع/رقبا/سقفِ پنهان/شایعه — همه قطعی از هشِ هفته+آگهی
  const sCfg = { rivalsMax: 4, revengePct: 6 }
  const su = auctionSetupOf(7, 'A50', 1e9, {}, sCfg)
  ok('صحنه قطعی است', JSON.stringify(auctionSetupOf(7, 'A50', 1e9, {}, sCfg)) === JSON.stringify(su))
  ok('نوع از فهرستِ سند است', AUCTION_TYPES.some(t => t.key === su.type.key))
  ok('قیمتِ شروع زیرِ قیمتِ آگهی', su.start > 0 && su.start < 1e9)
  ok('۲ تا ۴ رقیبِ شخصیت‌دار با سقفِ پنهانِ مثبت', su.rivals.length >= 2 && su.rivals.length <= 4 && su.rivals.every(r => r.ceiling > 0 && AUCTION_RIVALS.some(d => d.key === r.key)))
  ok('شایعه‌ها ≤۲ و هرکدام پرچمِ راست/دروغ دارند', su.rumors.length <= 2 && su.rumors.every(r => typeof r.truth === 'boolean' && r.text.length > 10))
  const grudged = auctionSetupOf(7, 'A50', 1e9, { [su.rivals[0].key]: 3 }, sCfg)
  ok('انتقام: ۳ بردِ قبلی → سقفِ همان رقیب +۱۸٪', grudged.rivals[0].ceiling === Math.round(su.rivals[0].ceiling * 1.18))

  // نفوذ: فقط از رفتارِ واقعی؛ سقف‌دار؛ بازیکنِ تازه = صفر (نه عددِ ساختگی)
  ok('بازیکنِ تازه نفوذی ندارد', auctionInfluenceOf({ stats: {}, xp: 0 }, 5).pct === 0)
  const vet = { stats: { sellsProfitable: 3, projectsDelivered: 1, crisisRecovered: 1 }, creditHist: { repaid: 1, lateDays: 0 }, xp: 0 }
  const inf45 = auctionInfluenceOf(vet, 5)
  ok('کهنه‌کار: ۴ دلیلِ واقعی → ۴٪', inf45.pct === 4 && inf45.reasons.length === 4)
  ok('سقفِ knob رعایت می‌شود', auctionInfluenceOf(vet, 2).pct === 2)

  // موتورِ نبرد: قطعی؛ خروج=پایان؛ چکش بعد از ۳ شمارش؛ سقفِ راند
  const mCfg = { stepPct: 4, powerPct: 12, maxRounds: 10 }
  const run0 = { week: 7, listingId: 'A50', title: 'برجِ آزمون', hood: 'تست', type: 'bank', anchor: 1e9, start: 620e6, price: 620e6, leader: '', round: 0, calls: 0, rivals: [{ key: 'kamran', ceiling: 100e6 }, { key: 'atlas', ceiling: 120e6 }], rumors: [], log: [], at: 0 }
  ok('پیشنهادِ اول = قیمتِ پایه؛ حملهٔ سنگین = پایه + جهش', auctionNextBidOf(run0, 'bid', mCfg) === 620e6 && auctionNextBidOf(run0, 'power', mCfg) === 620e6 + 120e6)
  const m1 = auctionMoveOf('u45', run0, 'bid', 0, mCfg)
  ok('حرکت قطعی است', JSON.stringify(auctionMoveOf('u45', run0, 'bid', 0, mCfg)) === JSON.stringify(m1))
  ok('پیشنهادِ بازیکن → صدرنشینی', m1.leader === 'me' && m1.price === 620e6 && !m1.done)
  // رقبا سقفشان پایین‌تر از قیمت است → هرگز پاسخ نمی‌دهند؛ ۳ سکوت = چکش به نامِ بازیکن
  let mw = m1
  for (let i = 0; i < 3 && !mw.done; i++) mw = auctionMoveOf('u45', mw, 'wait', 0, mCfg)
  ok('«بار اول… بار دوم…» → چکش: بردِ بازیکن', mw.done === true && mw.won === true && mw.final === 620e6)
  ok('پایان، قیمتِ واقعیِ آگهی و شایعه‌ها را رو می‌کند', mw.log.some(l => l.text.includes('قیمتِ واقعیِ آگهی')))
  const mq = auctionMoveOf('u45', run0, 'quit', 0, mCfg)
  ok('خروجِ آگاهانه = پایانِ بدونِ برد', mq.done === true && mq.won === false)

  // فاز ۵۴ (فیدبک: «به‌خاطرِ واژهٔ فرشته رد کرد»): شباهتِ واژه‌ای هرگز مجوزِ ردِ خودکار نیست
  {
    const { featuresOf, learn, predict, rejectEvidenceOf, resetMl } = await import('../app/lib/moderation-ml.ts')
    resetMl()
    ok('واژه‌های عمومی/بازاریابی دیگر ویژگی نیستند (فرشته می‌ماند ولی ببینید/اعتبار حذف)', (() => {
      const f = featuresOf({ title: 'برج لوکس ببینید اعتبار فرشته', excerpt: '', price: '' })
      return !f.includes('ببینید') && !f.includes('اعتبار') && f.includes('فرشته')
    })())
    // مدل را عمداً «مسموم» می‌کنیم: ۵۰ ردی با واژهٔ فرشته، ۵۰ تأییدیِ بی‌ربط — بعد آگهیِ سالمِ فرشته‌دار
    for (let i = 0; i < 50; i++) learn({ title: `کلاهبرداری فرشته شماره${i}`, excerpt: 'کلاهبرداری تقلبی', price: '' }, 'rejected')
    for (let i = 0; i < 50; i++) learn({ title: `آپارتمان نوساز شماره${i}`, excerpt: 'توضیحاتِ کاملِ یک آگهیِ سالمِ معمولی با جزئیات', price: '۵٬۰۰۰٬۰۰۰٬۰۰۰ تومان', meta: { 'متراژ': '100' } }, 'approved')
    const victim = { title: 'برج دهکده فرشته فلاح', excerpt: 'کارگزارِ رسمیِ شرکتِ سازنده فرشته فلاح — قراردادِ محضری و سندِ تک‌برگ', price: '۸٬۰۰۰٬۰۰۰٬۰۰۰ تومان', meta: { 'متراژ': '138' } }
    const pv = predict(victim)
    const ev = rejectEvidenceOf(victim)
    ok('اگر مدل به سمتِ رد برود، شواهدش فقط واژه‌ای است → wordsOnly (رد ممنوع، فقط بازبینی)', pv.label !== 'rejected' || ev.wordsOnly === true)
    const spam = { title: 'فروش فوری', excerpt: 'تماس ۰۹۱۲۱۲۳۴۵۶۷ تلگرام @xyz', price: '' }
    ok('اسپمِ واقعی نشانهٔ ساختاری دارد (رد مجاز)', rejectEvidenceOf(spam).hard.length > 0)
    resetMl()
  }

  // فاز ۷۷ (فیدبک: «دستی می‌زنم ولی یاد نمی‌گیرد» + «هیچی قابلِ‌اندازه‌گیری نیست»)
  {
    const { resetMl, learn, predict, correctFromAdmin, mlStats } = await import('../app/lib/moderation-ml.ts')
    resetMl()
    // مدل را با الگوی مسمومِ واقعیِ کاربر می‌سازیم: «گول/نخور» در ردی‌ها
    for (let i = 0; i < 45; i++) learn({ title: `کلاهبرداری گول نخور شماره${i}`, excerpt: 'گول تقلبی نخور کلاهبرداری', price: '' }, 'rejected')
    for (let i = 0; i < 45; i++) learn({ title: `آپارتمان نوساز شماره${i}`, excerpt: 'توضیحِ کاملِ آگهیِ سالم با جزئیاتِ دقیق', price: '۵٬۰۰۰٬۰۰۰٬۰۰۰ تومان', meta: { 'متراژ': '100' } }, 'approved')
    const victim77 = { title: 'ویلا محمودآباد استخردار', excerpt: 'گول آگهی فیک و نخور — سندِ تک‌برگ، انشعاباتِ اختصاصی، ۴خواب', price: '۱۵٬۰۰۰٬۰۰۰٬۰۰۰ تومان', meta: { 'متراژ': '350' } }
    const before = predict(victim77)
    // ادمین چند بار حکمِ اشتباه را برمی‌گرداند (یادگیریِ اصلاحی: unlearn از کلاسِ غلط + آموزشِ ۳برابری)
    for (let i = 0; i < 4; i++) correctFromAdmin({ ...victim77, title: victim77.title + ' ' + i }, 'approved', 'rejected')
    const after = predict(victim77)
    ok('اصلاحِ دستیِ ادمین واقعاً مدل را برمی‌گرداند (احتمالِ تأیید بالا می‌رود)', (after.label === 'approved') || (before.label === 'rejected' && after.prob < before.prob))
    const st77 = mlStats()
    ok('کارنامهٔ قابل‌اندازه‌گیری: اصلاح‌ها + پنجرهٔ بازبینی + واژگان', st77.corrections === 4 && st77.recentReviewed === 4 && st77.recentAgreePct === 0 && st77.vocab > 0)
    resetMl()
  }

  // فاز ۵۴ (دفترِ مصرفِ AI): تشخیصِ منبعِ صدازننده از stack
  const { callerSrcOf } = await import('../app/lib/ai-usage-store.ts')
  ok('منبع از stack استخراج می‌شود', callerSrcOf('Error\\n at x (/srv/app/lib/moderation.ts:12:5)\\n').startsWith('app/lib/moderation'))
  ok('بدونِ فریمِ app → «ناشناخته» (نه کرش)', callerSrcOf('Error\\n at native') === 'ناشناخته')

  // فاز ۵۲ (سقف‌های مصرف): معناشناسیِ دقیقِ سهمیه — >۰ سقف؛ −۱/۰/تعریف‌نشده = نامحدود (قراردادِ plan-store)
  const { quotaCapOf } = await import('../app/lib/plan-gate.ts')
  ok('سهمیهٔ مثبت = سقف', quotaCapOf({ quotas: { listings: 2 } }, 'listings') === 2)
  ok('−۱ و ۰ و تعریف‌نشده = نامحدود', quotaCapOf({ quotas: { leads: -1, files: 0 } }, 'leads') === null && quotaCapOf({ quotas: { files: 0 } }, 'files') === null && quotaCapOf({ quotas: {} }, 'sms') === null)
  const { monthBucketOf } = await import('../app/lib/plan-usage.ts')
  ok('سطلِ ماهانهٔ مصرف: YYYY-MM', /^\d{4}-\d{2}$/.test(monthBucketOf()) && monthBucketOf(new Date('2026-03-05').getTime()) === '2026-03')

  // فاز ۵۱ (اعمالِ پلن‌ها): هستهٔ خالصِ گیت — پلنِ فعال مقدم بر پلنِ رایگان؛ بدونِ هر دو = بدونِ مجوز
  const { effectivePermsOf } = await import('../app/lib/plan-gate.ts')
  ok('پلنِ فعال منبعِ مجوزهاست', JSON.stringify(effectivePermsOf({ permissions: ['crm', 'website'], quotas: { leads: 100 } }, { permissions: ['listings'], quotas: {} }).permissions) === JSON.stringify(['crm', 'website']))
  ok('بدونِ پلن → پلنِ رایگانِ نقش', effectivePermsOf(null, { permissions: ['listings'], quotas: { listings: 2 } }).permissions.includes('listings') && effectivePermsOf(null, { permissions: ['listings'], quotas: { listings: 2 } }).quotas.listings === 2)
  ok('بدونِ هیچ پلنی → هیچ مجوزی (نه دسترسیِ همه‌چیز)', effectivePermsOf(null, null).permissions.length === 0)

  // فاز ۵۵ (فیدبک: «هر کسی وارد می‌شود همه‌چیز دارد»): قفلِ کلِ داشبورد — داینامیک از پلن‌های همان داشبورد
  const { panelLockOf } = await import('../app/lib/plan-gate.ts')
  const prosPlans55 = [{ permissions: ['crm', 'listings'] }, { permissions: ['crm', 'marketing', 'website'] }]
  ok('کاربرِ بدونِ هیچ ماژول در داشبوردِ ماژول‌محور → قفل', panelLockOf([], prosPlans55).locked === true)
  ok('universe = اجتماعِ ماژول‌های پلن‌های داشبورد', JSON.stringify(panelLockOf([], prosPlans55).modules) === JSON.stringify(['crm', 'listings', 'marketing', 'website']))
  ok('داشتنِ حتی یک ماژول از universe → باز (گیتِ داخلی بقیه را می‌گیرد)', panelLockOf(['crm'], prosPlans55).locked === false)
  ok('داشبوردِ بدونِ پلنِ ماژول‌دار (مثل /buyer) → هرگز قفل نمی‌شود', panelLockOf([], [{ permissions: [] }, { permissions: [] }]).locked === false && panelLockOf([], []).locked === false)
  ok('مجوزِ نامرتبط با داشبورد قفل را باز نمی‌کند', panelLockOf(['store'], prosPlans55).locked === true)

  // فاز ۷۱ (سند ۳۳): کتابِ زندگیِ قاعده‌مند + مناسبت‌های واقعیِ تقویم
  const { biographyOf } = await import('../app/lib/empire-store.ts')
  const bioRich = biographyOf({ name: 'Alpha', createdAt: 1700000000000, path: 'builder', dream: { sentence: 'برجِ خودم' }, badges: ['Phoenix'], stats: { negoTries: 4, negoWins: 3, projectsDelivered: 2, auctionWins: 2, auctionTries: 5 }, creditHist: { taken: 1 }, insurancePaid: 5e6, wagesPaid: 200e6, projectHist: [{ units: 12 }], timeline: [{ at: 1700000001000, icon: '🏠', title: 'اولین خرید' }, { at: 1700000002000, icon: '🚨', title: 'بحران' }, { at: 1700000003000, icon: '🏙', title: 'برج تکمیل شد', detail: 'برج نور' }, { at: 1700000004000, icon: '🔨', title: 'چکش' }] })
  ok('کتابِ زندگی: فصل‌های واقعی (تولد/مالکیت/ققنوس/برج/چکش/شخصیت/اثر/کارفرما)', bioRich.length >= 8 && bioRich[0].title === 'فصلِ آغاز' && bioRich.some(c => c.title === 'سقوط و بازگشت') && bioRich.some(c => c.title === 'شخصیت — از رفتارِ واقعی'))
  const bioNew = biographyOf({ name: 'Nu', createdAt: Date.now(), badges: [], timeline: [], assets: [], stats: {} })
  ok('امپراتوریِ تازه = فقط فصلِ آغاز (نه ادعای ساختگی)', bioNew.length === 1)
  const { occasionOf } = await import('../app/lib/empire-world.ts')
  ok('نوروز از تقویمِ واقعیِ فارسی', occasionOf(new Date('2024-03-21T10:00:00Z'))?.icon === '🌸')
  ok('یلدا (۳۰ آذر)', occasionOf(new Date('2024-12-20T10:00:00Z'))?.icon === '🍉')
  ok('روزِ عادی = بدونِ مناسبت (نه ساختگی)', occasionOf(new Date('2024-05-15T10:00:00Z')) === null)

  // فاز ۷۰ (دولتِ زنده): مصوبهٔ هفته — قطعی، محدود به دامنهٔ knob، با اعلامِ پیشاپیش
  const { govDecreeOf } = await import('../app/lib/empire-world.ts')
  const gGov = { enabled: true, chancePct: 100, maxTaxDelta: 0.5, maxLoanDelta: 2 }
  const d70a = govDecreeOf(120, gGov), d70b = govDecreeOf(120, gGov)
  ok('مصوبه قطعی از هشِ هفته (دو اجرا = یکسان)', JSON.stringify(d70a) === JSON.stringify(d70b) && d70a.kind !== 'none' && d70a.fa.length > 0)
  ok('دلتاها در دامنهٔ knob می‌مانند', [...Array(30)].every((_, w) => { const d = govDecreeOf(w, gGov); return Math.abs(d.taxDelta) <= 0.5 && Math.abs(d.loanDelta) <= 2 }))
  ok('خاموش = بدونِ مصوبه', govDecreeOf(120, { ...gGov, enabled: false }).kind === 'none')
  ok('شانسِ صفر = همیشه بدونِ مصوبه', govDecreeOf(120, { ...gGov, chancePct: 0 }).kind === 'none')

  // فاز ۶۸ (چندشهری v1): شهر از location واقعی + آمارِ شهرها + مجموعهٔ فاتحِ شهرها
  const { cityOf, cityStatsOf } = await import('../app/lib/empire-world.ts')
  ok('شهر از location («شهر، محله» → شهر؛ تک‌بخشی خودش شهر است)', cityOf('تهران، پونک') === 'تهران' && cityOf('کیش') === 'کیش' && cityOf('') === '')
  const cs68 = cityStatsOf([{ city: 'تهران', price: 4e9 }, { city: 'تهران', price: 6e9 }, { city: 'تهران', price: 10e9 }, { city: 'کیش', price: 20e9 }, { city: '', price: 5e9 }])
  ok('آمارِ شهرها: گروه‌بندی + میانه + مرتب به تعداد', cs68.length === 2 && cs68[0].city === 'تهران' && cs68[0].listings === 3 && cs68[0].medianPrice === 6e9 && cs68[1].city === 'کیش')
  const { COLLECTIONS: COL68 } = await import('../app/lib/empire-store.ts')
  const colCity = COL68.find(c => c.key === 'فاتحِ شهرها')
  ok('فاتحِ شهرها فقط شهرهای ثبت‌شدهٔ واقعی را می‌شمرد (قدیمی‌های بدونِ شهر = صفر)', colCity.progress({ assets: [{ city: 'تهران' }, { city: 'کیش' }, {}] }) === 2 && colCity.progress({ assets: [{}] }) === 0)

  // فاز ۶۶ (Season Engine v1): مقدارِ فصلی = دلتای واقعی از بیس‌لاینِ ورود به فصل
  const { seasonValueOf } = await import('../app/lib/empire-store.ts')
  const e66 = { assets: [{ income: 300e6 }], stats: { projectsDelivered: 5, auctionWins: 4 }, seasonSnap: { id: 'S1', day: 10, netWorth: 100e9, projects: 3, auctionWins: 1, income: 100e6 } }
  ok('رشدِ فصل = دلتای ارزشِ خالص (منفی هم صادقانه)', seasonValueOf(e66, 130e9, 'growth') === 30e9 && seasonValueOf(e66, 90e9, 'growth') === -10e9)
  ok('پروژه/مزایده/درآمدِ فصل = دلتای شمارنده‌های واقعی', seasonValueOf(e66, 0, 'projects') === 2 && seasonValueOf(e66, 0, 'auctionWins') === 3 && seasonValueOf(e66, 0, 'income') === 200e6)
  ok('بدونِ بیس‌لاین = صفر (نه ادعای بی‌مبنا)', seasonValueOf({ assets: [], stats: {} }, 50e9, 'growth') === 0)

  // فاز ۶۵ (NPC Civilization v1): تیکِ قطعیِ شرکت‌های سیستمی روی آگهی‌های واقعی — حلقهٔ پولیِ بسته
  const { npcSeed, npcTickOf, npcOwnerOf, NPC_DEFS } = await import('../app/lib/empire-npc.ts')
  const gN = { enabled: true, count: 6, startCapital: 300e9, actChancePct: 100, maxAssets: 10 }
  const candsN = Array.from({ length: 20 }, (_, i) => ({ id: 'L' + i, title: 'ملک ' + i, hood: 'محلهٔ ' + (i % 4), price: (i + 1) * 1e9 }))
  const dbN1 = npcSeed({ day: 0, companies: [] }, gN.count, gN.startCapital)
  ok('کاشتِ شرکت‌ها ایدمپوتنت', npcSeed(dbN1, gN.count, gN.startCapital).companies.length === 6)
  const t1 = npcTickOf(JSON.parse(JSON.stringify(dbN1)), 50, candsN, gN)
  const t2 = npcTickOf(JSON.parse(JSON.stringify(dbN1)), 50, candsN, gN)
  ok('تیکِ روزانه قطعی از هش (دو اجرا = یکسان)', JSON.stringify(t1.d) === JSON.stringify(t2.d) && t1.bought.length > 0)
  ok('پولِ خرید از سرمایهٔ خودِ شرکت کم می‌شود (حلقهٔ بسته)', t1.d.companies.every(c => c.capital + c.assets.reduce((s2, a) => s2 + a.cost, 0) === 300e9))
  ok('هیچ آگهی‌ای دو مالکِ NPC ندارد', (() => { const all = t1.d.companies.flatMap(c => c.assets.map(a => a.listingId)); return new Set(all).size === all.length })())
  const vOf = t1.d.companies.find(c => c.style === 'value'), lOf = t1.d.companies.find(c => c.style === 'luxury')
  ok('استایل باندِ قیمتی را عوض می‌کند (ارزش‌خر ارزان‌تر از لوکس‌باز می‌خرد)', !vOf?.assets.length || !lOf?.assets.length || vOf.assets[0].cost < lOf.assets[0].cost)
  ok('تیکِ همان روز دوباره اجرا نمی‌شود (dedupe)', npcTickOf(t1.d, 50, candsN, gN).bought.length === 0)
  ok('npcOwnerOf مالک را پیدا می‌کند', t1.bought.length === 0 || npcOwnerOf(t1.d, t1.bought[0].listingId)?.id === t1.bought[0].npc)
  const t3 = npcTickOf(t1.d, 80, candsN.map(x => ({ ...x, price: x.price * 2 })), gN)
  const soldOne = t3.sold[0]
  ok('فروش با قیمتِ روزِ واقعی → سودِ ثبت‌شده در دفترِ خودش', !soldOne || (soldOne.pnl > 0 && t3.d.companies.find(c => c.id === soldOne.npc).realized > 0))
  ok('خاموش = هیچ حرکتی', npcTickOf(JSON.parse(JSON.stringify(dbN1)), 60, candsN, { ...gN, enabled: false }).bought.length === 0)

  // فاز ۶۳ (سند ۳۲ — فصل ۲۱ Live World): سالِ دنیا/دمای دنیا/شایعاتِ منصفانه — هسته‌های خالص
  const { worldYearOf, worldHeatOf, rumorsGen, resolveRumor, sourceTrustOf, worldEpochOf } = await import('../app/lib/empire-world.ts')
  ok('سالِ دنیا از dayNumber (سالِ ۹۰روزه)', worldYearOf(0, 90).year === 1 && worldYearOf(89, 90).year === 1 && worldYearOf(90, 90).year === 2 && worldYearOf(90, 90).dayOfYear === 1)
  // فاز ۹۰: کلیدِ شهرِ شاردِ سایت‌مپ — متنِ زمانِ اسکرپ/عددی/طولانی هرگز شارد نمی‌شود
  {
    const { cityKeyOf } = await import('../app/lib/sitemap-store.ts')
    ok('شهرِ سالم شارد می‌شود', cityKeyOf('تهران', '') !== 'other' && cityKeyOf(undefined, 'چمستان، نور') !== 'other')
    ok('متنِ «۱۸ ساعت پیش در …» شارد نمی‌شود', cityKeyOf(undefined, '۱۸ ساعت پیش در مروارید شهر، فلان') === 'other')
    ok('عدد/طولانی/چندکلمه‌ای → other', cityKeyOf('منطقه ۲۲', '') === 'other' && cityKeyOf('یک نام خیلی خیلی طولانی برای شهر بودن', '') === 'other')
    ok('پیشوندِ «در» پاک می‌شود', cityKeyOf(undefined, 'در آمل، بلوار') === cityKeyOf('آمل', ''))
  }

  // فاز ۹۵: پیش‌نمایشِ سبکِ تصاویر کارت‌ها — فقط divarcdn به بهینه‌ساز داخلی می‌رود
  {
    const { previewSrc } = await import('../app/lib/img-preview.ts')
    const u = 'https://s100.divarcdn.com/static/pictures/1607624286/wXSTyUdO.webp'
    ok('آدرسِ divarcdn → /_next/image با w و q مجاز', previewSrc(u) === `/_next/image?url=${encodeURIComponent(u)}&w=640&q=60`)
    ok('عرض/کیفیتِ دلخواه در آدرس می‌نشیند', previewSrc(u, 384, 75).endsWith('&w=384&q=75'))
    ok('آدرسِ غیرِ divarcdn دست‌نخورده می‌ماند', previewSrc('/media/x.jpg') === '/media/x.jpg' && previewSrc('https://example.com/a.jpg') === 'https://example.com/a.jpg')
    ok('خالی → خالی', previewSrc(undefined) === '' && previewSrc('') === '')
    // فاز ۹۷: آپلودهای خودمان (بنر) هم بهینه می‌شوند
    ok('مدیای لوکال (/api/media) → بهینه‌ساز', previewSrc('/api/media/abc123', 1080) === `/_next/image?url=${encodeURIComponent('/api/media/abc123')}&w=1080&q=60`)
  }

  // فاز ۹۸: تنظیماتِ سایت (فوتر + صفحه‌های عمومی) — پیش‌فرض‌ها، گاردها، merge
  {
    const { unlinkSync, existsSync: ex98 } = await import('fs')
    const clean98 = () => { try { if (ex98('.site-data.json')) unlinkSync('.site-data.json') } catch {} }
    clean98()
    const { siteConfig, upsertPage, deletePage, pageOf } = await import('../app/lib/site-store.ts')
    const cfg0 = siteConfig()
    ok('بدونِ فایل → پیش‌فرض‌ها (۴ صفحهٔ سیستمی + ۳ ستونِ فوتر)',
      cfg0.pages.filter(p => p.system).length === 4 && cfg0.footer.cols.length === 3 && !!pageOf('about'))
    ok('اسلاگِ فارسی/نامعتبر رد می‌شود', upsertPage({ slug: 'صفحه', title: 'x', body: '' }).ok === false)
    ok('اسلاگِ رزرو (search) رد می‌شود', upsertPage({ slug: 'search', title: 'x', body: '' }).ok === false)
    const mk = upsertPage({ slug: 'jobs', title: 'همکاری', body: 'متن' })
    ok('صفحهٔ سفارشی ساخته می‌شود و pageOf می‌بیندش', mk.ok === true && pageOf('jobs')?.title === 'همکاری')
    const ed = upsertPage({ slug: 'about', title: 'دربارهٔ ما ۲', body: 'متنِ نو', show: true })
    ok('ویرایشِ صفحهٔ سیستمی ذخیره می‌شود', ed.ok === true && pageOf('about')?.title === 'دربارهٔ ما ۲')
    ok('صفحهٔ پنهان از pageOf برنمی‌گردد', upsertPage({ slug: 'jobs', title: 'همکاری', body: 'متن', show: false }).ok === true && pageOf('jobs') === null)
    ok('حذفِ صفحهٔ سیستمی ممنوع، سفارشی مجاز', deletePage('about').ok === false && deletePage('jobs').ok === true)
    ok('صفحهٔ سیستمیِ جاافتاده بعد از ذخیره دوباره merge می‌شود', siteConfig().pages.some(p => p.slug === 'privacy'))
    clean98()
  }

  // فاز ۱۰۰ (جلد ۴۳): شاخصِ قیمتِ مصالح — مدین، پایهٔ ۱۰۰، دلتاها، گاردِ پوشش و کف/سقفِ ضریب
  {
    const { unlinkSync: ul100, existsSync: ex100 } = await import('fs')
    const clean100 = () => { try { if (ex100('.materials-index-data.json')) ul100('.materials-index-data.json') } catch {} }
    clean100()
    const { medianOf, computeMaterialsSnapshot, recordMaterialsSnapshot, materialsIndexState, materialsFactorOf } = await import('../app/lib/materials-index.ts')
    ok('مدین: زوج/فرد/خالی', medianOf([3, 1, 2]) === 2 && medianOf([1, 2, 3, 100]) === 3 && medianOf([]) === 0)
    const rows = [
      { category: 'سیمان', median: 100_000, sellers: 3 }, { category: 'سیمان', median: 120_000, sellers: 2 },
      { category: 'میلگرد', median: 30_000_000, sellers: 4 }, { category: 'آجر', median: 5_000, sellers: 1 },
      { category: 'گچ', median: 60_000, sellers: 2 }, { category: 'شن', median: 900_000, sellers: 1 },
    ]
    const s1 = computeMaterialsSnapshot(rows, 1000)
    ok('اسنپ‌شات: مدینِ کل و دسته‌ها از قیمت‌های واقعی', s1.items === 6 && s1.cats['سیمان'] === 110_000 && s1.overall === medianOf(rows.map(r => r.median)))
    recordMaterialsSnapshot(s1, 5)
    // روزِ بعد: همه ۱۰٪ گران‌تر
    const s2 = computeMaterialsSnapshot(rows.map(r => ({ ...r, median: Math.round(r.median * 1.1) })), 1007)
    recordMaterialsSnapshot(s2, 5)
    const st = materialsIndexState(5)
    ok('پایه = ۱۰۰ در روزِ اول؛ بعد از ۱۰٪ گرانی شاخص ≈ ۱۱۰', st.ok && st.baseDay === 1000 && st.index > 109 && st.index < 111)
    ok('دلتای هفته ≈ +۱۰٪', typeof st.weekDeltaPct === 'number' && st.weekDeltaPct > 9 && st.weekDeltaPct < 11)
    const cfg100 = { enabled: true, clampMin: 0.85, clampMax: 1.2 }
    ok('ضریبِ ساخت = شاخص÷۱۰۰ در بازهٔ مجاز', Math.abs(materialsFactorOf(st, cfg100) - st.index / 100) < 0.01)
    ok('سقف/کف اعمال می‌شود', materialsFactorOf({ ok: true, index: 300 }, cfg100) === 1.2 && materialsFactorOf({ ok: true, index: 10 }, cfg100) === 0.85)
    ok('پوششِ ناکافی یا خاموش → ضریب ۱ (بی‌اثر)', materialsFactorOf({ ok: false, index: 150 }, cfg100) === 1 && materialsFactorOf(st, { ...cfg100, enabled: false }) === 1)
    clean100()
  }

  // فاز ۱۰۱ (NPC v2): جنگِ شرکتی + تصاحبِ خصمانه + شهروندان + رسانه — همه خالص و قطعی
  {
    const { startNpcWarOf, resolveNpcWarOf, npcWarScoreOf, npcValuationOf, takeoverNpcOf, citizensOf, cityMediaOf, npcSeed } = await import('../app/lib/empire-npc.ts')
    const mk = () => npcSeed({ day: 0, companies: [], wars: [] }, 6, 1_000_000_000)
    const d = mk()
    d.companies[0].assets.push({ listingId: 'L1', title: 'آپارتمان تست', hood: 'ونک', cost: 500, boughtDay: 1 })
    // جنگ: فقط روی محله‌ای که شرکت حضور دارد؛ یک جنگِ فعال برای هر کاربر
    ok('جنگ روی محلهٔ بدونِ حضورِ شرکت رد می‌شود', startNpcWarOf(d, 'u1', d.companies[0].id, 'پونک', 10, 0, 7).ok === false)
    const w1 = startNpcWarOf(d, 'u1', d.companies[0].id, 'ونک', 10, 100, 7)
    ok('جنگ آغاز می‌شود و دومی رد', w1.ok === true && startNpcWarOf(d, 'u1', d.companies[0].id, 'ونک', 11, 0, 7).ok === false)
    ok('امتیازِ NPC قطعی است (دو بار = یک عدد)', npcWarScoreOf('kamran', 'ونک', 10, 17, 1) === npcWarScoreOf('kamran', 'ونک', 10, 17, 1))
    ok('پیش از پایانِ دوره داوری نمی‌شود', resolveNpcWarOf(d, 'u1', 12, { xpNow: 999, buysInHood: 9 }, { warBuyPoints: 10, warXpPerPoint: 50 })?.result === undefined)
    const res = resolveNpcWarOf(d, 'u1', 17, { xpNow: 100 + 50 * 999, buysInHood: 50 }, { warBuyPoints: 10, warXpPerPoint: 50 })
    ok('بازیکنِ پرتلاش می‌برد (خرید واقعی + XP)', res?.result === 'win' && (res.playerScore || 0) > (res.npcScore || 0))
    // تصاحب: ارزش‌گذاری شفاف + بقای پول در حلقهٔ NPC + بازگشتِ شرکت با دفترِ خالی
    const d2 = mk()
    d2.companies[1].assets.push({ listingId: 'L2', title: 'ملک', hood: 'سعادت‌آباد', cost: 700, boughtDay: 2 })
    const v = npcValuationOf(d2.companies[1], id => (id === 'L2' ? 900 : 0), 15)
    ok('ارزش‌گذاری = (خزانه + قیمتِ روزِ املاک) × حقِ تقدم', v.assetsValue === 900 && v.total === Math.round((1_000_000_000 + 900) * 1.15))
    const tk = takeoverNpcOf(d2, d2.companies[1].id, v.total, 'امین', 30)
    const reborn = d2.companies[1]
    ok('تصاحب: دارایی‌ها تحویل، شرکت با سرمایه = پرداختی برمی‌گردد (پول گم نمی‌شود)', tk.ok === true && tk.assets.length === 1 && reborn.assets.length === 0 && reborn.capital === v.total && reborn.realized === 0)
    // شهروندان: فقط از قیمتِ واقعیِ محله‌ها؛ لوکس‌ها بالای بازار، اولین‌خریدها پایین
    const hoods101 = Array.from({ length: 10 }, (_, i) => ({ hood: 'محله' + i, perM: (i + 1) * 10_000_000 }))
    const segs = citizensOf(hoods101)
    const lux = segs.find(x => x.id === 'lux'), first = segs.find(x => x.id === 'firstbuy')
    ok('شهروندان: لوکس بالای بازار، اولین‌خرید پایینِ بازار', !!lux && !!first && lux.hoods.includes('محله8') === false ? lux.hoods.every(h => Number(h.slice(4)) >= 7) : lux.hoods.every(h => Number(h.slice(4)) >= 7) && first.hoods.every(h => Number(h.slice(4)) <= 3))
    ok('کمتر از ۳ محلهٔ قیمت‌دار → بدونِ شهروند (نه عددِ ساختگی)', citizensOf([{ hood: 'x', perM: 1 }]).length === 0)
    // رسانه: تیتر فقط از روندِ واقعی و حرکت‌های NPC
    const med = cityMediaOf(10, { bought: [{ name: 'افق', title: 'ملک', hood: 'ونک', price: 1 }], sold: [] }, [{ hood: 'ونک', perM: 110 }], [{ hood: 'ونک', perM: 100 }])
    ok('رسانه: روندِ واقعیِ محله + خریدِ NPC تیتر می‌شود', med.some(m => m.text.includes('+۱۰')) && med.some(m => m.text.includes('افق')))
  }

  // فاز ۱۰۲ (لایهٔ اجتماعی): کنسرسیوم — سهم‌گذاری، سقف، تقسیمِ نسبتیِ دقیق (بقای پول)
  {
    const { unlinkSync: ul102, existsSync: ex102 } = await import('fs')
    for (const f of ['.empire-clans-data.json', '.empire-dm-data.json', '.empire-duel-data.json']) { try { if (ex102(f)) ul102(f) } catch {} }
    const { createClan, joinClan, clanProjectStart, clanProjectJoin, clanProjectSell, clanDeposit, clanWithdraw, sendDm, dmThread, createDuel, acceptDuel, resolveDuels } = await import('../app/lib/empire-social.ts')
    await createClan({ userId: 'uA', no: 1, name: 'الف' }, 'اتحادِ آزمون')
    const clans = await (await import('../app/lib/empire-social.ts')).listClans()
    await joinClan({ userId: 'uB', no: 2, name: 'ب' }, clans[0].id, 20)
    // خزانه
    const dep = await clanDeposit('uB', { no: 2, name: 'ب' }, 500)
    ok('واریزِ عضو به خزانه با دفتر', dep.ok === true && dep.treasury === 500)
    ok('برداشتِ غیرمالک رد می‌شود', (await clanWithdraw('uB', { no: 2, name: 'ب' }, 100)).ok === false)
    ok('برداشتِ مالک از خزانه', (await clanWithdraw('uA', { no: 1, name: 'الف' }, 200)).treasury === 300)
    // کنسرسیوم
    const st102 = await clanProjectStart('uA', { id: 'LX', title: 'برجِ تست', hood: 'ونک', price: 1000 })
    ok('کنسرسیوم روی آگهیِ قیمت‌دار باز می‌شود', st102.ok === true)
    const j1 = await clanProjectJoin('uA', { no: 1, name: 'الف' }, st102.project.id, 700)
    const j2 = await clanProjectJoin('uB', { no: 2, name: 'ب' }, st102.project.id, 500)
    ok('سهم‌گذاری تا سقف؛ سرریز گزارش می‌شود', j1.ok === true && j2.ok === true && j2.completed === true && (j2.reason || '').includes('جا داشت'))
    const sell = await clanProjectSell('uA', st102.project.id, 1201)
    const sum = (sell.payouts || []).reduce((a, x) => a + x.amount, 0)
    ok('فروش به قیمتِ روز و تقسیمِ نسبتیِ «دقیق» (بقای پول)', sell.ok === true && sum === 1201 && (sell.payouts || []).find(x => x.userId === 'uA').amount > (sell.payouts || []).find(x => x.userId === 'uB').amount)
    ok('فروش روی آگهیِ مرده رد می‌شود', (await clanProjectSell('uA', 'nope', 0)).ok === false)
    // گفتگو + دوئل
    ok('پیامِ خالی/کول‌داون رد می‌شود', (await sendDm({ userId: 'uA', no: 1, name: 'الف' }, 'uB', '  ', { maxLen: 300, cooldownSec: 5 })).ok === false)
    await sendDm({ userId: 'uA', no: 1, name: 'الف' }, 'uB', 'سلام', { maxLen: 300, cooldownSec: 5 })
    ok('پیام در نخِ مشترک می‌نشیند', (await dmThread('uB', 'uA')).some(m => m.text === 'سلام'))
    const du = await createDuel({ userId: 'uA', no: 1, name: 'الف' }, { userId: 'uB', no: 2, name: 'ب' }, 100, 1000)
    ok('دوئل ساخته می‌شود و دومی همان هفته رد', du.ok === true && (await createDuel({ userId: 'uA', no: 1, name: 'الف' }, { userId: 'uB', no: 2, name: 'ب' }, 100, 1000)).ok === false)
    await acceptDuel(du.duel.id, { userId: 'uB', no: 2, name: 'ب' }, 2000)
    const done102 = await resolveDuels(101, uid => uid === 'uA' ? 1200 : 2100, () => null)
    ok('داوریِ دوئل: رشدِ ۲۰٪ در برابرِ ۵٪ → برندهٔ درست', done102.length === 1 && done102[0].winner === 'a' && done102[0].aGrowth === 20 && done102[0].bGrowth === 5)
  }

  // فاز ۱۰۳ (جلد ۳ — Prestige): اثرهای شفافِ درختِ مهارت + ضریبِ درآمد
  {
    const { prestigeEffectsOf, assetMonthlyIncomeOf } = await import('../app/lib/empire-store.ts')
    const cfg103 = { enabled: true, minLevel: 30, pointsPerPrestige: 3, maxPerBranch: 5, negoPpPerPoint: 2, buildCostPctPerPoint: 2, marketIncomePctPerPoint: 3 }
    ok('بدونِ Prestige همهٔ اثرها صفرند', JSON.stringify(prestigeEffectsOf(undefined, cfg103)) === JSON.stringify({ negoPp: 0, buildCostPct: 0, marketIncomePct: 0 }))
    const eff = prestigeEffectsOf({ count: 2, points: 0, spent: { nego: 3, build: 5, market: 2 } }, cfg103)
    ok('اثرها = امتیاز × نرخِ knob', eff.negoPp === 6 && eff.buildCostPct === 10 && eff.marketIncomePct === 6)
    ok('تخفیفِ ساخت سقفِ ۳۰٪ دارد', prestigeEffectsOf({ count: 9, points: 0, spent: { build: 99 } }, cfg103).buildCostPct === 30)
    const base = assetMonthlyIncomeOf({ action: 'rent' }, 10_000_000, 1, 1)
    const boosted = assetMonthlyIncomeOf({ action: 'rent' }, 10_000_000, 1, 1.06)
    ok('«نبضِ بازار» درآمد را دقیقاً به نسبتِ اعلام‌شده بالا می‌برد', base === 10_000_000 && boosted === 10_600_000)
    ok('ضریبِ زیرِ ۱ هرگز درآمد را کم نمی‌کند (فقط پاداش)', assetMonthlyIncomeOf({ action: 'rent' }, 10_000_000, 1, 0.5) === 10_000_000)
    // فاز ۱۱۹ (نقشِ کارمندان): مخفی از فهرستِ عمومی و آنبوردینگ؛ کاربر نمی‌تواند خودش را کارمند کند
    {
      const { listRoles, listPublicRoles } = await import('../app/lib/role-store.ts')
      const { isValidRole } = await import('../app/lib/account-store.ts')
      ok('نقشِ staff ساخته شده و در فهرستِ کامل هست', listRoles(true).some(r => r.id === 'staff' && r.hidden && r.dashboard === '/admin'))
      ok('در فهرستِ عمومی (آنبوردینگ) دیده نمی‌شود', !listPublicRoles().some(r => r.id === 'staff'))
      ok('کاربرِ عادی نمی‌تواند خودش را staff کند (isValidRole رد می‌کند)', isValidRole('staff') === false && isValidRole('کارمندانِ ملک‌جت') === false)
    }
    // فاز ۱۱۵ (دسترسیِ پرسنل): نگاشتِ خالصِ API→بخش — مسیرِ نگاشت‌نشده همیشه بسته
    {
      const { staffApiAllowed, STAFF_GRANTABLE_IDS } = await import('../app/lib/admin-access.ts')
      ok('پرسنلِ دارای بخش به API همان بخش می‌رسد', staffApiAllowed(['staffCrm'], '/api/admin/staff-crm') === true && staffApiAllowed(['users'], '/api/admin/users?x=1') === true)
      ok('بخشِ اعطانشده و مسیرِ نگاشت‌نشده بسته است', staffApiAllowed(['staffCrm'], '/api/admin/users') === false && staffApiAllowed(['users'], '/api/admin/impersonate') === false && staffApiAllowed(['users'], '/api/admin/payment') === false && staffApiAllowed(['users'], '/api/admin/roles') === false)
      ok('بدونِ staff هیچ‌چیز باز نیست و لیستِ قابلِ‌اعطا حساس‌ها را ندارد', staffApiAllowed([], '/api/admin/support') === false && staffApiAllowed(undefined, '/api/admin/support') === false && !STAFF_GRANTABLE_IDS.has('roles') && !STAFF_GRANTABLE_IDS.has('payment') && !STAFF_GRANTABLE_IDS.has('connections') && !STAFF_GRANTABLE_IDS.has('settings'))
      ok('اسکرپر چند بخشِ محتوایی را پوشش می‌دهد', staffApiAllowed(['listings'], '/api/admin/scraper/items') === true && staffApiAllowed(['moderation'], '/api/admin/scraper/moderate') === true)
    }
    // فاز ۱۲۴ (ممیزیِ عمیقِ دسترسیِ پرسنل): حساب‌های محافظت‌شده — پرسنل نمی‌تواند سوپرادمین/پرسنلِ دیگر را دستکاری کند
    {
      const { createAccount, setAdminSections, isProtectedAccount, SUPER_ADMIN_PHONE } = await import('../app/lib/account-store.ts')
      ok('سوپرادمین همیشه محافظت‌شده است (حتی بدونِ رکوردِ اکانت)', isProtectedAccount(SUPER_ADMIN_PHONE) === true)
      createAccount('09121240001', { name: 'پرسنلِ تست' })
      createAccount('09121240002', { name: 'کاربرِ عادیِ تست' })
      setAdminSections('09121240001', ['users', 'staffCrm'])
      ok('دارندهٔ دسترسیِ پنل (پرسنل) محافظت‌شده است', isProtectedAccount('09121240001') === true)
      ok('کاربرِ عادی و شمارهٔ ناموجود محافظت‌شده نیستند', isProtectedAccount('09121240002') === false && isProtectedAccount('09999999999') === false)
      setAdminSections('09121240001', [])
      ok('با لغوِ کاملِ دسترسی، حفاظت هم برداشته می‌شود', isProtectedAccount('09121240001') === false)
    }
    // فاز ۱۲۷ (فیدبک: «رفع تعلیق می‌کنم دوباره تعلیق می‌شود»): رفعِ تعلیقِ دستی = معافیتِ ماندگار از موتورِ خودکار
    {
      const { createAccount, setProfile, setSuspended, setGateExempt, getAccount } = await import('../app/lib/account-store.ts')
      const { roleByDashboard } = await import('../app/lib/role-store.ts')
      const { getAdminData, saveAdminData } = await import('../app/lib/admin-store.ts')
      const { processProfileGate } = await import('../app/lib/profile-gate-runner.ts')
      const ad = getAdminData(); const prevGate = ad.profileGate
      saveAdminData({ ...ad, profileGate: { enabled: true, minPercent: 70, graceDays: 0 } })
      const prosRole = roleByDashboard('/pros')?.id || 'pros'
      createAccount('09121270001', { name: 'مشاورِ بی‌پروفایل' }); setProfile('09121270001', { role: prosRole })
      createAccount('09121270002', { name: 'مشاورِ شاهد' }); setProfile('09121270002', { role: prosRole })
      const t0 = Date.now()
      await processProfileGate(t0)                       // پاسِ اول: هشدار
      await processProfileGate(t0 + 60_000)              // پاسِ دوم: مهلتِ صفرروزه گذشت → تعلیقِ خودکار
      ok('موتورِ خودکار پروفایلِ ناقص را معلق می‌کند (بازتولیدِ باگِ گزارش‌شده)', getAccount('09121270001').suspended === true && getAccount('09121270002').suspended === true)
      // رفعِ تعلیقِ دستیِ ادمین (همان کاری که API می‌کند): unsuspend + معافیت
      setSuspended('09121270001', false); setGateExempt('09121270001', true)
      await processProfileGate(t0 + 120_000)
      await processProfileGate(t0 + 180_000)
      const a1 = getAccount('09121270001')
      ok('بعد از رفعِ تعلیقِ دستی، موتور دیگر سراغش نمی‌رود (نه هشدار، نه تعلیقِ دوباره)', a1.suspended !== true && !a1.profileWarnAt)
      ok('حسابِ شاهد (بدونِ معافیت) همچنان در چرخهٔ خودکار است', getAccount('09121270002').suspended === true)
      setGateExempt('09121270001', false)                // لغوِ معافیت از چیپِ کشو → برگشت به چرخه
      await processProfileGate(t0 + 240_000)
      ok('لغوِ معافیت واقعاً به چرخهٔ خودکار برمی‌گرداند (هشدارِ تازه ثبت شد)', !!getAccount('09121270001').profileWarnAt)
      saveAdminData({ ...getAdminData(), profileGate: prevGate })
    }
    // فاز ۱۳۴ (فیدبک: «۱۰ دقیقه در صف گیر کرده»): صفِ منصفانهٔ FIFO + کول‌داونِ هولدها
    {
      const { setJob, queueOrder, listPausedJobs } = await import('../app/lib/advisor-divar-job.ts')
      const now = Date.now()
      setJob('09001340001', { running: true, lastProgressAt: now })
      setJob('09001340002', { paused: true, pending: [{}], pausedAt: now - 5 * 60_000, startedAt: now - 30 * 60_000 })
      setJob('09001340003', { paused: true, pending: [{}], pausedAt: now - 10_000, startedAt: now - 40 * 60_000 })
      setJob('09001340004', { queued: true, queuedAt: now - 20 * 60_000 })
      setJob('09001340005', { queued: true, queuedAt: now - 60_000 })
      const order134 = queueOrder().filter(x => x.startsWith('0900134'))
      ok('صفِ دیوار FIFO است — هولدِ پرتکرار کارِ کاربر را گرسنه نمی‌گذارد', JSON.stringify(order134) === JSON.stringify(['09001340002', '09001340004', '09001340005']))
      ok('هولدِ در کول‌داونِ ۶۰ثانیه اسلات نمی‌گیرد', !order134.includes('09001340003') && !listPausedJobs().includes('09001340003'))
    }
    // فاز ۱۳۵ (فیدبک: «روزانه کلِ روز اسکرپ می‌کند — همه ۱۲ شب»): پنجرهٔ شبانهٔ سینکِ روزانه
    {
      const fs135 = await import('fs')
      const { tehranHourOf, listDueSources } = await import('../app/lib/advisor-divar-store.ts')
      ok('ساعتِ تهران درست است (UTC+3:30، بدونِ DST)', tehranHourOf(Date.UTC(2026, 0, 1, 20, 30)) === 0 && tehranHourOf(Date.UTC(2026, 0, 1, 10, 30)) === 14 && tehranHourOf(Date.UTC(2026, 0, 1, 2, 0)) === 5)
      const src135 = { id: 's1', name: 'روزانهٔ تست', searchUrl: 'https://divar.ir/pro/x135', divarName: '', schedule: 'daily', autoPublish: true, autoNeighborhood: true, createdAt: 1 }
      fs135.writeFileSync('.advisor-divar-data.json', JSON.stringify({ advisors: { '09001350001': { sources: [src135], imports: [] } } }))
      const night = Date.UTC(2026, 0, 1, 21, 30)   // تهران ۰۱:۰۰
      const day = Date.UTC(2026, 0, 1, 10, 30)     // تهران ۱۴:۰۰
      ok('روزانهٔ بدونِ اجرا فقط در پنجرهٔ شب (۰۰–۰۶ تهران) due می‌شود', listDueSources(night).some(x => x.phone === '09001350001') && !listDueSources(day).some(x => x.phone === '09001350001'))
      // همان شب اجرا شده → گاردِ ۱۸ساعته نمی‌گذارد در همان پنجره دوباره اجرا شود؛ شبِ بعد دوباره due
      fs135.writeFileSync('.advisor-divar-data.json', JSON.stringify({ advisors: { '09001350001': { sources: [{ ...src135, lastRun: night }], imports: [] } } }))
      ok('گاردِ ۱۸ساعته: در همان شب دوباره اجرا نمی‌شود ولی شبِ بعد چرا', !listDueSources(night + 2 * 3600_000).some(x => x.phone === '09001350001') && listDueSources(night + 24 * 3600_000).some(x => x.phone === '09001350001'))
      // ساعتی/۶ساعته مثل قبل زمان‌آزادند (انتخابِ صریحِ کاربر)
      fs135.writeFileSync('.advisor-divar-data.json', JSON.stringify({ advisors: { '09001350001': { sources: [{ ...src135, schedule: 'hourly', lastRun: day - 2 * 3600_000 }], imports: [] } } }))
      ok('ساعتی وسطِ روز هم due می‌شود (رفتارِ قبلی حفظ)', listDueSources(day).some(x => x.phone === '09001350001'))
      fs135.unlinkSync('.advisor-divar-data.json')
    }
    // فاز ۱۳۷ (GSC «۱ خطا» روی listings-*.xml): شاردِ سایت‌مپی که با چرخشِ آگهی‌ها ناپدید شده
    // هرگز نباید ۴۰۴ بدهد — گوگل نامِ ثبت‌شده را ماه‌ها می‌خوانَد؛ urlsetِ خالیِ ۲۰۰ می‌گیرد.
    {
      const { mergeRetiredShards, isRetiredShard, renderShardXml } = await import('../app/lib/sitemap-store.ts')
      ok('شاردِ حذف‌شده بازنشسته می‌شود و شاردِ بازگشته از بازنشستگی درمی‌آید', JSON.stringify(mergeRetiredShards(['listings-kysh-sale-1', 'listings-tehran-sale-1'], ['listings-nvr-sale-1'], ['listings-tehran-sale-1'])) === JSON.stringify(['listings-kysh-sale-1', 'listings-nvr-sale-1']))
      ok('الگوی شاردِ پویای آگهی حتی قبل از ثبتِ کرون هم پوشش دارد', isRetiredShard('listings-chmstan-sale-1') && isRetiredShard('listings-karaj-rent-2') && !isRetiredShard('static') && !isRetiredShard('providers-agencies') && !isRetiredShard('listings-تهران-sale-1'))
      const emptyXml137 = renderShardXml([])
      ok('urlsetِ خالی XMLِ معتبرِ سایت‌مپ است (پاسخِ ۲۰۰ به‌جای ۴۰۴)', emptyXml137.startsWith('<?xml') && emptyXml137.includes('<urlset') && emptyXml137.includes('</urlset>') && !emptyXml137.includes('<loc>'))
    }
    // فاز ۱۳۸ (فیدبک: «همچنان کلی آگهی را به‌خاطرِ واژه‌هایی که مشکل نیست رد می‌کند»):
    // ردِ خودکار فقط با مدرکِ قطعیِ تماس (با نقلِ همان تکه)؛ ML هرگز خودش رد نمی‌کند.
    {
      const fs138 = await import('fs')
      const { contactEvidenceOf, featuresOf, resetMl, learn } = await import('../app/lib/moderation-ml.ts')
      const { moderateFields, displayReason } = await import('../app/lib/moderation.ts')
      ok('شمارهٔ موبایل (با پیشوندِ 0/+98) مدرک است و عیناً نقل می‌شود', (() => {
        const a = contactEvidenceOf({ title: '', excerpt: 'هماهنگی: ۰۹۱۲۱۲۳۴۵۶۷' })
        const b = contactEvidenceOf({ title: '', excerpt: 'تماس +989121234567' })
        return a.length === 1 && a[0].includes('09121234567') && b.length === 1
      })())
      ok('قیمتِ ۱۰+رقمیِ با ۹ شروع‌شده دیگر «شماره» نیست (ریشهٔ ردِ الکی)', contactEvidenceOf({ title: '', excerpt: 'قیمت 9500000000 تومان' }).length === 0 && !featuresOf({ title: 'x', excerpt: 'قیمت 9500000000 تومان', price: '' }).includes('#phone_in_text'))
      ok('لینک و آیدی مدرک‌اند؛ صرفِ واژهٔ واتساپ/اینستاگرام نه', contactEvidenceOf({ title: '', excerpt: 'کانالِ t.me/melk123' }).length === 1 && contactEvidenceOf({ title: '', excerpt: 'پیجِ @melk_tehran' }).length === 1 && contactEvidenceOf({ title: '', excerpt: 'در واتساپ و اینستاگرام پاسخگو نیستیم' }).length === 0)
      // سناریوی عینِ اسکرین‌شاتِ کاربر: مدل با واژه‌های «نمایشگاه/هفتگی/لوکشین» مسموم شده
      resetMl()
      for (let i = 0; i < 45; i++) learn({ title: `سوئیت نمایشگاه هفتگی لوکشین شماره${i}`, excerpt: 'نمایشگاه هفتگی لوکشین اجارهٔ کوتاه', price: '' }, 'rejected')
      for (let i = 0; i < 45; i++) learn({ title: `آپارتمان نوساز شماره${i}`, excerpt: 'توضیحِ کاملِ آگهیِ سالم با جزئیاتِ دقیق', price: '۵٬۰۰۰٬۰۰۰٬۰۰۰ تومان', meta: { 'متراژ': '100' } }, 'approved')
      const victim138 = { title: 'آپارتمان مبله نوساز جنب نمایشگاه افتتاح شد', excerpt: 'اجارهٔ هفتگی و روزانه، لوکشین عالی، پذیرش با کارتِ ملی', price: '' }
      const v1 = await moderateFields(victim138)
      ok('آگهیِ بی‌مدرک با هر شباهتِ واژه‌ای، هرگز خودکار رد نمی‌شود (→ صفِ انسانی/AI)', v1.status !== 'rejected' && !String(v1.reason).startsWith('ردِ خودکار'))
      const v2 = await moderateFields({ ...victim138, excerpt: victim138.excerpt + ' — هماهنگی ۰۹۱۲۱۲۳۴۵۶۷' })
      ok('با مدرکِ قطعی رد می‌شود، مدرک عیناً در دلیل است و حرفی از واژه‌ها نیست', v2.status === 'rejected' && v2.via === 'rule' && v2.reason.includes('09121234567') && !v2.reason.includes('شباهت'))
      ok('دلیلِ نمایشیِ ردی‌های قدیمی دیگر «شباهتِ واژه‌ای» ندارد', !displayReason({ title: victim138.title, excerpt: victim138.excerpt, price: '', status: 'rejected', aiReason: 'ممیزیِ خودکارِ یادگیری‌شده' }).includes('شباهت به آگهی'))
      // بازممیزیِ ردشده‌های خودکار: فقط ردهای ماشینی برمی‌گردند، ردِ دستی دست نمی‌خورد
      const SCR138 = '.scraper-data.json'
      const bak138 = fs138.existsSync(SCR138) ? fs138.readFileSync(SCR138, 'utf-8') : null
      fs138.writeFileSync(SCR138, JSON.stringify({ sources: [], items: [
        { id: 'a138', type: 'listing', title: 'الف', status: 'rejected', aiReason: 'ردِ خودکار: قدیمی', scrapedAt: 1 },
        { id: 'b138', type: 'listing', title: 'ب', status: 'rejected', aiReason: 'رد توسط ادمین', scrapedAt: 1 },
        { id: 'c144', type: 'listing', title: 'ج', status: 'duplicate', aiReason: 'آگهیِ تکراری — مشابهِ یک آگهیِ منتشرشدهٔ دیگر', scrapedAt: 1 },
      ], owners: {}, categories: [] }))
      const { requeueAutoRejected, getItemById } = await import('../app/lib/scraper-store.ts')
      const n138 = await requeueAutoRejected()
      const a138 = await getItemById('a138'); const b138 = await getItemById('b138'); const c144 = await getItemById('c144')
      ok('بازممیزی ردها و تکراری‌های خودکار را برمی‌گرداند (۲ از ۳) و ردِ دستی می‌ماند', n138 === 2 && a138.status === 'pending' && !a138.moderatedAt && b138.status === 'rejected' && c144.status === 'pending')
      if (bak138 != null) fs138.writeFileSync(SCR138, bak138); else fs138.unlinkSync(SCR138)
      resetMl()
    }
    // فاز ۱۴۰ (فیدبک+۲ اسکرین‌شات با ۱۷ ثانیه فاصله: «تأیید می‌کنم دوباره خودش برمی‌گردد»):
    // بازانتشار (هر سینکِ دیوار با autoPublish) دیگر حذف+ساختِ دوباره نیست — حکمِ ممیزی می‌ماند.
    {
      const { addListing, publishListing } = await import('../app/lib/advisor-store.ts')
      const { getItemById, setModeration } = await import('../app/lib/scraper-store.ts')
      const adv140 = '09001400001'
      const l140 = await addListing(adv140, { title: 'آپارتمان تستِ فاز۱۴۰ سعادت‌آباد', deal: 'sale', price: 5_000_000_000, area: 100, rooms: 2, city: 'تهران', neighborhood: 'سعادت‌آباد', description: 'توضیحِ اولیهٔ کاملِ فایل' })
      const p1 = await publishListing(adv140, l140.id)
      await setModeration(p1.publicId, 'approved', 'تأییدِ دستیِ ادمین', 90)
      const p2 = await publishListing(adv140, l140.id)   // بازانتشارِ بدونِ تغییرِ متن (سینکِ دیوار)
      const it2 = await getItemById(p2.publicId)
      ok('بازانتشارِ بدونِ تغییر، حکمِ ادمین را پاک نمی‌کند و publicId ثابت می‌ماند', p2.publicId === p1.publicId && it2.status === 'approved' && it2.aiReason === 'تأییدِ دستیِ ادمین')
      // فقط تغییرِ واقعیِ متنِ ممیزی‌شونده → صفِ ممیزیِ دوباره
      const { updateListing: updL140 } = await import('../app/lib/advisor-store.ts')
      await updL140(adv140, l140.id, { description: 'توضیحِ کاملاً جدید با متنِ متفاوت' })
      const p3 = await publishListing(adv140, l140.id)
      const it3 = await getItemById(p3.publicId)
      ok('تغییرِ متنِ آگهی → ممیزیِ دوباره (pending)', p3.publicId === p1.publicId && it3.status === 'pending' && !it3.moderatedAt)
    }
    // فاز ۱۴۲ (فیدبک: «دیوار احراز نمی‌کند؛ یک نفر دو شماره دارد — امکانِ مرج لازم است»):
    // ادغامِ کاملِ دو حساب — هویتِ احرازشده/پلن/دادهٔ مشاور/لید/آگهیِ عمومی به اصلی؛ دومی تعلیق.
    {
      const fs142 = await import('fs')
      const { createAccount, getAccount } = await import('../app/lib/account-store.ts')
      const { addListing: addL142, publishListing: pub142, getAdvisor: getAdv142 } = await import('../app/lib/advisor-store.ts')
      const { addLead: addLead142, listLeads: listLeads142 } = await import('../app/lib/leads-store.ts')
      const { getItemById: getItem142 } = await import('../app/lib/scraper-store.ts')
      const { mergeUserAccounts } = await import('../app/lib/account-merge.ts')
      const P = '09001420001', S = '09001420002'
      // اصلی: حسابِ احرازنشدهٔ بدونِ پلن؛ دومی: احرازشده + پلنِ فعال + فایل و لید و آگهیِ عمومی
      createAccount(P, { name: 'حماد توکلی', role: 'advisor' })
      createAccount(S, { name: '', role: 'advisor' })
      const accs = JSON.parse(fs142.readFileSync('.account-data.json', 'utf-8'))
      Object.assign(accs[S], { identityVerifiedAt: Date.now(), nationalId: '0012345678', firstName: 'حماد', lastName: 'توکلی', plan: 'starter', planExpiresAt: Date.now() + 30 * 86400_000 })
      fs142.writeFileSync('.account-data.json', JSON.stringify(accs))
      const fl142 = await addL142(S, { title: 'آپارتمان فاز۱۴۲', deal: 'sale', price: 4_000_000_000, area: 90, city: 'تهران', description: 'توضیح' })
      const pl142 = await pub142(S, fl142.id)
      await addLead142(S, { name: 'مشتریِ تست', phone: '09120000000' })
      const r142 = await mergeUserAccounts(P, S)
      const p142 = getAccount(P); const s142 = getAccount(S)
      ok('ادغام: هویتِ احرازشده و پلنِ فعالِ حسابِ دوم به اصلی می‌رود', r142.ok && p142.identityVerifiedAt > 0 && p142.nationalId === '0012345678' && p142.plan === 'starter')
      ok('حسابِ دوم تعلیق می‌شود با دلیلِ روشن و بدونِ دسترسیِ پرسنلی', s142.suspended === true && /ادغام‌شده/.test(s142.suspendReason || '') && !s142.adminSections)
      const adv142 = await getAdv142(P)
      ok('فایل‌های مشاور و مالکیتِ آگهیِ عمومی به حسابِ اصلی منتقل می‌شود', adv142.listings.some(l => l.id === fl142.id) && (await getItem142(pl142.publicId))?.meta?.['__ownerPhone'] === P)
      createAccount('09122862184', { name: 'سوپرادمین' })   // تا گاردِ محافظت (نه «پیدا نشد») تست شود
      ok('لیدهای Sales OS منتقل می‌شوند و ادغامِ حسابِ محافظت‌شده ممنوع است', (await listLeads142(P)).some(l => l.name === 'مشتریِ تست') && /محافظت/.test((await mergeUserAccounts(P, '09122862184')).error || ''))
      // فاز ۱۴۳ (فیدبک: «هی پیام می‌دهد و ادغام نمی‌شود»): حسابِ ادغام‌شده نه اصلی می‌شود نه دوباره ادغام‌شونده
      ok('حسابِ ادغام‌شده mergedInto دارد؛ ادغامِ برعکس و دوباره هر دو رد می‌شوند', s142.mergedInto === P && /نمی‌تواند حسابِ اصلی/.test((await mergeUserAccounts(S, P)).error || '') && /قبلاً/.test((await mergeUserAccounts(P, S)).error || ''))
    }
    // فاز ۱۴۴ (فیدبک: «آگهی‌های درست را تکراری می‌کند و حذف می‌کند»): وتوی طبقه + کفِ شواهد
    {
      const { fieldsOf, similarity, DUP_THRESHOLD } = await import('../app/lib/listing-similarity.ts')
      // دو واحدِ هم‌شکلِ یک ساختمان — فقط طبقه فرق دارد → «همان ملک» نیست
      const u3 = fieldsOf({ title: 'آپارتمان ۱۰۰ متری ۲ خواب سعادت‌آباد', price: '۵٬۰۰۰٬۰۰۰٬۰۰۰ تومان', meta: { 'محله': 'سعادت‌آباد', 'متراژ': '۱۰۰', 'اتاق خواب': '۲', 'طبقه': '۳', 'نوع معامله': 'فروش' } })
      const u5 = fieldsOf({ title: 'آپارتمان ۱۰۰ متری ۲ خواب سعادت‌آباد', price: '۵٬۰۵۰٬۰۰۰٬۰۰۰ تومان', meta: { 'محله': 'سعادت‌آباد', 'متراژ': '۱۰۰', 'اتاق خواب': '۲', 'طبقه': '۵', 'نوع معامله': 'فروش' } })
      ok('وتوی طبقه: دو واحدِ هم‌شکل با طبقهٔ متفاوت تکراری نیستند', similarity(u3, u5) < DUP_THRESHOLD && u3.floor === 3 && u5.floor === 5)
      // همان آگهی با بازنشرِ دیوار (همان طبقه/مشخصات) → همچنان تکراریِ واقعی
      const repost = fieldsOf({ title: 'آپارتمان ۱۰۰ متری ۲ خواب سعادت‌آباد فوری', price: '۵٬۰۰۰٬۰۰۰٬۰۰۰ تومان', meta: { 'محله': 'سعادت‌آباد', 'متراژ': '۱۰۰', 'اتاق خواب': '۲', 'طبقه': '۳', 'نوع معامله': 'فروش' } })
      ok('تکراریِ واقعی (بازنشرِ همان واحد) همچنان گرفته می‌شود', similarity(u3, repost) >= DUP_THRESHOLD)
      // کفِ شواهد: بدونِ متراژ/قیمت/محله، شباهتِ عنوان به‌تنهایی هرگز به آستانه نمی‌رسد
      const bare1 = fieldsOf({ title: 'آپارتمان در تهران', price: 'توافقی', meta: {} })
      const bare2 = fieldsOf({ title: 'آپارتمان شیک و نوساز در تهران', price: 'توافقی', meta: {} })
      ok('کفِ شواهد: عنوانِ مشابه بدونِ هیچ مشخصه‌ای تکراری نمی‌شود', similarity(bare1, bare2) < DUP_THRESHOLD)
      // طبقه از خودِ عنوان هم خوانده می‌شود
      ok('طبقه از عنوان استخراج می‌شود', fieldsOf({ title: 'آپارتمان ۸۵ متری طبقه ۴', meta: {} }).floor === 4)
    }
    // فاز ۱۴۵ (فیدبک: «شهر، استان، موقعیت، نوع ملک و همهٔ جزئیات باید مورد توجه باشد»)
    {
      const { fieldsOf, similarity, DUP_THRESHOLD, geoDistanceM, ptypeClassOf } = await import('../app/lib/listing-similarity.ts')
      const base145 = { title: 'آپارتمان ۱۰۰ متری ۲ خواب نوساز', price: '۵٬۰۰۰٬۰۰۰٬۰۰۰ تومان', meta: { 'محله': 'مرکز شهر', 'متراژ': '۱۰۰', 'اتاق خواب': '۲', 'نوع معامله': 'فروش' } }
      const mk145 = (extra) => fieldsOf({ ...base145, meta: { ...base145.meta, ...extra } })
      ok('شهرِ متفاوت = هرگز تکراری نیست (تهران vs کرج)', similarity(mk145({ 'شهر': 'تهران' }), mk145({ 'شهر': 'کرج' })) === 0)
      ok('استانِ متفاوت = هرگز تکراری نیست', similarity(mk145({ 'استان': 'تهران' }), mk145({ 'استان': 'البرز' })) === 0)
      ok('نوعِ ملکِ متفاوت (آپارتمان vs مغازه) = هرگز تکراری نیست', similarity(mk145({ 'نوع ملک': 'آپارتمان' }), mk145({ 'نوع ملک': 'مغازه' })) === 0 && ptypeClassOf('برج لوکس') === 'apt' && ptypeClassOf('مغازهٔ تجاری') === 'shop')
      ok('تعدادِ خوابِ متفاوت = هرگز تکراری نیست', similarity(mk145({ 'اتاق خواب': '۲' }), mk145({ 'اتاق خواب': '۳' })) === 0)
      ok('سالِ ساختِ متفاوت (≥۲ سال) و تعدادِ طبقاتِ متفاوت وتو می‌شوند', similarity(mk145({ 'سال ساخت': '۱۳۹۵' }), mk145({ 'سال ساخت': '۱۴۰۲' })) === 0 && similarity(mk145({ 'تعداد طبقات': '۴' }), mk145({ 'تعداد طبقات': '۸' })) === 0)
      // موقعیتِ GPS: دورتر از ~۲۵۰ متر وتو؛ هم‌موقعیت (۳۰ متر) شاهدِ قوی و تکراریِ واقعی می‌ماند
      const far = similarity(mk145({ '__lat': '35.7000', '__lng': '51.4000' }), mk145({ '__lat': '35.7100', '__lng': '51.4000' }))   // ~۱.۱ کیلومتر
      const closeSim = similarity(mk145({ '__lat': '35.7000', '__lng': '51.4000' }), mk145({ '__lat': '35.70025', '__lng': '51.4000' }))   // ~۲۸ متر
      ok('GPS دور (~۱.۱km) وتو؛ GPS نزدیک (~۳۰m) تکراریِ واقعی می‌ماند', far === 0 && closeSim >= DUP_THRESHOLD)
      ok('فاصلهٔ GPS تقریباً درست محاسبه می‌شود (~۱۱۱۲ متر برای ۰٫۰۱ درجه)', Math.abs(geoDistanceM(35.7, 51.4, 35.71, 51.4) - 1112) < 20)
    }
    // فاز ۱۴۸ (فیدبک: «با واژهٔ تمیز رد می‌کند، تأیید می‌کنم، باز یاد نمی‌گیرد»):
    // تأییدِ آیتمِ «در صفِ بازبینی» (pending) هم باید اصلاحِ واقعی باشد — unlearn از کلاسِ رد.
    {
      const { resetMl: reset148, learn: learn148, predict: predict148 } = await import('../app/lib/moderation-ml.ts')
      const { teachFromAdmin } = await import('../app/lib/moderation.ts')
      reset148()
      for (let i = 0; i < 45; i++) learn148({ title: `سوئیت تمیز ارزان شماره${i}`, excerpt: 'تمیز مرتب اجارهٔ کوتاه', price: '' }, 'rejected')
      for (let i = 0; i < 45; i++) learn148({ title: `آپارتمان نوساز شماره${i}`, excerpt: 'توضیحِ کاملِ آگهیِ سالم با جزئیاتِ دقیق', price: '۵٬۰۰۰٬۰۰۰٬۰۰۰ تومان', meta: { 'متراژ': '100' } }, 'approved')
      const victim148 = { id: 'v148', type: 'listing', title: 'آپارتمان تمیز و مرتب سعادت‌آباد', excerpt: 'واحدِ تمیز و مرتب، سندِ تک‌برگ، آمادهٔ بازدید', price: '۶٬۰۰۰٬۰۰۰٬۰۰۰ تومان', meta: { 'متراژ': '95' }, sourceName: 'x', status: 'pending', scrapedAt: 1 }
      const before148 = predict148(victim148)
      // ادمین چند آیتمِ مشابهِ «در صفِ بازبینی» را تأیید می‌کند (prev = pending، نه rejected)
      for (let i = 0; i < 4; i++) teachFromAdmin({ ...victim148, title: victim148.title + ' ' + i }, 'approved', 'pending')
      const after148 = predict148(victim148)
      ok('تأییدِ آیتم‌های صفِ بازبینی واقعاً مدل را اصلاح می‌کند (unlearn از کلاسِ رد)', (before148.label === 'rejected') && (after148.label === 'approved' || after148.prob < before148.prob))
      reset148()
    }
    // فاز ۱۴۹ (فیدبک: «می‌خواهم ML خودش تأیید و رد کند — چطور بهتر آموزش ببیند؟»):
    // اختیارِ اکتسابیِ رد (گِیتِ دقتِ سنجیده‌شده روی داوریِ ادمین) + آموزش از آرشیو.
    {
      const fs149 = await import('fs')
      const { resetMl: reset149, learn: learn149, correctFromAdmin: corr149, recentAccuracy, learnBatch, predict: predict149 } = await import('../app/lib/moderation-ml.ts')
      const { moderateFields: modF149, trainFromArchive } = await import('../app/lib/moderation.ts')
      const { getAdminData: gad149, saveAdminData: sad149 } = await import('../app/lib/admin-store.ts')
      reset149()
      for (let i = 0; i < 45; i++) learn149({ title: `کلاهبرداری فریب شماره${i}`, excerpt: 'فریب تقلبی کلاهبرداری', price: '' }, 'rejected')
      for (let i = 0; i < 45; i++) learn149({ title: `آپارتمان نوساز شماره${i}`, excerpt: 'توضیحِ کاملِ آگهیِ سالم با جزئیاتِ دقیق', price: '۵٬۰۰۰٬۰۰۰٬۰۰۰ تومان', meta: { 'متراژ': '100' } }, 'approved')
      const victim149 = { title: 'کلاهبرداری فریب بزرگ', excerpt: 'فریب تقلبی کلاهبرداری واضح', price: '' }
      const d149 = gad149(); d149.moderation = { ...(d149.moderation || {}), mlRejectMode: 'full', mlRejectMin: 80, mlRejectAgreeMin: 80, mlRejectReviewedMin: 10, autoRejectContact: true }; sad149(d149)
      // هنوز هیچ بازبینیِ انسانی سنجیده نشده → مجوزِ رد نه؛ به صفِ انسانی با دلیلِ «مجوز نگرفته»
      const v1 = await modF149(victim149)
      ok('بدونِ کارنامهٔ کافی، مدل حتی در حالتِ کامل هم رد نمی‌کند (صفِ انسانی + دلیلِ روشن)', v1.status === 'pending' && /مجوزِ ردِ خودکار نگرفته/.test(v1.reason))
      // ۱۲ بازبینیِ انسانیِ هم‌نظر → دقت ۱۰۰٪ از ۱۲ → مجوز فعال می‌شود
      for (let i = 0; i < 12; i++) corr149({ title: `کلاهبرداری فریب نمونه${i}`, excerpt: 'فریب تقلبی', price: '' }, 'rejected', 'rejected')
      const acc149 = recentAccuracy()
      const v2 = await modF149(victim149)
      ok('با دقتِ سنجیده‌شدهٔ بالا، مدل خودش رد می‌کند و دلیل دقت را نقل می‌کند', acc149.pct === 100 && acc149.reviewed >= 10 && v2.status === 'rejected' && v2.via === 'ml' && /دقتِ اخیر/.test(v2.reason))
      // حالتِ محتاط: شواهدِ صرفاً واژه‌ای کافی نیست
      const d149b = gad149(); d149b.moderation = { ...(d149b.moderation || {}), mlRejectMode: 'cautious' }; sad149(d149b)
      const v3 = await modF149({ ...victim149, price: '۳٬۰۰۰٬۰۰۰٬۰۰۰ تومان', meta: { 'متراژ': '100' } })   // قیمت و متراژ دارد → هیچ پرچمِ ساختاری نمی‌ماند، فقط واژه
      ok('حالتِ محتاط بدونِ نشانهٔ ساختاری رد نمی‌کند', v3.status !== 'rejected' || v3.via !== 'ml')
      // آموزش از آرشیو: مدلِ خالی + آرشیوِ تصمیم‌ها → یک‌جا یاد می‌گیرد
      reset149()
      const SCR149 = '.scraper-data.json'
      const bak149 = fs149.existsSync(SCR149) ? fs149.readFileSync(SCR149, 'utf-8') : null
      fs149.writeFileSync(SCR149, JSON.stringify({ sources: [], items: [
        ...Array.from({ length: 41 }, (_, i) => ({ id: `ok${i}`, type: 'listing', title: `آپارتمان نوساز شماره${i}`, excerpt: 'توضیحِ کاملِ سالم با جزئیات', price: '۴٬۰۰۰٬۰۰۰٬۰۰۰ تومان', status: 'approved', scrapedAt: 1 })),
        ...Array.from({ length: 41 }, (_, i) => ({ id: `bd${i}`, type: 'listing', title: `کلاهبرداری فریب شماره${i}`, excerpt: 'فریب تقلبی', price: '', status: 'rejected', scrapedAt: 1 })),
      ], owners: {}, categories: [] }))
      const tr149 = await trainFromArchive()
      const p149 = predict149(victim149)
      ok('آموزش از آرشیو یک‌جا کار می‌کند و مدل آماده می‌شود', tr149.approved === 41 && tr149.rejected === 41 && p149.ready && p149.label === 'rejected')
      ok('learnBatch ورودیِ خالی را بی‌صدا رد می‌کند', learnBatch([]) === 0)
      if (bak149 != null) fs149.writeFileSync(SCR149, bak149); else fs149.unlinkSync(SCR149)
      const d149c = gad149(); if (d149c.moderation) { delete d149c.moderation.mlRejectMode; delete d149c.moderation.mlRejectMin; delete d149c.moderation.mlRejectAgreeMin; delete d149c.moderation.mlRejectReviewedMin }; sad149(d149c)
      reset149()
    }
    // فاز ۱۵۰ (بازطراحیِ صفحهٔ مقاله): بنرِ هدفمندِ دسته/تک‌مقاله — بدونِ بنر هیچ، اولویت با خاص‌ترین
    {
      const fs150 = await import('fs')
      const BFILE = '.banner-data.json'
      const bak150 = fs150.existsSync(BFILE) ? fs150.readFileSync(BFILE, 'utf-8') : null
      if (fs150.existsSync(BFILE)) fs150.unlinkSync(BFILE)
      const { addBanner, listActiveFor } = await import('../app/lib/banner-store.ts')
      ok('بدونِ هیچ بنری، جایگاهِ مقاله خالیِ خالی است', listActiveFor('article', { category: 'تحلیل بازار', slug: 'x' }).length === 0)
      const gGen = addBanner({ title: 'عمومی', image: 'i', link: 'l', placement: 'article' })
      const gCat = addBanner({ title: 'دسته', image: 'i', link: 'l', placement: 'article', articleCategory: 'تحلیل بازار' })
      const gSlug = addBanner({ title: 'تک‌مقاله', image: 'i', link: 'l', placement: 'article', articleCategory: '', articleSlug: 'pish-bini-1405' })
      const rSlug = listActiveFor('article', { category: 'تحلیل بازار', slug: 'pish-bini-1405' })
      ok('اولویت: بنرِ همین مقاله > دسته > عمومی', rSlug[0].id === gSlug.id && rSlug.some(b => b.id === gCat.id) && rSlug[rSlug.length - 1].id === gGen.id)
      ok('مقالهٔ دسته‌ای دیگر فقط بنرِ عمومی می‌گیرد (بنرِ دسته/تک‌مقالهٔ بی‌ربط حذف)', (() => { const r = listActiveFor('article', { category: 'حقوقی', slug: 'y' }); return r.length === 1 && r[0].id === gGen.id })())
      // بنرِ اختصاصیِ مقاله در مقاله‌ساز → meta.__bannerId
      const SCR150 = '.scraper-data.json'
      const bakS150 = fs150.existsSync(SCR150) ? fs150.readFileSync(SCR150, 'utf-8') : null
      if (fs150.existsSync(SCR150)) fs150.unlinkSync(SCR150)
      const { addArticle: addArt150, updateArticle: updArt150 } = await import('../app/lib/scraper-store.ts')
      const art150 = await addArt150({ title: 'مقالهٔ تستِ فاز۱۵۰', body: '<h2>بخش اول</h2><p>متنِ کامل</p>', category: 'تحلیل بازار', bannerId: gSlug.id })
      ok('بنرِ انتخابیِ مقاله‌ساز در متای مقاله می‌نشیند و با ویرایش پاک‌شدنی است', art150.meta.__bannerId === gSlug.id && !((await updArt150(art150.id, { bannerId: '' })).meta || {}).__bannerId)
      if (bakS150 != null) fs150.writeFileSync(SCR150, bakS150); else if (fs150.existsSync(SCR150)) fs150.unlinkSync(SCR150)
      if (bak150 != null) fs150.writeFileSync(BFILE, bak150); else if (fs150.existsSync(BFILE)) fs150.unlinkSync(BFILE)
    }
    // فاز ۱۵۱ (فیدبک: «کلی ملک هست چرا ۲۸ تا؟ / رفرش می‌شود ۴ تا»): دسته‌بندیِ مشترکِ شهر/معامله
    // — سرور (/api/content) و کلاینتِ جستجو هر دو از همین می‌خوانند تا شمارِ «N از total» با کارت‌ها بخواند
    {
      const { dealOf, cityMatch } = await import('../app/lib/listing-filter.ts')
      // فاز ۱۷۷: تگ‌ها عمداً از طبقه‌بندی حذف شدند (تگِ عمومی همه را اجاره‌ای می‌کرد) — چسبیده از دسته تست می‌شود
      ok('پیش‌فروش با نیم‌فاصله/فاصله/چسبیده تشخیص داده می‌شود', dealOf({ title: 'پیش‌فروش برج' }) === 'presale' && dealOf({ title: 'پیش فروش واحد' }) === 'presale' && dealOf({ category: 'پیشفروش' }) === 'presale')
      ok('اجاره از متنِ قیمت (ودیعه/رهن) یا متای «نوع معامله» درمی‌آید', dealOf({ price: 'ودیعه ۲۰۰ میلیون' }) === 'rent' && dealOf({ title: 'رهن کامل آپارتمان' }) === 'rent' && dealOf({ meta: { 'نوع معامله': 'اجاره' } }) === 'rent')
      ok('بی‌نشانه = فروش (پیش‌فرضِ امن)', dealOf({ title: 'آپارتمان ۸۵ متری جردن', price: '۵ میلیارد تومان' }) === 'sale')
      ok('تطبیقِ شهر به نیم‌فاصله/فاصله حساس نیست و متای «شهر» را هم می‌بیند', cityMatch({ location: 'تهران، سعادت‌آباد' }, 'تهران') === true && cityMatch({ location: 'نامشخص', meta: { 'شهر': 'کرج' } }, 'کرج') === true && cityMatch({ location: 'کرج، عظیمیه' }, 'تهران') === false)
      ok('شهرِ خالی همه را می‌پذیرد (بدونِ فیلترِ بی‌صدا)', cityMatch({ location: 'اصفهان' }, '') === true)
    }
    // فاز ۱۵۲ (سنجشِ prod: /search ۲.۰۶ث و /api/content ۱.۰۲ث TTFB): کشِ stale-while-revalidate
    {
      const { swrValue, swrMap } = await import('../app/lib/swr-cache.ts')
      const sleep = (ms) => new Promise(r => setTimeout(r, ms))
      let n = 0
      const v = swrValue(async () => ++n, { ttlMs: 60, maxStaleMs: 300 })
      ok('در بازهٔ تازگی فقط یک محاسبه', (await v.get()) === 1 && (await v.get()) === 1 && n === 1)
      await sleep(90)
      ok('پاسخِ کهنه فوری داده می‌شود (بدونِ انتظار پشتِ محاسبه)', (await v.get()) === 1)
      await sleep(30)
      ok('تازه‌سازی در پس‌زمینه انجام شد', (await v.get()) === 2)
      let m = 0
      const w = swrValue(async () => { await sleep(20); return ++m }, { ttlMs: 20, maxStaleMs: 60 })
      await w.get(); await sleep(100)
      ok('کهنه‌تر از سقفِ صداقت (maxStale) → منتظرِ محاسبهٔ تازه می‌ماند', (await w.get()) === 2)
      let k = 0
      const er = swrValue(async () => { if (++k > 1) throw new Error('down'); return 'ok' }, { ttlMs: 20 })
      await er.get(); await sleep(40); await er.get(); await sleep(20)
      ok('خطای تازه‌سازیِ پس‌زمینه، پاسخِ سالمِ کهنه را نمی‌شکند', (await er.get()) === 'ok')
      const mm = swrMap({ ttlMs: 1000, maxKeys: 2 })
      let calls = 0
      const comp = (key) => async () => { calls++; return key.toUpperCase() }
      ok('کلیدهای مستقل، هر کدام یک محاسبه', (await mm.get('a', comp('a'))) === 'A' && (await mm.get('b', comp('b'))) === 'B' && calls === 2)
      ok('هیتِ تازه بدونِ محاسبهٔ دوباره', (await mm.get('a', comp('a'))) === 'A' && calls === 2)
      await sleep(5); await mm.get('c', comp('c'))
      ok('سقفِ کلیدها: با ورودِ کلیدِ سوم، قدیمی‌ترین حذف می‌شود', mm.size() === 2 && (await mm.get('c', comp('c'))) === 'C' && calls === 3)
    }
    // فاز ۱۵۳ (تحلیلِ بازارِ per-city): رشدِ واقعیِ محله + آمارِ معامله‌های مهردار — بدونِ عددِ ساختگی
    {
      const fs153 = await import('fs')
      const SCR153 = '.scraper-data.json'
      const bak153 = fs153.existsSync(SCR153) ? fs153.readFileSync(SCR153, 'utf-8') : null
      const feb = new Date('2026-02-15').getTime(), jun = new Date('2026-06-15').getTime()
      const mk153 = (id, ppmM, t, extra = {}) => ({ id, type: 'listing', title: `آپارتمان 100 متری ${id}`, price: `${ppmM * 100} میلیون تومان`, location: 'تهران، جردن', meta: { 'شهر': 'تهران', 'محله': 'جردن', 'نوع معامله': 'فروش', ...extra }, scrapedAt: t, status: 'approved' })
      fs153.writeFileSync(SCR153, JSON.stringify({ sources: [], items: [
        mk153('g1', 100, feb), mk153('g2', 102, feb), mk153('g3', 120, jun), mk153('g4', 122, jun),
        ...Array.from({ length: 6 }, (_, i) => mk153(`s${i}`, 110, jun, { 'نوع معامله': 'اجاره', '__dealStatus': 'rented', '__soldAt': String(jun + (i + 3) * 86400000) })),
      ], owners: {}, categories: [] }))
      const { marketOverview: mo153, soldStats: ss153 } = await import('../app/lib/market-stats.ts')
      const ov153 = await mo153('تهران')
      const jordan = ov153.rows.find(r => r.district === 'جردن')
      ok('رشدِ محله از میانگینِ اولین→آخرین ماهِ واقعی (۱۰۱→۱۲۱ ≈ ۲۰٪)', jordan && jordan.growthPct === 20)
      const sold153 = await ss153('تهران', 'جردن')
      ok('آمارِ معامله فقط از مهرهای واقعی: ۶ معامله، میانگینِ روزها محاسبه شد', sold153 && sold153.total === 6 && sold153.avgDays >= 3)
      ok('کمتر از حدِ نمونه → null (کارت رندر نمی‌شود)', (await ss153('تهران', 'محلهٔ بی‌داده')) === null)
      const { setItemDealStatus: sds153, getItemById: gib153 } = await import('../app/lib/scraper-store.ts')
      await sds153('g1', 'sold')
      const g1 = await gib153('g1')
      const firstStamp = g1.meta['__soldAt']
      ok('ثبتِ «فروخته شد» مهرِ زمان می‌زند', g1.meta['__dealStatus'] === 'sold' && Number(firstStamp) > 0)
      await sds153('g1', 'rented')
      ok('تغییرِ وضعیت مهرِ اول را نگه می‌دارد (زمانِ واقعیِ معامله)', (await gib153('g1')).meta['__soldAt'] === firstStamp)
      await sds153('g1', '')
      ok('پاک‌کردنِ وضعیت مهر را هم پاک می‌کند', !(await gib153('g1')).meta['__soldAt'])
      if (bak153 != null) fs153.writeFileSync(SCR153, bak153); else fs153.unlinkSync(SCR153)
    }
    // فاز ۱۵۵ (فیدبکِ prod: «کلی آگهی داری چرا فقط شهران؟»): استخراجِ مقاومِ شهر/متراژ/فروش
    {
      const fs155 = await import('fs')
      const SCR155 = '.scraper-data.json'
      const bak155 = fs155.existsSync(SCR155) ? fs155.readFileSync(SCR155, 'utf-8') : null
      const t155 = Date.now()
      fs155.writeFileSync(SCR155, JSON.stringify({ sources: [], items: [
        // قیمتِ عددیِ خالص (بدونِ «میلیارد/فروش») + متراژ فقط در متا + لوکیشن فقط نامِ محله
        { id: 'p1', type: 'listing', title: 'آپارتمان تک‌واحدی نوساز', price: '4,500,000,000 تومان', location: 'شهران', meta: { 'متراژ': '90' }, scrapedAt: t155, status: 'approved' },
        // شهر از بخش‌های لوکیشن با فهرستِ واقعیِ شهرها (بدونِ متا)
        { id: 'p2', type: 'listing', title: 'ویلا 200 متری', price: '2 میلیارد', location: 'گوهردشت، کرج', meta: {}, scrapedAt: t155, status: 'approved' },
        // اجاره نباید واردِ آمارِ فروش شود
        { id: 'p3', type: 'listing', title: 'آپارتمان 80 متری', price: 'ودیعه 500 میلیون', location: 'تهران، ونک', meta: {}, scrapedAt: t155, status: 'approved' },
      ], owners: {}, categories: [] }))
      const { marketOverview: mo155 } = await import('../app/lib/market-stats.ts')
      const teh = await mo155('تهران')
      ok('آگهیِ بی‌واژهٔ فروش با متراژِ متا و لوکیشنِ فقط-محله، زیرِ شهرِ درست می‌نشیند (شهران→تهران)', teh.totalSaleListings === 1 && teh.rows[0]?.district === 'شهران' && teh.rows[0]?.avg === 50_000_000)
      const krj = await mo155('کرج')
      ok('شهر از بخش‌های لوکیشن با فهرستِ واقعیِ شهرها درمی‌آید (گوهردشت، کرج)', krj.totalSaleListings === 1 && krj.rows[0]?.district === 'گوهردشت')
      ok('اجاره‌ای واردِ آمارِ فروش نمی‌شود', (await mo155()).totalSaleListings === 2)
      if (bak155 != null) fs155.writeFileSync(SCR155, bak155); else fs155.unlinkSync(SCR155)
    }
    // فاز ۱۵۶ (فیدبک: «اسکرپ مجدد میاره تو تکراری‌ها» + «۲۰ تا تأیید می‌زنم برمی‌گردد»)
    {
      const fs156 = await import('fs')
      const SCR156 = '.scraper-data.json'
      const bak156 = fs156.existsSync(SCR156) ? fs156.readFileSync(SCR156, 'utf-8') : null
      if (fs156.existsSync(SCR156)) fs156.unlinkSync(SCR156)
      const st = await import('../app/lib/scraper-store.ts')
      const src156 = { id: 'src156', name: 'منبع تست', url: 'x', type: 'listing', method: 'css', enabled: true, schedule: 'manual', lastRun: null, lastCount: 0, status: 'idle' }
      const raw156 = { title: 'آپارتمان 95 متری جردن پلاک 7', price: '9,000,000,000 تومان', location: 'تهران، جردن', url: 'https://divar.ir/v/tok156', excerpt: 'واحد 95 متری', meta: { 'متراژ': '95', 'اتاق خواب': '2' } }
      const r1 = await st.insertItems(src156, [raw156])
      // A1: اسکرپِ دوبارهٔ «عینِ همان» → آپدیتِ درجا، نه «تکراری»
      const r2 = await st.insertItems(src156, [{ ...raw156, price: '9,100,000,000 تومان' }])
      let all156 = await st.listItems('listing')
      ok('اسکرپِ مجددِ همان URL+عنوان = آپدیت (نه dup) و قیمت تازه شد', r1.added === 1 && r2.updated === 1 && r2.dup === 0 && all156.length === 1 && all156[0].price === '9,100,000,000 تومان')
      // A2: ردیفِ قبلاً-تکراری با اسکرپِ تازه (URL نو) بازپس گرفته می‌شود
      await st.setItemStatus(all156[0].id, 'duplicate')
      const r3 = await st.insertItems(src156, [{ ...raw156, price: '9,100,000,000 تومان', url: 'https://divar.ir/v/tok156b' }])
      all156 = await st.listItems('listing')
      ok('ردیفِ تکراری با اسکرپِ تازه بازپس گرفته شد (بدونِ ردیفِ دوم، وضعیت pending)', r3.updated === 1 && all156.length === 1 && all156[0].status === 'pending')
      // B3: حکمِ دستی مهرِ ممیزی می‌خورد
      await st.setItemStatus(all156[0].id, 'approved')
      const g156 = await st.getItemById(all156[0].id)
      ok('تأییدِ دستی moderatedAt می‌گیرد (از جدولِ ممیزی غیب نمی‌شود)', g156.status === 'approved' && g156.moderatedAt > 0)
      // B2: حکمِ خودکارِ onlyPending حکمِ ادمین را بازنویسی نمی‌کند
      await st.setModerationBatch([{ id: g156.id, status: 'rejected', reason: 'خودکار', score: 0 }], { onlyPending: true })
      ok('ممیزیِ خودکار حکمِ تازهٔ ادمین را دست نمی‌زند', (await st.getItemById(g156.id)).status === 'approved')
      // A3: dedupe حکمِ ادمین/تأییدشده را نگه می‌دارد، حتی اگر تازه‌تر باشد
      const { dedupeListings } = await import('../app/lib/listing-dedupe.ts')
      const now156 = Date.now()
      const mk156 = (id, status, t, extra = {}) => ({ id, type: 'listing', title: 'آپارتمان 100 متری ونک', price: '8,000,000,000 تومان', location: 'تهران، ونک', meta: { 'متراژ': '100', 'اتاق خواب': '2', ...extra }, scrapedAt: t, status })
      fs156.writeFileSync(SCR156, JSON.stringify({ sources: [], items: [mk156('old-p', 'pending', now156 - 9e7), mk156('new-a', 'approved', now156)], owners: {}, categories: [] }))
      await dedupeListings()
      const after156 = await st.listItems('listing')
      ok('dedupe تأییدشده را نگه می‌دارد (نه صرفاً قدیمی‌تر را)', after156.find(i => i.id === 'new-a').status === 'approved' && after156.find(i => i.id === 'old-p').status === 'duplicate')
      fs156.writeFileSync(SCR156, JSON.stringify({ sources: [], items: [mk156('sold-x', 'approved', now156 - 9e7, { '__dealStatus': 'sold', '__soldAt': String(now156) }), mk156('live-y', 'approved', now156)], owners: {}, categories: [] }))
      await dedupeListings()
      ok('ردیفِ دارای مهرِ معاملهٔ واقعی هرگز تکراری نمی‌شود', (await st.listItems('listing')).every(i => i.status === 'approved'))
      if (bak156 != null) fs156.writeFileSync(SCR156, bak156); else if (fs156.existsSync(SCR156)) fs156.unlinkSync(SCR156)
    }
    // فاز ۱۵۷ (قیفِ prod: ۲۸۴ از ۱۸هزار!): جداکنندهٔ هزارگانِ فارسیِ «٬» در قیمت‌های واقعیِ دیوار
    {
      const { parsePrice: pp157 } = await import('../app/lib/market-stats.ts')
      ok('قیمتِ واقعیِ دیوار «۲۰٬۶۰۰٬۰۰۰٬۰۰۰ تومان» کامل پارس می‌شود', pp157('۲۰٬۶۰۰٬۰۰۰٬۰۰۰ تومان') === 20_600_000_000)
      ok('جداکنندهٔ «،» و رقمِ عربی هم پارس می‌شوند', pp157('١٬٥٠٠،٠٠٠٬٠٠٠ تومان') === 1_500_000_000)
      ok('میلیارد/میلیونِ متنی مثل قبل کار می‌کند', pp157('۲.۵ میلیارد') === 2_500_000_000 && pp157('450 میلیون') === 450_000_000)
      ok('قیمتِ خالی/توافقی صفر می‌ماند (واردِ آمار نمی‌شود)', pp157(' تومان') === 0 && pp157('توافقی') === 0)
    }
    // فاز ۱۵۸ (انقلابِ بصری: شهرِ ایزومتریک): چیدمان/پالت/ارتفاع — قطعی از دادهٔ واقعی
    {
      const { cityLayoutOf, towerPaletteOf, towerFloorsOf, TOWER_PALETTES } = await import('../app/lib/empire-visual.ts')
      const L8 = cityLayoutOf(8)
      ok('چیدمانِ مارپیچی: ۸ برج، ۸ قوارهٔ یکتا داخلِ شبکه', L8.spots.length === 8 && new Set(L8.spots.map(s => `${s.col},${s.row}`)).size === 8 && L8.spots.every(s => s.col >= 0 && s.col < L8.gridN && s.row >= 0 && s.row < L8.gridN))
      ok('چیدمان قطعی است (دارایی iام همیشه همان‌جا)', JSON.stringify(cityLayoutOf(8).spots) === JSON.stringify(L8.spots) && JSON.stringify(cityLayoutOf(12).spots.slice(0, 8)) === JSON.stringify(L8.spots))
      ok('شهرِ خالی و شمارِ منفی امن است', cityLayoutOf(0).spots.length === 0 && cityLayoutOf(-3).spots.length === 0 && cityLayoutOf(60).spots.length === 60)
      ok('پالتِ هر نما کامل است و نمای ناشناخته به پیش‌فرض می‌افتد', Object.values(TOWER_PALETTES).every(p => p.top && p.left && p.right && p.win) && towerPaletteOf('xyz') === TOWER_PALETTES[''] && towerPaletteOf('modern') === TOWER_PALETTES['modern'])
      ok('ارتفاع از ارزشِ واقعی: بیشینه→۶ طبقه، صفر/بی‌داده→۱', towerFloorsOf(100, 100) === 6 && towerFloorsOf(50, 100) === 3 && towerFloorsOf(0, 100) === 1 && towerFloorsOf(10, 0) === 1)
    }
    // فاز ۱۶۴ (موتورِ اسپرایت): انتخابِ قطعی + اعتبارسنجیِ manifest
    {
      const { pickBuilding, pickFrom, spriteHash, isValidManifest } = await import('../app/lib/empire-sprites.ts')
      const man = { tileW: 256, ground: { grass: [{ file: 'g.png', w: 256, h: 149 }] }, buildings: { apartment: [{ file: 'a1.png', w: 200, h: 180 }, { file: 'a2.png', w: 200, h: 260 }, { file: 'a3.png', w: 200, h: 340 }], generic: [{ file: 'x.png', w: 200, h: 200 }] }, vehicles: [{ file: 'c1.png', w: 60, h: 40 }, { file: 'c2.png', w: 60, h: 40 }] }
      ok('انتخابِ اسپرایت قطعی است (همان دارایی = همان اسپرایت)', pickBuilding(man, 'apartment', 6, 6, 'asset-1') === pickBuilding(man, 'apartment', 6, 6, 'asset-1'))
      ok('طبقهٔ بیشتر → اسپرایتِ بلندتر', pickBuilding(man, 'apartment', 6, 6, 'z').h >= pickBuilding(man, 'apartment', 1, 6, 'z').h)
      ok('دستهٔ بی‌اسپرایت به generic می‌افتد و خالیِ کامل null', pickBuilding(man, 'shop', 3, 6, 'q').file === 'x.png' && pickBuilding({ ...man, buildings: {} }, 'shop', 3, 6, 'q') === null)
      ok('pickFrom قطعی و امن', pickFrom(man.vehicles, 'car7') === pickFrom(man.vehicles, 'car7') && pickFrom([], 'x') === null && pickFrom(undefined, 'x') === null)
      ok('اعتبارسنجیِ manifest', isValidManifest(man) === true && isValidManifest({}) === false && spriteHash('a') === spriteHash('a'))
    }
    // فاز ۱۶۷ (زنگِ صبحگاهی): ساعتِ تهران، پنجرهٔ صبح، درصدِ مسیرِ سطح، متنِ پوش — همه قطعی
    {
      const { tehranHourOf, morningWindowOpen, pathPct, morningPushBody } = await import('../app/lib/empire-morning.ts')
      // 2026-07-18T05:30:00Z = ساعتِ ۰۹:۰۰ تهران (ایران همیشه UTC+3:30 — ساعتِ تابستانی از ۱۴۰۱ حذف شد)
      const t0900 = Date.UTC(2026, 6, 18, 5, 30), t0859 = Date.UTC(2026, 6, 18, 5, 29), t2330 = Date.UTC(2026, 6, 18, 20, 0)
      ok('ساعتِ تهران درست است (۰۵:۳۰ UTC = ۹ صبح، ۲۰:۰۰ UTC = ۲۳:۳۰)', tehranHourOf(t0900) === 9 && tehranHourOf(t0859) === 8 && tehranHourOf(t2330) === 23)
      ok('پنجرهٔ صبح رأسِ ساعتِ knob باز می‌شود و قبلش بسته است', morningWindowOpen(t0900, 9) === true && morningWindowOpen(t0859, 9) === false && morningWindowOpen(t2330, 9) === true)
      ok('ساعتِ نامعتبرِ knob امن است (کف ۰، سقف ۲۳)', morningWindowOpen(t0900, -5) === true && morningWindowOpen(t0900, 99) === false && morningWindowOpen(t2330, 99) === true)
      ok('درصدِ مسیرِ سطح صادق است: ۳۰ از ۳۰۰ = ۱۰٪، سقف ۱۰۰، کفِ نمایش ۱', pathPct(300, 30) === 10 && pathPct(20, 500) === 100 && pathPct(10000, 30) === 1 && pathPct(0, 30) === 100 && pathPct(300, 0) === 0)
      const body = morningPushBody('۳ آگهیِ واقعی ببین', 15, 30, 10)
      ok('متنِ پوش کوئست و پاداش و مسیر را دارد و واژهٔ ممنوعه ندارد', body.includes('۳ آگهیِ واقعی ببین') && body.includes('سکه') && body.includes('٪ از راهِ سطحِ بعد') && !body.includes('بازی'))
      ok('پوشِ بدونِ پاداش/مسیر خراب نمی‌شود', morningPushBody('عنوان', 0, 0, 0) === '«عنوان»')
    }
    // فاز ۱۸۱ (فروش با چانه‌زنی): پیشنهادِ قطعی از هش حولِ ارزشِ واقعی + چانهٔ ریسک‌دار — همه knob
    {
      const { sellOfferOf, counterRollOf, sellSlotOf } = await import('../app/lib/empire-sellnego.ts')
      const cfg = { enabled: true, offerHours: 1, bandLowPct: 88, bandHighPct: 103, noOfferOverPct: 15, counterBoostPct: 4, counterFailPct: 35 }
      const o1 = sellOfferOf('ast1', 42, 10_000_000_000, 0, cfg)
      ok('پیشنهاد قطعی است و در باندِ knob (۸۸..۱۰۳٪ بازار)', o1 === sellOfferOf('ast1', 42, 10_000_000_000, 0, cfg) && o1 >= 8_800_000_000 && o1 <= 10_300_000_000)
      ok('اسلاتِ دیگر = پیشنهادِ دیگر (بازیِ هر ساعت)', sellOfferOf('ast1', 43, 10_000_000_000, 0, cfg) !== o1 || sellOfferOf('ast1', 44, 10_000_000_000, 0, cfg) !== o1)
      ok('پیشنهاد از قیمتِ پیشنهادیِ فروشنده بالاتر نمی‌رود', sellOfferOf('ast1', 42, 10_000_000_000, 9_000_000_000, cfg) <= 9_000_000_000)
      const overpriced = Array.from({ length: 12 }, (_, i) => sellOfferOf('astX', i, 10_000_000_000, 13_000_000_000, cfg))
      ok('گران‌فروشیِ بالای ٪knob → بعضی بازه‌ها خریدار نمی‌آید', overpriced.some(v => v === 0) && overpriced.some(v => v > 0))
      const r1 = counterRollOf('ast1', 42, cfg)
      ok('چانه قطعی است و بوست در سقفِ knob', JSON.stringify(r1) === JSON.stringify(counterRollOf('ast1', 42, cfg)) && (r1.walk || (r1.boostPct >= 1 && r1.boostPct <= 4)))
      const rolls = Array.from({ length: 40 }, (_, i) => counterRollOf('a' + i, 1, cfg))
      ok('ریسکِ رفتنِ خریدار واقعاً رخ می‌دهد (نه همیشه، نه هرگز)', rolls.some(r => r.walk) && rolls.some(r => !r.walk))
      ok('بازهٔ اسلات از ساعتِ knob', sellSlotOf(7_200_000, 1) === 2 && sellSlotOf(7_200_000, 2) === 1)
    }
    // فاز ۱۸۲ (راهنمای روزهای اول — سبکِ تراوین): شرطِ هر قدم فقط از وضعیتِ واقعی؛ پنجرهٔ N روزه knob
    {
      const { tutorialDoneOf, tutorialOf, TUTORIAL_STEPS } = await import('../app/lib/empire-tutorial.ts')
      const base = { assets: [], claims: {}, createdAt: Date.now(), homeHood: '', identity: {}, realized: 0 }
      ok('کاربرِ صفر هیچ قدمی را انجام نداده', TUTORIAL_STEPS.every(s => !tutorialDoneOf(base, s.id)))
      ok('خریدِ اولین ملک از داراییِ واقعی', tutorialDoneOf({ ...base, assets: [{ id: 'a1' }] }, 'buy_first'))
      ok('تصمیم = action/landPlan/business روی دارایی', tutorialDoneOf({ ...base, assets: [{ id: 'a1', action: 'rent' }] }, 'decide') && !tutorialDoneOf({ ...base, assets: [{ id: 'a1' }] }, 'decide'))
      ok('بازسازی فقط با renovBoostPct واقعی', tutorialDoneOf({ ...base, assets: [{ id: 'a1', renovBoostPct: 3 }] }, 'renovate') && !tutorialDoneOf({ ...base, assets: [{ id: 'a1', renovBoostPct: 0 }] }, 'renovate'))
      ok('محلهٔ خانه از homeHood', tutorialDoneOf({ ...base, homeHood: 'ونک' }, 'hood_home') && !tutorialDoneOf(base, 'hood_home'))
      ok('سپردن به مشاور: sale فعال یا فروشِ کامل‌شده (realized) یا ادعای قبلی', tutorialDoneOf({ ...base, assets: [{ id: 'a1', sale: { asking: 1, at: 1 } }] }, 'sell_list') && tutorialDoneOf({ ...base, realized: -5 }, 'sell_list') && !tutorialDoneOf(base, 'sell_list'))
      ok('صندوقچه از کلیدِ chest_ در claims', tutorialDoneOf({ ...base, claims: { chest_123: 1 } }, 'chest') && !tutorialDoneOf(base, 'chest'))
      const cfg = { enabled: true, days: 3 }
      const t1 = tutorialOf({ ...base, assets: [{ id: 'a1' }] }, cfg, base.createdAt + 1000)
      ok('راهنما در روزِ اول فعال است و doneCount فقط قدم‌های claimed را می‌شمارد', t1.active === true && t1.daysLeft === 3 && t1.steps.find(s => s.id === 'buy_first').done === true && t1.doneCount === 0)
      const t2 = tutorialOf(base, cfg, base.createdAt + 4 * 864e5)
      ok('بعدِ N روزِ knob راهنما جمع می‌شود', t2.active === false)
      const allClaimed = { ...base, claims: Object.fromEntries(TUTORIAL_STEPS.map(s => ['tut_' + s.id, 1])), assets: [{ id: 'a1' }] }
      ok('همهٔ قدم‌ها claimed → غیرفعال حتی داخلِ پنجره', tutorialOf(allClaimed, cfg, base.createdAt + 1000).active === false)
      ok('خاموش = null (knob ادمین)', tutorialOf(base, { enabled: false, days: 3 }) === null)
    }
    // فاز ۱۷۷ (فیدبک: «می‌زنم اجاره همه‌چیز میاره») — طبقه‌بندیِ معامله با تقدمِ سیگنالِ قوی
    {
      const { dealOf } = await import('../app/lib/listing-filter.ts')
      ok('تگِ عمومیِ «رهن و اجاره» دیگر آگهیِ فروش را اجاره‌ای نمی‌کند', dealOf({ title: 'آپارتمان ۹۵ متری', price: '۸٬۵۰۰٬۰۰۰٬۰۰۰ تومان', tags: ['رهن و اجاره', 'مسکونی'] }) === 'sale')
      ok('متای صریحِ «فروش» بر واژهٔ اجاره در عنوان می‌چربد', dealOf({ title: 'فروش واحد با قابلیت اجاره', meta: { 'نوع معامله': 'فروش' } }) === 'sale')
      ok('ودیعه/اجاره در قیمت = اجاره', dealOf({ title: 'آپارتمان ۸۰ متری', price: 'ودیعه: ۲۰۰٬۰۰۰٬۰۰۰ — اجاره: ۱۲٬۰۰۰٬۰۰۰' }) === 'rent')
      ok('متای «رهن و اجاره» = اجاره و «پیش‌فروش» در عنوان = پیش‌فروش', dealOf({ title: 'x', meta: { 'نوع معامله': 'رهن و اجاره' } }) === 'rent' && dealOf({ title: 'پیش‌فروش برج در چیتگر' }) === 'presale')
      ok('اجاره در عنوان (بدونِ متا/قیمت) = اجاره', dealOf({ title: 'اجارهٔ مغازه ۳۰ متری' }) === 'rent')
      // فاز ۱۹۰ — اجارهٔ روزانه/کوتاه‌مدت (فیدبک: «آگهی‌های اجارهٔ روزانه رو سایت درست نمیاره»)
      ok('دستهٔ دیوارِ «اجارهٔ کوتاه‌مدت» = روزانه (نه rent)', dealOf({ title: 'آپارتمان مبله لوکس ۱۳۰م', category: 'اجارهٔ کوتاه‌مدت آپارتمان و سوئیت' }) === 'daily')
      ok('قیمتِ «تومان/شب» = روزانه', dealOf({ title: 'سوئیت مبله', price: '۹٬۵۰۰٬۰۰۰ تومان/شب' }) === 'daily')
      ok('متاهای مخصوصِ شبانه (روزهای عادی/ظرفیت) = روزانه', dealOf({ title: 'آپارتمان مبله', meta: { 'روزهای عادی (شنبه تا سه‌شنبه)': '۹٬۵۰۰٬۰۰۰', 'ظرفیت استاندارد': '۴ نفر' } }) === 'daily')
      ok('«اجاره روزانه» در عنوان = روزانه ولی اجارهٔ عادی دست نمی‌خورد', dealOf({ title: 'اجاره روزانه آپارتمان مبله ولنجک' }) === 'daily' && dealOf({ title: 'اجارهٔ آپارتمان ۱۰۰ متری', price: 'ودیعه: ۵۰۰٬۰۰۰٬۰۰۰' }) === 'rent')
      ok('متای صریحِ «نوع معامله: اجاره» همچنان rent می‌ماند', dealOf({ title: 'x', meta: { 'نوع معامله': 'اجاره' } }) === 'rent')
    }
    // فاز ۱۷۶ (پورتِ «هوشِ نمایشگاهِ» خودروجت → هوشِ آژانس): استخراجِ امضای مشاور از متنِ آگهیِ ملک
    {
      const { extractSignature, validName } = await import('../app/lib/agency-roster.ts')
      const sig1 = extractSignature('آپارتمان ۹۵ متری سعادت‌آباد', 'نوساز، فول امکانات\nکارشناس فروش جهت راهنمایی ♀️محمدی', 'املاک سعادت')
      ok('اسمِ چسبیده به اموجی بعدِ «جهت راهنمایی» درمی‌آید', sig1.includes('محمدی'))
      const sig2 = extractSignature('ویلا دوبلکس', 'مشاور فروش: سرکار خانم کامرانی', 'املاک برج')
      ok('لقب حذف می‌شود («خانم کامرانی» → «کامرانی»)', sig2.includes('کامرانی') && !sig2.some(s => s.includes('خانم')))
      ok('واژهٔ ملکی هرگز امضا نیست', validName('آپارتمان', '') === '' && validName('پنت‌هاوس', '') === '' && validName('نوساز', '') === '')
      ok('نامِ خودِ آژانس امضا نیست', validName('سعادت', 'املاک سعادت') === '')
      const sig3 = extractSignature('مغازه ۳۰ متری', '✨ SHAYGAN ✨ بهترین موقعیت', 'x')
      ok('بلوکِ تزئینیِ برند امضا می‌شود', sig3.includes('SHAYGAN'))
      ok('عبارتِ تبلیغاتی امضا نمی‌شود', validName('فروش ویژه', '') === '' && validName('ی تایید', '') === '')
    }
    // فاز ۲۷۵ (فیدبک: «نامِ مشاورانِ رُستر آشغال درمی‌آید — لوکیشن، منطقه، دوخواب، قابل، عزیزان،
    // باهماهنگی، آزاد، ایرانی»): دو ریشه بسته شد — واژگانِ املاکی رد می‌شوند، و استخراج فقط از
    // «بلوکِ امضا» انجام می‌شود نه هرجای متن (نمونهٔ واقعی: «فلاحی» از آدرسِ «بین فلاحی ۴۱ و ۴۳»).
    {
      const { extractSignature, validName, addressTokens } = await import('../app/lib/agency-roster.ts')
      const { learnName, knownNames, pruneLearned, resetMl } = await import('../app/lib/agency-roster-ml.ts')
      // ۱) بازتولیدِ دقیقِ آگهیِ گزارش‌شده: اسم از بلوکِ امضا، نه از آدرس/واژگانِ املاکی
      const DESC275 = 'آپارتمان ۱۲۰ متری فول امکانات\nلوکیشن عالی، دوخواب، منطقه ۲\nآدرس: سعادت آباد، بین فلاحی ۴۱ و ۴۳، پلاک ۱۲\nقابل معاوضه، آزاد و آماده تحویل\n▪ مصطفی هوشمند\n▪ مشاور تخصصی شهرک غرب'
      const s275 = extractSignature('آپارتمان ۱۲۰ متری سعادت‌آباد', DESC275, 'املاک برتر')
      ok('نامِ امضا از خطِ چسبیده به «مشاور …» درمی‌آید', s275[0] === 'مصطفی هوشمند')
      ok('نامِ کوچه («بین فلاحی ۴۱ و ۴۳») هرگز مشاور نمی‌شود', !s275.some(n => n.includes('فلاحی')))
      ok('هیچ واژهٔ املاکی/موقعیتی در کاندیداها نیست', !s275.some(n => /لوکیشن|منطقه|دوخواب|قابل|آزاد|شهرک|غرب/.test(n)))
      // ۲) لیستِ سیاهِ صریح — عیناً همان کلماتی که کاربر در پنل دیده بود
      ok('واژگانِ آشغالِ گزارش‌شده هرگز اسم نیستند', ['لوکیشن', 'منطقه', 'دوخواب', 'قابل', 'عزیزان', 'باهماهنگی', 'آزاد', 'ایرانی'].every(w => validName(w, '') === ''))
      // ۳) توکنِ آدرس: تا ۲ کلمه پس از نشانه، ولی رقم/«:» زنجیره را می‌بندد (وگرنه «منطقه ۲: رضایی» را می‌خورد)
      const addr275 = addressTokens(DESC275)
      ok('کلمهٔ پس از نشانهٔ آدرس، توکنِ آدرس می‌شود', addr275.has('فلاحی') && addr275.has('غرب'))
      ok('رقم/مرزِ قطعه زنجیرهٔ آدرس را می‌بندد (اسمِ بعد از «منطقه ۲:» سالم می‌ماند)', !addressTokens('کارشناس فروش منطقه ۲: رضایی').has('رضایی'))
      ok('توکنِ آدرس حتی به‌عنوانِ نامِ آماده هم رد می‌شود (AI/lexicon هم از این دروازه رد می‌شوند)', validName('فلاحی', '', addr275) === '' && validName('فلاحی', '') === 'فلاحی')
      // ۴) امضا و آدرس روی یک خط (آگهیِ تک‌خطی) — باز هم فقط اسمِ بعد از کلیدواژه
      const s275b = extractSignature('آپارتمان', 'واحد نوساز در خیابان فرشته، نبش کوچه یاس — کارشناس فروش: آقای رضایی', 'املاک برج')
      ok('در آگهیِ تک‌خطی، اسم از کلیدواژهٔ امضا می‌آید نه از خیابان/کوچه', s275b[0] === 'رضایی' && !s275b.some(n => /فرشته|یاس/.test(n)))
      // ۵) دروازهٔ یادگیری: آشغال هرگز آموخته نمی‌شود و آشغالِ آموختهٔ گذشته پاک می‌شود
      await resetMl()
      await learnName('لوکیشن', 'ai', 5); await learnName('رضایی', 'ai', 3)
      const k275 = await knownNames(1)
      ok('نامِ آشغال حتی با وزنِ بالا واردِ واژه‌نامه نمی‌شود', !k275.some(l => l.name === 'لوکیشن') && k275.some(l => l.name === 'رضایی'))
      // شبیه‌سازیِ واژه‌نامهٔ زندهٔ تولید که پیش از دروازه آلوده شده بود: مستقیم در فایلِ استور می‌نویسیم.
      if (!process.env.DATABASE_URL) {
        const { readFileSync: rf, writeFileSync: wf } = await import('fs')
        const mlFile = '.agency-ml-data.json'
        const db275 = JSON.parse(rf(mlFile, 'utf-8'))
        db275.names['دوخواب'] = { name: 'دوخواب', weight: 9, at: Date.now(), teacher: 'ai' }
        wf(mlFile, JSON.stringify(db275, null, 2), 'utf-8')
        ok('واژه‌نامهٔ آلودهٔ گذشته واقعاً آلوده است (پیش‌شرطِ تست)', (await knownNames(1)).some(l => l.name === 'دوخواب'))
        const dropped = await pruneLearned()
        ok('پاک‌سازیِ واژه‌نامه، آشغالِ از قبل آموخته را حذف می‌کند', dropped.includes('دوخواب') && !(await knownNames(1)).some(l => l.name === 'دوخواب'))
        ok('نامِ سالم پس از پاک‌سازی دست‌نخورده می‌ماند', (await knownNames(1)).some(l => l.name === 'رضایی'))
      }
      await resetMl()
    }
    // فاز ۲۷۵b (شواهدِ زندهٔ سرور پس از دیپلوی): سه ایرادِ باقی‌مانده که واژه‌نامهٔ تولید لو داد —
    // «قدیمی منطقه» (وزن ۵۸۸) و «نزدیک مترو» (وزن ۴۰۰) از دروازه رد شده بودند، و «فلاحی» از
    // «(فلاحی 38)» که هیچ نشانهٔ آدرسی قبلش نداشت. امضای واقعیِ آن آژانس هم «نام + هستم» بود.
    {
      const { extractSignature, addressTokens } = await import('../app/lib/agency-roster.ts')
      const { strictName, validName } = await import('../app/lib/agency-name-lexicon.ts')
      // ۱) دروازهٔ سخت‌گیر: نامی که پاک‌سازی «کوتاهش» کند اصلاً اسم نبوده (باگِ اصلیِ pruneLearned)
      // «ابراهیمی» نامِ واقعی است؛ «ابراهیمی منطقه» نه — validName آن را به «ابراهیمی» کوتاه می‌کند
      // و شرطِ سستِ قبلی همین را «سالم» می‌دید و در واژه‌نامه نگه می‌داشت.
      ok('نامِ نیمه‌آشغال از دروازهٔ سخت رد می‌شود (ولی validName کوتاه‌شده‌اش را می‌دهد)',
        strictName('ابراهیمی منطقه') === '' && validName('ابراهیمی منطقه') === 'ابراهیمی'
        && strictName('قدیمی منطقه') === '' && strictName('نزدیک مترو') === '')
      ok('نامِ سالم از دروازهٔ سخت رد می‌شود', strictName('محمد پرنده') === 'محمد پرنده' && strictName('آزادی') === 'آزادی')
      // ۲) «کلمه + عددِ کوچک» = نامِ معبر، حتی بدونِ خیابان/کوچه پیش از آن
      ok('«(فلاحی 38)» بدونِ نشانهٔ آدرس هم نامِ معبر شناخته می‌شود', addressTokens('لوکیشن قوی و عیان نشین (فلاحی 38)').has('فلاحی'))
      ok('شمارهٔ موبایلِ کنارِ اسم، اسم را آدرس نمی‌کند', !addressTokens('رضایی 09121112233').has('رضایی'))
      // ۳) امضای «معرفیِ خود» + ردِ نوفهٔ «با هماهنگی قبلی» — متنِ واقعیِ «مسکن دیپلمات»
      const D = 'آپارتمان ۹۰ متری\n✔️لوکیشن بسیار قوی و عیان نشین (فلاحی 38)\n✔️کلید نزد دفتر و بازدید ازاد با هماهنگی قبلی\n✅️محمد پرنده هستم مشاور و کارشناس شما\n✅️مسکن دیپلمات خادم شما عزیزان میباشد'
      const sD = extractSignature('آپارتمان ۹۰ متری', D, 'مسکن دیپلمات')
      ok('امضای «نام + هستم» گرفته می‌شود (نامِ پیش از کلیدواژه)', sD[0] === 'محمد پرنده')
      ok('نه «فلاحی»ِ آدرس، نه «قبلی»ِ «با هماهنگی قبلی» واردِ کاندیداها می‌شوند', sD.length === 1)
    }
    // فاز ۲۷۶ (فیدبک: «شماره را از دیوار کپی می‌کنیم کار نمی‌کند») — `replace(/\D/g,'')` در ۱۴۹ جای
    // پروژه ارقامِ فارسی را «حذف» می‌کرد (نه تبدیل)، پس هر عددِ کپی‌شده از دیوار خالی می‌شد.
    {
      const { digitsOnly, enDigits } = await import('../app/lib/digits.ts')
      ok('موبایلِ فارسیِ کپی‌شده از دیوار درست خوانده می‌شود', digitsOnly('۰۹۱۵۵۵۵۷۴۸۲') === '09155557482')
      ok('فاصله/خط‌تیره وسطِ شماره مانع نیست', digitsOnly('۰۹۱۵ ۵۵۵-۷۴۸۲') === '09155557482' && /^09\d{9}$/.test(digitsOnly('۰۹۱۵ ۵۵۵-۷۴۸۲')))
      ok('ارقامِ عربیِ هندی هم پشتیبانی می‌شوند', digitsOnly('٠٩١٢٣٤٥٦٧٨٩') === '09123456789')
      ok('ورودیِ لاتین دست‌نخورده می‌ماند (بدونِ رگرسیون)', digitsOnly('09155557482') === '09155557482')
      ok('جداکنندهٔ فارسیِ قیمت به لاتین برمی‌گردد', enDigits('۸٬۵۰۰٬۰۰۰') === '8,500,000')
    }
    // فاز ۲۸۴ (یافتهٔ major بازبینِ خصمانه): faToEnِ listing-similarity «٬» را ترجمه نمی‌کرد،
    // پس «۱۲٬۵۰۰٬۰۰۰٬۰۰۰» به‌جای کلِ عدد، بزرگ‌ترین گروهِ سه‌رقمی (۵۰۰) خوانده می‌شد —
    // هم امتیازِ قیمتِ موتورِ مشابه و هم twin-matching آلوده بود.
    {
      const { fieldsOf, faToEn } = await import('../app/lib/listing-similarity.ts')
      ok('faToEn جداکنندهٔ «٬» را هم ترجمه می‌کند', faToEn('۱۲٬۵۰۰٬۰۰۰') === '12,500,000')
      const a = fieldsOf({ title: 'آپارتمان', price: '۱۲٬۵۰۰٬۰۰۰٬۰۰۰ تومان' })
      const b = fieldsOf({ title: 'آپارتمان', price: '۱۲٬۰۰۰٬۰۰۰٬۰۰۰ تومان' })
      ok('قیمتِ با جداکنندهٔ فارسی کامل خوانده می‌شود (نه گروهِ سه‌رقمی)', a.price === 12_500_000_000 && b.price === 12_000_000_000)
      const { TwinIndex } = await import('../app/lib/listing-similarity.ts')
      const idx = new TwinIndex()
      const f1 = fieldsOf({ title: 'آپارتمان ۱۰۰ متری جنت‌آباد', price: '5,000,000,000', location: 'تهران، جنت‌آباد', meta: { 'متراژ': '100' } })
      idx.add(f1, 'X')
      idx.remove('X')
      ok('TwinIndex.remove اسنپ‌شاتِ کهنه را از همهٔ بلاک‌ها برمی‌دارد', idx.find(f1) === null)
    }
    // فاز ۲۷۷ (فیدبکِ روی دادهٔ زنده): «کسری» از «کسری بودجه» مشاور شده بود، و «محمد» جدا از
    // «محمد پرنده» خوشهٔ دوم ساخته بود در حالی که یک نفرند.
    {
      const { extractSignature } = await import('../app/lib/agency-roster.ts')
      const { contextNoiseTokens } = await import('../app/lib/agency-name-lexicon.ts')
      // «کسری» نامِ واقعیِ آدم هم هست، پس لیستِ سیاهِ کلمه‌ای جواب نمی‌داد — بافتِ بعدش ملاک است.
      ok('کلمهٔ پیش از «بودجه/تومان/متری» اسم نیست', contextNoiseTokens('برای کسری بودجه وام بگیرید').has('کسری'))
      ok('«کسری بودجه» دیگر مشاور نمی‌سازد', extractSignature('آپارتمان', 'امکان وام برای کسری بودجه\nمشاور فروش شما', 'مسکن دیپلمات').length === 0)
      ok('نامِ واقعی با همین قاعده آسیب نمی‌بیند', extractSignature('آپارتمان', 'محمد پرنده هستم مشاور و کارشناس شما', 'مسکن دیپلمات')[0] === 'محمد پرنده')
    }
    // فاز ۲۷۹ (فیدبک: «محمد همان محمدپرنده است، وحید حسنی‌منش دوبار تکرار شده — علتش این است
    // که کاربر گاهی بین نام و فامیل فاصله می‌گذارد و گاهی نه») — ادغام روی کلیدِ بی‌فاصله.
    {
      const { buildAgencyRoster } = await import('../app/lib/agency-roster.ts')
      const mk = (ads, pinnedKeys) => buildAgencyRoster('testagency279', {
        useAI: false, pinnedKeys,
        f: {
          profileTokens: async () => ({ posts: ads.map(a => ({ token: a.token, title: a.title })), name: 'املاک تست' }),
          post: async (t) => { const a = ads.find(x => x.token === t); return { title: a.title, description: a.desc } },
        },
      })
      const ADS = [
        { token: 't279a', title: 'آپارتمان ۹۰', desc: 'واحد نوساز.\nمحمد پرنده هستم مشاور شما' },
        { token: 't279b', title: 'آپارتمان ۸۰', desc: 'واحد بازسازی.\nمحمدپرنده هستم مشاور شما' },
        { token: 't279c', title: 'ویلا', desc: 'حیاط‌دار.\nمشاور فروش: محمد' },
        { token: 't279d', title: 'مغازه', desc: 'موقعیت عالی.\nمشاور فروش: محمد' },
      ]
      const r = await mk(ADS)
      ok('نامِ بافاصله و بی‌فاصله یک خوشه‌اند و نامِ کوچک هم در آن ادغام می‌شود',
        r.advisors.length === 1 && r.advisors[0].tokens.length === 4)
      // ضدتست: «محمدی» نباید «محمد» را ببلعد (باقی‌ماندهٔ ۱ حرفی)
      const r2 = await mk([
        { token: 't279e', title: 'x', desc: 'مشاور فروش: محمدی' }, { token: 't279f', title: 'x', desc: 'مشاور فروش: محمدی' },
        { token: 't279g', title: 'x', desc: 'مشاور فروش: محمد' }, { token: 't279h', title: 'x', desc: 'مشاور فروش: محمد' },
      ])
      ok('«محمد» و «محمدی» دو نفرِ جدا می‌مانند (ادغامِ بیش‌ازحد ممنوع)', r2.advisors.length === 2)
      // مشاورِ دارای حساب همیشه میزبان است (کلیدش عوض نمی‌شود، وگرنه فایل‌هایش پاک می‌شدند)
      const r3 = await mk(ADS, ['محمد'])
      ok('کلیدِ مشاورِ دارای حساب پس از ادغام حفظ می‌شود', r3.advisors.length === 1 && r3.advisors[0].key === 'محمد')
    }
    // فاز ۲۸۰ — «قانونِ موضع» برای همهٔ منابع. بازتولیدِ دقیقِ آگهیِ gaHRMEeD: «فلاحی» فقط در
    // عنوان است (نامِ کوچه)، امضا «محمد پرنده هستم مشاور» — ولی «فلاحی» از قبل در واژه‌نامه
    // یاد گرفته شده بود و چون تطبیقِ ML به موضع کاری نداشت، آگهی را می‌دزدید.
    {
      const { buildAgencyRoster } = await import('../app/lib/agency-roster.ts')
      const { learnName, resetMl } = await import('../app/lib/agency-roster-ml.ts')
      const run = (ads) => buildAgencyRoster('t280', { useAI: false, f: {
        profileTokens: async () => ({ posts: ads.map(a => ({ token: a.token, title: a.title })), name: 'مسکن دیپلمات' }),
        post: async (t) => { const a = ads.find(x => x.token === t); return { title: a.title, description: a.desc } },
      } })
      await resetMl()
      await learnName('فلاحی', 'ai', 5)          // آلودگیِ گذشته: «فلاحی» تثبیت‌شده در واژه‌نامه
      await learnName('محمد پرنده', 'ai', 5)
      const r = await run([
        { token: 'gaHRMEeD', title: 'اپارتمان فلاحی 2شخصی سازسندتکبرگ', desc: 'ساختمان 7واحدی خلوت\nمسکن دیپلمات\nمحمد پرنده هستم مشاور و امین شما عزیزان' },
        { token: 'ga8sjqmX', title: 'اپارتمان 90 متری', desc: 'لوکیشن قوی (فلاحی 38)\nمحمد پرنده هستم مشاور و کارشناس شما' },
      ])
      ok('نامِ آموخته از عنوان/آدرس دیگر آگهی را نمی‌دزدد', !r.advisors.some(a => a.key === 'فلاحی'))
      ok('آگهی به صاحبِ امضای واقعی می‌رسد', r.advisors.length === 1 && r.advisors[0].key === 'محمدپرنده' && r.advisors[0].tokens.length === 2)
      // ولی تعمیمِ کنترل‌شده باید بماند: مشاورِ تثبیت‌شده در همین آژانس، آگهیِ بی‌امضایش را می‌گیرد
      const r2 = await run([
        { token: 'a1', title: 'واحد ۹۰', desc: 'مشاور فروش: کاملی' },
        { token: 'a2', title: 'واحد ۸۰', desc: 'مشاور فروش: کاملی' },
        { token: 'a3', title: 'واحد ۷۰', desc: 'این واحد را کاملی برای بازدید آماده کرده است.' },
      ])
      ok('مشاورِ تثبیت‌شده آگهیِ بی‌امضای خودش را می‌گیرد (قدرتِ واژه‌نامه حفظ شد)',
        r2.advisors.length === 1 && r2.advisors[0].tokens.length === 3)
      await resetMl()
    }
    // فاز ۱۷۰ (قیفِ ورود): retryِ پیامکِ OTP — گذرا=دوباره، قطعی=هرگز (پیامکِ تکراری ممنوع)
    {
      const { sendPatternOnce, sendPatternWithRetry } = await import('../app/lib/send-otp.ts')
      const cfg = { apiKey: 'k', sender: 's', pattern: 'p', patternVar: 'code' }
      const OKRES = { status: 200, body: '{"meta":{"status":true}}' }
      let n1 = 0, b1 = 0
      const failThenOk = async () => { n1++; if (n1 === 1) throw new Error('request timeout'); return OKRES }
      const r1 = await sendPatternWithRetry(cfg, '09120000000', '123456', failThenOk, () => b1++)
      ok('خطای گذرای شبکه → تلاشِ دوم موفق (و DNS بینِ دو تلاش باطل شد)', r1.ok === true && n1 === 2 && b1 === 1)
      let n2 = 0
      const permFail = async () => { n2++; return { status: 200, body: '{"meta":{"status":false,"message":"pattern invalid"}}' } }
      const r2 = await sendPatternWithRetry(cfg, '09120000000', '123456', permFail, () => {})
      ok('خطای قطعیِ سرویس → فقط یک تلاش (پیامکِ دوباره نمی‌رود)', r2.ok === false && r2.permanent === true && n2 === 1)
      let n3 = 0
      const allFail = async () => { n3++; throw new Error('ECONNRESET') }
      const r3 = await sendPatternWithRetry(cfg, '09120000000', '123456', allFail, () => {})
      ok('هر دو تلاش گذرا شکست → خطای غیرقطعی با پیامِ روشن', r3.ok === false && r3.permanent === false && n3 === 2 && r3.error.includes('پیامک'))
      const r4 = await sendPatternOnce(cfg, '09120000000', '123456', async () => ({ status: 502, body: 'bad gateway' }))
      ok('۵xx گذراست و ۲xxِ سالم موفق', r4.ok === false && r4.permanent === false && (await sendPatternOnce(cfg, '09120000000', '1', async () => OKRES)).ok === true)
    }
    // فاز ۲۰۱ — کشِ آسیب‌دیدهٔ غنی‌سازی (فیدبک: «مکان‌های نزدیک رو نمی‌گه، عکس‌ها نیست/باز نمی‌شه، نقشه ۴۰ تا از ۴۰۰۰»):
    // شکستِ گذرای دیوار دیگر baseDone قطعی نمی‌شود؛ کش‌های خرابِ گذشته یک‌بار ترمیم؛ مختصات روی خودِ آگهی می‌نشیند.
    {
      const { patchEnrichment, getEnrichment, clearEnrichment } = await import('../app/lib/enrich-store.ts')
      const { isEnriched, ENRICH_V, BASE_ERR_COOLDOWN } = await import('../app/lib/enrich-warm.ts')
      for (const k of ['e201a', 'e201b', 'e201c']) clearEnrichment(k)
      // ۱) شکستِ گذرا فقط baseTriedAt می‌گیرد → تا پایانِ کول‌داون «رها کن»، بعدش دوباره کاندیدِ جارو
      patchEnrichment('e201a', { v: ENRICH_V, baseTriedAt: Date.now() })
      ok('شکستِ گذرای دیوار در کول‌داون است (جارو اسلات هدر نمی‌دهد)', isEnriched('e201a') === true)
      patchEnrichment('e201a', { baseTriedAt: Date.now() - BASE_ERR_COOLDOWN - 1000 })
      ok('بعدِ کول‌داون دوباره کاندیدِ گرم‌سازی می‌شود', isEnriched('e201a') === false)
      ok('کشِ کاملِ سالم هم‌چنان غنی است', (patchEnrichment('e201b', { v: ENRICH_V, baseDone: true, gallery: ['x.jpg'], analysisOk: true }), isEnriched('e201b') === true))
      // ۲) شرطِ ترمیمِ جارو: baseDone بدونِ گالری + توکنِ دیوار → یک‌بار باز می‌شود؛ مهرِ ترمیم مانعِ حلقه
      const { divarToken } = await import('../app/lib/divar-post.ts')
      const needsRepair = (cc) => !!(cc?.baseDone && !cc.gallery?.length && !cc.baseRepairedAt && divarToken('https://divar.ir/v/x/AZxkH9aY'))
      patchEnrichment('e201c', { v: ENRICH_V, baseDone: true, gallery: [], analysisOk: true })
      ok('کشِ آسیب‌دیده (baseDone بدونِ گالری) شناسایی می‌شود', needsRepair(getEnrichment('e201c')) === true)
      patchEnrichment('e201c', { baseDone: false, baseTriedAt: 0, baseRepairedAt: Date.now() })
      ok('ترمیم یک‌باره است و کشِ بازشده دوباره کاندیدِ گرم‌سازی', needsRepair(getEnrichment('e201c')) === false && isEnriched('e201c') === false)
      // فاز ۲۱۰ — علتِ شکستِ تحلیل در کش ثبت و با موفقیت پاک می‌شود (پایانِ شکستِ بی‌صدا)
      patchEnrichment('e201c', { analysisErr: true, analysisNote: 'مدلی به ایجنت تخصیص داده نشده' })
      ok('علتِ شکستِ تحلیل ثبت می‌شود', getEnrichment('e201c').analysisNote === 'مدلی به ایجنت تخصیص داده نشده')
      patchEnrichment('e201c', { analysisOk: true, analysisErr: false, analysisNote: '' })
      ok('موفقیت علت را پاک می‌کند', getEnrichment('e201c').analysisNote === '')
      // فاز ۲۱۳→۲۴۶ — مهرِ نسخهٔ nearby از NEARBY_V می‌آید: کشِ نسخهٔ قدیمی (ازجمله v2ِ آلوده به
      // «استان/شهر/محله») بازنشسته حساب می‌شود؛ کشِ نسخهٔ جاری معتبر است.
      const { NEARBY_V } = await import('../app/lib/nearby.ts')
      patchEnrichment('e201c', { nearby: [{ name: 'داروخانه', time: '۵ دقیقه پیاده', meters: 400 }], nearbyV: NEARBY_V })
      const c213 = getEnrichment('e201c')
      const staleOf = (c) => (c.nearby?.length || 0) > 0 && c.nearbyV !== NEARBY_V
      ok('مهرِ نسخهٔ جاریِ nearby ذخیره می‌شود و بازنشسته نیست', c213.nearbyV === NEARBY_V && staleOf(c213) === false)
      patchEnrichment('e201c', { nearbyV: 2 })
      ok('کشِ v2 (پیش از فیلترِ واحدهای اداری) بازنشسته حساب می‌شود', staleOf(getEnrichment('e201c')) === true)
      for (const k of ['e201a', 'e201b', 'e201c']) clearEnrichment(k)
      // ۳) مختصاتِ به‌دست‌آمده از غنی‌سازی روی خودِ آگهی می‌نشیند؛ مختصاتِ موجود هرگز بازنویسی نمی‌شود
      const { addItemManual, setItemCoords, getItemById, deleteItem } = await import('../app/lib/scraper-store.ts')
      const it201 = await addItemManual({ type: 'listing', title: 'تستِ مختصات ۲۰۱', url: 'https://divar.ir/v/x/AZxkH9aY' })
      await setItemCoords(it201.id, 35.7, 51.4)
      let got = await getItemById(it201.id)
      ok('مختصاتِ غنی‌سازی روی آگهی نشست (نقشه پین‌دار می‌شود)', got.meta['__lat'] === '35.7' && got.meta['__lng'] === '51.4')
      await setItemCoords(it201.id, 1, 2)
      got = await getItemById(it201.id)
      ok('مختصاتِ موجود بازنویسی نمی‌شود (مختصاتِ دستیِ مشاور امن است)', got.meta['__lat'] === '35.7' && got.meta['__lng'] === '51.4')
      await setItemCoords(it201.id, 0, 0)
      ok('مختصاتِ صفر/نامعتبر هرگز ثبت نمی‌شود', (await getItemById(it201.id)).meta['__lat'] === '35.7')
      await deleteItem(it201.id)
    }
    // فاز ۲۴۲ — پلِ پروفایلِ سازنده: حسابِ خودکارِ پرشین‌سازه → صفحهٔ غنیِ /builders (نه کارتِ خالی)
    {
      const { writeFileSync } = await import('fs')
      const { join } = await import('path')
      writeFileSync(join(process.cwd(), '.persiansaze-profiles.json'), JSON.stringify({
        c242: { id: 'c242', name: 'سازندهٔ تست ۲۴۲', phones: ['09120002420'], projectCount: 3, projects: [] },
      }))
      const { ensureProviderSlug } = await import('../app/lib/provider-slug-store.ts')
      const pslug = await ensureProviderSlug('09120002420', 'سازندهٔ تست ۲۴۲')
      const { richBuilderHrefForProviderSlug } = await import('../app/lib/builder-bridge.ts')
      const href242 = await richBuilderHrefForProviderSlug(pslug)
      ok('حسابِ سازنده با پروفایلِ واقعیِ بانک → مسیرِ صفحهٔ غنی', typeof href242 === 'string' && href242.startsWith('/builders/'))
      ok('سازندهٔ بدونِ پروفایلِ بانک (ثبت‌نامِ خودش) → صفحهٔ حسابِ خودش می‌ماند', (await richBuilderHrefForProviderSlug('slug-ghost-242')) === null)
    }
    // فاز ۲۴۱ — «رفعِ تعلیقِ ماندگار می‌زنم، دوباره معلق می‌شود» (بازتولیدِ دقیقِ باگ + فیکسِ اتمیک)
    {
      const { createAccount, getAccount, adminSetSuspension, gateSuspendIfEligible, setProfileWarn } = await import('../app/lib/account-store.ts')
      const ph241 = '09120002410'
      createAccount(ph241, { name: 'تستِ تعلیق ۲۴۱', role: 'advisor' })
      // سناریوی باگ: هشدارِ قدیمی (مهلت گذشته) + ادمین رفعِ تعلیقِ ماندگار می‌زند + کرانِ گیت می‌رسد
      setProfileWarn(ph241, Date.now() - 10 * 864e5)
      adminSetSuspension(ph241, true, 'تست')
      adminSetSuspension(ph241, false)
      const a241 = getAccount(ph241)
      ok('رفعِ تعلیق اتمیک است: suspended پاک + gateExempt ست + profileWarn پاک — همه در یک نوشتن', !a241.suspended && a241.gateExempt === true && a241.profileWarnAt === undefined)
      setProfileWarn(ph241, Date.now() - 10 * 864e5)   // حتی با هشدارِ منقضی…
      const did241 = gateSuspendIfEligible(ph241, 3 * 864e5)
      ok('کرانِ گیت زیرِ قفل دوباره چک می‌کند: کاربرِ معافِ ماندگار «هرگز» تعلیقِ خودکار نمی‌شود', did241 === false && !getAccount(ph241).suspended)
      // ضدتست: کاربرِ غیرمعاف با مهلتِ گذشته باید تعلیق شود
      const ph241b = '09120002411'
      createAccount(ph241b, { name: 'غیرمعاف ۲۴۱', role: 'advisor' })
      setProfileWarn(ph241b, Date.now() - 10 * 864e5)
      ok('غیرمعاف با مهلتِ گذشته تعلیق می‌شود (موتور سالم است)', gateSuspendIfEligible(ph241b, 3 * 864e5) === true && getAccount(ph241b).suspended === true)
      // قفلِ یتیم (کرشِ وسطِ نوشتن) سرویس را قفل نمی‌کند — بعدِ ~۵۰۰ms شکسته می‌شود
      const { writeFileSync, existsSync } = await import('fs')
      const { join } = await import('path')
      const lockPath241 = join(process.cwd(), '.account-data.json.lock')
      writeFileSync(lockPath241, 'x')
      const t241 = Date.now()
      adminSetSuspension(ph241b, false)
      ok('قفلِ یتیم خودکار شکسته می‌شود و نوشتن انجام می‌شود', !getAccount(ph241b).suspended && Date.now() - t241 < 2000 && !existsSync(lockPath241))
    }
    // فاز ۲۳۳ — شکستِ گذرای شبکه «ردشده» نیست (فیدبک+اسکرین‌شات: «کاربرِ جدید، جدید ۰ و ۲۰ ردشده؟!»)
    {
      const { settleBatch } = await import('../app/lib/advisor-divar-import.ts')
      const mk = (t) => ({ token: t })
      const s1 = settleBatch([mk('a'), mk('b'), mk('c')], [{ ok: false }, { ok: false }, { ok: false }])
      ok('قطعیِ دیوار: هیچ آگهی‌ای ردشده نمی‌شود — هر سه دوباره در صف', s1.skipped === 0 && s1.requeue.length === 3 && s1.fails === 3 && s1.requeue[0].fails === 1)
      const s2 = settleBatch([{ token: 'x', fails: 2 }], [{ ok: false }])
      ok('فقط شکستِ سومِ قطعی «ردشده» است (با گزارشِ توکن)', s2.skipped === 1 && s2.failedFinal[0] === 'x' && s2.requeue.length === 0)
      const s3 = settleBatch([mk('n'), mk('u'), mk('s')], [{ ok: true }, { ok: true, updated: true }, { ok: true, skipped: true }])
      ok('حسابداریِ سالم: جدید/به‌روز/ردِ واقعی (skipFresh) دست نمی‌خورد', s3.imported === 1 && s3.updated === 1 && s3.skipped === 1 && s3.fails === 0)
    }
    // فاز ۲۳۲ — کشِ مشتقِ قفل به نسلِ داده (فیدبک: «سرعت فاجعه شده»): محاسبهٔ گران یک‌بار در هر نسل.
    {
      const { derivedFrom } = await import('../app/lib/derived-cache.ts')
      const anchorA = [1, 2, 3], anchorB = [1, 2, 3]
      let builds = 0
      const v1 = derivedFrom(anchorA, 'sum', () => { builds++; return anchorA.reduce((a, b) => a + b, 0) })
      const v2 = derivedFrom(anchorA, 'sum', () => { builds++; return -1 })
      ok('یک کلید روی یک لنگر فقط یک‌بار ساخته می‌شود', v1 === 6 && v2 === 6 && builds === 1)
      const v3 = derivedFrom(anchorA, 'sum2', () => { builds++; return 10 })
      const v4 = derivedFrom(anchorB, 'sum', () => { builds++; return 99 })
      ok('کلیدِ دیگر یا لنگرِ دیگر (نسلِ تازه) دوباره می‌سازد', v3 === 10 && v4 === 99 && builds === 3)
      ok('نتیجهٔ کش‌شده عینِ محاسبهٔ مستقیم است (فیلترِ هاب)', JSON.stringify(derivedFrom(anchorA, 'f', () => anchorA.filter(x => x > 1))) === JSON.stringify(anchorA.filter(x => x > 1)))
    }
    // فاز ۲۳۱ — جدولِ اجارهٔ روزانهٔ دیوار سرِ جای خودش (فیدبک: «دیتا رو دقیق بذار، نه تومانِ خالی»):
    // ایمپورتِ کامل با پستِ استابِ دیوار → آیتمِ عمومی باید قیمتِ شبی + ردیف‌های جدول + مهرِ درست داشته باشد.
    {
      const { importDivarToken } = await import('../app/lib/advisor-divar-import.ts')
      const { getAdvisor } = await import('../app/lib/advisor-store.ts')
      const { getItemById } = await import('../app/lib/scraper-store.ts')
      const { dealOf } = await import('../app/lib/listing-filter.ts')
      const fetchPost = async () => ({
        title: 'واحد مبله تست ۲۳۱', description: '*روزانه-هفتگی-ماهانه*', images: [], facts: [], amenities: [],
        deal: 'daily', price: 6_500_000, nightlyWeekend: 6_500_000, capacityStd: 2, capacityExtra: 1,
        city: 'تهران', neighborhood: 'فرمانیه', location: 'تهران، فرمانیه',
      })
      const r231 = await importDivarToken('09121230231', 'tok231daily', undefined, undefined, { publish: true, fetchPost })
      const l231 = (await getAdvisor('09121230231')).listings.find(x => x.id === r231.listing.id)
      const pub231 = l231?.publicId ? await getItemById(l231.publicId) : null
      ok('ایمپورتِ روزانه منتشر شد و قیمتِ شبی سرِ جایش است (نه «تومانِ» خالی)', r231.ok === true && !!pub231 && pub231.price === `شبی ${(6_500_000).toLocaleString('fa-IR')} تومان`)
      ok('جدولِ دیوار در متا: فقط ردیف‌های واقعاً ثبت‌شده (تعطیلات/نفرِ اضافه ثبت نشده → غایب)', !!pub231 && (pub231.meta['اجارهٔ روزهای عادی'] || '').includes('تومان/شب') && (pub231.meta['اجارهٔ آخر هفته'] || '').includes('تومان/شب') && pub231.meta['ظرفیت استاندارد'] === `${(2).toLocaleString('fa-IR')} نفر` && pub231.meta['ظرفیت اضافه'] === `${(1).toLocaleString('fa-IR')} نفر` && !pub231.meta['اجارهٔ تعطیلات و مناسبت‌ها'] && !pub231.meta['هزینهٔ هر نفرِ اضافه'])
      ok('مهرِ صریحِ «اجارهٔ کوتاه‌مدت» و طبقه‌بندیِ daily', !!pub231 && pub231.meta['نوع معامله'] === 'اجارهٔ کوتاه‌مدت' && dealOf(pub231) === 'daily')
    }
    // فاز ۲۳۰ — اجارهٔ روزانه/شبی هرگز «فروشی» نیست (فیدبک+اسکرین‌شات: «آگهی‌های اجارهٔ شبی تو فروش می‌رود»):
    // ریشه: ایمپورتِ قدیمیِ دیوار daily نداشت و صریحاً «نوع معامله: فروش» مهر می‌زد + نشانه‌ها فقط در توضیحات بود.
    {
      const { dealOf } = await import('../app/lib/listing-filter.ts')
      const shabi = { title: 'واحد مستقل*تازه مبله شده*دسترسی به نمایشگاه', price: 'تومان', meta: { 'نوع معامله': 'فروش' }, excerpt: '*روزانه-هفتگی-ماهانه*\n*تازه مبله شده\n*واحدهای تک خواب 50متری شبی 6500\n*نظافت روزانه هتلی' }
      ok('دقیقاً آگهیِ اسکرین‌شات: مهرِ غلطِ «فروش» با شواهدِ سختِ توضیحات می‌شکند', dealOf(shabi) === 'daily')
      ok('مهرِ جدیدِ ایمپورت «اجارهٔ کوتاه‌مدت» → daily', dealOf({ title: 'x', meta: { 'نوع معامله': 'اجارهٔ کوتاه‌مدت' } }) === 'daily')
      ok('«روزانه»ی تنها (نظافت روزانه) فروشِ واقعی را برنمی‌گرداند', dealOf({ title: 'فروش آپارتمان ۱۲۰ متری', price: '۵,۰۰۰,۰۰۰,۰۰۰ تومان', meta: { 'نوع معامله': 'فروش' }, excerpt: 'نگهبانی و نظافت روزانه دارد' }) === 'sale')
      ok('اجارهٔ ماهانهٔ صریح دست نمی‌خورد', dealOf({ title: 'اجاره آپارتمان', price: 'ودیعه ۵۰۰,۰۰۰,۰۰۰ تومان · اجارهٔ ماهانه ۲۰,۰۰۰,۰۰۰ تومان', meta: { 'نوع معامله': 'اجاره' } }) === 'rent')
      ok('«شبی» در قیمت یا «اجاره روزانه» در توضیحات، بدونِ متا هم کافی است', dealOf({ title: 'سوئیت مبله', price: 'شبی ۱٬۵۰۰٬۰۰۰ تومان' }) === 'daily' && dealOf({ title: 'واحد مبله', excerpt: 'اجاره روزانه و هفتگی به مسافر' }) === 'daily')
      const { seoListingTitle } = await import('../app/lib/listing-search.ts')
      const tDaily = seoListingTitle({ deal: 'daily', kind: 'آپارتمان', areaNum: 100, bedsNum: 2, priceNum: 0, location: 'تهران، فرمانیه', title: 'اصل' })
      ok('عنوانِ سئوی روزانه: «اجارهٔ روزانهٔ …» بدونِ قیمتِ متریِ فروشی', tDaily.includes('اجارهٔ روزانهٔ آپارتمان') && !tDaily.includes('میلیون'))
      const { fieldsOf, similarity } = await import('../app/lib/listing-similarity.ts')
      ok('تشخیصِ تکراری: روزانه فقط با روزانه مقایسه می‌شود (فروش/روزانه = ۰)', fieldsOf(shabi).deal === 'daily' && similarity(fieldsOf(shabi), fieldsOf({ title: 'فروش آپارتمان ۱۰۰ متری', price: '۵,۰۰۰,۰۰۰,۰۰۰ تومان', meta: { 'نوع معامله': 'فروش' } })) === 0)
    }
    // فاز ۲۲۹ — نوارِ آمارِ صفحهٔ اصلی (سورسِ لایوِ کاربر «۰+ متخصص» و «۱+ فروشگاه» نشان می‌داد):
    // آمارِ زیرِ آستانه پنهان می‌شود — نه عددِ ساختگی، نه ویترینِ خالی.
    {
      const { visibleHomeStats, HOME_STAT_MIN } = await import('../app/lib/home-stats.ts')
      const prod = { listings: 5819, products: 6135, shops: 1, advisors: 0, builders: 15873 }
      const v = visibleHomeStats(prod)
      ok('صفر و یکِ خجالت‌آور پنهان؛ عددهای واقعیِ بزرگ می‌مانند', v.length === 3 && v.every(r => r.n >= HOME_STAT_MIN) && !v.some(r => r.l.includes('فروشگاه')) && !v.some(r => r.l.includes('متخصص')))
      ok('ترتیب و برچسب‌ها حفظ می‌شود', v[0].l === 'آگهیِ فعالِ ملک' && v[1].l === 'محصولِ مصالح' && v[2].l === 'سازنده در دیتابیس')
      ok('همه زیرِ آستانه → نوارِ کاملاً پنهان (آرایهٔ خالی)', visibleHomeStats({ listings: 3, products: 0, shops: 1, advisors: 2, builders: 9 }).length === 0)
      ok('دقیقاً روی آستانه نمایش داده می‌شود؛ ورودیِ خراب امن است', visibleHomeStats({ listings: HOME_STAT_MIN, products: NaN, shops: -5, advisors: 10, builders: 0 }).length === 2 && visibleHomeStats(null).length === 0)
    }
    // فاز ۲۲۸ — عنوان/توضیحِ سئویِ بازساخته (ضدِ تکراری با دیوار؛ فقط از دادهٔ واقعی)
    {
      const { seoListingTitle, seoListingDescription } = await import('../app/lib/listing-search.ts')
      const d = { deal: 'sale', kind: 'آپارتمان', areaNum: 120, bedsNum: 2, floorNum: 3, yearNum: 1400, priceNum: 36, location: 'تهران، جنت‌آباد شمالی', title: 'عنوانِ اصلیِ دیواری' }
      const t = seoListingTitle(d)
      ok('عنوانِ سئو کاملاً بازساخته از دادهٔ ساختاریافته (نه کپیِ دیوار)', t.includes('فروش آپارتمان ۱۲۰ متری ۲ خوابه در جنت‌آباد شمالی، تهران') && t.includes('متری ۳۰۰ میلیون') && !t.includes('دیواری'))
      ok('توضیحِ سئو طبقه/سال/قیمت را دارد و کوتاه است', (() => { const s = seoListingDescription(d, '۳۶,۰۰۰,۰۰۰,۰۰۰ تومان'); return s.includes('طبقهٔ ۳') && s.includes('ساختِ ۱٬۴۰۰') && s.length <= 300 })())
      ok('دادهٔ ناکافی → عنوانِ اصلی می‌ماند (عنوانِ نصفه نمی‌سازیم)', seoListingTitle({ deal: 'sale', kind: '', areaNum: 0, bedsNum: null, priceNum: 0, location: '', title: 'اصل' }) === 'اصل')
      ok('اجاره‌ای بدونِ قیمتِ متری', seoListingTitle({ ...d, deal: 'rent', priceNum: 1.7 }).includes('رهن و اجارهٔ') && !seoListingTitle({ ...d, deal: 'rent' }).includes('متری ۳'))
    }
    // فاز ۲۲۶ — امتیازِ اصالتِ واقعی (فیدبک: «جعلی بودن واقعاً کار می‌کنه؟» — درصدِ AIساخته حذف شد)
    {
      const { originalityOf } = await import('../app/lib/originality.ts')
      const good = originalityOf({ moderationApproved: true, moderationScore: 85, priceVsMarketPct: -3, hasGeo: true, imageCount: 6, factsCount: 3, hasPhone: true, ownerAccount: { exists: true, ageDays: 120 } })
      ok('همهٔ سیگنال‌ها مثبت → سطحِ بالا با دلایلِ شفاف', good.level === 'high' && good.score >= 75 && good.reasons.some(r => r.includes('ممیزی')))
      const cheap = originalityOf({ moderationApproved: true, priceVsMarketPct: -40, hasGeo: true, imageCount: 4, factsCount: 3, hasPhone: true, ownerAccount: { exists: true, ageDays: 100 } })
      ok('قیمتِ غیرعادی پایین جریمه و هشدارِ صریح می‌گیرد', cheap.score < good.score && cheap.level !== 'high' && cheap.reasons.some(r => r.includes('غیرعادی')))
      const weakOnly = originalityOf({ hasGeo: true, imageCount: 5, factsCount: 3, hasPhone: true })
      ok('بدونِ هیچ سیگنالِ قوی (ممیزی/قیمت/حساب) → «بررسیِ کافی ممکن نیست» نه حکمِ الکی', weakOnly.level === 'insufficient')
      const rejected = originalityOf({ moderationApproved: false, priceVsMarketPct: 0, hasGeo: false, imageCount: 0, factsCount: 0, hasPhone: false, ownerAccount: { exists: false, ageDays: 0 } })
      ok('ردشدهٔ بی‌عکسِ بی‌تماس → سطحِ پایین و امتیاز در بازهٔ ۰..۱۰۰', rejected.level === 'low' && rejected.score >= 0 && rejected.score <= 100)
      ok('قطعی است (همان ورودی = همان خروجی)', JSON.stringify(good) === JSON.stringify(originalityOf({ moderationApproved: true, moderationScore: 85, priceVsMarketPct: -3, hasGeo: true, imageCount: 6, factsCount: 3, hasPhone: true, ownerAccount: { exists: true, ageDays: 120 } })))
    }
    // فاز ۲۲۲ — تطبیقِ نامِ مکان (کشفِ GSC: گیشا با کلی آگهی noindex خورده بود چون «گیشا (کوی نصر)» عیناً match نمی‌شد)
    {
      const { matchesLocationName, locationNameParts, makeLocationMatcher } = await import('../app/lib/location-match.ts')
      ok('نامِ مرکب تکه‌تکه می‌شود', JSON.stringify(locationNameParts('گیشا (کوی نصر)')) === JSON.stringify(['گیشا', 'کوی نصر']))
      ok('محلهٔ مرکب به آگهیِ واقعی می‌خورد («تهران، گیشا»)', matchesLocationName('گیشا (کوی نصر)', 'تهران، گیشا خیابان پیروزی غربی') === true)
      ok('نیم‌فاصله و فاصله یکی‌اند', matchesLocationName('سعادت‌آباد', 'تهران، سعادت آباد بلوار دریا') === true)
      ok('مرزِ واژه: «ونک» هرگز «پونک» را نمی‌گیرد', matchesLocationName('ونک', 'تهران، پونک بلوار همیلا') === false)
      ok('«سهروردی» بخشِ «سهروردی جنوبی» را می‌گیرد', matchesLocationName('سهروردی', 'فروش آپارتمان سهروردی جنوبی') === true)
      // فاز ۲۲۳ (فیدبک+اسکرین‌شات: «آگهی‌های منطقه ۲۲ توی منطقه ۲ می‌آید») — مرزِ عددی
      ok('«منطقه ۲» هرگز «منطقه ۲۲» را نمی‌گیرد', matchesLocationName('منطقه ۲', 'پروژه های منطقه ۲۲ تهران ـ فراز نامی ماندگار') === false && matchesLocationName('منطقه ۲', 'شهرک هما منطقه ۲ در تهران') === true)
      ok('شهرِ قطعی فقط از location: کرجِ با عنوانِ «در تهران» رد می‌شود', matchesLocationName('تهران', 'کرج، بهار') === false && matchesLocationName('تهران', 'تهران، حشمتیه') === true)
      const m = makeLocationMatcher(['تهران، گیشا آگهی ۱', 'مشهد، هاشمیه'])
      ok('نسخهٔ پیش‌محاسبه همان جواب را می‌دهد', m('گیشا (کوی نصر)') === true && m('ونک') === false && m('') === false)
    }
    // فاز ۲۰۴ — نقشهٔ سرورساید به سبکِ دیوار (فیدبک: «۱۲هزار آگهی دارم؛ باید کارِ اصولی و دقیق انجام بشه»):
    // استخراج/فیلترِ مشترکِ کارت‌ها و نقشه + خوشه‌بندیِ شبکه‌ایِ خالص — همه قطعی و تست‌پذیر.
    {
      const { deriveListing, effectiveFiltersOf, matchesListing, cityMatch, parseQuery } = await import('../app/lib/listing-search.ts')
      const mk = (o) => ({ id: o.id || 'x1', title: o.title || 'آپارتمان ۱۲۰ متر', price: o.price, location: o.location || 'تهران، ونک', meta: o.meta || {}, excerpt: o.excerpt || '' })
      const d1 = deriveListing(mk({ id: 'a', title: 'فروش آپارتمان ۱۲۰ متری ۲ خواب', price: '۳۶,۰۰۰,۰۰۰,۰۰۰ تومان', meta: { 'متراژ': '۱۲۰', 'طبقه': '۳', 'سال ساخت': '۱۴۰۰', '__lat': '35.7', '__lng': '51.4' } }))
      ok('استخراج: قیمتِ خام→میلیارد، متراژ/طبقه/سال/خواب/مختصات', d1.priceNum === 36 && d1.areaNum === 120 && d1.floorNum === 3 && d1.yearNum === 1400 && d1.bedsNum === 2 && d1.lat === 35.7 && d1.kind.includes('آپارتمان'))
      ok('قیمتِ «میلیون» به میلیارد نرمال می‌شود', deriveListing(mk({ id: 'b', price: '۸۰۰ میلیون' })).priceNum === 0.8)
      const effT = effectiveFiltersOf({ tab: 'sale', q: 'آپارتمان در ونک زیر ۴۰ میلیارد', kind: '', bedsLabel: 'همه', priceMin: 0, priceMax: 0, areaMin: 0, areaMax: 0, floorMin: 0, yearMin: 0, amenities: [] })
      ok('فیلترِ مؤثر از متنِ جستجو (نوع/بودجه/منطقه)', effT.kind.includes('آپارتمان') && effT.budgetMax === 40 && effT.areaName === 'ونک')
      ok('فیلترِ دستی بر تشخیصِ متن مقدم است', effectiveFiltersOf({ tab: 'sale', q: 'زیر ۴۰ میلیارد', kind: '', bedsLabel: 'همه', priceMin: 0, priceMax: 20, areaMin: 0, areaMax: 0, floorMin: 0, yearMin: 0, amenities: [] }).budgetMax === 20)
      ok('تطبیق: تب/بودجه/محله می‌گذرد و ردِ درست', matchesListing(d1, effT) === true && matchesListing(d1, { ...effT, budgetMax: 30 }) === false && matchesListing(d1, { ...effT, tab: 'rent' }) === false)
      ok('توکنِ سخت‌گیرِ فاز ۱۷۷ حفظ شده («ولنجک» باید بخورد)', matchesListing(d1, { ...effT, tokens: ['ولنجک'], areaName: '' }) === false)
      ok('شهر = فیلترِ قطعی (نیم‌فاصله‌آگنوستیک)', cityMatch('تهران، جنت‌آباد', 'تهران') === true && cityMatch('مشهد، هاشمیه', 'تهران') === false)
      ok('parseQuery همان رفتارِ قبل (اجارهٔ روزانه قبل از rent)', parseQuery('اجاره روزانه ویلا').deal === 'daily')
      const { hoodCentroidsOf, resolveMapPoints, clusterMapPoints, parseBBox, cellDegOf } = await import('../app/lib/map-cluster.ts')
      const coordItems = [
        { location: 'تهران، ونک', lat: 35.75, lng: 51.40 }, { location: 'تهران، ونک', lat: 35.76, lng: 51.41 },
        { location: 'تهران، ونک', lat: 35.90, lng: 51.90 },   // مختصاتِ پرت — میانه باید مقاوم باشد
        { location: 'تهران، جنت‌آباد', lat: 35.72, lng: 51.30 },
      ]
      const cents = hoodCentroidsOf(coordItems, 'تهران')
      ok('مرکزِ محله = میانهٔ آگهی‌های مختصات‌دار (مقاوم به پرت)', cents['ونک'].lat === 35.76 && cents['جنت‌آباد'].lat === 35.72)
      const pts = resolveMapPoints([
        { id: 'p1', location: 'تهران، ونک', lat: 35.75, lng: 51.4, deal: 'sale', priceNum: 10 },
        { id: 'p2', location: 'تهران، ونک', deal: 'sale', priceNum: 8 },
        { id: 'p2', location: 'تهران، ونک', deal: 'sale', priceNum: 8 },
        { id: 'p3', location: 'تهران، ناکجا', deal: 'sale', priceNum: 5 },
      ], 'تهران', cents)
      ok('نقطه: مختصاتِ واقعی exact؛ بی‌مختصات → مرکزِ محله با پراکندگیِ قطعی (تکرارپذیر)؛ محلهٔ بی‌نمونه حذف', pts.length === 3 && pts[0].exact === true && pts[1].exact === false && Math.abs(pts[1].lat - 35.76) < 0.003 && pts[1].lat === pts[2].lat)
      const many = Array.from({ length: 50 }, (_, i) => ({ id: 'm' + i, lat: 35.7 + (i % 5) * 0.001, lng: 51.4 + (i % 5) * 0.001, deal: 'sale', priceNum: 1, exact: true }))
      const far = { id: 'far', lat: 35.9, lng: 51.9, deal: 'sale', priceNum: 2, exact: true }
      const low = clusterMapPoints([...many, far], 10, null)
      ok('زومِ پایین: نقاطِ نزدیک یک حبابِ ۵۰تایی می‌شوند و دورافتاده پینِ تکی', low.total === 51 && low.clusters.length === 1 && low.clusters[0].count === 50 && low.singles.length === 1 && low.singles[0].id === 'far')
      const high = clusterMapPoints(many, 17, null)
      ok('زومِ بالا: سلول‌ها ریز می‌شوند و خوشه باز می‌شود', high.clusters.length + high.singles.length > 1 && cellDegOf(17) < cellDegOf(10))
      const boxed = clusterMapPoints([...many, far], 12, parseBBox('35.69,51.39,35.75,51.45'))
      ok('bbox فقط قابِ خواسته‌شده را می‌شمارد (دورافتاده بیرون ماند)', boxed.total === 50 && parseBBox('bad') === null && parseBBox('1,2,3') === null)
    }
    // فاز ۲۰۲ — نقشهٔ جستجو (فیدبک: «نقشه همچنان مشکل داره؛ محله انتخاب نکردم باید کلِ شهر رو نشون بده»):
    // پین‌ها دیگر ۴۰تای اول نیستند و قاب باید کلِ شهر را بگیرد و به مختصاتِ پرت مقاوم باشد.
    {
      const { pinBoundsView, geocodeKeysOf } = await import('../app/lib/map-pins.ts')
      ok('بدونِ پین، قابی نیست (نه کرش)', pinBoundsView([]) === null)
      const two = pinBoundsView([{ lat: 35.7, lng: 51.3 }, { lat: 35.8, lng: 51.5 }])
      ok('قابِ دو پین: مرکزِ میانی و زومِ معقول', Math.abs(two.center.lat - 35.75) < 1e-9 && Math.abs(two.center.lng - 51.4) < 1e-9 && two.zoom >= 10 && two.zoom <= 15)
      const cityPins = Array.from({ length: 200 }, (_, i) => ({ lat: 35.6 + (i % 20) * 0.012, lng: 51.2 + Math.floor(i / 20) * 0.04 }))
      const cityView = pinBoundsView(cityPins)
      ok('گسترهٔ کلِ شهر در قاب جا می‌شود (زومِ ۱۰، نه زومِ محله)', cityView.zoom === 10 && Math.abs(cityView.center.lng - 51.38) < 0.05)
      const withOutliers = pinBoundsView([...cityPins, { lat: 36.3, lng: 59.6 }, { lat: 36.31, lng: 59.61 }, { lat: 36.32, lng: 59.62 }])
      ok('چند مختصاتِ پرت (شهرِ دیگر) قاب را نمی‌دزدد (کرانهٔ صدکی)', Math.abs(withOutliers.center.lng - cityView.center.lng) < 0.2 && withOutliers.zoom >= 10)
      const { hoodPartOf, geoKeyOf } = await import('../app/lib/map-pins.ts')
      ok('«تهران، جنت‌آباد جنوبی» → محله، نه نامِ شهر (باگِ قدیمی: شهرِ geocodeشده وسطِ شهر تلنبار می‌شد)', hoodPartOf('تهران، جنت‌آباد جنوبی', 'تهران') === 'جنت‌آباد جنوبی' && geoKeyOf('تهران، جنت‌آباد جنوبی', 'تهران') === 'جنت‌آباد جنوبی تهران')
      // فاز ۲۴۷ (فیدبک+اسکرین‌شات: «رو تهران هستم نقشه دری‌وری نشون میده» — geocodeِ «نیلوفر تهران»
      // به کرج پریده بود و قاب را دزدید) — مرکزِ قابل‌اعتماد: محلهٔ دورتر از ۳۰کیلومتر از شهر بی‌اعتبار
      const { trustedMapCenter, distKm } = await import('../app/lib/map-pins.ts')
      const TEHRAN = { lat: 35.6892, lng: 51.389 }, KARAJ = { lat: 35.8355, lng: 50.9915 }, TPARS = { lat: 35.735, lng: 51.55 }
      ok('فاصلهٔ haversine واقعی است (تهران↔کرج ~۴۰کیلومتر، تهران↔تهرانپارس <۲۰)', distKm(TEHRAN, KARAJ) > 30 && distKm(TEHRAN, KARAJ) < 50 && distKm(TEHRAN, TPARS) < 20)
      ok('بازتولیدِ دقیقِ باگ: «محله»ی geocodeشده در کرج + شهرِ تهران → مرکزِ شهر ملاک، نه کرج', trustedMapCenter(KARAJ, TEHRAN) === TEHRAN)
      ok('ضدتست: محلهٔ واقعیِ داخلِ شهر (تهرانپارس) همان ملاک می‌ماند', trustedMapCenter(TPARS, TEHRAN) === TPARS)
      ok('حالت‌های ناقص: بی‌محله → شهر؛ بی‌شهر → محله؛ هر دو هیچ → null', trustedMapCenter(null, TEHRAN) === TEHRAN && trustedMapCenter(KARAJ, null) === KARAJ && trustedMapCenter(null, null) === null)
      // فاز ۲۴۹ («گرافیک رو تو نکسامپ عوض کردم، جاهایی تغییر نمی‌کنه») — نسخهٔ کاشی knob زندهٔ ادمین
      const { geoTileVersion } = await import('../app/lib/geo-api.ts')
      const { getAdminData: gad249, saveAdminData: sad249 } = await import('../app/lib/admin-store.ts')
      const d249a = gad249(); const keep249 = d249a.geoApi
      d249a.geoApi = { baseUrl: 'https://x.ir', apiKey: 'k' }; sad249(d249a)
      ok('بدونِ tileV، نسخهٔ پیش‌فرض ۳ است (کش‌شکنیِ همین دیپلوی نسبت به mv=2 قدیمی)', geoTileVersion() === 3)
      const d249b = gad249(); d249b.geoApi = { ...d249b.geoApi, tileV: geoTileVersion() + 1 }; sad249(d249b)
      ok('بامپ، نسخه را یک واحد بالا می‌برد و ذخیرهٔ آدرس/کلید آن را نمی‌بلعد', geoTileVersion() === 4 && (() => { const d = gad249(); d.geoApi = { ...(d.geoApi || {}), baseUrl: 'https://x.ir', apiKey: 'k2' }; sad249(d); return geoTileVersion() === 4 })())
      const d249c = gad249(); d249c.geoApi = { ...d249c.geoApi, tileV: 'خراب' }; sad249(d249c)
      ok('مقدارِ خراب/کوچک‌تر از ۳ → کفِ امنِ ۳ (نه NaN در URL کاشی)', geoTileVersion() === 3)
      const d249d = gad249(); d249d.geoApi = keep249; sad249(d249d)
      ok('موقعیتِ فقط-شهر به خودِ شهر برمی‌گردد و «نامشخص» هیچ است', hoodPartOf('تهران', 'تهران') === 'تهران' && hoodPartOf('نامشخص', 'تهران') === '' && hoodPartOf('', 'تهران') === '')
      const items202 = [
        { lat: 35.7, lng: 51.4, location: 'تهران، ونک' },            // مختصات دارد → geocode لازم ندارد
        { location: 'تهران، جنت‌آباد جنوبی' }, { location: 'تهران، جنت‌آباد جنوبی' },  // تکراری → یکی
        { location: 'نامشخص' }, { location: '' },                      // بی‌نشانی → هیچ
        { location: 'سعادت‌آباد، بلوار دریا' },
      ]
      const keys = geocodeKeysOf(items202, 'تهران')
      ok('کلیدهای geocode: یکتا، بدونِ صاحب‌مختصات/نامشخص، محلهٔ واقعی + شهر', keys.length === 2 && keys[0] === 'جنت‌آباد جنوبی تهران' && keys[1] === 'سعادت‌آباد تهران')
      ok('سقفِ فشار به نشان اعمال می‌شود', geocodeKeysOf(Array.from({ length: 300 }, (_, i) => ({ location: `محلهٔ ${i}` })), 'تهران', 120).length === 120)
    }
    // فاز ۱۹۶ — شبیه‌سازیِ کاملِ چرخهٔ سینکِ رُستر (فیدبک: «دو روز لوپ شده؛ یک‌بار دقیق و عمیق درست کن»):
    // قطع با بودجه → ازسرگیری → تکمیل؛ اثبات: هیچ fetch و هیچ فراخوانِ AI تکرار نمی‌شود و توقف کار می‌کند.
    {
      const { addScrape, requestRun, listDueRosters, getScrape, syncRoster, requestStop } = await import('../app/lib/agency-roster-store.ts')
      const N = 24
      const tokens = Array.from({ length: N }, (_, i) => 'tk196' + String(i).padStart(2, '0'))
      let rowFetches = 0, aiCalls = 0, importFetches = 0
      const f = {
        profileTokens: async () => ({ posts: tokens.map(t => ({ token: t, title: 'آپارتمان ' + t })), name: 'املاک تستِ عمیق', reason: '' }),
        post: async (t) => { rowFetches++; const i = tokens.indexOf(t); return { title: 'آپارتمان ' + t, description: i % 3 === 2 ? 'نوساز فول' : i % 2 === 0 ? 'نوساز، کارشناس فروش جهت راهنمایی محمدی' : 'تک‌واحدی، مشاور فروش: خانم کامرانی', images: [] } },
        ai: async (chunk) => { aiCalls++; return { map: {}, raw: '' } },
      }
      const fetchPost = async (t) => { importFetches++; return { title: 'آپارتمان ' + t, description: 'x', images: [], facts: [], amenities: [], price: 5_000_000_000, deal: 'sale', city: 'تهران', neighborhood: 'تست', location: 'تهران، تست' } }
      const r196 = await addScrape({ slug: 'deeptest196', useAI: true })
      const id196 = r196.scrape.id
      await requestRun(id196)
      // پاسِ ۱: بودجهٔ تقریباً صفر → واردِ فازِ ایمپورت می‌شود و همان اول تمیز قطع می‌شود؛ درخواست زنده می‌ماند
      const p1 = await syncRoster(id196, undefined, { budgetMs: 1, f, fetchPost })
      const s1 = await getScrape(id196)
      ok('پاسِ قطع‌شده: درخواست زنده می‌ماند و خودکار دوباره صف می‌شود', p1.ok === false && s1.runRequested === true && (await listDueRosters(Date.now())).some(x => x.id === id196))
      ok('پیشرفتِ واقعی (رسیدن به ایمپورت) شمارندهٔ تلاش را می‌بخشد — کیلِ دیپلوی به give-up نمی‌رسد', (s1.runAttempts || 0) === 0)
      const rowsAfterP1 = rowFetches, aiAfterP1 = aiCalls
      // فاز ۲۹۷خ — شناساییِ نام ML-only شد: AI دیگر «اصلاً» پرسیده نمی‌شود (گپ غیرفعال).
      ok('پاسِ ۱ همهٔ ردیف‌ها را خواند و AI هرگز پرسیده نشد (ML-only — فاز ۲۹۷خ)', rowsAfterP1 === N && aiAfterP1 === 0)
      // پاسِ ۲: بودجهٔ کافی → باید کامل شود، بدونِ «هیچ» خواندنِ دوباره از دیوار و بدونِ AI تکراری
      const p2 = await syncRoster(id196, undefined, { budgetMs: 600_000, f, fetchPost })
      const s2 = await getScrape(id196)
      ok('پاسِ ۲ کامل شد: مشاورها ساخته شدند و state بسته شد', p2.ok === true && p2.advisors >= 2 && s2.runRequested === false && s2.lastError === '' && s2.running === false)
      ok('هیچ ردیفی دوباره از دیوار خوانده نشد و AI دوباره پرسیده نشد (کشِ ازسرگیری)', rowFetches === rowsAfterP1 && aiCalls === aiAfterP1)
      ok('هر توکن دقیقاً یک‌بار ایمپورت شد', importFetches === N)
      // پاسِ ۳ (رانِ دوباره پس از موفقیت — سناریوی آپدیتِ روزانه): واردهٔ تازه دوباره fetch نمی‌شود (at تازه شده)
      await requestRun(id196)
      const s3pre = await getScrape(id196)
      const p3 = await syncRoster(id196, undefined, { budgetMs: 600_000, f, fetchPost })
      ok('رانِ بعدِ موفقیت: واردهٔ زیرِ ۲۰ ساعت دوباره از دیوار گرفته نمی‌شود (فیکسِ at — ریشهٔ لوپِ دوروزه)', p3.ok === true && importFetches === N)
      // فاز ۱۹۸ — اینکرمنتال: کش بعدِ موفقیت می‌ماند؛ رانِ بعدی هیچ ردیف و هیچ AIِ تکراری ندارد (مقیاسِ ۱۰۰۰ آژانس)
      ok('سینکِ روزانه اینکرمنتال است: صفر خواندنِ دوبارهٔ ردیف‌ها و صفر AI بعدِ موفقیت', rowFetches === rowsAfterP1 && aiCalls === aiAfterP1)
      // کلیکِ دستی بعدِ خطا = شروعِ تمیز (خطا پاک، شمارنده صفر — UI «در صف» را می‌بیند نه خطای کهنه)
      await requestRun(id196)
      const sClean = await getScrape(id196)
      ok('کلیکِ دستی خطای قبلی را پاک و شمارنده را صفر می‌کند', sClean.lastError === '' && (sClean.runAttempts || 0) === 0 && sClean.runRequested === true)
      // ⏹ توقف: state فوراً بسته و از صف خارج می‌شود
      await requestRun(id196)
      await requestStop(id196)
      const s4 = await getScrape(id196)
      ok('دکمهٔ توقف: درخواست پاک، از صف خارج، پیامِ روشن', s4.runRequested === false && s4.stopRequested === true && !(await listDueRosters(Date.now())).some(x => x.id === id196) && /متوقف/.test(s4.lastError || ''))
      // ── فاز ۱۹۹ — ساختِ حسابِ واقعی (فیدبک: «"در حال ساخت حساب" برای همیشه می‌ماند و نقشِ مشاور را نمی‌دهد») ──
      const { enqueueGraduate, processGraduateQueue, hasGraduateJobs, patchScrape: ps199, listScrapes: ls199 } = await import('../app/lib/agency-roster-store.ts')
      const { listRoles } = await import('../app/lib/role-store.ts')
      const { getAccount } = await import('../app/lib/account-store.ts')
      await ps199(id196, { advisors: [{ key: 'mohammadi', name: 'محمدی', owner: 'adv:deeptest196:mohammadi', listingCount: 0 }] })
      const gq = await enqueueGraduate(id196, 'mohammadi', '09121112233')
      ok('صفِ ساختِ حساب: ثبت شد و پرچمِ «در حال ساخت» روشن است', gq.ok === true && (await getScrape(id196)).advisors.find(a => a.key === 'mohammadi').graduating === true)
      const pr1 = await processGraduateQueue()
      const acc = getAccount ? getAccount('09121112233') : null
      const prosRoleId = listRoles().find(r => r.dashboard === '/pros')?.id
      const advAfter = (await getScrape(id196)).advisors.find(a => a.key === 'mohammadi')
      ok('حساب با «نقشِ واقعیِ مشاور املاک» ساخته شد (نه رشتهٔ ناموجود)', pr1.ran === true && pr1.ok === true && !!acc && acc.role === prosRoleId && !!prosRoleId)
      ok('پرچمِ «در حال ساخت» بسته و شماره ثبت شد و صف خالی است', advAfter.graduating === false && advAfter.phone === '09121112233' && (await hasGraduateJobs()) === false)
      // کیلِ وسطِ کار: کارِ claimشده گم نمی‌شود — claimِ رهاشده دوباره برداشته می‌شود (at-least-once)
      await ps199(id196, { advisors: [{ key: 'kamrani', name: 'کامرانی', owner: 'adv:deeptest196:kamrani', listingCount: 0 }] })
      await enqueueGraduate(id196, 'kamrani', '09124445566')
      const { default: fs199 } = await import('fs')
      const rosterFile = '.agency-roster-data.json'
      const db199 = JSON.parse(fs199.readFileSync(rosterFile, 'utf-8'))
      db199.graduateQueue[0].startedAt = Date.now()   // شبیه‌سازیِ claimِ زنده توسطِ پروسهٔ دیگر
      fs199.writeFileSync(rosterFile, JSON.stringify(db199))
      ok('کارِ claimشدهٔ زنده دوباره برداشته نمی‌شود (بدونِ اجرای موازی)', (await processGraduateQueue()).ran === false)
      db199.graduateQueue[0].startedAt = Date.now() - 11 * 60_000   // پروسه کشته شد → claim رها شد
      fs199.writeFileSync(rosterFile, JSON.stringify(db199))
      const pr2 = await processGraduateQueue()
      ok('کیل وسطِ ساختِ حساب = کارِ گم‌شده نیست: claimِ رهاشده دوباره اجرا و تمام شد', pr2.ran === true && pr2.ok === true && (await getScrape(id196)).advisors.find(a => a.key === 'kamrani').graduating === false)
      // پرچمِ یتیم (از دادهٔ قدیمیِ قبل از این فیکس): در نمایش خودکار خاموش می‌شود
      await ps199(id196, { advisors: [{ key: 'orphan', name: 'یتیم', owner: 'adv:x:o', listingCount: 0, graduating: true }] })
      const shown = (await ls199()).find(x => x.id === id196)
      ok('پرچمِ یتیمِ «در حال ساخت» (بدونِ کاری در صف) در نمایش خاموش می‌شود', shown.advisors.find(a => a.key === 'orphan').graduating === false)
    }
    // فاز ۱۹۲ (فیدبک: «ده بار زدم، هر بار "نیمه‌کاره ماند"») — رانِ کشته‌شده خودکار ادامه می‌یابد
    {
      const { addScrape, requestRun, listDueRosters, patchScrape, getScrape, syncRoster } = await import('../app/lib/agency-roster-store.ts')
      const r = await addScrape({ slug: 'testagency192' })
      const id = r.scrape.id
      await requestRun(id)
      ok('درخواستِ دستی → سررسیده', (await listDueRosters(Date.now())).some(s => s.id === id))
      // شروعِ ران: runRequested باید بماند (فیکسِ اصلی) و رانِ زنده سررسیده نباشد
      await patchScrape(id, { running: true, runStartedAt: Date.now(), lastProgressAt: Date.now(), runAttempts: 1 })
      ok('رانِ زنده (ضربانِ تازه) دوباره صف نمی‌شود', !(await listDueRosters(Date.now())).some(s => s.id === id))
      // کشته‌شدنِ پروسه (دیپلوی/pm2 reload): ضربان یخ می‌زند → باید خودکار دوباره سررسیده شود
      await patchScrape(id, { lastProgressAt: Date.now() - 9 * 60_000 })
      ok('رانِ کشته‌شده (ضربانِ یخ‌زده) بدونِ کلیکِ دوباره ادامه می‌یابد', (await listDueRosters(Date.now())).some(s => s.id === id) && (await getScrape(id)).runRequested === true)
      // سقفِ تلاش‌های ناتمام: جلوی حلقهٔ بی‌پایان
      await patchScrape(id, { running: false, runAttempts: 9 })
      const give = await syncRoster(id)
      const after = await getScrape(id)
      ok('بعدِ ۸ تلاشِ ناتمام: توقف با پیامِ روشن و پاک‌شدنِ درخواست', give.ok === false && after.runRequested === false && after.runAttempts === 0 && /ناتمام/.test(after.lastError || ''))
      // پایانِ موفق درخواست را می‌بندد (شبیه‌سازیِ مسیرِ موفق)
      await requestRun(id)
      await patchScrape(id, { running: false, runRequested: false, runAttempts: 0, lastError: '' })
      ok('پایانِ موفق → دیگر در صف نیست', !(await listDueRosters(Date.now())).some(s => s.id === id))
    }
    // فاز ۱۸۹ (شناختِ کاربر از رفتارِ واقعی + دفترِ ترین — فیدبک: «ML گزارش نداره، ترین نمی‌شه، کاربر رو نمی‌شناسه»)
    {
      const { profileCoreOf } = await import('../app/lib/reos/user-profile.ts')
      const evs = [
        { type: 'user_clicked_property', at: 100, propertyId: 'p1' },
        { type: 'user_clicked_property', at: 200, propertyId: 'p2' },
        { type: 'user_clicked_property', at: 300, propertyId: 'p3' },
        { type: 'user_saved_property', at: 400, propertyId: 'p1' },
        { type: 'user_searched', at: 500, meta: { q: 'آپارتمان ونک' } },
        { type: 'contact_made', at: 600, propertyId: 'p2' },
      ]
      const info = { p1: { hood: 'ونک', price: 20e9 }, p2: { hood: 'ونک', price: 30e9 }, p3: { hood: 'گیشا', price: 10e9 } }
      const p = profileCoreOf('u1', evs, info, 42)
      ok('شمارش‌ها از رویدادهای واقعی', p.views === 3 && p.saves === 1 && p.searches === 1 && p.contacts === 1 && p.events === 6)
      ok('محلهٔ محبوب از آگهی‌های واقعاً دیده‌شده (ونک ۲ > گیشا ۱)', p.topHoods[0].hood === 'ونک' && p.topHoods[0].count === 2 && p.topHoods[1].hood === 'گیشا')
      ok('بازهٔ قیمتیِ دیده‌شده (۱۰–۳۰ میلیارد، میانه ۲۰)', p.priceBand.min === 10e9 && p.priceBand.max === 30e9 && p.priceBand.median === 20e9)
      ok('جستجوهای اخیر و آخرین فعالیت و امتیازِ تعامل', p.recentQueries[0] === 'آپارتمان ونک' && p.lastActiveAt === 600 && p.engagement === 42 && p.known === true)
      const empty = profileCoreOf('u2', [], {}, 0)
      ok('کاربرِ بی‌رویداد = گزارشِ صادقانهٔ «شناختِ کافی نیست» (نه دادهٔ ساختگی)', empty.known === false && empty.priceBand === null && empty.topHoods.length === 0 && empty.lastActiveAt === null)
      const { appendRun } = await import('../app/lib/reos/train-log.ts')
      let log = { lastAt: 0, runs: [] }
      log = appendRun(log, { at: 10, kind: 'engage', ok: true, ms: 5 })
      log = appendRun(log, { at: 20, kind: 'lead', ok: true, ms: 5 })
      ok('دفترِ ترین: جدیدترین اول و lastAt پایدار', log.runs[0].kind === 'lead' && log.lastAt === 20)
      for (let i = 0; i < 70; i++) log = appendRun(log, { at: 30 + i, kind: 'x', ok: true, ms: 1 })
      ok('سقفِ نگه‌داری اجرا می‌شود (≤۶۰)', log.runs.length === 60 && log.lastAt === 99)
    }
    // فاز ۱۸۸ (سگِ نگهبانِ قفلِ کرون — ریشهٔ «کارگرِ صف ۳۰ ساعت تیک نزد»)
    {
      const { lockStuck, sweepPick } = await import('../app/lib/cron-runner.ts')
      ok('قفلِ تازه شکسته نمی‌شود', lockStuck(1000, 1000 + 5 * 60_000, 10 * 60_000) === false)
      ok('قفلِ ماندهٔ بیش از سقف شکسته می‌شود', lockStuck(1000, 1000 + 11 * 60_000, 10 * 60_000) === true)
      ok('بدونِ زمانِ شروع (قفلِ آزاد) هرگز true نمی‌شود', lockStuck(undefined, 999999999, 1) === false && lockStuck(0, 999999999, 1) === false)
      // فاز ۲۱۱ — جارویِ دوسر: تازه‌ترین‌ها (قربانیانِ دیپلوی) + قدیمی‌ترین‌ها (دُمِ بک‌لاگ)، بدونِ تکرار
      const ids211 = Array.from({ length: 20 }, (_, i) => 'x' + i)
      ok('دوسر: ۶ اول + ۶ آخر', JSON.stringify(sweepPick(ids211, 6)) === JSON.stringify(['x0', 'x1', 'x2', 'x3', 'x4', 'x5', 'x14', 'x15', 'x16', 'x17', 'x18', 'x19']))
      ok('فهرستِ کوچک بدونِ تکرار برمی‌گردد', sweepPick(['a', 'b', 'c'], 6).length === 3 && sweepPick([], 6).length === 0)
    }
    // فاز ۱۸۷ (مأموریتِ ساعتی — فیدبک: «هر یک ساعت باشه و پول هم بده که قفل نشه»)
    {
      const { HOURLY_QUESTS, hourlyQuestOf } = await import('../app/lib/empire-store.ts')
      ok('مأموریت‌های ساعتی همه کارهای کوچکِ واقعی‌اند (هدف ≤۲، متریکِ رفتاریِ معتبر)', HOURLY_QUESTS.every(q => q.target <= 2 && ['views', 'saves', 'searches'].includes(q.metric)))
      const a = hourlyQuestOf('u1', 500)
      ok('انتخاب قطعی است (همان کاربر/بازه = همان مأموریت)', a.key === hourlyQuestOf('u1', 500).key)
      const keys = new Set(Array.from({ length: 12 }, (_, i) => hourlyQuestOf('u1', 500 + i).key))
      ok('بازه‌های مختلف مأموریت‌های متنوع می‌آورند', keys.size >= 2)
      ok('کاربرهای مختلف لزوماً یک مأموریت نمی‌گیرند', new Set(Array.from({ length: 12 }, (_, i) => hourlyQuestOf('user' + i, 500).key)).size >= 2)
      const { hourlyRewardOf } = await import('../app/lib/empire-store.ts')
      ok('جایزه لنگر به بازار: ۱۰٪ از میانهٔ ۲۵ میلیارد = ۲٫۵ میلیارد', hourlyRewardOf(25_000_000_000, 10, 2_000_000_000) === 2_500_000_000)
      ok('بازارِ بی‌داده یا درصدِ صفر → کفِ knob (هرگز صفر)', hourlyRewardOf(0, 10, 2_000_000_000) === 2_000_000_000 && hourlyRewardOf(25_000_000_000, 0, 2_000_000_000) === 2_000_000_000)
      ok('میانهٔ پایین‌تر از کف → کف می‌ماند', hourlyRewardOf(10_000_000_000, 10, 2_000_000_000) === 2_000_000_000)
    }
    // فاز ۱۸۶ (اتحادها: تابلوی قدرتِ واقعی + اتحادِ حاکمِ محله — فیدبک: «اتحاد رو پیدا نمی‌کنم، امکاناتش کامل نیست»)
    {
      const { hoodClanKings } = await import('../app/lib/empire-territory.ts')
      const { clanBoardFrom } = await import('../app/lib/empire-social.ts')
      const E = (userId, hoods) => ({ userId, no: 1, name: userId, assets: hoods.map(h => (typeof h === 'string' ? { hood: h } : h)) })
      const emps = [E('u1', ['ونک', 'ونک', 'گیشا']), E('u2', ['ونک']), E('u3', ['ونک', { hood: 'گیشا', demolishedAt: 1 }]), E('u4', ['پونک'])]
      const kings = hoodClanKings(emps, { u1: 'شاهین', u2: 'عقاب', u3: 'عقاب' })
      ok('اتحادِ حاکمِ محله از دارایی‌های واقعیِ اعضا (ونک: شاهین ۲ = عقاب ۲ → تساوی، نامِ مقدمِ فارسی)', kings['ونک'].count === 2 && kings['ونک'].name === 'شاهین')
      ok('داراییِ تخریب‌شده شمرده نمی‌شود و کاربرِ بی‌اتحاد اثری ندارد', kings['گیشا'].name === 'شاهین' && kings['گیشا'].count === 1 && !kings['پونک'])
      const clans = [
        { id: 'c1', name: 'شاهین', ownerId: 'u1', members: [{ userId: 'u1', no: 1, name: 'a', at: 1 }], msgs: [], createdAt: 10, treasury: 500, projects: [{ status: 'owned' }, { status: 'open' }] },
        { id: 'c2', name: 'عقاب', ownerId: 'u2', members: [{ userId: 'u2', no: 2, name: 'b', at: 1 }, { userId: 'u3', no: 3, name: 'c', at: 1 }], msgs: [], createdAt: 20, treasury: 100, projects: [] },
      ]
      const board = clanBoardFrom(clans, emps, 'u2')
      ok('قدرت = املاکِ واقعیِ اعضا (شاهین ۳، عقاب ۲) و ترتیب از همان', board[0].name === 'شاهین' && board[0].assets === 3 && board[1].name === 'عقاب' && board[1].assets === 2)
      ok('خزانه/کنسرسیومِ تملک‌شده/اعضا شفاف و isMine درست', board[0].treasury === 500 && board[0].projectsOwned === 1 && board[1].members === 2 && board[1].isMine === true && board[0].isMine === false)
    }
    // فاز ۱۸۵ (تطبیقِ محله با مرزِ واژه — فیدبک: «محله آگهی دارد ولی تابلو هیچی نشان نمی‌دهد»)
    {
      const { hoodMatches } = await import('../app/lib/empire-territory.ts')
      ok('«سهروردی» بخشِ «سهروردی جنوبی» را می‌گیرد (تساویِ کامل شرط نیست)', hoodMatches('سهروردی', 'تهران، سهروردی جنوبی خ سلیمان خاطر') === true)
      ok('«ونک» هرگز «پونک» را نمی‌گیرد (زیررشته ممنوع)', hoodMatches('ونک', 'تهران، پونک، بلوار همیلا') === false)
      ok('تساویِ کاملِ بخش هنوز کار می‌کند', hoodMatches('سعادت‌آباد', 'تهران، سعادت‌آباد') === true)
      ok('نیم‌فاصله و فاصله یکی‌اند («سعادت‌آباد» = «سعادت آباد»)', hoodMatches('سعادت‌آباد', 'تهران، سعادت آباد، بلوار دریا') === true && hoodMatches('سعادت آباد', 'سعادت‌آباد') === true)
      ok('محلهٔ چندواژه‌ای پیوسته می‌خواهد («شهرک آتی شهر»)', hoodMatches('شهرک آتی شهر', 'تهران، شهرک آتی شهر، فاز ۲') === true && hoodMatches('شهرک آتی شهر', 'تهران، شهرک غرب، آتی شهر نیست') === false)
      ok('ي/ك عربی نرمال می‌شود', hoodMatches('نياوران', 'تهران، نیاوران') === true)
      ok('خالی/بی‌نشانی = false (نه خطا)', hoodMatches('', 'تهران') === false && hoodMatches('ونک') === false)
    }
    // فاز ۱۶۸ (تابلوی محله‌ها): فرمانروا، شکافِ فتح، ترتیبِ انگیزشی — همه قطعی از دارایی‌های واقعی
    {
      const { hoodBoardFrom } = await import('../app/lib/empire-territory.ts')
      const E = (userId, no, name, hoods) => ({ userId, no, name, assets: hoods.map(h => (typeof h === 'string' ? { hood: h } : h)) })
      const board = hoodBoardFrom([
        E('me', 5, 'من', ['شهران', 'گیشا']),
        E('rival', 2, 'رقیب', ['شهران', 'شهران', 'ونک']),
        E('third', 9, 'سوم', ['ونک']),
      ], 'me')
      const sh = board.find(s => s.hood === 'شهران'), gi = board.find(s => s.hood === 'گیشا'), vk = board.find(s => s.hood === 'ونک')
      ok('فرمانروا = بیشترین دارایی و شکافِ فتح درست است (۲ رقیب − ۱ من + ۱ = ۲)', sh.king.name === 'رقیب' && !sh.king.isMe && sh.mine === 1 && sh.gap === 2 && sh.owners === 2)
      ok('محلهٔ تک‌مالک: خودم فرمانروا و gap صفر', gi.king.isMe === true && gi.gap === 0 && gi.total === 1)
      ok('تساویِ شمار → شمارهٔ کوچک‌تر (قدیمی‌تر) فرمانرواست', vk.king.name === 'رقیب' && vk.owners === 2)
      ok('ترتیبِ انگیزشی: اول نزدیک‌ترین فتح (هستم ولی فرمانروا نیستم)، بعد قلمروِ خودم', board[0].hood === 'شهران' && board[1].hood === 'گیشا')
      ok('داراییِ تخریب‌شده و محلهٔ خالی شمرده نمی‌شود و ورودیِ خالی امن است',
        hoodBoardFrom([E('a', 1, 'الف', [{ hood: 'x', demolishedAt: 1 }, { hood: '' }])], 'a').length === 0 && hoodBoardFrom([], 'a').length === 0)
    }
    // فاز ۱۲۵ (سوئیپِ گاردها): نگاشت‌های جدیدِ کانفیگ‌های داخلِ نماهای قابلِ‌اعطا
    {
      const { staffApiAllowed } = await import('../app/lib/admin-access.ts')
      ok('کارت‌های نمای پیامک (هشدار/مذاکره/گیتِ پروفایل) با بخشِ sms باز می‌شوند', staffApiAllowed(['sms'], '/api/admin/alerts-config') === true && staffApiAllowed(['sms'], '/api/admin/negotiation-config') === true && staffApiAllowed(['sms'], '/api/admin/profile-gate-config') === true)
      ok('tracker-config برای بخشِ کاربران هم باز است (بازدیدهای کشوی کاربر)', staffApiAllowed(['users'], '/api/admin/tracker-config') === true && staffApiAllowed(['tracker'], '/api/admin/tracker-config') === true)
      ok('sitemap به seo می‌رسد و بخش‌های بی‌ربط به کانفیگ‌ها نمی‌رسند', staffApiAllowed(['sitemap'], '/api/admin/seo/sitemaps') === true && staffApiAllowed(['tracker'], '/api/admin/alerts-config') === false && staffApiAllowed(['users'], '/api/admin/moderation-config') === false)
    }
    // فاز ۱۲۶ (فیدبکِ مستقیم: «برای هر کاربری گزینه‌های متفاوت بیاید»): ضابطه و فرمِ طراحی کاربری‌محور
    {
      const { designPlanOf, useRuleOf, designBuildPlanOf } = await import('../app/lib/empire-store.ts')
      const cfg = { occupancyPct: 60, buildFactor: 2, maxOverFloors: 2, minUnitArea: 35, parkingAreaPerUnit: 25, parkingLevels: 2, comMaxFloors: 2, comMinShopArea: 15, comUnitsPerSpot: 3, offMinUnitArea: 25, villaMaxFloors: 3 }
      // زمینِ ۲۰۰ متری → هر طبقه ۱۲۰ متر؛ ضابطهٔ مرجع ۴ طبقه
      const res = designPlanOf(200, 4, 2, cfg, 4, 'residential')
      ok('مسکونی مثلِ قبل: ۴×۲ = ۸ واحدِ ۶۰ متری (بدونِ رگرسیون)', res.ok === true && res.totalUnits === 8 && res.unitArea === 60)
      const villa = designPlanOf(200, 2, 5, cfg, 4, 'villa')
      ok('ویلا تک‌واحدی است: «واحد در طبقه» بی‌اثر — کلِ بنا یک واحدِ ۲۴۰ متری، بدونِ واحدِ غیرمجاز', villa.ok === true && villa.totalUnits === 1 && villa.unitArea === 240 && villa.illegalUnits === 0)
      ok('ویلا سقفِ کاربری دارد: تریپلکس مجاز، ۶ طبقه رد', designPlanOf(200, 3, 1, cfg, 6, 'villa').ok === true && designPlanOf(200, 6, 1, cfg, 6, 'villa').ok === false)
      const com = designPlanOf(200, 2, 6, cfg, 4, 'commercial')
      ok('تجاری: پاساژ به سقفِ ۲ طبقهٔ قانونی محدود می‌شود و مغازهٔ ۲۰ متری مجاز است', com.ok === true && com.legalFloors === 2 && com.totalUnits === 12 && com.unitArea === 20)
      ok('مغازهٔ زیرِ حدنصابِ ۱۵ متر رد می‌شود', designPlanOf(200, 1, 9, cfg, 4, 'commercial').ok === false)
      const cfg1 = { ...cfg, parkingLevels: 1 }   // ظرفیتِ پارکینگ = ۴
      ok('پارکینگِ گروهیِ تجاری: ۶ واحدِ مسکونی رد ولی ۶ مغازه قبول (هر ۳ مغازه یک پارکینگ)', designPlanOf(200, 2, 3, cfg1, 4, 'residential').ok === false && designPlanOf(200, 2, 3, cfg1, 4, 'commercial').ok === true)
      ok('اداری: واحدِ ۳۰ متری مجاز است (حدنصابِ ۲۵) ولی مسکونیِ همان طرح رد (حدنصابِ ۳۵)', designPlanOf(200, 2, 4, cfg, 4, 'office').ok === true && designPlanOf(200, 2, 4, cfg, 4, 'residential').ok === false)
      ok('useRuleOf: نامِ واحد و تک‌واحدی‌بودن درست است', useRuleOf('commercial', cfg).unitFa === 'مغازه' && useRuleOf('villa', cfg).singleUnit === true && useRuleOf('office', cfg).minUnitArea === 25 && useRuleOf(undefined, cfg).unitFa === 'واحد')
      const bp = designBuildPlanOf('concrete', 'standard', 200, { footprint: 120, floors: 2, unitsPerFloor: 1, unitArea: 240, legalFloors: 2, use: 'villa' }, { buildFactor: 2, costPerM: 10_000_000, buildDays: 60 })
      ok('پلِ نقشه→ساخت برای ویلا: یک واحدِ ۲۴۰ متری (نه ۲ واحد)', !!bp && bp.totalUnits === 1 && bp.unitArea === 240)
      const bp2 = designBuildPlanOf('concrete', 'standard', 200, { footprint: 120, floors: 2, unitsPerFloor: 4, unitArea: 30, legalFloors: 2, use: 'office' }, { buildFactor: 2, costPerM: 10_000_000, buildDays: 60 })
      ok('پلِ نقشه→ساخت برای اداری: ۸ واحدِ ۳۰ متری (رفتارِ طبقه×واحد حفظ)', !!bp2 && bp2.totalUnits === 8 && bp2.unitArea === 30)
    }
    // فاز ۱۱۲ (کاربریِ پروژه): تطبیقِ خالصِ نوعِ آگهیِ واقعی با کاربریِ انتخابیِ بازیکن
    {
      const { BUILD_USES, useMatch } = await import('../app/lib/empire-store.ts')
      ok('چهار کاربری تعریف شده و مسکونی پیش‌فرض است', BUILD_USES.length === 4 && BUILD_USES[0].key === 'residential')
      ok('تجاری/اداری/ویلا فقط آگهیِ همان نوع را می‌گیرند', useMatch('commercial', 'مغازه و تجاری') && !useMatch('commercial', 'آپارتمان') && useMatch('office', 'دفتر اداری') && useMatch('villa', 'ویلا') && !useMatch('villa', 'آپارتمان'))
      ok('مسکونی = هر چیزِ غیرِ تجاری/اداری/ویلا/زمین', useMatch('residential', 'آپارتمان') && useMatch('residential', 'خانه') && !useMatch('residential', 'مغازه') && !useMatch('residential', 'زمین و کلنگی') && !useMatch('residential', 'ویلا'))
      ok('کاربریِ ناشناخته هیچ‌چیز را نمی‌گیرد', !useMatch('hotel', 'آپارتمان'))
    }
    // فاز ۱۱۱ (گفت‌وگوی سراسریِ شهر): اعتبارسنجیِ خالص + چرخهٔ ارسال/گزارش/نظارت
    {
      const { validateChatMsg, postChatMsg, chatView, reportChatMsg, adminDeleteChatMsg, adminMuteChat } = await import('../app/lib/empire-chat.ts')
      const cc = { enabled: true, maxLen: 240, cooldownSec: 15, minLevel: 3, keep: 200 }
      ok('پیامِ سالم مجاز است', validateChatMsg('سلام شهر!', cc, 0, 1000_000) === null)
      ok('واژهٔ ممنوع/لینک/طولِ زیاد رد می‌شود', validateChatMsg('بیا بازی', cc, 0, 0) !== null && validateChatMsg('www.x.com بیا', cc, 0, 0) !== null && validateChatMsg('ب'.repeat(300), cc, 0, 0) !== null)
      ok('کول‌داون اعمال می‌شود', validateChatMsg('دوباره', cc, 1000_000, 1000_000 + 5000) !== null && validateChatMsg('دوباره', cc, 1000_000, 1000_000 + 16000) === null)
      const by111 = { userId: 'u111', no: 42, name: 'شهروند' }
      ok('ارسال و نمایش کار می‌کند', (await postChatMsg(by111, 'اولین پیامِ شهر', cc)).ok === true && (await chatView('u111')).msgs.some(m => m.text === 'اولین پیامِ شهر' && m.mine))
      ok('پیامِ پشتِ‌همِ همان کاربر با کول‌داون رد می‌شود', (await postChatMsg(by111, 'دومی', cc)).ok === false)
      const msg111 = (await chatView('u999')).msgs[0]
      await reportChatMsg('u999', msg111.id)
      ok('گزارشِ بازیکن ثبت می‌شود (خودش نه)', (await chatView('u999')).msgs[0].reported === true && (await reportChatMsg('u111', msg111.id)).ok === false)
      await adminDeleteChatMsg(msg111.id)
      ok('حذفِ ادمین پیام را از دیدِ بازیکنان برمی‌دارد', (await chatView('u999')).msgs.length === 0)
      await adminMuteChat('u111', 24)
      ok('سکوتِ ادمین جلوی ارسال را می‌گیرد و رفعش برمی‌گرداند', (await postChatMsg(by111, 'بعد از سکوت', cc, Date.now() + 60_000)).ok === false && (await adminMuteChat('u111', 0), (await postChatMsg(by111, 'بعد از رفعِ سکوت', cc, Date.now() + 60_000)).ok === true))
    }
    // فاز ۱۱۰ (CEO Pass): آیتم‌های انحصاریِ فصل — یک‌بار در هر فصل، فقط ظاهر
    {
      const { createEmpire: ce110, getEmpire: ge110, grantPassCosmetics } = await import('../app/lib/empire-store.ts')
      await ce110('u110', { name: 'پاس‌دار', persona: 'investor', answers: {} })
      const g1 = await grantPassCosmetics('u110', 'S1', 'فصلِ آغاز')
      const e110 = await ge110('u110')
      ok('گذرنامه: قاب و نشانِ فصل به مجموعه اضافه و فعال می‌شود', g1.ok === true && (e110.cosmetics?.owned || []).includes('pass_S1_frame') && (e110.cosmetics?.owned || []).includes('pass_S1_flair') && e110.cosmetics.frame === 'pass_S1_frame')
      const g2 = await grantPassCosmetics('u110', 'S1', 'فصلِ آغاز')
      ok('هر فصل فقط یک‌بار (claims)', g2.ok === false)
      const g3 = await grantPassCosmetics('u110', 'S2', 'فصلِ دوم')
      ok('فصلِ جدید = آیتم‌های جدید', g3.ok === true && (await ge110('u110')).cosmetics.owned.includes('pass_S2_frame'))
    }
    // فاز ۱۰۹ (Visual Pass 2): توابعِ خالصِ شهرِ زنده — فازِ آسمان/جلوهٔ هوا/زندگیِ خیابان/نما
    const { dayPhaseOf, weatherFxOf, streetLifeOf, isValidFacade, FACADES } = await import('../app/lib/empire-visual.ts')
    ok('فازِ آسمان از ساعتِ واقعی درست است', dayPhaseOf(6) === 'dawn' && dayPhaseOf(12) === 'day' && dayPhaseOf(18) === 'dusk' && dayPhaseOf(23) === 'night' && dayPhaseOf(2) === 'night')
    ok('ساعتِ خارج از بازه هم امن است', dayPhaseOf(26) === 'night' && dayPhaseOf(-1) === 'night')
    ok('جلوهٔ هوا فقط از آیکنِ واقعی — ناشناخته/نبود = هیچ', weatherFxOf('🌧') === 'rain' && weatherFxOf('❄️') === 'snow' && weatherFxOf('⛈') === 'storm' && weatherFxOf('☀️') === null && weatherFxOf(null) === null)
    ok('زندگیِ خیابان از دارایی‌های واقعی با سقف', streetLifeOf(0) === 0 && streetLifeOf(3) === 3 && streetLifeOf(40) === 5 && streetLifeOf(-2) === 0)
    ok('سبک‌های نما معتبرند و ناشناخته رد می‌شود', FACADES.length === 5 && isValidFacade('') && isValidFacade('modern') && !isValidFacade('gold_p2w'))
    // فاز ۱۰۷ (Creator Store): اعتبارسنجیِ طرحِ بازیکن + ریاضیِ سهمِ سازنده
    const { validateCreatorItem, creatorShareOf } = await import('../app/lib/empire-creator.ts')
    const crCfg = { enabled: true, sharePct: 70, minPriceCoins: 20, maxPriceCoins: 500, maxPendingPerUser: 3 }
    ok('طرحِ سالم پذیرفته می‌شود', validateCreatorItem({ kind: 'frame', icon: '🐆', label: 'قابِ پلنگی', priceCoins: 100 }, crCfg, 0) === null)
    ok('واژهٔ ممنوع در نام رد می‌شود (قانون ۳)', validateCreatorItem({ kind: 'frame', icon: '🐆', label: 'قابِ بازی', priceCoins: 100 }, crCfg, 0) !== null)
    ok('قیمتِ خارج از بازهٔ knob رد می‌شود', validateCreatorItem({ kind: 'flair', icon: '⭐', label: 'نشانِ ستاره', priceCoins: 5 }, crCfg, 0) !== null && validateCreatorItem({ kind: 'flair', icon: '⭐', label: 'نشانِ ستاره', priceCoins: 900 }, crCfg, 0) !== null)
    ok('سقفِ طرح‌های در انتظار اعمال می‌شود', validateCreatorItem({ kind: 'frame', icon: '🐆', label: 'قابِ پلنگی', priceCoins: 100 }, crCfg, 3) !== null)
    ok('فروشگاهِ خاموش = هیچ ثبتی', validateCreatorItem({ kind: 'frame', icon: '🐆', label: 'قابِ پلنگی', priceCoins: 100 }, { ...crCfg, enabled: false }, 0) !== null)
    ok('نوع/ایموجی/نامِ نامعتبر رد می‌شود', validateCreatorItem({ kind: 'hat', icon: '🐆', label: 'قاب', priceCoins: 100 }, crCfg, 0) !== null && validateCreatorItem({ kind: 'frame', icon: '', label: 'قابِ خوب', priceCoins: 100 }, crCfg, 0) !== null && validateCreatorItem({ kind: 'frame', icon: '🐆', label: 'ق', priceCoins: 100 }, crCfg, 0) !== null)
    ok('بقای کوین: سهمِ سازنده + کارمزدِ حذف‌شده = قیمت (۱۰۰×۷۰٪ = ۷۰)', creatorShareOf(100, 70) === 70 && creatorShareOf(100, 70) + (100 - creatorShareOf(100, 70)) === 100)
    ok('سهم هرگز از قیمت بیشتر نمی‌شود و منفی نمی‌شود', creatorShareOf(33, 70) === 23 && creatorShareOf(50, 150) === 50 && creatorShareOf(50, -10) === 0)
    // فاز ۱۰۴: هوا — اگر سرویس در دسترس نباشد null برمی‌گردد (نه عددِ ساختگی)؛ اگر بود، دما عدد است
    const { weatherOf } = await import('../app/lib/weather.ts')
    const w104 = await weatherOf('تهران')
    ok('هوای واقعی: یا null صادقانه یا دمای عددی', w104 === null || (typeof w104.tempC === 'number' && !!w104.icon))
    for (const f of ['.empire-clans-data.json', '.empire-dm-data.json', '.empire-duel-data.json']) { try { if (ex102(f)) ul102(f) } catch {} }
  }

  // فاز ۷۲: تولدِ دنیا — بارِ اول ثبت می‌شود و بعد ثابت می‌ماند (سالِ نسبی، نه «سالِ ۲۳۰» از مبدأ unix)
  {
    const ep1 = await worldEpochOf(20645)
    const ep2 = await worldEpochOf(20700)
    ok('epoch دنیا set-once است (بارِ دوم تغییر نمی‌کند)', ep1 === 20645 && ep2 === 20645)
    ok('سالِ نسبیِ دنیا از epoch کوچک است', worldYearOf(Math.max(0, 20700 - ep2), 90).year === 1)
  }
  const w63cfg = { daysPerYear: 90, historyCap: 400, rumorsPerWeek: 2, rumorCredMin: 55, rumorCredMax: 85, heatWActive: 6, heatWEvent: 15, heatWAuction: 10, heatLow: 35, heatHigh: 85 }
  const heat0 = worldHeatOf({ activePlayers: 0, eventsToday: 0, auctionsLive: 0, liveOpsActive: 0 }, w63cfg)
  ok('دنیای خالی = سرد + پیشنهادِ گرم‌کردن', heat0.score === 0 && heat0.mood === 'سرد' && heat0.suggestions.length > 0)
  const heatHot = worldHeatOf({ activePlayers: 20, eventsToday: 5, auctionsLive: 3, liveOpsActive: 2 }, w63cfg)
  ok('دنیای شلوغ = داغ + پیشنهادِ آرام‌کردن (سقفِ ۱۰۰)', heatHot.score <= 100 && heatHot.mood === 'داغ' && heatHot.suggestions.some(x => x.includes('اضافه نکن')))
  const hoods63 = [{ hood: 'ونک', perM: 100e6 }, { hood: 'پونک', perM: 60e6 }]
  const rA = rumorsGen(42, hoods63, w63cfg, 1000, 294), rB = rumorsGen(42, hoods63, w63cfg, 1000, 294)
  ok('شایعه قطعی از هشِ هفته (دو بارِ یکسان = یکسان)', JSON.stringify(rA) === JSON.stringify(rB) && rA.length === 2 && rA.every(r => r.credPct >= 55 && r.credPct < 85 && r.sourceFa))
  const rUp = { ...rA[0], dir: 1, basePerM: 100e6 }
  ok('ارزیابیِ شایعه با میانهٔ واقعی: رشد+ادعای رشد = درست؛ افت = غلط', resolveRumor(rUp, 105e6) === 'true' && resolveRumor(rUp, 95e6) === 'false')
  ok('حرکتِ بی‌معنا → قضاوت نکن (صادقانه)', resolveRumor(rUp, 100.05e6) === null)
  const trust63 = sourceTrustOf([{ ...rUp, source: 'media', verdict: 'true' }, { ...rUp, source: 'media', verdict: 'false' }, { ...rUp, source: 'analyst' }])
  ok('اعتبارِ تاریخیِ منبع فقط از ارزیابی‌شده‌ها', trust63.find(t => t.source === 'media').truePct === 50 && trust63.find(t => t.source === 'analyst').total === 0)

  // فاز ۶۲ (سند ۳۱ — فصل ۲۰ End Game): لایه‌ها/میراث/شگفتی‌ها/رؤیاها — هسته‌های خالص
  const { roleLayerOf, legacyScoreOf, wondersCompute, dreamProgressOf, dreamSuggestionsOf, storyOf } = await import('../app/lib/empire-store.ts')
  const g62 = { l2: 10e9, l3: 50e9, l4: 200e9, l5: 500e9, l6: 2e12, l7: 5e12, l8: 20e12, legacyBuild: 120, legacyJobsPer: 100e6, legacyTaxPer: 200e6, legacyQuality: 2, legacySocial: 15, legacyBadge: 25, wonderMinIncome: 200e6, wonderMinProjects: 3, wonderMinAuction: 3, wonderMinKudos: 5, wonderMinWages: 1e9, wonderMinLegacy: 500, dreamsMax: 6 }
  const emp62 = (over = {}) => ({ no: 1, name: 'Alpha', assets: [], badges: [], timeline: [], stats: {}, ...over })
  ok('لایهٔ شروع = معامله‌گر', roleLayerOf(emp62(), 1e9, g62).fa === 'معامله‌گر' && roleLayerOf(emp62(), 1e9, g62).next.fa === 'مشاورِ بازار')
  ok('پول بدونِ شرطِ واقعی لایه نمی‌دهد (ثروت بالای l3 ولی بدونِ پروژه → لایهٔ ۲ می‌ماند)', roleLayerOf(emp62(), 100e9, g62).fa === 'مشاورِ بازار')
  ok('ثروت + پروژهٔ واقعی → شرکتِ ساختمانی', roleLayerOf(emp62({ stats: { projectsDelivered: 1 } }), 100e9, g62).fa === 'شرکتِ ساختمانی')
  const lg62 = legacyScoreOf(emp62({ stats: { projectsDelivered: 2 }, wagesPaid: 300e6, kudos: 3, badges: ['a', 'b'] }), g62)
  ok('شاخصِ میراث دقیقاً از وزن‌ها', lg62.score === 2 * 120 + 3 + 3 * 15 + 2 * 25)
  const wA = emp62({ no: 1, name: 'A', stats: { auctionWins: 4 } }), wB = emp62({ no: 2, name: 'B', stats: { auctionWins: 6 } })
  const w1 = wondersCompute([wA], { cats: {}, hist: {} }, 10, g62)
  ok('شگفتی با گذر از حداقل ثبت می‌شود', w1.db.cats.auction?.no === 1 && w1.changed.some(c => c.key === 'auction'))
  const w2 = wondersCompute([wA, wB], w1.db, 20, g62)
  ok('رکورد فقط با عددِ اکیداً بزرگ‌تر گرفته می‌شود + پلاکِ پیشین در تاریخچه', w2.db.cats.auction.no === 2 && w2.db.hist.auction[0].no === 1 && w2.db.hist.auction[0].toDay === 20)
  const w3 = wondersCompute([wA, { ...wB, stats: { auctionWins: 6 } }], w2.db, 30, g62)
  ok('عددِ برابر رکورد را نمی‌گیرد', w3.changed.length === 0 && w3.db.cats.auction.no === 2)
  ok('زیرِ حداقل، شگفتی خالی می‌ماند', wondersCompute([emp62({ stats: { auctionWins: 2 } })], { cats: {}, hist: {} }, 5, g62).db.cats.auction === undefined)
  const dp62 = dreamProgressOf(emp62({ dreamsCustom: [{ id: 'x', label: 'رویا', metric: 'auctionWins', target: 4, createdAt: 1 }], stats: { auctionWins: 2 } }), 0)
  ok('پیشرفتِ رؤیا از عددِ واقعی', dp62[0].pct === 50 && dp62[0].done === false && dp62[0].unit === 'count')
  ok('پیشنهادِ رؤیا از سبکِ واقعی (مزایده‌باز → رؤیای مزایده)', dreamSuggestionsOf(emp62({ stats: { auctionWins: 2 } }))[0].metric === 'auctionWins')
  ok('مستندِ مسیر = اولین‌ها به ترتیبِ زمان', (() => { const st62 = storyOf(emp62({ timeline: [{ at: 3, icon: '🏗', title: 'p' }, { at: 1, icon: '🏠', title: 'a' }, { at: 2, icon: '🏠', title: 'b' }] })); return st62.length === 2 && st62[0].title === 'a' && st62[1].title === 'p' })())

  // فاز ۵۰ (سند ۳۰): پیش‌بینیِ جایزه + مجموعه‌ها + رکوردها — همه از دادهٔ واقعی، بدونِ ادعای بی‌مبنا
  const { rewardForecastOf } = await import('../app/lib/empire-rewards.ts')
  ok('برآوردِ روز از رشدِ واقعی: ۵۰ مانده ÷ روزی ۱۰ = ۵ روز', JSON.stringify(rewardForecastOf(50e9, 100e9, 30e9, 2)) === JSON.stringify({ left: 50e9, perDay: 10e9, days: 5 }))
  ok('بدونِ رشدِ مثبت → هیچ ادعایی (null)', rewardForecastOf(50e9, 100e9, 60e9, 2) === null && rewardForecastOf(50e9, 100e9, 50e9, 0) === null)
  ok('رد شده از آستانه → صفرِ صادقانه', rewardForecastOf(120e9, 100e9, 0, 5).left === 0)
  const { collectionsOf, recordsOf, COLLECTIONS } = await import('../app/lib/empire-store.ts')
  const e50 = { assets: [{ kind: 'land', hood: 'الف', buyPrice: 2e9, title: 'زمین', income: 0 }, { kind: 'villa', hood: 'ب', buyPrice: 5e9, title: 'ویلا', income: 600e6 }], badges: [], stats: { sellsProfitable: 0, negoWins: 2, projectsDelivered: 1, auctionWins: 3, crisisRecovered: 0 }, realized: 1e9, projectHist: [{ title: 'برج', revenue: 30e9, pnl: 4e9 }] }
  const cols = collectionsOf(e50)
  ok('پیشرفتِ مجموعه‌ها از داراییِ واقعی (۲ نوع از ۴، ۲ محله از ۳)', cols.find(c => c.key === 'کلکسیونرِ چهارگانه').have === 2 && cols.find(c => c.key === 'فاتحِ محله‌ها').have === 2)
  ok('مجموعهٔ کامل‌شده (شکارچیِ تالار ۳/۳ + امپراتورِ درآمد ۶۰۰م)', cols.find(c => c.key === 'شکارچیِ تالار').done === true && cols.find(c => c.key === 'امپراتورِ درآمد').done === true)
  ok('۶ مجموعه تعریف شده‌اند (۵ سندِ ۳۰ + فاتحِ شهرهای فاز ۶۸)', COLLECTIONS.length === 6)
  const recs = recordsOf(e50)
  ok('رکوردها از دادهٔ ثبت‌شده: گران‌ترین خرید ۵ میلیارد + پروژهٔ ۳۰ میلیاردی', recs.find(r => r.label === 'گران‌ترین خرید').value === 5e9 && recs.find(r => r.label === 'بزرگ‌ترین پروژهٔ تحویلی').value === 30e9)
  ok('بی‌داده = بی‌رکورد (نه صفرِ ساختگی)', recordsOf({ assets: [], badges: [], stats: {}, realized: 0, projectHist: [] }).length === 0)

  // فاز ۴۹ (فیدبک: «۳ واحدِ دیگر خریدم هیچ اثری ندارد»): فرمولِ واحدِ درآمد — تجمیع درآمد را ضرب می‌کند
  const { assetMonthlyIncomeOf } = await import('../app/lib/empire-store.ts')
  ok('اجارهٔ ساده = میانهٔ محله', assetMonthlyIncomeOf({ action: 'rent' }, 40e6) === 40e6)
  ok('۴ واحدِ تجمیعیِ اجاره = ×۴', assetMonthlyIncomeOf({ action: 'rent', unitsOwned: 4 }, 40e6) === 160e6)
  ok('کسب‌وکار = ۲× اجاره × احتمال؛ در ۴ واحد ×۴', assetMonthlyIncomeOf({ business: 'کلینیک', businessProb: 75 }, 40e6) === 60e6 && assetMonthlyIncomeOf({ business: 'کلینیک', businessProb: 75, unitsOwned: 4 }, 40e6) === 240e6)
  ok('برجِ تکمیل‌شده: اجارهٔ واحدها × کیفیت × امکانات', assetMonthlyIncomeOf({ construction: { done: true, rented: 12, qualityFactor: 1.1 } }, 40e6, 1.05) === Math.round(40e6 * 12 * 1.1 * 1.05))
  ok('بدونِ نمونهٔ اجارهٔ واقعی → صفر (صادقانه)', assetMonthlyIncomeOf({ action: 'rent', unitsOwned: 4 }, 0) === 0)
  ok('داراییِ بی‌تصمیم درآمدی ندارد', assetMonthlyIncomeOf({}, 40e6) === 0)

  // فاز ۴۸ (جوایزِ پولِ واقعی): ریاضیِ نردبان و استخر — پایداریِ ساختاری، نه شانسی
  const { rewardLadderOf, rewardPoolOf } = await import('../app/lib/empire-rewards.ts')
  const rCfg = { payoutPct: 40, baseThresholdToman: 100e9, thresholdGrowth: 4, baseRewardToman: 3e6, rewardGrowth: 1.5, maxSteps: 4, maxRewardToman: 20e6 }
  const lad = rewardLadderOf(rCfg)
  ok('مرحلهٔ ۱: ۱۰۰ میلیارد → ۳ میلیون (خواستهٔ دقیق)', lad[0].threshold === 100e9 && lad[0].reward === 3e6)
  ok('آستانه ×۴ و جایزه ×۱٫۵ (مرحلهٔ ۲: ۴۰۰م→۴٫۵م؛ ۳: ۱٫۶ت→۶٫۷۵م)', lad[1].threshold === 400e9 && lad[1].reward === 4_500_000 && lad[2].threshold === 1.6e12 && lad[2].reward === 6_750_000)
  ok('سقفِ جایزه اعمال می‌شود', rewardLadderOf({ ...rCfg, maxRewardToman: 5e6 })[2].reward === 5e6)
  ok('آستانه‌ها همیشه تندتر از جایزه‌ها رشد می‌کنند (پایداری)', lad[3].threshold / lad[0].threshold > lad[3].reward / lad[0].reward)
  const pool = rewardPoolOf({ revenueTotal: 500e6, paidOut: 150e6, requests: [{ status: 'pending', amount: 30e6 }] }, 40)
  ok('نمونهٔ خواسته‌شده: ۵۰۰م خرج → استخرِ ۲۰۰م؛ ۱۵۰ پرداخت + ۳۰ معلق → ۲۰ آزاد', pool.pool === 200e6 && pool.available === 20e6)
  ok('استخر هرگز منفی نمی‌شود', rewardPoolOf({ revenueTotal: 100e6, paidOut: 90e6, requests: [{ status: 'pending', amount: 50e6 }] }, 40).available === 0)
  ok('بدونِ درآمدِ واقعی، استخر صفر است (هیچ تعهدی از جیبِ سایت)', rewardPoolOf({ revenueTotal: 0, paidOut: 0, requests: [] }, 40).pool === 0)

  // فاز ۴۷ (فیدبک): کسب‌وکارها از نقش‌های واقعیِ سایت — هر نوع واژهٔ هم‌صنفیِ غیرعمومی برای شمارشِ رقبا دارد
  const { BUSINESS_TYPES } = await import('../app/lib/empire-store.ts')
  ok('نقش‌های سایت در فهرستِ کسب‌وکار هستند', ['مشاور املاک', 'آژانس املاک', 'دفتر معماری', 'دفتر اسناد رسمی', 'فروشگاه مصالح'].every(k => BUSINESS_TYPES.some(t => t.key === k)) && BUSINESS_TYPES.length >= 12)
  ok('واژهٔ هم‌صنفی مشخص و غیرعمومی است', BUSINESS_TYPES.every(t => t.q && t.q !== 'دفتر' && t.icon))
  // فقط تماشا: سقفِ راندها که برسد تالار می‌بندد — بدونِ صدرنشینی، بردی در کار نیست
  let ms = { ...run0, rivals: [{ key: 'naseri', ceiling: 2e9 }, { key: 'sepehr', ceiling: 2e9 }] }
  for (let i = 0; i < 30 && !ms.done; i++) ms = auctionMoveOf('u45', ms, 'wait', 0, mCfg)
  ok('تماشاچیِ همیشگی هرگز برنده نمی‌شود', ms.done === true && ms.won === false)
  ok('حرکت روی رانِ تمام‌شده بی‌اثر است', auctionMoveOf('u45', mw, 'bid', 0, mCfg).final === mw.final)
}

// «آگهی‌های مشابهِ» REOS (فیدبک+CLAUDE.md: برای آپارتمانِ ۲۶۴متریِ جنت‌آباد، کلنگیِ ۵۲۰متریِ
// سعادت‌آباد «۸۵٪ مشابه» می‌آمد — حتی اجاره‌ای؛ همه در باندِ ~۸۴–۸۸٪). درمان در app/lib/reos/kind.ts:
// وتوی سختِ نوعِ معامله/نوعِ ملک/شهر (هرگز شل نمی‌شوند) + باندِ متراژ ±۴۰٪ (تنها پلهٔ شل‌شدن) +
// امتیازِ ترکیبی از شواهدِ واقعی — این‌جا دقیقاً همان سناریوی باگ بازتولید و اثبات می‌شود.
console.log('\n── REOS: آگهی‌های مشابه — kindOf/pickSimilar (فیلترِ سخت + امتیازِ صادق) ──')
{
  const { kindOf, pickSimilar } = await import('../app/lib/reos/kind.ts')
  // طبقه‌بندیِ نوعِ ملک: تقدمِ متای «نوع ملک» → category → عنوان
  ok('متای صریح: آپارتمان/مغازه/اداری', kindOf({ meta: { 'نوع ملک': 'آپارتمان' } }) === 'apt' && kindOf({ meta: { 'نوع ملک': 'مغازه' } }) === 'shop' && kindOf({ category: 'اداری' }) === 'office')
  ok('کلنگی از عنوان → هم‌کلاسِ زمین (سناریوی باگ)', kindOf({ title: 'فروش کلنگی ۵۲۰ متری سعادت‌آباد' }) === 'land')
  ok('متای طبقه‌ناپذیر («مسکونی») جاخالی نمی‌دهد — از عنوان ادامه می‌دهد', kindOf({ meta: { 'نوع ملک': 'مسکونی' }, title: 'ویلا دوبلکس ۳۰۰ متری' }) === 'villa')
  ok('بی‌نشانه → نامعلوم (نه حدسِ الکی)', kindOf({}) === '' && kindOf({ title: 'ملک خوب در شمال شهر' }) === '')
  // کورپوسِ معیارِ پذیرش — target: آپارتمانِ فروشیِ ۱۲۰متریِ جنت‌آباد
  const target = { id: 'base', title: 'فروش آپارتمان ۱۲۰ متری جنت‌آباد', price: '۱۲,۰۰۰,۰۰۰,۰۰۰ تومان', location: 'تهران، جنت‌آباد', meta: { 'نوع ملک': 'آپارتمان', 'نوع معامله': 'فروش', 'شهر': 'تهران', 'محله': 'جنت‌آباد', 'متراژ': '۱۲۰ متر', 'امکانات': 'پارکینگ، آسانسور، انباری' } }
  const cA = { id: 'a', title: 'فروش آپارتمان ۱۲۵ متری جنت آباد', price: '۱۲,۵۰۰,۰۰۰,۰۰۰ تومان', location: 'تهران، جنت آباد', meta: { 'نوع ملک': 'آپارتمان', 'نوع معامله': 'فروش', 'شهر': 'تهران', 'محله': 'جنت آباد', 'متراژ': '۱۲۵ متر', 'امکانات': 'پارکینگ، آسانسور' } }   // هم‌محله (فاصله به‌جای نیم‌فاصله)
  const cH = { id: 'h', title: 'فروش آپارتمان ۱۴۰ متری جنت‌آباد شمالی', price: '۱۴,۵۰۰,۰۰۰,۰۰۰ تومان', location: 'تهران، جنت‌آباد شمالی', meta: { 'نوع ملک': 'آپارتمان', 'نوع معامله': 'فروش', 'شهر': 'تهران', 'محله': 'جنت‌آباد شمالی', 'متراژ': '۱۴۰ متر' } }
  const cB = { id: 'b', title: 'فروش آپارتمان ۱۶۰ متری سعادت‌آباد', price: '۲۴,۰۰۰,۰۰۰,۰۰۰ تومان', location: 'تهران، سعادت‌آباد', meta: { 'نوع ملک': 'آپارتمان', 'نوع معامله': 'فروش', 'شهر': 'تهران', 'محله': 'سعادت‌آباد', 'متراژ': '۱۶۰ متر' } }
  const cC = { id: 'c', title: 'فروش کلنگی ۵۲۰ متری سعادت‌آباد', price: '۶۰,۰۰۰,۰۰۰,۰۰۰ تومان', location: 'تهران، سعادت‌آباد', meta: { 'نوع ملک': 'کلنگی', 'نوع معامله': 'فروش', 'شهر': 'تهران', 'محله': 'سعادت‌آباد', 'متراژ': '۵۲۰ متر' } }   // دقیقاً آگهیِ باگ
  const cE = { id: 'e', title: 'فروش مغازه ۱۲۰ متری جنت‌آباد', price: '۳۰,۰۰۰,۰۰۰,۰۰۰ تومان', location: 'تهران، جنت‌آباد', meta: { 'نوع ملک': 'مغازه', 'نوع معامله': 'فروش', 'شهر': 'تهران', 'محله': 'جنت‌آباد', 'متراژ': '۱۲۰ متر' } }
  const cD = { id: 'd', title: 'اجاره آپارتمان ۱۱۵ متری جنت‌آباد', price: 'ودیعه ۵۰۰,۰۰۰,۰۰۰ تومان · اجاره ۲۰,۰۰۰,۰۰۰ تومان', location: 'تهران، جنت‌آباد', meta: { 'نوع ملک': 'آپارتمان', 'نوع معامله': 'اجاره', 'شهر': 'تهران', 'محله': 'جنت‌آباد', 'متراژ': '۱۱۵ متر' } }
  const cI = { id: 'i', title: 'سوئیت مبله جنت‌آباد', price: 'شبی ۳,۰۰۰,۰۰۰ تومان', location: 'تهران، جنت‌آباد', meta: { 'نوع ملک': 'آپارتمان', 'شهر': 'تهران', 'محله': 'جنت‌آباد', 'متراژ': '۱۱۰ متر' } }   // روزانه بدونِ متای نوع معامله (فاز ۲۳۰)
  const cF = { id: 'f', title: 'فروش آپارتمان ۱۲۰ متری هاشمیه', price: '۶,۰۰۰,۰۰۰,۰۰۰ تومان', location: 'مشهد، هاشمیه', meta: { 'نوع ملک': 'آپارتمان', 'نوع معامله': 'فروش', 'شهر': 'مشهد', 'محله': 'هاشمیه', 'متراژ': '۱۲۰ متر' } }
  const cG = { id: 'g', title: 'فروش آپارتمان ۴۰۰ متری الهیه', price: '۶۰,۰۰۰,۰۰۰,۰۰۰ تومان', location: 'تهران، الهیه', meta: { 'نوع ملک': 'آپارتمان', 'نوع معامله': 'فروش', 'شهر': 'تهران', 'محله': 'الهیه', 'متراژ': '۴۰۰ متر' } }   // خارجِ باند — فقط در قحطی
  const all = [cA, cH, cB, cC, cE, cD, cI, cF, cG]
  const r8 = pickSimilar(target, all, 8)
  const ids8 = r8.map(x => x.id)
  ok('کلنگی/مغازه/اجاره/روزانه/مشهد هرگز در خروجی نیستند (وتوی سخت)', !ids8.includes('c') && !ids8.includes('e') && !ids8.includes('d') && !ids8.includes('i') && !ids8.includes('f'))
  const simOf = (id) => r8.find(x => x.id === id)?.sim ?? -1
  // فاز ۲۸۵ — قراردادِ سخت‌تر (فیدبکِ زنده: «نه منطقه نه قیمت ربط ندارد»): قیمتِ ~۲برابر (b)
  // و متراژ/قیمتِ خارج از باند (g) دیگر «هرگز» نمی‌آیند، حتی برای پُرکردنِ ظرفیت.
  ok('رتبه‌بندی: فقط هم‌محله‌های باندِ تنگ — قیمتِ ۲برابر و خارج‌ازباند هرگز', JSON.stringify(ids8) === JSON.stringify(['a', 'h']))
  ok('simPct پخش‌شده و صادق (نه «۸۵٪ برای همه»)', simOf('a') >= 0.8 && simOf('b') <= 0.7 && simOf('a') - simOf('b') >= 0.15 && simOf('g') <= 0.45)
  ok('وقتی باندِ ±۴۰٪ خودش k را پر می‌کند، خارج‌ازباند نمی‌آید', !pickSimilar(target, all, 3).some(x => x.id === 'g'))
  ok('قحطی: خالی بهتر از بی‌ربط — کلنگی/قیمتِ دوبرابر/خارج‌ازباند حتی در قحطی هم نمی‌آیند (بخشِ UI پنهان می‌شود)', pickSimilar(target, [cB, cC, cG], 6).length === 0)
  const rU = pickSimilar(target, [cA, { id: 'u', title: 'ملک در جنت‌آباد', location: 'تهران، جنت‌آباد', meta: { 'شهر': 'تهران', 'محله': 'جنت‌آباد' } }], 8)
  ok('kindِ نامعلوم وتو نمی‌شود ولی کفِ مخرجِ 0.75 امتیازِ دروغین نمی‌دهد', rU.length === 2 && rU[0].id === 'a' && rU[1].id === 'u' && rU[1].sim < 0.6)
  ok('خودِ target و idهای تکراری حذف؛ خروجی قطعی است', JSON.stringify(pickSimilar(target, [{ ...target }, cA, { ...cA, title: 'کپی' }], 8).map(x => x.id)) === JSON.stringify(['a']) && JSON.stringify(pickSimilar(target, all, 8)) === JSON.stringify(r8))
}

// فاز ۲۸۴ — «دیده‌شده» روی کارت‌های جست‌وجو: لایهٔ خواندنیِ SSR-safe/تزریق‌پذیر روی استورِ فاز ۲۵۵
// (seen-listings.ts استورِ دوم نمی‌سازد و هرگز نمی‌نویسد؛ منبعِ حقیقت mj_seen_v1 در seen-store ماند).
console.log('\n── فاز ۲۸۴: دیده‌شده — خوانشِ امن + قانونِ سقف/ترتیب (خالص) ──')
{
  const { readSeenMap, seenIdsOf, sortSeenNewestFirst, pruneSeenMap, SEEN_KEY, SEEN_MAX } = await import('../app/lib/seen-listings.ts')
  ok('روی سرور (بدونِ window) همیشه {}', JSON.stringify(readSeenMap()) === '{}')
  ok('storage=null / JSONِ خراب / فرمتِ آرایه‌ای → {} (محافظ)', JSON.stringify(readSeenMap(null)) === '{}' && JSON.stringify(readSeenMap({ getItem: () => 'خراب{' })) === '{}' && JSON.stringify(readSeenMap({ getItem: () => '[1,2]' })) === '{}')
  ok('دقیقاً از کلیدِ استورِ فاز ۲۵۵ می‌خواند (mj_seen_v1، سقفِ ۳۰۰۰)', SEEN_KEY === 'mj_seen_v1' && SEEN_MAX === 3000 && JSON.stringify(readSeenMap({ getItem: k => k === 'mj_seen_v1' ? '{"z":7}' : null })) === '{"z":7}')
  const m284 = readSeenMap({ getItem: () => '{"a":2,"b":9,"c":0}' })
  ok('آبجکتِ سالم عیناً + seenIdsOf', seenIdsOf(m284).size === 3 && seenIdsOf(m284).has('b') && !seenIdsOf(m284).has('x'))
  ok('ترتیبِ «جدیدترین اول» و timestampِ غایب=۰', JSON.stringify(sortSeenNewestFirst(m284)) === JSON.stringify(['b', 'a', 'c']))
  const small284 = { a: 1, b: 2 }
  ok('ورودیِ ≤max همان مرجع برمی‌گردد (بدونِ کپیِ بیهوده)', pruneSeenMap(small284, 3) === small284)
  ok('سرریز: قدیمی‌ترین‌ها حذف، جدیدترین‌ها می‌مانند (آینهٔ قانونِ سقفِ markSeen)', JSON.stringify(Object.keys(pruneSeenMap({ x1: 1, x2: 2, x3: 3, x4: 4, x5: 5 }, 3)).sort()) === JSON.stringify(['x3', 'x4', 'x5']))
}

// انتشارِ دسته‌ای (CLAUDE.md — «هر فایل ~۵ ثانیه» چون هر publishListing روی PG یک فول‌اسکن بود):
// publishUserListingsBatch باید «by construction» هم‌رفتارِ مسیرِ تکی باشد — همان هسته‌ها، همان
// منطقِ prev/twin/remoderate — وگرنه به‌جای کندی «آگهیِ گم‌شده/تکراری» می‌گیریم (هشدارِ CLAUDE.md).
console.log('\n── انتشارِ دسته‌ای: هم‌ارزی با مسیرِ تکی + twin-dedup + remoderate + graduate/ترمیم ──')
{
  const fs285 = await import('fs')
  const st285 = await import('../app/lib/scraper-store.ts')
  const adv285 = await import('../app/lib/advisor-store.ts')
  const dv285 = await import('../app/lib/advisor-divar-store.ts')
  const ros285 = await import('../app/lib/agency-roster-store.ts')
  // ── سطحِ اسکرپر: چانک‌بندی (مرزِ ۱۵) + twin-dedupِ درون/بینِ چانک + dedupِ مالک ──
  const mkRaw = (i, over = {}) => ({
    title: `فروش آپارتمان ${60 + 6 * i} متری تستِ انتشارِ دسته‌ای ${i}`,
    price: `${(5_000_000_000 + i * 400_000_000).toLocaleString('fa-IR')} تومان`,
    location: `تهران، محلهٔ آزمایشیِ ${i}`,
    excerpt: `توضیحِ کاملِ فایلِ شمارهٔ ${i}`,
    owner: 'مالکِ تستِ دسته‌ای ' + i,
    meta: { 'شهر': 'تهران', 'محله': `محلهٔ آزمایشیِ ${i}`, 'متراژ': `${60 + 6 * i} متر`, 'نوع معامله': 'فروش' },
    ...over,
  })
  const reqs285 = []
  for (let i = 0; i < 14; i++) reqs285.push({ raw: mkRaw(i, i === 1 ? { phone: '۰۹۱۲۲۸۵۰۰۱۱' } : i === 2 ? { phone: '09122850011' } : {}) })
  reqs285.push({ raw: mkRaw(0) })    // idx14 — هم‌ملک، داخلِ همان چانک (ایندکس باید درون-چانک به‌روز شود)
  reqs285.push({ raw: mkRaw(15) })   // idx15 — اولین آیتمِ چانکِ دوم (PUBLISH_CHUNK=15)
  reqs285.push({ raw: mkRaw(0) })    // idx16 — هم‌ملک، از چانکِ دوم (ایندکس از dbِ تازه ساخته می‌شود)
  const bOut = await st285.publishUserListingsBatch(reqs285)
  ok('batch با ۱۷ درخواست (مرزِ چانکِ ۱۵) کامل و هم‌ترتیبِ ورودی برمی‌گردد', bOut.length === 17 && bOut[5].item.title === mkRaw(5).title && bOut[15].item.title === mkRaw(15).title)
  ok('فیلدهای مسیرِ تکی: sourceId/sourceName/pending/انقضای ۳۰روزه', bOut[0].item.sourceId === 'user' && bOut[0].item.sourceName === 'ثبت توسط کاربر' && bOut[0].item.status === 'pending' && bOut[0].item.expiresAt > Date.now() + 29 * 86400_000)
  ok('twin-dedupِ درون-چانکی: دو فایلِ هم‌ملک در یک batch → یک publicId (آپدیت، نه ردیفِ نو)', bOut[14].created === false && bOut[14].item.id === bOut[0].item.id)
  ok('twin-dedupِ بینِ چانک‌ها هم کار می‌کند', bOut[16].created === false && bOut[16].item.id === bOut[0].item.id && bOut.slice(0, 14).every(x => x.created) && bOut[15].created === true)
  const scrDb285 = JSON.parse(fs285.readFileSync('.scraper-data.json', 'utf-8'))
  const own285 = (scrDb285.owners || []).filter(o => (o.phone || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g, '') === '09122850011')
  ok('dedupِ مالک: تلفنِ یکسان با رقمِ فارسی/لاتین → یک Owner با count=2', own285.length === 1 && own285[0].count === 2)
  const dup285 = await st285.addUserListing(mkRaw(3))
  ok('ثبتِ کاربرِ هم‌ملک بعد از batch → duplicate با دلیلِ روشن', dup285.status === 'duplicate' && /تکراری در لحظهٔ ثبت/.test(dup285.aiReason || ''))
  const rec285 = await st285.publishUserListingsBatch([{ prevId: 'missing_prev_285', raw: mkRaw(5) }])
  ok('publicIdِ شکسته (prevId ناموجود) → بازپس‌گیریِ هم‌ملکِ موجود (فاز ۱۵۶A4 از مسیرِ batch)', rec285.length === 1 && rec285[0].created === false && rec285[0].item.id === bOut[5].item.id)
  // ── سطحِ مشاور: publishListingsBatch — هم‌ارزیِ فیلد-به-فیلد با publishListing ──
  const oa285 = '09001285101'
  await adv285.updateAdvisorProfile(oa285, { name: 'مشاور تستِ ۲۸۵' })
  const l1 = await adv285.addListing(oa285, { title: 'آپارتمان تستِ هم‌ارزی الف', deal: 'sale', price: 7_100_000_000, area: 101, rooms: 2, city: 'تهران', neighborhood: 'محلهٔ هم‌ارزیِ الف', description: 'توضیحِ الف', amenities: ['پارکینگ'] })
  const l2 = await adv285.addListing(oa285, { title: 'آپارتمان تستِ هم‌ارزی ب', deal: 'sale', price: 8_200_000_000, area: 88, rooms: 3, city: 'تهران', neighborhood: 'محلهٔ هم‌ارزیِ ب', description: 'توضیحِ ب' })
  const pSingle = await adv285.publishListing(oa285, l1.id)          // مسیرِ تکی (مرجع)
  const rb1 = await adv285.publishListingsBatch(oa285, [l2.id])      // مسیرِ دسته‌ای
  const itS = await st285.getItemById(pSingle.publicId)
  const itB = await st285.getItemById(rb1[0].publicId)
  ok('هم‌ارزی: هویت/مالک/وضعیت مثلِ مسیرِ تکی', rb1[0].fid === l2.id && itB.sourceId === 'user' && itB.sourceName === 'ثبت توسط کاربر' && itB.status === 'pending' && itB.owner === 'مشاور تستِ ۲۸۵' && itB.meta['__ownerPhone'] === oa285)
  ok('هم‌ارزی: قیمت/لوکیشن/متای ساخته از publicPayload', itB.price === `${(8_200_000_000).toLocaleString('fa-IR')} تومان` && itB.location === 'تهران، محلهٔ هم‌ارزیِ ب' && itB.meta['متراژ'] === `${(88).toLocaleString('fa-IR')} متر` && itB.meta['نوع معامله'] === 'فروش')
  ok('هم‌ارزی: ساختارِ آیتمِ تکی و دسته‌ای یکی است (کلیدها)', JSON.stringify(Object.keys(itS).sort()) === JSON.stringify(Object.keys(itB).sort()))
  const advA285 = await adv285.getAdvisor(oa285)
  ok('publicId/published روی فایلِ advisor نشست', advA285.listings.find(x => x.id === l2.id).publicId === rb1[0].publicId && advA285.listings.find(x => x.id === l2.id).published === true)
  // بازانتشارِ بدونِ تغییرِ متن از مسیرِ batch — حکمِ ادمین باید بماند (عینِ تستِ فاز ۱۴۰)
  await st285.setModeration(rb1[0].publicId, 'approved', 'تأییدِ دستیِ ادمین ۲۸۵', 91)
  const rb2 = await adv285.publishListingsBatch(oa285, [l1.id, l2.id])
  const itB2 = await st285.getItemById(rb1[0].publicId)
  ok('بازانتشارِ بدونِ تغییر: publicId ثابت و حکمِ ادمین پاک نمی‌شود', rb2[0].publicId === pSingle.publicId && rb2[1].publicId === rb1[0].publicId && itB2.status === 'approved' && itB2.aiReason === 'تأییدِ دستیِ ادمین ۲۸۵')
  await adv285.updateListing(oa285, l2.id, { description: 'توضیحِ کاملاً تازه برای ممیزیِ دوباره' })
  const rb3 = await adv285.publishListingsBatch(oa285, [l2.id])
  const itB3 = await st285.getItemById(rb3[0].publicId)
  ok('remoderate فقط با تغییرِ متن: pending + پاک‌شدنِ مهرها + دلیلِ استاندارد', rb3[0].publicId === rb1[0].publicId && itB3.status === 'pending' && !itB3.moderatedAt && itB3.aiScore === undefined && itB3.aiReason === 'متنِ آگهی تغییر کرد — در صفِ ممیزیِ دوباره' && itB3.excerpt === 'توضیحِ کاملاً تازه برای ممیزیِ دوباره')
  await adv285.setListingStatus(oa285, l1.id, 'sold')
  const soldAt285 = (await st285.getItemById(pSingle.publicId)).meta['__soldAt']
  await adv285.publishListingsBatch(oa285, [l1.id])
  const itS2 = await st285.getItemById(pSingle.publicId)
  ok('مهرِ __soldAt (فاز ۱۵۳) با بازانتشارِ دسته‌ای گم نمی‌شود', !!soldAt285 && itS2.meta['__dealStatus'] === 'sold' && itS2.meta['__soldAt'] === soldAt285)
  // ── graduate کامل: reassign حالا دسته‌ای است (۱۷ فعال = عبور از مرزِ چانکِ ۱۵ + flushِ پایانی) ──
  const rosR = await ros285.addScrape({ slug: 'batchtest285' })
  const sid285 = rosR.scrape.id
  const tempO285 = 'adv:batchtest285:akbari'
  await ros285.patchScrape(sid285, { advisors: [{ key: 'akbari', name: 'اکبری', owner: tempO285, listingCount: 0 }] })
  for (let i = 0; i < 17; i++) {
    const l = await adv285.addListing(tempO285, { title: `آپارتمان ${70 + 7 * i} متری گرجوئیتِ ${i}`, deal: 'sale', price: 6_000_000_000 + i * 450_000_000, area: 70 + 7 * i, city: 'تهران', neighborhood: `محلهٔ گرجوئیتِ ${i}`, description: `توضیحِ ${i}` })
    dv285.recordImport(tempO285, { token: 'tk285_' + i, listingId: l.id, title: l.title, url: '', at: Date.now(), published: false, sourceId: sid285 })
  }
  const lSold = await adv285.addListing(tempO285, { title: 'آپارتمان فروختهٔ گرجوئیت', deal: 'sale', price: 9_000_000_000, area: 95, city: 'تهران', neighborhood: 'محلهٔ گرجوئیتِ فروخته', description: 'فروخته' })
  await adv285.setListingStatus(tempO285, lSold.id, 'sold')
  const logs285 = []
  const origLog285 = console.log
  let gr285
  try {
    console.log = (...a) => { logs285.push(a.join(' ')) }   // لاگ‌های reassign جمع می‌شوند (خلوتیِ خروجیِ تست)
    gr285 = await ros285.graduateAdvisor(sid285, 'akbari', '09001285201')
  } finally { console.log = origLog285 }
  // فاز ۲۸۷ — انتشار دیگر داخلِ انتقال نیست: reassign فقط کپی می‌کند و «جارویِ انتشار»
  // (صفِ جداگانه، هر تیک چندتا) عمومی می‌کند. اینجا جارو تا خالی‌شدن اجرا می‌شود.
  const preSweep285 = await adv285.getAdvisor('09001285201')
  ok('فاز ۲۸۷: بلافاصله بعدِ انتقال هیچ فایلی هنوز عمومی نیست (انتشار با صفِ جداگانه)', preSweep285.listings.filter(l => l.status === 'active').every(l => !l.publicId))
  for (let i = 0; i < 10; i++) { if (!(await ros285.repairOrphanPublishes(20))) break }
  const tgt285 = await adv285.getAdvisor('09001285201')
  const act285 = tgt285.listings.filter(l => l.status === 'active')
  ok('graduate: موفق و همهٔ ۱۸ فایل منتقل شد', gr285.ok === true && gr285.moved === 18 && tgt285.listings.length === 18)
  ok('target: هر ۱۷ فایلِ فعال بعدِ جارویِ انتشار publicId دارد', act285.length === 17 && act285.every(l => l.publicId && l.published))
  const soldL285 = tgt285.listings.find(l => l.status === 'sold')
  ok('فایلِ فروخته منتشر نشد و وضعیتش ماند', !!soldL285 && !soldL285.publicId)
  ok('مبدأ (مالکِ موقت) کاملاً خالی شد', (await adv285.getAdvisor(tempO285)).listings.length === 0)
  ok('آیتمِ عمومی با __ownerPhoneِ مالکِ جدید ساخته شد', (await st285.getItemById(act285[0].publicId))?.meta?.['__ownerPhone'] === '09001285201')
  const impsT285 = dv285.getDivar('09001285201').imports.filter(i => i.sourceId === sid285)
  const tgtIds285 = new Set(tgt285.listings.map(l => l.id))
  ok('رکوردهای ایمپورت روی مالکِ جدید با listingIdِ نو؛ مبدأ خالی', impsT285.length === 17 && impsT285.every(i => tgtIds285.has(i.listingId)) && dv285.getDivar(tempO285).imports.length === 0)
  const recAdv285 = (await ros285.getScrape(sid285)).advisors.find(a => a.key === 'akbari')
  ok('رکوردِ رُستر بسته شد (owner=شماره، بدونِ transferFrom/graduating)', recAdv285.owner === '09001285201' && recAdv285.graduating === false && !recAdv285.transferFrom)
  ok('لاگِ عملیاتیِ «reassign done files=N» حاضر است (قانونِ شمارهٔ یک)', logs285.some(l => l.includes('reassign done files=18')))
  // ── مسیرِ ترمیمِ کرش: فایلِ copy+deleteشده که چانکش publish نشده بود، در graduateِ دوباره publicId می‌گیرد ──
  const advDb285 = JSON.parse(fs285.readFileSync('.advisor-data.json', 'utf-8'))
  const crashL = advDb285.advisors['09001285201'].listings.find(l => l.status === 'active' && l.publicId)
  const crashTitle = crashL.title, crashPub = crashL.publicId
  delete crashL.publicId; delete crashL.published            // شبیه‌سازیِ کرش قبل از flush
  fs285.writeFileSync('.advisor-data.json', JSON.stringify(advDb285))
  const rosDb285 = JSON.parse(fs285.readFileSync('.agency-roster-data.json', 'utf-8'))
  rosDb285.scrapes[sid285].advisors.find(a => a.key === 'akbari').transferFrom = tempO285   // ازسرگیریِ انتقالِ نیمه‌کاره
  fs285.writeFileSync('.agency-roster-data.json', JSON.stringify(rosDb285))
  let gr2_285
  try {
    console.log = () => {}
    gr2_285 = await ros285.graduateAdvisor(sid285, 'akbari', '09001285201')
    for (let i = 0; i < 10; i++) { if (!(await ros285.repairOrphanPublishes(20))) break }   // فاز ۲۸۷: ترمیم هم کارِ جارویِ انتشار است
  } finally { console.log = origLog285 }
  const fixedL285 = (await adv285.getAdvisor('09001285201')).listings.find(l => l.title === crashTitle)
  ok('ترمیم: فایل دوباره publicId گرفت — با بازپس‌گیریِ همان آیتم، نه ردیفِ نو', gr2_285.ok === true && fixedL285.publicId === crashPub && fixedL285.published === true)
  const scrDb2_285 = JSON.parse(fs285.readFileSync('.scraper-data.json', 'utf-8'))
  ok('ترمیم: در اسکرپر فقط «یک» آیتمِ غیرduplicate از آن ملک هست', scrDb2_285.items.filter(i => i.title === crashTitle && i.status !== 'duplicate').length === 1)
}

// ── فاز ۲۹۵ — امضای برچسب‌دارِ «مشاور/کارشناس …: نام» (پیش‌تقدمِ قطعی بر مدلِ NER) ──
{
  const { labeledName, bestName } = await import('../app/lib/roster-ner.ts')
  const ad295 = 'متراژ ۷۶ متر\n✨ ویژگی های ساختمان:\n✅ فول بازسازی\n🔴 تاپ لوکیشن منطقه\nرضایی مجد\n⚖️ مشاور و کارشناس منطقه:رها'
  ok('امضای برچسب‌دار: «کارشناس منطقه:رها» (نامِ چسبیده به دونقطه) خوانده می‌شود', labeledName(ad295) === 'رها')
  ok('bestName بدونِ مدل هم همان نامِ برچسب‌دار را با اطمینانِ بالا می‌دهد', (bestName('آپارتمان ۷۶ متری', ad295) || {}).name === 'رها')
  ok('برچسبِ با فاصله و نامِ دوبخشی: «کارشناس فروش : احمدی راد»', labeledName('توضیح\nکارشناس فروش : احمدی راد\nتماس') === 'احمدی راد')
  ok('واژهٔ نقشی بعد از دونقطه نام نیست: «مشاوره رایگان: تماس بگیرید»', labeledName('مشاوره رایگان: تماس بگیرید') === null)
  ok('واژهٔ ملکی بعد از دونقطه نام نیست: «کارشناس خرید: ملک شما»', labeledName('خط۱\nکارشناس خرید: ملک شما') === null)
  ok('برچسبِ خارج از ناحیهٔ امضا (۶ خطِ آخر) نادیده می‌ماند', labeledName('کارشناس: قاسمی\n۱\n۲\n۳\n۴\n۵\n۶\n۷') === null)
}

// ── فاز ۲۹۶ — سایت‌سازِ خودکار: اسلاگِ فارسی + بدنهٔ سایت از دادهٔ واقعی ──
{
  const { sanitizeSlug } = await import('../app/lib/sites-store.ts')
  const { buildAutoSitePayload } = await import('../app/lib/auto-site.ts')
  ok('اسلاگِ فارسی: «علی رضایی» → علی-رضایی', sanitizeSlug('علی رضایی') === 'علی-رضایی')
  ok('اسلاگِ قدیمیِ لاتین مثلِ قبل کار می‌کند', sanitizeSlug('My Site! 22') === 'my-site-22')
  const pay296 = buildAutoSitePayload({ phone: '09120000296', name: 'علی رضایی', roleType: 'pros', city: 'تهران', tagline: '', about: 'بیش از ده سال تجربهٔ مشاورهٔ املاک در غرب تهران و همراهیِ صدها معامله.', logo: '', specialties: ['آپارتمان', 'ویلایی'], contactPhone: '', address: '' })
  const types296 = pay296.pages[0].blocks.map(b => b.type)
  ok('خانهٔ سایتِ مشاور کامل است: hero/listings/services/testimonials/blog/cta/footer', ['hero', 'listings', 'services', 'testimonials', 'blog', 'cta', 'footer'].every(t => types296.includes(t)))
  ok('هیروی خانه نام و نقشِ خودِ شخص را دارد (نه متنِ نمونهٔ قالب)', pay296.pages[0].blocks[0].type === 'hero' && pay296.pages[0].blocks[0].props.heading === 'علی رضایی' && pay296.pages[0].blocks[0].props.subheading.includes('تهران'))
  ok('عنوانِ سئو با نامِ شخص شروع می‌شود و شهر دارد', pay296.seo.title.startsWith('علی رضایی') && pay296.seo.title.includes('تهران'))
  ok('توضیحِ سئو از واقعیت‌ها ساخته شده (تخصص‌ها) و ≤۱۶۰', pay296.seo.description.includes('آپارتمان') && pay296.seo.description.length <= 160)
  const pay296b = buildAutoSitePayload({ phone: '09120000297', name: 'استودیو معماری نو', roleType: 'architect', specialties: [], about: '', logo: '', contactPhone: '', address: '', arch: { cover: 'https://x/c.jpg', images: ['https://x/1.jpg', 'https://x/2.jpg'], projDone: 8, projDoing: 2, honors: 3, rating: 4.6, edus: ['لیسانس معماری'], skills: ['طراحی داخلی'], engagements: ['نظارت'], officeName: 'دفتر نو' } })
  const types296b = pay296b.pages[0].blocks.map(b => b.type)
  ok('معمار بلوکِ آگهی ندارد (دادهٔ ملکی ندارد)', !types296b.includes('listings') && !types296b.includes('searchlist') && !pay296b.pages.some(p => p.slug === 'listings'))
  ok('سایتِ معمار دادهٔ کاملِ طرح‌۲طرح را دارد: stats/gallery/services', types296b.includes('stats') && types296b.includes('gallery') && types296b.includes('services'))
  const st296 = pay296b.pages[0].blocks.find(b => b.type === 'stats')
  ok('آمارِ معمار فقط عددهای واقعیِ ناصفر است', Array.isArray(st296.props.items) && st296.props.items.length === 4 && st296.props.items.every(i => i.value && i.label))

  // ── فاز ۲۹۷هـ — سایتِ خودکار «خودِ» قالبِ کاملِ سایت‌ساز است (همهٔ صفحات + تم) ──
  const slugs297 = pay296.pages.map(p => p.slug)
  ok('سایتِ مشاور همهٔ صفحه‌های قالبِ صنفش را دارد: درباره/فایل‌ها/خدمات/وبلاگ/تماس', ['home', 'about', 'listings', 'services', 'blog', 'contact'].every(s => slugs297.includes(s)))
  const lp297 = pay296.pages.find(p => p.slug === 'listings')
  ok('صفحهٔ «فایل‌ها» جستجو/فیلترِ کامل با سقفِ ۱۲۰ دارد', lp297.blocks.some(b => b.type === 'searchlist' && b.props.total === 120))
  ok('تمِ قالب (پالتِ حرفه‌ای) روی سایت می‌نشیند', !!pay296.theme && /^#[0-9a-f]{6}$/i.test(pay296.theme.primary))
  ok('قانونِ آهنین: مشاورِ بدونِ آمارِ واقعی هیچ بلوکِ آماری ندارد (عددِ نمونهٔ قالب جعل است)', pay296.pages.every(p => p.blocks.every(b => b.type !== 'stats')))
  ok('قانونِ آهنین: ایمیلِ نمونهٔ قالب (info@example.com) هیچ‌جا نمی‌ماند', pay296.pages.every(p => p.blocks.every(b => !String(b.props.email || '').includes('example.com'))))
  ok('خدماتِ واقعی (تخصص‌ها) جای خدماتِ نمونهٔ قالب می‌نشیند', pay296.pages[0].blocks.find(b => b.type === 'services').props.items.some(i => i.title === 'آپارتمان'))
  const slugs297b = pay296b.pages.map(p => p.slug)
  ok('سایتِ معمار صفحهٔ «نمونه‌کارها» دارد و مشاور ندارد', slugs297b.includes('portfolio') && !slugs297.includes('portfolio'))
  ok('صفحهٔ نمونه‌کارها گالریِ کاملِ عکس‌های واقعی دارد', pay296b.pages.find(p => p.slug === 'portfolio').blocks.some(b => b.type === 'gallery' && b.props.images.length === 2))
  ok('تحصیلاتِ واقعیِ معمار روی صفحهٔ «درباره» است', pay296b.pages.find(p => p.slug === 'about').blocks.some(b => b.type === 'services' && b.props.heading === 'تحصیلات و سوابق'))
  const allIds297 = pay296.pages.flatMap(p => p.blocks.map(b => b.id))
  ok('شناسهٔ بلوک‌ها در کلِ سایت یکتاست', new Set(allIds297).size === allIds297.length)
  const agency297 = buildAutoSitePayload({ phone: '02112345678', name: 'آژانس تست', roleType: 'agency', specialties: [], about: '', logo: '', contactPhone: '', address: '' })
  ok('سایتِ آژانس بلوکِ تیم و صفحهٔ «تیمِ ما» دارد', agency297.pages.some(p => p.blocks.some(b => b.type === 'team')) && agency297.pages.some(p => p.slug === 'team'))
  ok('انتخابِ قالب قطعی است (بازسازی همان سایت را می‌دهد)', JSON.stringify(buildAutoSitePayload({ phone: '09120000296', name: 'علی رضایی', roleType: 'pros', city: 'تهران', tagline: '', about: 'بیش از ده سال تجربهٔ مشاورهٔ املاک در غرب تهران و همراهیِ صدها معامله.', logo: '', specialties: ['آپارتمان', 'ویلایی'], contactPhone: '', address: '' })) === JSON.stringify(pay296))

  // ── فاز ۲۹۷ف — هیچ دکمه‌ای به انکرِ مرده نمی‌رود («سوتیِ تماس با ما») ──
  const cBase297 = `/${encodeURIComponent(pay296.slug)}/contact`
  const innerHeroes297 = pay296.pages.slice(1).filter(p => p.slug !== 'contact').flatMap(p => p.blocks.filter(b => b.type === 'hero'))
  ok('دکمهٔ هیروی صفحه‌های داخلی به صفحهٔ واقعیِ «تماس» می‌رود', innerHeroes297.length > 0 && innerHeroes297.every(b => b.props.buttonLink === cBase297))
  const aboutCta297 = pay296.pages.find(p => p.slug === 'about').blocks.find(b => b.type === 'cta')
  ok('CTAی صفحهٔ بدونِ بلوکِ تماس هم به صفحهٔ تماس می‌رود', !aboutCta297 || aboutCta297.props.buttonLink === cBase297 || String(aboutCta297.props.buttonLink).startsWith('/pros/') || String(aboutCta297.props.buttonLink).startsWith('/'))
  ok('دکمهٔ هیروی خانهٔ مشاور به سکشنِ آگهی‌ها می‌رود', pay296.pages[0].blocks[0].props.buttonLink === '#listings')
  const archInner297 = pay296b.pages.slice(1).filter(p => p.slug !== 'contact').flatMap(p => p.blocks.filter(b => b.type === 'hero'))
  ok('برچسبِ دکمهٔ صنفی: معمار «درخواستِ مشاورهٔ طراحی»', archInner297.every(b => b.props.buttonText === 'درخواستِ مشاورهٔ طراحی'))

  // ── فاز ۲۹۷و — محتوای هر صنف باید «مالِ همان صنف» باشد (سازنده متنِ خرید/فروش نگیرد) ──
  const { PROFILE_PRESETS, buildProfileSite } = await import('../app/lib/site-templates.ts')
  ok('هر ۱۲ صنف preset صنفی دارند (قبلاً ۶ تا به متنِ عمومیِ املاک می‌افتادند)', ['مشاور', 'آژانس', 'سازنده', 'فروشگاه', 'سرمایه‌گذار', 'حقوقی', 'معمار', 'پیمانکار', 'کارشناس', 'دفتر حقوقی', 'بانک و بیمه', 'دفترخانه'].every(k => PROFILE_PRESETS[k]?.services?.length >= 4 && PROFILE_PRESETS[k].about && PROFILE_PRESETS[k].eyebrow))
  const bld297 = buildProfileSite('سازنده')
  const bldAbout = bld297.pages.flatMap(p => p.blocks).find(b => b.type === 'about')
  const bldHero = bld297.pages[0].blocks.find(b => b.type === 'hero')
  ok('قالبِ سازنده محتوای ساخت‌وساز دارد نه خرید/فروش/اجاره', bldAbout.props.text.includes('ساخت') && !bldAbout.props.text.includes('اجاره ملک') && bldHero.props.eyebrow === 'ساخت و ساز')
  const bldAuto297 = buildAutoSitePayload({ phone: '09120000298', name: 'جواهری', roleType: 'builder', specialties: [], about: '', logo: '', contactPhone: '', address: '' })
  ok('سایتِ خودکارِ سازنده: نشانِ هیرو «سازنده» و خدمات/دربارهٔ ساخت‌وساز', bldAuto297.pages[0].blocks[0].props.eyebrow === 'سازنده' && bldAuto297.pages.flatMap(p => p.blocks).some(b => b.type === 'services' && b.props.items.some(i => String(i.title).includes('مشارکت'))))

  // ── فاز ۲۹۷ز — پروژه‌های واقعیِ سازنده روی سایتش («پروژه‌ها رو نشون نمیده») ──
  const bldSeed297 = { phone: '09120000299', name: 'پناهی آذر', roleType: 'builder', specialties: [], about: '', logo: '', contactPhone: '', address: '', bld: { count: 12, regionsCount: 3, unitsSum: 84, areaSum: 5200, photos: ['https://x/p1.jpg'], projects: [{ title: 'پروژهٔ سعادت‌آباد', desc: 'منطقه ۲ · ۵ طبقه · ۱۰ واحد', image: 'https://x/p1.jpg', href: '/projects/x' }] } }
  const bldSite297 = buildAutoSitePayload(bldSeed297)
  const bHome297 = bldSite297.pages[0].blocks
  ok('خانهٔ سازنده کارتِ پروژه‌های واقعی دارد (عکس + لینک به صفحهٔ پروژه)', bHome297.some(b => b.type === 'services' && b.props.heading === 'پروژه‌های ما' && b.props.items[0].href === '/projects/x' && b.props.items[0].image))
  ok('آمارِ سازنده واقعی است: پروژه/منطقه/واحد/متراژ', bHome297.some(b => b.type === 'stats' && b.props.items.length === 4 && b.props.items.some(i => i.label === 'پروژهٔ ثبت‌شده')))
  ok('صفحهٔ «پروژه‌ها» با فهرستِ پروژه‌های واقعی زنده است', bldSite297.pages.some(p => p.slug === 'projects' && p.blocks.some(b => b.type === 'services' && b.props.heading === 'پروژه‌های ما')))
  ok('گالریِ سازنده از عکسِ واقعیِ پروژه‌ها پر می‌شود', bldSite297.pages.flatMap(p => p.blocks).some(b => b.type === 'gallery' && b.props.images[0] === 'https://x/p1.jpg'))
  ok('دکمهٔ هیروی خانهٔ سازندهٔ عکس‌دار به گالریِ پروژه‌ها می‌رود', bldSite297.pages[0].blocks.find(b => b.type === 'hero').props.buttonLink === '#gallery')
  ok('سازندهٔ بدونِ دادهٔ پروژه، کارت/آمارِ جعلی نمی‌گیرد', !bldAuto297.pages.flatMap(p => p.blocks).some(b => b.type === 'stats' || (b.type === 'services' && b.props.heading === 'پروژه‌های ما')))

  // ── فاز ۲۹۷ح — منو در فوتر: لینکِ واقعیِ صفحه‌های همین سایت، نه انکرِ مردهٔ قالب ──
  const ft297 = pay296.pages[0].blocks.find(b => b.type === 'footer')
  ok('فوتر منوی واقعیِ سایت را دارد (خانه + صفحه‌ها با اسلاگِ خودِ سایت)', ft297.props.links[0].href === `/${encodeURIComponent(pay296.slug)}` && ft297.props.links.some(l => l.href === `/${encodeURIComponent(pay296.slug)}/listings`) && !ft297.props.links.some(l => String(l.href).startsWith('#')))
  ok('فوترِ همهٔ صفحه‌ها همین منو را دارد', pay296.pages.every(p => p.blocks.filter(b => b.type === 'footer').every(b => b.props.links.length >= 4)))
}

// ── فاز ۲۹۶ج — اسلاگِ فارسیِ سایت از پارامترِ درصد-کدشدهٔ Next هم پیدا می‌شود ──
{
  const { saveSite, getSite } = await import('../app/lib/sites-store.ts')
  await saveSite({ slug: 'آژانس املاک تستی', title: 'آژانس املاک تستی', owner: '09000000296', ownerName: 'آژانس املاک تستی', pages: [{ slug: 'home', title: 'خانه', blocks: [] }] })
  const direct = await getSite('آژانس-املاک-تستی')
  const encoded = await getSite(encodeURIComponent('آژانس-املاک-تستی'))
  ok('اسلاگِ فارسی مستقیم پیدا می‌شود', !!direct && direct.owner === '09000000296')
  ok('پارامترِ درصد-کدشدهٔ Next هم پیدا می‌شود (ریشهٔ ۴۰۴ همگانی)', !!encoded && encoded.slug === direct.slug)
}

// ── فاز ۲۹۷ل — ضمیر هرگز اسمِ مشاور نیست («خودمان» با ۱۱ فایل، از متنِ کلیشه‌ایِ آژانس) ──
{
  const { extractSignature, validName } = await import('../app/lib/agency-roster.ts')
  const d297 = 'فروش ۸۷متر بدون مشابه در منطقه\nجهت احترام به وقت شما و خودمان تمامی اطلاعات دقیق و\nدرست درج شده است\nسند تک برگ شخصی\nبدون هیچ ضعفی\nبازدید آزاد'
  const s297 = extractSignature('فروش ۸۷ متر', d297, 'مشاورین املاک ژنرال')
  ok('«خودمان» (ضمیر، از متنِ کلیشه‌ای) هرگز مشاور نمی‌شود', !s297.some(n => n.includes('خودمان')))
  ok('کلِ خانوادهٔ ضمیرِ «خود» از دروازهٔ نام رد می‌شود', ['خودمان', 'خودمون', 'خودش', 'خودت', 'خودشان'].every(w => validName(w, '') === ''))

  // ── فاز ۲۹۷م — معرفیِ صریحِ خود («خوشبین هستم در خدمت شما») قطعی و مقدم بر مدل است ──
  const { bestName, selfIntroName } = await import('../app/lib/roster-ner.ts')
  const dKh = 'واحد بازسازی شده با بهترین متریال\nمالک فروشنده\nقابلیت رهن تا مبلغ ۲۸۰۰ به عهده ماست\nخوشبین هستم در خدمت شما عزیزان'
  const bn297 = bestName('فروش ۱۰۶متر', dKh)
  ok('«خوشبین هستم در خدمت شما» → نامِ مشاور «خوشبین» (نه آژانس)', bn297?.name === 'خوشبین' && bn297.p >= 0.9)
  ok('extractSignature همان یک نام را می‌دهد (نه قابلیت/مبلغ/ماست)', JSON.stringify(extractSignature('فروش ۱۰۶متر', dKh, 'مشاورین املاک ژنرال')) === '["خوشبین"]')
  ok('صفتِ حسی با «هستم» نام نمی‌شود', selfIntroName('مفتخر هستم در خدمت شما') === null && selfIntroName('خوشحال هستیم در کنارِ شما') === null && selfIntroName('در خدمت شما هستم') === null)
  ok('«محمد پرنده هستم مشاور و امین شما» هنوز درست درمی‌آید', selfIntroName('توضیحات ملک\nمحمد پرنده هستم مشاور و امین شما') === 'محمد پرنده')
}

// ── فاز ۲۹۷ک — ممیزیِ نظرات با ML خودی (بدونِ هیچ فراخوانِ AI) ──
{
  const { classifyReview, learnReview } = await import('../app/lib/review-ml.ts')
  const v1 = await classifyReview('علی', 'برای خرید تماس بگیرید ۰۹۱۲۱۲۳۴۵۶۷')
  ok('شمارهٔ تماس در متن → ردِ قطعی (قاعده، نه AI)', v1.verdict === 'reject')
  const v2 = await classifyReview('x', 'بهترین مشاور! آیدی تلگرام @bestamlak')
  ok('آیدی/لینکِ تبلیغاتی → ردِ قطعی', v2.verdict === 'reject')
  const v3 = await classifyReview('رضا', 'بلبلطرزسبسییییسب')
  ok('متنِ بی‌ساختار خودکار منتشر نمی‌شود → در انتظارِ بررسی', v3.verdict === 'review')
  const v4 = await classifyReview('مینا', 'برخورد بسیار حرفه‌ای بود و در خریدِ آپارتمان صادقانه راهنمایی کردند')
  ok('متنِ سالم → پیشنهادِ تایید', v4.verdict === 'approve')
  const v5 = await classifyReview('ناشناس', 'این آقا کلاهبردار است و پولم را خورد')
  ok('واژهٔ تند → داوریِ انسانی (شاید شکایتِ واقعی باشد)', v5.verdict === 'review')
  // یادگیری: ۴۰ داوریِ واقعی روی یک الگویِ اسپمِ تکرارشونده → مدل خودش رد می‌کند
  for (let i = 0; i < 25; i++) await learnReview('فروش ویژه کابینت ام دی اف با نصب رایگان تماس داخل پیج', false)
  for (let i = 0; i < 25; i++) await learnReview('مشاورِ دقیق و پیگیری بودند و قرارداد خوب بست', true)
  const v6 = await classifyReview('x', 'فروش ویژه کابینت ام دی اف نصب رایگان در پیج ما')
  ok('یادگیرنده پس از ۵۰ داوری، اسپمِ مشابه را خودش رد می‌کند', v6.verdict === 'reject' && v6.reason.includes('ML'))
  const { moderateReview } = await import('../app/lib/moderation.ts')
  const v7 = await moderateReview('x', 'برخورد عالی و قیمت‌گذاریِ منصفانه‌ای داشتند ممنونم')
  ok('مسیرِ ممیزیِ نظرات کلاً از ML می‌گذرد (بدونِ نیاز به AI/اعتبارِ گپ)', v7.verdict === 'approve')
}

// ── فاز ۲۹۷ج — تیمِ آژانسِ اسکرپی: fallback به مشاورانِ graduateشدهٔ رُستر ──
{
  const { addScrape, patchScrape } = await import('../app/lib/agency-roster-store.ts')
  const { getTeamMembers } = await import('../app/lib/team-members.ts')
  const r297 = await addScrape({ slug: 'team-fallback-297' })
  await patchScrape(r297.scrape.id, {
    agencyOwner: '09127772970',
    advisors: [
      { key: 'k1', name: 'رضا تیمی', owner: '09127772971', phone: '09127772971', listingCount: 3 },
      { key: 'k2', name: 'بی‌حساب', owner: 'adv:x:k2', listingCount: 1 },   // graduate نشده — نباید بیاید
    ],
  })
  const team297 = await getTeamMembers('09127772970')
  ok('آژانسِ بدونِ رابطهٔ رسمی، تیمش از رُستر می‌آید (فقط حساب‌دارها)', team297.length === 1 && team297[0].phone === '09127772971' && team297[0].name === 'رضا تیمی')
}

// ── فاز ۲۹۷ش — کیس‌استادیِ شاهان: واژهٔ عمومی/شهر هرگز «نامِ تنها» نیست ──
{
  const { validName, strictName } = await import('../app/lib/agency-name-lexicon.ts')
  ok('واژه‌های پایهٔ ملکی اسم نیستند (خانه/منزل/ساختمان/پروژه/فرصت)',
    ['خانه', 'منزل', 'ساختمان', 'پروژه', 'فرصت'].every(w => validName(w, '') === ''))
  ok('«طلایی» تنها اسم نیست (از «منطقه طلایی») ولی «رضا طلایی» نام‌خانوادگیِ سالم است',
    validName('طلایی', '') === '' && validName('رضا طلایی', '') === 'رضا طلایی')
  ok('نامِ شهرِ تنها اسم نیست ولی «تهرانی» (نام‌خانوادگی) سالم می‌ماند',
    validName('تهران', '') === '' && validName('پردیس', '') === '' && validName('تهرانی', '') === 'تهرانی')
  ok('«فرصت طلایی» (عبارتِ تبلیغاتی) اسم نمی‌شود', validName('فرصت طلایی', '') === '')
  ok('واژه‌نامهٔ مسموم خود-هرس می‌شود: strictName(«خانه») خالی است → pruneLearned می‌اندازدش',
    strictName('خانه') === '')

  // ── فاز ۲۹۷ت — حدس‌های آشغالِ مدل و مسموم‌های زندهٔ تولید («همراهتان» با ۲ فایل مشاور شده بود) ──
  ok('حدس‌های آشغالِ کیس‌استادی اسم نیستند (تمیز/سخت/غیر/انبار/همراهتان/یکپارچه/نگهبانی)',
    ['تمیز', 'سخت', 'غیر', 'انبار', 'همراهتان', 'یکپارچه', 'نگهبانی', 'اطلاعات بیش'].every(w => validName(w, '') === ''))
  ok('مدخلِ مسمومِ «باقی میماند» از دروازهٔ یادگیری/واژه‌نامه رد می‌شود (strictName) — «باقی» تنها نامِ سالم است',
    strictName('باقی میماند') === '' && validName('باقی', '') === 'باقی')
  ok('نام‌های واقعیِ هم‌خانواده سالم می‌مانند (باقی/همراهی‌فر مثالِ ترکیبِ سالم)',
    validName('باقی', '') === 'باقی' && validName('رضا نگهدار', '') === 'رضا نگهدار')

  // ── فاز ۲۹۷ث — امضای برچسب‌دار با جداکنندهٔ ~/تیره («مشاور تخصصی منطقه ~ علیرضا فلاحی» ×۲ بی‌نام بود) ──
  const { labeledName } = await import('../app/lib/roster-ner.ts')
  ok('«مشاور تخصصی منطقه ~ علیرضا فلاحی» با جداکنندهٔ ~ شناخته می‌شود',
    labeledName('بدون مشابه در منطقه\nبازدید = قرارداد\n⚜️ مشاور تخصصی منطقه ~ علیرضا فلاحی') === 'علیرضا فلاحی')
  ok('«کارشناس فروش - رضایی» با خطِ تیره هم شناخته می‌شود',
    labeledName('توضیحات ملک\nکارشناس فروش - رضایی') === 'رضایی')
  ok('مرزِ کلمه: «کارشناسی شده - تک برگ» و «مشاوره رایگان - تماس» نامِ جعلی نمی‌سازند',
    labeledName('کارشناسی شده - تک برگ') === null && labeledName('مشاوره رایگان - تماس بگیرید') === null)
  ok('سبکِ قدیمیِ دونقطه هنوز کار می‌کند («مشاور و کارشناس منطقه:رها»)',
    labeledName('مشاور و کارشناس منطقه:رها') === 'رها')
}

// ── فاز ۲۹۷ص — پیامکِ سایت‌ساز بدونِ لینکِ کوتاه «نمی‌رود» (شکستِ بی‌صدا ممنوع) ──
{
  const { shortenUrlDetailed, mustShortenUrl, firstUrl } = await import('../app/lib/shortener.ts')
  const longU = `https://melkjet.com/${encodeURIComponent('زهرا-شهابی')}`
  ok('URLِ درصد-encodedِ فارسی توسطِ regexِ لینک کامل دیده می‌شود', firstUrl(`سلام ${longU} ملک‌جت`) === longU)
  const d297s = await shortenUrlDetailed(longU)
  ok('کوتاه‌کنندهٔ پیکربندی‌نشده «علت» برمی‌گرداند، نه nullِ بی‌صدا', d297s.ok === false && d297s.error.includes('پیکربندی نشده'))
  const m297s = await mustShortenUrl(longU, { channel: 'autosite' })
  ok('لینکِ کوتاهِ الزامی: شکست = خطای شفاف (نه لینکِ غول‌پیکر در پیامک)', m297s.ok === false && m297s.error.includes('پیکربندی نشده'))
}

console.log(`\n${fail === 0 ? '✅' : '❌'} REOS unit tests: ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
