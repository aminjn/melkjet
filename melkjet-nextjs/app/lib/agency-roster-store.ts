import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { pgEnabled, kvGet, kvMutate } from './db'
import { buildAgencyRoster } from './agency-roster'
import { importDivarToken } from './advisor-divar-import'
import { warmEnrichment } from './enrich-warm'
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
  tokens?: string[]      // توکنِ آگهی‌های این مشاور (برای بازکردنِ لینکِ دیوار) — سقفِ ۱۰۰
  graduatedAt?: number
  graduating?: boolean   // در صفِ «ساختِ حساب» روی اینستنسِ ۰
}
// کارِ صفِ «ساختِ حساب» — سنگین (انتقالِ فایل‌ها)، روی اینستنسِ ۰ اجرا می‌شود تا درخواستِ ادمین قفل نشود.
export interface GradJob { jid: string; id: string; key: string; phone: string; role: string; at: number; error?: string }
export interface RosterScrape {
  id: string
  slug: string
  agencyName: string
  agencyOwner: string    // کلیدِ حسابِ آژانس (agency:slug یا شمارهٔ موبایل پس از graduate)
  agencyPhone?: string
  advisors: RosterAdvisor[]
  useAI: boolean
  schedule: 'off' | 'daily' | '6h'
  // زمان‌بندیِ اختصاصیِ این اسکرپ (اگر تعریف نشود، پیش‌فرضِ سراسریِ settings به‌کار می‌رود).
  autoSync?: boolean
  startHour?: number
  endHour?: number
  createdAt: number
  lastRun?: number
  lastError?: string
  lastTotal?: number
  lastUnnamed?: number
  unnamedTokens?: string[]   // توکنِ آگهی‌های بی‌امضا (به آژانس) — سقفِ ۱۰۰
  running?: boolean
  runStartedAt?: number    // برای تشخیصِ رانِ گیرکرده/مرده
  lastProgressAt?: number  // آخرین باری که پیشرفت نوشته شد — مبنای تشخیصِ «مرده» (نه زمانِ شروع)
  progress?: { done: number; total: number }
  runRequested?: boolean   // «همگام‌سازی الان» — کرونِ اینستنسِ ۰ برمی‌دارد
}
// تنظیماتِ سراسریِ زمان‌بندی — سینکِ خودکار فقط در «پنجرهٔ شبانه» اجرا می‌شود تا روزها
// ترافیک/دیوار درگیر نشود. «همگام‌سازی الان» (runRequested) همیشه و فوری اجرا می‌شود.
export interface RosterSettings {
  autoSync: boolean   // زمان‌بندیِ خودکار روشن/خاموش
  startHour: number   // ساعتِ شروعِ پنجره (به وقتِ ایران، ۰..۲۳)
  endHour: number     // ساعتِ پایانِ پنجره (به وقتِ ایران، ۰..۲۳) — می‌تواند از نیمه‌شب رد شود
}
const DEFAULT_SETTINGS: RosterSettings = { autoSync: true, startHour: 0, endHour: 6 } // ۱۲ شب تا ۶ صبح
interface DB { scrapes: Record<string, RosterScrape>; settings?: RosterSettings; graduateQueue?: GradJob[] }

const FILE = join(process.cwd(), '.agency-roster-data.json')
const KV = 'agency_roster'
const empty = (): DB => ({ scrapes: {} })
function fileLoad(): DB { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return empty() }
function fileSave(db: DB) { writeFileSync(FILE, JSON.stringify(db, null, 2), 'utf-8') }
async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV, empty()) : fileLoad() }
async function mutate<R>(fn: (db: DB) => R): Promise<R> { if (pgEnabled()) return kvMutate<DB, R>(KV, empty(), fn); const db = fileLoad(); const r = fn(db); fileSave(db); return r }

// ── چک‌پوینتِ ازسرگیری: متنِ آگهی‌های اسکرپ‌شده (توکن→{title,desc}) در یک کلیدِ جدا، برای هر اسکرپ ──
// اگر سینک نیمه‌کاره بماند (reload/کیل)، رانِ بعدی آگهی‌های کش‌شده را دوباره از دیوار نمی‌گیرد و ادامه می‌دهد.
// در پایانِ موفق پاک می‌شود تا سینکِ روزانه‌ی بعدی دادهٔ تازه بگیرد.
type RowCache = Record<string, { title: string; desc: string }>
const CACHE_KV = 'agency_roster_cache'
const CACHE_FILE = join(process.cwd(), '.agency-roster-cache.json')
function cacheFileLoad(): Record<string, RowCache> { if (existsSync(CACHE_FILE)) { try { return JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) } catch {} } return {} }
async function loadRowCache(id: string): Promise<RowCache> {
  if (pgEnabled()) return (await kvGet<Record<string, RowCache>>(CACHE_KV, {}))[id] || {}
  return cacheFileLoad()[id] || {}
}
async function saveRowCache(id: string, cache: RowCache): Promise<void> {
  if (pgEnabled()) { await kvMutate<Record<string, RowCache>, void>(CACHE_KV, {}, db => { db[id] = cache }); return }
  const all = cacheFileLoad(); all[id] = cache; writeFileSync(CACHE_FILE, JSON.stringify(all), 'utf-8')
}
async function clearRowCache(id: string): Promise<void> {
  if (pgEnabled()) { await kvMutate<Record<string, RowCache>, void>(CACHE_KV, {}, db => { delete db[id] }); return }
  const all = cacheFileLoad(); delete all[id]; writeFileSync(CACHE_FILE, JSON.stringify(all), 'utf-8')
}

// توکنِ برندِ دیوار حساس به حروف است — فقط پیشوندِ URL و دنبالهٔ اضافی را می‌گیریم، بدونِ lowercase.
// کاراکترهای نامرئیِ RTL/zero-width (که موقعِ کپی از مرورگرِ فارسی می‌چسبند) هم حذف می‌شوند.
const cleanSlug = (s: string) => String(s || '').replace(/[​-‏‪-‮⁦-⁩﻿]/g, '').trim().replace(/.*divar\.ir\/(?:pro|business(?:es)?)\//i, '').replace(/[^A-Za-z0-9_-].*$/, '')

// رانِ مرده: running=true ولی مدتی است هیچ پیشرفتی نوشته نشده (پروسه reload/کیل شده).
// مبنا «آخرین پیشرفت» است نه «زمانِ شروع» — تا سینکِ بزرگ که واقعاً در حالِ کار است زودهنگام «مرده» علامت نخورد.
const STALE_MS = 8 * 60 * 1000
const isStale = (s: RosterScrape, now = Date.now()) => !!s.running && (now - (s.lastProgressAt || s.runStartedAt || 0) > STALE_MS)

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

// «همگام‌سازیِ الان» — سینکِ دستی همیشه «تازه» است: کشِ ازسرگیری پاک می‌شود تا آگهی‌ها دوباره
// از دیوار گرفته شوند (کشِ کهنهٔ دورهٔ پروکسیِ مرده که متنِ خالی داشت، دیگر استفاده نمی‌شود).
export async function requestRun(id: string): Promise<boolean> {
  const ok = await mutate(db => { const s = db.scrapes[id]; if (!s) return false; s.runRequested = true; if (isStale(s)) s.running = false; return true })
  if (ok) { try { await clearRowCache(id) } catch {} }
  return ok
}
const PERIOD: Record<RosterScrape['schedule'], number> = { off: 0, '6h': 6 * 3600_000, daily: 24 * 3600_000 }

// ── تنظیماتِ سراسریِ زمان‌بندی ──
export async function getRosterSettings(): Promise<RosterSettings> {
  const s = (await load()).settings
  return { ...DEFAULT_SETTINGS, ...(s || {}) }
}
export async function saveRosterSettings(patch: Partial<RosterSettings>): Promise<RosterSettings> {
  return mutate(db => {
    const cur = { ...DEFAULT_SETTINGS, ...(db.settings || {}) }
    if (typeof patch.autoSync === 'boolean') cur.autoSync = patch.autoSync
    if (patch.startHour != null) cur.startHour = Math.max(0, Math.min(23, Math.floor(Number(patch.startHour))))
    if (patch.endHour != null) cur.endHour = Math.max(0, Math.min(23, Math.floor(Number(patch.endHour))))
    db.settings = cur
    return cur
  })
}
// ساعتِ کنونی به وقتِ ایران (UTC+3:30، بدونِ ساعتِ تابستانی از ۱۴۰۱).
const IR = 3.5 * 3600_000
const iranHour = (now: number) => new Date(now + IR).getUTCHours()
// آخرین باری که پنجره «باز شد» (startHour به وقتِ ایران)، به میلی‌ثانیهٔ UTC. برای «یک‌بار در هر شب».
function windowOpenedAt(now: number, startHour: number): number {
  const d = new Date(now + IR)
  let openIran = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), startHour, 0, 0)
  if (openIran > now + IR) openIran -= 24 * 3600_000   // اگر بازشدنِ امروز هنوز نیامده، مالِ دیروز
  return openIran - IR
}
// آیا ساعت درونِ پنجره است؟ پنجرهٔ ردشونده از نیمه‌شب (مثلِ ۲۲→۶) پشتیبانی می‌شود.
export function inSyncWindow(hour: number, start: number, end: number): boolean {
  if (start === end) return true            // ۲۴ساعته
  if (start < end) return hour >= start && hour < end
  return hour >= start || hour < end        // ردشونده از نیمه‌شب
}

// اسکرپ‌هایی که باید سینک شوند و در حالِ اجرا نیستند (یا رانشان مرده).
// درخواستِ دستی («همگام‌سازی الان») همیشه؛ زمان‌بندیِ خودکار فقط اگر autoSync روشن و در پنجرهٔ شبانه باشیم.
export async function listDueRosters(now: number): Promise<RosterScrape[]> {
  const db = await load()
  const g = { ...DEFAULT_SETTINGS, ...(db.settings || {}) }
  const hour = iranHour(now)
  return Object.values(db.scrapes).filter(s => {
    if (s.running && !isStale(s, now)) return false
    if (s.runRequested) return true            // دستی — همیشه و فوری
    // زمان‌بندیِ هر اسکرپ: مقدارِ خودش، وگرنه پیش‌فرضِ سراسری.
    const autoSync = s.autoSync !== undefined ? s.autoSync : g.autoSync
    const startHour = s.startHour !== undefined ? s.startHour : g.startHour
    const endHour = s.endHour !== undefined ? s.endHour : g.endHour
    if (!autoSync || !inSyncWindow(hour, startHour, endHour)) return false   // خاموش یا خارج از پنجرهٔ همین اسکرپ
    if (s.schedule === 'off') return false
    // «daily» = یک‌بار در هر بازشدنِ پنجرهٔ شبانه (حتی اگر روز دستی سینک شده باشد، شب باز می‌گیرد).
    if (s.schedule === 'daily') return !s.lastRun || s.lastRun < windowOpenedAt(now, startHour)
    // «6h» = هر ۶ ساعت درونِ پنجره.
    return !s.lastRun || now - s.lastRun >= PERIOD['6h']
  })
}
// تنظیمِ زمان‌بندیِ اختصاصیِ یک اسکرپ.
export async function saveScrapeSchedule(id: string, patch: { autoSync?: boolean; startHour?: number; endHour?: number }): Promise<boolean> {
  return mutate(db => {
    const s = db.scrapes[id]; if (!s) return false
    if (typeof patch.autoSync === 'boolean') s.autoSync = patch.autoSync
    if (patch.startHour != null) s.startHour = Math.max(0, Math.min(23, Math.floor(Number(patch.startHour))))
    if (patch.endHour != null) s.endHour = Math.max(0, Math.min(23, Math.floor(Number(patch.endHour))))
    return true
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
      // مالکِ موقتِ رُستر: آگهی وارد می‌شود ولی عمومی نمی‌شود تا کاربر ساخته شود (graduate).
      const res = await importDivarToken(owner, token, undefined, sourceId, { publish: false })
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
  await patchScrape(id, { running: true, runStartedAt: Date.now(), lastProgressAt: Date.now(), runRequested: false, progress: { done: 0, total: 0 }, lastError: '' })
  let done = false
  // ضربانِ زنده‌بودن: هر ۵ ثانیه lastProgressAt را می‌زند. اگر پروسه reload/کیل شود، این تایمر هم می‌میرد
  // و lastProgressAt یخ می‌زند → بعد از STALE_MS درست «مرده» تشخیص داده می‌شود (حتی وسطِ فازِ AI/ایمپورت).
  const heartbeat = setInterval(() => { patchScrape(id, { lastProgressAt: Date.now() }).catch(() => {}) }, 5000)
  try {
    // پیشرفتِ زنده (throttleشده تا هر ۳ ثانیه یک نوشت) + heartbeatِ lastProgressAt تا سینکِ زنده «مرده» علامت نخورد.
    let lastWrite = 0
    const prog = (d: number, t: number) => {
      try { onProgress?.(d, t) } catch {}
      const now = Date.now()
      if (d === t || now - lastWrite > 3000) { lastWrite = now; patchScrape(id, { progress: { done: d, total: t }, lastProgressAt: now }).catch(() => {}) }
    }
    // ازسرگیری: کشِ آگهی‌های قبلاً اسکرپ‌شده را بارگذاری کن؛ آگهی‌های تازه را افزوده و throttleشده ذخیره کن.
    const rowCache: RowCache = await loadRowCache(id)
    let lastCacheWrite = 0
    const onRow = (token: string, r: { title: string; desc: string }) => {
      if (!r.desc) return   // متنِ خالی را کش نکن تا دفعهٔ بعد دوباره گرفته شود (خودترمیمی)
      rowCache[token] = r
      const now = Date.now()
      if (now - lastCacheWrite > 5000) { lastCacheWrite = now; saveRowCache(id, rowCache).catch(() => {}) }
    }
    const roster = await buildAgencyRoster(scrape.slug, { useAI: scrape.useAI, onProgress: prog, cached: rowCache, onRow })
    if (!roster.ok) { done = true; await patchScrape(id, { running: false, lastRun: Date.now(), lastError: roster.error || 'خطا در خوشه‌بندی' }); return { ok: false, error: roster.error, advisors: 0, total: 0, unnamed: 0 } }

    // رکوردِ هر مشاورِ کشف‌شده را می‌سازیم/به‌روز می‌کنیم (نامِ حساب‌های graduateشده دست‌نخورده می‌ماند).
    const freshByKey = new Map(roster.advisors.map(a => [a.key, a]))
    const recs = [...scrape.advisors]
    for (const a of roster.advisors) {
      let rec = recs.find(r => r.key === a.key)
      if (!rec) { rec = { key: a.key, name: a.name, owner: `adv:${scrape.slug}:${a.key}`, listingCount: 0 }; recs.push(rec) }
      else if (!rec.phone && a.name) rec.name = a.name
      rec.tokens = a.tokens.slice(0, 100)   // لینکِ آگهی‌های دیوار برای بازبینی
    }
    // هرسِ خودکار: رکوردهای قدیمی که این‌بار دیگر کشف نشدند و به حساب هم تبدیل نشده‌اند
    // (اسم‌های خرابِ نوفه از سینکِ قبلی) حذف می‌شوند تا لیست تمیز شود.
    // رکوردی که «شماره/حساب» دارد (graduateشده) هرگز حذف نمی‌شود.
    for (let i = recs.length - 1; i >= 0; i--) {
      if (!freshByKey.has(recs[i].key) && !recs[i].phone && !recs[i].graduating) recs.splice(i, 1)
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
      s.unnamedTokens = roster.unnamed.tokens.slice(0, 100)
    })
    await clearRowCache(id)   // موفق شد → کش پاک تا سینکِ بعدی دادهٔ تازه بگیرد
    done = true
    return { ok: true, advisors: recs.length, total: roster.total, unnamed: roster.unnamed.tokens.length }
  } catch (e: any) {
    done = true
    await patchScrape(id, { running: false, lastRun: Date.now(), lastError: e?.message || 'خطای داخلی' })
    return { ok: false, error: e?.message || 'خطا', advisors: 0, total: 0, unnamed: 0 }
  } finally {
    clearInterval(heartbeat)
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
    // حالا که به کاربرِ واقعی رسید: هر آگهیِ فعال عمومی و با AI تحلیل می‌شود (چیزی که هنگامِ
    // مالکِ موقت عمداً انجام نشد). آگهیِ فروخته/اجاره‌رفته عمومی نمی‌شود.
    if (l.status !== 'active') await setListingStatus(toO, nl.id, l.status)
    else { const pub = await publishListing(toO, nl.id); if (pub?.publicId) warmEnrichment(pub.publicId) }
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
    else { const r = s.advisors.find(x => x.key === key); if (r) { r.owner = p; r.phone = p; r.graduatedAt = Date.now(); r.graduating = false } }
  })
  // یادگیریِ ماشین: تأییدِ ادمین قوی‌ترین سیگنال است → این نام برای همیشه یاد گرفته می‌شود.
  if (!isAgency && name) { try { const { learnName } = await import('./agency-roster-ml'); await learnName(name, 'admin') } catch {} }
  return { ok: true, moved }
}

// ── حذفِ دستیِ یک مشاور از رُستر (برای اسم‌های خراب یا حسابِ حذف‌شده) ──
// فقط رکوردِ رُستر را برمی‌دارد؛ حساب/فایل‌های واقعی (اگر graduate شده) دست‌نخورده می‌مانند.
export async function removeAdvisor(id: string, key: string): Promise<{ ok: boolean; error?: string }> {
  return mutate(db => {
    const s = db.scrapes[id]; if (!s) return { ok: false, error: 'اسکرپ یافت نشد' }
    const before = s.advisors.length
    s.advisors = s.advisors.filter(a => a.key !== key)
    if (db.graduateQueue) db.graduateQueue = db.graduateQueue.filter(j => !(j.id === id && j.key === key))
    return s.advisors.length < before ? { ok: true } : { ok: false, error: 'مشاور یافت نشد' }
  })
}

// ── صفِ «ساختِ حساب» (graduate) — سبک روی درخواستِ ادمین، سنگین روی اینستنسِ ۰ ──
// اعتبارسنجی فوری است؛ انتقالِ فایل‌ها (که برای مشاورِ پرفایل چند دقیقه طول می‌کشد و با سینکِ
// در حالِ اجرا رقابت می‌کند) به صفِ اینستنسِ ۰ می‌رود تا درخواست ۶۰ثانیه‌ای تایم‌اوت نشود.
export async function enqueueGraduate(id: string, key: string, phone: string, role = 'advisor'): Promise<{ ok: boolean; error?: string; queued?: boolean }> {
  const p = String(phone).replace(/\D/g, '')
  if (!/^09\d{9}$/.test(p)) return { ok: false, error: 'شمارهٔ موبایل معتبر نیست (۰۹...)' }
  return mutate(db => {
    const s = db.scrapes[id]; if (!s) return { ok: false, error: 'اسکرپ یافت نشد' }
    const isAgency = key === '__agency__'
    if (!isAgency) {
      const rec = s.advisors.find(a => a.key === key)
      if (!rec) return { ok: false, error: 'مشاور یافت نشد' }
      if (rec.phone) return { ok: false, error: 'این مشاور از قبل حساب دارد' }
      rec.graduating = true
    } else if (s.agencyPhone) return { ok: false, error: 'آژانس از قبل حساب دارد' }
    db.graduateQueue = db.graduateQueue || []
    if (!db.graduateQueue.some(j => j.id === id && j.key === key)) {
      db.graduateQueue.push({ jid: 'grd_' + Math.random().toString(36).slice(2, 8), id, key, phone: p, role, at: Date.now() })
    }
    return { ok: true, queued: true }
  })
}

// اینستنسِ ۰: یک کارِ صفِ graduate را بردار و اجرا کن (خارج از قفلِ mutate اجرا می‌شود).
export async function processGraduateQueue(): Promise<{ ran: boolean; ok?: boolean; error?: string }> {
  const job = await mutate(db => {
    const q = db.graduateQueue || []
    const j = q.shift()
    db.graduateQueue = q
    return j || null
  })
  if (!job) return { ran: false }
  try {
    const r = await graduateAdvisor(job.id, job.key, job.phone, job.role)
    if (!r.ok) {
      // رکوردِ مشاور را از حالتِ «در حالِ ساخت» درآور و خطا را ثبت کن.
      await mutate(db => { const s = db.scrapes[job.id]; if (s) { const rec = s.advisors.find(a => a.key === job.key); if (rec) { rec.graduating = false } s.lastError = `ساختِ حساب ناموفق: ${r.error || 'خطا'}` } })
    }
    return { ran: true, ok: r.ok, error: r.error }
  } catch (e: any) {
    await mutate(db => { const s = db.scrapes[job.id]; if (s) { const rec = s.advisors.find(a => a.key === job.key); if (rec) rec.graduating = false; s.lastError = `ساختِ حساب ناموفق: ${e?.message || 'خطا'}` } })
    return { ran: true, ok: false, error: e?.message || 'خطا' }
  }
}
export async function hasGraduateJobs(): Promise<boolean> { return ((await load()).graduateQueue || []).length > 0 }
