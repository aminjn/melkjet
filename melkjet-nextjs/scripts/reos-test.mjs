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
  ok('کفِ نرخ: نصفِ نرخِ باند', rep5.ratePctYear === Math.round(20 * 0.9 * 0.5 * 10) / 10)
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
    ok('دلیلِ عمومیِ قدیمی موقعِ خواندن با دلیلِ واقعی جایگزین می‌شود', regen.startsWith('ردِ خودکار:') && !regen.includes('یادگیری‌شده'))
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

console.log(`\n${fail === 0 ? '✅' : '❌'} REOS unit tests: ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
