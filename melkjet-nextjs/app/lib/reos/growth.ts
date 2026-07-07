// REOS v4 · Growth Engine — دعوت (referral) + اعتبار. اعتبارِ پاداش به کیفِ پولِ واقعی (Billing) می‌رود.
import { pgEnabled, pgTx } from '../db'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import { credit } from './billing'

export interface Referral { code: string; ownerId: string; invited: number; converted: number; credits: number; at: number }
const FILE = join(process.cwd(), '.reos-referrals.json')
function fileLoad(): Record<string, Referral> { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return {} }
function fileSave(d: unknown) { try { writeFileSync(FILE, JSON.stringify(d)) } catch {} }
let ready = false
async function ensure() { if (ready) return; await pgTx(async c => { await c.query(`CREATE TABLE IF NOT EXISTS reos_referrals (code text PRIMARY KEY, owner_id text NOT NULL, invited integer NOT NULL DEFAULT 0, converted integer NOT NULL DEFAULT 0, credits bigint NOT NULL DEFAULT 0, at bigint NOT NULL)`); await c.query(`CREATE INDEX IF NOT EXISTS reos_referrals_owner ON reos_referrals(owner_id)`) }); ready = true }

// کدِ دعوتِ پایدار per کاربر (۶ نویسه).
export function codeFor(ownerId: string): string { return createHash('sha1').update('ref|' + ownerId).digest('hex').slice(0, 6).toUpperCase() }

export async function getOrCreateReferral(ownerId: string): Promise<Referral> {
  const code = codeFor(ownerId)
  if (pgEnabled()) {
    await ensure()
    const r = await pgTx(c => c.query(`SELECT * FROM reos_referrals WHERE code=$1`, [code]))
    if (r.rows[0]) { const x = r.rows[0]; return { code, ownerId: x.owner_id, invited: x.invited, converted: x.converted, credits: Number(x.credits), at: Number(x.at) } }
    const ref: Referral = { code, ownerId, invited: 0, converted: 0, credits: 0, at: Date.now() }
    await pgTx(c => c.query(`INSERT INTO reos_referrals(code,owner_id,invited,converted,credits,at) VALUES($1,$2,0,0,0,$3) ON CONFLICT(code) DO NOTHING`, [code, ownerId, ref.at]))
    return ref
  }
  const db = fileLoad(); if (!db[code]) { db[code] = { code, ownerId, invited: 0, converted: 0, credits: 0, at: Date.now() }; fileSave(db) }
  return db[code]
}

async function bump(code: string, field: 'invited' | 'converted', creditsDelta = 0): Promise<Referral | null> {
  if (pgEnabled()) {
    await ensure()
    const r = await pgTx(c => c.query(`UPDATE reos_referrals SET ${field}=${field}+1, credits=credits+$2 WHERE code=$1 RETURNING *`, [code, creditsDelta]))
    const x = r.rows[0]; return x ? { code, ownerId: x.owner_id, invited: x.invited, converted: x.converted, credits: Number(x.credits), at: Number(x.at) } : null
  }
  const db = fileLoad(); const ref = db[code]; if (!ref) return null; ref[field]++; ref.credits += creditsDelta; fileSave(db); return ref
}

// ثبتِ دعوت (ثبت‌نامِ کاربرِ جدید با این کد).
export async function recordInvite(code: string): Promise<Referral | null> { return bump(code.toUpperCase(), 'invited') }

// ثبتِ تبدیل (کاربرِ دعوت‌شده کارِ ارزشمند کرد) → پاداشِ اعتبار به کیفِ پولِ دعوت‌کننده.
export async function recordConversion(code: string, rewardToman = 100000): Promise<Referral | null> {
  const ref = await bump(code.toUpperCase(), 'converted', rewardToman)
  if (ref && rewardToman > 0) await credit(ref.ownerId, rewardToman, `پاداشِ دعوت (${code.toUpperCase()})`).catch(() => {})
  return ref
}

export async function referralStats(ownerId: string): Promise<Referral & { conversionRate: number }> {
  const ref = await getOrCreateReferral(ownerId)
  return { ...ref, conversionRate: ref.invited ? Math.round((ref.converted / ref.invited) * 1000) / 10 : 0 }
}
