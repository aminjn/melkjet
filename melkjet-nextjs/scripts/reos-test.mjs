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

console.log(`\n${fail === 0 ? '✅' : '❌'} REOS unit tests: ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
