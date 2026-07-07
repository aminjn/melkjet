// REOS v3 · Experiment Platform — A/B Testing برای فید/رتبه‌بندی/قیمت.
// تخصیصِ چسبنده و قطعی (hash(user+exp) → variant) بدونِ نیاز به ذخیره؛ شمارنده‌ها در feature store.
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, pgTx } from '../db'
import { bumpFeatures, getFeatures } from './store'

export interface Experiment { id: string; name: string; variants: string[]; weights: number[]; metric: string; active: boolean; at: number }

// hash پایدار → عددِ [0,1). چسبنده: همان کاربر همیشه همان واریانت.
function hashUnit(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return ((h >>> 0) % 100000) / 100000 }

export function assignVariant(userId: string, expId: string, variants: string[], weights?: number[]): string {
  if (!variants.length) return 'control'
  const w = weights && weights.length === variants.length ? weights : variants.map(() => 1)
  const total = w.reduce((a, b) => a + b, 0) || 1
  const u = hashUnit(userId + '|' + expId) * total
  let acc = 0
  for (let i = 0; i < variants.length; i++) { acc += w[i]; if (u < acc) return variants[i] }
  return variants[variants.length - 1]
}

// ── متادیتای آزمایش (جدولِ کوچک، dual-mode) ──
const FILE = join(process.cwd(), '.reos-experiments.json')
function uid() { return 'exp_' + randomBytes(5).toString('hex') }
function fileLoad(): Experiment[] { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return [] }
function fileSave(d: unknown) { try { writeFileSync(FILE, JSON.stringify(d)) } catch {} }
let ready = false
async function ensure() { if (ready) return; await pgTx(c => c.query(`CREATE TABLE IF NOT EXISTS reos_experiments (id text PRIMARY KEY, name text NOT NULL, variants jsonb NOT NULL, weights jsonb NOT NULL, metric text, active boolean NOT NULL DEFAULT true, at bigint NOT NULL)`)); ready = true }

export async function createExperiment(input: { name: string; variants: string[]; weights?: number[]; metric?: string }): Promise<Experiment> {
  const e: Experiment = { id: uid(), name: input.name, variants: input.variants, weights: input.weights || input.variants.map(() => 1), metric: input.metric || 'conversion', active: true, at: Date.now() }
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`INSERT INTO reos_experiments(id,name,variants,weights,metric,active,at) VALUES($1,$2,$3,$4,$5,true,$6)`, [e.id, e.name, JSON.stringify(e.variants), JSON.stringify(e.weights), e.metric, e.at])) }
  else { const db = fileLoad(); db.push(e); fileSave(db) }
  return e
}
export async function getExperiment(id: string): Promise<Experiment | null> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT * FROM reos_experiments WHERE id=$1`, [id])); const x = r.rows[0]; return x ? { id: x.id, name: x.name, variants: x.variants, weights: x.weights, metric: x.metric, active: x.active, at: Number(x.at) } : null }
  return fileLoad().find(e => e.id === id) || null
}
export async function listExperiments(): Promise<Experiment[]> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT * FROM reos_experiments ORDER BY at DESC`)); return r.rows.map(x => ({ id: x.id, name: x.name, variants: x.variants, weights: x.weights, metric: x.metric, active: x.active, at: Number(x.at) })) }
  return fileLoad()
}

// ── ثبتِ نتیجه (شمارنده در feature store) ──
export async function recordExposure(expId: string, variant: string): Promise<void> { await bumpFeatures('experiment', `${expId}:${variant}`, { exposures: 1 }) }
export async function recordConversion(expId: string, variant: string, value = 0): Promise<void> { await bumpFeatures('experiment', `${expId}:${variant}`, { conversions: 1, value }) }

export interface VariantResult { variant: string; exposures: number; conversions: number; conversionRate: number; value: number }
export async function results(exp: Experiment): Promise<{ variants: VariantResult[]; winner: string | null; lift: number }> {
  const variants: VariantResult[] = []
  for (const v of exp.variants) {
    const f = await getFeatures('experiment', `${exp.id}:${v}`)
    const exposures = f.exposures || 0, conversions = f.conversions || 0
    variants.push({ variant: v, exposures, conversions, conversionRate: exposures ? Math.round((conversions / exposures) * 1000) / 10 : 0, value: f.value || 0 })
  }
  const ranked = [...variants].filter(v => v.exposures >= 1).sort((a, b) => b.conversionRate - a.conversionRate)
  const winner = ranked[0]?.variant || null
  const lift = ranked.length >= 2 && ranked[1].conversionRate ? Math.round(((ranked[0].conversionRate - ranked[1].conversionRate) / ranked[1].conversionRate) * 1000) / 10 : 0
  return { variants, winner, lift }
}
