// REOS v7 · Community Layer — دنبال‌کردن، مجموعه‌ها، نظرها، اثباتِ اجتماعی، رتبه‌بندیِ عمومی.
// اعتبارِ عمومیِ حرفه‌ای: کاربر آژانس/مشاور را دنبال می‌کند، ملک‌ها را در مجموعه ذخیره می‌کند، نظر می‌گذارد.
// «اثباتِ اجتماعی» = ترکیبِ دنبال‌کننده + اقتدارِ بازار + اعتماد + سطح. هستهٔ خالص تست‌پذیر؛ ذخیره dual-mode.
import { pgEnabled, pgTx } from '../db'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { config } from './reos-config'

export type TargetType = 'agent' | 'property'
function clamp01(x: number) { return Math.max(0, Math.min(1, x)) }
function uid(p: string) { return p + randomBytes(6).toString('hex') }

// ── هستهٔ خالص ──
// امتیازِ اعتبارِ اجتماعی (۰..۱۰۰): دنبال‌کننده (لگاریتمی) + اقتدار + اعتماد + سطح. وزن‌ها config-driven.
export interface CommunitySignals { followers?: number; dominance?: number; trust?: number; level?: number }
export function communityScore(s: CommunitySignals): { score: number; parts: Record<string, number> } {
  const w = config().community.weights
  const followers = clamp01(Math.log1p(Math.max(0, s.followers || 0)) / Math.log1p(1000))
  const dominance = clamp01((s.dominance || 0) / 100)
  const trust = clamp01((s.trust || 0) / 100)
  const level = clamp01((s.level || 0) / 30)   // سطحِ ۳۰ = اشباع
  const score = Math.round(clamp01(w.followers * followers + w.dominance * dominance + w.trust * trust + w.level * level) * 100)
  return { score, parts: { followers: Math.round(followers * 100), dominance: Math.round(dominance * 100), trust: Math.round(trust * 100), level: Math.round(level * 100) } }
}

// نظرِ ورودی را پاک‌سازی/اعتبارسنجی می‌کند (طولِ مجاز از config).
export function sanitizeComment(text: string): { ok: boolean; text: string; reason?: string } {
  const t = (text || '').replace(/\s+/g, ' ').trim()
  if (!t) return { ok: false, text: '', reason: 'خالی' }
  const max = config().community.commentMaxLen
  if (t.length > max) return { ok: false, text: t.slice(0, max), reason: 'بلندتر از حدِ مجاز' }
  return { ok: true, text: t }
}

export interface Comment { id: string; authorId: string; authorName: string; targetId: string; targetType: TargetType; parentId?: string; text: string; hidden: boolean; at: number }
export interface CommentNode extends Comment { replies: CommentNode[] }
// درختِ نظرها را از فهرستِ مسطح می‌سازد (تست‌پذیر). نظرهایِ مخفی حذف می‌شوند.
export function threadComments(flat: Comment[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>()
  const visible = flat.filter(c => !c.hidden)
  for (const c of visible) nodes.set(c.id, { ...c, replies: [] })
  const roots: CommentNode[] = []
  for (const n of nodes.values()) {
    if (n.parentId && nodes.has(n.parentId)) nodes.get(n.parentId)!.replies.push(n)
    else roots.push(n)
  }
  const byAt = (a: CommentNode, b: CommentNode) => a.at - b.at
  roots.sort(byAt); for (const n of nodes.values()) n.replies.sort(byAt)
  return roots
}

// ══════════ ذخیره (dual-mode) ══════════
const FILE = join(process.cwd(), '.reos-community.json')
export interface Collection { id: string; ownerId: string; name: string; public: boolean; at: number }
interface Follow { followerId: string; targetId: string; targetType: TargetType; at: number }
interface CItem { collectionId: string; itemId: string; itemType: TargetType; at: number }
interface CDb { follows: Follow[]; collections: Collection[]; items: CItem[]; comments: Comment[] }
function fileLoad(): CDb { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return { follows: [], collections: [], items: [], comments: [] } }
function fileSave(d: CDb) { try { writeFileSync(FILE, JSON.stringify(d)) } catch {} }
let ready = false
async function ensure() {
  if (ready) return
  await pgTx(async c => {
    await c.query(`CREATE TABLE IF NOT EXISTS reos_follows (follower_id text NOT NULL, target_id text NOT NULL, target_type text NOT NULL, at bigint NOT NULL, PRIMARY KEY (follower_id, target_id, target_type))`)
    await c.query(`CREATE INDEX IF NOT EXISTS reos_follows_target ON reos_follows(target_id, target_type)`)
    await c.query(`CREATE TABLE IF NOT EXISTS reos_collections (id text PRIMARY KEY, owner_id text NOT NULL, name text NOT NULL, public boolean NOT NULL DEFAULT true, at bigint NOT NULL)`)
    await c.query(`CREATE INDEX IF NOT EXISTS reos_collections_owner ON reos_collections(owner_id)`)
    await c.query(`CREATE TABLE IF NOT EXISTS reos_collection_items (collection_id text NOT NULL, item_id text NOT NULL, item_type text NOT NULL, at bigint NOT NULL, PRIMARY KEY (collection_id, item_id))`)
    await c.query(`CREATE TABLE IF NOT EXISTS reos_comments (id text PRIMARY KEY, author_id text NOT NULL, author_name text NOT NULL DEFAULT '', target_id text NOT NULL, target_type text NOT NULL, parent_id text, text text NOT NULL, hidden boolean NOT NULL DEFAULT false, at bigint NOT NULL)`)
    await c.query(`CREATE INDEX IF NOT EXISTS reos_comments_target ON reos_comments(target_id, target_type)`)
  })
  ready = true
}

// ── دنبال‌کردن ──
export async function follow(followerId: string, targetId: string, targetType: TargetType = 'agent'): Promise<{ ok: boolean }> {
  if (!followerId || !targetId || followerId === targetId) return { ok: false }
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`INSERT INTO reos_follows(follower_id,target_id,target_type,at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [followerId, targetId, targetType, Date.now()])) }
  else { const db = fileLoad(); if (!db.follows.some(f => f.followerId === followerId && f.targetId === targetId && f.targetType === targetType)) { db.follows.push({ followerId, targetId, targetType, at: Date.now() }); fileSave(db) } }
  return { ok: true }
}
export async function unfollow(followerId: string, targetId: string, targetType: TargetType = 'agent'): Promise<{ ok: boolean }> {
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`DELETE FROM reos_follows WHERE follower_id=$1 AND target_id=$2 AND target_type=$3`, [followerId, targetId, targetType])) }
  else { const db = fileLoad(); db.follows = db.follows.filter(f => !(f.followerId === followerId && f.targetId === targetId && f.targetType === targetType)); fileSave(db) }
  return { ok: true }
}
export async function isFollowing(followerId: string, targetId: string, targetType: TargetType = 'agent'): Promise<boolean> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT 1 FROM reos_follows WHERE follower_id=$1 AND target_id=$2 AND target_type=$3`, [followerId, targetId, targetType])); return r.rows.length > 0 }
  return fileLoad().follows.some(f => f.followerId === followerId && f.targetId === targetId && f.targetType === targetType)
}
export async function followerCount(targetId: string, targetType: TargetType = 'agent'): Promise<number> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT count(*)::int AS n FROM reos_follows WHERE target_id=$1 AND target_type=$2`, [targetId, targetType])); return r.rows[0]?.n || 0 }
  return fileLoad().follows.filter(f => f.targetId === targetId && f.targetType === targetType).length
}
export async function followingCount(followerId: string): Promise<number> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT count(*)::int AS n FROM reos_follows WHERE follower_id=$1`, [followerId])); return r.rows[0]?.n || 0 }
  return fileLoad().follows.filter(f => f.followerId === followerId).length
}
export async function followingList(followerId: string, targetType: TargetType = 'agent'): Promise<string[]> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT target_id FROM reos_follows WHERE follower_id=$1 AND target_type=$2 ORDER BY at DESC`, [followerId, targetType])); return r.rows.map(x => x.target_id) }
  return fileLoad().follows.filter(f => f.followerId === followerId && f.targetType === targetType).sort((a, b) => b.at - a.at).map(f => f.targetId)
}

// ── مجموعه‌ها (Collections) ──
export async function createCollection(ownerId: string, name: string, isPublic = true): Promise<Collection> {
  const col: Collection = { id: uid('col_'), ownerId, name: (name || 'مجموعه').trim().slice(0, 80), public: isPublic, at: Date.now() }
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`INSERT INTO reos_collections(id,owner_id,name,public,at) VALUES($1,$2,$3,$4,$5)`, [col.id, ownerId, col.name, col.public, col.at])) }
  else { const db = fileLoad(); db.collections.push(col); fileSave(db) }
  return col
}
export async function addToCollection(collectionId: string, itemId: string, itemType: TargetType = 'property'): Promise<{ ok: boolean }> {
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`INSERT INTO reos_collection_items(collection_id,item_id,item_type,at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [collectionId, itemId, itemType, Date.now()])) }
  else { const db = fileLoad(); if (!db.items.some(i => i.collectionId === collectionId && i.itemId === itemId)) { db.items.push({ collectionId, itemId, itemType, at: Date.now() }); fileSave(db) } }
  return { ok: true }
}
export async function removeFromCollection(collectionId: string, itemId: string): Promise<{ ok: boolean }> {
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`DELETE FROM reos_collection_items WHERE collection_id=$1 AND item_id=$2`, [collectionId, itemId])) }
  else { const db = fileLoad(); db.items = db.items.filter(i => !(i.collectionId === collectionId && i.itemId === itemId)); fileSave(db) }
  return { ok: true }
}
export async function listCollections(ownerId: string): Promise<Array<Collection & { count: number }>> {
  let cols: Collection[]; let items: CItem[]
  if (pgEnabled()) { await ensure(); const [a, b] = await Promise.all([pgTx(c => c.query(`SELECT * FROM reos_collections WHERE owner_id=$1 ORDER BY at DESC`, [ownerId])), pgTx(c => c.query(`SELECT collection_id FROM reos_collection_items i JOIN reos_collections c ON c.id=i.collection_id WHERE c.owner_id=$1`, [ownerId]))]); cols = a.rows.map(x => ({ id: x.id, ownerId: x.owner_id, name: x.name, public: x.public, at: Number(x.at) })); items = b.rows.map(x => ({ collectionId: x.collection_id, itemId: '', itemType: 'property' as TargetType, at: 0 })) }
  else { const db = fileLoad(); cols = db.collections.filter(c => c.ownerId === ownerId).sort((a, b) => b.at - a.at); items = db.items }
  return cols.map(c => ({ ...c, count: items.filter(i => i.collectionId === c.id).length }))
}
export async function collectionItems(collectionId: string): Promise<Array<{ itemId: string; itemType: TargetType; at: number }>> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT item_id,item_type,at FROM reos_collection_items WHERE collection_id=$1 ORDER BY at DESC`, [collectionId])); return r.rows.map(x => ({ itemId: x.item_id, itemType: x.item_type, at: Number(x.at) })) }
  return fileLoad().items.filter(i => i.collectionId === collectionId).sort((a, b) => b.at - a.at).map(i => ({ itemId: i.itemId, itemType: i.itemType, at: i.at }))
}

// ── نظرها (Comments) ──
export async function addComment(input: { authorId: string; authorName?: string; targetId: string; targetType?: TargetType; text: string; parentId?: string }): Promise<{ ok: boolean; comment?: Comment; reason?: string }> {
  const clean = sanitizeComment(input.text)
  if (!clean.ok) return { ok: false, reason: clean.reason }
  const cm: Comment = { id: uid('cm_'), authorId: input.authorId, authorName: input.authorName || '', targetId: input.targetId, targetType: input.targetType || 'agent', parentId: input.parentId, text: clean.text, hidden: false, at: Date.now() }
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`INSERT INTO reos_comments(id,author_id,author_name,target_id,target_type,parent_id,text,hidden,at) VALUES($1,$2,$3,$4,$5,$6,$7,false,$8)`, [cm.id, cm.authorId, cm.authorName, cm.targetId, cm.targetType, cm.parentId || null, cm.text, cm.at])) }
  else { const db = fileLoad(); db.comments.push(cm); fileSave(db) }
  return { ok: true, comment: cm }
}
async function rawComments(targetId: string, targetType: TargetType): Promise<Comment[]> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT * FROM reos_comments WHERE target_id=$1 AND target_type=$2 ORDER BY at ASC LIMIT 500`, [targetId, targetType])); return r.rows.map(x => ({ id: x.id, authorId: x.author_id, authorName: x.author_name, targetId: x.target_id, targetType: x.target_type, parentId: x.parent_id || undefined, text: x.text, hidden: x.hidden, at: Number(x.at) })) }
  return fileLoad().comments.filter(c => c.targetId === targetId && c.targetType === targetType)
}
export async function listComments(targetId: string, targetType: TargetType = 'agent'): Promise<CommentNode[]> { return threadComments(await rawComments(targetId, targetType)) }
export async function commentCount(targetId: string, targetType: TargetType = 'agent'): Promise<number> { return (await rawComments(targetId, targetType)).filter(c => !c.hidden).length }
// حذف/مخفی‌سازیِ نظر (نویسنده یا سوپرادمین).
export async function hideComment(id: string, byId: string, isAdmin = false): Promise<{ ok: boolean; reason?: string }> {
  let c: Comment | undefined
  if (pgEnabled()) { await ensure(); const r = await pgTx(cl => cl.query(`SELECT * FROM reos_comments WHERE id=$1`, [id])); const x = r.rows[0]; if (x) c = { id: x.id, authorId: x.author_id, authorName: x.author_name, targetId: x.target_id, targetType: x.target_type, parentId: x.parent_id || undefined, text: x.text, hidden: x.hidden, at: Number(x.at) } }
  else c = fileLoad().comments.find(x => x.id === id)
  if (!c) return { ok: false, reason: 'یافت نشد' }
  if (!isAdmin && c.authorId !== byId) return { ok: false, reason: 'دسترسی محدود' }
  if (pgEnabled()) { await pgTx(cl => cl.query(`UPDATE reos_comments SET hidden=true WHERE id=$1`, [id])) }
  else { const db = fileLoad(); const t = db.comments.find(x => x.id === id); if (t) { t.hidden = true; fileSave(db) } }
  return { ok: true }
}

// ── اثباتِ اجتماعی + رتبه‌بندیِ عمومی ──
// ترکیبِ همهٔ سیگنال‌های عمومی (دنبال‌کننده + اقتدارِ بازار + اعتماد + سطح) → کارتِ اعتبارِ عمومی.
export async function socialProof(agentId: string): Promise<{ followers: number; following: number; comments: number; collections: number; score: number; parts: Record<string, number> }> {
  const [followers, following, comments, dominanceTop, trust, level] = await Promise.all([
    followerCount(agentId, 'agent'),
    followingCount(agentId),
    commentCount(agentId, 'agent'),
    import('./territory').then(m => m.agentTerritories(agentId)).then(t => t[0]?.score || 0).catch(() => 0),
    import('./trust').then(m => m.getTrust(agentId)).then(t => t.score).catch(() => 50),
    import('./xp').then(m => m.lifetimeXp(agentId)).then(xp => m2level(xp)).catch(() => 1),
  ])
  const cols = (await listCollections(agentId)).length
  const cs = communityScore({ followers, dominance: dominanceTop, trust, level })
  return { followers, following, comments, collections: cols, score: cs.score, parts: cs.parts }
}
function m2level(xp: number): number { const base = config().xp.levelBase || 100, exp = config().xp.levelExp || 1.6; let L = 1; while (xp >= Math.round(base * Math.pow(L + 1, exp)) && L < 999) L++; return L }

// رتبه‌بندیِ عمومیِ آژانس‌ها (Social Proof + اقتدار). دانه = مالکانِ قلمرو (فعال‌ترین‌ها).
export async function publicRankings(limit = 20): Promise<Array<{ agentId: string; name: string; score: number; followers: number; dominance: number }>> {
  const map = await import('./territory').then(m => m.dominanceMap(200)).catch(() => [] as Array<{ ownerId: string; ownerName: string; ownerScore: number }>)
  const seen = new Set<string>()
  const rows: Array<{ agentId: string; name: string; score: number; followers: number; dominance: number }> = []
  for (const o of map) {
    if (seen.has(o.ownerId)) continue
    seen.add(o.ownerId)
    const sp = await socialProof(o.ownerId).catch(() => ({ followers: 0, score: 0 } as { followers: number; score: number }))
    rows.push({ agentId: o.ownerId, name: o.ownerName, score: sp.score, followers: sp.followers, dominance: o.ownerScore })
  }
  return rows.sort((a, b) => b.score - a.score).slice(0, limit)
}
