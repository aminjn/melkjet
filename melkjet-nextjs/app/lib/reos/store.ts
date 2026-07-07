// REOS · Event log + Feature store (dual-mode: PostgreSQL یا فایل)
// جدول‌های واقعیِ PG (events / feature_store) هنگامِ pgEnabled ساخته می‌شوند؛ وگرنه فایل.
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, pgTx } from '../db'
import type { ReosEvent, EventType } from './types'

const EV_FILE = join(process.cwd(), '.reos-events.json')
const FS_FILE = join(process.cwd(), '.reos-features.json')
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
  })
  reosSchemaReady = true
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
