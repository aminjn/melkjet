// REOS v4 · Trust Layer — امتیازِ اعتماد (۰..۱۰۰) + نشان‌های تأییدشده (Verified).
// از سیگنال‌های واقعی: کاملیِ پروفایل، نرخِ پاسخ، معاملات، امتیاز/نظرات، سابقه، و تأییدها.
// هستهٔ خالص (trustScore) تست‌پذیر؛ ذخیرهٔ تأیید/سیگنال dual-mode.
import { pgEnabled, pgTx } from '../db'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { config } from './reos-config'

export type Verification = 'phone' | 'identity' | 'agency' | 'builder' | 'expert' | 'property'
export const VERIF_LABEL: Record<Verification, string> = { phone: 'موبایلِ تأییدشده', identity: 'احرازِ هویت', agency: 'آژانسِ تأییدشده', builder: 'سازندهٔ تأییدشده', expert: 'کارشناسِ تأییدشده', property: 'ملکِ تأییدشده' }
export interface TrustSignals { profileComplete?: number; responseRate?: number; deals?: number; rating?: number; reviews?: number; tenureDays?: number; verified?: Verification[] }
export type Tier = 'طلایی' | 'نقره‌ای' | 'برنزی' | 'جدید'

function clamp01(x: number) { return Math.max(0, Math.min(1, x)) }

// امتیازِ اعتماد (۰..۱۰۰). تأییدها سقفِ اعتماد را بالا می‌برند؛ سیگنال‌های رفتاری آن را پر می‌کنند.
export function trustScore(s: TrustSignals): { score: number; tier: Tier; badges: Verification[]; parts: Record<string, number> } {
  const verified = s.verified || []
  const idV = verified.includes('identity') ? 1 : 0
  const phoneV = verified.includes('phone') ? 1 : 0
  const roleV = verified.some(v => ['agency', 'builder', 'expert'].includes(v)) ? 1 : 0
  const verifiedScore = clamp01(0.5 * idV + 0.2 * phoneV + 0.3 * roleV)

  const profile = clamp01(s.profileComplete ?? 0)
  const response = clamp01(s.responseRate ?? 0.4)
  const dealScore = clamp01(Math.log1p(s.deals || 0) / Math.log1p(50))
  const ratingScore = s.rating != null ? clamp01(s.rating / 5) : 0.5
  const reviewWeight = clamp01(Math.log1p(s.reviews || 0) / Math.log1p(30))   // امتیاز با نظرِ بیشتر معتبرتر
  const ratingEff = ratingScore * (0.5 + 0.5 * reviewWeight)
  const tenure = clamp01((s.tenureDays ?? 0) / 365)

  const parts = {
    verified: Math.round(verifiedScore * 100), profile: Math.round(profile * 100), response: Math.round(response * 100),
    deals: Math.round(dealScore * 100), rating: Math.round(ratingEff * 100), tenure: Math.round(tenure * 100),
  }
  const w = config().trust.weights   // وزن‌ها از تنظیماتِ سوپرادمین
  const score = Math.round(clamp01(w.verified * verifiedScore + w.profile * profile + w.response * response + w.deals * dealScore + w.rating * ratingEff + w.tenure * tenure) * 100)
  const tier: Tier = score >= 80 ? 'طلایی' : score >= 55 ? 'نقره‌ای' : score >= 30 ? 'برنزی' : 'جدید'
  return { score, tier, badges: verified, parts }
}

// ── ذخیرهٔ تأیید/سیگنال (dual-mode) ──
const FILE = join(process.cwd(), '.reos-trust.json')
interface TrustRow { entityId: string; verified: Verification[]; signals: TrustSignals; at: number }
function fileLoad(): Record<string, TrustRow> { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return {} }
function fileSave(d: unknown) { try { writeFileSync(FILE, JSON.stringify(d)) } catch {} }
let ready = false
async function ensure() { if (ready) return; await pgTx(c => c.query(`CREATE TABLE IF NOT EXISTS reos_trust (entity_id text PRIMARY KEY, verified jsonb NOT NULL DEFAULT '[]'::jsonb, signals jsonb NOT NULL DEFAULT '{}'::jsonb, at bigint NOT NULL)`)); ready = true }

async function getRow(entityId: string): Promise<TrustRow> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT * FROM reos_trust WHERE entity_id=$1`, [entityId])); const x = r.rows[0]; return x ? { entityId, verified: x.verified || [], signals: x.signals || {}, at: Number(x.at) } : { entityId, verified: [], signals: {}, at: 0 } }
  return fileLoad()[entityId] || { entityId, verified: [], signals: {}, at: 0 }
}
async function putRow(row: TrustRow): Promise<void> {
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`INSERT INTO reos_trust(entity_id,verified,signals,at) VALUES($1,$2,$3,$4) ON CONFLICT(entity_id) DO UPDATE SET verified=EXCLUDED.verified, signals=EXCLUDED.signals, at=EXCLUDED.at`, [row.entityId, JSON.stringify(row.verified), JSON.stringify(row.signals), row.at])) }
  else { const db = fileLoad(); db[row.entityId] = row; fileSave(db) }
}

export async function setVerification(entityId: string, verification: Verification, on = true): Promise<void> {
  const row = await getRow(entityId)
  const set = new Set(row.verified); if (on) set.add(verification); else set.delete(verification)
  await putRow({ ...row, verified: Array.from(set), at: Date.now() })
}
export async function setSignals(entityId: string, signals: TrustSignals): Promise<void> {
  const row = await getRow(entityId)
  await putRow({ ...row, signals: { ...row.signals, ...signals }, at: Date.now() })
}
export async function getTrust(entityId: string, extraVerified: Verification[] = []): Promise<{ score: number; tier: Tier; badges: Verification[]; parts: Record<string, number> }> {
  const row = await getRow(entityId)
  const verified = Array.from(new Set([...row.verified, ...extraVerified]))
  return trustScore({ ...row.signals, verified })
}
