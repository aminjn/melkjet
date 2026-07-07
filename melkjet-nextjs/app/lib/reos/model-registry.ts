// REOS v5 · Model Registry — نسخه‌بندیِ مدل + متریک + champion/challenger + promote.
// پایهٔ MLOps و Model Marketplace. Dual-mode PG/file.
import { pgEnabled, pgTx } from '../db'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

export type ModelStatus = 'candidate' | 'challenger' | 'champion' | 'retired'
export interface ModelVersion { id: string; name: string; version: number; metrics: Record<string, number>; weights: Record<string, number>; status: ModelStatus; at: number; deployedAt?: number }

const FILE = join(process.cwd(), '.reos-models.json')
function fileLoad(): ModelVersion[] { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return [] }
function fileSave(d: unknown) { try { writeFileSync(FILE, JSON.stringify(d)) } catch {} }
let ready = false
async function ensure() { if (ready) return; await pgTx(async c => { await c.query(`CREATE TABLE IF NOT EXISTS reos_models (id text PRIMARY KEY, name text NOT NULL, version integer NOT NULL, metrics jsonb NOT NULL DEFAULT '{}'::jsonb, weights jsonb NOT NULL DEFAULT '{}'::jsonb, status text NOT NULL, at bigint NOT NULL, deployed_at bigint)`); await c.query(`CREATE INDEX IF NOT EXISTS reos_models_name ON reos_models(name)`) }); ready = true }
const rowToV = (x: Record<string, unknown>): ModelVersion => ({ id: x.id as string, name: x.name as string, version: Number(x.version), metrics: (x.metrics as Record<string, number>) || {}, weights: (x.weights as Record<string, number>) || {}, status: x.status as ModelStatus, at: Number(x.at), deployedAt: x.deployed_at ? Number(x.deployed_at) : undefined })

export async function listVersions(name: string): Promise<ModelVersion[]> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT * FROM reos_models WHERE name=$1 ORDER BY version DESC`, [name])); return r.rows.map(rowToV) }
  return fileLoad().filter(m => m.name === name).sort((a, b) => b.version - a.version)
}

export async function registerModel(name: string, weights: Record<string, number>, metrics: Record<string, number>): Promise<ModelVersion> {
  const existing = await listVersions(name)
  const version = (existing[0]?.version || 0) + 1
  const hasChampion = existing.some(m => m.status === 'champion')
  const v: ModelVersion = { id: 'mv_' + randomBytes(6).toString('hex'), name, version, metrics, weights, status: hasChampion ? 'candidate' : 'champion', at: Date.now(), deployedAt: hasChampion ? undefined : Date.now() }
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`INSERT INTO reos_models(id,name,version,metrics,weights,status,at,deployed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [v.id, name, version, JSON.stringify(metrics), JSON.stringify(weights), v.status, v.at, v.deployedAt || null])) }
  else { const db = fileLoad(); db.push(v); fileSave(db) }
  return v
}

export async function getChampion(name: string): Promise<ModelVersion | null> {
  return (await listVersions(name)).find(m => m.status === 'champion') || null
}
export async function getVersion(id: string): Promise<ModelVersion | null> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT * FROM reos_models WHERE id=$1`, [id])); return r.rows[0] ? rowToV(r.rows[0]) : null }
  return fileLoad().find(m => m.id === id) || null
}
async function setStatusRaw(id: string, status: ModelStatus, deployed = false) {
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`UPDATE reos_models SET status=$2${deployed ? ', deployed_at=$3' : ''} WHERE id=$1`, deployed ? [id, status, Date.now()] : [id, status])) }
  else { const db = fileLoad(); const m = db.find(x => x.id === id); if (m) { m.status = status; if (deployed) m.deployedAt = Date.now(); fileSave(db) } }
}

// ارتقا به champion: قهرمانِ قبلی retired می‌شود (rollout ایمن).
export async function promote(id: string): Promise<ModelVersion | null> {
  const v = await getVersion(id); if (!v) return null
  const champ = await getChampion(v.name)
  if (champ && champ.id !== id) await setStatusRaw(champ.id, 'retired')
  await setStatusRaw(id, 'champion', true)
  return getVersion(id)
}
export async function setChallenger(id: string): Promise<void> { await setStatusRaw(id, 'challenger') }
