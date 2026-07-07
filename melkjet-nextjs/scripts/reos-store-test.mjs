// REOS · Integration tests against a REAL PostgreSQL (dual-mode PG path).
// Run: DATABASE_URL=postgres://reos:reos@127.0.0.1:5432/reos_test \
//        node --import ./scripts/reos-loader.mjs scripts/reos-store-test.mjs
// Covers: event log, batch insert, feature store, embeddings, the async queue (flush),
// and the end-to-end training pipeline (events → dataset → fit → persist → prime → predict).
import pg from 'pg'
import { recordEvent, recordEventBatch, recentEvents, eventStats, topFeatures, bumpFeatures, getFeatures, saveEmbeddings, getEmbedding, getEmbeddings, existingEmbeddingIds } from '../app/lib/reos/store.ts'
import { ingest } from '../app/lib/reos/events.ts'
import { flushQueue, queueDepth } from '../app/lib/reos/queue.ts'
import { trainEngageModel, primeEngageModel, predictEngage, buildTrainingSet } from '../app/lib/reos/train.ts'

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

  console.log(`\n${fail === 0 ? '✅' : '❌'} REOS PG integration: ${pass} passed, ${fail} failed\n`)
  await pool.end()
  process.exit(fail === 0 ? 0 : 1)
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
