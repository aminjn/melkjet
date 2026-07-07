// REOS v2 · Promotion Engine — کمپینِ تبلیغاتی با بودجه/CPC/CPM + pacing + آنالیتیکس.
// به گیتِ کیفیتِ Monetization و boostِ فید وصل است (پول بدونِ کیفیت رتبه نمی‌خرد).
// Dual-mode PG/file. شارژِ اتمیک (FOR UPDATE) تا بودجه در همزمانی درست کم شود.
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, pgTx } from '../db'

export type PromoModel = 'cpc' | 'cpm' | 'flat'
export type PromoType = 'boost' | 'featured' | 'vip'
export type PromoStatus = 'scheduled' | 'active' | 'paused' | 'exhausted' | 'ended'
export interface Campaign {
  id: string; ownerId: string; targetType: 'property' | 'agent'; targetId: string
  type: PromoType; model: PromoModel; budget: number; spent: number; bid: number
  impressions: number; clicks: number; spentToday: number; dayKey: number
  startAt: number; endAt: number; status: PromoStatus; at: number
}
const RAW_BOOST: Record<PromoType, number> = { boost: 0.5, featured: 0.75, vip: 1 }
const dayKeyOf = (t: number) => Math.floor(t / 86_400_000)

const FILE = join(process.cwd(), '.reos-promo-campaigns.json')
function fileLoad(): Record<string, Campaign> { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return {} }
function fileSave(d: unknown) { try { writeFileSync(FILE, JSON.stringify(d)) } catch {} }
function uid() { return 'camp_' + randomBytes(6).toString('hex') }

let ready = false
async function ensure() {
  if (ready) return
  await pgTx(c => c.query(`CREATE TABLE IF NOT EXISTS reos_promo_campaigns (
    id text PRIMARY KEY, owner_id text NOT NULL, target_type text NOT NULL, target_id text NOT NULL,
    type text NOT NULL, model text NOT NULL, budget double precision NOT NULL, spent double precision NOT NULL DEFAULT 0,
    bid double precision NOT NULL DEFAULT 0, impressions bigint NOT NULL DEFAULT 0, clicks bigint NOT NULL DEFAULT 0,
    spent_today double precision NOT NULL DEFAULT 0, day_key bigint NOT NULL DEFAULT 0,
    start_at bigint NOT NULL, end_at bigint NOT NULL, status text NOT NULL, at bigint NOT NULL )`))
  await pgTx(c => c.query(`CREATE INDEX IF NOT EXISTS reos_promo_owner ON reos_promo_campaigns(owner_id)`))
  await pgTx(c => c.query(`CREATE INDEX IF NOT EXISTS reos_promo_target ON reos_promo_campaigns(target_id)`))
  ready = true
}

const rowToCamp = (r: Record<string, unknown>): Campaign => ({
  id: r.id as string, ownerId: r.owner_id as string, targetType: r.target_type as 'property' | 'agent', targetId: r.target_id as string,
  type: r.type as PromoType, model: r.model as PromoModel, budget: Number(r.budget), spent: Number(r.spent), bid: Number(r.bid),
  impressions: Number(r.impressions), clicks: Number(r.clicks), spentToday: Number(r.spent_today), dayKey: Number(r.day_key),
  startAt: Number(r.start_at), endAt: Number(r.end_at), status: r.status as PromoStatus, at: Number(r.at),
})

// وضعیتِ مؤثر بر اساسِ زمان/بودجه (مشتق‌شده؛ نه فقط فیلدِ ذخیره‌شده).
export function effectiveStatus(c: Campaign, now = Date.now()): PromoStatus {
  if (c.status === 'paused') return 'paused'
  if (c.spent >= c.budget) return 'exhausted'
  if (now < c.startAt) return 'scheduled'
  if (now > c.endAt) return 'ended'
  return 'active'
}
// pacing: سقفِ روزانه = بودجه / تعدادِ روزها. اگر امروز به سقف رسید، تا فردا سرو نکن.
export function dailyCap(c: Campaign): number { const days = Math.max(1, Math.ceil((c.endAt - c.startAt) / 86_400_000)); return c.budget / days }
export function pacedOut(c: Campaign, now = Date.now()): boolean { return dayKeyOf(now) === c.dayKey && c.spentToday >= dailyCap(c) }
export function isServable(c: Campaign, now = Date.now()): boolean { return effectiveStatus(c, now) === 'active' && !pacedOut(c, now) }

export async function createCampaign(input: {
  ownerId: string; targetType: 'property' | 'agent'; targetId: string; type: PromoType; model: PromoModel;
  budget: number; bid?: number; startAt?: number; endAt?: number
}): Promise<Campaign> {
  const now = Date.now()
  const c: Campaign = {
    id: uid(), ownerId: input.ownerId, targetType: input.targetType, targetId: input.targetId,
    type: input.type, model: input.model, budget: Math.max(0, input.budget), spent: 0, bid: Math.max(0, input.bid || 0),
    impressions: 0, clicks: 0, spentToday: 0, dayKey: dayKeyOf(now),
    startAt: input.startAt || now, endAt: input.endAt || now + 30 * 86_400_000, status: 'active', at: now,
  }
  c.status = effectiveStatus(c, now)
  if (pgEnabled()) {
    await ensure()
    await pgTx(cx => cx.query(`INSERT INTO reos_promo_campaigns(id,owner_id,target_type,target_id,type,model,budget,spent,bid,impressions,clicks,spent_today,day_key,start_at,end_at,status,at)
      VALUES($1,$2,$3,$4,$5,$6,$7,0,$8,0,0,0,$9,$10,$11,$12,$13)`,
      [c.id, c.ownerId, c.targetType, c.targetId, c.type, c.model, c.budget, c.bid, c.dayKey, c.startAt, c.endAt, c.status, c.at]))
  } else { const db = fileLoad(); db[c.id] = c; fileSave(db) }
  return c
}

// شارژِ اتمیک + به‌روزرسانیِ شمارنده. kind: impression یا click.
async function charge(id: string, kind: 'impression' | 'click', now: number): Promise<Campaign | null> {
  const apply = (c: Campaign): Campaign => {
    const dk = dayKeyOf(now)
    if (c.dayKey !== dk) { c.dayKey = dk; c.spentToday = 0 }   // ریستِ روزانهٔ pacing
    let cost = 0
    if (kind === 'impression') { c.impressions += 1; if (c.model === 'cpm') cost = c.bid / 1000 }
    else { c.clicks += 1; if (c.model === 'cpc') cost = c.bid }
    if (cost > 0) { c.spent = Math.min(c.budget, c.spent + cost); c.spentToday += cost }
    c.status = effectiveStatus(c, now)
    return c
  }
  if (pgEnabled()) {
    await ensure()
    return pgTx(async cx => {
      const r = await cx.query(`SELECT * FROM reos_promo_campaigns WHERE id=$1 FOR UPDATE`, [id])
      if (!r.rows[0]) return null
      const c = apply(rowToCamp(r.rows[0]))
      await cx.query(`UPDATE reos_promo_campaigns SET spent=$2, impressions=$3, clicks=$4, spent_today=$5, day_key=$6, status=$7 WHERE id=$1`,
        [c.id, c.spent, c.impressions, c.clicks, c.spentToday, c.dayKey, c.status])
      return c
    })
  }
  const db = fileLoad(); if (!db[id]) return null; const c = apply(db[id]); db[id] = c; fileSave(db); return c
}
export const recordImpression = (id: string, now = Date.now()) => charge(id, 'impression', now)
export const recordClick = (id: string, now = Date.now()) => charge(id, 'click', now)

export async function getCampaign(id: string): Promise<Campaign | null> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT * FROM reos_promo_campaigns WHERE id=$1`, [id])); return r.rows[0] ? rowToCamp(r.rows[0]) : null }
  return fileLoad()[id] || null
}
export async function listCampaigns(ownerId?: string): Promise<Campaign[]> {
  if (pgEnabled()) { await ensure(); const r = ownerId ? await pgTx(c => c.query(`SELECT * FROM reos_promo_campaigns WHERE owner_id=$1 ORDER BY at DESC`, [ownerId])) : await pgTx(c => c.query(`SELECT * FROM reos_promo_campaigns ORDER BY at DESC LIMIT 500`)); return r.rows.map(rowToCamp) }
  return Object.values(fileLoad()).filter(c => !ownerId || c.ownerId === ownerId).sort((a, b) => b.at - a.at)
}
export async function setStatus(id: string, status: 'paused' | 'active'): Promise<void> {
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`UPDATE reos_promo_campaigns SET status=$2 WHERE id=$1`, [id, status])) }
  else { const db = fileLoad(); if (db[id]) { db[id].status = status; fileSave(db) } }
}

// boostِ فعالِ املاک (propertyId → rawBoost) برای تزریق به رتبه‌بندیِ فید. فقط کمپینِ قابل‌سرو.
export async function activeBoosts(now = Date.now()): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const c of await listCampaigns()) {
    if (c.targetType !== 'property' || !isServable(c, now)) continue
    out[c.targetId] = Math.max(out[c.targetId] || 0, RAW_BOOST[c.type])
  }
  return out
}

export function analytics(c: Campaign, now = Date.now()) {
  return {
    id: c.id, status: effectiveStatus(c, now), impressions: c.impressions, clicks: c.clicks,
    ctr: c.impressions ? Math.round((c.clicks / c.impressions) * 10000) / 100 : 0,
    spent: Math.round(c.spent), remaining: Math.round(Math.max(0, c.budget - c.spent)),
    cpcActual: c.clicks ? Math.round(c.spent / c.clicks) : 0,
    pacedOut: pacedOut(c, now), dailyCap: Math.round(dailyCap(c)),
  }
}
