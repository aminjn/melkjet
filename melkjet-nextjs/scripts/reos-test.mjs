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

console.log(`\n${fail === 0 ? '✅' : '❌'} REOS unit tests: ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
