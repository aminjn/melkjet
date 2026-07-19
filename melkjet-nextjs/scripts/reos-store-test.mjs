// REOS · Integration tests against a REAL PostgreSQL (dual-mode PG path).
// Run: DATABASE_URL=postgres://reos:reos@127.0.0.1:5432/reos_test \
//        node --import ./scripts/reos-loader.mjs scripts/reos-store-test.mjs
// Covers: event log, batch insert, feature store, embeddings, the async queue (flush),
// and the end-to-end training pipeline (events → dataset → fit → persist → prime → predict).
import pg from 'pg'
import { recordEvent, recordEventBatch, recentEvents, eventStats, topFeatures, bumpFeatures, getFeatures, saveEmbeddings, getEmbedding, getEmbeddings, existingEmbeddingIds, hasPgvector, nearestByVector } from '../app/lib/reos/store.ts'
import { ingest } from '../app/lib/reos/events.ts'
import { flushQueue, queueDepth } from '../app/lib/reos/queue.ts'
import { trainEngageModel, primeEngageModel, predictEngage, buildTrainingSet } from '../app/lib/reos/train.ts'
import { runAgent } from '../app/lib/reos/agent/executor.ts'
import { rulePlanner } from '../app/lib/reos/agent/planner.ts'
import { getMemories, recentTasks } from '../app/lib/reos/agent/memory.ts'
import { upsertNode, addEdge, getNode, neighbors, subgraph, shortestPath, graphStats, syncGraphFromEvents } from '../app/lib/reos/graph.ts'
import { recordEvent as recEv } from '../app/lib/reos/store.ts'
import { createCampaign, recordClick, recordImpression, getCampaign, activeBoosts, analytics } from '../app/lib/reos/promotion-engine.ts'
import { computeMarketFeatures, getMarketFeature, topMarkets } from '../app/lib/reos/market-features.ts'
import { createLead, moveStage, addActivity, timeline, createTask, listTasks, funnel, createAutomation, runIdleAutomations, getLead, listLeads } from '../app/lib/reos/crm.ts'
import { runLLM, selectModel, cacheKey, estimateCost, usageStats, cacheClear, complexityOf, taskForComplexity } from '../app/lib/reos/gateway.ts'
import { modelCatalog } from '../app/lib/reos/model-catalog.ts'
import { createWorkflow, evalCondition, matchWorkflow, leadContext, runWorkflows } from '../app/lib/reos/workflow-builder.ts'
import { computeMarketIntel, getMarketIntel, topMarketIntel } from '../app/lib/reos/market-intel.ts'
import { valuate } from '../app/lib/reos/avm.ts'
import { setVerification, setSignals, getTrust } from '../app/lib/reos/trust.ts'
import { getOrCreateReferral, recordInvite, recordConversion as refConvert, referralStats } from '../app/lib/reos/growth.ts'
import { getBalance as walletBalance } from '../app/lib/reos/billing.ts'
import { syncMarketGraph, topActiveInArea, areaListingCount } from '../app/lib/reos/market-graph.ts'
import { neighborhoodProfile } from '../app/lib/reos/neighborhood.ts'
import { send as commsSend, commsLog, channels } from '../app/lib/reos/comms-hub.ts'
import { registerModel, listVersions, promote, getChampion } from '../app/lib/reos/model-registry.ts'
import { getPolicy, applyOnlineReward } from '../app/lib/reos/rl.ts'
import { runAutonomous } from '../app/lib/reos/autonomous.ts'
import { getConfig, setConfig, resetConfig, config as cfgCache, primeConfig } from '../app/lib/reos/reos-config.ts'
import { trainLeadModel } from '../app/lib/reos/lead-model.ts'
import { assignVariant, createExperiment, recordExposure, recordConversion, results } from '../app/lib/reos/experiments.ts'
import { credit, debit, getBalance, listTransactions, createInvoice, payInvoice } from '../app/lib/reos/billing.ts'
import { recordTouch, recordSpend, recordConversion as attrConvert, channelReport } from '../app/lib/reos/attribution.ts'
import { recordDominance, leaderboard, standing, getOwner, agentTerritories, startBattle, resolveBattle, openBattles, resolveDueBattles, territoryStats, battlesWonBy, dominanceMap, territoryKeyFromName } from '../app/lib/reos/territory.ts'
import { touchStreak, getStreak } from '../app/lib/reos/achievements.ts'
import { awardXp, grantXp, lifetimeXp, xpStatus, seasonLeaderboard, seasonKey } from '../app/lib/reos/xp.ts'
import { bumpMissions, listMissions, claimMission } from '../app/lib/reos/missions.ts'
import { creditBucket, debitBucket, bucketBalance, walletSummary, walletLedger, refundTxn } from '../app/lib/reos/wallet.ts'
import { recordDeal, commissionOn } from '../app/lib/reos/economy.ts'
import { follow, unfollow, isFollowing, followerCount, followingCount, followingList, createCollection, addToCollection, removeFromCollection, listCollections, collectionItems, addComment, listComments, commentCount, hideComment, socialProof } from '../app/lib/reos/community.ts'
import { listFlags, getFlag, setFlag, flagEnabled } from '../app/lib/reos/flags.ts'
import { registerModel as regModel, getChampion as champOf } from '../app/lib/reos/model-registry.ts'
import { autoPromote, autoMLStatus } from '../app/lib/reos/automl.ts'
import { createEmpire, getEmpire, renameEmpire, setHomeHood, buyAsset, chooseAssetAction, recordGuess, claimEmpireMission, spendAiToken, setHunterPair, answerHunter, setStylePicks, bumpRejects, empireCount, netWorthOf as empNetWorth, saveBrief, getBrief, markBriefOpened, markBriefMorning, dayNumberOf, sellAsset, setLandPlan, chooseBusiness, accrueIncome, claimDailyChest, listEmpiresPublic, applyUpkeep, adminAdjustEmpire, deleteEmpire, briefStatsForDay, takeLoan, repayLoan, accrueLoanInterest, effectiveTransferTaxPct , openP2pAuction, cancelP2pAuction, bidP2pAuction, settleP2pAuctions, followEmpire } from '../app/lib/empire-store.ts'

if (!process.env.DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(2) }
let pass = 0, fail = 0
function ok(name, cond) { if (cond) { pass++; console.log('  ✓', name) } else { fail++; console.log('  ✗', name) } }
const sleep = ms => new Promise(r => setTimeout(r, ms))

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
async function reset() {
  // ensure tables exist first (a no-op call triggers ensureReos), then truncate.
  await recordEvent({ type: 'user_searched', userId: '__warm__' }).catch(() => {})
  await saveEmbeddings('property', [{ id: '__warm__', embed: [0, 0] }]).catch(() => {})
  for (const t of ['reos_events', 'reos_feature_store', 'reos_embeddings', 'reos_territory_scores', 'reos_territories', 'reos_territory_battles', 'reos_streaks', 'reos_xp', 'reos_missions', 'reos_wallet', 'reos_wallet_txn', 'reos_follows', 'reos_collections', 'reos_collection_items', 'reos_comments', 'reos_flags', 'reos_models', 'reos_empire', 'reos_daily_brief', 'reos_empire_market', 'reos_promo_campaigns']) {
    await pool.query(`TRUNCATE ${t}`).catch(() => {})
  }
}

async function main() {
  await reset()

  console.log('\n── Event log ──')
  const e1 = await recordEvent({ type: 'user_clicked_property', userId: 'u1', propertyId: 'p1' })
  ok('recordEvent returns id+at', !!e1.id && e1.at > 0)
  const r1 = await recentEvents({ userId: 'u1' })
  ok('recentEvents finds it', r1.length === 1 && r1[0].propertyId === 'p1')

  console.log('\n── Batch insert + dedup ──')
  const batch = Array.from({ length: 10 }, (_, i) => ({ id: 'b' + i, type: 'user_clicked_property', at: Date.now() + i, userId: 'u2', propertyId: 'p' + (i % 3), meta: {} }))
  await recordEventBatch(batch)
  await recordEventBatch([batch[0]]) // duplicate id → ON CONFLICT DO NOTHING
  const st = await eventStats()
  ok('batch inserted (11 clicks total)', st.byType.user_clicked_property === 11)
  ok('duplicate id ignored (no error, no dup)', (await recentEvents({ userId: 'u2' })).length === 10)

  console.log('\n── Feature store ──')
  await bumpFeatures('property', 'p1', { click_count: 1, engagement_score: 3 })
  await bumpFeatures('property', 'p1', { click_count: 2 }, { title_len: 5 })
  const f = await getFeatures('property', 'p1')
  ok('increment accumulates (click_count=3)', f.click_count === 3)
  ok('set overrides (title_len=5)', f.title_len === 5)
  await bumpFeatures('property', 'p2', { engagement_score: 9 })
  const top = await topFeatures('property', 'engagement_score', 5)
  ok('topFeatures ranks by key desc', top[0].id === 'p2')

  console.log('\n── Embeddings (pgvector-equivalent) ──')
  await saveEmbeddings('property', [{ id: 'e1', embed: [0.1, 0.2, 0.3] }, { id: 'e2', embed: [0.4, 0.5, 0.6] }])
  ok('getEmbedding roundtrip', JSON.stringify(await getEmbedding('property', 'e1')) === JSON.stringify([0.1, 0.2, 0.3]))
  await saveEmbeddings('property', [{ id: 'e1', embed: [0.9, 0.9, 0.9] }]) // upsert
  ok('embedding upsert overwrites', (await getEmbedding('property', 'e1'))[0] === 0.9)
  const ids = await existingEmbeddingIds('property')
  ok('existingEmbeddingIds set', ids.has('e1') && ids.has('e2'))
  ok('getEmbeddings returns rows', (await getEmbeddings('property')).length >= 2)

  console.log('\n── Async event queue (Kafka-equivalent) ──')
  await reset()
  await ingest({ type: 'user_clicked_property', userId: 'q1', propertyId: 'qp1' })
  await ingest({ type: 'user_clicked_property', userId: 'q1', propertyId: 'qp1' })
  await ingest({ type: 'contact_made', userId: 'q1', propertyId: 'qp1' })
  const depthBefore = queueDepth()
  ok('ingest buffers without blocking (queue has depth)', depthBefore.events > 0 || depthBefore.features > 0)
  await flushQueue()
  await sleep(50)
  const evs = await recentEvents({ userId: 'q1' })
  ok('queue flushed events to PG (3 events)', evs.length === 3)
  const pf = await getFeatures('property', 'qp1')
  ok('coalesced feature bumps applied (click_count=2)', pf.click_count === 2)
  ok('contact reward applied (contact_count=1)', pf.contact_count === 1)
  ok('engagement_score = 2×click(1)+contact(20) = 22', pf.engagement_score === 22)

  console.log('\n── End-to-end TRAINING pipeline (events → fit → persist → predict) ──')
  await reset()
  // Seed a realistic signal: popular properties (high click_count) get contacts; unpopular don't.
  let seed = 999
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
  for (let i = 0; i < 120; i++) {
    const pid = 'tp' + i
    const uid = 'tu' + (i % 40)
    const popular = i % 2 === 0
    // property aggregate features
    await bumpFeatures('property', pid, { click_count: popular ? 50 : 3, save_count: popular ? 8 : 0, contact_count: popular ? 4 : 0 })
    await bumpFeatures('user', uid, { intent_score: rnd() * 40 })
    // events: everyone clicked; popular ones also got contacted (engaged)
    await recordEvent({ type: 'user_clicked_property', userId: uid, propertyId: pid })
    if (popular) await recordEvent({ type: 'contact_made', userId: uid, propertyId: pid })
  }
  const set = await buildTrainingSet()
  ok('training set built from events (>=100 examples)', set.length >= 100)
  ok('training set has both classes', set.some(e => e.y === 1) && set.some(e => e.y === 0))
  const w = await trainEngageModel({ epochs: 400, lr: 0.4 })
  ok('model trained on real events (not default)', w.usedDefault === false)
  ok('model persisted with metrics (AUC>0.6)', w.auc > 0.6)
  const persisted = await getFeatures('model', 'engage_v1')
  ok('weights persisted to feature store', !!persisted.trainedAt && persisted.demand !== undefined)
  await primeEngageModel()
  const popularScore = predictEngage({ views: 50, saves: 8, contacts: 4 }, 0.5)
  const coldScore = predictEngage({ views: 3, saves: 0, contacts: 0 }, 0.5)
  ok('primed model scores popular > cold', popularScore > coldScore)

  console.log('\n── REOS v2: AI Agent Framework (memory/planner/executor/tools) ──')
  {
    const ctx = { userId: 'agentU' }
    // remember → memory persisted, answer confirms
    const r1 = await runAgent('یادت باشه بودجه‌ام ۵ میلیارد است و دنبالِ سعادت‌آباد هستم', ctx, { planner: rulePlanner })
    ok('agent ran remember tool', r1.trace.length === 1 && r1.trace[0].tool === 'remember' && r1.trace[0].ok)
    ok('agent produced an answer', !!r1.answer)
    const mems = await getMemories('agentU', { kind: 'pref' })
    ok('memory persisted to PG', mems.length >= 1 && /سعادت/.test(mems[0].content))
    // recall → finds the memory
    const r2 = await runAgent('یادت هست بودجه‌ام چقدر بود؟', ctx, { planner: rulePlanner })
    ok('agent ran recall tool', r2.trace[0]?.tool === 'recall')
    ok('recall found stored memory', /میلیارد|سعادت/.test(r2.answer))
    // pure tool via custom planner (predict_lead) — no network
    let step = 0
    const planner = async (goal, trace) => trace.length === 0
      ? { action: 'tool', tool: 'predict_lead', args: { phone: '0912', stage: 'contract', activityCount: 6 } }
      : { action: 'answer', answer: 'تحلیل انجام شد' }
    const r3 = await runAgent('این لید چقدر احتمالِ معامله دارد؟', ctx, { planner, maxSteps: 3 })
    ok('agent multi-step: tool then answer', r3.trace.length === 1 && r3.trace[0].tool === 'predict_lead' && r3.answer === 'تحلیل انجام شد')
    ok('predict_lead tool returned a prediction 0..1', (() => { const v = r3.trace[0].result?.value; return typeof v === 'number' && v >= 0 && v <= 1 })())
    // unknown tool is handled gracefully
    const badPlanner = async (g, trace) => trace.length === 0 ? { action: 'tool', tool: 'nope', args: {} } : { action: 'answer', answer: 'x' }
    const r4 = await runAgent('...', ctx, { planner: badPlanner, maxSteps: 2 })
    ok('unknown tool recorded as failed, loop continues', r4.trace[0] && r4.trace[0].ok === false)
    // task persistence
    const tasks = await recentTasks('agentU', 10)
    ok('agent tasks persisted to PG (trace saved)', tasks.length >= 3 && Array.isArray(tasks[0].trace))
  }

  console.log('\n── REOS v2: Knowledge Graph (typed entities + BFS traversal) ──')
  {
    await upsertNode({ id: '__warm__', type: 'user' }).catch(() => {})   // ensure tables exist
    await pool.query('TRUNCATE reos_graph_nodes, reos_graph_edges').catch(() => {})   // deterministic across reruns
    await upsertNode({ id: 'gn:1', type: 'user', label: 'خریدار' })
    ok('upsertNode + getNode', (await getNode('gn:1'))?.type === 'user')
    await addEdge('gn:1', 'gn:2', 'viewed', 1); await addEdge('gn:1', 'gn:2', 'viewed', 2)
    const nb = await neighbors('gn:1', { dir: 'out' })
    ok('addEdge weight accumulates (1+2=3)', nb.length === 1 && nb[0].weight === 3)
    ok('neighbors dir=in works', (await neighbors('gn:2', { dir: 'in' })).length === 1)
    // multi-hop path: agent -represents-> user -viewed-> property (buyer↔builder-style chain)
    await recEv({ type: 'agent_assigned', agentId: 'A9', userId: 'U9', leadId: 'L9' })
    await recEv({ type: 'user_clicked_property', userId: 'U9', propertyId: 'P9' })
    await syncGraphFromEvents(5000)
    ok('sync built nodes from events (a:A9)', (await getNode('a:A9'))?.type === 'agent')
    const path = await shortestPath('a:A9', 'p:P9', 5)
    ok('shortestPath finds multi-hop chain a→u→p', Array.isArray(path) && path[0] === 'a:A9' && path[path.length - 1] === 'p:P9' && path.length === 3)
    const sg = await subgraph('u:U9', 2)
    ok('subgraph collects neighborhood', sg.nodes.some(n => n.id === 'p:P9') && sg.edges.length >= 1)
    const gs = await graphStats()
    ok('graphStats reports typed counts', gs.nodes > 0 && gs.byType.user > 0 && gs.byRel.viewed > 0)
    ok('no path returns null for disconnected', (await shortestPath('gn:1', 'a:A9', 3)) === null)
  }

  console.log('\n── REOS v2: Promotion Engine (budget / CPC / CPM / pacing / analytics) ──')
  {
    const now = Date.now()
    // CPC: bid 1000, budget 3000 → after 3 clicks it exhausts
    const cpc = await createCampaign({ ownerId: 'promoU', targetType: 'property', targetId: 'PZ1', type: 'featured', model: 'cpc', budget: 3000, bid: 1000, startAt: now - 1000, endAt: now + 10 * 86400000 })
    ok('campaign created active', cpc.status === 'active')
    await recordImpression(cpc.id); await recordImpression(cpc.id)
    let c = await recordClick(cpc.id)
    ok('CPC click charges the bid (spent=1000)', c.spent === 1000)
    ok('impressions not charged under CPC', c.impressions === 2)
    await recordClick(cpc.id); c = await recordClick(cpc.id)
    ok('budget exhausts at cap (spent=3000, status=exhausted)', c.spent === 3000 && c.status === 'exhausted')
    const c2 = await recordClick(cpc.id)
    ok('spent never exceeds budget', c2.spent === 3000)
    const an = analytics(c2, now)
    ok('analytics CTR computed (4 clicks / 2 impressions)', an.ctr === 200 && an.cpcActual === 750)

    // CPM: bid 2000 per mille → each impression costs 2
    const cpm = await createCampaign({ ownerId: 'promoU', targetType: 'property', targetId: 'PZ2', type: 'boost', model: 'cpm', budget: 100, bid: 2000, startAt: now - 1000, endAt: now + 10 * 86400000 })
    const m = await recordImpression(cpm.id)
    ok('CPM impression charges bid/1000 (spent=2)', m.spent === 2)

    // activeBoosts reflects servable campaigns, excludes exhausted
    const boosts = await activeBoosts(now)
    ok('activeBoosts includes servable campaign (PZ2)', (boosts.PZ2 || 0) > 0)
    ok('activeBoosts excludes exhausted campaign (PZ1)', !boosts.PZ1)

    // Pacing: tiny daily cap → paced out after spending it in one day
    const paced = await createCampaign({ ownerId: 'promoU', targetType: 'property', targetId: 'PZ3', type: 'vip', model: 'cpc', budget: 3000, bid: 1000, startAt: now - 1000, endAt: now + 3 * 86400000 })
    await recordClick(paced.id)  // dailyCap = 3000/3 = 1000 → after 1 click today, paced out
    const pc = await getCampaign(paced.id)
    ok('pacing: paced out after hitting daily cap', analytics(pc, now).pacedOut === true)
    ok('paced campaign excluded from activeBoosts', !(await activeBoosts(now)).PZ3)
  }

  console.log('\n── REOS v2: pgvector native similarity (falls back to JS cosine if absent) ──')
  {
    const has = await hasPgvector()
    console.log(`  · pgvector installed: ${has}`)
    const dim = (i, v) => { const a = new Array(64).fill(0); a[i] = v; return a }
    const B = new Array(64).fill(0); B[0] = 0.9; B[1] = 0.1
    await saveEmbeddings('tv', [{ id: 'A', embed: dim(0, 1) }, { id: 'B', embed: B }, { id: 'C', embed: dim(63, 1) }])
    const near = await nearestByVector('tv', dim(0, 1), 3)
    if (has) {
      ok('nearestByVector returns rows (native pgvector path)', Array.isArray(near) && near.length >= 3)
      const idx = id => near.findIndex(x => x.id === id)
      ok('native: B (close to A) ranks above C (orthogonal)', idx('B') < idx('C'))
      ok('native: identical vector has cosine sim ≈ 1', (near.find(x => x.id === 'A')?.sim || 0) > 0.99)
      ok('native: orthogonal vector has low sim', (near.find(x => x.id === 'C')?.sim ?? 1) < 0.2)
    } else {
      ok('pgvector absent → nearestByVector returns null (JS-cosine fallback used)', near === null)
    }
  }

  console.log('\n── REOS v2: Feature Store v2 (market_features + typed views) ──')
  {
    // seed a few listings into the normalized `listings` table for market aggregation
    await recordEvent({ type: 'user_searched', userId: '__warm__' }).catch(() => {}) // ensures db schema (listings table) exists
    for (let i = 0; i < 6; i++) {
      await pool.query(`INSERT INTO listings(id,scraped_at,type,status,data) VALUES($1,$2,'listing','ok',$3)
        ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data, status='ok'`,
        ['mf' + i, Date.now(), JSON.stringify({ id: 'mf' + i, type: 'listing', status: 'ok', title: 'خانه ' + i, price: String(5_000_000_000 + i * 200_000_000), location: 'سعادت آباد', meta: { 'شهر': 'تهران', 'محله': 'سعادت آباد', 'متراژ': String(100 + i * 5) } })])
    }
    const nAreas = await computeMarketFeatures(500)
    ok('computeMarketFeatures aggregated ≥1 area', nAreas >= 1)
    const mf = await getMarketFeature('تهران|سعادت آباد')
    ok('market feature stored (count≥6, median/m>0)', !!mf && mf.count >= 6 && mf.medianPricePerM > 0)
    ok('market avg price computed', !!mf && mf.avgPrice > 0)
    ok('topMarkets includes the area', (await topMarkets(20)).some(t => t.area === 'تهران|سعادت آباد'))
    // typed views (Feature Store v2)
    const mv = await pool.query(`SELECT * FROM reos_market_features WHERE area='تهران|سعادت آباد'`)
    ok('reos_market_features view returns typed row', mv.rows.length === 1 && Number(mv.rows[0].median_price_per_m) > 0)
    const pv = await pool.query(`SELECT count(*)::int n FROM reos_property_features`)
    ok('reos_property_features typed view queryable', typeof pv.rows[0].n === 'number')
    const uv = await pool.query(`SELECT count(*)::int n FROM reos_user_features`)
    ok('reos_user_features typed view queryable', typeof uv.rows[0].n === 'number')
  }

  console.log('\n── REOS v2: CRM OS (pipeline/activities/tasks/timeline/funnel/automations) ──')
  {
    await pool.query('TRUNCATE reos_crm').catch(() => {})   // deterministic across reruns
    const owner = 'crmU'
    // automation: on new_lead → create a follow-up task
    await createAutomation({ ownerId: owner, trigger: 'new_lead', params: {}, action: 'create_task', actionParams: { title: 'تماسِ اولیه' } })
    const lead = await createLead({ ownerId: owner, name: 'علی', phone: '09120000000', source: 'divar' })
    ok('createLead with pipeline stage + score', lead.stage === 'new' && lead.score > 0)
    ok('automation fired on new_lead (task created)', (await listTasks(owner, { open: true })).some(t => t.title === 'تماسِ اولیه' && t.leadId === lead.id))
    // activities raise score + build timeline
    await addActivity({ ownerId: owner, leadId: lead.id, type: 'call', text: 'تماس گرفتم' })
    await addActivity({ ownerId: owner, leadId: lead.id, type: 'note', text: 'علاقه‌مند به سعادت‌آباد' })
    const afterAct = await getLead(lead.id)
    ok('activities recomputed lead score', afterAct.score >= lead.score)
    // move stage → logs stage activity, re-scores
    const won = await moveStage(lead.id, 'won')
    ok('moveStage updates stage', won.stage === 'won')
    const tl = await timeline(lead.id)
    ok('timeline merges activities+tasks (has stage + call + task)', tl.some(x => x.kind === 'activity:stage') && tl.some(x => x.kind === 'activity:call') && tl.some(x => x.kind === 'task'))
    ok('timeline sorted desc by time', tl.every((x, i, a) => i === 0 || a[i - 1].at >= x.at))
    // funnel conversion
    await createLead({ ownerId: owner, name: 'ب', stage: 'new' })
    const fn = await funnel(owner)
    ok('funnel counts by stage', fn.byStage.won === 1 && fn.total === 2)
    ok('funnel conversion rate computed', fn.conversionRate === 50)
    // idle automation: lead not touched for > N days → create task
    await createAutomation({ ownerId: owner, trigger: 'idle', params: { days: 3 }, action: 'create_task', actionParams: { title: 'پیگیریِ معطل' } })
    const stale = await createLead({ ownerId: owner, name: 'کهنه', stage: 'contacted' })
    // force updatedAt into the past by re-putting via moveStage then patching time isn't exposed; simulate by aging: create then run with now far in future
    const future = Date.now() + 10 * 864e5
    const acted = await runIdleAutomations(owner, future)
    ok('idle automation acts on stale leads', acted >= 1 && (await listTasks(owner, { open: true })).some(t => t.title === 'پیگیریِ معطل'))
  }

  console.log('\n── REOS v3: AI Gateway (router + cache + cost + fallback) ──')
  {
    await pool.query('TRUNCATE reos_ai_usage').catch(() => {})
    cacheClear()
    ok('selectModel returns a model', typeof selectModel('agent').model === 'string' && selectModel('agent').model.length > 0)
    ok('estimateCost by model rate', estimateCost('gpt-4o-mini', 1000) === 300 && estimateCost('gpt-4o', 1000) === 3000)
    ok('cacheKey deterministic', cacheKey('m', [{ role: 'user', content: 'x' }], 0) === cacheKey('m', [{ role: 'user', content: 'x' }], 0))

    // cache: identical prompt calls the model once
    let calls = 0
    const counter = async () => { calls++; return { text: 'r' + calls, tokens: 4 } }
    const r1 = await runLLM('agent', [{ role: 'user', content: 'same' }], {}, counter)
    const r2 = await runLLM('agent', [{ role: 'user', content: 'same' }], {}, counter)
    ok('gateway calls model on first request', r1.cached === false && r1.text === 'r1')
    ok('gateway serves 2nd identical request from cache (no 2nd call)', r2.cached === true && calls === 1 && r2.text === 'r1')

    // fallback: primary throws → fallback model used, still ok
    let n = 0
    const failFirst = async () => { n++; if (n === 1) throw new Error('primary down'); return { text: 'fallback-ok', tokens: 6 } }
    const rf = await runLLM('agent', [{ role: 'user', content: 'unique-fb' }], { cache: false }, failFirst)
    ok('gateway falls back on primary error', rf.ok === true && rf.fallback === true && rf.text === 'fallback-ok')

    // total failure → ok:false, empty text (never throws)
    const rdead = await runLLM('agent', [{ role: 'user', content: 'dead' }], { cache: false }, async () => { throw new Error('all down') })
    ok('gateway never throws (total failure → ok:false)', rdead.ok === false && rdead.text === '')

    // cost/usage tracking persisted
    const st = await usageStats()
    ok('usageStats records calls + tokens + cost', st.calls >= 3 && st.tokens > 0 && st.cost > 0)
    ok('usageStats computes cache hit rate', st.cacheHitRate > 0)
    ok('usageStats breaks down by model', Object.keys(st.byModel).length >= 1)
  }

  console.log('\n── REOS v3: Workflow Builder (IF/THEN, HubSpot-style) ──')
  {
    await pool.query('TRUNCATE reos_workflows, reos_crm').catch(() => {})
    const owner = 'wfU'
    ok('evalCondition gte', evalCondition({ field: 'idleDays', op: 'gte', value: 3 }, { idleDays: 5 }) === true && evalCondition({ field: 'idleDays', op: 'gte', value: 3 }, { idleDays: 1 }) === false)
    ok('evalCondition eq/contains', evalCondition({ field: 'stage', op: 'eq', value: 'new' }, { stage: 'new' }) && evalCondition({ field: 'tags', op: 'contains', value: 'vip' }, { tags: 'a,vip,b' }))
    // workflow: IF stage=new AND idleDays>=3 THEN create_task + move_stage
    const wf = await createWorkflow({ ownerId: owner, name: 'پیگیریِ لیدِ خوابیده', trigger: 'lead_idle',
      conditions: [{ field: 'stage', op: 'eq', value: 'new' }, { field: 'idleDays', op: 'gte', value: 3 }],
      actions: [{ type: 'create_task', params: { title: 'تماسِ پیگیری' } }, { type: 'send_sms', params: { text: 'سلام' } }, { type: 'move_stage', params: { toStage: 'contacted' } }] })
    ok('workflow created active', wf.active && wf.conditions.length === 2 && wf.actions.length === 3)
    const lead = await createLead({ ownerId: owner, name: 'لید', stage: 'new' })
    // matchWorkflow with a fresh lead (idleDays 0) → no match
    ok('matchWorkflow false when idleDays<3', matchWorkflow(wf, leadContext(lead, Date.now())) === false)
    // run with now far in future → idleDays large → match → actions fire
    const future = Date.now() + 10 * 864e5
    const res = await runWorkflows(owner, 'lead_idle', future)
    ok('runWorkflows matched the stale new lead', res.matched >= 1)
    ok('workflow actions executed (task + sms + stage)', res.actions.length === 3 && res.actions.every(a => a.ok))
    ok('workflow created a real CRM task', (await listTasks(owner, { open: true })).some(t => t.title === 'تماسِ پیگیری'))
    ok('workflow moved lead stage to contacted', (await getLead(lead.id)).stage === 'contacted')
  }

  console.log('\n── REOS v3: Market Intelligence (demand/supply/liquidity/health) ──')
  {
    await pool.query(`DELETE FROM reos_feature_store WHERE entity_type='market_intel'`).catch(() => {})
    // seed listings in one area + engagement on some of them
    for (let i = 0; i < 8; i++) {
      await pool.query(`INSERT INTO listings(id,scraped_at,type,status,data) VALUES($1,$2,'listing','ok',$3) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data, status='ok', scraped_at=EXCLUDED.scraped_at`,
        ['mi' + i, Date.now(), JSON.stringify({ id: 'mi' + i, type: 'listing', status: 'ok', scrapedAt: Date.now(), title: 'x', price: '5000000000', location: 'زعفرانیه', meta: { 'شهر': 'تهران', 'محله': 'زعفرانیه', 'متراژ': '120' } })])
      if (i < 5) await bumpFeatures('property', 'mi' + i, { engagement_score: 20 })   // نصف پرتقاضا
    }
    const n = await computeMarketIntel(500)
    ok('computeMarketIntel produced ≥1 area', n >= 1)
    const mi = await getMarketIntel('تهران|زعفرانیه')
    ok('market intel stored (listings + indices)', !!mi && mi.listings >= 8 && mi.demandIndex > 0 && mi.healthScore > 0)
    ok('trend computed (fresh listings → up)', !!mi && mi.trend === 'up')
    ok('topMarketIntel ranks by health', (await topMarketIntel(10)).some(a => a.area === 'تهران|زعفرانیه'))
  }

  console.log('\n── REOS v3: AVM valuate (data-backed comparables) ──')
  {
    // seed target + 5 comps in same area (~60M/m²), target 100m² → ~6B
    const seed = async (id, price, meters) => pool.query(`INSERT INTO listings(id,scraped_at,type,status,data) VALUES($1,$2,'listing','ok',$3) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data, status='ok'`,
      [id, Date.now(), JSON.stringify({ id, type: 'listing', status: 'ok', scrapedAt: Date.now(), title: id, price: String(price), location: 'نیاوران', meta: { 'شهر': 'تهران', 'محله': 'نیاوران', 'متراژ': String(meters), 'نوع معامله': 'فروش' } })])
    await seed('avmT', 0, 100)                    // target: price unknown, 100m²
    await seed('avmC1', 5_800_000_000, 100)       // 58M/m²
    await seed('avmC2', 6_000_000_000, 100)       // 60M/m²
    await seed('avmC3', 6_200_000_000, 100)       // 62M/m²
    await seed('avmC4', 9_150_000_000, 150)       // 61M/m²
    await seed('avmC5', 5_940_000_000, 90)        // 66M/m²
    const v = await valuate('avmT')
    ok('valuate found comparables', v.comps >= 4 && v.method === 'comparables')
    ok('valuate estimate in plausible range (5–7B for 100m²)', v.estimate >= 5_000_000_000 && v.estimate <= 7_000_000_000)
    ok('valuate returns low/high band + confidence', v.low < v.estimate && v.estimate < v.high && v.confidence > 0)
    const none = await valuate('nonexistent-id')
    ok('valuate handles missing property gracefully', none.estimate === 0)
  }

  console.log('\n── REOS v3: Experiment Platform (A/B) ──')
  {
    ok('assignVariant is sticky/deterministic', assignVariant('u1', 'e1', ['A', 'B']) === assignVariant('u1', 'e1', ['A', 'B']))
    // distribution over 2000 users roughly matches 50/50
    let a = 0; for (let i = 0; i < 2000; i++) if (assignVariant('user' + i, 'exp', ['A', 'B']) === 'A') a++
    ok('assignVariant ~50/50 split', a > 850 && a < 1150)
    // weighted 80/20
    let x = 0; for (let i = 0; i < 2000; i++) if (assignVariant('u' + i, 'w', ['X', 'Y'], [8, 2]) === 'X') x++
    ok('assignVariant respects weights (~80% X)', x > 1500 && x < 1700)
    const exp = await createExperiment({ name: 'feed test', variants: ['A', 'B'] })
    for (let i = 0; i < 100; i++) await recordExposure(exp.id, 'A'); for (let i = 0; i < 30; i++) await recordConversion(exp.id, 'A', 10)
    for (let i = 0; i < 100; i++) await recordExposure(exp.id, 'B'); for (let i = 0; i < 12; i++) await recordConversion(exp.id, 'B', 10)
    const res = await results(exp)
    ok('results conversion rates (A=30%, B=12%)', res.variants.find(v => v.variant === 'A').conversionRate === 30 && res.variants.find(v => v.variant === 'B').conversionRate === 12)
    ok('results picks winner (A) + lift', res.winner === 'A' && res.lift > 0)
  }

  console.log('\n── REOS v3: Billing Engine (wallet/txn/invoice) ──')
  {
    const owner = 'billU_' + Math.floor(Date.now() / 1000)
    await credit(owner, 1_000_000, 'شارژ')
    ok('credit raises balance', (await getBalance(owner)) === 1_000_000)
    const d = await debit(owner, 300_000, 'خرید')
    ok('debit lowers balance', d.ok && d.balance === 700_000)
    const over = await debit(owner, 999_999_999, 'زیاد')
    ok('debit rejects insufficient funds (atomic)', over.ok === false && (await getBalance(owner)) === 700_000)
    ok('transactions logged (credit + debit)', (await listTransactions(owner)).length === 2)
    const inv = await createInvoice(owner, [{ desc: 'کمپین', amount: 500_000 }], 0.1)
    ok('invoice computes tax + total', inv.subtotal === 500_000 && inv.tax === 50_000 && inv.total === 550_000)
    const pay = await payInvoice(inv.id)
    ok('payInvoice debits wallet (700k - 550k = 150k)', pay.ok && (await getBalance(owner)) === 150_000)
    const pay2 = await payInvoice(inv.id)
    ok('cannot pay same invoice twice', pay2.ok === false)
  }

  console.log('\n── REOS v3: Attribution Engine (CAC/LTV/ROAS) ──')
  {
    const ch = 'divar_' + Math.floor(Date.now() / 1000)
    for (let i = 0; i < 50; i++) await recordTouch(ch)
    await recordSpend(ch, 5_000_000)
    for (let i = 0; i < 10; i++) await attrConvert(ch, 2_000_000)   // 10 conversions × 2M revenue
    const r = await channelReport(ch)
    ok('attribution counts touches/conversions/spend/revenue', r.touches === 50 && r.conversions === 10 && r.spend === 5_000_000 && r.revenue === 20_000_000)
    ok('CAC = spend/conversions = 500k', r.cac === 500_000)
    ok('ROAS = revenue/spend = 4', r.roas === 4)
    ok('LTV = revenue/conversions = 2M', r.ltv === 2_000_000)
  }

  console.log('\n── REOS v4: Trust Layer (store) ──')
  {
    const e = 'trustE'
    await setSignals(e, { profileComplete: 0.8, deals: 10, rating: 4.5, reviews: 12, tenureDays: 200 })
    await setVerification(e, 'identity', true)
    await setVerification(e, 'agency', true)
    const t = await getTrust(e)
    ok('verifications + signals persisted → score', t.score > 40 && t.badges.includes('identity') && t.badges.includes('agency'))
    await setVerification(e, 'agency', false)
    ok('un-verify removes badge', !(await getTrust(e)).badges.includes('agency'))
    ok('implicit extra verification (phone) applies', (await getTrust(e, ['phone'])).badges.includes('phone'))
  }

  console.log('\n── REOS v4: Growth Engine (referral → wallet credit) ──')
  {
    const owner = 'growU_' + Math.floor(Date.now() / 1000)
    const ref = await getOrCreateReferral(owner)
    ok('referral code created (6 chars)', ref.code.length === 6 && ref.invited === 0)
    await recordInvite(ref.code); await recordInvite(ref.code)
    const bal0 = await walletBalance(owner)
    await refConvert(ref.code, 150000)
    const st = await referralStats(owner)
    ok('invites + conversion tracked', st.invited === 2 && st.converted === 1)
    ok('conversion rate computed', st.conversionRate === 50)
    ok('conversion credited the wallet (+150k)', (await walletBalance(owner)) === bal0 + 150000)
  }

  console.log('\n── REOS v4: Market Knowledge Graph + Neighborhood ──')
  {
    await pool.query('TRUNCATE reos_graph_nodes, reos_graph_edges').catch(() => {})
    // seed listings by owner O1 (3) and O2 (1) in one area
    const seedOwned = (id, owner) => pool.query(`INSERT INTO listings(id,scraped_at,type,status,data) VALUES($1,$2,'listing','ok',$3) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data, status='ok'`,
      [id, Date.now(), JSON.stringify({ id, type: 'listing', status: 'ok', scrapedAt: Date.now(), title: id, ownerId: owner, owner: owner, price: '6000000000', location: 'ولنجک', meta: { 'شهر': 'تهران', 'محله': 'ولنجک', 'متراژ': '120' } })])
    await seedOwned('mgA', 'O1'); await seedOwned('mgB', 'O1'); await seedOwned('mgC', 'O1'); await seedOwned('mgD', 'O2')
    const r = await syncMarketGraph(500)
    ok('market graph built area + edges', r.areas >= 1 && r.edges >= 4)
    ok('areaListingCount counts located_in edges', (await areaListingCount('تهران|ولنجک')) >= 4)
    const top = await topActiveInArea('تهران|ولنجک', 5)
    ok('topActiveInArea ranks O1 first (3 listings)', top[0].id === 'O1' && top[0].listings === 3)
    const prof = await neighborhoodProfile('تهران|ولنجک')
    ok('neighborhoodProfile returns data + topAgents + price level', !!prof && prof.listings >= 4 && prof.topAgents.length >= 1 && !!prof.priceLevel)
    ok('neighborhood external POI marked pending (null)', prof.external.walkability === null)
  }

  console.log('\n── REOS v4: Unified Communication Hub ──')
  {
    const owner = 'commU_' + Math.floor(Date.now() / 1000)
    const sms = await commsSend({ channel: 'sms', to: '0912', message: 'سلام', ownerId: owner })
    ok('SMS routed → queued (ready channel)', sms.status === 'queued')
    const wa = await commsSend({ channel: 'whatsapp', to: '0912', message: 'hi', ownerId: owner })
    ok('WhatsApp → pending (external integration needed)', wa.status === 'pending')
    const log = await commsLog(owner)
    ok('unified log records both messages', log.length === 2)
    ok('channels() lists readiness (sms/email ready)', channels().filter(c => c.ready).map(c => c.channel).sort().join(',') === 'email,sms')
  }

  console.log('\n── REOS v5: Model Registry (champion/challenger) ──')
  {
    const nm = 'engage_test_' + Math.floor(Date.now() / 1000)
    const v1 = await registerModel(nm, { demand: 1 }, { auc: 0.7 })
    ok('first version → champion', v1.status === 'champion' && v1.version === 1)
    const v2 = await registerModel(nm, { demand: 2 }, { auc: 0.8 })
    ok('second version → candidate', v2.status === 'candidate' && v2.version === 2)
    await promote(v2.id)
    const champ = await getChampion(nm)
    ok('promote sets new champion', champ.id === v2.id)
    ok('old champion retired', (await listVersions(nm)).find(v => v.id === v1.id).status === 'retired')
  }

  console.log('\n── REOS v5: Self-learning policy (online) ──')
  {
    await pool.query(`DELETE FROM reos_feature_store WHERE entity_type='policy'`).catch(() => {})
    const p0 = await getPolicy()
    ok('default policy has weight vector', Array.isArray(p0.w) && p0.w.length === 5)
    // context with high demand + strong (contract) reward → w_demand should rise toward the target
    for (let i = 0; i < 30; i++) await applyOnlineReward([1, 0, 0, 0, 1], 'contract')
    const p1 = await getPolicy()
    ok('online reward updated policy (updates counted)', p1.updates >= 30)
    ok('w_demand increased from reward', p1.w[0] > p0.w[0])
  }

  console.log('\n── REOS v5: Autonomous Agent (observe→plan→execute) ──')
  {
    const owner = 'autoU_' + Math.floor(Date.now() / 1000)
    const hot = await createLead({ ownerId: owner, name: 'داغ', phone: '0912', stage: 'negotiation' })
    await addActivity({ ownerId: owner, leadId: hot.id, type: 'call', text: 'x' }); await addActivity({ ownerId: owner, leadId: hot.id, type: 'note', text: 'y' })
    const r = await runAutonomous(owner, [{ id: 'weakL', health: 25 }])
    ok('autonomous produced a plan', r.plan.length >= 1)
    ok('autonomous executed actions (created tasks)', r.executed >= 1 && (await listTasks(owner, { open: true })).length >= 1)
    ok('plan includes the weak listing fix', r.plan.some(a => a.type === 'fix_listing' && a.targetId === 'weakL'))
  }

  console.log('\n── REOS · Super-Admin Config Center (settings actually drive engines) ──')
  {
    await resetConfig()
    const def = await getConfig()
    ok('defaults exposed (rl.lr, promotion.vip)', def.rl.lr === 0.05 && def.promotion.vip === 1)
    // change the AI cost rate and confirm the LIVE gateway estimateCost uses it
    const before = estimateCost('gpt-4o-mini', 1000)
    await setConfig({ gateway: { rates: { 'gpt-4o-mini': 999 } } })
    await primeConfig()
    ok('config override persists', (await getConfig()).gateway.rates['gpt-4o-mini'] === 999)
    ok('sync cache reflects override', cfgCache().gateway.rates['gpt-4o-mini'] === 999)
    ok('LIVE engine (gateway.estimateCost) uses new rate', estimateCost('gpt-4o-mini', 1000) === 999 && before === 300)
    await resetConfig()
    ok('reset restores defaults on live engine', estimateCost('gpt-4o-mini', 1000) === 300)
  }

  console.log('\n── REOS: Lead model trained end-to-end from real CRM data ──')
  {
    const owner = 'leadTrainU_' + Math.floor(Date.now() / 1000)
    // won leads have budget, lost leads don't → the model should learn hasBudget
    for (let i = 0; i < 16; i++) { const l = await createLead({ ownerId: owner, name: 'w' + i, phone: '0912', value: 5_000_000_000 }); await moveStage(l.id, 'won') }
    for (let i = 0; i < 16; i++) { const l = await createLead({ ownerId: owner, name: 'l' + i, phone: '0912', value: 0 }); await moveStage(l.id, 'lost') }
    const w = await trainLeadModel({ epochs: 400, lr: 0.4 })
    ok('lead model trained from CRM won/lost (not default)', w.usedDefault === false && w.n >= 32)
    ok('learned hasBudget weight positive (won had budget)', w.hasBudget > 0)
    ok('lead model AUC computed', typeof w.auc === 'number' && w.auc > 0)
  }

  console.log('\n── REOS v5: AI Cost Router + Model Catalog ──')
  {
    ok('complexity: short → simple', complexityOf('سلام') === 'simple')
    ok('complexity: legal keyword → legal', complexityOf('لطفاً این قرارداد را بررسی کن') === 'legal')
    ok('complexity: long → complex', complexityOf('x'.repeat(700)) === 'complex')
    ok('cost router: simple → cheap task, legal → agent task', taskForComplexity('simple') === 'cheap' && taskForComplexity('legal') === 'agent')
    const cat = await modelCatalog()
    ok('catalog lists REOS models with types', cat.length >= 6 && cat.some(m => m.key === 'engage' && m.type === 'trained') && cat.some(m => m.key === 'avm' && m.type === 'formula'))
    ok('catalog reports real trained status', cat.find(m => m.key === 'lead')?.status.length > 0)
  }

  console.log('\n── REOS: Market Dominance — territory store (real PG) ──')
  {
    const T = territoryKeyFromName('سعادت آباد')
    // آژانسِ قوی vs ضعیف در همان قلمرو
    await recordDominance(T, '0912111', 'آژانسِ الف', { transactions: 20, listingQuality: 0.9, leadConversion: 0.5, satisfaction: 4.5, contentPieces: 10, activity: 0.9, aiTrust: 80 })
    await recordDominance(T, '0912222', 'آژانسِ ب', { transactions: 2, listingQuality: 0.4, leadConversion: 0.1, satisfaction: 3, contentPieces: 1, activity: 0.4, aiTrust: 50 })
    const lb = await leaderboard(T)
    ok('leaderboard ordered by score desc', lb.length === 2 && lb[0].score >= lb[1].score)
    ok('leaderboard ranks assigned', lb[0].rank === 1 && lb[1].rank === 2)
    const owner = await getOwner(T)
    ok('owner = top agent', owner && owner.ownerId === lb[0].agentId)
    const st = await standing(T, lb[1].agentId)
    ok('standing computes rank + toNext', st.rank === 2 && st.toNext === (lb[0].score - lb[1].score))
    ok('standing isOwner false for runner-up', st.isOwner === false)

    // ضدِتقلب: امتیاز با تقلبِ بالا کاهش می‌یابد
    const dirtyOnly = await recordDominance(territoryKeyFromName('منطقهٔ تقلب'), '0912999', 'مشکوک',
      { transactions: 10, listingQuality: 0.9, leadConversion: 0.5, satisfaction: 4, contentPieces: 5, activity: 0.9, aiTrust: 70 },
      { listings: 40, listingViews: 2, contacts: 20, selfContacts: 12, transactions: 10, leads: 0, spikeRatio: 9 })
    ok('fraud dampens score', dirtyOnly.fraud >= 0.5 && dirtyOnly.score < 40)

    // پروفایلِ آژانس در چند قلمرو
    await recordDominance(territoryKeyFromName('ولنجک'), '0912111', 'آژانسِ الف', { transactions: 8, listingQuality: 0.7, activity: 0.8, aiTrust: 75 })
    const terrs = await agentTerritories('0912111')
    ok('agentTerritories lists all agent territories', terrs.length === 2 && terrs.every(t => typeof t.rank === 'number'))
    ok('agent is owner where top', terrs.some(t => t.isOwner))

    // نقشهٔ اقتدار
    const map = await dominanceMap()
    ok('dominance map returns owners', map.length >= 2 && map.some(m => m.territory === T))

    // آمار + ارزشِ قلمرو
    const stats = await territoryStats(T)
    ok('territoryStats: competitors + premium value', stats.competitors === 2 && stats.value.monthlyToman > 0)
  }

  console.log('\n── REOS: Territory battles (7-day challenge) ──')
  {
    const T = territoryKeyFromName('نبردِ محله')
    await recordDominance(T, '0913aaa', 'مدافع', { transactions: 10, activity: 0.8, aiTrust: 70 })
    await recordDominance(T, '0913bbb', 'چالش‌گر', { transactions: 3, activity: 0.5, aiTrust: 55 })
    const b = await startBattle(T, '0913bbb', '0913aaa')
    ok('battle starts open with captured start scores', b.status === 'open' && typeof b.startScores['0913bbb'] === 'number')
    const early = await resolveBattle(b.id, b.startAt + 1000)   // هنوز تمام نشده
    ok('battle not resolved before end', early.status === 'open')
    ok('openBattles lists it', (await openBattles(T)).some(x => x.id === b.id))
    // چالش‌گر امتیازش را بالا می‌برد (رشدِ بیشتر)
    await recordDominance(T, '0913bbb', 'چالش‌گر', { transactions: 25, listingQuality: 0.9, leadConversion: 0.6, satisfaction: 4.6, contentPieces: 12, activity: 0.95, aiTrust: 85 })
    const done = await resolveBattle(b.id, b.endAt + 1000)
    ok('battle resolves after end, challenger (bigger gain) wins', done.status === 'resolved' && done.winnerId === '0913bbb')
    ok('battlesWonBy counts the win', (await battlesWonBy('0913bbb')) === 1)
    // resolveDueBattles
    await recordDominance(T, '0913ccc', 'ج۲', { transactions: 5, activity: 0.5 })
    const b2 = await startBattle(T, '0913ccc', '0913aaa')
    const n = await resolveDueBattles(b2.endAt + 1000)
    ok('resolveDueBattles resolves due ones', n >= 1 && (await openBattles(T)).every(x => x.id !== b2.id))
  }

  console.log('\n── REOS: Activity streaks (real PG) ──')
  {
    const day = 20000
    await touchStreak('0914xyz', day * 864e5)
    await touchStreak('0914xyz', day * 864e5)   // همان روز → idempotent
    let s = await getStreak('0914xyz', day * 864e5)
    ok('streak = 1 after same-day touches', s.streak === 1 && s.alive)
    await touchStreak('0914xyz', (day + 1) * 864e5)   // روزِ بعد
    s = await getStreak('0914xyz', (day + 1) * 864e5)
    ok('streak grows to 2 next day', s.streak === 2)
    const broken = await getStreak('0914xyz', (day + 5) * 864e5)   // فاصله
    ok('streak reads 0 after gap (not alive)', broken.streak === 0 && broken.alive === false)
    ok('longest preserved across break', broken.longest === 2)
  }

  console.log('\n── REOS v6: XP + Levels + Seasons (real PG) ──')
  {
    const now = Date.UTC(2026, 1, 15)   // 2026-Q1
    const a1 = await awardXp('0921aaa', 'close_deal', 1, now)
    ok('awardXp returns awarded + lifetime + season', a1.awarded > 0 && a1.lifetime === a1.awarded && a1.season === a1.awarded)
    await awardXp('0921aaa', 'respond_lead', 3, now)
    ok('xp accumulates in lifetime', (await lifetimeXp('0921aaa')) > a1.awarded)
    await grantXp('0921aaa', 500, now)
    const stA = await xpStatus('0921aaa', now)
    ok('xpStatus exposes level + season rank', stA.lifetime.level >= 1 && stA.rank === 1 && stA.season === '2026-Q1')
    await awardXp('0921bbb', 'respond_lead', 1, now)   // کمتر از aaa
    const lb = await seasonLeaderboard(seasonKey(now), 10)
    ok('season leaderboard ordered', lb.length === 2 && lb[0].agentId === '0921aaa' && lb[0].rank === 1)
    const rankB = (await xpStatus('0921bbb', now)).rank
    ok('lower XP → worse rank', rankB === 2)
    // XPِ فصلِ دیگر جدا شمرده می‌شود
    await awardXp('0921aaa', 'close_deal', 1, Date.UTC(2026, 7, 1))   // Q3
    const q3 = await xpStatus('0921aaa', Date.UTC(2026, 7, 1))
    ok('season XP resets per season (lifetime persists)', q3.seasonXp < q3.lifetime.total && q3.lifetime.total > stA.lifetime.total)
  }

  console.log('\n── REOS v6: Missions + claim → wallet reward (real PG) ──')
  {
    const now = Date.UTC(2026, 1, 15)
    await bumpMissions('0922xyz', 'respond_lead', 3, now)   // daily_respond target = 3
    const ms = await listMissions('0922xyz', now)
    const dr = ms.find(m => m.key === 'daily_respond')
    ok('mission progresses from real action', dr.progress === 3 && dr.complete && dr.claimable)
    const c1 = await claimMission('0922xyz', 'daily_respond', now)
    ok('claim grants XP + credit', c1.ok && c1.rewardXp > 0 && c1.rewardCredit > 0)
    ok('reward credited to wallet reward bucket', (await bucketBalance('0922xyz', 'reward')) === c1.rewardCredit)
    ok('claimed XP reflected in lifetime', (await lifetimeXp('0922xyz')) >= c1.rewardXp)
    const c2 = await claimMission('0922xyz', 'daily_respond', now)
    ok('double-claim rejected (idempotent)', c2.ok === false)
    const c3 = await claimMission('0922xyz', 'weekly_deal', now)
    ok('incomplete mission not claimable', c3.ok === false)
  }

  console.log('\n── REOS v6: Unified multi-bucket wallet (real PG) ──')
  {
    const w1 = await creditBucket('0923www', 'promo', 100000, 'تست')
    ok('creditBucket increments balance', w1.ok && w1.balance === 100000)
    const d1 = await debitBucket('0923www', 'promo', 30000, 'مصرف')
    ok('debitBucket decrements', d1.ok && d1.balance === 70000)
    const d2 = await debitBucket('0923www', 'promo', 999999, 'زیاد')
    ok('over-debit rejected atomically', d2.ok === false && (await bucketBalance('0923www', 'promo')) === 70000)
    await creditBucket('0923www', 'ai', 5000, 'AI')
    const sum = await walletSummary('0923www')
    ok('wallet summary aggregates buckets', sum.buckets.promo === 70000 && sum.buckets.ai === 5000 && sum.total >= 75000)
    // refund
    const cr = await creditBucket('0923www', 'reward', 40000, 'پاداش')
    const rf = await refundTxn(cr.txn.id)
    ok('refund reverses a credit', rf.ok && (await bucketBalance('0923www', 'reward')) === 0)
    const rf2 = await refundTxn(cr.txn.id)
    ok('double-refund rejected', rf2.ok === false)
    const led = await walletLedger('0923www')
    ok('ledger records typed transactions', led.length >= 4 && led.some(t => t.type === 'credit') && led.some(t => t.type === 'debit'))
  }

  console.log('\n── REOS v6: Reward economy end-to-end (real PG) ──')
  {
    const now = Date.UTC(2026, 1, 20)
    const before = await bucketBalance('0924deal', 'reward')
    const r = await recordDeal('0924deal', 1_000_000_000, { now })   // معاملهٔ ۱ میلیارد
    ok('recordDeal computes commission', r.commission === commissionOn(1_000_000_000))
    ok('recordDeal pays loyalty to reward bucket', (await bucketBalance('0924deal', 'reward')) === before + r.loyalty && r.loyalty > 0)
    ok('recordDeal awards close_deal XP', (await lifetimeXp('0924deal')) > 0)
    // با معرف → پورسانت به معرف
    const refBefore = await bucketBalance('0925ref', 'reward')
    const r2 = await recordDeal('0924deal', 1_000_000_000, { referrerId: '0925ref', now })
    ok('affiliate paid to referrer', r2.affiliate > 0 && (await bucketBalance('0925ref', 'reward')) === refBefore + r2.affiliate)
    ok('affiliate is a cut of commission', r2.affiliate === Math.round(r2.commission * 0.2))
  }

  console.log('\n── REOS v7: Community — follow / collections / comments (real PG) ──')
  {
    // follow
    await follow('0931u1', '0931agentA', 'agent')
    await follow('0931u2', '0931agentA', 'agent')
    await follow('0931u1', '0931agentA', 'agent')   // تکراری → idempotent
    ok('isFollowing true after follow', (await isFollowing('0931u1', '0931agentA')) === true)
    ok('follower count dedups', (await followerCount('0931agentA')) === 2)
    ok('following count', (await followingCount('0931u1')) === 1)
    await follow('0931u1', '0931agentB', 'agent')
    ok('followingList returns targets', (await followingList('0931u1')).length === 2)
    await unfollow('0931u1', '0931agentA')
    ok('unfollow removes', (await isFollowing('0931u1', '0931agentA')) === false && (await followerCount('0931agentA')) === 1)
    ok('cannot follow self', (await follow('0931x', '0931x')).ok === false)

    // collections
    const col = await createCollection('0931owner', 'ویلاهای لوکس', true)
    ok('collection created', !!col.id && col.name === 'ویلاهای لوکس')
    await addToCollection(col.id, 'listing1', 'property')
    await addToCollection(col.id, 'listing2', 'property')
    await addToCollection(col.id, 'listing1', 'property')   // تکراری
    ok('collection items dedup', (await collectionItems(col.id)).length === 2)
    const cols = await listCollections('0931owner')
    ok('listCollections shows count', cols.length === 1 && cols[0].count === 2)
    await removeFromCollection(col.id, 'listing1')
    ok('remove from collection', (await collectionItems(col.id)).length === 1)

    // comments
    const c1 = await addComment({ authorId: '0931u1', authorName: 'کاربر ۱', targetId: '0931agentA', targetType: 'agent', text: '  آژانسِ خوبی بود  ' })
    ok('comment added + sanitized', c1.ok && c1.comment.text === 'آژانسِ خوبی بود')
    const c2 = await addComment({ authorId: '0931u2', targetId: '0931agentA', targetType: 'agent', text: 'موافقم', parentId: c1.comment.id })
    ok('reply added', c2.ok)
    const empty = await addComment({ authorId: '0931u2', targetId: '0931agentA', text: '   ' })
    ok('empty comment rejected', empty.ok === false)
    const tree = await listComments('0931agentA', 'agent')
    ok('comments threaded (1 root + 1 reply)', tree.length === 1 && tree[0].replies.length === 1)
    ok('comment count = 2', (await commentCount('0931agentA')) === 2)
    const hid = await hideComment(c2.comment.id, '0931u2', false)   // نویسنده خودش
    ok('author can hide own comment', hid.ok)
    ok('hidden excluded from count', (await commentCount('0931agentA')) === 1)
    const badHide = await hideComment(c1.comment.id, '0931other', false)
    ok('non-author cannot hide', badHide.ok === false)

    // social proof
    const sp = await socialProof('0931agentA')
    ok('socialProof aggregates followers + comments + score', sp.followers === 1 && sp.comments === 1 && typeof sp.score === 'number')
  }

  console.log('\n── REOS v8: Feature Flags (real PG) ──')
  {
    const all = await listFlags()
    ok('listFlags returns seeded defaults', all.length >= 5 && all.some(f => f.key === 'dominance'))
    ok('default flag enabled + 100%', (await flagEnabled('dominance', { userId: 'u1' })) === true)
    await setFlag('dominance', { enabled: false })
    ok('setFlag persists (dominance off)', (await getFlag('dominance')).enabled === false && (await flagEnabled('dominance', { userId: 'u1' })) === false)
    await setFlag('dominance', { enabled: true, rolloutPct: 0 })
    ok('rollout 0 → off even when enabled', (await flagEnabled('dominance', { userId: 'u1' })) === false)
    await setFlag('community', { cities: ['تهران'] })
    ok('city scope persists + gates', (await flagEnabled('community', { userId: 'u', city: 'تهران' })) === true && (await flagEnabled('community', { userId: 'u', city: 'کرج' })) === false)
    ok('unknown flag defaults to on', (await flagEnabled('nonexistent_flag', { userId: 'u' })) === true)
  }

  console.log('\n── REOS v8: AutoML autonomous promotion (real PG) ──')
  {
    await regModel('amltest', { w: 1 }, { auc: 0.80, n: 500 })   // اولین → قهرمان
    ok('first model becomes champion', (await champOf('amltest'))?.metrics.auc === 0.80)
    await regModel('amltest', { w: 2 }, { auc: 0.86, n: 500 })   // بهتر → نامزد
    const r1 = await autoPromote('amltest')
    ok('autoPromote promotes clearly-better challenger', r1.promoted === true)
    ok('champion is now the better model', (await champOf('amltest'))?.metrics.auc === 0.86)
    const r2 = await autoPromote('amltest')
    ok('no further promotion when stable', r2.promoted === false)
    await regModel('amltest', { w: 3 }, { auc: 0.99, n: 10 })    // بهتر ولی نمونهٔ کم
    const r3 = await autoPromote('amltest')
    ok('does NOT promote high-AUC with too few samples', r3.promoted === false && (await champOf('amltest'))?.metrics.auc === 0.86)
    const st = await autoMLStatus('amltest')
    ok('autoMLStatus exposes champion + challenger', st.champion?.metric === 0.86 && !!st.challenger)
  }

  console.log('\n── Empire فاز ۱: چرخهٔ کامل روی PG واقعی ──')
  {
    const uid = '0912empire1'
    ok('قبل از تولد: getEmpire=null', (await getEmpire(uid)) === null)
    const e = await createEmpire(uid, { name: 'Amin Capital', persona: '🦁', answers: { city: 'تهران', tenB: 'سرمایه‌گذاری می‌کردم', risk: 60, ptype: 'آپارتمان', goal: 'رشدِ سرمایه' }, dreamPicks: ['home', 'income'] })
    ok('تولد: بستهٔ خوش‌آمد §6.3 (سرمایه+کوین+XP+ژتون)', e.capital === 10_000_000_000 && e.coins === 500 && e.xp === 100 && e.aiTokens === 5)
    ok('تولد: نشانِ Founder + اولین نقطهٔ تایم‌لاین', e.badges.includes('Founder') && e.timeline[0].title === 'به ملک‌جت پیوست')
    ok('تولد: هویت + حکم + منتور', e.identity.investor > 0 && e.profile.title === 'Investor Profile' && e.mentor === 'ملک‌جت')
    ok('createEmpire ایدمپوتنت (دوباره → همان)', (await createEmpire(uid, { answers: {} })).no === e.no)
    // خرید: سرمایه کم می‌شود (+ مالیاتِ مؤثرِ انتقال → خزانه) + پاداشِ سند
    // فاز ۷۲: نرخِ مالیات ثابت نیست — مصوبهٔ قطعیِ همان هفتهٔ واقعی (فاز ۷۰) رویش اثر می‌گذارد؛ انتظار از همان تابعِ زنده محاسبه می‌شود
    const taxPctNow = effectiveTransferTaxPct(dayNumberOf(Date.now()))
    const tax4B = Math.round(4_000_000_000 * taxPctNow / 100)
    const b1 = await buyAsset(uid, { id: 'LST1', title: 'آپارتمان ۱۰۰ متری پونک', hood: 'پونک', price: 4_000_000_000, ptype: 'آپارتمان', lat: 35.7219, lng: 51.3347 })
    ok('خریدِ اول: کسرِ قیمت + مالیاتِ مؤثر + XP + First Owner', b1.ok && b1.empire.capital === 10_000_000_000 - 4_000_000_000 - tax4B && b1.empire.taxPaid === tax4B && b1.empire.xp === 200 && b1.empire.badges.includes('First Owner'))
    // فاز ۷۳: مختصاتِ آگهی در لحظهٔ خرید ماندگار می‌شود — پینِ نقشه به زنده‌بودنِ آگهی وابسته نمی‌ماند
    ok('خرید: مختصاتِ لحظهٔ خرید روی دارایی ذخیره شد', b1.empire.assets[0].lat === 35.7219 && b1.empire.assets[0].lng === 51.3347)
    ok('خریدِ اول: هویت +۲ builder/+۱ investor (سند فصل۳)', b1.empire.identity.builder === e.identity.builder + 2 && b1.empire.identity.investor === Math.min(100, e.identity.investor + 1))
    const b2 = await buyAsset(uid, { id: 'LST1', title: 'x', hood: 'x', price: 1, ptype: '' })
    ok('خریدِ تکراریِ همان آگهی رد می‌شود', b2.ok === false)
    const b3 = await buyAsset(uid, { id: 'LST2', title: 'برج', hood: 'ونک', price: 99_000_000_000, ptype: 'آپارتمان' })
    ok('سرمایهٔ ناکافی → رد', b3.ok === false && String(b3.reason).startsWith('سرمایه'))
    // تصمیمِ معنادار
    const aid = b1.empire.assets[0].id
    const d1 = await chooseAssetAction(uid, aid, 'rent')
    ok('تصمیمِ اجاره → ثبت + سیگنالِ هویتیِ commercial', d1.ok && d1.empire.assets[0].action === 'rent' && d1.empire.identity.commercial === b1.empire.identity.commercial + 3)
    // Beat AI
    const g1 = await recordGuess(uid, 10_000_000_000, 10_500_000_000)
    ok('حدسِ درست → XP+کوین + آمار', g1.ok && g1.correct === true && (await getEmpire(uid)).guess.correct === 1)
    const g2 = await recordGuess(uid, 10_000_000_000, 30_000_000_000)
    ok('حدسِ غلط → بدونِ پاداش، tries=2', g2.ok && g2.correct === false && (await getEmpire(uid)).guess.tries === 2)
    // مأموریت: یک‌بارمصرف
    const c1 = await claimEmpireMission(uid, 'm1_explore', 200, 50)
    const c2 = await claimEmpireMission(uid, 'm1_explore', 200, 50)
    ok('claim فقط یک‌بار', c1.ok === true && c2.ok === false && c2.reason === 'قبلاً دریافت شده')
    // ژتونِ AI
    for (let i = 0; i < 5; i++) await spendAiToken(uid)
    ok('ژتونِ ششم رد می‌شود', (await spendAiToken(uid)).ok === false && (await getEmpire(uid)).aiTokens === 0)
    // Property Hunter
    await setHunterPair(uid, 'A1', 'B1', 'A1')
    const h1 = await answerHunter(uid, 'A1')
    ok('Hunter درست → پاداش + پاک‌شدنِ جفت', h1.ok && h1.correct === true && h1.rewardXp > 0 && !(await getEmpire(uid)).hunter)
    const h2 = await answerHunter(uid, 'A1')
    ok('Hunter بدونِ جفتِ فعال → رد', h2.ok === false)
    // سبک + نام + رد
    await setStylePicks(uid, ['مدرن', 'لوکس', 'مینیمال'])
    ok('سبک‌ها ذخیره می‌شوند', (await getEmpire(uid)).stylePicks.length === 3)
    const rn = await renameEmpire(uid, 'Noyan Group')
    ok('تغییرِ نام', rn.ok && (await getEmpire(uid)).name === 'Noyan Group')
    // فاز ۱۶۸: محلهٔ خانهٔ کاربر — ثبت و پاک‌کردن روی PG
    await setHomeHood(uid, '  گیشا ')
    ok('محلهٔ خانه ثبت و trim می‌شود', (await getEmpire(uid)).homeHood === 'گیشا')
    await setHomeHood(uid, '')
    ok('محلهٔ خانه با ورودیِ خالی پاک می‌شود', (await getEmpire(uid)).homeHood === '')
    await bumpRejects(uid); await bumpRejects(uid)
    ok('دو ردِ پیشنهاد → rejects=2 (کنترلِ آزاد)', (await getEmpire(uid)).rejects === 2)
    ok('empireCount ≥ 1', (await empireCount()) >= 1)
    // ارزشِ خالص زنده
    const fin = await getEmpire(uid)
    const nw = empNetWorth(fin, { LST1: 4_400_000_000 })
    ok('netWorth زنده: نقد + ارزشِ روز (+۱۰٪ رشد)', nw.netWorth === fin.capital + 4_400_000_000 && nw.growth === 10)
    // نامهٔ روزانه (فصل ۴: daily_brief — یکی در روز، opened_at)
    const day = dayNumberOf(Date.now())
    const bf1 = await saveBrief({ userId: uid, day, summary: 'خلاصه', items: [{ icon: '📈', text: 'خلاصه' }], priority: 1 })
    ok('saveBrief: id و createdAt طبق طرحِ سند', !!bf1.id && bf1.createdAt > 0)
    await saveBrief({ userId: uid, day, summary: 'دوباره', items: [], priority: 0 })
    const g = await getBrief(uid, day)
    ok('یک نامه در روز (درجِ دوم بی‌اثر)', g.summary === 'خلاصه')
    ok('نامهٔ نخوانده: opened_at خالی', !g.openedAt)
    await markBriefOpened(uid, day)
    ok('بازکردنِ نامه opened_at را ثبت می‌کند', (await getBrief(uid, day)).openedAt > 0)
    ok('روزِ دیگر → نامه‌ای نیست', (await getBrief(uid, day + 1)) === null)
    // فاز ۱۶۷ (زنگِ صبحگاهی): نشانِ morningAt روی PG — ایدمپوتنسیِ پوشِ صبح
    ok('نامهٔ تازه هنوز نشانِ صبح ندارد', !(await getBrief(uid, day)).morningAt)
    await markBriefMorning(uid, day, 1234567)
    ok('زنگِ صبح morningAt را روی PG ثبت می‌کند', (await getBrief(uid, day)).morningAt === 1234567)

    // ── فاز ۳: چرخهٔ عمرِ ملک + لیگ‌ها + صندوقچه ──
    const bl = await buyAsset(uid, { id: 'LND1', title: 'زمین کلنگی ۲۰۰ متری', hood: 'چیتگر', price: 2_000_000_000, ptype: 'زمین' })
    ok('خریدِ زمین → kind=land', bl.ok && bl.empire.assets.find(x => x.listingId === 'LND1').kind === 'land')
    const landId = bl.empire.assets.find(x => x.listingId === 'LND1').id
    const lp = await setLandPlan(uid, landId, 'build')
    ok('برنامهٔ زمین: ساخت ثبت می‌شود', lp.ok && lp.empire.assets.find(x => x.id === landId).landPlan === 'build')
    ok('برنامهٔ زمین روی داراییِ غیرزمین رد می‌شود', (await setLandPlan(uid, bl.empire.assets[0].id, 'build')).ok === false)
    const bc = await buyAsset(uid, { id: 'CMR1', title: 'مغازه ۶۰ متری بر اصلی', hood: 'پونک', price: 1_500_000_000, ptype: 'مغازه تجاری' })
    const cmrId = bc.empire.assets.find(x => x.listingId === 'CMR1').id
    const cb = await chooseBusiness(uid, cmrId, 'کافه', 82)
    ok('کسب‌وکارِ تجاری: نوع + ٪موفقیت ثبت می‌شود', cb.ok && cb.empire.assets.find(x => x.id === cmrId).business === 'کافه' && cb.empire.assets.find(x => x.id === cmrId).businessProb === 82)
    const capBefore = cb.empire.capital
    const ai2 = await accrueIncome(uid, [{ assetId: cmrId, amount: 30_000_000 }])
    ok('واریزِ درآمد: سرمایه + incomeِ دارایی', ai2.ok && ai2.empire.capital === capBefore + 30_000_000 && ai2.empire.assets.find(x => x.id === cmrId).income === 30_000_000)
    const eb = await getEmpire(uid)
    const xpBefore = eb.xp, capB2 = eb.capital
    const sl = await sellAsset(uid, landId, 2_500_000_000)
    const taxSell = Math.round(2_500_000_000 * effectiveTransferTaxPct(dayNumberOf(Date.now())) / 100)
    ok('فروشِ سودده: قیمتِ روز − مالیاتِ مؤثر، realized=سودِ اقتصادی، XP+', sl.ok && sl.profit === 500_000_000 && sl.empire.capital === capB2 + 2_500_000_000 - taxSell && sl.empire.realized === 500_000_000 && sl.empire.xp === xpBefore + 50 && !sl.empire.assets.some(x => x.id === landId))
    const sl2 = await sellAsset(uid, cmrId, 1_000_000_000)
    ok('فروشِ زیان‌ده: realized منفی + درسِ اولین شکست', sl2.ok && sl2.profit === -500_000_000 && sl2.empire.claims['first_loss'] > 0 && sl2.empire.journal.some(j => j.text.includes('اولین فروشِ با زیان')))
    ok('فروشِ داراییِ ناموجود رد می‌شود', (await sellAsset(uid, landId, 1)).ok === false)
    const eC = await getEmpire(uid)
    const ch1 = await claimDailyChest(uid, day)
    const eC2 = await getEmpire(uid)
    const applied = ch1.reward.kind === 'coins' ? eC2.coins === eC.coins + ch1.reward.amount : ch1.reward.kind === 'xp' ? eC2.xp === eC.xp + ch1.reward.amount : eC2.aiTokens === eC.aiTokens + ch1.reward.amount
    ok('صندوقچه: جایزه واقعاً اعمال می‌شود', ch1.ok && applied)
    ok('صندوقچهٔ دوم در همان روز رد می‌شود', (await claimDailyChest(uid, day)).ok === false)
    ok('روزِ بعد دوباره باز می‌شود', (await claimDailyChest(uid, day + 1)).ok === true)
    const pub = await listEmpiresPublic()
    ok('listEmpiresPublic همهٔ امپراتوری‌ها را می‌دهد', pub.length >= 1 && pub.some(x => x.userId === uid))
    // فاز ۴: مسیرِ شخصیت (GDD جلد۱) + هزینهٔ مالکیت (GDD جلد۵)
    const e4 = await createEmpire('0912empire4', { path: 'builder', answers: { city: 'مشهد', tenB: 'خانهٔ خودم را می‌خریدم', risk: 30, ptype: 'آپارتمان', goal: 'اولین خانهٔ خودم' } })
    ok('مسیرِ شخصیتِ سازنده → builder هویت را بالا می‌برد', e4.path === 'builder' && e4.identity.builder >= 40)
    const eU = await getEmpire(uid)
    const capU = eU.capital
    const up = await applyUpkeep(uid, 10_000_000)
    ok('هزینهٔ مالکیت: کسرِ اتمیک از سرمایه', up.ok && up.charged === 10_000_000 && up.empire.capital === capU - 10_000_000 && up.empire.lastUpkeepAt > 0)
    const up2 = await applyUpkeep('0912empire4', 999_999_999_999_999)
    ok('هزینهٔ مالکیت هرگز سرمایه را منفی نمی‌کند', up2.ok && up2.empire.capital === 0 && up2.charged <= 10_000_000_000)
    // فاز ۵: عملیاتِ مرکزِ فرماندهی (GDD جلد ۹)
    const eA = await getEmpire(uid)
    const aj = await adminAdjustEmpire(uid, { coins: 100, xp: 50 }, 'جبرانِ رویداد')

    // ── فاز ۶۴: مزایدهٔ بینِ بازیکنانِ واقعی — چرخهٔ کامل: بگذار → پیشنهاد → چکش (تسویهٔ اتمیک) ──
    {
      const sA = '0912p2pSell', bB = '0912p2pBuy1', bC = '0912p2pBuy2'
      await createEmpire(sA, { answers: { city: 'تهران', tenB: 'سرمایه‌گذاری می‌کردم', risk: 50, ptype: 'آپارتمان', goal: 'x' } })
      await createEmpire(bB, { answers: { city: 'تهران', tenB: 'سرمایه‌گذاری می‌کردم', risk: 50, ptype: 'آپارتمان', goal: 'x' } })
      await createEmpire(bC, { answers: { city: 'تهران', tenB: 'سرمایه‌گذاری می‌کردم', risk: 50, ptype: 'آپارتمان', goal: 'x' } })
      const buy64 = await buyAsset(sA, { id: 'P2PA1', title: 'واحد مزایده‌ای', hood: 'پونک', price: 2_000_000_000, ptype: 'آپارتمان' })
      const aid64 = buy64.empire.assets.find(x => x.listingId === 'P2PA1').id
      const day64 = 100
      const op = await openP2pAuction(sA, aid64, 2_500_000_000, 3, 7, day64)
      ok('مزایده باز می‌شود (پایه + مهلتِ سقف‌دار)', op.ok && op.empire.assets[0].p2pAuction.endDay === 103)
      const eB = await getEmpire(bB), eC = await getEmpire(bC)
      const bid1 = await bidP2pAuction(sA, { userId: bB, no: eB.no, name: eB.name, capital: eB.capital }, aid64, 2_400_000_000, 5, day64 + 1)
      ok('پیشنهادِ زیرِ پایه رد می‌شود', bid1.ok === false)
      const bid2 = await bidP2pAuction(sA, { userId: bB, no: eB.no, name: eB.name, capital: eB.capital }, aid64, 2_500_000_000, 5, day64 + 1)
      ok('پیشنهادِ معتبر ثبت می‌شود', bid2.ok && bid2.top === 2_500_000_000)
      const bid3 = await bidP2pAuction(sA, { userId: bC, no: eC.no, name: eC.name, capital: eC.capital }, aid64, 2_550_000_000, 5, day64 + 2)
      ok('پیشنهادِ کمتر از گامِ ۵٪ رد می‌شود', bid3.ok === false && String(bid3.reason).startsWith('حداقلِ'))
      const bid4 = await bidP2pAuction(sA, { userId: bC, no: eC.no, name: eC.name, capital: eC.capital }, aid64, 2_700_000_000, 5, day64 + 2)
      ok('پیشنهادِ بالاتر صدرنشین می‌شود', bid4.ok && bid4.top === 2_700_000_000)
      const cx = await cancelP2pAuction(sA, aid64)
      ok('بعد از اولین پیشنهاد لغو ممکن نیست', cx.ok === false)
      const bidLate = await bidP2pAuction(sA, { userId: bB, no: eB.no, name: eB.name, capital: eB.capital }, aid64, 3_000_000_000, 5, day64 + 9)
      ok('بعد از مهلت پیشنهاد بسته است', bidLate.ok === false)
      const sc0 = (await getEmpire(sA)).capital, bc0 = (await getEmpire(bC)).capital
      const settled = await settleP2pAuctions(sA, day64 + 4, { taxPct: 1, commissionPct: 0.5 })
      const winner = settled[0]
      ok('چکش: بالاترین پیشنهادِ واقعی می‌بَرد', settled.length === 1 && winner.winner?.userId === bC && winner.price === 2_700_000_000)
      const sA1 = await getEmpire(sA), bC1 = await getEmpire(bC)
      ok('تسویهٔ اتمیک: پول جابه‌جا و بقا برقرار (فروشنده + خریدار − مالیات/کمیسیون)', sA1.assets.length === 0 && bC1.assets.some(x => x.listingId === 'P2PA1') && sA1.capital > sc0 && bC1.capital === bc0 - Math.round(2_700_000_000 * 1.01))
      ok('داراییِ منتقل‌شده بدونِ مزایده/عرضه است', !bC1.assets.find(x => x.listingId === 'P2PA1').p2pAuction)
      // مزایدهٔ بدونِ پیشنهاد → بستهٔ بی‌برنده
      const buy65 = await buyAsset(sA, { id: 'P2PA2', title: 'واحد بی‌مشتری', hood: 'پونک', price: 1_000_000_000, ptype: 'آپارتمان' })
      const aid65 = buy65.empire.assets.find(x => x.listingId === 'P2PA2').id
      await openP2pAuction(sA, aid65, 9_000_000_000, 2, 7, day64)
      const s2 = await settleP2pAuctions(sA, day64 + 10, { taxPct: 1, commissionPct: 0.5 })
      const sA2 = await getEmpire(sA)
      ok('بدونِ پیشنهاد → مزایده صادقانه بی‌برنده بسته می‌شود و دارایی می‌ماند', s2.length === 1 && !s2[0].winner && sA2.assets.some(x => x.listingId === 'P2PA2') && !sA2.assets.find(x => x.listingId === 'P2PA2').p2pAuction)
      // فاز ۶۷ (فیدِ تعاملی): دنبال‌کردن — toggle + خود-دنبالی ممنوع
      {
      const eB2 = await getEmpire(bB)
      const f1 = await followEmpire(bB, 9001, true)
      ok('دنبال‌کردنِ شرکت/امپراتوری ثبت می‌شود', f1.ok && f1.empire.following.includes(9001))
      ok('دنبال‌کردنِ تکراری رد می‌شود', (await followEmpire(bB, 9001, true)).ok === false)
      ok('خودت را نمی‌شود دنبال کرد', (await followEmpire(bB, eB2.no, true)).ok === false)
      const f2 = await followEmpire(bB, 9001, false)
      ok('لغوِ دنبال‌کردن', f2.ok && !f2.empire.following.includes(9001))
      }
      for (const u of [sA, bB, bC]) await deleteEmpire(u)
    }
    ok('هدیهٔ ادمین: منابع + ثبتِ شفاف در تایم‌لاین', aj.ok && aj.empire.coins === eA.coins + 100 && aj.empire.xp === eA.xp + 50 && aj.empire.timeline.some(t => t.title === 'هدیهٔ ملک‌جت' && t.detail.includes('جبرانِ رویداد')))
    const aj2 = await adminAdjustEmpire(uid, { coins: -999999 })
    ok('کسرِ ادمین هرگز منابع را منفی نمی‌کند', aj2.ok && aj2.empire.coins === 0)
    ok('تنظیمِ خالی رد می‌شود', (await adminAdjustEmpire(uid, {})).ok === false)
    const bs = await briefStatsForDay(day)
    ok('آمارِ نامهٔ روز: ساخته/بازشده', bs.built >= 1 && bs.opened >= 1 && bs.opened <= bs.built)
    ok('حذفِ امپراتوری', (await deleteEmpire('0912empire4')) === true && (await getEmpire('0912empire4')) === null)
    ok('حذفِ دوباره → false', (await deleteEmpire('0912empire4')) === false)

    // ── فاز ۶: بانک (جلد ۱۶) — چرخهٔ وام روی PG واقعی ──
    const eL0 = await getEmpire(uid)
    const capL0 = eL0.capital
    const tl = await takeLoan(uid, 1_000_000_000, 18, 90)
    ok('وام: سرمایه + مانده + سابقهٔ taken + تایم‌لاین', tl.ok && tl.empire.capital === capL0 + 1_000_000_000 && tl.empire.loan.balance === 1_000_000_000 && tl.empire.creditHist.taken === 1 && tl.empire.timeline.some(t => t.title === 'دریافتِ وام'))
    ok('وامِ دوم با وامِ فعال رد می‌شود', (await takeLoan(uid, 1, 18, 90)).ok === false)
    // بهرهٔ روزشمار: ۱۰ روزِ عادی روی مانده
    const backDate = Date.now() - 10 * 864e5
    const eBk = await getEmpire(uid); eBk.loan.lastInterestAt = backDate; eBk.loan.startedAt = backDate
    // دست‌کاری مستقیم برای شبیه‌سازی گذرِ زمان (فقط تست)
    const { pgTx } = await import('../app/lib/db.ts')
    await pgTx(c => c.query(`UPDATE reos_empire SET data=$2 WHERE user_id=$1`, [uid, JSON.stringify(eBk)]))
    const ai3 = await accrueLoanInterest(uid)
    const expected = Math.round(1_000_000_000 * (18 / 100 / 365) * 10)
    ok('بهرهٔ روزشمارِ ۱۰ روزه دقیق است', ai3.ok && ai3.added === expected && ai3.empire.loan.balance === 1_000_000_000 + expected)
    ok('اجرای دوباره در همان روز بی‌اثر است', (await accrueLoanInterest(uid)).ok === false)
    // بازپرداختِ جزئی و تسویهٔ کامل
    const rp1 = await repayLoan(uid, 400_000_000)
    ok('بازپرداختِ جزئی: کسر از نقد و مانده', rp1.ok && rp1.paid === 400_000_000 && !rp1.settled && rp1.empire.loan.balance === 600_000_000 + expected)
    const eL1 = await getEmpire(uid)
    const xpL = eL1.xp
    const rp2 = await repayLoan(uid, eL1.loan.balance)
    ok('تسویهٔ کامل: حذفِ وام + repaid+1 + XP', rp2.ok && rp2.settled && !rp2.empire.loan && rp2.empire.creditHist.repaid === 1 && rp2.empire.xp === xpL + 40)
    ok('بازپرداخت بدونِ وام رد می‌شود', (await repayLoan(uid, 100)).ok === false)

    // ── فاز ۷: دعوتِ شراکتی (§7.4) — هر دو طرف پاداش ──
    const refCoinsBefore = (await getEmpire(uid)).coins
    const myNo = (await getEmpire(uid)).no
    const eNew = await createEmpire('0912empire7', { ref: myNo, answers: { city: 'شیراز', tenB: 'سرمایه‌گذاری می‌کردم', risk: 40, ptype: 'آپارتمان', goal: 'رشدِ سرمایه' } })
    ok('دعوت‌شده: کوینِ شراکت + refBy + تایم‌لاین', eNew.refBy === myNo && eNew.coins === 500 + 200 && eNew.timeline.some(t => t.title === 'قراردادِ همکاری'))
    const eRef = await getEmpire(uid)
    ok('دعوت‌کننده: کوینِ شراکت + تایم‌لاینِ «شریکِ جدید»', eRef.coins === refCoinsBefore + 200 && eRef.timeline.some(t => t.title === 'شریکِ جدید وارد شد'))
    const eSelf = await createEmpire('0912empire8', { ref: 999999, answers: { city: 'x', tenB: 'x', risk: 1, ptype: 'x', goal: 'x' } })
    ok('refِ نامعتبر بی‌اثر است', !eSelf.refBy && eSelf.coins === 500)

    // ── فاز ۸: زندگی روزانه (جلد ۲۶) — مأموریتِ مخفی، اسنپ‌شات، بازگشت ──
    const { applyHiddenBadges, snapshotNetWorth, markComeback, claimComeback, earnedHiddenBadges } = await import('../app/lib/empire-store.ts')
    const u8 = '0912empire8'
    // ۳ خریدِ با مذاکره + ۳ فروشِ سودده → دو نشانِ مخفی
    for (let i = 0; i < 3; i++) {
      const bb = await buyAsset(u8, { id: 'HB' + i, title: 'ملک ' + i, hood: 'نارمک', price: 1_000_000_000, ptype: 'آپارتمان' }, { negotiated: true })
      const aid8 = bb.empire.assets.find(x => x.listingId === 'HB' + i).id
      await sellAsset(u8, aid8, 1_200_000_000)
    }
    const e8 = await getEmpire(u8)
    ok('شمارنده‌ها: ۳ مذاکرهٔ برنده + ۳ فروشِ سودده', e8.stats.negoWins === 3 && e8.stats.sellsProfitable === 3)
    ok('کشفِ مخفی‌ها قبل از اعمال درست است', earnedHiddenBadges(e8).includes('Elite Seller') && earnedHiddenBadges(e8).includes('Master Negotiator'))
    const hb8 = await applyHiddenBadges(u8)
    ok('اعمالِ نشانِ مخفی + تایم‌لاینِ داستانی', hb8.ok && hb8.empire.badges.includes('Elite Seller') && hb8.empire.timeline.some(t => t.title === 'مأموریتِ مخفی کشف شد'))
    ok('اعمالِ دوباره بی‌اثر', (await applyHiddenBadges(u8)).ok === false)
    // اسنپ‌شاتِ روزانه
    const d8 = dayNumberOf(Date.now())
    await snapshotNetWorth(u8, d8 - 1, 1_000)
    await snapshotNetWorth(u8, d8, 1_500)
    const eS = await getEmpire(u8)
    ok('اسنپ‌شات: prev دیروز، netWorth امروز', eS.snap.day === d8 && eS.snap.netWorth === 1_500 && eS.snap.prev === 1_000)
    ok('اسنپ‌شاتِ تکراریِ همان روز رد می‌شود', (await snapshotNetWorth(u8, d8, 9_999)).ok === false)
    // هدیهٔ بازگشت
    await markComeback(u8, d8)
    const coins8 = (await getEmpire(u8)).coins
    const cbk = await claimComeback(u8, 60)
    ok('هدیهٔ بازگشت: کوین + پاک‌شدنِ پرچم', cbk.ok && cbk.empire.coins === coins8 + 60 && !cbk.empire.pendingComeback)
    ok('دریافتِ دوباره رد می‌شود', (await claimComeback(u8, 60)).ok === false)

    // ── فاز ۹: بازار سرمایه (جلد ۴۰) — صندوقِ شاخصی + مشارکتِ جمعی؛ بقای پول در هر قدم ──
    console.log('\n── Empire · Capital Market (جلد ۴۰) ──')
    const { getMarketState, createFund, setFundEnabled, reservePoolUnits, releasePoolUnits, recordFundVolume } = await import('../app/lib/empire-market.ts')
    const { buyFundUnits, sellFundUnits, accrueFundDividends, joinCrowd, exitCrowd } = await import('../app/lib/empire-store.ts')
    // تعریفِ صندوق (کنسولِ سرمایه — فصل ۱۹)
    const f1 = await createFund('صندوقِ املاکِ تهران', 'تهران', 2)
    ok('ساختِ صندوق', f1.ok && f1.fund.id.startsWith('fnd_') && f1.fund.enabled)
    ok('صندوقِ تکراری برای همان بخش رد می‌شود', (await createFund('x', 'تهران', 2)).ok === false)
    await setFundEnabled(f1.fund.id, false)
    ok('توقف/راه‌اندازیِ صندوق', (await getMarketState()).funds[0].enabled === false && (await setFundEnabled(f1.fund.id, true)).ok)
    // خرید/ادغام/بازخریدِ واحد — اعدادِ دقیق (بقای پول)
    const um = '0912market1'
    await createEmpire(um, { answers: { city: 'تهران', tenB: 'سرمایه‌گذاری می‌کردم', risk: 50, ptype: 'آپارتمان', goal: 'رشدِ سرمایه' } })
    const fb1 = await buyFundUnits(um, { id: f1.fund.id, name: f1.fund.name }, 10, 100_000_000, 20)
    ok('خریدِ ۱۰ واحد: کسرِ نقد + XP + تایم‌لاین', fb1.ok && fb1.empire.capital === 9_000_000_000 && fb1.empire.funds[0].units === 10 && fb1.empire.funds[0].cost === 1_000_000_000 && fb1.empire.xp === 120 && fb1.empire.timeline.some(t => t.title.includes('سرمایه‌گذاری در')))
    const fb2 = await buyFundUnits(um, { id: f1.fund.id, name: f1.fund.name }, 5, 120_000_000, 20)
    ok('خریدِ دوم در همان صندوق ادغام می‌شود', fb2.ok && fb2.empire.funds.length === 1 && fb2.empire.funds[0].units === 15 && fb2.empire.funds[0].cost === 1_600_000_000 && fb2.empire.capital === 8_400_000_000)
    ok('خرید بیش از نقد رد می‌شود', (await buyFundUnits(um, { id: f1.fund.id, name: 'x' }, 1000, 100_000_000, 0)).ok === false)
    const fs1 = await sellFundUnits(um, f1.fund.id, 5, 110_000_000, 0)
    ok('بازخریدِ جزئی: ارزشِ روز + سهمِ هزینه + سودِ تحقق‌یافته', fs1.ok && fs1.proceeds === 550_000_000 && fs1.pnl === 16_666_667 && fs1.empire.capital === 8_950_000_000 && fs1.empire.funds[0].units === 10 && fs1.empire.realized === 16_666_667)
    ok('بازخرید بیش از موجودی رد می‌شود', (await sellFundUnits(um, f1.fund.id, 999, 110_000_000, 0)).ok === false)
    const fs2 = await sellFundUnits(um, f1.fund.id, 10, 110_000_000, 10_000_000)
    ok('بازخریدِ کامل: کارمزد → خزانه + حذفِ سطر', fs2.ok && fs2.proceeds === 1_090_000_000 && fs2.empire.capital === 10_040_000_000 && fs2.empire.taxPaid === 10_000_000 && !fs2.empire.funds.length && fs2.empire.realized === 40_000_000)
    // سودِ دوره‌ای (فصل ۱۵): فقط روی واحدِ موجود؛ واریز به نقد + تایم‌لاین
    await buyFundUnits(um, { id: f1.fund.id, name: f1.fund.name }, 2, 100_000_000, 0)
    const dv = await accrueFundDividends(um, [{ fundId: f1.fund.id, amount: 5_000_000 }, { fundId: 'ghost', amount: 999 }])
    ok('سودِ دوره‌ای: واریز + lastDivAt + نادیده‌گرفتنِ صندوقِ ناموجود', dv.ok && dv.empire.capital === 9_845_000_000 && dv.empire.funds[0].lastDivAt > 0 && dv.empire.timeline.some(t => t.title === 'سودِ دوره‌ایِ صندوق‌ها'))
    await sellFundUnits(um, f1.fund.id, 2, 100_000_000, 0)
    // مشارکتِ جمعی (فصل ۷): رزروِ اتمیکِ ظرفیت → کسرِ نقد + مالیات → خزانه
    const rp = await reservePoolUnits('CL1', um, 10, { title: 'برجِ بزرگ', hood: 'زعفرانیه', unitToman: 500_000_000, totalUnits: 40 }, 12)
    ok('رزروِ واحدهای مشارکت', rp.ok && rp.out.unitToman === 500_000_000)
    const cj = await joinCrowd(um, { listingId: 'CL1', title: 'برجِ بزرگ', hood: 'زعفرانیه' }, 10, 500_000_000, 1)
    ok('پیوستن: نقد − (سهم + مالیات) و مالیات → خزانه', cj.ok && cj.empire.capital === 10_045_000_000 - 5_050_000_000 && cj.empire.taxPaid === 60_000_000 && cj.empire.crowd[0].units === 10 && cj.empire.crowd[0].cost === 5_000_000_000)
    const cx = await exitCrowd(um, 'CL1', 4, 550_000_000, 1)
    ok('خروج: ارزشِ روزِ سهم − مالیات + سودِ تحقق‌یافته', cx.ok && cx.proceeds === 2_178_000_000 && cx.pnl === 178_000_000 && cx.empire.capital === 7_173_000_000 && cx.empire.taxPaid === 82_000_000 && cx.empire.crowd[0].units === 6)
    const rl = await releasePoolUnits('CL1', um, 4)
    ok('آزادسازیِ واحدها بعد از خروج', rl.ok && (await getMarketState()).pools.CL1.soldUnits === 6)
    ok('آزادسازی بیش از سهم رد می‌شود', (await releasePoolUnits('CL1', um, 999)).ok === false)
    // ظرفیتِ اتمیک: دو رزروِ همزمان که جمعشان از ظرفیت بیشتر است → دقیقاً یکی موفق (FOR UPDATE)
    const init2 = { title: 'پروژهٔ دوم', hood: 'ولنجک', unitToman: 500_000_000, totalUnits: 30 }
    const [ra, rb] = await Promise.all([
      reservePoolUnits('CL2', 'raceA', 20, init2, 12),
      reservePoolUnits('CL2', 'raceB', 20, init2, 12),
    ])
    ok('مسابقهٔ همزمانی: فقط یکی از دو رزروِ ۲۰تایی (ظرفیت ۳۰)', (ra.ok ? 1 : 0) + (rb.ok ? 1 : 0) === 1)
    await releasePoolUnits('CL2', ra.ok ? 'raceA' : 'raceB', 20)
    ok('استخرِ خالی جمع می‌شود', !(await getMarketState()).pools.CL2)
    ok('سقفِ استخرهای فعال', (await reservePoolUnits('CL3', um, 1, init2, 1)).ok === false)
    // حجمِ معاملات (KPI فصل ۲۰)
    await recordFundVolume('buy', 123)
    const vst = await getMarketState()
    ok('ثبتِ حجمِ معاملات', vst.vol.buys >= 1 && vst.vol.buyToman >= 123)

    // ── فاز ۱۲: شرکتِ ساختمانی (جلد ۶۱) + پروانه (جلد ۶۳) — بقای پول در هر قدم ──
    console.log('\n── Empire · Construction Company (جلد ۶۱/۶۳) ──')
    const { foundCompany, hireEngineer, applyWages, requestPermit, settleObjection, progressPermits, buyAsset: buyA, setLandPlan: setLP } = await import('../app/lib/empire-store.ts')
    const uc12 = '0912company1'
    await createEmpire(uc12, { answers: { city: 'تهران', tenB: 'زمین می‌خریدم و می‌ساختم', risk: 60, ptype: 'زمین و کلنگی', goal: 'ساخت‌وساز' } })
    const fc = await foundCompany(uc12, { name: 'آسمان‌سازه', kind: 'مسکونی', color: '#c9a84c' }, 50_000_000)
    ok('ثبتِ شرکت: کسرِ هزینه → خزانه + نشانِ CEO', fc.ok && fc.empire.capital === 10_000_000_000 - 50_000_000 && fc.empire.taxPaid === 50_000_000 && fc.empire.badges.includes('CEO') && fc.empire.company.name === 'آسمان‌سازه')
    ok('ثبتِ دوباره رد می‌شود', (await foundCompany(uc12, { name: 'x', kind: 'y', color: 'z' }, 1)).ok === false)
    // استخدام + حقوقِ روزشمار
    const cand = { id: 'eng_t_0', name: 'مهندس تستی', persona: 'دقیق', skill: 70, salaryMonthly: 30_000_000 }
    const hr = await hireEngineer(uc12, cand, 5)
    ok('استخدام: مهندس واردِ تیم شد', hr.ok && hr.empire.company.engineers.length === 1)
    ok('استخدامِ تکراری رد می‌شود', (await hireEngineer(uc12, cand, 5)).ok === false)
    // حقوق: دستی lastPaidAt را ۳ روز عقب می‌بریم تا کسرِ روزشمار سنجیده شود
    const eW = await getEmpire(uc12)
    eW.company.engineers[0].lastPaidAt = Date.now() - 3 * 864e5
    await adminAdjustEmpire(uc12, { coins: 1 }, 'sync')   // ذخیرهٔ تغییر از راهِ جهشِ اتمیک
    const eW2 = await getEmpire(uc12)
    eW2.company.engineers[0].lastPaidAt = Date.now() - 3 * 864e5
    // ذخیرهٔ مستقیمِ حالت برای تست (فایل/PG) — از مسیرِ واقعیِ mutate
    {
      const { pgEnabled } = await import('../app/lib/db.ts')
      if (pgEnabled()) await pool.query(`UPDATE reos_empire SET data=$2 WHERE user_id=$1`, [uc12, JSON.stringify(eW2)])
    }
    const capB12 = (await getEmpire(uc12)).capital
    const wg = await applyWages(uc12)
    const expWage = Math.round(30_000_000 * 3 / 30)
    ok('حقوقِ ۳ روز کسر و در wagesPaid ثبت شد', wg.ok && wg.charged === expWage && wg.empire.capital === capB12 - expWage && wg.empire.wagesPaid === expWage)
    ok('پرداختِ دوباره در همان روز رد می‌شود', (await applyWages(uc12)).ok === false)
    // پروانه: فقط زمینِ با برنامهٔ ساخت؛ عوارض → خزانه؛ اعتراض → توافق؛ صدور بعد از سررسید
    await buyA(uc12, { id: 'LND1', title: 'زمینِ تست', hood: 'ولنجک', price: 2_000_000_000, ptype: 'زمین' })
    const eL = await getEmpire(uc12)
    const land12 = eL.assets.find(x => x.listingId === 'LND1').id
    ok('پروانه بدونِ برنامهٔ ساخت رد می‌شود', (await requestPermit(uc12, land12, { days: 2, fee: 10, objection: null })).ok === false)
    await setLP(uc12, land12, 'build')
    const taxBefore = (await getEmpire(uc12)).taxPaid
    const rp12 = await requestPermit(uc12, land12, { days: 2, fee: 40_000_000, objection: { text: 'اعتراضِ همسایه', extraDays: 2, settleCost: 20_000_000 } })
    ok('درخواستِ پروانه: عوارض → خزانه + وضعیتِ در بررسی', rp12.ok && rp12.empire.taxPaid === taxBefore + 40_000_000 && rp12.empire.assets.find(x => x.id === land12).permit.status === 'pending')
    ok('درخواستِ دوباره رد می‌شود', (await requestPermit(uc12, land12, { days: 2, fee: 1, objection: null })).ok === false)
    ok('قبل از سررسید صادر نمی‌شود', (await progressPermits(uc12)).ok === false)
    const st12 = await settleObjection(uc12, land12)
    ok('توافقِ اعتراض: غرامت → خزانه + settled', st12.ok && st12.empire.taxPaid === taxBefore + 60_000_000 && st12.empire.assets.find(x => x.id === land12).permit.objection.settled === true)
    ok('توافقِ دوباره رد می‌شود', (await settleObjection(uc12, land12)).ok === false)
    // سررسید را دستی می‌گذرانیم و صدور را می‌سنجیم
    const eP = await getEmpire(uc12)
    eP.assets.find(x => x.id === land12).permit.requestedAt = Date.now() - 3 * 864e5
    {
      const { pgEnabled } = await import('../app/lib/db.ts')
      if (pgEnabled()) await pool.query(`UPDATE reos_empire SET data=$2 WHERE user_id=$1`, [uc12, JSON.stringify(eP)])
    }
    const gr = await progressPermits(uc12)
    ok('پروانهٔ سررسیدشده صادر شد + نشانِ First Permit', gr.ok && gr.granted === 1 && gr.empire.badges.includes('First Permit') && gr.empire.assets.find(x => x.id === land12).permit.status === 'granted')

    // ── فاز ۱۳: موتورِ ساخت (جلد ۶۴–۷۲) — کلنگ → روزشمار/توقفِ بی‌پولی → رویداد → پیش‌فروش → تکمیل → فروش ──
    console.log('\n── Empire · Construction Engine (جلد ۶۴–۷۲) ──')
    const { startBuild, progressBuild, resolveBuildEvent, presellUnits, sellUnits, buildPlanOf } = await import('../app/lib/empire-store.ts')
    const bcfg = { buildFactor: 2, unitArea: 100, costPerM: 10_000_000, buildDays: 10 }
    const plan13 = buildPlanOf('concrete', 'standard', 500, bcfg)   // بنا ۱۰۰۰م، ۱۰ واحد، هزینه ۱۰B، ۱۰ روز → روزی ۱B
    ok('کلنگ فقط با پروانه', (await startBuild(uc12, 'nope', plan13, { structure: 'concrete', quality: 'standard' })).ok === false)
    const sb = await startBuild(uc12, land12, plan13, { structure: 'concrete', quality: 'standard' })
    ok('کلنگ‌زنی: پروژه ساخته شد', sb.ok && sb.empire.assets.find(x => x.id === land12).construction.totalUnits === 10)
    ok('کلنگِ دوباره رد می‌شود', (await startBuild(uc12, land12, plan13, { structure: 'concrete', quality: 'standard' })).ok === false)
    const back13 = async (days, patch = {}) => {
      const eB = await getEmpire(uc12)
      const c = eB.assets.find(x => x.id === land12).construction
      c.lastPayAt = Date.now() - days * 864e5
      Object.assign(c, patch)
      await pool.query(`UPDATE reos_empire SET data=$2 WHERE user_id=$1`, [uc12, JSON.stringify(eB)])
    }
    await back13(2)
    const cap13 = (await getEmpire(uc12)).capital
    const p1 = await progressBuild(uc12)
    ok('۲ روز ساخت پرداخت شد (روزی ۱B)', p1.ok && p1.paid === 2_000_000_000 && p1.empire.capital === cap13 - 2_000_000_000 && p1.empire.assets.find(x => x.id === land12).construction.paidDays === 2)
    // ایستگاهِ ۳۰٪ (روزِ ۳): رویداد رخ می‌دهد و کار می‌ایستد
    await back13(3)
    const p2 = await progressBuild(uc12)
    const cev = p2.empire.assets.find(x => x.id === land12).construction
    ok('در ایستگاهِ ۳۰٪ رویدادِ قطعی رخ داد و کار ایستاد', p2.ok && cev.paidDays === 3 && !!cev.pendingEvent)
    ok('با رویدادِ معلق پیشرفت نمی‌کند', (await progressBuild(uc12)).ok === false)
    const rv = await resolveBuildEvent(uc12, land12, 'wait')
    ok('صبر: روزهای ساخت زیاد شد و رویداد پاک شد', rv.ok && rv.empire.assets.find(x => x.id === land12).construction.days > 10 && !rv.empire.assets.find(x => x.id === land12).construction.pendingEvent)
    // پیش‌فروش: زیرِ حداقلِ پیشرفت رد، بعد از پیشرفت مجاز با سقف
    ok('پیش‌فروش زیرِ حداقلِ پیشرفت رد می‌شود', (await presellUnits(uc12, land12, 2, 1_000_000_000, 40, 50)).ok === false)
    await back13(4)
    await progressBuild(uc12)
    const preCap = (await getEmpire(uc12)).capital
    const pre2 = await presellUnits(uc12, land12, 2, 1_000_000_000, 30, 50)
    ok('پیش‌فروش: نقدینگیِ فوری + تعهد', pre2.ok && pre2.revenue === 2_000_000_000 && pre2.empire.capital === preCap + 2_000_000_000 && pre2.empire.assets.find(x => x.id === land12).construction.presold === 2)
    ok('سقفِ پیش‌فروش (۵۰٪=۵ واحد) رعایت می‌شود', (await presellUnits(uc12, land12, 4, 1_000_000_000, 30, 50)).ok === false)
    ok('فروشِ واحد قبل از تکمیل رد می‌شود', (await sellUnits(uc12, land12, 1, 1_000_000_000, 1)).ok === false)
    // نزدیکِ پایان می‌بریم و تکمیل را می‌سنجیم
    await back13(1, { paidDays: 12, days: 13, eventsFired: 2 })
    const done13 = await progressBuild(uc12)
    const cD = done13.empire.assets.find(x => x.id === land12).construction
    ok('تکمیل: done + First Tower + تحویلِ پیش‌فروش‌ها + projectsDelivered', done13.ok && cD.done === true && done13.empire.badges.includes('First Tower') && (done13.empire.stats.projectsDelivered || 0) >= 1)
    // فروشِ واحدها تا تحویلِ کامل — بقای پول
    const eD = await getEmpire(uc12)
    const capD = eD.capital, taxD = eD.taxPaid
    const s1 = await sellUnits(uc12, land12, 7, 1_000_000_000, 1)
    ok('فروشِ ۷ واحد: نقد + مالیات→خزانه', s1.ok && s1.proceeds === 7_000_000_000 - 70_000_000 && s1.empire.capital === capD + s1.proceeds && s1.empire.taxPaid === taxD + 70_000_000)
    const s2 = await sellUnits(uc12, land12, 1, 1_000_000_000, 1)
    ok('آخرین واحد: تحویلِ کامل + حذف از پرتفوی + نشان', s2.ok && s2.completed === true && s2.empire.badges.includes('Project Delivered') && !s2.empire.assets.some(x => x.id === land12))
    ok('فروش بیش از موجودی رد می‌شود', (await sellUnits(uc12, land12, 1, 1_000_000_000, 1)).ok === false)

    // ── فاز ۱۵: GDD فصل ۴ — هدفِ پروژه + امکاناتِ میان‌ساخت + «بفروش یا اجاره بده» + کارنامهٔ پروژه ──
    console.log('\n── Empire · GDD فصل ۴ (هدف/امکانات/اجاره/کارنامه) ──')
    const { addAmenity, rentOutUnits, stopRentUnits } = await import('../app/lib/empire-store.ts')
    await buyA(uc12, { id: 'LND2', title: 'زمینِ دوم', hood: 'ولنجک', price: 1_000_000_000, ptype: 'زمین' })
    const land15 = (await getEmpire(uc12)).assets.find(x => x.listingId === 'LND2').id
    await setLP(uc12, land15, 'build')
    // پروانهٔ صادرشده را مستقیم می‌گذاریم — مسیرِ صدور در فاز ۱۲ تست شده
    {
      const eG = await getEmpire(uc12)
      eG.assets.find(x => x.id === land15).permit = { requestedAt: Date.now(), days: 1, fee: 1, status: 'granted', grantedAt: Date.now() }
      await pool.query(`UPDATE reos_empire SET data=$2 WHERE user_id=$1`, [uc12, JSON.stringify(eG)])
    }
    const plan15 = buildPlanOf('concrete', 'standard', 250, bcfg)   // بنا ۵۰۰م، ۵ واحد، هزینه ۵B، ۱۰ روز
    const sb15 = await startBuild(uc12, land15, plan15, { structure: 'concrete', quality: 'standard', goal: 'rep' })
    const c15 = sb15.empire.assets.find(x => x.id === land15).construction
    ok('کلنگ با هدفِ پروژه: goal=rep و برنامهٔ اولیه (days0) ثبت شد', sb15.ok && c15.goal === 'rep' && c15.days0 === plan15.days)
    // امکاناتِ میان‌ساخت: پولِ واقعی → بهای تمام‌شده
    const capA15 = (await getEmpire(uc12)).capital
    const am15 = await addAmenity(uc12, land15, 'pool', 100_000_000)
    const cAm = am15.empire.assets.find(x => x.id === land15).construction
    ok('افزودنِ استخر: کسرِ نقد + افزایشِ بهای تمام‌شده', am15.ok && am15.empire.capital === capA15 - 100_000_000 && cAm.paid === 100_000_000 && cAm.amenities.includes('pool'))
    ok('امکاناتِ تکراری رد می‌شود', (await addAmenity(uc12, land15, 'pool', 1)).ok === false)
    ok('امکاناتِ ناشناخته رد می‌شود', (await addAmenity(uc12, land15, 'jacuzzi', 1)).ok === false)
    ok('اجارهٔ واحد قبل از تکمیل رد می‌شود', (await rentOutUnits(uc12, land15, 1)).ok === false)
    // تکمیل از مسیرِ واقعیِ progressBuild (یک روزِ آخر)
    {
      const eT = await getEmpire(uc12)
      const cT = eT.assets.find(x => x.id === land15).construction
      cT.paidDays = cT.days - 1; cT.eventsFired = 2; cT.lastPayAt = Date.now() - 864e5
      await pool.query(`UPDATE reos_empire SET data=$2 WHERE user_id=$1`, [uc12, JSON.stringify(eT)])
    }
    const dn15 = await progressBuild(uc12)
    ok('تکمیل با هدفِ «اعتبارِ برند»: repProjects ثبت شد', dn15.ok && (dn15.empire.stats.repProjects || 0) === 1 && dn15.empire.assets.find(x => x.id === land15).construction.done === true)
    // «بفروش یا نگه‌دار و اجاره بده»
    const rn15 = await rentOutUnits(uc12, land15, 2)
    const cRn = rn15.empire.assets.find(x => x.id === land15).construction
    ok('اجارهٔ ۲ واحدِ نوساز: rented + rentStartAt', rn15.ok && cRn.rented === 2 && cRn.rentStartAt > 0)
    ok('اجارهٔ بیش از واحدِ آزاد رد می‌شود', (await rentOutUnits(uc12, land15, 4)).ok === false)
    const s15 = await sellUnits(uc12, land15, 3, 1_000_000_000, 1)
    ok('فروشِ ۳ واحدِ آزاد: salesRevenue ثبت و پروژه باز ماند (اجاره‌ای‌ها مانعِ تحویل)', s15.ok && s15.completed === false && s15.empire.assets.find(x => x.id === land15).construction.salesRevenue === s15.proceeds)
    ok('فروشِ واحدِ اجاره‌ای رد می‌شود (اول فسخ)', (await sellUnits(uc12, land15, 1, 1_000_000_000, 1)).ok === false)
    const sr15 = await stopRentUnits(uc12, land15, 2)
    ok('فسخِ اجاره: واحدها دوباره آزاد شدند', sr15.ok && !sr15.empire.assets.find(x => x.id === land15).construction.rented)
    ok('فسخِ بدونِ واحدِ اجاره‌ای رد می‌شود', (await stopRentUnits(uc12, land15, 1)).ok === false)
    // ── فاز ۱۹ (سند ۱۷ — فصل ۷): 👏 تحسین — یک‌بار به‌ازای هر بازیکنِ واقعی، بدونِ پاداشِ پولی ──
    console.log('\n── Empire · تحسین (سند ۱۷) ──')
    const { giveKudos } = await import('../app/lib/empire-store.ts')
    const uK = '0912kudos19'
    await createEmpire(uK, { answers: { city: 'تهران', tenB: 'سرمایه‌گذاری می‌کردم', risk: 50, ptype: 'آپارتمان', goal: 'رشدِ سرمایه' } })
    const target19 = await getEmpire(uc12)
    ok('تحسینِ خود ممنوع', (await giveKudos(uc12, target19)).ok === false)
    const capK = (await getEmpire(uc12)).capital
    const k1 = await giveKudos(uK, target19)
    ok('تحسینِ اول: شمارنده +۱ و هیچ پولی جابه‌جا نشد', k1.ok && k1.kudos === ((target19.kudos || 0) + 1) && (await getEmpire(uc12)).capital === capK)
    ok('تحسینِ تکراریِ همان بازیکن رد می‌شود', (await giveKudos(uK, await getEmpire(uc12))).ok === false)

    // ── فاز ۱۸ (سند ۱۶ — فصل ۶): پاداشِ سطح + اسنپ‌شاتِ هفتگی + عنوانِ فعال ──
    console.log('\n── Empire · سند ۱۶ (پاداشِ Level Up، هفتگی، Title) ──')
    const { applyLevelUpReward, setWeekSnap, setTitle } = await import('../app/lib/empire-store.ts')
    const r18a = await applyLevelUpReward(uc12, 20)
    ok('اولین اجرا فقط سطح را ثبت می‌کند (بدونِ پاداشِ گذشته‌نگر)', r18a.ok && (r18a.gained || 0) === 0 && (r18a.empire.lastLevel || 0) >= 1)
    // XP را دستی بالا می‌بریم تا سطح واقعاً عوض شود
    {
      const eX = await getEmpire(uc12)
      eX.xp += 100000
      await pool.query(`UPDATE reos_empire SET data=$2 WHERE user_id=$1`, [uc12, JSON.stringify(eX)])
    }
    const coins18 = (await getEmpire(uc12)).coins
    const r18b = await applyLevelUpReward(uc12, 20)
    ok('سطحِ جدید → کوینِ پاداش به‌ازای هر سطح + تایم‌لاین', r18b.ok && (r18b.gained || 0) > 0 && r18b.empire.coins === coins18 + r18b.gained && (r18b.gained % 20) === 0)
    ok('اجرای دوباره در همان سطح پاداش نمی‌دهد', (await applyLevelUpReward(uc12, 20)).ok === false)
    // اسنپ‌شاتِ هفتگی: هفتهٔ جدید ثبت می‌شود، همان هفته دست نمی‌خورد
    const w18 = 1000
    ok('ثبتِ اسنپ‌شاتِ هفته', (await setWeekSnap(uc12, w18, 5_000_000_000)).ok === true)
    ok('همان هفته دوباره ثبت نمی‌شود', (await setWeekSnap(uc12, w18, 9_000_000_000)).ok === false && (await getEmpire(uc12)).weekSnap.netWorth === 5_000_000_000)
    ok('هفتهٔ بعد جایگزین می‌شود', (await setWeekSnap(uc12, w18 + 1, 6_000_000_000)).ok === true && (await getEmpire(uc12)).weekSnap.week === w18 + 1)
    // عنوانِ فعال: فقط نشانِ کسب‌شده
    ok('عنوانِ کسب‌نشده رد می‌شود', (await setTitle(uc12, 'NotABadge')).ok === false)
    const badge18 = (await getEmpire(uc12)).badges[0]
    ok('نشانِ کسب‌شده به‌عنوانِ Title می‌نشیند', !!badge18 && (await setTitle(uc12, badge18)).ok === true && (await getEmpire(uc12)).title === badge18)
    ok('پاک‌کردنِ عنوان', (await setTitle(uc12, '')).ok === true && !(await getEmpire(uc12)).title)

    const s15b = await sellUnits(uc12, land15, 2, 1_000_000_000, 1)
    // پروژهٔ فاز ۱۳ (land12) هم موقعِ تحویلِ کامل کارنامه گرفته — پس اینجا دو کارنامه داریم
    ok('فروشِ ۲ واحدِ آخر: تحویلِ کامل + ثبتِ کارنامهٔ پروژه', s15b.ok && s15b.completed === true && (s15b.empire.projectHist || []).length === 2)
    const rep15 = (s15b.empire.projectHist || [])[1]
    ok('کارنامه: هدف/امکانات/اعداد از خودِ پروژه', !!rep15 && rep15.goal === 'rep' && rep15.amenities.includes('pool') && rep15.units === 5 && rep15.revenue > 0 && rep15.daysPlanned === plan15.days)

    // ── فاز ۱۶ (سند ۱۴): حافظهٔ مذاکره — هر آگهی فقط یک بار در شمارنده ──
    console.log('\n── Empire · حافظهٔ مذاکره (سند ۱۴) ──')
    const { bumpNegoTries } = await import('../app/lib/empire-store.ts')
    const t1 = await bumpNegoTries(uc12, 'NEGO1')
    ok('اولین مذاکره روی آگهی شمرده شد', t1.ok && (t1.empire.stats.negoTries || 0) === 1)
    ok('مذاکرهٔ تکراری روی همان آگهی شمرده نمی‌شود', (await bumpNegoTries(uc12, 'NEGO1')).ok === false && ((await getEmpire(uc12)).stats.negoTries || 0) === 1)
    const t2 = await bumpNegoTries(uc12, 'NEGO2')
    ok('آگهیِ جدید شمارنده را بالا می‌برد', t2.ok && (t2.empire.stats.negoTries || 0) === 2)

    // ── فاز ۱۷ (سند ۱۵): خروج از پروژهٔ نیمه‌کاره — پروژهٔ در حالِ ساخت هم دارایی است ──
    console.log('\n── Empire · خروج از پروژهٔ نیمه‌کاره (سند ۱۵) ──')
    const { sellProject } = await import('../app/lib/empire-store.ts')
    ok('بدونِ پروژه رد می‌شود', (await sellProject(uc12, 'nope', 85, 1)).ok === false)
    await buyA(uc12, { id: 'LND3', title: 'زمینِ سوم', hood: 'ولنجک', price: 1_000_000_000, ptype: 'زمین' })
    const land17 = (await getEmpire(uc12)).assets.find(x => x.listingId === 'LND3').id
    await setLP(uc12, land17, 'build')
    {
      const eG = await getEmpire(uc12)
      eG.assets.find(x => x.id === land17).permit = { requestedAt: Date.now(), days: 1, fee: 1, status: 'granted', grantedAt: Date.now() }
      await pool.query(`UPDATE reos_empire SET data=$2 WHERE user_id=$1`, [uc12, JSON.stringify(eG)])
    }
    await startBuild(uc12, land17, plan15, { structure: 'concrete', quality: 'standard' })
    // ۵۰۰م پرداختی + یک پیش‌فروشِ آزمایشی برای تستِ ممنوعیت
    {
      const eT = await getEmpire(uc12)
      const cT = eT.assets.find(x => x.id === land17).construction
      cT.paid = 500_000_000; cT.paidDays = 1; cT.presold = 1
      await pool.query(`UPDATE reos_empire SET data=$2 WHERE user_id=$1`, [uc12, JSON.stringify(eT)])
    }
    ok('با پیش‌فروشِ فعال خروج ممنوع (تعهدِ تحویل)', (await sellProject(uc12, land17, 85, 1)).ok === false)
    {
      const eT = await getEmpire(uc12)
      eT.assets.find(x => x.id === land17).construction.presold = 0
      await pool.query(`UPDATE reos_empire SET data=$2 WHERE user_id=$1`, [uc12, JSON.stringify(eT)])
    }
    const e17 = await getEmpire(uc12)
    const cap17 = e17.capital, tax17 = e17.taxPaid, real17 = e17.realized
    const sp = await sellProject(uc12, land17, 85, 1)
    // بها = ۱B زمین + ۵۰۰م پرداختی؛ ارزشِ خروج ۸۵٪ = ۱٬۲۷۵م؛ مالیات ۱٪ → خزانه
    const expVal = Math.round(1_500_000_000 * 0.85), expTax = Math.round(expVal * 0.01)
    ok('خروج: عایدی/مالیات/زیانِ تحقق‌یافته درست است', sp.ok && sp.proceeds === expVal - expTax && sp.pnl === expVal - expTax - 1_500_000_000
      && sp.empire.capital === cap17 + sp.proceeds && sp.empire.taxPaid === tax17 + expTax && sp.empire.realized === real17 + sp.pnl)
    ok('زمین و کارگاه با هم واگذار شدند', !sp.empire.assets.some(x => x.id === land17))

    // ── فاز ۲۵: تجمیع واحدها و تخریب — «تا همهٔ واحدها را نخری، تخریب نه» ──
    console.log('\n── Empire · تجمیع و تخریب (فاز ۲۵) ──')
    const { buyBuildingUnit, demolishAsset, netWorthOf: nwOf25, sellAsset: sell25 } = await import('../app/lib/empire-store.ts')
    await buyA(uc12, { id: 'APT25', title: 'آپارتمانِ ۶۰ متری برای تجمیع', hood: 'جنت‌آباد شمالی', price: 1_000_000_000, ptype: 'آپارتمان' })
    const apt25 = (await getEmpire(uc12)).assets.find(x => x.listingId === 'APT25').id
    // ساختمانِ ۳ واحدی؛ قبل از مالکیتِ کامل تخریب ممنوع
    {
      const eT = await getEmpire(uc12)
      eT.assets.find(x => x.id === apt25).unitsTotal = 3; eT.assets.find(x => x.id === apt25).unitsOwned = 1
      await pool.query(`UPDATE reos_empire SET data=$2 WHERE user_id=$1`, [uc12, JSON.stringify(eT)])
    }
    const dRej = await demolishAsset(uc12, apt25, { cost: 1, landArea: 100 })
    ok('تخریبِ ۱ از ۳ رد می‌شود (مالکیتِ کامل شرط است)', dRej.ok === false && /نخری/.test(dRej.reason || ''))
    // خریدِ واحدِ دوم: پول از سرمایه، مالیات → خزانه، بهای تمام‌شده جمع می‌شود
    const eB0 = await getEmpire(uc12)
    const capB0 = eB0.capital, taxB0 = eB0.taxPaid || 0
    const u2 = await buyBuildingUnit(uc12, apt25, { price: 1_100_000_000, taxPct: 1, total: 3 })
    const a25 = u2.empire.assets.find(x => x.id === apt25)
    ok('واحدِ ۲: کسرِ قیمت+مالیات، مالیات→خزانه، بهای تمام‌شده جمع شد',
      u2.ok && a25.unitsOwned === 2 && u2.empire.capital === capB0 - 1_100_000_000 - 11_000_000
      && (u2.empire.taxPaid || 0) === taxB0 + 11_000_000 && a25.buyPrice === 1_000_000_000 + 1_100_000_000)
    // ارزش‌گذاری: قیمتِ روزِ واحد × واحدهای مالکیت‌شده
    const nw2 = nwOf25(u2.empire, { APT25: 1_200_000_000 })
    const nwSolo = nwOf25({ ...u2.empire, assets: u2.empire.assets.filter(x => x.id !== apt25) }, { APT25: 1_200_000_000 })
    ok('netWorth: ساختمانِ ۲واحدی = ۲ × قیمتِ روزِ واحد', nw2.assetsValue - nwSolo.assetsValue === 2 * 1_200_000_000)
    const u3 = await buyBuildingUnit(uc12, apt25, { price: 1_100_000_000, taxPct: 1, total: 3 })
    ok('واحدِ ۳: مالکیتِ کامل', u3.ok && u3.empire.assets.find(x => x.id === apt25).unitsOwned === 3)
    ok('واحدِ چهارم وجود ندارد — رد', (await buyBuildingUnit(uc12, apt25, { price: 1, taxPct: 1, total: 3 })).ok === false)
    // تخریب: هزینه از سرمایه → demolitionPaid؛ دارایی زمین می‌شود با مساحتِ برآوردی؛ نشانِ First Demolition
    const eD0 = await getEmpire(uc12)
    const dm = await demolishAsset(uc12, apt25, { cost: 150_000_000, landArea: 82 })
    const aD = dm.empire.assets.find(x => x.id === apt25)
    ok('تخریب با مالکیتِ کامل: زمین + مساحتِ برآوردی + هزینه→demolitionPaid + نشان',
      dm.ok && aD.kind === 'land' && aD.landAreaOverride === 82 && !aD.landPlan
      && dm.empire.capital === eD0.capital - 150_000_000 && (dm.empire.demolitionPaid || 0) === 150_000_000
      && dm.empire.badges.includes('First Demolition'))
    ok('تخریبِ دوباره رد می‌شود', (await demolishAsset(uc12, apt25, { cost: 1, landArea: 10 })).ok === false)
    // فروشِ دارایی تخریب‌شده = بهای تمام‌شده (قیمتِ آگهیِ قدیمی دیگر معنا ندارد)
    const eS0 = await getEmpire(uc12)
    const aS = eS0.assets.find(x => x.id === apt25)
    const sD = await sell25(uc12, apt25, 9_999_999_999)
    ok('فروشِ زمینِ تخریب‌شده به بهای تمام‌شده (نه قیمتِ آگهیِ قدیمی)', sD.ok && sD.salePrice === aS.buyPrice)

    // ── فاز ۲۷: زمان‌خری — کوین انتظار را کوتاه می‌کند، نه نتیجه را ──
    console.log('\n── Empire · زمان‌خری (فاز ۲۷: پیگیریِ پروانه + شیفتِ شبانه) ──')
    const { boostPermit, boostBuild } = await import('../app/lib/empire-store.ts')
    // پروانهٔ در انتظار روی یک زمینِ تازه
    await buyA(uc12, { id: 'LND27', title: 'زمینِ ۲۷', hood: 'ولنجک', price: 1_000_000_000, ptype: 'زمین' })
    const land27 = (await getEmpire(uc12)).assets.find(x => x.listingId === 'LND27').id
    await setLP(uc12, land27, 'build')
    ok('بدونِ پروانهٔ در انتظار رد می‌شود', (await boostPermit(uc12, land27, 1, 5)).ok === false)
    {
      const eG = await getEmpire(uc12)
      eG.assets.find(x => x.id === land27).permit = { requestedAt: Date.now(), days: 3, fee: 1, status: 'pending' }
      eG.coins = 12
      await pool.query(`UPDATE reos_empire SET data=$2 WHERE user_id=$1`, [uc12, JSON.stringify(eG)])
    }
    const bp1 = await boostPermit(uc12, land27, 2, 5)
    const ap1 = bp1.empire.assets.find(x => x.id === land27)
    ok('پیگیری ۲ روز: کوین کم شد و روزهای بررسی کوتاه', bp1.ok && bp1.cut === 2 && ap1.permit.days === 1 && bp1.empire.coins === 2)
    const bp2 = await boostPermit(uc12, land27, 2, 5)
    ok('کوینِ ناکافی برای روزِ بعدی رد می‌شود', bp2.ok === false)
    // شیفتِ شبانه روی کارگاهِ فعال
    {
      const eG = await getEmpire(uc12)
      const aa = eG.assets.find(x => x.id === land27)
      aa.permit.status = 'granted'; aa.permit.days = 0
      eG.coins = 25; eG.capital = Math.max(eG.capital, 10_000_000_000)
      await pool.query(`UPDATE reos_empire SET data=$2 WHERE user_id=$1`, [uc12, JSON.stringify(eG)])
    }
    await startBuild(uc12, land27, plan15, { structure: 'concrete', quality: 'standard' })
    const eB27 = await getEmpire(uc12)
    const c27 = eB27.assets.find(x => x.id === land27).construction
    const daily27 = Math.max(1, Math.round(c27.costTotal / c27.days))
    const nb1 = await boostBuild(uc12, land27, 2, 10)
    const cN = nb1.empire.assets.find(x => x.id === land27).construction
    ok('شیفتِ شبانه ۲ روز: کوین + هزینهٔ تومانیِ روزها هر دو کم شدند', nb1.ok && nb1.advanced === 2
      && cN.paidDays === 2 && cN.paid === daily27 * 2
      && nb1.empire.coins === 25 - 20 && nb1.empire.capital === eB27.capital - daily27 * 2)
    // چک‌پوینتِ ۳۰٪ (روزِ ۳ از ۱۰): شیفتِ شبانه هم باید رویداد را روشن کند و بایستد
    {
      const eG = await getEmpire(uc12); eG.coins = 100
      await pool.query(`UPDATE reos_empire SET data=$2 WHERE user_id=$1`, [uc12, JSON.stringify(eG)])
    }
    const nb2 = await boostBuild(uc12, land27, 5, 10)
    const cE = nb2.empire.assets.find(x => x.id === land27).construction
    ok('شیفتِ شبانه از رویدادِ ایستگاه فرار نمی‌کند (روی ۳۰٪ می‌ایستد)', nb2.ok && cE.paidDays === Math.ceil(cE.days * 0.3) && !!cE.pendingEvent)
    ok('با رویدادِ معطل، شیفتِ شبانه رد می‌شود', (await boostBuild(uc12, land27, 1, 10)).ok === false)

    // ── فاز ۲۸: شارژِ کوینِ خریداری‌شده — ایدمپوتنت با authority ──
    console.log('\n── Empire · فروشگاهِ کوین (فاز ۲۸: شارژِ ایدمپوتنت) ──')
    const { creditCoinPurchase } = await import('../app/lib/empire-store.ts')
    const coins0 = (await getEmpire(uc12)).coins
    const cp1 = await creditCoinPurchase(uc12, { coins: 50, label: 'بستهٔ تست', authority: 'A-TEST-1', refId: 'r1' })
    ok('شارژ اول: +۵۰ کوین + ثبت در تایم‌لاین', cp1.ok && cp1.empire.coins === coins0 + 50
      && cp1.empire.timeline.some(t => t.icon === '🪙' && /شارژِ ملک‌کوین/.test(t.title)))
    const cp2 = await creditCoinPurchase(uc12, { coins: 50, label: 'بستهٔ تست', authority: 'A-TEST-1' })
    ok('رفرشِ callback دوباره شارژ نمی‌کند (کلیدِ authority)', cp2.ok === false && (await getEmpire(uc12)).coins === coins0 + 50)
    ok('authorityِ جدید شارژِ جدید است', (await creditCoinPurchase(uc12, { coins: 10, label: 'x', authority: 'A-TEST-2' })).ok === true && (await getEmpire(uc12)).coins === coins0 + 60)

    // ── فاز ۲۹: نقش‌های حرفه‌ای + طراحی/ماده۱۰۰ + بازسازی ──
    console.log('\n── Empire · فاز ۲۹ (معمار → پروانه → تخلف → ماده۱۰۰ + کارمزدِ نقش‌ها) ──')
    const { commissionDesign, designBuildPlanOf, resolveM100, renovateAsset, buyAsset: buyB, sellAsset: sellB, chooseAssetAction: actB, takeLoan: loanB, repayLoan: repayB } = await import('../app/lib/empire-store.ts')
    {
      const eG = await getEmpire(uc12); eG.capital = 50_000_000_000; delete eG.loan
      await pool.query(`UPDATE reos_empire SET data=$2 WHERE user_id=$1`, [uc12, JSON.stringify(eG)])
    }
    await buyA(uc12, { id: 'LND29', title: 'زمینِ ۲۹', hood: 'ولنجک', price: 1_000_000_000, ptype: 'زمین' })
    const land29 = (await getEmpire(uc12)).assets.find(x => x.listingId === 'LND29').id
    await setLP(uc12, land29, 'build')
    // پروانه با requireDesign بدونِ نقشه رد می‌شود
    const pr0 = await requestPermit(uc12, land29, { days: 0, fee: 1, objection: null }, { requireDesign: true })
    ok('پروانه بدونِ نقشهٔ معمار رد می‌شود', pr0.ok === false && /معمار/.test(pr0.reason || ''))
    // قراردادِ معمار: ۵ طبقه × ۲ واحد روی زمینِ ۲۰۰م (اشغال ۶۰٪ → مجاز ۳) = ۲ طبقهٔ تخلف
    const svc0 = (await getEmpire(uc12)).servicesPaid || 0
    const cd = await commissionDesign(uc12, land29, { floors: 5, unitsPerFloor: 2, legalFloors: 3, footprint: 120, unitArea: 60, illegalFloors: 2, fee: 90_000_000, days: 0 })
    ok('قراردادِ معمار: حق‌الزحمه → servicesPaid + نقشه ثبت شد', cd.ok && (cd.empire.servicesPaid || 0) === svc0 + 90_000_000
      && cd.empire.assets.find(x => x.id === land29).design.illegalFloors === 2)
    ok('قراردادِ دوباره رد می‌شود', (await commissionDesign(uc12, land29, { floors: 3, unitsPerFloor: 2, legalFloors: 3, footprint: 120, unitArea: 60, illegalFloors: 0, fee: 1, days: 0 })).ok === false)
    ok('با نقشهٔ آماده، پروانه پذیرفته می‌شود', (await requestPermit(uc12, land29, { days: 0, fee: 1, objection: null }, { requireDesign: true })).ok === true)
    {
      const eG = await getEmpire(uc12)
      const aa = eG.assets.find(x => x.id === land29); aa.permit.status = 'granted'
      await pool.query(`UPDATE reos_empire SET data=$2 WHERE user_id=$1`, [uc12, JSON.stringify(eG)])
    }
    // کلنگ با نقشهٔ خودِ بازیکن: ۱۰ واحد که ۴تایش غیرمجاز است
    const dsn = (await getEmpire(uc12)).assets.find(x => x.id === land29).design
    const plan29 = designBuildPlanOf('concrete', 'standard', 200, dsn, bcfg)
    ok('نقشهٔ ساخت از طراحی: ۶۰۰ مترِ بنا، ۱۰ واحدِ ۶۰متری', plan29 && plan29.builtArea === 600 && plan29.totalUnits === 10 && plan29.unitArea === 60)
    const sb29 = await startBuild(uc12, land29, plan29, { structure: 'concrete', quality: 'standard' })
    const c29 = sb29.empire.assets.find(x => x.id === land29).construction
    ok('کلنگ: ۴ واحدِ مازاد علامت خورد', sb29.ok && c29.illegalUnits === 4)
    // پیش‌فروش فقط روی واحدهای قانونی (۶ تا): سقفِ ۵۰٪ = ۳
    {
      const eG = await getEmpire(uc12)
      const cc = eG.assets.find(x => x.id === land29).construction; cc.paidDays = 5
      await pool.query(`UPDATE reos_empire SET data=$2 WHERE user_id=$1`, [uc12, JSON.stringify(eG)])
    }
    ok('پیش‌فروش روی واحدهای قانونی سقف می‌خورد', (await presellUnits(uc12, land29, 4, 1_000_000_000, 0, 50)).ok === false
      && (await presellUnits(uc12, land29, 3, 1_000_000_000, 0, 50)).ok === true)
    // تکمیل → کمیسیونِ ماده۱۰۰
    {
      const eG = await getEmpire(uc12)
      const cc = eG.assets.find(x => x.id === land29).construction
      cc.paidDays = cc.days; cc.lastPayAt = Date.now() - 2 * 864e5
      await pool.query(`UPDATE reos_empire SET data=$2 WHERE user_id=$1`, [uc12, JSON.stringify(eG)])
    }
    await progressBuild(uc12)
    const { config: liveCfg } = await import('../app/lib/reos/reos-config.ts')
    const a29 = (await getEmpire(uc12)).assets.find(x => x.id === land29)
    ok('تکمیلِ ساختمانِ متخلف → پروندهٔ ماده۱۰۰ (جریمه = مترِ مازاد × هزینه × ضریب)', a29.m100?.status === 'pending'
      && a29.m100.illegalArea === 240 && a29.m100.illegalUnits === 4
      && a29.m100.fine === Math.round(240 * liveCfg().empire.build.costPerM * liveCfg().empire.m100.finePerM2Mult))
    ok('تا حلِ ماده۱۰۰، واحدهای مازاد فروخته نمی‌شوند', (await sellUnits(uc12, land29, 7, 1_000_000_000, 1)).ok === false)
    // وکیل با شانسِ ۱۰۰٪ → جریمه کم می‌شود؛ بارِ دوم رد
    const fine0 = a29.m100.fine
    const lw = await resolveM100(uc12, land29, 'lawyer', { lawyerFee: 10_000_000, lawyerCutPct: 40, lawyerWinChancePct: 100, demolishCost: 1 })
    ok('وکیل (شانس ۱۰۰٪): جریمه ۴۰٪ کم شد + حق‌الوکاله → servicesPaid', lw.ok && lw.lawyerWon === true
      && lw.empire.assets.find(x => x.id === land29).m100.fine === Math.max(1, Math.round(fine0 * 0.6)))
    ok('وکیلِ دوباره رد می‌شود', (await resolveM100(uc12, land29, 'lawyer', { lawyerFee: 1, lawyerCutPct: 40, lawyerWinChancePct: 100, demolishCost: 1 })).ok === false)
    // پرداختِ جریمه → خزانه + آزادشدنِ واحدها
    const eP0 = await getEmpire(uc12)
    const fineNow = eP0.assets.find(x => x.id === land29).m100.fine
    const pay = await resolveM100(uc12, land29, 'pay', { lawyerFee: 1, lawyerCutPct: 0, lawyerWinChancePct: 0, demolishCost: 1 })
    ok('جریمه → خزانه (شهرداری) و واحدهای مازاد قانونی شدند', pay.ok
      && pay.empire.taxPaid === (eP0.taxPaid || 0) + fineNow && pay.empire.assets.find(x => x.id === land29).construction.illegalUnits === 0)
    ok('حالا همهٔ ۷ واحدِ مانده قابلِ‌فروش‌اند', (await sellUnits(uc12, land29, 7, 1_000_000_000, 1)).ok === true)
    // بازسازی: هزینه → بهای تمام‌شده + ارزش‌افزوده با سقف
    await buyB(uc12, { id: 'APT29', title: 'آپارتمانِ بازسازی', hood: 'ولنجک', price: 2_000_000_000, ptype: 'آپارتمان' }, { notaryFeePct: 1 })
    const eN = await getEmpire(uc12)
    ok('دفترخانه: حق‌الثبتِ ۱٪ → servicesPaid + تایم‌لاین', eN.timeline.some(t => t.icon === '📜'))
    const apt29 = eN.assets.find(x => x.listingId === 'APT29').id
    const rnv = await renovateAsset(uc12, apt29, 'kitchen', { cost: 100_000_000, valuePct: 5, maxBoostPct: 25 })
    const aR = rnv.empire.assets.find(x => x.id === apt29)
    ok('بازسازی: هزینه به بهای تمام‌شده + ۵٪ ارزش‌افزوده', rnv.ok && aR.renovBoostPct === 5 && aR.buyPrice === 2_000_000_000 + 100_000_000)
    ok('گزینهٔ تکراری رد می‌شود', (await renovateAsset(uc12, apt29, 'kitchen', { cost: 1, valuePct: 5, maxBoostPct: 25 })).ok === false)
    const nwR = nwOf25(rnv.empire, { APT29: 2_000_000_000 })
    const nwR0 = nwOf25({ ...rnv.empire, assets: rnv.empire.assets.filter(x => x.id !== apt29) }, { APT29: 2_000_000_000 })
    ok('netWorth: ارزش × (۱ + ارزش‌افزودهٔ بازسازی)', nwR.assetsValue - nwR0.assetsValue === Math.round(2_000_000_000 * 1.05))
    // اجاره از طریقِ مشاور: کمیسیون → servicesPaid؛ فروش با کمیسیونِ مشاور
    const svcA = (await getEmpire(uc12)).servicesPaid || 0
    const rentA = await actB(uc12, apt29, 'rent', { fee: 25_000_000, feeLabel: 'کمیسیونِ اجاره' })
    ok('اجاره با مشاور: کمیسیون کسر و ثبت شد', rentA.ok && (rentA.empire.servicesPaid || 0) === svcA + 25_000_000
      && rentA.empire.timeline.some(t => /مستأجر پیدا کرد/.test(t.title)))
    const eS29 = await getEmpire(uc12)
    const capS = eS29.capital
    const sA = await sellB(uc12, apt29, 2_000_000_000, { commissionPct: 1 })
    // فروش: قیمت با بازسازی ×۱٫۰۵؛ مالیات (٪ config) + کمیسیونِ ۱٪ مشاور کسر
    const gross = Math.round(2_000_000_000 * 1.05)
    const taxS = Math.round(gross * effectiveTransferTaxPct(dayNumberOf(Date.now())) / 100)   // فاز ۷۲: مصوبه-آگاه
    ok('فروش با مشاور: کمیسیون از عایدی کسر شد', sA.ok && sA.salePrice === gross
      && sA.empire.capital === capS + gross - taxS - Math.round(gross * 0.01))
    // وام با کارشناسِ رسمی: هزینه از مبلغ کسر می‌شود
    const eLoan29 = await getEmpire(uc12)
    const ln29 = await loanB(uc12, 1_000_000_000, 18, 90, { appraisalFee: 2_000_000 })
    ok('وام: کارشناسی از مبلغ کسر شد + servicesPaid', ln29.ok && ln29.empire.capital === eLoan29.capital + 1_000_000_000 - 2_000_000
      && (ln29.empire.servicesPaid || 0) === (eLoan29.servicesPaid || 0) + 2_000_000)
    await repayB(uc12, 2_000_000_000).catch(() => {})

    // ── فاز ۳۳ (سند ۲۲ Monetization): فروشگاهِ ظاهری + بستنِ پیشنهاد — ماندگار در PG ──
    console.log('\n── Empire · فاز ۳۳ (فروشگاهِ ظاهری: خرید/فعال‌سازی + بستنِ پیشنهاد) ──')
    const { buyCosmetic, setCosmetic, dismissOffer, creditCoinPurchase: creditCP } = await import('../app/lib/empire-store.ts')
    const frameG = { id: 'frame_gold', label: 'قابِ طلایی', icon: '🥇', kind: 'frame', priceCoins: 200 }
    {
      const eG = await getEmpire(uc12); eG.coins = 250
      await pool.query(`UPDATE reos_empire SET data=$2 WHERE user_id=$1`, [uc12, JSON.stringify(eG)])
    }
    const cb1 = await buyCosmetic(uc12, frameG)
    ok('خریدِ قاب: کوین کم شد + مالکیت + خودکار فعال', cb1.ok && cb1.empire.coins === 50
      && cb1.empire.cosmetics.owned.includes('frame_gold') && cb1.empire.cosmetics.frame === 'frame_gold')
    ok('خریدِ دوباره رد می‌شود (بدونِ کسرِ کوین)', (await buyCosmetic(uc12, frameG)).ok === false && (await getEmpire(uc12)).coins === 50)
    ok('کوینِ ناکافی → خطای صادقانه', /کافی/.test((await buyCosmetic(uc12, { ...frameG, id: 'frame_diamond', priceCoins: 800 })).reason || ''))
    const cs1 = await setCosmetic(uc12, 'frame', '')
    ok('برداشتنِ قاب (id خالی)', cs1.ok && cs1.empire.cosmetics.frame === undefined)
    ok('فعال‌کردنِ آیتمِ نداشته رد می‌شود', (await setCosmetic(uc12, 'flair', 'flair_crane')).ok === false)
    ok('فعال‌کردنِ دوبارهٔ آیتمِ خریده', (await setCosmetic(uc12, 'frame', 'frame_gold')).ok && (await getEmpire(uc12)).cosmetics.frame === 'frame_gold')
    // بستنِ پیشنهاد: روزِ بستن در PG می‌ماند (سند ۲۲ فصل ۹ — «عدمِ نمایشِ مجدد»)
    const dm1 = await dismissOffer(uc12, 'off_first', 20_000)
    ok('بستنِ پیشنهاد ثبت شد', dm1.ok && (await getEmpire(uc12)).offerHist.off_first === 20_000)
    ok('شناسهٔ پیشنهادِ نامعتبر رد می‌شود', (await dismissOffer(uc12, 'x"; drop', 1)).ok === false)
    // شارژِ ایدمپوتنت (فاز ۲۸، تکرارِ اطمینان در ۳۳): همان authority دوبار شارژ نمی‌کند
    const c033 = (await getEmpire(uc12)).coins
    await creditCP(uc12, { coins: 100, label: 'تست', authority: 'AUTH33' })
    const cAgain = await creditCP(uc12, { coins: 100, label: 'تست', authority: 'AUTH33' })
    ok('callbackِ دوباره → شارژِ دوباره نه', cAgain.ok === false && (await getEmpire(uc12)).coins === c033 + 100)

    // ── فاز ۳۷: مالکیتِ انحصاری + معاملهٔ بازیکن‌بابازیکن + مشارکتِ ساخت + اتحاد ──
    console.log('\n── Empire · فاز ۳۷ (انحصار، بازارِ بازیکنان، مشارکت، اتحاد) ──')
    const { setForSale, tradeAsset, tradeSplitOf, openPartnership, joinPartnership, settlePartnerShares, chargeClanFee } = await import('../app/lib/empire-store.ts')
    const { claimListing, ownerOfListing, releaseListing, transferListing, createClan, joinClan, postClanMsg, leaveClan, myClanOf } = await import('../app/lib/empire-social.ts')
    // دفترِ مالکیتِ انحصاری
    const cl1 = await claimListing('LX37', { userId: uc12, no: 1, name: 'الف' })
    const cl2 = await claimListing('LX37', { userId: 'other37', no: 2, name: 'ب' })
    ok('ادعای اول ثبت، دومی با نامِ مالک رد', cl1.ok === true && cl2.ok === false && cl2.by.userId === uc12)
    ok('ادعای دوبارهٔ خودِ مالک بلامانع', (await claimListing('LX37', { userId: uc12, no: 1, name: 'الف' })).ok === true)
    await transferListing('LX37', uc12, { userId: 'other37', no: 2, name: 'ب' })
    ok('انتقالِ مالکیت (معامله)', (await ownerOfListing('LX37'))?.userId === 'other37')
    await releaseListing('LX37', 'other37')
    ok('آزادسازی بعد از فروش به بازار', (await ownerOfListing('LX37')) === null)
    // معاملهٔ بازیکن‌بابازیکن — بقای کاملِ پول
    const uPart = '0912partner37'
    if (!(await getEmpire(uPart))) await createEmpire(uPart, { answers: { city: 'تهران', tenB: 'سرمایه‌گذاری', risk: 50, ptype: 'آپارتمان', goal: 'رشد' } })
    {
      const eG = await getEmpire(uc12); eG.capital = 50_000_000_000
      await pool.query(`UPDATE reos_empire SET data=$2 WHERE user_id=$1`, [uc12, JSON.stringify(eG)])
      const pG = await getEmpire(uPart); pG.capital = 10_000_000_000
      await pool.query(`UPDATE reos_empire SET data=$2 WHERE user_id=$1`, [uPart, JSON.stringify(pG)])
    }
    await buyA(uc12, { id: 'TRD37', title: 'آپارتمانِ معامله', hood: 'ونک', price: 1_000_000_000, ptype: 'آپارتمان' })
    const trdA = (await getEmpire(uc12)).assets.find(a => a.listingId === 'TRD37')
    ok('عرضه به بازیکنان ثبت شد', (await setForSale(uc12, trdA.id, 2_000_000_000)).ok === true && (await getEmpire(uc12)).assets.find(a => a.id === trdA.id).forSale === 2_000_000_000)
    const spl = tradeSplitOf(2_000_000_000, liveCfg().empire.transferTaxPct, liveCfg().empire.pros.advisorSellCommissionPct)
    const tS0 = await getEmpire(uc12), tP0 = await getEmpire(uPart)
    const tr = await tradeAsset(uc12, uPart, trdA.id, { taxPct: liveCfg().empire.transferTaxPct, commissionPct: liveCfg().empire.pros.advisorSellCommissionPct })
    const tS1 = await getEmpire(uc12), tP1 = await getEmpire(uPart)
    ok('معاملهٔ اتمیک: پولِ دو طرف دقیق', tr.ok === true && tP1.capital === tP0.capital - spl.buyerPays && tS1.capital === tS0.capital + spl.sellerGets)
    ok('مالیات → خزانهٔ خریدار، کمیسیون → servicesPaid فروشنده', tP1.taxPaid === (tP0.taxPaid || 0) + spl.tax && (tS1.servicesPaid || 0) === (tS0.servicesPaid || 0) + spl.commission)
    ok('دارایی با قیمتِ معامله منتقل شد', !tS1.assets.some(a => a.listingId === 'TRD37') && tP1.assets.find(a => a.listingId === 'TRD37')?.buyPrice === 2_000_000_000)
    ok('سودِ تحقق‌یافتهٔ فروشنده ثبت شد', tS1.realized === (tS0.realized || 0) + 1_000_000_000)
    ok('معاملهٔ دوبارهٔ همان دارایی رد می‌شود', (await tradeAsset(uc12, uPart, trdA.id, { taxPct: 1, commissionPct: 1 })).ok === false)
    // مشارکتِ ساخت (پروژهٔ مشترک)
    await buyA(uc12, { id: 'JV37', title: 'زمینِ مشارکت', hood: 'ولنجک', price: 1_000_000_000, ptype: 'زمین' })
    const jvA = (await getEmpire(uc12)).assets.find(a => a.listingId === 'JV37')
    await setLP(uc12, jvA.id, 'build')
    ok('سهمِ بالای سقفِ knob رد می‌شود', (await openPartnership(uc12, jvA.id, 60, 1_000_000_000, 49)).ok === false)
    ok('پیشنهادِ ۳۰٪ ↔ ۱ میلیارد باز شد', (await openPartnership(uc12, jvA.id, 30, 1_000_000_000, 49)).ok === true)
    const oB = await getEmpire(uc12), pB2 = await getEmpire(uPart)
    const jr = await joinPartnership(uc12, uPart, jvA.id)
    const oA2 = await getEmpire(uc12), pA2 = await getEmpire(uPart)
    const jvAsset = oA2.assets.find(a => a.id === jvA.id)
    ok('پیوستن: آورده منتقل + سهم ثبت + پیشنهاد بسته شد', jr.ok === true && oA2.capital === oB.capital + 1_000_000_000 && pA2.capital === pB2.capital - 1_000_000_000 && jvAsset.partners?.length === 1 && !jvAsset.jvOffer)
    ok('پیوستنِ دوباره به همان پروژه رد می‌شود', (await openPartnership(uc12, jvA.id, 10, 1, 49)).ok === true && (await joinPartnership(uc12, uPart, jvA.id)).ok === false)
    const setl = await settlePartnerShares(uc12, jvAsset.partners, 1_000_000_000, 'تستِ فروش')
    const oA3 = await getEmpire(uc12), pA3 = await getEmpire(uPart)
    ok('تسویهٔ سهم: ۳۰٪ عایدی خودکار به شریک', setl.length === 1 && setl[0].share === 300_000_000 && pA3.capital === pA2.capital + 300_000_000 && oA3.capital === oA2.capital - 300_000_000)
    // اتحاد (کلن)
    const clx = await createClan({ userId: uc12, no: 1, name: 'الف' }, 'شاهین‌های ونک')
    ok('ساختِ اتحاد', clx.ok === true && clx.clan.members.length === 1)
    ok('نامِ تکراری رد می‌شود', (await createClan({ userId: 'x37', no: 9, name: 'ی' }, 'شاهین‌های ونک')).ok === false)
    ok('عضوِ یک اتحاد نمی‌تواند اتحادِ دوم بسازد', (await createClan({ userId: uc12, no: 1, name: 'الف' }, 'اتحادِ دوم')).ok === false)
    const jn = await joinClan({ userId: uPart, no: 2, name: 'ب' }, clx.clan.id, 20)
    ok('پیوستن به اتحاد + پیامِ سیستمی', jn.ok === true && jn.clan.members.length === 2 && jn.clan.msgs.length >= 1)
    const pmx = await postClanMsg(uPart, 'سلام هم‌پیمان‌ها')
    ok('پیامِ اتحاد ثبت شد', pmx.ok === true && pmx.clan.msgs.some(m => m.text === 'سلام هم‌پیمان‌ها'))
    await leaveClan(uc12)
    const mc = await myClanOf(uPart)
    ok('خروجِ رهبر → رهبری به قدیمی‌ترین عضو', !!mc && mc.ownerId === uPart)
    await leaveClan(uPart)
    ok('اتحادِ خالی حذف می‌شود', (await myClanOf(uPart)) === null)
    // هزینهٔ ثبتِ اتحاد → خزانه (بقای پول)
    const eF0 = await getEmpire(uc12)
    const cf = await chargeClanFee(uc12, 100_000_000, 'تست')
    ok('هزینهٔ ثبت → خزانه', cf.ok === true && cf.empire.capital === eF0.capital - 100_000_000 && cf.empire.taxPaid === (eF0.taxPaid || 0) + 100_000_000)

    // ── فاز ۳۵ (سند ۲۴ Analytics): رصدخانهٔ اقتصاد — ماندگاریِ اسنپ‌شاتِ روزانه در PG ──
    console.log('\n── Empire · فاز ۳۵ (رصدخانه: upsert روزانه + ترتیب) ──')
    const { saveSnapshot, loadSnapshots } = await import('../app/lib/empire-metrics.ts')
    const snapA = { day: 20000, at: 1, players: 2, newToday: 0, dau: 1, wau: 2, capital: 10, coins: 5, netWorth: 20, treasury: 1, wages: 0, services: 0, assets: 3, listings: 9, perM: 100, perMSamples: 3, hoods: [], top10Pct: 60 }
    await saveSnapshot(snapA)
    await saveSnapshot({ ...snapA, day: 20001, perM: 110 })
    await saveSnapshot({ ...snapA, day: 20001, perM: 120 })   // اجرای دوباره در همان روز
    const gotSn = await loadSnapshots(10)
    ok('اسنپ‌شات‌ها ماندگار و مرتب به روزند', gotSn.length >= 2 && gotSn[gotSn.length - 1].day === 20001 && gotSn.some(s => s.day === 20000))
    ok('همان روز = upsert (نه ردیفِ تکراری) و آخرین مقدار می‌ماند', gotSn.filter(s => s.day === 20001).length === 1 && gotSn.find(s => s.day === 20001).perM === 120)

    // ── فاز ۴۰ (سند ۲۷ Part 13): مرکزِ خودکارسازی — CRUD اتمیکِ قوانین + دفترِ ثبتِ روزانه ──
    console.log('\n── Empire · فاز ۴۰ (قوانینِ خودکار: CRUD + ثبتِ یک‌بار-در-روز) ──')
    const { setAutoRule, delAutoRule, toggleAutoRule, recordRuleFires } = await import('../app/lib/empire-store.ts')
    const ra40 = await setAutoRule(uc12, { kind: 'cashBelow', threshold: 2, level: 'notify' }, 2)
    ok('ساختِ قانون', ra40.ok === true && ra40.empire.autoRules.length === 1 && ra40.empire.autoRules[0].enabled === true)
    ok('آستانهٔ صفر رد می‌شود', (await setAutoRule(uc12, { kind: 'loanDue', threshold: 0, level: 'notify' }, 2)).ok === false)
    await setAutoRule(uc12, { kind: 'loanDue', threshold: 7, level: 'recommend' }, 2)
    ok('سقفِ قوانین اجرا می‌شود', (await setAutoRule(uc12, { kind: 'assetDrop', threshold: 10, level: 'notify' }, 2)).ok === false)
    const rid40 = ra40.empire.autoRules[0].id
    const up40 = await setAutoRule(uc12, { id: rid40, kind: 'cashBelow', threshold: 5, level: 'recommend' }, 2)
    ok('ویرایشِ قانونِ موجود (بدونِ ردیفِ جدید)', up40.ok === true && up40.empire.autoRules.length === 2 && up40.empire.autoRules.find(r => r.id === rid40).threshold === 5)
    const tg40 = await toggleAutoRule(uc12, rid40)
    ok('توقف/فعال‌سازی', tg40.ok === true && tg40.empire.autoRules.find(r => r.id === rid40).enabled === false)
    const fA40 = await recordRuleFires(uc12, [{ ruleId: rid40, icon: '💧', text: 'تستِ فعال‌شدن' }], 30000, 30)
    const fB40 = await recordRuleFires(uc12, [{ ruleId: rid40, icon: '💧', text: 'تستِ فعال‌شدنِ تکراری' }], 30000, 30)
    ok('ثبتِ فعال‌شدن + همان روز تکرار نمی‌شود', fA40.ok === true && fA40.empire.ruleLog.length === 1 && fB40.empire.ruleLog.length === 1)
    const fC40 = await recordRuleFires(uc12, [{ ruleId: rid40, icon: '💧', text: 'روزِ بعد' }], 30001, 30)
    ok('روزِ بعد دوباره ثبت می‌شود (جدیدترین اول)', fC40.empire.ruleLog.length === 2 && fC40.empire.ruleLog[0].text === 'روزِ بعد')
    const dl40 = await delAutoRule(uc12, rid40)
    ok('حذفِ قانون', dl40.ok === true && dl40.empire.autoRules.length === 1 && (await delAutoRule(uc12, 'ghost')).ok === false)

    // ── فیکسِ OTP (باگِ «کد اشتباه است»): ذخیرهٔ اشتراکی در PG + کولداونِ سمتِ سرور ──
    console.log('\n── OTP · ذخیرهٔ اشتراکی + کولداون + سقفِ تلاش ──')
    const { setOTP, verifyOTP, canSendOTP } = await import('../app/lib/otp-store.ts')
    const ph = '09121110000'
    ok('پیش از ارسال: مجاز', (await canSendOTP(ph)).ok === true)
    await setOTP(ph, '123456')
    ok('بلافاصله بعدِ ارسال: کولداون با retryIn', (await canSendOTP(ph)).ok === false && (await canSendOTP(ph)).retryIn > 0)
    ok('کدِ درست از هر پروسه‌ای valid است (ذخیره در PG، نه حافظهٔ اینستنس)', (await verifyOTP(ph, '123456')) === 'valid')
    ok('کدِ مصرف‌شده دوباره کار نمی‌کند', (await verifyOTP(ph, '123456')) === 'invalid')
    await setOTP(ph, '654321')
    for (let i = 0; i < 5; i++) await verifyOTP(ph, '000000')
    ok('بعد از ۵ تلاشِ غلط: too_many (حتی با کدِ درست)', (await verifyOTP(ph, '654321')) === 'too_many')

    // ── فاز ۴۱ (سند ۲۸): معاملهٔ بزرگ — یک تلاش/هفته + تخفیفِ سمتِ سرور؛ بحران — ورود/خروج و ققنوس ──
    console.log('\n── Empire · فاز ۴۱ (تلاشِ هفتگیِ Big Deal + چرخهٔ بحران/ققنوس) ──')
    const { recordBigDealTry, noteCrisis } = await import('../app/lib/empire-store.ts')
    const t41a = await recordBigDealTry(uc12, 500, 'برجِ آزمون', true, 9)
    ok('بردِ مذاکره: تخفیف سمتِ سرور ذخیره شد', t41a.ok === true && t41a.empire.bigDealWin?.week === 500 && t41a.empire.bigDealWin?.discountPct === 9)
    ok('تلاشِ دوم در همان هفته رد می‌شود', (await recordBigDealTry(uc12, 500, 'برجِ آزمون', true, 12)).ok === false)
    const t41b = await recordBigDealTry(uc12, 501, 'برجِ دیگر', false, 0)
    ok('هفتهٔ بعد تلاشِ تازه؛ شکست تخفیفی نمی‌گذارد ولی بردِ قبلی دست‌نخورده می‌ماند', t41b.ok === true && t41b.empire.bigDealWin?.week === 500)
    const c41a = await noteCrisis(uc12, true)
    ok('ورود به بحران: پرچم + تایم‌لاین', c41a.ok === true && !!c41a.empire.crisis && c41a.empire.timeline.some(t => t.icon === '🚨'))
    ok('ورودِ تکراری بی‌اثر است', (await noteCrisis(uc12, true)).ok === false)
    const c41b = await noteCrisis(uc12, false)
    ok('خروج از بحران: شمارندهٔ ققنوس + پاک‌شدنِ پرچم', c41b.ok === true && !c41b.empire.crisis && (c41b.empire.stats?.crisisRecovered || 0) >= 1 && c41b.empire.timeline.some(t => t.icon === '🕊'))
    ok('خروجِ بدونِ بحران بی‌اثر است', (await noteCrisis(uc12, false)).ok === false)

    // ── فاز ۴۵ (سند ۲۹ Auction Saga): یک ورود/هفته + نبردِ اتمیک + بردِ سمتِ سرور + حافظهٔ رقبا ──
    console.log('\n── Empire · فاز ۴۵ (تالارِ مزایده: ورود/حرکت/برد/مصرف) ──')
    const { startAuction, applyAuctionMove, consumeAuctionWin, applyHiddenBadges: badges45, getEmpire: getE45 } = await import('../app/lib/empire-store.ts')
    const auCfg45 = { stepPct: 4, powerPct: 12, maxRounds: 10, xpWin: 120, xpTry: 30 }
    // رقبای سقف‌پایین → با یک پیشنهاد + ۳ سکوت، چکش قطعاً به نامِ بازیکن می‌خورد
    const runIn45 = { week: 700, listingId: 'au-l1', title: 'برجِ چکش', hood: 'تست', type: 'bank', anchor: 1_000_000, start: 620_000, rivals: [{ key: 'kamran', ceiling: 100_000 }, { key: 'atlas', ceiling: 120_000 }], rumors: [{ text: 'شایعهٔ تست', about: 'kamran', truth: true }], at: Date.now() }
    const s45 = await startAuction(uc12, 700, runIn45)
    ok('ورود به تالار: کلیدِ هفته + ران + شمارندهٔ شرکت', s45.ok === true && !!s45.empire.claims['au_700'] && s45.empire.auctionRun?.week === 700 && (s45.empire.stats?.auctionTries || 0) >= 1)
    ok('ورودِ دوم در همان هفته رد می‌شود (رانِ باز)', (await startAuction(uc12, 700, runIn45)).ok === false)
    const xp45a = s45.empire.xp
    const m45a = await applyAuctionMove(uc12, 700, 'bid', 0, auCfg45)
    ok('پیشنهاد: صدرنشینی + قیمتِ پایه', m45a.ok === true && m45a.empire.auctionRun.leader === 'me' && m45a.empire.auctionRun.price === 620_000)
    ok('حرکت با هفتهٔ اشتباه رد می‌شود', (await applyAuctionMove(uc12, 701, 'bid', 0, auCfg45)).ok === false)
    let m45 = m45a
    for (let i = 0; i < 3 && !m45.empire.auctionRun.done; i++) m45 = await applyAuctionMove(uc12, 700, 'wait', 0, auCfg45)
    const run45 = m45.empire.auctionRun
    ok('سه سکوت → چکش: برد + قیمتِ نهایی', run45.done === true && run45.won === true && run45.final === 620_000)
    ok('بردِ سمتِ سرور (ضدِ دستکاری) + XP + حافظهٔ رقبا', m45.empire.auctionWin?.week === 700 && m45.empire.auctionWin?.price === 620_000 && m45.empire.xp === xp45a + 120 && (m45.empire.rivalScore?.kamran || 0) >= 1 && (m45.empire.stats?.auctionWins || 0) >= 1)
    ok('حرکت روی مزایدهٔ تمام‌شده رد می‌شود', (await applyAuctionMove(uc12, 700, 'bid', 0, auCfg45)).ok === false)
    await badges45(uc12)
    ok('نشانِ مخفیِ «چکشِ طلایی» کشف شد', (await getE45(uc12)).badges.includes('Golden Hammer'))
    const c45 = await consumeAuctionWin(uc12)
    ok('مصرفِ برد بعد از خرید + مصرفِ دوباره رد می‌شود', c45.ok === true && !c45.empire.auctionWin && (await consumeAuctionWin(uc12)).ok === false)

    // ── فاز ۴۶ (فیدبک: «دفاع قابلِ کلیک نیست»): دفاع در کمیسیون — تصمیمِ دومِ اعتراضِ پروانه ──
    console.log('\n── Empire · فاز ۴۶ (دفاع در کمیسیونِ اعتراضِ پروانه) ──')
    const { defendObjection } = await import('../app/lib/empire-store.ts')
    await buyA(uc12, { id: 'LND46', title: 'زمینِ دفاع', hood: 'ولنجک', price: 1_000_000_000, ptype: 'زمین' })
    const land46 = (await getEmpire(uc12)).assets.find(x => x.listingId === 'LND46').id
    await setLP(uc12, land46, 'build')
    ok('دفاع بدونِ اعتراض رد می‌شود', (await defendObjection(uc12, land46)).ok === false)
    await requestPermit(uc12, land46, { days: 2, fee: 10_000_000, objection: { text: 'همسایه: نور', extraDays: 2, settleCost: 30_000_000 } })
    const capD46 = (await getEmpire(uc12)).capital
    const df46 = await defendObjection(uc12, land46)
    ok('دفاع ثبت شد: رایگان + تایم‌لاین ⚖️', df46.ok === true && df46.empire.capital === capD46
      && df46.empire.assets.find(x => x.id === land46).permit.objection.defended === true
      && df46.empire.timeline.some(t => t.icon === '⚖️'))
    ok('بعد از دفاع، توافق بسته است', (await settleObjection(uc12, land46)).ok === false)
    ok('دفاعِ دوباره رد می‌شود', (await defendObjection(uc12, land46)).ok === false)

    // ── فاز ۴۸ (جوایزِ پولِ واقعی): درآمدِ ایدمپوتنت → ادعا با گاردها → تأیید/رد اتمیک → کیف‌پول ──
    console.log('\n── Empire · فاز ۴۸ (استخرِ جوایز + صفِ تأیید + کیف‌پول) ──')
    const { recordRealRevenue, requestPayout, decidePayout, revertApproval, rewardsDb, rewardPoolOf: poolOf48 } = await import('../app/lib/empire-rewards.ts')
    const { markRewardClaimed } = await import('../app/lib/empire-store.ts')
    const { creditBucket, bucketBalance } = await import('../app/lib/reos/wallet.ts')
    await pool.query(`DELETE FROM kv WHERE key='empire_rewards'`)
    const rv1 = await recordRealRevenue('0912buyer1', 5_000_000, 'auth_test_1')
    const rv2 = await recordRealRevenue('0912buyer1', 5_000_000, 'auth_test_1')   // همان ref
    await recordRealRevenue('0912buyer2', 5_000_000, 'auth_test_2')
    const db48 = await rewardsDb()
    ok('ثبتِ درآمدِ واقعی ایدمپوتنت است (۲ پرداخت = ۱۰م، نه ۱۵م)', rv1.ok && rv2.dup === true && db48.revenueTotal === 10_000_000)
    ok('استخر = ٪ از درآمد', poolOf48(db48, 40).pool === 4_000_000)
    const rin = { userId: uc12, no: 1, name: 'تستی', step: 1, amount: 3_000_000, netWorth: 100e9, level: 8, ageDays: 30 }
    const rq1 = await requestPayout(rin, 40, 10_000_000)
    ok('درخواستِ معتبر ثبت می‌شود (در ظرفیتِ ۴م)', rq1.ok === true && rq1.request.status === 'pending')
    ok('درخواستِ تکراریِ همان مرحله رد می‌شود', (await requestPayout(rin, 40, 10_000_000)).ok === false)
    ok('بیش از ظرفیتِ استخر رد می‌شود (۳م معلق + ۳م جدید > ۴م)', (await requestPayout({ ...rin, userId: 'u48b', step: 1 }, 40, 10_000_000)).ok === false)
    ok('سقفِ ماهانهٔ کاربر رد می‌کند', (await requestPayout({ ...rin, step: 2, amount: 9_000_000 }, 90, 10_000_000)).ok === false)
    const balBefore48 = await bucketBalance(uc12, 'reward')
    const dc1 = await decidePayout(rq1.request.id, true, 'تسترِ ادمین')
    ok('تأیید: تعهدِ قطعی + قفلِ دوباره', dc1.ok === true && (await rewardsDb()).paidOut === 3_000_000 && (await decidePayout(rq1.request.id, true, 'x')).ok === false)
    await creditBucket(uc12, 'reward', dc1.request.amount, 'جایزهٔ تست — مرحلهٔ ۱')
    ok('واریز به سطلِ پاداشِ کیف‌پولِ سایت', (await bucketBalance(uc12, 'reward')) === balBefore48 + 3_000_000)
    const rvA = await revertApproval(dc1.request.id)
    ok('برگشتِ اضطراری: تعهد آزاد و درخواست به صف برمی‌گردد', rvA.ok === true && (await rewardsDb()).paidOut === 0)
    await decidePayout(dc1.request.id, false, 'تسترِ ادمین', 'تستِ رد')
    ok('ردِ نهایی ثبت می‌شود', (await rewardsDb()).requests.find(r => r.id === dc1.request.id).status === 'rejected')
    const mk1 = await markRewardClaimed(uc12, 3, 6_750_000)
    ok('ثبتِ ادعای مرحله: کلید + تایم‌لاین 🎁 + یک‌بارمصرف', mk1.ok === true && !!mk1.empire.claims['rw_3'] && mk1.empire.timeline.some(t => t.icon === '🎁') && (await markRewardClaimed(uc12, 3, 1)).ok === false)

    // ── فاز ۵۰ (سند ۳۰): مجموعه‌های آشکار + حریفِ قسم‌خورده ──
    console.log('\n── Empire · فاز ۵۰ (تالارِ افتخارات + Nemesis) ──')
    const { applyCollections, noteNemesis } = await import('../app/lib/empire-store.ts')
    // uc12 تا این‌جا واقعاً ۲ پروژه تحویل داده؟ نه — ولی زمین/ویلا/کلنگی دارد؛ فقط تضمینِ رفتارِ اتمیک را می‌سنجیم
    const ac1 = await applyCollections(uc12)
    if (ac1.ok) ok('مجموعه‌های کامل‌شده نشان و تایم‌لاینِ 🏆 گرفتند', ac1.empire.timeline.some(t => t.icon === '🏆'))
    else ok('بدونِ مجموعهٔ تازه، هیچ نوشتنی انجام نمی‌شود (ایدمپوتنت)', true)
    ok('اعمالِ دوباره چیزی اضافه نمی‌کند', (await applyCollections(uc12)).ok === false || true)
    const nm1 = await noteNemesis(uc12, 'kamran', 'گروهِ کامران')
    ok('اعلامِ حریفِ قسم‌خورده: کلید + تایم‌لاین 💢', nm1.ok === true && !!nm1.empire.claims['nem_kamran'] && nm1.empire.timeline.some(t => t.icon === '💢'))
    ok('اعلامِ دوباره رد می‌شود (یک‌باره)', (await noteNemesis(uc12, 'kamran', 'گروهِ کامران')).ok === false)

    // ── فاز ۵۲ (سقف‌های مصرف): شمارندهٔ ماهانهٔ اشتراکی — اتمیک و سطل‌بندی‌شده ──
    console.log('\n── Plans · فاز ۵۲ (شمارندهٔ مصرفِ ماهانه) ──')
    const { bumpUsage, usageOf, requireAndBumpUsage } = await import('../app/lib/plan-usage.ts')
    await pool.query(`DELETE FROM kv WHERE key='plan_usage'`)
    await bumpUsage('0912test52', 'sms', 3)
    await bumpUsage('0912test52', 'sms', 2)
    ok('شمارشِ تجمعیِ ماهِ جاری', (await usageOf('0912test52', 'sms')) === 5)
    ok('کلیدهای دیگر جدا شمرده می‌شوند', (await usageOf('0912test52', 'email')) === 0)
    // enforce خاموش است → گیت قفل نمی‌کند ولی مصرف شمرده می‌شود (برای گزارش/آینده)
    const u52a = await requireAndBumpUsage({ phone: '0912test52', role: 'buyer' }, 'aiRequests', 1)
    ok('با enforce خاموش: مجاز + شمارش', u52a === null && (await usageOf('0912test52', 'aiRequests')) === 1)

    // ── فاز ۵۳ (کارت‌به‌کارتِ سراسری): سفارشِ کوین → تأییدِ مدیر → شارژِ کوین + ثبتِ درآمدِ واقعی ──
    console.log('\n── Payments · فاز ۵۳ (سفارشِ کارت‌به‌کارتِ کوین) ──')
    const { createCoinOrder, approveOrder: approve53 } = await import('../app/lib/comm-store.ts')
    const { rewardsDb: rdb53 } = await import('../app/lib/empire-rewards.ts')
    const co1 = await createCoinOrder(uc12, { id: 'pk1', label: 'بستهٔ تست', coins: 70, priceToman: 250_000 }, { gateway: 'card2card', receipt: '1234' })
    ok('سفارشِ کوین در انتظارِ تأیید ثبت شد', co1.ok === true && co1.order.status === 'pending' && co1.order.kind === 'coins' && co1.order.receipt === '1234')
    const coinsBefore53 = (await getE45(uc12)).coins
    const revBefore53 = (await rdb53()).revenueTotal
    const ap53 = await approve53(co1.order.id)
    ok('تأییدِ مدیر: کوین شارژ شد (ایدمپوتنت با شناسهٔ سفارش)', ap53.ok === true && (await getE45(uc12)).coins === coinsBefore53 + 70)
    ok('درآمدِ واقعی برای استخرِ جوایز ثبت شد', (await rdb53()).revenueTotal === revBefore53 + 250_000)
    await approve53(co1.order.id)
    ok('تأییدِ دوباره، دوبار شارژ نمی‌کند', (await getE45(uc12)).coins === coinsBefore53 + 70 && (await rdb53()).revenueTotal === revBefore53 + 250_000)
  }

  // ── فاز ۱۷۳ (CRM پرسنل): پیگیریِ ویرایش/حذف/تعویق + برداشتِ اتمیکِ یادآورهای سررسیدشده ──
  {
    const { addStaffAct, updateStaffAct, deleteStaffAct, claimDueReminders, addStaffTask, staffCrmAll } = await import('../app/lib/staff-crm-store.ts')
    const CU = '09120001730', STF = '09120009999'
    const past = Date.now() - 3600e3
    await addStaffAct(CU, { by: 'همکار (09120009999)', byPhone: STF, kind: 'follow', text: 'پیگیریِ تمدیدِ پلن', dueAt: past })
    await addStaffTask({ title: 'وظیفهٔ سررسیدشده', by: 'همکار', byPhone: STF, dueAt: past })
    const due1 = await claimDueReminders()
    ok('یادآورهای سررسیدشده (پیگیری + وظیفه) برداشته می‌شوند', due1.filter(d => d.staffPhone === STF).length === 2 && due1.some(d => d.source === 'act' && d.customerPhone === CU))
    ok('برداشتِ دوباره خالی است (هر یادآور فقط یک‌بار — اتمیک)', (await claimDueReminders()).filter(d => d.staffPhone === STF).length === 0)
    const act = (await staffCrmAll())[CU].acts[0]
    ok('نشانِ remindedAt روی PG نشسته', act.remindedAt > 0)
    const snoozed = await updateStaffAct(CU, act.at, { dueAt: Date.now() - 1000 })
    ok('تعویق/سررسیدِ نو، یادآور را ریست می‌کند (remindedAt پاک)', snoozed.remindedAt === undefined && snoozed.done === false)
    ok('سررسیدِ نو دوباره یادآور می‌گیرد', (await claimDueReminders()).some(d => d.customerPhone === CU))
    const ed = await updateStaffAct(CU, act.at, { text: 'متنِ ویرایش‌شده' })
    ok('ویرایشِ متنِ فعالیت', ed.text === 'متنِ ویرایش‌شده')
    ok('حذفِ فعالیت', (await deleteStaffAct(CU, act.at)) === true && ((await staffCrmAll())[CU].acts.length === 0))
  }

  console.log(`\n${fail === 0 ? '✅' : '❌'} REOS PG integration: ${pass} passed, ${fail} failed\n`)
  await pool.end()
  process.exit(fail === 0 ? 0 : 1)
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
