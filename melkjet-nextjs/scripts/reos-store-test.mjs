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

if (!process.env.DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(2) }
let pass = 0, fail = 0
function ok(name, cond) { if (cond) { pass++; console.log('  ✓', name) } else { fail++; console.log('  ✗', name) } }
const sleep = ms => new Promise(r => setTimeout(r, ms))

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
async function reset() {
  // ensure tables exist first (a no-op call triggers ensureReos), then truncate.
  await recordEvent({ type: 'user_searched', userId: '__warm__' }).catch(() => {})
  await saveEmbeddings('property', [{ id: '__warm__', embed: [0, 0] }]).catch(() => {})
  for (const t of ['reos_events', 'reos_feature_store', 'reos_embeddings']) {
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

  console.log(`\n${fail === 0 ? '✅' : '❌'} REOS PG integration: ${pass} passed, ${fail} failed\n`)
  await pool.end()
  process.exit(fail === 0 ? 0 : 1)
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
