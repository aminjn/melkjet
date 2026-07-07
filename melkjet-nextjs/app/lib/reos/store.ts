// REOS · Event log + Feature store (dual-mode: PostgreSQL یا فایل)
// جدول‌های واقعیِ PG (events / feature_store) هنگامِ pgEnabled ساخته می‌شوند؛ وگرنه فایل.
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, pgTx } from '../db'
import { EMBED_DIM } from './types'
import type { ReosEvent, EventType } from './types'

const EV_FILE = join(process.cwd(), '.reos-events.json')
const FS_FILE = join(process.cwd(), '.reos-features.json')
const EMB_FILE = join(process.cwd(), '.reos-embeddings.json')
const MAX_FILE_EVENTS = 5000
function uid(p = 'ev_'): string { return p + randomBytes(6).toString('hex') }

let reosSchemaReady = false
async function ensureReos(): Promise<void> {
  if (reosSchemaReady) return
  await pgTx(async c => {
    await c.query(`CREATE TABLE IF NOT EXISTS reos_events (
      id text PRIMARY KEY, type text NOT NULL, user_id text, property_id text, agent_id text, lead_id text,
      meta jsonb NOT NULL DEFAULT '{}'::jsonb, at bigint NOT NULL )`)
    await c.query(`CREATE INDEX IF NOT EXISTS reos_events_type ON reos_events(type)`)
    await c.query(`CREATE INDEX IF NOT EXISTS reos_events_user ON reos_events(user_id)`)
    await c.query(`CREATE INDEX IF NOT EXISTS reos_events_prop ON reos_events(property_id)`)
    await c.query(`CREATE INDEX IF NOT EXISTS reos_events_at ON reos_events(at DESC)`)
    await c.query(`CREATE TABLE IF NOT EXISTS reos_feature_store (
      entity_type text NOT NULL, entity_id text NOT NULL, features jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at bigint NOT NULL, PRIMARY KEY (entity_type, entity_id) )`)
    // بردارِ نهفته (embedding): jsonb همیشه؛ اگر pgvector نصب باشد ستونِ بومیِ vector هم اضافه می‌شود.
    await c.query(`CREATE TABLE IF NOT EXISTS reos_embeddings (
      kind text NOT NULL, entity_id text NOT NULL, dim int NOT NULL,
      embed jsonb NOT NULL, updated_at bigint NOT NULL, PRIMARY KEY (kind, entity_id) )`)
  })
  // Feature Store v2 — ویوهای نوع‌دارِ per-entity روی jsonb (queryable با SQL؛ مسیرِ نوشتن jsonb می‌ماند).
  await pgTx(async c => {
    await c.query(`CREATE OR REPLACE VIEW reos_property_features AS SELECT entity_id AS property_id,
      COALESCE((features->>'click_count')::float,0) AS clicks, COALESCE((features->>'save_count')::float,0) AS saves,
      COALESCE((features->>'contact_count')::float,0) AS contacts, COALESCE((features->>'engagement_score')::float,0) AS engagement,
      updated_at FROM reos_feature_store WHERE entity_type='property'`)
    await c.query(`CREATE OR REPLACE VIEW reos_user_features AS SELECT entity_id AS user_id,
      COALESCE((features->>'click_count')::float,0) AS clicks, COALESCE((features->>'save_count')::float,0) AS saves,
      COALESCE((features->>'contact_count')::float,0) AS contacts, COALESCE((features->>'intent_score')::float,0) AS intent,
      COALESCE((features->>'search_count')::float,0) AS searches, updated_at FROM reos_feature_store WHERE entity_type='user'`)
    await c.query(`CREATE OR REPLACE VIEW reos_agent_features AS SELECT entity_id AS agent_id,
      COALESCE((features->>'assigned_count')::float,0) AS assigned, updated_at FROM reos_feature_store WHERE entity_type='agent'`)
    await c.query(`CREATE OR REPLACE VIEW reos_market_features AS SELECT entity_id AS area,
      COALESCE((features->>'count')::float,0) AS listings, COALESCE((features->>'median_price_per_m')::float,0) AS median_price_per_m,
      COALESCE((features->>'avg_price')::float,0) AS avg_price, COALESCE((features->>'demand_index')::float,0) AS demand_index,
      updated_at FROM reos_feature_store WHERE entity_type='market'`)
  }).catch(() => { /* ویوها اختیاری‌اند */ })
  // تشخیص/فعال‌سازیِ pgvector (اگر ممکن بود). CREATE EXTENSION نیازمندِ superuser است؛
  // اگر نشد، مسیرِ jsonb + cosineِ JS دست‌نخورده کار می‌کند (backward-compatible).
  await detectPgvector()
  reosSchemaReady = true
}

// ═══ pgvector (اختیاری، با fallback به jsonb) ═══
let pgvectorReady: boolean | null = null
async function detectPgvector(): Promise<boolean> {
  if (pgvectorReady !== null) return pgvectorReady
  try {
    try { await pgTx(c => c.query(`CREATE EXTENSION IF NOT EXISTS vector`)) } catch { /* نیازمندِ superuser؛ شاید از قبل نصب باشد */ }
    const r = await pgTx(c => c.query(`SELECT 1 FROM pg_extension WHERE extname='vector'`))
    pgvectorReady = r.rows.length > 0
    if (pgvectorReady) {
      await pgTx(c => c.query(`ALTER TABLE reos_embeddings ADD COLUMN IF NOT EXISTS vec vector(${EMBED_DIM})`))
      try { await pgTx(c => c.query(`CREATE INDEX IF NOT EXISTS reos_embeddings_vec ON reos_embeddings USING hnsw (vec vector_cosine_ops)`)) } catch { /* ایندکس اختیاری؛ seqscan هم درست است */ }
    }
  } catch { pgvectorReady = false }
  return pgvectorReady
}
export async function hasPgvector(): Promise<boolean> { if (pgEnabled()) { await ensureReos() } return !!pgvectorReady }
function vecLit(v: number[]): string { return '[' + v.join(',') + ']' }

// جستجوی نزدیک‌ترین بردارها با pgvector (native، ایندکس‌دار). اگر pgvector نبود null برمی‌گرداند
// تا فراخوان به مسیرِ jsonb + cosineِ JS برگردد.
export async function nearestByVector(kind: string, vec: number[], k = 8): Promise<{ id: string; sim: number }[] | null> {
  if (!pgEnabled()) return null
  await ensureReos()
  if (!pgvectorReady) return null
  const r = await pgTx(c => c.query(
    `SELECT entity_id, 1 - (vec <=> $2::vector) AS sim FROM reos_embeddings
     WHERE kind=$1 AND vec IS NOT NULL ORDER BY vec <=> $2::vector LIMIT $3`, [kind, vecLit(vec), k]))
  return r.rows.map(x => ({ id: x.entity_id as string, sim: Math.round(Number(x.sim) * 1000) / 1000 }))
}

// ── فایل‌مود helpers ──
function fileLoad<T>(f: string, fb: T): T { if (existsSync(f)) { try { return JSON.parse(readFileSync(f, 'utf-8')) } catch {} } return fb }
function fileSave(f: string, d: unknown): void { try { writeFileSync(f, JSON.stringify(d)) } catch {} }

// ═══ Events ═══
export async function recordEvent(input: Omit<ReosEvent, 'id' | 'at'> & { at?: number }): Promise<ReosEvent> {
  const ev: ReosEvent = { id: uid(), at: input.at || Date.now(), type: input.type, userId: input.userId, propertyId: input.propertyId, agentId: input.agentId, leadId: input.leadId, meta: input.meta || {} }
  if (pgEnabled()) {
    await ensureReos()
    await pgTx(c => c.query(
      `INSERT INTO reos_events(id,type,user_id,property_id,agent_id,lead_id,meta,at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [ev.id, ev.type, ev.userId || null, ev.propertyId || null, ev.agentId || null, ev.leadId || null, JSON.stringify(ev.meta), ev.at],
    ))
  } else {
    const db = fileLoad<ReosEvent[]>(EV_FILE, [])
    db.unshift(ev); if (db.length > MAX_FILE_EVENTS) db.length = MAX_FILE_EVENTS
    fileSave(EV_FILE, db)
  }
  return ev
}

// درجِ دسته‌ایِ رویدادها (برای صفِ رویداد؛ یک round-trip به‌جای N تا).
export async function recordEventBatch(evs: ReosEvent[]): Promise<void> {
  if (!evs.length) return
  if (pgEnabled()) {
    await ensureReos()
    // چند-ردیفیِ پارامتری در یک INSERT
    const cols = 8
    const values: string[] = [], params: unknown[] = []
    evs.forEach((ev, i) => {
      const b = i * cols
      values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8})`)
      params.push(ev.id, ev.type, ev.userId || null, ev.propertyId || null, ev.agentId || null, ev.leadId || null, JSON.stringify(ev.meta || {}), ev.at)
    })
    await pgTx(c => c.query(`INSERT INTO reos_events(id,type,user_id,property_id,agent_id,lead_id,meta,at) VALUES ${values.join(',')} ON CONFLICT (id) DO NOTHING`, params))
  } else {
    const db = fileLoad<ReosEvent[]>(EV_FILE, [])
    for (const ev of evs) db.unshift(ev)
    if (db.length > MAX_FILE_EVENTS) db.length = MAX_FILE_EVENTS
    fileSave(EV_FILE, db)
  }
}

export async function recentEvents(opts: { userId?: string; propertyId?: string; type?: EventType; limit?: number } = {}): Promise<ReosEvent[]> {
  const limit = Math.min(opts.limit ?? 200, 2000)
  if (pgEnabled()) {
    await ensureReos()
    const where: string[] = [], params: unknown[] = []
    if (opts.userId) { params.push(opts.userId); where.push(`user_id=$${params.length}`) }
    if (opts.propertyId) { params.push(opts.propertyId); where.push(`property_id=$${params.length}`) }
    if (opts.type) { params.push(opts.type); where.push(`type=$${params.length}`) }
    params.push(limit)
    const rows = await pgTx(c => c.query(`SELECT * FROM reos_events ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY at DESC LIMIT $${params.length}`, params))
    return rows.rows.map(r => ({ id: r.id, type: r.type, at: Number(r.at), userId: r.user_id || undefined, propertyId: r.property_id || undefined, agentId: r.agent_id || undefined, leadId: r.lead_id || undefined, meta: r.meta || {} }))
  }
  let db = fileLoad<ReosEvent[]>(EV_FILE, [])
  if (opts.userId) db = db.filter(e => e.userId === opts.userId)
  if (opts.propertyId) db = db.filter(e => e.propertyId === opts.propertyId)
  if (opts.type) db = db.filter(e => e.type === opts.type)
  return db.slice(0, limit)
}

// آمارِ رویدادها (شمارش به‌تفکیکِ نوع) — برای پنلِ observability.
export async function eventStats(): Promise<{ total: number; byType: Record<string, number> }> {
  const byType: Record<string, number> = {}
  if (pgEnabled()) {
    await ensureReos()
    const r = await pgTx(c => c.query(`SELECT type, count(*)::int AS n FROM reos_events GROUP BY type`))
    let total = 0; for (const row of r.rows) { byType[row.type as string] = row.n as number; total += row.n as number }
    return { total, byType }
  }
  const db = fileLoad<ReosEvent[]>(EV_FILE, [])
  for (const e of db) byType[e.type] = (byType[e.type] || 0) + 1
  return { total: db.length, byType }
}

// پرتعامل‌ترین موجودیت‌ها بر اساسِ یک ویژگی (مثلِ engagement_score) — برای پنلِ observability.
export async function topFeatures(entityType: string, key: string, limit = 10): Promise<{ id: string; value: number; features: Record<string, number> }[]> {
  if (pgEnabled()) {
    await ensureReos()
    const r = await pgTx(c => c.query(`SELECT entity_id, features FROM reos_feature_store WHERE entity_type=$1 ORDER BY (features->>$2)::float DESC NULLS LAST LIMIT $3`, [entityType, key, limit]))
    return r.rows.map(x => ({ id: x.entity_id as string, value: Number((x.features || {})[key]) || 0, features: (x.features || {}) as Record<string, number> }))
  }
  const db = fileLoad<Record<string, Record<string, number>>>(FS_FILE, {})
  return Object.entries(db).filter(([k]) => k.startsWith(entityType + ':')).map(([k, f]) => ({ id: k.slice(entityType.length + 1), value: Number(f[key]) || 0, features: f }))
    .sort((a, b) => b.value - a.value).slice(0, limit)
}

// ═══ Feature Store ═══
export async function getFeatures(entityType: string, entityId: string): Promise<Record<string, number>> {
  if (pgEnabled()) {
    await ensureReos()
    const r = await pgTx(c => c.query(`SELECT features FROM reos_feature_store WHERE entity_type=$1 AND entity_id=$2`, [entityType, entityId]))
    return (r.rows[0]?.features as Record<string, number>) || {}
  }
  const db = fileLoad<Record<string, Record<string, number>>>(FS_FILE, {})
  return db[`${entityType}:${entityId}`] || {}
}

// افزایشِ اتمیکِ ویژگی‌ها (increment). برای شمارنده‌ها (click_count, save_count, …).
export async function bumpFeatures(entityType: string, entityId: string, inc: Record<string, number>, set: Record<string, number> = {}): Promise<void> {
  const now = Date.now()
  if (pgEnabled()) {
    await ensureReos()
    await pgTx(async c => {
      const cur = (await c.query(`SELECT features FROM reos_feature_store WHERE entity_type=$1 AND entity_id=$2 FOR UPDATE`, [entityType, entityId])).rows[0]?.features || {}
      const next = { ...cur }
      for (const k in inc) next[k] = (Number(next[k]) || 0) + inc[k]
      for (const k in set) next[k] = set[k]
      await c.query(
        `INSERT INTO reos_feature_store(entity_type,entity_id,features,updated_at) VALUES($1,$2,$3,$4)
         ON CONFLICT(entity_type,entity_id) DO UPDATE SET features=EXCLUDED.features, updated_at=EXCLUDED.updated_at`,
        [entityType, entityId, JSON.stringify(next), now],
      )
    })
  } else {
    const db = fileLoad<Record<string, Record<string, number>>>(FS_FILE, {})
    const key = `${entityType}:${entityId}`
    const next = { ...(db[key] || {}) }
    for (const k in inc) next[k] = (Number(next[k]) || 0) + inc[k]
    for (const k in set) next[k] = set[k]
    db[key] = next; fileSave(FS_FILE, db)
  }
}

// ═══ Embedding store (pgvector-equivalent؛ compute-once، reuse) ═══
// درجِ دسته‌ایِ بردارها (فقط بردارهای تغییرکرده/جدید نوشته می‌شوند).
export async function saveEmbeddings(kind: string, rows: { id: string; embed: number[] }[]): Promise<void> {
  if (!rows.length) return
  const now = Date.now()
  if (pgEnabled()) {
    await ensureReos()
    if (pgvectorReady) {
      // مسیرِ pgvector: ستونِ بومیِ vec هم پر می‌شود (۶ پارامتر per row).
      const cols = 6, values: string[] = [], params: unknown[] = []
      // vec فقط برای بردارهای هم‌بُعد با ستون (EMBED_DIM) پر می‌شود؛ بقیه NULL (فقط jsonb) تا هرگز خطا ندهد.
      rows.forEach((r, i) => { const b = i * cols; values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6}::vector)`); params.push(kind, r.id, r.embed.length, JSON.stringify(r.embed), now, r.embed.length === EMBED_DIM ? vecLit(r.embed) : null) })
      await pgTx(c => c.query(
        `INSERT INTO reos_embeddings(kind,entity_id,dim,embed,updated_at,vec) VALUES ${values.join(',')}
         ON CONFLICT(kind,entity_id) DO UPDATE SET dim=EXCLUDED.dim, embed=EXCLUDED.embed, updated_at=EXCLUDED.updated_at, vec=EXCLUDED.vec`, params))
    } else {
      const cols = 5, values: string[] = [], params: unknown[] = []
      rows.forEach((r, i) => { const b = i * cols; values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5})`); params.push(kind, r.id, r.embed.length, JSON.stringify(r.embed), now) })
      await pgTx(c => c.query(
        `INSERT INTO reos_embeddings(kind,entity_id,dim,embed,updated_at) VALUES ${values.join(',')}
         ON CONFLICT(kind,entity_id) DO UPDATE SET dim=EXCLUDED.dim, embed=EXCLUDED.embed, updated_at=EXCLUDED.updated_at`, params))
    }
  } else {
    const db = fileLoad<Record<string, { embed: number[]; at: number }>>(EMB_FILE, {})
    for (const r of rows) db[`${kind}:${r.id}`] = { embed: r.embed, at: now }
    fileSave(EMB_FILE, db)
  }
}

export async function getEmbedding(kind: string, id: string): Promise<number[] | null> {
  if (pgEnabled()) {
    await ensureReos()
    const r = await pgTx(c => c.query(`SELECT embed FROM reos_embeddings WHERE kind=$1 AND entity_id=$2`, [kind, id]))
    return (r.rows[0]?.embed as number[]) || null
  }
  const db = fileLoad<Record<string, { embed: number[]; at: number }>>(EMB_FILE, {})
  return db[`${kind}:${id}`]?.embed || null
}

// همهٔ بردارهای یک نوع (بارگذاریِ کاندیداها برای جستجوی برداری). محدود برای ایمنی.
export async function getEmbeddings(kind: string, limit = 3000): Promise<{ id: string; embed: number[] }[]> {
  if (pgEnabled()) {
    await ensureReos()
    const r = await pgTx(c => c.query(`SELECT entity_id, embed FROM reos_embeddings WHERE kind=$1 ORDER BY updated_at DESC LIMIT $2`, [kind, limit]))
    return r.rows.map(x => ({ id: x.entity_id as string, embed: (x.embed as number[]) || [] }))
  }
  const db = fileLoad<Record<string, { embed: number[]; at: number }>>(EMB_FILE, {})
  return Object.entries(db).filter(([k]) => k.startsWith(kind + ':')).slice(0, limit).map(([k, v]) => ({ id: k.slice(kind.length + 1), embed: v.embed }))
}

// شناسه‌های بردارشدهٔ موجود (برای نوشتنِ فقط بردارهای جدید).
export async function existingEmbeddingIds(kind: string): Promise<Set<string>> {
  if (pgEnabled()) {
    await ensureReos()
    const r = await pgTx(c => c.query(`SELECT entity_id FROM reos_embeddings WHERE kind=$1`, [kind]))
    return new Set(r.rows.map(x => x.entity_id as string))
  }
  const db = fileLoad<Record<string, { embed: number[]; at: number }>>(EMB_FILE, {})
  return new Set(Object.keys(db).filter(k => k.startsWith(kind + ':')).map(k => k.slice(kind.length + 1)))
}
