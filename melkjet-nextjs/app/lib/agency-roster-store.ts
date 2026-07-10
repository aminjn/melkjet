import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { pgEnabled, kvGet, kvMutate } from './db'
import { buildAgencyRoster } from './agency-roster'
import { importDivarToken } from './advisor-divar-import'
import { getDivar, recordImport, clearImports } from './advisor-divar-store'
import { getAdvisor, addListing, publishListing, deleteListing, setListingStatus, updateAdvisorProfile, type Listing } from './advisor-store'
import { createAccount, accountExists } from './account-store'

// ── «هوش آژانس»: یک لینکِ آژانسِ دیوار → مشاورها + آژانس، هر کدام حسابِ جدا ──
// جریان: buildAgencyRoster خوشه‌بندی می‌کند → هر مشاور زیرِ یک ownerِ موقت (adv:slug:key) و
// آگهی‌های بی‌امضا زیرِ ownerِ آژانس (agency:slug) ایمپورت می‌شوند. ادمین شمارهٔ موبایل می‌دهد →
// حسابِ واقعی ساخته و آگهی‌ها منتقل می‌شوند (graduate). آپدیتِ روزانه dedup-safe است.

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const sid = () => 'agr_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)

export interface RosterAdvisor {
  key: string            // کلیدِ نرمالِ اسم (شناسهٔ خوشه)
  name: string           // نامِ نمایشی
  owner: string          // کلیدِ موقت (adv:slug:key) یا شمارهٔ موبایل پس از graduate
  phone?: string         // پس از graduate ست می‌شود
  listingCount: number
  graduatedAt?: number
}
export interface RosterScrape {
  id: string
  slug: string
  agencyName: string
  agencyOwner: string    // کلیدِ حسابِ آژانس (agency:slug یا شمارهٔ موبایل پس از graduate)
  agencyPhone?: string
  advisors: RosterAdvisor[]
  useAI: boolean
  schedule: 'off' | 'daily' | '6h'
  createdAt: number
  lastRun?: number
  lastError?: string
  lastTotal?: number
  lastUnnamed?: number
  running?: boolean
  runStartedAt?: number    // برای تشخیصِ رانِ گیرکرده/مرده
  progress?: { done: number; total: number }
  runRequested?: boolean   // «همگام‌سازی الان» — کرونِ اینستنسِ ۰ برمی‌دارد
}
interface DB { scrapes: Record<string, RosterScrape> }

const FILE = join(process.cwd(), '.agency-roster-data.json')
const KV = 'agency_roster'
const empty = (): DB => ({ scrapes: {} })
function fileLoad(): DB { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return empty() }
function fileSave(db: DB) { writeFileSync(FILE, JSON.stringify(db, null, 2), 'utf-8') }
async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV, empty()) : fileLoad() }
async function mutate<R>(fn: (db: DB) => R): Promise<R> { if (pgEnabled()) return kvMutate<DB, R>(KV, empty(), fn); const db = fileLoad(); const r = fn(db); fileSave(db); return r }

// توکنِ برندِ دیوار حساس به حروف است — فقط پیشوندِ URL و دنبالهٔ اضافی را می‌گیریم، بدونِ lowercase.
// کاراکترهای نامرئیِ RTL/zero-width (که موقعِ کپی از مرورگرِ فارسی می‌چسبند) هم حذف می‌شوند.
const cleanSlug = (s: string) => String(s || '').replace(/[​-‏‪-‮⁦-⁩﻿]/g, '').trim().replace(/.*divar\.ir\/(?:pro|business(?:es)?)\//i, '').replace(/[^A-Za-z0-9_-].*$/, '')

// رانِ گیرکرده: running=true ولی خیلی وقت است شروع شده (پروسه مُرده/reload شده).
const STALE_MS = 20 * 60 * 1000
const isStale = (s: RosterScrape, now = Date.now()) => !!s.running && (!s.runStartedAt || now - s.runStartedAt > STALE_MS)

export async function listScrapes(): Promise<RosterScrape[]> {
  const now = Date.now()
  return Object.values((await load()).scrapes)
    .map(s => isStale(s, now) ? { ...s, running: false, lastError: s.lastError || 'همگام‌سازی نیمه‌کاره ماند — دوباره «همگام‌سازی الان» را بزنید' } : s)
    .sort((a, b) => b.createdAt - a.createdAt)
}
export async function getScrape(id: string): Promise<RosterScrape | null> { return (await load()).scrapes[id] || null }

// ساختِ یک اسکرپِ آژانس (فقط ثبت — سینکِ واقعی را کرون/دکمه می‌زند).
export async function addScrape(input: { slug: string; agencyName?: string; useAI?: boolean; schedule?: RosterScrape['schedule'] }): Promise<{ ok: boolean; error?: string; scrape?: RosterScrape }> {
  const slug = cleanSlug(input.slug)
  if (!slug || !/^[A-Za-z0-9_-]{2,}$/.test(slug)) return { ok: false, error: 'لینک/slugِ آژانس نامعتبر است' }
  return mutate(db => {
    if (Object.values(db.scrapes).some(s => s.slug === slug)) return { ok: false, error: 'این آژانس از قبل اضافه شده است' }
    const s: RosterScrape = {
      id: sid(), slug, agencyName: String(input.agencyName || '').trim() || slug, agencyOwner: `agency:${slug}`,
      advisors: [], useAI: input.useAI !== false, schedule: input.schedule || 'daily', createdAt: Date.now(),
    }
    db.scrapes[s.id] = s
    return { ok: true, scrape: s }
  })
}
export async function removeScrape(id: string): Promise<void> { await mutate(db => { delete db.scrapes[id] }) }

// «همگام‌سازیِ الان» — پرچم می‌زند و رانِ گیرکرده را آزاد می‌کند؛ کارِ سنگین را کرونِ اینستنسِ ۰ برمی‌دارد.
export async function requestRun(id: string): Promise<boolean> {
  return mutate(db => { const s = db.scrapes[id]; if (!s) return false; s.runRequested = true; if (isStale(s)) s.running = false; return true })
}
const PERIOD: Record<RosterScrape['schedule'], number> = { off: 0, '6h': 6 * 3600_000, daily: 24 * 3600_000 }
// اسکرپ‌هایی که باید سینک شوند (درخواستِ دستی یا زمان‌بندیِ سررسیده) و در حالِ اجرا نیستند (یا رانشان مرده).
export async function listDueRosters(now: number): Promise<RosterScrape[]> {
  return Object.values((await load()).scrapes).filter(s => {
    if (s.running && !isStale(s, now)) return false
    if (s.runRequested) return true
    const p = PERIOD[s.schedule]; return !!p && (!s.lastRun || now - s.lastRun >= p)
  })
}
async function patchScrape(id: string, patch: Partial<RosterScrape>): Promise<void> { await mutate(db => { if (db.scrapes[id]) Object.assign(db.scrapes[id], patch) }) }

// ── ایمپورتِ یک خوشه (توکن‌ها) زیرِ یک owner — dedup-safe ──
// رفعِ باگِ «تکراری + فروخته‌شده»: «رفته» بر اساسِ listingIdِ لمس‌شده در همین دور محاسبه می‌شود،
// نه توکن. پس آگهیِ بازنشرشده (توکنِ جدید) که موتورِ شباهت روی همان فایل می‌نشاندش، «رفته» حساب
// نمی‌شود و اشتباهاً «فروخته» نمی‌خورد؛ و چون dedupِ محتوایی نسخهٔ دوم نمی‌سازد، تکراری هم رخ نمی‌دهد.
async function importClusterTokens(owner: string, tokens: string[], sourceId: string): Promise<{ live: number; sold: number }> {
  const liveIds = new Set<string>()
  for (const token of tokens) {
    try {
      const res = await importDivarToken(owner, token, undefined, sourceId)
      if (res.ok && res.listing) liveIds.add(res.listing.id)
    } catch {}
    await sleep(300)   // throttle — روی اینستنسِ ۰
  }
  // فایل‌هایی که این منبع قبلاً آورده بود ولی امسال لمس نشدند = فروخته/اجاره‌رفته.
  const priorIds = new Set(getDivar(owner).imports.filter(i => i.sourceId === sourceId).map(i => i.listingId))
  const goneIds = [...priorIds].filter(id => !liveIds.has(id))
  let sold = 0
  if (goneIds.length) {
    const listings = (await getAdvisor(owner)).listings
    for (const lid of goneIds) {
      const l = listings.find(x => x.id === lid)
      if (l && l.status === 'active') { await setListingStatus(owner, lid, l.deal === 'rent' ? 'rented' : 'sold'); sold++ }
    }
  }
  return { live: liveIds.size, sold }
}

// ── سینکِ کاملِ یک اسکرپِ آژانس: خوشه‌بندی + ایمپورتِ هر خوشه زیرِ ownerِ درست ──
export async function syncRoster(id: string, onProgress?: (done: number, total: number) => void): Promise<{ ok: boolean; error?: string; advisors: number; total: number; unnamed: number }> {
  const scrape = await getScrape(id)
  if (!scrape) return { ok: false, error: 'اسکرپ یافت نشد', advisors: 0, total: 0, unnamed: 0 }
  await patchScrape(id, { running: true, runStartedAt: Date.now(), runRequested: false, progress: { done: 0, total: 0 }, lastError: '' })
  let done = false
  try {
    // پیشرفتِ زنده (throttleشده تا هر ۳ ثانیه یک نوشت) تا کاربر بفهمد گیر نکرده.
    let lastWrite = 0
    const prog = (d: number, t: number) => {
      try { onProgress?.(d, t) } catch {}
      const now = Date.now()
      if (d === t || now - lastWrite > 3000) { lastWrite = now; patchScrape(id, { progress: { done: d, total: t } }).catch(() => {}) }
    }
    const roster = await buildAgencyRoster(scrape.slug, { useAI: scrape.useAI, onProgress: prog })
    if (!roster.ok) { done = true; await patchScrape(id, { running: false, lastRun: Date.now(), lastError: roster.error || 'خطا در خوشه‌بندی' }); return { ok: false, error: roster.error, advisors: 0, total: 0, unnamed: 0 } }

    // رکوردِ هر مشاورِ کشف‌شده را می‌سازیم/به‌روز می‌کنیم (نامِ حساب‌های graduateشده دست‌نخورده می‌ماند).
    const freshByKey = new Map(roster.advisors.map(a => [a.key, a]))
    const recs = [...scrape.advisors]
    for (const a of roster.advisors) {
      let rec = recs.find(r => r.key === a.key)
      if (!rec) { rec = { key: a.key, name: a.name, owner: `adv:${scrape.slug}:${a.key}`, listingCount: 0 }; recs.push(rec) }
      else if (!rec.phone && a.name) rec.name = a.name
    }

    // owner→tokens: هر مشاور آگهی‌های خودش؛ رکوردهای قدیمیِ غایب → توکنِ خالی (همه‌شان «رفته»)؛ آژانس → بی‌نام‌ها.
    const jobs: { rec?: RosterAdvisor; owner: string; tokens: string[] }[] = []
    for (const rec of recs) { const f = freshByKey.get(rec.key); jobs.push({ rec, owner: rec.owner, tokens: f ? f.tokens : [] }) }
    jobs.push({ owner: scrape.agencyOwner, tokens: roster.unnamed.tokens })

    for (const j of jobs) {
      const r = await importClusterTokens(j.owner, j.tokens, scrape.id)
      if (j.rec) j.rec.listingCount = r.live
    }

    await mutate(db => {
      const s = db.scrapes[id]; if (!s) return
      s.advisors = recs; s.agencyName = roster.agencyName || s.agencyName
      s.running = false; s.lastRun = Date.now(); s.lastError = ''
      s.lastTotal = roster.total; s.lastUnnamed = roster.unnamed.tokens.length
    })
    done = true
    return { ok: true, advisors: recs.length, total: roster.total, unnamed: roster.unnamed.tokens.length }
  } catch (e: any) {
    done = true
    await patchScrape(id, { running: false, lastRun: Date.now(), lastError: e?.message || 'خطای داخلی' })
    return { ok: false, error: e?.message || 'خطا', advisors: 0, total: 0, unnamed: 0 }
  } finally {
    // تضمین: اگر جایی زودتر return شد یا خطای ناگرفته رخ داد، running قفل نماند.
    if (!done) { try { await patchScrape(id, { running: false, lastError: 'همگام‌سازی ناتمام ماند' }) } catch {} }
  }
}

// انتقالِ آگهی‌های یک ownerِ موقت به یک ownerِ نهایی (شماره) — با استفاده از توابعِ موجود (public item درست ساخته می‌شود).
async function reassignListings(fromO: string, toO: string, sourceId: string): Promise<number> {
  const from = await getAdvisor(fromO)
  const moved: { oldId: string; newId: string }[] = []
  for (const l of from.listings) {
    const { id: _id, publicId: _p, ...fields } = l as Listing & { publicId?: string }
    const nl = await addListing(toO, fields)
    if (l.status !== 'active') await setListingStatus(toO, nl.id, l.status)
    else if (l.published) await publishListing(toO, nl.id)
    moved.push({ oldId: l.id, newId: nl.id })
  }
  // انتقالِ رکوردهای ایمپورت (توکن→listingId جدید) تا آپدیتِ بعدی همان فایل‌ها را بشناسد.
  for (const im of getDivar(fromO).imports.filter(i => i.sourceId === sourceId)) {
    const m = moved.find(x => x.oldId === im.listingId)
    recordImport(toO, { ...im, listingId: m ? m.newId : im.listingId })
  }
  for (const l of from.listings) { try { await deleteListing(fromO, l.id) } catch {} }
  clearImports(fromO)
  return moved.length
}

// ── graduate: به یک مشاورِ کشف‌شده شمارهٔ موبایل بده → حسابِ واقعی بساز و آگهی‌ها را منتقل کن ──
export async function graduateAdvisor(id: string, key: string, phone: string, role = 'advisor'): Promise<{ ok: boolean; error?: string; moved?: number }> {
  const p = String(phone).replace(/\D/g, '')
  if (!/^09\d{9}$/.test(p)) return { ok: false, error: 'شمارهٔ موبایل معتبر نیست (۰۹...)' }
  const scrape = await getScrape(id)
  if (!scrape) return { ok: false, error: 'اسکرپ یافت نشد' }
  const isAgency = key === '__agency__'
  const rec = isAgency ? null : scrape.advisors.find(r => r.key === key)
  if (!isAgency && !rec) return { ok: false, error: 'مشاور یافت نشد' }
  const name = isAgency ? scrape.agencyName : rec!.name
  const fromOwner = isAgency ? scrape.agencyOwner : rec!.owner
  if (fromOwner === p) return { ok: false, error: 'این شماره از قبل تنظیم شده' }

  if (!accountExists(p)) {
    const cr = createAccount(p, { name, role })
    if (!cr.ok) return { ok: false, error: cr.error }
  }
  try { await updateAdvisorProfile(p, { name, phone: p, agency: scrape.agencyName }) } catch {}

  const moved = await reassignListings(fromOwner, p, scrape.id)
  await mutate(db => {
    const s = db.scrapes[id]; if (!s) return
    if (isAgency) { s.agencyOwner = p; s.agencyPhone = p }
    else { const r = s.advisors.find(x => x.key === key); if (r) { r.owner = p; r.phone = p; r.graduatedAt = Date.now() } }
  })
  return { ok: true, moved }
}
