import { readFileSync, writeFileSync, existsSync } from './fs-atomic'
import { join } from 'path'
import { pgEnabled, kvGet, kvSet, kvMutate, kvDelete } from './db'
import { buildAgencyRoster } from './agency-roster'
import { importDivarToken } from './advisor-divar-import'
import { warmEnrichment } from './enrich-warm'
import { getEnrichment, patchEnrichment } from './enrich-store'
import { parseFaNum, rentPartsOf } from './reos/features'
import { getDivar, recordImport, clearImports } from './advisor-divar-store'
import { getAdvisor, addListing, publishListingsBatch, deleteListing, setListingStatus, updateAdvisorProfile, type Listing , updateListing} from './advisor-store'
import { createAccount, accountExists } from './account-store'
import { FA_DIGITS, faDigit } from '../lib/digits'

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
  transferFrom?: string  // فاز ۲۷۷ — ownerِ موقتِ مبدأ تا وقتی انتقالِ فایل‌ها تمام نشده (ازسرگیریِ امن)
}
// کارِ صفِ «ساختِ حساب» — سنگین (انتقالِ فایل‌ها)، روی اینستنسِ ۰ اجرا می‌شود تا درخواستِ ادمین قفل نشود.
export interface GradJob { jid: string; id: string; key: string; phone: string; role: string; at: number; startedAt?: number; error?: string }   // فاز ۱۹۹ — claim برای صفِ at-least-once
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
  runAttempts?: number     // فاز ۱۹۲ — شمارِ تلاش‌های ناتمام از آخرین موفقیت (توقفِ حلقهٔ بی‌پایان)
  phase?: 'scrape' | 'cluster' | 'import'   // فاز ۱۹۳/۱۹۴ — کدام مرحله؟ (اسکرپ/شناساییِ نام‌ها/ایمپورت)
  stopRequested?: boolean  // فاز ۱۹۶ — دکمهٔ «⏹ توقف»: رانِ زنده در اولین چکِ بعدی تمیز می‌ایستد
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
type RowCache = Record<string, { title: string; desc: string; name?: string; at?: number }>   // name = نامِ AI؛ at = زمانِ اسکرپِ ردیف (فاز ۱۹۸ — کشِ دائمیِ اینکرمنتال)
const CACHE_KV = 'agency_roster_cache'
const CACHE_FILE = join(process.cwd(), '.agency-roster-cache.json')
// ── فاز ۲۷۵c — کشِ ردیف «per-اسکرپ» شارد شد (همان الگوی فاز ۲۵۹ برای advisor) ──────────
// ریشهٔ «ساختِ حساب ۱۰ دقیقه طول می‌کشد»: کشِ متنِ آگهی‌های **همهٔ** آژانس‌ها در یک ردیفِ
// `kv('agency_roster_cache')` بود و `saveRowCache` هر ۵ ثانیه با `kvMutate` (یعنی
// `SELECT … FOR UPDATE` + بازنویسیِ کلِ بلاب) صدا زده می‌شد. با ۲۸ آژانس و هزاران آگهی،
// هر ۵ ثانیه ده‌ها مگابایت زیرِ قفل بازنویسی می‌شد → پولِ PG اشباع → هر کارِ دیگری روی
// اینستنسِ ۰ (ازجمله برداشتنِ کارِ «ساخت حساب» از صف) پشتِ صف می‌ماند؛ اندازه‌گیریِ زنده:
// ۶۶۵ و ۶۱۶ ثانیه فاصلهٔ «ثبت در صف» تا «شروع».
// حالا هر اسکرپ کلیدِ خودش را دارد و چون تک‌نویسنده است (اینستنسِ ۰)، با `kvSet` نوشته
// می‌شود — بدونِ هیچ قفلِ FOR UPDATE. آژانس‌ها دیگر با هم رقابت نمی‌کنند.
const cacheKey = (id: string) => `${CACHE_KV}:${id}`
function cacheFileLoad(): Record<string, RowCache> { if (existsSync(CACHE_FILE)) { try { return JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) } catch {} } return {} }
async function loadRowCache(id: string): Promise<RowCache> {
  if (!pgEnabled()) return cacheFileLoad()[id] || {}
  const own = await kvGet<RowCache>(cacheKey(id), {})
  if (Object.keys(own).length) return own
  // مهاجرتِ یک‌بارهٔ تنبل: اگر هنوز در بلابِ قدیمی است، همان‌جا برداشته و به کلیدِ خودش منتقل می‌شود.
  // بلابِ قدیمی دست‌نخورده می‌ماند (پشتیبانِ بازگشت) و چون دیگر نوشته نمی‌شود، هزینه‌ای ندارد.
  const legacy = (await kvGet<Record<string, RowCache>>(CACHE_KV, {}))[id]
  if (legacy && Object.keys(legacy).length) { await kvSet(cacheKey(id), legacy); return legacy }
  return {}
}
async function saveRowCache(id: string, cache: RowCache): Promise<void> {
  if (pgEnabled()) { await kvSet(cacheKey(id), cache); return }   // تک‌نویسنده → جایگزینیِ کامل، بدونِ قفل
  const all = cacheFileLoad(); all[id] = cache; writeFileSync(CACHE_FILE, JSON.stringify(all), 'utf-8')
}
async function clearRowCache(id: string): Promise<void> {
  if (pgEnabled()) { await kvDelete(cacheKey(id)); return }
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
  const db = await load()
  const q = db.graduateQueue || []
  return Object.values(db.scrapes)
    .map(s => isStale(s, now) ? { ...s, running: false, lastError: s.lastError || 'همگام‌سازی نیمه‌کاره ماند — خودکار از همان‌جا ادامه می‌یابد' } : s)
    // فاز ۱۹۹ — پرچمِ یتیمِ «در حال ساخت»: اگر کاری در صف نیست، پرچم در نمایش خاموش می‌شود (خودترمیم)
    .map(s => ({ ...s, advisors: (s.advisors || []).map(a => a.graduating && !q.some(j => j.id === s.id && j.key === a.key) ? { ...a, graduating: false } : a) }))
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
  let hadError = false
  const ok = await mutate(db => { const s = db.scrapes[id]; if (!s) return false; hadError = !!s.lastError; s.runRequested = true; s.stopRequested = false; s.runAttempts = 0; s.lastError = ''; if (isStale(s)) s.running = false; return true })   // فاز ۱۹۶ب: کلیکِ دستی = شروعِ تمیز
  // فاز ۱۹۸ — کش دائمی است (اینکرمنتال)؛ کلیکِ دستی هرگز کش را دور نمی‌ریزد. تازگی با چرخشِ ۱۴روزه تأمین می‌شود.
  void hadError
  return ok
}
// فاز ۱۹۶ — «⏹ توقفِ همگام‌سازی» (درخواستِ کاربر بعدِ لوپِ دوروزه): state همان لحظه بسته می‌شود و
// اگر پروسه‌ای زنده وسطِ کار باشد، در اولین چکِ بعدی (حداکثر چند ثانیه) تمیز می‌ایستد و دیگر صف نمی‌شود.
export async function requestStop(id: string): Promise<boolean> {
  return mutate(db => {
    const s = db.scrapes[id]; if (!s) return false
    s.stopRequested = true; s.runRequested = false; s.running = false; s.runAttempts = 0
    s.lastError = 'با دکمهٔ توقف متوقف شد'
    return true
  })
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
  const dueList = Object.values(db.scrapes).filter(s => {
    if (s.running && !isStale(s, now)) return false
    if (s.runRequested) return true            // دستی — همیشه و فوری
    // زمان‌بندیِ هر اسکرپ: مقدارِ خودش، وگرنه پیش‌فرضِ سراسری.
    const autoSync = s.autoSync !== undefined ? s.autoSync : g.autoSync
    const startHour = s.startHour !== undefined ? s.startHour : g.startHour
    const endHour = s.endHour !== undefined ? s.endHour : g.endHour
    if (!autoSync || s.schedule === 'off') return false   // خاموش یا غیرفعال
    // فاز ۲۵۸ — درین‌کردنِ بک‌لاگ: آژانسی که «هیچ‌وقت سینک نشده» (بدونِ داده) در هر ساعتی
    // سررسیده است تا صفِ اولیه سریع خالی شود. تازه‌سازیِ آژانس‌های سینک‌شده فقط در پنجرهٔ شب می‌ماند.
    if (!s.lastRun) return true
    if (!inSyncWindow(hour, startHour, endHour)) return false   // خارج از پنجرهٔ همین اسکرپ (فقط تازه‌سازی)
    // «daily» = یک‌بار در هر بازشدنِ پنجرهٔ شبانه (حتی اگر روز دستی سینک شده باشد، شب باز می‌گیرد).
    if (s.schedule === 'daily') return s.lastRun < windowOpenedAt(now, startHour)
    // «6h» = هر ۶ ساعت درونِ پنجره.
    return now - s.lastRun >= PERIOD['6h']
  })
  // فاز ۲۵۸ — ترتیبِ منصفانه: کم‌سابقه‌ترین اول (آژانسی که دیرترین‌بار تلاش شده، جلوتر) تا یک
  // آژانسِ بزرگ که هر بار بودجه‌اش تمام می‌شود، اسلات‌ها را از بقیه نگیرد و همه به‌نوبت پیش بروند.
  return dueList.sort((a, b) => (a.lastRun || a.runStartedAt || a.createdAt || 0) - (b.lastRun || b.runStartedAt || b.createdAt || 0))
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
export async function patchScrape(id: string, patch: Partial<RosterScrape>): Promise<void> { await mutate(db => { if (db.scrapes[id]) Object.assign(db.scrapes[id], patch) }) }

// ── ایمپورتِ یک خوشه (توکن‌ها) زیرِ یک owner — dedup-safe ──
// رفعِ باگِ «تکراری + فروخته‌شده»: «رفته» بر اساسِ listingIdِ لمس‌شده در همین دور محاسبه می‌شود،
// نه توکن. پس آگهیِ بازنشرشده (توکنِ جدید) که موتورِ شباهت روی همان فایل می‌نشاندش، «رفته» حساب
// نمی‌شود و اشتباهاً «فروخته» نمی‌خورد؛ و چون dedupِ محتوایی نسخهٔ دوم نمی‌سازد، تکراری هم رخ نمی‌دهد.

/** به‌روزرسانیِ آگهیِ موجود از پاسخِ فهرستِ پروفایل — بدونِ هیچ درخواستِ اضافه.
 *  `brand-landing` عنوان و قیمت و تصویر را می‌دهد، پس آگهیِ تکراری لازم نیست
 *  دوباره دانلود شود ولی قیمتش هم کهنه نمی‌ماند. هر دو نسخه به‌روز می‌شوند:
 *  نسخهٔ مشاور (پنل) و نسخهٔ عمومی (نمایش و آمارِ بازار). */
async function refreshFromBrandPost(
  owner: string, l: { id: string; title?: string; price?: number; rentMonthly?: number; deal?: string; images?: string[]; publicId?: string },
  post: { title?: string; price?: string; image?: string },
): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (post.title && post.title !== l.title) patch.title = post.title
  if (post.image && (!l.images?.length || l.images[0] !== post.image)) patch.images = [post.image, ...(l.images || []).slice(1)]
  if (post.price) {
    if (l.deal === 'rent') {
      const r = rentPartsOf(post.price)
      if (r?.deposit && r.deposit !== l.price) patch.price = r.deposit
      if (r?.monthly && r.monthly !== l.rentMonthly) patch.rentMonthly = r.monthly
    } else {
      const v = parseFaNum(post.price)
      if (v > 0 && v !== l.price) patch.price = v
    }
  }
  if (!Object.keys(patch).length) return
  try { await updateListing(owner, l.id, patch as never) } catch {}
  if (l.publicId) {
    try {
      const { updateItem } = await import('./scraper-store')
      const pub: Record<string, unknown> = {}
      if (post.title) pub.title = post.title
      if (post.price) pub.price = post.price
      if (post.image) pub.image = post.image
      await updateItem(l.publicId, pub as never)
    } catch { /* نسخهٔ عمومی اختیاری است */ }
  }
}

async function importClusterTokens(owner: string, tokens: string[], sourceId: string, opts193?: { deadline?: number; onEach?: () => void; fetchPost?: any; shouldStop?: () => Promise<boolean>; posts?: { token: string; title?: string; price?: string; image?: string }[] }): Promise<{ live: number; sold: number; aborted?: boolean; stopped?: boolean }> {
  const liveIds = new Set<string>()
  // فاز ۱۹۶ج (فیدبک: «تعدادِ آگهی‌ها هی می‌رود از اول») — واردهٔ تازه «پیش‌محاسبه» و آنی skip می‌شود:
  // یک خواندنِ store به‌جای ۲۰۰ خواندنِ تک‌تک؛ شمارنده در چند ثانیه به نقطهٔ ازسرگیری می‌پرد و
  // فقط باقی‌مانده واقعاً از دیوار گرفته می‌شود. (فیکسِ atِ فاز ۱۹۶ تازگی را تضمین می‌کند.)
  // اسکرپِ افزایشی: آگهی‌ای که از قبل داریم دوباره از دیوار گرفته نمی‌شود.
  // با ۲۰ ساعتِ قبلی، هر سینکِ شبانه همان ۲۵۰ آگهیِ تکراری را کامل دانلود می‌کرد و
  // ۴۵ دقیقه طول می‌کشید؛ نتیجه‌اش این بود که هر آژانس هفته‌ای یک‌بار هم نوبتش نمی‌رسید.
  // فهرستِ پروفایل (یک درخواست) خودش می‌گوید کدام آگهی هنوز هست؛ نبودنش = فروخته/اجاره‌رفته.
  // پس فقط آگهیِ «تازه» جزئیات می‌خواهد. توکنِ ردشده همچنان در liveIds می‌ماند، پس
  // مهرِ فروش دست‌نخورده کار می‌کند.
  const FRESH_MS = Math.max(1, Number(process.env.ROSTER_FRESH_H) || 168) * 3600_000
  const dvPre = getDivar(owner)
  const advPre = await getAdvisor(owner)
  const listingIdsPre = new Set((advPre.listings || []).map(l => l.id))
  const postByToken = new Map((opts193?.posts || []).map(x => [x.token, x]))
  const listingById = new Map((advPre.listings || []).map(l => [l.id, l]))
  const freshByToken = new Map(dvPre.imports.filter(i => i.at && Date.now() - i.at < FRESH_MS && listingIdsPre.has(i.listingId)).map(i => [i.token, i.listingId]))
  // فاز ۲۵۸ — واکشیِ موازی (استخرِ N کارگر) به‌جای تک‌تک. علتِ کندیِ فاجعه‌بار (~۲۸ث/آگهی):
  // حلقه پشتِ‌سرِهم بود و backoffِ rate-limitِ دیوار تا ۳۰ث بالا می‌رفت. fetchDivarPost بیرونِ
  // قفلِ store است (advisor-divar-import خط ۵۱)، پس چند واکشیِ هم‌زمان واقعاً موازی‌اند. backoffِ
  // «مشترک» می‌ماند: اگر دیوار محدود کند همهٔ کارگرها پله‌پله کند می‌شوند؛ سالم که بود چند برابر سریع‌تر.
  // ROSTER_CONCURRENCY (env) پیش‌فرض ۳ — اگر دیوار بلاک کرد کمش کن، اگر جا داشت زیادش کن.
  const CONC = Math.max(1, Math.min(8, Number(process.env.ROSTER_CONCURRENCY) || 3))
  let slowStreak193 = 0   // فاز ۱۹۷ب — سرعتِ تطبیقیِ مشترک در برابرِ rate-limit دیوار
  let cursor = 0
  let abortedAll = false, stoppedAll = false
  const worker = async () => {
    while (true) {
      if (abortedAll) return
      const myIdx = cursor++; if (myIdx >= tokens.length) return
      const token = tokens[myIdx]
      const freshId = freshByToken.get(token)
      if (freshId) {
        liveIds.add(freshId)
        const bp = postByToken.get(token), lg = listingById.get(freshId)
        if (bp && lg) await refreshFromBrandPost(owner, lg as never, bp)
        try { opts193?.onEach?.() } catch {}
        continue
      }
      // فاز ۱۹۳ — بودجهٔ زمانیِ ران: از سقف گذشت → توقفِ تمیز (دادهٔ ناقص، ادامهٔ خودکار)
      if (opts193?.deadline && Date.now() > opts193.deadline) { abortedAll = true; return }
      if (opts193?.shouldStop && await opts193.shouldStop()) { abortedAll = true; stoppedAll = true; return }
      try {
        // مالکِ موقتِ رُستر: آگهی وارد می‌شود ولی عمومی نمی‌شود تا کاربر ساخته شود (graduate).
        const t0 = Date.now()
        const res = await Promise.race([
          importDivarToken(owner, token, undefined, sourceId, { publish: false, skipFreshMs: FRESH_MS, fetchPost: opts193?.fetchPost }),
          new Promise<{ ok: false; reason: string }>(r => setTimeout(() => r({ ok: false, reason: 'timeout 2min — رد شد' }), 120_000)),   // فاز ۱۹۵
        ])
        const ms = Date.now() - t0
        if (ms > 30_000 || !res.ok) console.log(`[roster] token=${token} ms=${ms} ok=${res.ok}${!res.ok && 'reason' in res ? ' reason=' + String((res as any).reason).slice(0, 80) : ''}`)
        // موفقِ سریع → کاهشِ تدریجیِ استرِیک (نه صفرِ ناگهانی) تا نوسانِ backoff کم شود
        if (!res.ok || ms > 20_000) slowStreak193 = Math.min(slowStreak193 + 1, 5)
        else slowStreak193 = Math.max(0, slowStreak193 - 1)
        // pace به‌ازای هر کارگر؛ چون CONC کارگر موازی داریم، فاصلهٔ مؤثر ~CONC برابر کمتر است.
        const pace = slowStreak193 === 0 ? 250 : [1_500, 4_000, 8_000, 15_000, 25_000][slowStreak193 - 1]
        if (slowStreak193 >= 2) console.log(`[roster] divar کند/محدود — فاصلهٔ درخواست‌ها ${Math.round(pace / 1000)}ث شد`)
        if (res.ok && 'listing' in res && res.listing) liveIds.add(res.listing.id)
        if (!(res.ok && 'skipped' in res && res.skipped)) await sleep(pace)
      } catch (e) { console.log(`[roster] token=${token} threw: ${String((e as Error)?.message || e).slice(0, 80)}`); await sleep(2_000) }
      try { opts193?.onEach?.() } catch {}
    }
  }
  await Promise.all(Array.from({ length: CONC }, () => worker()))
  if (abortedAll) return { live: liveIds.size, sold: 0, aborted: true, stopped: stoppedAll }
  console.log(`[roster] finalize cluster owner=${owner}: live=${liveIds.size}`)
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
export async function syncRoster(id: string, onProgress?: (done: number, total: number) => void, opts196?: { budgetMs?: number; f?: { profileTokens?: any; post?: any; ai?: any }; fetchPost?: any }): Promise<{ ok: boolean; error?: string; advisors: number; total: number; unnamed: number }> {
  // مدل و پیکرهٔ دسته‌بندِ نام را یک‌بار به حافظه بیاور (اگر نبود، بی‌صدا رد می‌شود).
  try { const { primeNameModel } = await import('./roster-name-model'); await primeNameModel() } catch {}
  try { const { loadNer } = await import('./roster-ner'); await loadNer() } catch {}
  const scrape = await getScrape(id)
  if (!scrape) return { ok: false, error: 'اسکرپ یافت نشد', advisors: 0, total: 0, unnamed: 0 }
  // فاز ۱۹۲ (فیدبک: «ده بار زدم، هر بار نیمه‌کاره ماند») — runRequested دیگر در «شروع» پاک نمی‌شود؛
  // فقط پایانِ موفق یا خطای واقعیِ کد پاکش می‌کنند. پس رانی که وسطِ کار کشته شد (pm2 reload/دیپلوی)
  // در تیکِ بعد خودکار و از همان‌جا (RowCache) ادامه می‌یابد — بدونِ کلیکِ دوباره. سقفِ ۸ تلاشِ ناتمام
  // جلوی حلقهٔ بی‌پایانِ خرابیِ تکرارشونده را می‌گیرد.
  console.log(`[roster] pass start id=${id} slug=${scrape.slug} attempt=${(scrape.runAttempts || 0) + 1}`)
  const attempts192 = (scrape.runAttempts || 0) + 1
  if (attempts192 > 8) {
    await patchScrape(id, { running: false, runRequested: false, runAttempts: 0, lastError: 'چند بار پشتِ‌سرِهم ناتمام ماند — لاگِ سرور را ببین و دوباره «همگام‌سازی الان» را بزن' })
    return { ok: false, error: 'تلاش‌های ناتمامِ زیاد', advisors: 0, total: 0, unnamed: 0 }
  }
  await patchScrape(id, { running: true, runStartedAt: Date.now(), lastProgressAt: Date.now(), runAttempts: attempts192, phase: 'scrape', progress: { done: 0, total: 0 }, lastError: '' })
  let done = false
  // ضربانِ زنده‌بودن: هر ۵ ثانیه lastProgressAt را می‌زند. اگر پروسه reload/کیل شود، این تایمر هم می‌میرد
  // و lastProgressAt یخ می‌زند → بعد از STALE_MS درست «مرده» تشخیص داده می‌شود (حتی وسطِ فازِ AI/ایمپورت).
  // فاز ۱۹۶ — چکِ توقفِ throttled (هر ~۴ ثانیه یک خواندنِ store)
  let lastStopCheck = 0, stopFlag = false
  const shouldStop = async () => {
    const now = Date.now()
    if (now - lastStopCheck > 4000) {
      lastStopCheck = now
      // فاز ۱۹۷ب — این چک هرگز نباید پاس را بکشد: خطا/کندیِ گذرایِ store نادیده گرفته می‌شود (پرچمِ قبلی می‌ماند)
      try {
        const sc = await Promise.race([getScrape(id), new Promise<null>(r => setTimeout(() => r(null), 3000))])
        if (sc) stopFlag = sc.stopRequested === true
      } catch { /* خطای گذرای PG → چکِ بعدی */ }
    }
    return stopFlag
  }
  // فاز ۱۹۸ — ضربان دیگر «کور» نیست: فقط تا وقتی کارِ واقعی (ردیف/تکه/توکن) در ۳ دقیقهٔ اخیر جلو رفته می‌زند.
  // قبلاً تایمر حتی وقتی حلقه واقعاً مرده بود هم می‌زد → تشخیصِ stale هرگز فعال نمی‌شد (زامبیِ ۸ساعتهٔ ۵۲۳/۵۲۳).
  let lastWorkAt = Date.now()
  const workTick = () => { lastWorkAt = Date.now() }
  const heartbeat = setInterval(() => { if (Date.now() - lastWorkAt < 3 * 60_000) patchScrape(id, { lastProgressAt: Date.now() }).catch(() => {}) }, 10000)   // فاز ۲۵۸: ۱۰ث (بود ۵ث) — با ۳ سینکِ هم‌زمان، نوشتِ کمتر روی بلوکِ رُستر
  try {
    // پیشرفتِ زنده (throttleشده تا هر ۳ ثانیه یک نوشت) + heartbeatِ lastProgressAt تا سینکِ زنده «مرده» علامت نخورد.
    let lastWrite = 0
    const prog = (d: number, t: number) => {
      workTick()
      try { onProgress?.(d, t) } catch {}
      const now = Date.now()
      if (d === t || now - lastWrite > 8000) { lastWrite = now; patchScrape(id, { progress: { done: d, total: t }, lastProgressAt: now }).catch(() => {}) }   // فاز ۲۵۸: ۸ث (بود ۳ث)
    }
    // ازسرگیری: کشِ آگهی‌های قبلاً اسکرپ‌شده را بارگذاری کن؛ آگهی‌های تازه را افزوده و throttleشده ذخیره کن.
    const rowCache: RowCache = await loadRowCache(id)
    // فاز ۱۹۸ (مقیاسِ ۱۰۰۰ آژانس) — کش «دائمی» است: سینکِ روزانه فقط توکن‌های جدید را از دیوار می‌گیرد.
    // تازه‌سازیِ چرخشی: در هر ران حداکثر ۳۰ ردیفِ کهنه‌تر از ۱۴ روز حذف می‌شوند تا دوباره گرفته شوند.
    const REFRESH_AGE = 14 * 864e5
    const staleRows = Object.entries(rowCache).filter(([, v]) => !v.at || Date.now() - (v.at || 0) > REFRESH_AGE).slice(0, 30)
    for (const [k] of staleRows) delete rowCache[k]
    if (staleRows.length) console.log(`[roster] incremental: refreshing ${staleRows.length} stale rows`)
    let lastCacheWrite = 0
    const onRow = (token: string, r: { title: string; desc: string; name?: string }) => {
      if (!r.desc) return   // متنِ خالی را کش نکن تا دفعهٔ بعد دوباره گرفته شود (خودترمیمی)
      rowCache[token] = { ...rowCache[token], ...r, at: rowCache[token]?.at && !('title' in r && r.title) ? rowCache[token].at : Date.now() }   // فاز ۱۹۶/۱۹۸: نامِ AI روی همان رکورد + مهرِ زمان
      const now = Date.now()
      if (now - lastCacheWrite > 5000) { lastCacheWrite = now; saveRowCache(id, rowCache).catch(() => {}) }
    }
    // فاز ۱۹۴ — فازِ شناساییِ نام‌ها (AI) هم پیشرفتِ دیدنی دارد
    const onCluster = (d: number, t: number) => { workTick(); patchScrape(id, { phase: 'cluster', progress: { done: d, total: t }, lastProgressAt: Date.now() }).catch(() => {}) }
    // فاز ۲۷۹ — مشاورهای دارای حساب «سنجاق» می‌شوند: در ادغامِ نامِ کوتاه/بلند همیشه میزبان
    // می‌مانند تا کلیدشان عوض نشود؛ وگرنه در همین سینک «غایب» حساب و فایل‌هایشان پاک می‌شد.
    const pinnedKeys = (scrape.advisors || []).filter(a => a.phone).map(a => a.key)
    const roster = await buildAgencyRoster(scrape.slug, { useAI: scrape.useAI, onProgress: prog, cached: rowCache, onRow, onCluster, pinnedKeys, f: opts196?.f, shouldStop })
    // فاز ۱۹۶ — flushِ نهاییِ کشِ ازسرگیری: ذخیرهٔ throttled (هر ۵ث) دُمِ کش (و نام‌های AI) را جا می‌گذاشت
    // → پاسِ بعد دوباره از دیوار می‌خواند و AI را دوباره می‌پرسید. (خودِ تستِ شبیه‌سازی این را گرفت.)
    await saveRowCache(id, rowCache).catch(() => {})
    // فاز ۱۹۶ب — پیشرفتِ واقعی شمارندهٔ تلاش را می‌بخشد: رسیدن به این‌جا یعنی اسکرپ+AI کامل شد؛
    // کیلِ دیپلوی وسطِ ایمپورت نباید به سمتِ «چند بار ناتمام ماند» بشمارد (فیدبک: give-up الکی).
    if (roster.ok) await patchScrape(id, { runAttempts: 0 })
    console.log(`[roster] scrape+AI done: rows=${roster.scanned} advisors=${roster.advisors.length} unnamed=${roster.unnamed.tokens.length}`)
    if (!roster.ok) { done = true; const stopped = /متوقف/.test(roster.error || ''); await patchScrape(id, { running: false, runRequested: false, runAttempts: 0, stopRequested: false, lastRun: Date.now(), lastError: stopped ? 'با دکمهٔ توقف متوقف شد' : (roster.error || 'خطا در خوشه‌بندی') }); return { ok: false, error: roster.error, advisors: 0, total: 0, unnamed: 0 } }

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
    // فاز ۲۷۸ — ownerِ موقتِ رکوردِ هرس‌شده باید «تخلیه» شود، نه فقط فراموش.
    // ریشهٔ یتیمی: رکورد از فهرست حذف می‌شد ولی آگهی‌هایش زیرِ ownerِ موقت می‌ماندند و هیچ‌کس
    // دیگر سراغشان نمی‌رفت. روی سرورِ زنده هزاران ردیف این‌طور جا مانده بود
    // (`advisor:adv:pQRgYEXa:لوکیشن` = ۵۷۰ فایل) — لاشهٔ خوشه‌های آشغالِ پیش از فاز ۲۷۵.
    const orphaned: string[] = []
    for (let i = recs.length - 1; i >= 0; i--) {
      if (!freshByKey.has(recs[i].key) && !recs[i].phone && !recs[i].graduating) { orphaned.push(recs[i].owner); recs.splice(i, 1) }
    }
    if (orphaned.length) console.log(`[roster] pruning ${orphaned.length} stale clusters (freeing their listings)`)

    // owner→tokens: هر مشاور آگهی‌های خودش؛ رکوردهای قدیمیِ غایب → توکنِ خالی (همه‌شان «رفته»)؛ آژانس → بی‌نام‌ها.
    const jobs: { rec?: RosterAdvisor; owner: string; tokens: string[]; posts?: any[] }[] = []
    for (const rec of recs) { const f = freshByKey.get(rec.key); jobs.push({ rec, owner: rec.owner, tokens: f ? f.tokens : [], posts: f ? f.posts : [] }) }
    jobs.push({ owner: scrape.agencyOwner, tokens: roster.unnamed.tokens, posts: roster.unnamed.posts })
    // خوشه‌های هرس‌شده با فهرستِ توکنِ خالی از همان مسیرِ آشنا تخلیه می‌شوند (کدِ تازه‌ای لازم نیست).
    for (const o of orphaned) jobs.push({ owner: o, tokens: [] })

    // فاز ۱۹۳ — پیشرفتِ فازِ ایمپورت هم دیده می‌شود (قبلاً UI روی «N/N» یخ می‌زد و هنگ به نظر می‌رسید)
    const totalTokens193 = jobs.reduce((a, j) => a + j.tokens.length, 0)
    let done193 = 0, lastImpWrite = 0
    const impTick = () => {
      workTick()
      done193++
      if (done193 % 20 === 0 || done193 === totalTokens193) console.log(`[roster] import ${done193}/${totalTokens193}`)
      const now = Date.now()
      if (done193 === totalTokens193 || now - lastImpWrite > 8000) { lastImpWrite = now; patchScrape(id, { phase: 'import', progress: { done: done193, total: totalTokens193 }, lastProgressAt: now }).catch(() => {}) }   // فاز ۲۵۸: ۸ث (بود ۳ث)
    }
    await patchScrape(id, { phase: 'import', progress: { done: 0, total: totalTokens193 } })
    const deadline193 = Date.now() + (opts196?.budgetMs ?? 45 * 60_000)   // بودجهٔ زمانیِ هر ران؛ ادامه در رانِ بعد (خودکار، فاز ۱۹۲)
    let budgetHit = false
    for (const j of jobs) {
      const r = await importClusterTokens(j.owner, j.tokens, scrape.id, { deadline: deadline193, onEach: impTick, fetchPost: opts196?.fetchPost, shouldStop, posts: j.posts })
      if (j.rec) j.rec.listingCount = r.live
      if (r.aborted) { budgetHit = true; break }
    }
    if (budgetHit) {
      done = true
      const wasStopped = stopFlag || (await getScrape(id))?.stopRequested === true
      await mutate(db => {
        const s2 = db.scrapes[id]; if (!s2) return
        s2.advisors = recs; s2.running = false
        if (wasStopped) { s2.runRequested = false; s2.stopRequested = false; s2.runAttempts = 0; s2.lastError = 'با دکمهٔ توقف متوقف شد' }
        else s2.lastError = 'بودجهٔ زمانیِ این ران تمام شد — ادامه خودکار در چند لحظهٔ دیگر'
      })
      console.log(`[roster] pass end (${wasStopped ? 'stopped' : 'budget'}) imported=${done193}/${totalTokens193}`)
      return { ok: false, error: wasStopped ? 'متوقف شد' : 'بودجهٔ زمانی — ادامه خودکار', advisors: recs.length, total: roster.total, unnamed: roster.unnamed.tokens.length }
    }

    await mutate(db => {
      const s = db.scrapes[id]; if (!s) return
      s.advisors = recs; s.agencyName = roster.agencyName || s.agencyName
      s.running = false; s.runRequested = false; s.runAttempts = 0; s.stopRequested = false; s.lastRun = Date.now(); s.lastError = ''
      s.lastTotal = roster.total; s.lastUnnamed = roster.unnamed.tokens.length
      s.unnamedTokens = roster.unnamed.tokens.slice(0, 100)
    })
    console.log(`[roster] pass end OK: advisors=${recs.length} total=${roster.total} unnamed=${roster.unnamed.tokens.length}`)
    // فاز ۱۹۸ — کش دیگر پاک نمی‌شود (اینکرمنتال): فقط توکن‌هایی که دیگر در پروفایلِ دیوار نیستند هرس می‌شوند.
    // سینکِ بعدی = فهرستِ پروفایل + فقط آگهی‌های جدید + ≤۳۰ تازه‌سازیِ چرخشی → دقیقه‌ای، نه ساعتی.
    const currentTokens = new Set<string>([...roster.advisors.flatMap(a => a.tokens), ...roster.unnamed.tokens])
    for (const k of Object.keys(rowCache)) if (!currentTokens.has(k)) delete rowCache[k]
    await saveRowCache(id, rowCache).catch(() => {})
    console.log(`[roster] incremental cache kept ${Object.keys(rowCache).length} rows`)
    done = true
    return { ok: true, advisors: recs.length, total: roster.total, unnamed: roster.unnamed.tokens.length }
  } catch (e: any) {
    done = true
    const msg = String(e?.message || e || 'خطای داخلی')
    // فاز ۱۹۷ب — پاسِ مرده دیگر «بی‌صدا» نیست و خطای گذرای زیرساخت (PG/شبکه) درخواست را نمی‌بندد:
    // مثلِ کیل رفتار می‌شود و رانِ بعدیِ کرون خودکار از همان‌جا ادامه می‌دهد.
    const transient = /timeout|connect|ECONN|pool|terminat|socket/i.test(msg)
    console.error(`[roster] pass FAILED (${transient ? 'transient — ادامهٔ خودکار' : 'fatal'}): ${msg.slice(0, 200)}`)
    await patchScrape(id, transient
      ? { running: false, lastRun: Date.now(), lastError: 'خطای گذرای زیرساخت — ادامهٔ خودکار در چند لحظه' }
      : { running: false, runRequested: false, runAttempts: 0, lastRun: Date.now(), lastError: msg })
    return { ok: false, error: msg, advisors: 0, total: 0, unnamed: 0 }
  } finally {
    clearInterval(heartbeat)
    // تضمین: اگر جایی زودتر return شد یا خطای ناگرفته رخ داد، running قفل نماند.
    if (!done) { try { await patchScrape(id, { running: false, lastError: 'همگام‌سازی ناتمام ماند' }) } catch {} }
  }
}

// انتقالِ آگهی‌های یک ownerِ موقت به یک ownerِ نهایی (شماره) — با استفاده از توابعِ موجود (public item درست ساخته می‌شود).
// «انتشارِ دسته‌ای» (CLAUDE.md): قبلاً هر فایلِ فعال یک publishListing جدا می‌خورد و هر
// کدام روی PG یک فول‌اسکنِ جدولِ listings بود (~۵ث/فایل). حالا فایل‌های فعال در چانک‌های
// ~۱۵تایی جمع و با publishListingsBatch (یک mutateِ اسکرپر برای هر چانک، همان منطقِ
// prev/twin/remoderate per-item) منتشر می‌شوند. کپی/حذفِ per-file اتمی (فاز ۲۷۷) دست نخورد.
async function reassignListings(fromO: string, toO: string, sourceId: string): Promise<number> {
  const from = await getAdvisor(fromO)
  const moved: { oldId: string; newId: string }[] = []
  const t0 = Date.now()
  // فایل‌های در انتظارِ انتشارِ دسته‌ای: {fid: شناسهٔ فایلِ مقصد، prevEnrichId: publicIdِ قبلی برای کپیِ غنی‌سازی}
  const pending: { fid: string; prevEnrichId?: string }[] = []
  const flush = async () => {
    if (!pending.length) return
    const chunk = pending.splice(0, pending.length)
    const rs = await publishListingsBatch(toO, chunk.map(x => x.fid))
    for (const r of rs) {
      // فاز ۲۷۷ («فایل‌ها را ده بار می‌گیرد؛ باید یک‌بار بگیرد و نگه دارد») — غنی‌سازیِ آگهیِ
      // قبلی (گالری/تحلیل/دسترسی‌ها) روی شناسهٔ عمومیِ جدید کپی می‌شود، پس warmEnrichment
      // آن را «غنی» می‌بیند و هیچ درخواستِ تازه‌ای به دیوار نمی‌زند. قبلاً هر انتقال — و هر
      // تلاشِ دوبارهٔ صف — همهٔ فایل‌ها را دوباره از دیوار می‌گرفت: هم کند، هم خوردن به
      // سقفِ ضدِاسکرپِ دیوار.
      const prevId = chunk.find(x => x.fid === r.fid)?.prevEnrichId
      const prev = prevId ? getEnrichment(prevId) : null
      if (prev) patchEnrichment(r.publicId, prev)
      warmEnrichment(r.publicId)
    }
  }
  // ── مسیرِ ترمیم (پنجرهٔ کرشِ انتشارِ معوق): فایلی که در تلاشِ قبلی copy+delete شد ولی
  // چانکش publish نشد، این‌جا با «فعال + بدونِ publicId + رکوردِ ایمپورتِ همین sourceId»
  // شناسایی و به اولین چانک اضافه می‌شود (بدونِ prevEnrichId — فقط warmEnrichment).
  const impIdsTo = new Set(getDivar(toO).imports.filter(i => i.sourceId === sourceId).map(i => i.listingId))
  for (const l of (await getAdvisor(toO)).listings) {
    // فاز ۲۸۴ (یافتهٔ بازبین): unpublishedAt یعنی مشاور «عمداً» از انتشار درآورده — ترمیم نکن.
    if (l.status === 'active' && !l.publicId && !l.unpublishedAt && impIdsTo.has(l.id)) pending.push({ fid: l.id })
  }
  // فاز ۲۷۷ — انتقال «per-فایل اتمی» شد: کپی، سپس بلافاصله حذفِ مبدأ.
  // قبلاً همهٔ کپی‌ها انجام می‌شد و حذفِ مبدأ *در پایان*. اگر کار وسطِ راه می‌مرد (ری‌لودِ
  // دیپلوی، یا claimِ دوبارهٔ صف بعد از ۱۰ دقیقه)، مبدأ دست‌نخورده می‌ماند و تلاشِ بعدی
  // همان فایل‌ها را **دوباره** کپی می‌کرد → آگهیِ تکراری روی حسابِ مشاور. کامنتِ فاز ۱۹۹
  // ادعای ایدمپوتنت‌بودن داشت ولی این حلقه آن را نقض می‌کرد.
  // حالا هر فایل که منتقل شد از مبدأ می‌رود؛ پس ازسرگیری فقط باقی‌مانده‌ها را می‌برد.
  const items = [...from.listings]   // اسنپ‌شات: داخلِ حلقه از مبدأ حذف می‌کنیم
  // رکوردهای ایمپورتِ مبدأ به تفکیکِ listingId — برای انتقالِ per-file (لازمهٔ مسیرِ ترمیمِ بالا)
  const impsByOld = new Map<string, ReturnType<typeof getDivar>['imports']>()
  for (const im of getDivar(fromO).imports.filter(i => i.sourceId === sourceId)) {
    const arr = impsByOld.get(im.listingId) || []; arr.push(im); impsByOld.set(im.listingId, arr)
  }
  console.log(`[roster] reassign start from=${fromO} → ${toO} files=${items.length}`)
  for (let i = 0; i < items.length; i++) {
    const l = items[i]
    const tf = Date.now()
    const { id: _id, publicId: _p, ...fields } = l as Listing & { publicId?: string }
    const nl = await addListing(toO, fields)
    // حالا که به کاربرِ واقعی رسید: هر آگهیِ فعال عمومی و با AI تحلیل می‌شود (چیزی که هنگامِ
    // مالکِ موقت عمداً انجام نشد). آگهیِ فروخته/اجاره‌رفته عمومی نمی‌شود.
    if (l.status !== 'active') await setListingStatus(toO, nl.id, l.status)
    else pending.push({ fid: nl.id, prevEnrichId: _p })
    moved.push({ oldId: l.id, newId: nl.id })
    // رکوردِ ایمپورتِ همین فایل «همین‌جا» منتقل می‌شود (recordImport بر اساسِ token جایگزین
    // می‌کند — ایدمپوتنت)؛ وگرنه فایلِ copy+deleteشده که چانکش publish نشده بعدِ کرش با
    // sourceId قابلِ‌شناسایی نبود و برای همیشه بدونِ publicId می‌ماند.
    for (const im of impsByOld.get(l.id) || []) recordImport(toO, { ...im, listingId: nl.id })
    try { await deleteListing(fromO, l.id) } catch {}   // ← اتمی: مبدأ همین‌جا آزاد می‌شود
    if (pending.length >= 15) await flush()   // یک mutateِ اسکرپر برای هر ~۱۵ فایل
    const ms = Date.now() - tf
    if (ms > 3000 || (i + 1) % 5 === 0 || i === items.length - 1) console.log(`[roster] reassign ${i + 1}/${items.length} (${ms}ms)`)
  }
  await flush()   // flushِ پایانی: باقی‌ماندهٔ چانک + فایل‌های مسیرِ ترمیم
  // انتقالِ رکوردهای ایمپورت (توکن→listingId جدید) تا آپدیتِ بعدی همان فایل‌ها را بشناسد.
  for (const im of getDivar(fromO).imports.filter(i => i.sourceId === sourceId)) {
    const m = moved.find(x => x.oldId === im.listingId)
    recordImport(toO, { ...im, listingId: m ? m.newId : im.listingId })
  }
  clearImports(fromO)
  console.log(`[roster] reassign done files=${moved.length} totalMs=${Date.now() - t0}`)
  return moved.length
}

// ── graduate: به یک مشاورِ کشف‌شده شمارهٔ موبایل بده → حسابِ واقعی بساز و آگهی‌ها را منتقل کن ──
export async function graduateAdvisor(id: string, key: string, phone: string, role = 'advisor'): Promise<{ ok: boolean; error?: string; moved?: number }> {
  const p = String(phone).replace(FA_DIGITS, faDigit).replace(/\D/g, '')
  // مسیرِ graduate همیشه پشتِ گاردِ سوپرادمین/staff است ⇒ ثابت (۰۲۱xxxxxxxx) هم مجاز؛ پیامکی هم نمی‌فرستد.
  if (!/^0\d{10}$/.test(p)) return { ok: false, error: 'شمارهٔ معتبر نیست (موبایل ۰۹… یا ثابت با کدِ شهر)' }
  const scrape = await getScrape(id)
  if (!scrape) return { ok: false, error: 'اسکرپ یافت نشد' }
  const isAgency = key === '__agency__'
  const rec = isAgency ? null : scrape.advisors.find(r => r.key === key)
  if (!isAgency && !rec) return { ok: false, error: 'مشاور یافت نشد' }
  const name = isAgency ? scrape.agencyName : rec!.name
  // اگر انتقالِ قبلی نیمه‌کاره مانده، مبدأ همان ownerِ موقتِ ذخیره‌شده است نه شمارهٔ تازه‌نشسته.
  const fromOwner = isAgency ? scrape.agencyOwner : (rec!.transferFrom || rec!.owner)
  if (fromOwner === p) return { ok: false, error: 'این شماره از قبل تنظیم شده' }

  if (!accountExists(p)) {
    // فاز ۱۹۸ (فیدبک: «حساب ساخته شد ولی نقشِ مشاور املاک را نداد») — شناسهٔ نقش در role-store تصادفی است؛
    // رشتهٔ ثابتِ 'advisor' هیچ نقشی نبود. نقشِ واقعی با داشبورد پیدا می‌شود: مشاور=/pros، آژانس=/agency.
    let roleId = ''
    try {
      const { listRoles } = await import('./role-store')
      const roles = listRoles()
      const wantDash = isAgency || role === 'agency' ? '/agency' : '/pros'
      roleId = roles.find(r => r.dashboard === wantDash && r.active)?.id || ''
    } catch {}
    const cr = createAccount(p, { name, role: roleId || undefined })
    if (!cr.ok) return { ok: false, error: cr.error }
    console.log(`[roster] graduate: account created phone=${p} name=${name} role=${roleId || '(نقش پیدا نشد!)'}`)
  }
  try { await updateAdvisorProfile(p, { name, phone: p, agency: scrape.agencyName }) } catch {}

  // فاز ۲۷۷ (فیدبک: «ساخت حساب باید کمتر از ۱ ثانیه باشد») — حساب همین‌جا «تمام‌شده» ثبت می‌شود.
  // قبلاً رکورد فقط *بعد از* انتقالِ همهٔ فایل‌ها به‌روز می‌شد، پس پنل ساعت‌ها «در حال ساخت حساب»
  // نشان می‌داد در حالی که حساب از ثانیهٔ اول ساخته شده بود. انتقالِ فایل‌ها کارِ پس‌زمینه است.
  // `transferFrom` مبدأ را نگه می‌دارد تا اگر انتقال نیمه‌کاره ماند، تلاشِ بعدی بداند از کجا
  // ادامه دهد (وگرنه owner دیگر شماره است و مبدأ برای همیشه گم می‌شد).
  await mutate(db => {
    const s = db.scrapes[id]; if (!s) return
    if (isAgency) { s.agencyOwner = p; s.agencyPhone = p }
    else {
      const r = s.advisors.find(x => x.key === key)
      if (r) { if (!r.transferFrom) r.transferFrom = fromOwner; r.owner = p; r.phone = p; r.graduatedAt = Date.now() }
    }
  })

  const moved = await reassignListings(fromOwner, p, scrape.id)
  await mutate(db => {
    const s = db.scrapes[id]; if (!s) return
    const r = s.advisors.find(x => x.key === key)
    if (r) { r.graduating = false; delete r.transferFrom }   // انتقال تمام شد
  })
  // یادگیریِ ماشین: تأییدِ ادمین قوی‌ترین سیگنال است → این نام برای همیشه یاد گرفته می‌شود.
  if (!isAgency && name) { try { const { learnName } = await import('./agency-roster-ml'); await learnName(name, 'admin') } catch {} }
  return { ok: true, moved }
}

// ── حذفِ دستیِ یک مشاور از رُستر (برای اسم‌های خراب یا حسابِ حذف‌شده) ──
// فقط رکوردِ رُستر را برمی‌دارد؛ حساب/فایل‌های واقعی (اگر graduate شده) دست‌نخورده می‌مانند.
export async function removeAdvisor(id: string, key: string): Promise<{ ok: boolean; error?: string }> {
  // نامِ مشاور را پیش از حذف برمی‌داریم تا به ماشین «فراموشی» یاد بدهیم (بازخوردِ منفی).
  const badName = await mutate(db => {
    const s = db.scrapes[id]; if (!s) return null
    return s.advisors.find(a => a.key === key)?.name || ''
  })
  const r = await mutate(db => {
    const s = db.scrapes[id]; if (!s) return { ok: false, error: 'اسکرپ یافت نشد' }
    const before = s.advisors.length
    s.advisors = s.advisors.filter(a => a.key !== key)
    if (db.graduateQueue) db.graduateQueue = db.graduateQueue.filter(j => !(j.id === id && j.key === key))
    return s.advisors.length < before ? { ok: true } : { ok: false, error: 'مشاور یافت نشد' }
  })
  // یادگیریِ منفی: حذفِ دستیِ ادمین یعنی «این اسم خراب بود» → از واژه‌نامه پاک و «منفی» علامت می‌شود
  // تا دیگر تشخیص داده نشود (فاز ۲۷۴ — بستنِ حلقهٔ بازخورد؛ forgetName قبلاً هرگز صدا زده نمی‌شد).
  if (r.ok && badName) { try { const { forgetName } = await import('./agency-roster-ml'); await forgetName(badName) } catch {} }
  return r
}

// ── جارویِ ترمیمِ انتشارِ یتیم ────────────────────────────────────────────────
// فایلِ فعالِ بدونِ publicId یعنی انتقال انجام شده ولی چانکِ انتشار نیمه‌کاره مانده
// (کیل شدنِ اینستنس وسطِ flush). مسیرِ ترمیمِ داخلِ reassignListings فقط با graduateِ
// دوباره فعال می‌شود، و آن هم برای مشاورِ دارای حساب مسدود است — پس این فایل‌ها هیچ
// راهِ برگشتی نداشتند. ۲۹ اوت ۲۰۲۶: ۲۸۳۶ فایل در ۱۹۴ حساب این‌طور یتیم مانده بود.
// unpublishedAt رعایت می‌شود: آنچه مشاور عمداً از انتشار درآورده دوباره منتشر نمی‌شود.
// مکان‌نمای چرخشی تا یک حسابِ پرفایل بقیه را گرسنه نگذارد.
let _orphanCursor = 0
export async function repairOrphanPublishes(limit = 10): Promise<number> {
  const scrapes = await listScrapes()
  // وقتی سینکِ رُستر در جریان است کنار می‌کشیم — همان قاعده‌ای که جارویِ غنی‌سازی
  // در فاز ۱۹۵ گرفت. هر دو از یک استخرِ اتصال می‌خورند و هم‌زمانی‌شان اشباعش می‌کند:
  // شبِ ۳۰ اوت ۵۷ پاسِ رُستر با «timeout exceeded when trying to connect» شکست خورد.
  if (scrapes.some(s => s.running)) return 0
  const phones: string[] = []
  for (const s of scrapes) for (const r of (s.advisors || [])) if (r.phone) phones.push(r.phone)
  if (!phones.length) return 0
  for (let n = 0; n < phones.length; n++) {
    const p = phones[(_orphanCursor + n) % phones.length]
    const ids = ((await getAdvisor(p)).listings || [])
      .filter(l => l.status === 'active' && !l.publicId && !l.unpublishedAt)
      .slice(0, limit).map(l => l.id)
    if (!ids.length) continue
    _orphanCursor = (_orphanCursor + n + 1) % phones.length
    try {
      const done = await publishListingsBatch(p, ids)
      console.log(`[roster] orphan-publish phone=${p} n=${done.length}`)
      return done.length
    } catch (e) {
      console.log(`[roster] orphan-publish failed phone=${p}: ${String((e as Error).message).slice(0, 80)}`)
      return 0
    }
  }
  _orphanCursor = 0
  return 0
}

// ── صفِ «ساختِ حساب» (graduate) — سبک روی درخواستِ ادمین، سنگین روی اینستنسِ ۰ ──
// اعتبارسنجی فوری است؛ انتقالِ فایل‌ها (که برای مشاورِ پرفایل چند دقیقه طول می‌کشد و با سینکِ
// در حالِ اجرا رقابت می‌کند) به صفِ اینستنسِ ۰ می‌رود تا درخواست ۶۰ثانیه‌ای تایم‌اوت نشود.
export async function enqueueGraduate(id: string, key: string, phone: string, role = 'advisor'): Promise<{ ok: boolean; error?: string; queued?: boolean }> {
  const p = String(phone).replace(FA_DIGITS, faDigit).replace(/\D/g, '')
  // هم‌قاعده با graduateAdvisor: مسیرِ ادمین ⇒ ثابت هم پذیرفته می‌شود (پیامکی در کار نیست).
  if (!/^0\d{10}$/.test(p)) return { ok: false, error: 'شمارهٔ معتبر نیست (موبایل ۰۹… یا ثابت با کدِ شهر)' }
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
  // فاز ۱۹۹ (فیدبک: «"در حال ساخت حساب" برای همیشه می‌ماند ولی حساب ساخته شده») — ریشه: کار «قبل از انجام»
  // از صف برداشته می‌شد؛ کیلِ وسطِ کار (دیپلوی/reload) = کارِ گم‌شده و پرچمِ ابدی. حالا at-least-once:
  // کار claim می‌شود (startedAt) و فقط بعدِ اتمام حذف؛ claimِ رهاشده (>۱۰د) دوباره برداشته می‌شود —
  // graduateAdvisor هم ایدمپوتنت است (حسابِ موجود دوباره ساخته نمی‌شود، فایل‌های باقی‌مانده منتقل می‌شوند).
  const job = await mutate(db => {
    const q = db.graduateQueue || []
    const now = Date.now()
    const j = q.find(x => !x.startedAt || now - x.startedAt > 10 * 60_000)
    if (j) j.startedAt = now
    return j ? { ...j } : null
  })
  if (!job) return { ran: false }
  // فاز ۲۷۷ — ضربانِ claim: مهلتِ ۱۰ دقیقه بینِ «کارِ مرده» و «کارِ زندهٔ کُند» فرق نمی‌گذاشت،
  // پس انتقالِ طولانی دوباره برداشته می‌شد در حالی که هنوز در حالِ اجرا بود (دو اجرای هم‌زمان
  // روی یک مشاور). حالا تا وقتی زنده است هر ۲ دقیقه startedAt تازه می‌شود؛ فقط کاری که واقعاً
  // مرده (ری‌لود/کیل) مهلتش تمام می‌شود و از سر گرفته می‌شود.
  const beat = setInterval(() => {
    mutate(db => { const j = (db.graduateQueue || []).find(x => x.jid === job.jid); if (j) j.startedAt = Date.now() }).catch(() => {})
  }, 2 * 60_000)
  try {
    console.log(`[roster] graduate job start key=${job.key} phone=${job.phone}`)
    const t0 = Date.now()
    const r = await graduateAdvisor(job.id, job.key, job.phone, job.role)
    console.log(`[roster] graduate job end ok=${r.ok} moved=${r.moved ?? 0} ms=${Date.now() - t0}${r.error ? ' err=' + r.error : ''}`)
    await mutate(db => { db.graduateQueue = (db.graduateQueue || []).filter(x => x.jid !== job.jid) })   // فاز ۱۹۹: حذف فقط بعدِ اتمام
    if (!r.ok) {
      // رکوردِ مشاور را از حالتِ «در حالِ ساخت» درآور و خطا را ثبت کن.
      await mutate(db => { const s = db.scrapes[job.id]; if (s) { const rec = s.advisors.find(a => a.key === job.key); if (rec) { rec.graduating = false } s.lastError = `ساختِ حساب ناموفق: ${r.error || 'خطا'}` } })
    }
    return { ran: true, ok: r.ok, error: r.error }
  } catch (e: any) {
    // فاز ۱۹۹: خطای گذرا (شبکه/PG) → کار در صف می‌ماند (claim بعدِ ۱۰د آزاد و دوباره تلاش)؛ خطای قطعی → حذف + پیام
    const msg = String(e?.message || e || 'خطا')
    const transient = /timeout|connect|ECONN|pool|terminat|socket/i.test(msg)
    console.error(`[roster] graduate job ${transient ? 'transient-fail (retry later)' : 'FAILED'}: ${msg.slice(0, 150)}`)
    if (!transient) {
      await mutate(db => {
        db.graduateQueue = (db.graduateQueue || []).filter(x => x.jid !== job.jid)
        const s = db.scrapes[job.id]; if (s) { const rec = s.advisors.find(a => a.key === job.key); if (rec) rec.graduating = false; s.lastError = `ساختِ حساب ناموفق: ${msg}` }
      })
    }
    return { ran: true, ok: false, error: msg }
  } finally { clearInterval(beat) }
}
export async function hasGraduateJobs(): Promise<boolean> { return ((await load()).graduateQueue || []).length > 0 }

// ── یکتاییِ شماره و ویرایشِ مشاور (۲۱ آگوست) ────────────────────────────────
// چرا لازم شد: `graduateAdvisor` وقتی شماره از قبل حساب داشت، بی‌هیچ هشداری همان
// حساب را برمی‌داشت. نتیجه: «لطفی» و «مهران خسروی» هر دو 09380857896 گرفتند و
// فایل‌های دو نفر زیرِ یک حساب رفت. ۱۷ مورد از ۲۰۸ تخصیص این‌طور بود.
//
// ولی مسدودکردنِ کاملِ تکرار هم غلط است: ۱۲ مورد از آن ۱۷ تا مشروع بودند —
// یک نفر با دو صورتِ نام («زارع پور» و «رسول زارع پور»). پس معیار از خودِ نام می‌آید.

/** یک نفرند اگر توکن‌های نامِ کوتاه‌تر زیرمجموعهٔ نامِ بلندتر باشد. */
export function nameCompatible(a: string, b: string): boolean {
  const T = (s: string) => new Set(String(s || '').replace(/\u200c/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک')
    .split(/\s+/).map(x => x.trim()).filter(Boolean))
  const A = T(a), B = T(b)
  if (!A.size || !B.size) return false
  const small = A.size <= B.size ? A : B, big = A.size <= B.size ? B : A
  for (const t of small) if (!big.has(t)) return false
  return true
}

export interface PhoneConflict { id: string; slug: string; key: string; name: string }

/** آیا این شماره به مشاورِ دیگری با نامِ ناسازگار تعلق دارد؟ */
export async function phoneConflict(phone: string, exceptId: string, exceptKey: string): Promise<PhoneConflict | null> {
  const p = String(phone).replace(/[۰-۹٠-٩]/g, d => String(d.charCodeAt(0) >= 0x06f0 ? d.charCodeAt(0) - 0x06f0 : d.charCodeAt(0) - 0x0660)).replace(/\D/g, '')
  if (!p) return null
  const self = (await getScrape(exceptId))?.advisors.find(a => a.key === exceptKey)?.name || ''
  for (const sc of await listScrapes()) {
    const full = await getScrape(sc.id)
    for (const a of (full?.advisors || [])) {
      if (!a.phone || String(a.phone) !== p) continue
      if (sc.id === exceptId && a.key === exceptKey) continue
      if (self && nameCompatible(self, a.name)) continue      // همان شخص با نامِ کوتاه/کامل
      return { id: sc.id, slug: sc.slug || sc.id, key: a.key, name: a.name }
    }
  }
  return null
}

/** گزارشِ همهٔ تعارض‌های موجود، با تفکیکِ «مشروع» و «خطا». */
export async function phoneConflicts(): Promise<{ phone: string; legit: boolean; who: PhoneConflict[] }[]> {
  const by = new Map<string, PhoneConflict[]>()
  for (const sc of await listScrapes()) {
    const full = await getScrape(sc.id)
    for (const a of (full?.advisors || [])) {
      if (!a.phone) continue
      const k = String(a.phone)
      const g = by.get(k) || []; g.push({ id: sc.id, slug: sc.slug || sc.id, key: a.key, name: a.name }); by.set(k, g)
    }
  }
  const out: { phone: string; legit: boolean; who: PhoneConflict[] }[] = []
  for (const [phone, who] of by) {
    if (who.length < 2) continue
    const legit = who.every((x, i) => i === 0 || nameCompatible(who[0].name, x.name))
    out.push({ phone, legit, who })
  }
  return out.sort((a, b) => Number(a.legit) - Number(b.legit))
}

/** ویرایشِ مشاور بدونِ حذف‌وساخت — حذف سابقهٔ فایل‌ها را از بین می‌برد. */
export async function editAdvisor(id: string, key: string, patch: { name?: string; phone?: string }): Promise<{ ok: boolean; error?: string; moved?: number }> {
  const scrape = await getScrape(id)
  if (!scrape) return { ok: false, error: 'اسکرپ یافت نشد' }
  const rec = scrape.advisors.find(a => a.key === key)
  if (!rec) return { ok: false, error: 'مشاور یافت نشد' }

  let newPhone: string | undefined
  if (patch.phone != null) {
    newPhone = String(patch.phone).replace(/[۰-۹٠-٩]/g, d => String(d.charCodeAt(0) >= 0x06f0 ? d.charCodeAt(0) - 0x06f0 : d.charCodeAt(0) - 0x0660)).replace(/\D/g, '')
    if (newPhone && !/^0\d{10}$/.test(newPhone)) return { ok: false, error: 'شمارهٔ معتبر نیست (۱۱ رقم، با ۰ شروع شود)' }
  }
  const oldPhone = rec.phone || ''
  let moved = 0
  if (newPhone !== undefined && oldPhone && newPhone !== oldPhone) {
    try {
      const { reassignListingOwnerPhone } = await import('./scraper-store')
      moved = await reassignListingOwnerPhone(oldPhone, newPhone || rec.owner)
    } catch { /* انتقالِ مالکیت اختیاری است */ }
  }
  const advisors = scrape.advisors.map(a => a.key !== key ? a : {
    ...a,
    name: patch.name != null && patch.name.trim() ? patch.name.trim() : a.name,
    phone: newPhone !== undefined ? (newPhone || undefined) : a.phone,
    owner: newPhone ? newPhone : a.owner,
  })
  await patchScrape(id, { advisors } as any)
  if (newPhone) {
    try { await updateAdvisorProfile(newPhone, { name: patch.name || rec.name, phone: newPhone, agency: scrape.agencyName }) } catch {}
  }
  return { ok: true, moved }
}
