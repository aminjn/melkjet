// 🏰 لایهٔ اجتماعیِ امپراتوری (فاز ۳۷ — درخواستِ مستقیم):
//   ۱) دفترِ مالکیتِ انحصاری: هر آگهیِ واقعی فقط یک مالکِ بازیکن دارد — کمیابیِ واقعی.
//   ۲) اتحاد (کلن): ساخت/پیوستن/گفت‌وگو — هزینهٔ ثبت → خزانه؛ ظرفیت و سطحِ ورود knob ادمین.
// ذخیره dual-mode: kv اتمیک (FOR UPDATE) روی PG، وگرنه فایلِ dev. هیچ دادهٔ ساختگی — همه از بازیکنانِ واقعی.
import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'

// ── ذخیرهٔ dual-mode مشترک ──
const files: Record<string, string> = {
  empire_owners: path.join(process.cwd(), '.empire-owners-data.json'),
  empire_clans: path.join(process.cwd(), '.empire-clans-data.json'),
}
async function load<T>(key: string, fallback: T): Promise<T> {
  if (pgEnabled()) return kvGet<T>(key, fallback).catch(() => fallback)
  try { return JSON.parse(fs.readFileSync(files[key], 'utf-8')) } catch { return fallback }
}
async function mutate<T, R>(key: string, fallback: T, fn: (d: T) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<T, R>(key, fallback, fn)
  let d = fallback
  try { d = JSON.parse(fs.readFileSync(files[key], 'utf-8')) } catch {}
  const r = fn(d)
  try { fs.writeFileSync(files[key], JSON.stringify(d)) } catch {}
  return r
}

// ══════════ دفترِ مالکیتِ انحصاری ══════════
export interface ListingOwner { userId: string; no: number; name: string; at: number }
type OwnersDb = Record<string, ListingOwner>

export async function ownerOfListing(listingId: string): Promise<ListingOwner | null> {
  if (!listingId) return null
  return (await load<OwnersDb>('empire_owners', {}))[listingId] || null
}

// ادعای اتمیک: اگر بازیکنِ دیگری زودتر ثبت کرده باشد، شکست با نامِ او (پیامِ صادقانه در UI).
export async function claimListing(listingId: string, owner: { userId: string; no: number; name: string }): Promise<{ ok: boolean; by?: ListingOwner }> {
  return mutate<OwnersDb, { ok: boolean; by?: ListingOwner }>('empire_owners', {}, db => {
    const cur = db[listingId]
    if (cur && cur.userId !== owner.userId) return { ok: false, by: cur }
    db[listingId] = { ...owner, at: cur?.at || Date.now() }
    return { ok: true }
  })
}

export async function releaseListing(listingId: string, userId: string): Promise<void> {
  await mutate<OwnersDb, void>('empire_owners', {}, db => {
    if (db[listingId]?.userId === userId) delete db[listingId]
  })
}

export async function transferListing(listingId: string, fromUserId: string, to: { userId: string; no: number; name: string }): Promise<void> {
  await mutate<OwnersDb, void>('empire_owners', {}, db => {
    if (!db[listingId] || db[listingId].userId === fromUserId) db[listingId] = { ...to, at: Date.now() }
  })
}

// بازسازیِ دفتر از دارایی‌های واقعیِ موجود (کرانِ روزانه — ایدمپوتنت): فقط جاهای خالی پر می‌شود؛
// مالکیت‌های هم‌پوشانِ پیش از این قانون دست نمی‌خورند (قانون عطف به ماسبق نمی‌شود).
export async function rebuildOwnersRegistry(empires: Array<{ userId: string; no: number; name: string; assets: Array<{ listingId: string; demolishedAt?: number }> }>): Promise<number> {
  return mutate<OwnersDb, number>('empire_owners', {}, db => {
    let added = 0
    for (const e of empires) for (const a of e.assets) {
      if (!a.listingId || db[a.listingId]) continue
      db[a.listingId] = { userId: e.userId, no: e.no, name: e.name, at: Date.now() }
      added++
    }
    return added
  })
}

// ══════════ اتحاد (کلن) ══════════
export interface ClanMember { userId: string; no: number; name: string; at: number }
export interface Clan {
  id: string; name: string
  ownerId: string
  members: ClanMember[]
  msgs: Array<{ by: string; name: string; text: string; at: number }>
  createdAt: number
}
type ClansDb = { clans: Record<string, Clan> }
const CLANS_FALLBACK: ClansDb = { clans: {} }
const MSG_CAP = 60

export function validClanName(name: string): string | null {
  const n = String(name || '').trim()
  if (n.length < 2 || n.length > 30) return 'نامِ اتحاد باید ۲ تا ۳۰ حرف باشد'
  if (/بازی/.test(n)) return 'این نام مجاز نیست'
  return null
}

export async function myClanOf(userId: string): Promise<Clan | null> {
  const db = await load<ClansDb>('empire_clans', CLANS_FALLBACK)
  return Object.values(db.clans).find(c => c.members.some(m => m.userId === userId)) || null
}

export async function listClans(limit = 100): Promise<Array<{ id: string; name: string; members: number; createdAt: number }>> {
  const db = await load<ClansDb>('empire_clans', CLANS_FALLBACK)
  return Object.values(db.clans)
    .map(c => ({ id: c.id, name: c.name, members: c.members.length, createdAt: c.createdAt }))
    .sort((a, b) => b.members - a.members || a.createdAt - b.createdAt)
    .slice(0, limit)
}

export async function createClan(user: { userId: string; no: number; name: string }, name: string): Promise<{ ok: boolean; reason?: string; clan?: Clan }> {
  const bad = validClanName(name)
  if (bad) return { ok: false, reason: bad }
  const n = String(name).trim()
  return mutate<ClansDb, { ok: boolean; reason?: string; clan?: Clan }>('empire_clans', CLANS_FALLBACK, db => {
    if (Object.values(db.clans).some(c => c.members.some(m => m.userId === user.userId))) return { ok: false, reason: 'از قبل عضوِ یک اتحادی — اول از آن خارج شو' }
    if (Object.values(db.clans).some(c => c.name.trim() === n)) return { ok: false, reason: 'اتحادی با این نام هست — نامِ دیگری انتخاب کن' }
    const clan: Clan = { id: 'cln_' + randomBytes(4).toString('hex'), name: n, ownerId: user.userId, members: [{ ...user, at: Date.now() }], msgs: [], createdAt: Date.now() }
    db.clans[clan.id] = clan
    return { ok: true, clan }
  })
}

export async function deleteClanIfOwner(clanId: string, userId: string): Promise<void> {
  await mutate<ClansDb, void>('empire_clans', CLANS_FALLBACK, db => {
    if (db.clans[clanId]?.ownerId === userId) delete db.clans[clanId]
  })
}

export async function joinClan(user: { userId: string; no: number; name: string }, clanId: string, maxMembers: number): Promise<{ ok: boolean; reason?: string; clan?: Clan }> {
  return mutate<ClansDb, { ok: boolean; reason?: string; clan?: Clan }>('empire_clans', CLANS_FALLBACK, db => {
    if (Object.values(db.clans).some(c => c.members.some(m => m.userId === user.userId))) return { ok: false, reason: 'از قبل عضوِ یک اتحادی' }
    const c = db.clans[clanId]
    if (!c) return { ok: false, reason: 'این اتحاد یافت نشد' }
    if (c.members.length >= Math.max(2, maxMembers)) return { ok: false, reason: 'ظرفیتِ این اتحاد پر است' }
    c.members.push({ ...user, at: Date.now() })
    c.msgs.push({ by: 'system', name: 'ملک‌جت', text: `«${user.name}» به اتحاد پیوست 🎉`, at: Date.now() })
    if (c.msgs.length > MSG_CAP) c.msgs = c.msgs.slice(-MSG_CAP)
    return { ok: true, clan: c }
  })
}

// خروج: اگر رهبر برود و عضوی مانده باشد، رهبری به قدیمی‌ترین عضو می‌رسد؛ اتحادِ خالی حذف می‌شود.
export async function leaveClan(userId: string): Promise<{ ok: boolean; reason?: string }> {
  return mutate<ClansDb, { ok: boolean; reason?: string }>('empire_clans', CLANS_FALLBACK, db => {
    const c = Object.values(db.clans).find(x => x.members.some(m => m.userId === userId))
    if (!c) return { ok: false, reason: 'عضوِ هیچ اتحادی نیستی' }
    c.members = c.members.filter(m => m.userId !== userId)
    if (!c.members.length) { delete db.clans[c.id]; return { ok: true } }
    if (c.ownerId === userId) {
      const next = [...c.members].sort((a, b) => a.at - b.at)[0]
      c.ownerId = next.userId
      c.msgs.push({ by: 'system', name: 'ملک‌جت', text: `رهبریِ اتحاد به «${next.name}» رسید`, at: Date.now() })
    }
    return { ok: true }
  })
}

export async function postClanMsg(userId: string, text: string): Promise<{ ok: boolean; reason?: string; clan?: Clan }> {
  const t = String(text || '').trim().slice(0, 240)
  if (!t) return { ok: false, reason: 'پیام خالی است' }
  return mutate<ClansDb, { ok: boolean; reason?: string; clan?: Clan }>('empire_clans', CLANS_FALLBACK, db => {
    const c = Object.values(db.clans).find(x => x.members.some(m => m.userId === userId))
    if (!c) return { ok: false, reason: 'عضوِ هیچ اتحادی نیستی' }
    const me = c.members.find(m => m.userId === userId)!
    c.msgs.push({ by: userId, name: me.name, text: t, at: Date.now() })
    if (c.msgs.length > MSG_CAP) c.msgs = c.msgs.slice(-MSG_CAP)
    return { ok: true, clan: c }
  })
}

// نمای امنِ اتحاد برای کلاینت: شمارهٔ تلفن (userId) هرگز به بازیکنانِ دیگر نمی‌رسد.
export function clanView(c: Clan, meId: string) {
  return {
    id: c.id, name: c.name, createdAt: c.createdAt,
    mine: c.members.some(m => m.userId === meId),
    ownerNo: c.members.find(m => m.userId === c.ownerId)?.no || 0,
    members: c.members.map(m => ({ no: m.no, name: m.name, at: m.at, leader: m.userId === c.ownerId, me: m.userId === meId })),
    msgs: c.msgs.map(m => ({ name: m.name, text: m.text, at: m.at, me: m.by === meId })),
  }
}
