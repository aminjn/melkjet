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
  empire_dm: path.join(process.cwd(), '.empire-dm-data.json'),       // فاز ۱۰۲: گفتگوی دوستان
  empire_duel: path.join(process.cwd(), '.empire-duel-data.json'),   // فاز ۱۰۲: دوئلِ هفتگی
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

// فاز ۱۸۰ — کلِ دفترِ مالکیت در یک خواندن (برای علامت‌گذاریِ فهرست‌ها؛ per-item صدازدن گران است)
export async function allListingOwners(): Promise<Record<string, ListingOwner>> {
  return load<OwnersDb>('empire_owners', {})
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
  // فاز ۱۰۲ (هلدینگ): خزانهٔ مشترک با دفترِ شفاف + کنسرسیوم‌های ملکِ واقعی
  treasury?: number
  ledger?: Array<{ no: number; name: string; amount: number; at: number }>
  projects?: ClanProject[]
}
// کنسرسیوم: خریدِ جمعیِ یک آگهیِ «واقعی» — سهم‌ها شفاف، فروش به قیمتِ روزِ واقعی، تقسیمِ نسبتی.
export interface ClanProject {
  id: string; listingId: string; title: string; hood: string; price: number
  shares: Record<string, { no: number; name: string; amount: number }>   // به‌کلیدِ userId
  funded: number
  status: 'open' | 'owned' | 'sold'
  startedBy: string
  createdAt: number
  soldPrice?: number
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
    // فاز ۱۰۲ (هلدینگ): خزانه + دفترِ شفاف + کنسرسیوم‌ها
    imOwner: c.ownerId === meId,
    treasury: c.treasury || 0,
    ledger: (c.ledger || []).slice(-10).reverse(),
    projects: (c.projects || []).filter(pr => pr.status !== 'sold' || Date.now() - pr.createdAt < 14 * 86400000).map(pr => ({
      id: pr.id, listingId: pr.listingId, title: pr.title, hood: pr.hood, price: pr.price, funded: pr.funded, status: pr.status,
      myShare: pr.shares[meId]?.amount || 0, soldPrice: pr.soldPrice || 0,
      holders: Object.values(pr.shares).map(sh => ({ no: sh.no, name: sh.name, amount: sh.amount })).sort((a, b) => b.amount - a.amount).slice(0, 6),
    })),
  }
}

// ══════════ فاز ۱۰۲ — لایهٔ اجتماعی: گفتگوی دوستان + دوئل + خزانه/کنسرسیومِ هلدینگ ══════════

// ── گفتگوی دوستان (فقط بینِ فالوی دوطرفه — گیتِ دوستی در API چک می‌شود) ──
export interface DmMsg { no: number; name: string; text: string; at: number }
type DmDb = { threads: Record<string, { msgs: DmMsg[] }> }
const DM_FALLBACK: DmDb = { threads: {} }
export const dmKeyOf = (a: string, b: string) => [a, b].sort().join('|')

export async function sendDm(from: { userId: string; no: number; name: string }, toUserId: string, text: string, limits: { maxLen: number; cooldownSec: number }): Promise<{ ok: boolean; reason?: string }> {
  const t = String(text || '').trim().slice(0, Math.max(20, limits.maxLen))
  if (!t) return { ok: false, reason: 'پیام خالی است' }
  if (/بازی/.test(t)) return { ok: false, reason: 'این واژه در گفتگو مجاز نیست' }
  return mutate<DmDb, { ok: boolean; reason?: string }>('empire_dm', DM_FALLBACK, db => {
    const key = dmKeyOf(from.userId, toUserId)
    const th = db.threads[key] || (db.threads[key] = { msgs: [] })
    const last = th.msgs[th.msgs.length - 1]
    if (last && last.no === from.no && Date.now() - last.at < limits.cooldownSec * 1000) return { ok: false, reason: 'کمی صبر کن بعد پیامِ بعدی' }
    th.msgs.push({ no: from.no, name: from.name, text: t, at: Date.now() })
    th.msgs = th.msgs.slice(-60)
    const keys = Object.keys(db.threads)
    if (keys.length > 500) delete db.threads[keys[0]]
    return { ok: true }
  })
}
export async function dmThread(a: string, b: string): Promise<DmMsg[]> {
  const db = await load<DmDb>('empire_dm', DM_FALLBACK)
  return db.threads[dmKeyOf(a, b)]?.msgs || []
}

// ── دوئلِ هفتگی: «تصمیمِ بهتر، نه پولِ بیشتر» — متریک = رشدِ ارزشِ خالص از لحظهٔ پذیرش تا پایانِ هفته ──
export interface Duel {
  id: string; week: number
  a: { userId: string; no: number; name: string }
  b?: { userId: string; no: number; name: string }
  npcId?: string; npcName?: string
  status: 'pending' | 'active' | 'done'
  aStartNw: number; bStartNw?: number
  npcStartRealized?: number; npcStartCapital?: number
  aGrowth?: number; bGrowth?: number
  winner?: 'a' | 'b' | 'tie'
  rewarded?: boolean
}
type DuelDb = { duels: Duel[] }
const DUEL_FALLBACK: DuelDb = { duels: [] }
const gPct = (now: number, start: number) => start > 0 ? Math.round(((now - start) / start) * 1000) / 10 : 0

export async function createDuel(a: { userId: string; no: number; name: string }, target: { userId: string; no: number; name: string } | { npcId: string; npcName: string; realized: number; capital: number }, week: number, aStartNw: number): Promise<{ ok: boolean; reason?: string; duel?: Duel }> {
  return mutate<DuelDb, { ok: boolean; reason?: string; duel?: Duel }>('empire_duel', DUEL_FALLBACK, db => {
    if (db.duels.some(d => d.week === week && d.status !== 'done' && (d.a.userId === a.userId || d.b?.userId === a.userId))) return { ok: false, reason: 'این هفته یک دوئلِ باز داری' }
    const duel: Duel = 'npcId' in target
      ? { id: 'du_' + week + '_' + a.no, week, a, npcId: target.npcId, npcName: target.npcName, status: 'active', aStartNw, npcStartRealized: target.realized, npcStartCapital: target.capital }
      : { id: 'du_' + week + '_' + a.no, week, a, b: target, status: 'pending', aStartNw }
    db.duels.push(duel)
    db.duels = db.duels.slice(-300)
    return { ok: true, duel }
  })
}
export async function acceptDuel(id: string, b: { userId: string; no: number; name: string }, bStartNw: number): Promise<{ ok: boolean; reason?: string }> {
  return mutate<DuelDb, { ok: boolean; reason?: string }>('empire_duel', DUEL_FALLBACK, db => {
    const d = db.duels.find(x => x.id === id)
    if (!d || d.status !== 'pending') return { ok: false, reason: 'این دعوت دیگر باز نیست' }
    if (d.b?.userId !== b.userId) return { ok: false, reason: 'این دعوت برای تو نیست' }
    d.status = 'active'; d.bStartNw = bStartNw
    return { ok: true }
  })
}
// داوری بعد از پایانِ هفتهٔ دوئل — رشدِ هر طرف از دادهٔ واقعیِ خودش؛ NPC از سودِ واقعاً محقق‌شده‌اش.
export async function resolveDuels(week: number, nwOf: (userId: string) => number, npcNow: (npcId: string) => { realized: number } | null): Promise<Duel[]> {
  return mutate<DuelDb, Duel[]>('empire_duel', DUEL_FALLBACK, db => {
    const out: Duel[] = []
    for (const d of db.duels) {
      if (d.status === 'pending' && d.week < week) { d.status = 'done'; d.winner = 'tie'; continue }   // دعوتِ بی‌پاسخ = منتفی
      if (d.status !== 'active' || d.week >= week) continue
      d.aGrowth = gPct(nwOf(d.a.userId), d.aStartNw)
      if (d.npcId) {
        const n = npcNow(d.npcId)
        d.bGrowth = n && (d.npcStartCapital || 0) > 0 ? Math.round(((n.realized - (d.npcStartRealized || 0)) / d.npcStartCapital!) * 1000) / 10 : 0
      } else if (d.b) {
        d.bGrowth = gPct(nwOf(d.b.userId), d.bStartNw || 0)
      }
      d.status = 'done'
      d.winner = (d.aGrowth || 0) > (d.bGrowth || 0) ? 'a' : (d.aGrowth || 0) < (d.bGrowth || 0) ? 'b' : 'tie'
      out.push(d)
    }
    return out
  })
}
export async function myDuels(userId: string, week: number): Promise<Duel[]> {
  const db = await load<DuelDb>('empire_duel', DUEL_FALLBACK)
  return db.duels.filter(d => (d.a.userId === userId || d.b?.userId === userId) && d.week >= week - 1).slice(-5)
}
export async function markDuelRewarded(id: string): Promise<boolean> {
  return mutate<DuelDb, boolean>('empire_duel', DUEL_FALLBACK, db => { const d = db.duels.find(x => x.id === id); if (!d || d.rewarded) return false; d.rewarded = true; return true })
}

// ── خزانهٔ هلدینگ: واریزِ اعضا با دفترِ شفاف؛ برداشت فقط مالک (در دفتر ثبت می‌شود) ──
export async function clanDeposit(userId: string, who: { no: number; name: string }, amount: number): Promise<{ ok: boolean; reason?: string; treasury?: number }> {
  const amt = Math.round(Math.max(0, amount))
  if (!amt) return { ok: false, reason: 'مبلغ نامعتبر' }
  return mutate<ClansDb, { ok: boolean; reason?: string; treasury?: number }>('empire_clans', CLANS_FALLBACK, db => {
    const c = Object.values(db.clans).find(x => x.members.some(m => m.userId === userId))
    if (!c) return { ok: false, reason: 'عضوِ هیچ اتحادی نیستی' }
    c.treasury = (c.treasury || 0) + amt
    c.ledger = [...(c.ledger || []), { no: who.no, name: who.name, amount: amt, at: Date.now() }].slice(-80)
    return { ok: true, treasury: c.treasury }
  })
}
export async function clanWithdraw(ownerId: string, who: { no: number; name: string }, amount: number): Promise<{ ok: boolean; reason?: string; treasury?: number }> {
  const amt = Math.round(Math.max(0, amount))
  return mutate<ClansDb, { ok: boolean; reason?: string; treasury?: number }>('empire_clans', CLANS_FALLBACK, db => {
    const c = Object.values(db.clans).find(x => x.ownerId === ownerId)
    if (!c) return { ok: false, reason: 'فقط بنیان‌گذارِ اتحاد می‌تواند برداشت کند' }
    if ((c.treasury || 0) < amt || !amt) return { ok: false, reason: 'موجودیِ خزانه کافی نیست' }
    c.treasury = (c.treasury || 0) - amt
    c.ledger = [...(c.ledger || []), { no: who.no, name: who.name, amount: -amt, at: Date.now() }].slice(-80)
    return { ok: true, treasury: c.treasury }
  })
}

// ── کنسرسیومِ ملکِ واقعی: سهم‌گذاری تا سقفِ قیمتِ آگهی؛ تکمیل = مالکیتِ مشترکِ اتحاد ──
export async function clanProjectStart(userId: string, listing: { id: string; title: string; hood: string; price: number }): Promise<{ ok: boolean; reason?: string; project?: ClanProject }> {
  if (!(listing.price > 0)) return { ok: false, reason: 'این آگهی قیمتِ معتبر ندارد' }
  return mutate<ClansDb, { ok: boolean; reason?: string; project?: ClanProject }>('empire_clans', CLANS_FALLBACK, db => {
    const c = Object.values(db.clans).find(x => x.members.some(m => m.userId === userId))
    if (!c) return { ok: false, reason: 'برای کنسرسیوم اول عضوِ یک اتحاد شو' }
    c.projects = c.projects || []
    if (c.projects.some(pr => pr.status === 'open' && pr.listingId === listing.id)) return { ok: false, reason: 'روی همین آگهی کنسرسیومِ باز هست' }
    if (c.projects.filter(pr => pr.status === 'open').length >= 3) return { ok: false, reason: 'حداکثر ۳ کنسرسیومِ باز' }
    const pr: ClanProject = { id: 'cp_' + Date.now().toString(36), listingId: listing.id, title: listing.title.slice(0, 80), hood: listing.hood.slice(0, 40), price: Math.round(listing.price), shares: {}, funded: 0, status: 'open', startedBy: userId, createdAt: Date.now() }
    c.projects.push(pr)
    return { ok: true, project: pr }
  })
}
// سهم‌گذاری — پولِ عضو قبلاً در API از سرمایه‌اش کم شده؛ اگر این‌جا رد شود، API برمی‌گرداند.
export async function clanProjectJoin(userId: string, who: { no: number; name: string }, projectId: string, amount: number): Promise<{ ok: boolean; reason?: string; project?: ClanProject; completed?: boolean }> {
  const amt = Math.round(Math.max(0, amount))
  if (!amt) return { ok: false, reason: 'مبلغ نامعتبر' }
  return mutate<ClansDb, { ok: boolean; reason?: string; project?: ClanProject; completed?: boolean }>('empire_clans', CLANS_FALLBACK, db => {
    const c = Object.values(db.clans).find(x => x.members.some(m => m.userId === userId))
    const pr = c?.projects?.find(x => x.id === projectId)
    if (!c || !pr) return { ok: false, reason: 'کنسرسیوم پیدا نشد' }
    if (pr.status !== 'open') return { ok: false, reason: 'این کنسرسیوم دیگر باز نیست' }
    const room = pr.price - pr.funded
    const put = Math.min(amt, room)
    if (put <= 0) return { ok: false, reason: 'سقفِ کنسرسیوم پر شده' }
    const sh = pr.shares[userId] || (pr.shares[userId] = { no: who.no, name: who.name, amount: 0 })
    sh.amount += put
    pr.funded += put
    const completed = pr.funded >= pr.price
    if (completed) pr.status = 'owned'
    return { ok: true, project: pr, completed, reason: put < amt ? `فقط ${put.toLocaleString('fa-IR')} جا داشت — بقیه برگشت` : undefined }
  })
}
// فروشِ کنسرسیوم به قیمتِ روزِ واقعیِ آگهی — تقسیمِ نسبتی؛ باقیماندهٔ رندشدن به بزرگ‌ترین سهم.
export async function clanProjectSell(ownerId: string, projectId: string, livePrice: number): Promise<{ ok: boolean; reason?: string; payouts?: Array<{ userId: string; no: number; name: string; amount: number }>; title?: string; listingId?: string }> {
  if (!(livePrice > 0)) return { ok: false, reason: 'قیمتِ روزِ معتبری برای این آگهی نیست — فروش فقط روی آگهیِ فعال' }
  return mutate<ClansDb, { ok: boolean; reason?: string; payouts?: Array<{ userId: string; no: number; name: string; amount: number }>; title?: string; listingId?: string }>('empire_clans', CLANS_FALLBACK, db => {
    const c = Object.values(db.clans).find(x => x.ownerId === ownerId)
    const pr = c?.projects?.find(x => x.id === projectId)
    if (!c || !pr) return { ok: false, reason: 'فقط بنیان‌گذار می‌تواند بفروشد' }
    if (pr.status !== 'owned') return { ok: false, reason: 'این کنسرسیوم مالکِ ملک نیست' }
    const entries = Object.entries(pr.shares)
    const total = pr.funded || 1
    let paid = 0
    const payouts = entries.map(([uid, sh]) => {
      const amount = Math.floor((sh.amount / total) * livePrice)
      paid += amount
      return { userId: uid, no: sh.no, name: sh.name, amount }
    })
    // باقیماندهٔ رند به بزرگ‌ترین سهم — جمعِ پرداختی دقیقاً = قیمتِ فروش (بقای پول)
    const rem = Math.round(livePrice) - paid
    if (rem > 0 && payouts.length) payouts.sort((a, b) => b.amount - a.amount)[0].amount += rem
    pr.status = 'sold'
    pr.soldPrice = Math.round(livePrice)
    return { ok: true, payouts, title: pr.title, listingId: pr.listingId }
  })
}
