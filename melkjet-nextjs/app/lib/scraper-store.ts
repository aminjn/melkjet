import { join } from 'path'
import { randomBytes } from 'crypto'
import { readJsonCached, writeJsonCached } from './json-file'
import { pgEnabled, kvGet, pgTx, pgListingsAll } from './db'
// موتورِ خالصِ هم‌ملک‌یابیِ ویژگی‌محور (متن+مشخصات+لوکیشن) — گِیتِ ضدتکراریِ همهٔ ورودی‌ها
import { fieldsOf as simFieldsOf, TwinIndex, norm as simNorm } from './listing-similarity'
import { FA_DIGITS, faDigit } from '../lib/digits'
import { resolveScrapedLocation } from './geo-store'

const DATA_FILE = join(process.cwd(), '.scraper-data.json')
const KV_KEY = 'scraper'          // بلابِ قدیمی — بعد از migration دست‌نخورده به‌عنوان بکاپِ rollback می‌ماند
const KV_META = 'scraper_meta'    // متادیتای کوچکِ زنده (sources/categories/owners) پس از نرمال‌سازی

// Top-level content type → which public page it feeds
export type SourceType = 'listing' | 'directory' | 'product' | 'article' | 'price'
export type Method = 'auto' | 'jsonld' | 'og' | 'rss' | 'css' | 'divar'
export type ItemStatus = 'pending' | 'approved' | 'duplicate' | 'rejected'

// Field-level extraction rule (used when method === 'css')
export type FieldKey = 'title' | 'price' | 'location' | 'image' | 'url' | 'phone' | 'excerpt'
export interface FieldRule {
  key: FieldKey
  selector: string   // CSS selector relative to the item container
  attr: string       // 'text' | 'href' | 'src' | any attribute name
}

// Directory sub-categories (used when type === 'directory')
export const DIRECTORY_CATEGORIES = [
  'مشاور', 'آژانس', 'سازنده', 'مصالح', 'معمار', 'پیمانکار', 'کارشناس', 'حقوقی', 'بانک', 'دفترخانه',
] as const

export interface Source {
  id: string
  name: string
  url: string
  type: SourceType
  category?: string          // for directory sources
  method: Method
  enabled: boolean
  schedule: string           // 'manual' | 'hourly' | '6h' | 'daily'
  // Detailed CSS extraction config (method === 'css')
  container?: string         // selector for each item/card on the page
  fields?: FieldRule[]       // per-field selectors inside the container
  meta?: Record<string, string>  // fixed values merged into every item (شهر، محله، نوع آگهی، تخصص…)
  pages?: number             // تعداد صفحات برای واکشی چندصفحه‌ای (هر سایت). از {page} در URL یا ?page=N استفاده می‌شود
  useProxy?: boolean         // واکشی از طریق پروکسی سرور (برای سایت‌های فیلتر/خارج از دسترس مستقیم)
  lastRun: number | null
  lastCount: number
  status: 'idle' | 'ok' | 'error'
  lastError?: string
}

export interface Item {
  id: string
  sourceId: string
  sourceName: string
  type: SourceType
  category?: string
  title: string
  price?: string
  location?: string
  image?: string
  url?: string
  excerpt?: string
  phone?: string
  owner?: string                  // نام آگهی‌دهنده / آژانس
  ownerId?: string                // شناسهٔ کاربرِ آگهی‌دهنده (برای جلوگیری از تکرار)
  rating?: string
  tags?: string[]
  meta?: Record<string, string>   // شهر، محله، نوع آگهی، تخصص …
  featured?: boolean
  edited?: boolean
  aiReason?: string               // علت تأیید/رد توسط هوش مصنوعی
  aiScore?: number                // امتیاز کیفیت/اعتبار ۰-۱۰۰
  moderatedAt?: number
  scrapedAt: number
  /** اولین باری که این فایل دیده شد. برخلافِ scrapedAt در هر به‌روزرسانی ریست نمی‌شود،
   *  پس تنها مبنای درستِ «تازگی» و «رَوندِ قیمت» است. */
  firstSeenAt?: number
  status: ItemStatus
  expiresAt?: number              // آگهی‌های کاربر ۳۰ روزه‌اند و منقضی می‌شوند
}
export const LISTING_TTL = 30 * 24 * 3600 * 1000   // ۳۰ روز
export function isExpired(it: Item, now = Date.now()): boolean { return !!it.expiresAt && it.expiresAt < now }

// Fields an admin may edit on a stored item
export type EditableItem = Partial<Pick<Item, 'title' | 'price' | 'location' | 'image' | 'url' | 'excerpt' | 'phone' | 'category' | 'status' | 'featured'>>

export interface Owner { id: string; name: string; phone?: string; count: number; firstSeen: number }
interface DB { sources: Source[]; items: Item[]; categories?: string[]; owners?: Owner[] }

function normName(s: string): string { return (s || '').replace(/‌/g, '').replace(/\s+/g, ' ').trim() }

export async function listOwners(): Promise<Owner[]> {
  return [...((await load()).owners || [])].sort((a, b) => b.count - a.count)
}

export async function updateOwner(ownerId: string, patch: { name?: string; phone?: string }) {
  return mutate(db => {
    const o = (db.owners || []).find(x => x.id === ownerId)
    if (!o) return null
    if (patch.name !== undefined) o.name = String(patch.name)
    if (patch.phone !== undefined) {
      o.phone = String(patch.phone)
      // propagate the phone to all of this owner's items
      db.items.forEach(it => { if (it.ownerId === ownerId) it.phone = o.phone })
    }
    return o
  })
}

export async function deleteOwner(ownerId: string) {
  return mutate(db => { db.owners = (db.owners || []).filter(x => x.id !== ownerId) })
}

function id() { return randomBytes(6).toString('hex') }

const DEFAULT_CATEGORIES = [
  'مشاور', 'آژانس', 'سازنده', 'مصالح', 'معمار', 'پیمانکار', 'کارشناس',
  'حقوقی', 'وکیل', 'بیمه', 'بانک', 'دفترخانه', 'سردفتر', 'ارزیاب',
]

const DEFAULT_SOURCES: Source[] = [
  { id: id(), name: 'اخبار املاک - ایسنا', url: 'https://www.isna.ir/rss/tp/45', type: 'article', method: 'rss', enabled: true, schedule: 'daily', lastRun: null, lastCount: 0, status: 'idle' },
]

function emptyDB(): DB { return { sources: DEFAULT_SOURCES, items: [] } }

function fileLoad(): DB {
  return readJsonCached<DB>(DATA_FILE, emptyDB())
}
function fileSave(db: DB) {
  writeJsonCached(DATA_FILE, db, true)
}

// کشِ کوتاهِ خواندن روی مسیرِ PG: صفحهٔ خانه/جستجو در هر رندر listItems را صدا می‌زند؛
// بدونِ این کش هر رندر یک SELECT + دی‌سریالایزِ ~۱مگابایتی روی CPUِ تک‌هسته می‌شد.
// نوشتن (mutate) کش را باطل می‌کند تا همان اینستنس نوشتهٔ خودش را فوری ببیند. کهنگیِ
// چند-ثانیه‌ایِ فیدِ آگهی بینِ اینستنس‌ها بی‌ضرر است (نوشتن‌ها اتمیک روی PG می‌مانند).
let pgCache: { loadedAt: number; checkedAt: number; data: DB; rev: number } | null = null
// فاز ۲۳۲ (فیدبک: «سرعت فاجعه شده؛ آگهی و اسکرپ زیاد شده») — دو ریشهٔ سنگین در همین کش بود:
// (۱) چکِ rev «در هر فراخوان» انجام می‌شد = یک رفت‌وبرگشتِ DB به‌ازای هر درخواستِ صفحه.
// (۲) در اوجِ اسکرپ، هر ایمپورت rev را عوض می‌کند → هر چند ثانیه کلِ جدول (۱۲هزار+ ردیف)
//     بازخوانی/دی‌سریالایز و همهٔ کش‌های مشتق (derive/فیلتر) باطل می‌شدند — thrashِ دائمی.
// حالا: چکِ rev حداکثر هر REV_CHECK_MS؛ بازخوانیِ کامل حداکثر هر RELOAD_FLOOR_MS (سِروِ stale
// در این پنجره عمدی و بی‌ضرر است). نوشتنِ همین instance همچنان فوری کش را باطل می‌کند (read-your-writes).
const REV_CHECK_MS = 5_000
const RELOAD_FLOOR_MS = 15_000

// ── معماریِ دائمی: آگهی‌ها در جدولِ نرمالِ `listings` (هر ردیف یک آگهی)، متادیتای کوچک
// (sources/categories/owners) در kv['scraper']. خواندن از جدول (کش‌شده)، نوشتن فقط روی
// ردیف‌های تغییرکرده زیرِ قفلِ ردیفِ کوچکِ متادیتا — دیگر بلابِ بزرگ زیرِ قفلِ سراسری بازنویسی
// نمی‌شود. کلِ منطقِ mutate(fn) دست‌نخورده روی همان db در حافظه کار می‌کند.
function metaOf(db: DB) { return { sources: db.sources, categories: db.categories, owners: db.owners || [] } }

// migrationِ خودکارِ غیرمخرب: بلابِ قدیمی (KV_KEY) دست‌نخورده به‌عنوان بکاپِ rollback می‌ماند؛
// آگهی‌ها به جدول کپی می‌شوند و متادیتا در KV_META (کلیدِ جدا) ساخته می‌شود. قفلِ FOR UPDATE
// روی بلابِ قدیمی + بازچکِ KV_META چند instance را سریالایز می‌کند (idempotent، race-safe).
let pgMigrated = false
async function ensureMigrated(): Promise<void> {
  if (!pgEnabled() || pgMigrated) return
  const done = await pgTx(async (c) => {
    const has = await c.query('SELECT 1 FROM kv WHERE key=$1', [KV_META])
    if (has.rows.length) return true   // قبلاً migrate شده
    // قفلِ بلابِ قدیمی برای سریالایز کردنِ migration بینِ instanceها
    await c.query(`INSERT INTO kv(key,data) VALUES($1,'{}'::jsonb) ON CONFLICT(key) DO NOTHING`, [KV_KEY])
    const row = await c.query('SELECT data FROM kv WHERE key=$1 FOR UPDATE', [KV_KEY])
    const again = await c.query('SELECT 1 FROM kv WHERE key=$1', [KV_META])
    if (again.rows.length) return true  // instance دیگری همین‌الان migrate کرد
    const blob = (row.rows[0]?.data || {}) as Partial<DB>
    const items = Array.isArray(blob.items) ? blob.items : []
    const cnt = await c.query('SELECT count(*)::int AS n FROM listings')
    if ((cnt.rows[0].n as number) === 0 && items.length) {
      for (const it of items) {
        await c.query(
          `INSERT INTO listings(id, scraped_at, type, status, data) VALUES($1,$2,$3,$4,$5)
           ON CONFLICT(id) DO UPDATE SET scraped_at=EXCLUDED.scraped_at, type=EXCLUDED.type, status=EXCLUDED.status, data=EXCLUDED.data`,
          [it.id, it.scrapedAt || 0, it.type, it.status, JSON.stringify(it)],
        )
      }
    }
    // متادیتای زنده را در کلیدِ جدا بساز؛ KV_KEY (بلابِ قدیمی) را برای rollback دست نمی‌زنیم.
    await c.query(`INSERT INTO kv(key,data) VALUES($1,$2) ON CONFLICT(key) DO NOTHING`, [KV_META, JSON.stringify(metaOf(blob as DB))])
    return true
  })
  if (done) pgMigrated = true
}

/** خواندنِ سندِ کاملِ اسکرپر (دو-حالته: PG یا فایل).
 * فاز ۲۳۹ — fresh: مسیرهای ادمین/ممیزی از کفِ بازخوانیِ فاز ۲۳۲ معاف‌اند (چکِ revِ همیشگی)؛
 * وگرنه تأییدِ ادمین روی یک اینستنس تا ~۲۰ث در اینستنسِ دیگر دیده نمی‌شد و آگهی «برمی‌گشت» به لیست. */
async function load(fresh = false): Promise<DB> {
  if (!pgEnabled()) return fileLoad()
  const now = Date.now()
  if (pgCache) {
    if (!fresh && now - pgCache.checkedAt < REV_CHECK_MS) return pgCache.data
    if (!fresh && now - pgCache.loadedAt < RELOAD_FLOOR_MS) { pgCache.checkedAt = now; return pgCache.data }
    // فاز ۱۵۶ (B1): اعتبار با revِ سراسری — هر نوشتنی در هر instance کشِ همه را نامعتبر می‌کند
    // (حالا با آهنگِ محدودِ فاز ۲۳۲، نه در هر فراخوان).
    // فاز ۲۴۰: با Redis، چکِ rev یک خواندنِ حافظه‌ایِ ~۰.۲ms است نه کوئریِ PG — مقیاس‌پذیر برای میلیونی.
    try {
      let rev: number | null = null
      try {
        const { redisEnabled, rGet } = await import('./redis')
        if (redisEnabled()) { const s = await rGet('scraper_rev'); if (s !== null) rev = parseInt(s, 10) || 0 }
      } catch { /* fallback به kv */ }
      if (rev === null) { const m = await kvGet<{ __rev?: number }>(KV_META, {}); rev = m.__rev || 0 }
      pgCache.checkedAt = now
      if (rev === pgCache.rev) { pgCache.loadedAt = now; return pgCache.data }
    } catch { return pgCache.data }
  }
  try {
    await ensureMigrated()
    // متادیتای زنده از KV_META؛ اگر هنوز نبود (لحظهٔ گذار)، از بلابِ قدیمی bootstrap کن.
    const [meta, items] = await Promise.all([kvGet<Partial<DB> & { __rev?: number }>(KV_META, {}), pgListingsAll() as Promise<Item[]>])
    const m = (meta.sources || meta.owners || meta.categories) ? meta : await kvGet<Partial<DB>>(KV_KEY, {})
    const data: DB = {
      sources: m.sources && m.sources.length ? m.sources : DEFAULT_SOURCES,
      items,
      categories: m.categories,
      owners: m.owners || [],
    }
    pgCache = { loadedAt: Date.now(), checkedAt: Date.now(), data, rev: meta.__rev || 0 }
    // فاز ۲۴۰ (خودترمیم): بعدِ هر بازخوانیِ کامل، revِ Redis با kv همگام می‌شود (اگر Redis تازه روشن/کهنه بود).
    try { const { redisEnabled, rSetMax } = await import('./redis'); if (redisEnabled()) void rSetMax('scraper_rev', meta.__rev || 0) } catch {}
    return data
  } catch (e) {
    // تاب‌آوری: اگر دیتابیس لحظه‌ای کند/اشباع بود، کشِ کهنه را سِرو کن (نه ۵۰۰/۵۰۴).
    if (pgCache) return pgCache.data
    throw e
  }
}

/** خواندن-تغییر-نوشتنِ اتمیک. روی PG: قفلِ ردیفِ متادیتا + همگام‌سازیِ فقط ردیف‌های تغییرکرده. */
async function mutate<R>(fn: (db: DB) => R): Promise<R> {
  if (!pgEnabled()) { const d = fileLoad(); const r = fn(d); fileSave(d); return r }
  await ensureMigrated()
  let revOut = 0   // فاز ۲۴۰: revِ جدید برای انتشار در Redis (چکِ ارزانِ بین‌اینستنسی)
  const r = await pgTx(async (c) => {
    // سریالایزِ نویسنده‌ها روی ردیفِ کوچکِ متادیتا (KV_META، نه بلابِ بزرگ).
    await c.query(`INSERT INTO kv(key,data) VALUES($1,'{}'::jsonb) ON CONFLICT(key) DO NOTHING`, [KV_META])
    const metaRow = await c.query('SELECT data FROM kv WHERE key=$1 FOR UPDATE', [KV_META])
    const meta = (metaRow.rows[0]?.data || {}) as Partial<DB>
    const itemsRes = await c.query('SELECT data FROM listings ORDER BY scraped_at DESC')
    const items = itemsRes.rows.map(x => x.data as Item)
    const db: DB = {
      sources: meta.sources && meta.sources.length ? meta.sources : DEFAULT_SOURCES.slice(),
      items,
      categories: meta.categories,
      owners: meta.owners || [],
    }
    const before = new Map(items.map(i => [i.id, JSON.stringify(i)]))
    const result = fn(db)
    // متادیتای زنده (کوچک) را در KV_META بنویس؛ بلابِ قدیمیِ KV_KEY دست‌نخورده می‌ماند.
    // فاز ۱۵۶ (B1): rev سراسری با هر نوشتن بالا می‌رود تا کشِ خواندنِ همهٔ instanceها نامعتبر شود.
    const rev156 = ((meta as { __rev?: number }).__rev || 0) + 1
    revOut = rev156
    await c.query(`UPDATE kv SET data=$2, updated_at=now() WHERE key=$1`, [KV_META, JSON.stringify({ ...metaOf(db), __rev: rev156 })])
    // فقط ردیف‌های اضافه‌شده/تغییرکرده را upsert کن
    const afterIds = new Set<string>()
    for (const it of db.items) {
      afterIds.add(it.id)
      const s = JSON.stringify(it)
      if (before.get(it.id) !== s) {
        await c.query(
          `INSERT INTO listings(id, scraped_at, type, status, data) VALUES($1,$2,$3,$4,$5)
           ON CONFLICT(id) DO UPDATE SET scraped_at=EXCLUDED.scraped_at, type=EXCLUDED.type, status=EXCLUDED.status, data=EXCLUDED.data`,
          [it.id, it.scrapedAt || 0, it.type, it.status, s],
        )
      }
    }
    // ردیف‌های حذف‌شده را پاک کن
    const del = [...before.keys()].filter(idv => !afterIds.has(idv))
    if (del.length) await c.query(`DELETE FROM listings WHERE id = ANY($1::text[])`, [del])
    return result
  })
  pgCache = null
  // فاز ۲۴۰: انتشارِ revِ جدید در Redis (best-effort) — چکِ اعتبارِ کشِ بقیهٔ اینستنس‌ها حافظه‌ای می‌شود.
  try { const { redisEnabled, rSetMax } = await import('./redis'); if (redisEnabled() && revOut) void rSetMax('scraper_rev', revOut) } catch {}
  return r
}

/** نوشتنِ هدفمند — فقط ردیف‌هایی که شناسه‌شان داده شده.
 *
 *  چرا لازم است: mutate عمومی برای هر تغییر، حتی یک آگهی، کلِ جدول را می‌خواند
 *  (۳۶٬۱۴۶ ردیف ≈ ۲٫۴ ثانیه) و همه را JSON.stringify می‌کند تا نقشهٔ «قبل» بسازد
 *  (~۱ ثانیهٔ CPU) — و تمامِ این مدت قفلِ FOR UPDATE روی متادیتا را نگه می‌دارد.
 *  روی ماشینِ تک‌هسته‌ای این حلقهٔ رویداد را می‌بندد و بقیهٔ درخواست‌ها با
 *  «timeout exceeded when trying to connect» می‌میرند — ریشهٔ ۱۴۴ پاسِ شکست‌خوردهٔ
 *  رُستر در شبِ ۳۱ اوت ۲۰۲۶. جدولِ نرمال دقیقاً برای همین ساخته شده بود، ولی مسیرِ
 *  نوشتن هنوز مثلِ دورانِ تک‌بلاب رفتار می‌کرد.
 *
 *  fn می‌تواند آیتم‌ها را تغییر دهد یا آیتمِ تازه به آرایه push کند (درج می‌شود).
 *  حذف پشتیبانی نمی‌شود — برای آن از mutate استفاده کنید.
 */
async function mutateSome<R>(ids: string[], fn: (ctx: { items: Item[]; meta: Partial<DB> }) => R): Promise<R> {
  if (!pgEnabled()) {
    const d = fileLoad()
    const sub = d.items.filter(i => ids.includes(i.id))
    const r = fn({ items: sub, meta: d })
    for (const it of sub) if (!d.items.includes(it)) d.items.push(it)
    fileSave(d); return r
  }
  await ensureMigrated()
  let revOut = 0
  const r = await pgTx(async (c) => {
    await c.query(`INSERT INTO kv(key,data) VALUES($1,'{}'::jsonb) ON CONFLICT(key) DO NOTHING`, [KV_META])
    const metaRow = await c.query('SELECT data FROM kv WHERE key=$1 FOR UPDATE', [KV_META])
    const meta = (metaRow.rows[0]?.data || {}) as Partial<DB> & { __rev?: number }
    const res = ids.length ? await c.query('SELECT data FROM listings WHERE id = ANY($1::text[])', [ids]) : { rows: [] as { data: Item }[] }
    const items = res.rows.map(x => x.data as Item)
    const before = new Map(items.map(i => [i.id, JSON.stringify(i)]))
    const result = fn({ items, meta })
    const rev = (meta.__rev || 0) + 1
    revOut = rev
    await c.query(`UPDATE kv SET data=$2, updated_at=now() WHERE key=$1`, [KV_META, JSON.stringify({ ...meta, __rev: rev })])
    for (const it of items) {
      const str = JSON.stringify(it)
      if (before.get(it.id) !== str) {
        await c.query(
          `INSERT INTO listings(id, scraped_at, type, status, data) VALUES($1,$2,$3,$4,$5)
           ON CONFLICT(id) DO UPDATE SET scraped_at=EXCLUDED.scraped_at, type=EXCLUDED.type, status=EXCLUDED.status, data=EXCLUDED.data`,
          [it.id, it.scrapedAt || 0, it.type, it.status, str],
        )
      }
    }
    return result
  })
  pgCache = null
  try { const { redisEnabled, rSetMax } = await import('./redis'); if (redisEnabled() && revOut) void rSetMax('scraper_rev', revOut) } catch {}
  return r
}

export async function listSources(): Promise<Source[]> { return (await load()).sources }

function categoriesOf(db: DB): string[] {
  const fromItems = Array.from(new Set(db.items.filter(i => i.type === 'directory' && i.category).map(i => i.category as string)))
  return Array.from(new Set([...(db.categories || DEFAULT_CATEGORIES), ...fromItems]))
}

export async function listCategories(): Promise<string[]> {
  return categoriesOf(await load())
}

export async function addCategory(name: string): Promise<string[]> {
  return mutate(db => {
    const n = name.trim()
    if (n) {
      const cats = db.categories || DEFAULT_CATEGORIES.slice()
      if (!cats.includes(n)) cats.unshift(n)
      db.categories = cats
    }
    return categoriesOf(db)
  })
}

export async function addSource(input: Omit<Source, 'id' | 'lastRun' | 'lastCount' | 'status'>): Promise<Source> {
  return mutate(db => {
    const src: Source = { ...input, id: id(), lastRun: null, lastCount: 0, status: 'idle' }
    db.sources.unshift(src)
    return src
  })
}

export async function updateSource(sid: string, patch: Partial<Source>): Promise<Source | null> {
  return mutate(db => {
    const s = db.sources.find(x => x.id === sid)
    if (!s) return null
    Object.assign(s, patch)
    return s
  })
}

export async function deleteSource(sid: string) {
  return mutate(db => {
    db.sources = db.sources.filter(x => x.id !== sid)
    db.items = db.items.filter(x => x.sourceId !== sid)
  })
}

function buildList(db: DB, type?: SourceType, opts?: { category?: string; publicOnly?: boolean }): Item[] {
  let items = type ? db.items.filter(i => i.type === type) : [...db.items]
  if (opts?.category) items = items.filter(i => i.category === opts.category)
  if (opts?.publicOnly) { const now = Date.now(); items = items.filter(i => i.status !== 'rejected' && i.status !== 'duplicate' && !isExpired(i, now)) }
  return items.sort((a, b) => b.scrapedAt - a.scrapedAt)
}

export async function listItems(type?: SourceType, opts?: { category?: string; publicOnly?: boolean; fresh?: boolean }): Promise<Item[]> {
  const db = await load(opts?.fresh)
  // کپی (نه ارجاع به آرایهٔ کش‌شده) تا sortِ درجا کشِ مشترک را جابه‌جا نکند.
  return buildList(db, type, opts)
}

// فاز ۲۳۲ — نسخهٔ «مرجع-پایدار»: در یک نسلِ کش (تا نوشتنِ بعدی) همیشه «همان» آرایه را برمی‌گرداند،
// پس کش‌های مشتق (derive/فیلترِ صفحات) با مقایسهٔ مرجع واقعاً hit می‌شوند — قبلاً listItems هر بار
// آرایهٔ نو می‌ساخت و مثلاً کشِ deriveِ نقشه «هرگز» hit نمی‌شد (۱۲هزار regex در هر درخواست).
// قرارداد: خروجی فقط-خواندنی است؛ mutate نکن. در حالتِ فایل (تست/دِو) همان listItems است.
const listMemo = new WeakMap<object, Map<string, Item[]>>()
export async function listItemsStable(type?: SourceType, opts?: { category?: string; publicOnly?: boolean }): Promise<Item[]> {
  if (!pgEnabled()) return listItems(type, opts)
  const db = await load()
  const key = `${type || '*'}|${opts?.category || ''}|${opts?.publicOnly ? 1 : 0}`
  let m = listMemo.get(db)
  if (!m) { m = new Map(); listMemo.set(db, m) }
  const hit = m.get(key)
  if (hit) return hit
  const items = buildList(db, type, opts)
  m.set(key, items)
  return items
}

// Candidate generation (معادلِ Elasticsearch/جستجوی توزیع‌شده در همین استک):
// به‌جای بارگذاریِ همهٔ ردیف‌ها در حافظه و برش در JS، مستقیماً از جدولِ `listings` با SQL و
// LIMIT کاندیدا می‌گیرد (ایندکسِ type + scraped_at). پس با میلیون‌ها آگهی هم مسیرِ رتبه‌بندی
// فقط N کاندیدا را می‌گیرد، نه کلِ جدول. در حالتِ فایل به listItems برمی‌گردد.
/** آگهی‌های یک محل — مستقیم از دیتابیس، بدونِ «پنجرهٔ تازگی».
 *  پیش از این هر مسیرِ محله‌ای candidateListings(500) می‌گرفت و در حافظه فیلتر می‌کرد؛ یعنی
 *  از ۱٬۴۵۹ آگهیِ جنت‌آباد فقط آن‌هایی دیده می‌شدند که در ۵۰۰ تازه‌ترینِ کلِ کشور بودند (۹۲تا).
 *  مشاوری که دنبالِ آگهیِ خودش بود عملا شانسی می‌دید.
 *  loc_norm ستونِ محاسباتیِ نرمال‌شدهٔ جدول است با ایندکسِ GIN trigram (~۱۲ میلی‌ثانیه)،
 *  و count(*) OVER () شمارشِ کل را در همان کوئری می‌دهد — بدونِ رفت‌وبرگشتِ دوم. */
export async function listingsByLoc(needle: string, limit = 60, offset = 0, type: SourceType = 'listing'): Promise<{ items: Item[]; total: number }> {
  if (!pgEnabled() || !needle) return { items: [], total: 0 }
  try {
    const r = await pgTx(c => c.query(
      `SELECT data, count(*) OVER () AS total FROM listings
       WHERE type=$1 AND status NOT IN ('rejected','duplicate') AND loc_norm LIKE '%'||$2||'%'
       ORDER BY scraped_at DESC LIMIT $3 OFFSET $4`, [type, needle, limit, offset]))
    const now = Date.now()
    const total = r.rows.length ? Number(r.rows[0].total) || 0 : 0
    return { items: r.rows.map(x => x.data as Item).filter(i => !isExpired(i, now)), total }
  } catch { return { items: [], total: 0 } }
}

// کشِ کوتاهِ درون‌پروسه‌ای. کوئریِ سهمیه‌بندی یک اسکنِ کامل + window روی ~۲۶ هزار ردیف
// است (برخلافِ کوئریِ قبلی که با ایندکس فقط N ردیف می‌خواند)، و بازی ۲۴ نقطهٔ مصرف دارد.
// روی یک vCPU بدونِ کش این یک پس‌رفت می‌شد. نمونهٔ بزرگ (geo-live با ۱۰۰۰۰) کش نمی‌شود
// تا حافظه بی‌دلیل اشغال نشود.
const CAND_TTL = 60_000
const candCache = new Map<string, { at: number; rows: Item[] }>()

/** نمونهٔ نمایندهٔ آگهی‌ها برای آمار و فرصت‌های بازی.
 *  پیش از این «N تازه‌ترین» بود؛ ولی اسکرپ آژانس‌به‌آژانس کار می‌کند، پس آن پنجره همیشه
 *  مالِ آژانسی است که آخر سینک شده. اندازه‌گیریِ ۷ سپتامبر: از ۸۰۰ تازه‌ترین، ۷۳۲ تا
 *  تهران بود (۹۱٪) و مشهد که ۲۱٪ بازار است فقط ۱۵ تا — یعنی «میانهٔ بازار» عملا میانهٔ
 *  آخرین آژانس بود، و ارزش‌گذاری و اجاره و «ارزان‌ترین فرصت» همه روی همان بنا می‌شد.
 *  حالا سهمیهٔ هر شهر متناسبِ سهمِ واقعی‌اش است، با کفِ حداقل یک: تهران ۵۸۷، مشهد ۱۵۱،
 *  کرج ۷ … . سهمیهٔ *برابر* عمدا انتخاب نشد — هم‌وزن‌کردنِ کیش و تهران میانه را بی‌معنی
 *  می‌کند. هدف نمایندگیِ آماری است، نه تنوعِ تزئینی. */
export async function candidateListings(limit = 500, type: SourceType = 'listing'): Promise<Item[]> {
  const ck = type + '|' + limit
  const cacheable = limit <= 2000
  const hit = cacheable ? candCache.get(ck) : undefined
  if (hit && Date.now() - hit.at < CAND_TTL) { const t = Date.now(); return hit.rows.filter(i => !isExpired(i, t)) }
  if (pgEnabled()) {
    try {
      const r = await pgTx(c => c.query(
        `WITH pool AS (
           SELECT data, scraped_at, split_part(coalesce(loc_norm,''), '،', 1) AS city
           FROM listings WHERE type=$1 AND status NOT IN ('rejected','duplicate')
         ),
         tot AS (SELECT greatest(count(*), 1)::float AS n FROM pool),
         q AS (
           SELECT city, greatest(1, floor(count(*)::float / (SELECT n FROM tot) * $2))::int AS quota
           FROM pool GROUP BY city
         ),
         ranked AS (
           SELECT p.data, p.scraped_at, p.city,
                  row_number() OVER (PARTITION BY p.city ORDER BY p.scraped_at DESC) AS rn
           FROM pool p
         )
         SELECT r.data FROM ranked r JOIN q ON q.city = r.city
         WHERE r.rn <= q.quota
         ORDER BY r.scraped_at DESC`, [type, limit]))
      const now = Date.now()
      const rows = r.rows.map(x => x.data as Item)
      if (cacheable) candCache.set(ck, { at: now, rows })
      return rows.filter(i => !isExpired(i, now))
    } catch { /* اگر جدول/DB آماده نبود → مسیرِ امن */ }
  }
  return (await listItems(type, { publicOnly: true })).slice(0, limit)
}

// Cache first, then one indexed lookup only on a miss.
//
// This was briefly the other way round - a pgTx lookup on every call, with the
// cached scan as the fallback - and that made the whole site slow, not just this
// page. pgTx takes a pool connection and runs BEGIN/SELECT/COMMIT, so each call
// became three round trips against a pool of 15 shared with every other query on
// the instance, and app/listing/[slug]/page.tsx calls this twice per render. Under
// crawler traffic the pool starved and user loading, agency intel and profiles
// slowed with it.
//
// The reason given for that change does not survive measurement either: the
// statement_timeout it was meant to avoid came from a cold cache, and the full
// load is 1.15s against a 110MB table, not the 15s it would need to trip. A warm
// Array.find over ~45k items costs microseconds, so the cache is simply the right
// first stop. The indexed lookup still earns its place for an id newer than the
// cache's reload floor, which is the one case the scan genuinely cannot answer.
export async function getItemById(itemId: string): Promise<Item | null> {
  if (!itemId) return null
  const hit = (await load()).items.find(i => i.id === itemId)
  if (hit) return hit
  if (pgEnabled()) {
    try {
      const r = await pgTx(c => c.query('SELECT data FROM listings WHERE id = $1 LIMIT 1', [itemId]))
      if (r.rows.length) return r.rows[0].data as Item
    } catch { /* cache said no and the lookup failed: treat as absent */ }
  }
  return null
}

// Items awaiting AI moderation (pending, not yet moderated)
export async function pendingForModeration(limit = 25): Promise<Item[]> {
  return (await load()).items.filter(i => i.status === 'pending' && !i.moderatedAt).slice(0, limit)
}

export async function setModeration(itemId: string, status: ItemStatus, reason: string, score: number) {
  // فاز ۲۶۰ — آلارمِ تلگرام باید در هر مسیرِ تأیید شلیک شود (نه فقط ممیزیِ دسته‌ای):
  // ثبتِ آگهی از سایت/تلگرام → moderateOne → setModeration؛ قبلاً این مسیر آلارم نمی‌فرستاد.
  let _tgNew: Item | null = null
  const r = await mutateSome([itemId], ({ items }) => {
    const it = items.find(i => i.id === itemId)
    if (it) {
      const wasApproved = it.status === 'approved'
      it.status = status; it.aiReason = reason; it.aiScore = score; it.moderatedAt = Date.now()
      if (!wasApproved && status === 'approved' && it.type === 'listing') _tgNew = it
    }
  })
  if (_tgNew) import('./telegram-notify').then(m => m.notifyNewListings([_tgNew as Item])).catch(() => {})
  return r
}

// Persist many moderation verdicts in a single atomic write (avoids file races under concurrency).
export async function setModerationBatch(verdicts: { id: string; status: ItemStatus; reason: string; score: number }[], opts?: { onlyPending?: boolean }) {
  if (!verdicts.length) return
  const _tgNew: Item[] = []
  const _r = await mutateSome(verdicts.map(v => v.id), ({ items }) => {
    const now = Date.now()
    const map = new Map(verdicts.map(v => [v.id, v]))
    for (const it of items) {
      const v = map.get(it.id)
      if (!v) continue
      // فاز ۱۵۶ (B2): حکمِ «خودکار» فقط روی آیتمی می‌نشیند که هنوز pending است — اگر ادمین
      // بینِ خواندنِ صف و نوشتنِ دسته‌ای، خودش حکم داده باشد، حکمِ انسانی دست‌نخورده می‌ماند.
      if (opts?.onlyPending && it.status !== 'pending') continue
      const _wasA = it.status === 'approved'
      it.status = v.status; it.aiReason = v.reason; it.aiScore = v.score; it.moderatedAt = now
      if (!_wasA && v.status === 'approved' && it.type === 'listing') _tgNew.push(it)
    }
  })
  if (_tgNew.length) import('./telegram-notify').then(m => m.notifyNewListings(_tgNew)).catch(() => {})
  return _r
}

// فاز ۱۳۸ — بازممیزیِ ردشده‌های «خودکار»: آگهی‌هایی که ماشین/قاعدهٔ قدیمی رد کرده (نه ادمینِ انسانی)
// دوباره به صفِ ممیزی برمی‌گردند تا با قانونِ جدید (رد فقط با مدرکِ قطعیِ تماس) از نو داوری شوند.
// فاز ۱۴۴ (فیدبک: «آگهی‌های درست را تکراری می‌کند»): تکراری‌های خودکار هم برمی‌گردند تا با
// موتورِ جدیدِ شباهت (وتوی طبقه + کفِ شواهد) از نو داوری شوند — تکراریِ واقعی دوباره تکراری می‌شود.
export async function requeueAutoRejected(): Promise<number> {
  return mutate(db => {
    let n = 0
    for (const it of db.items) {
      const autoRej = it.status === 'rejected' && /^ردِ خودکار|ممیزیِ خودکارِ یادگیری/.test(it.aiReason || '')
      const autoDup = it.status === 'duplicate' && /تکراری/.test(it.aiReason || '')
      if (autoRej || autoDup) {
        it.status = 'pending'; it.moderatedAt = undefined
        it.aiReason = autoDup ? 'در صفِ بازممیزی با موتورِ جدیدِ تشخیصِ تکرار' : 'در صفِ بازممیزی با قانونِ جدید (ردِ قبلی خودکار بود)'
        n++
      }
    }
    return n
  })
}

export async function setItemStatus(itemId: string, status: ItemStatus) {
  return mutate(db => {
    const it = db.items.find(i => i.id === itemId)
    if (!it) return
    it.status = status
    // فاز ۱۵۶ (B3): حکمِ دستیِ ادمین باید مثلِ حکمِ AI مهرِ ممیزی بخورد، وگرنه از جدولِ
    // «ممیزی‌شده‌ها» و KPIها غیب می‌شود و به چشمِ ادمین «هیچ اتفاقی نیفتاد».
    if (status === 'approved' || status === 'rejected' || status === 'duplicate') it.moderatedAt = Date.now()
    else if (status === 'pending') it.moderatedAt = undefined
  })
}

export async function updateItem(itemId: string, patch: EditableItem) {
  return mutateSome([itemId], ({ items }) => {
    const it = items.find(i => i.id === itemId)
    if (!it) return null
    const allowed: (keyof EditableItem)[] = ['title', 'price', 'location', 'image', 'url', 'excerpt', 'phone', 'category', 'status', 'featured']
    for (const k of allowed) {
      if (patch[k] !== undefined) (it as any)[k] = patch[k]
    }
    it.edited = true
    return it
  })
}

// فاز ۲۰۱ — مختصاتِ به‌دست‌آمده هنگامِ غنی‌سازی (دیوار) روی خودِ آگهی می‌نشیند تا نقشهٔ جستجو پین‌دار شود.
// فقط اگر آگهی مختصات نداشت (مختصاتِ دستی/مشاور هرگز بازنویسی نمی‌شود).
export async function setItemCoords(itemId: string, lat: number, lng: number) {
  if (!lat || !lng) return
  return mutate(db => {
    const it = db.items.find(i => i.id === itemId)
    if (!it) return
    it.meta = it.meta || {}
    if (Number(it.meta['__lat']) && Number(it.meta['__lng'])) return
    it.meta['__lat'] = String(lat); it.meta['__lng'] = String(lng)
  })
}

// وضعیتِ معاملهٔ آگهیِ عمومی (فروخته‌شده/اجاره‌رفته) روی خودِ آیتم مهر می‌خورد تا در صفحه/کارت‌ها دیده شود.
// status = '' یعنی برگشت به «فعال» (مهر برداشته می‌شود).
export async function setItemDealStatus(itemId: string, status: 'sold' | 'rented' | '') {
  return mutateSome([itemId], ({ items }) => {
    const it = items.find(i => i.id === itemId)
    if (!it) return
    it.meta = it.meta || {}
    // فاز ۱۵۳ — مهرِ زمانِ معامله: بدونِ این، «فروشِ ماهانه/زمانِ فروش» در تحلیلِ بازار
    // هرگز قابلِ‌محاسبهٔ واقعی نیست. فقط بارِ اول ثبت می‌شود (تغییرِ sold↔rented زمان را نمی‌بَرد).
    if (status) { it.meta['__dealStatus'] = status; if (!it.meta['__soldAt']) it.meta['__soldAt'] = String(Date.now()) }
    else { delete it.meta['__dealStatus']; delete it.meta['__soldAt'] }
  })
}

export async function deleteItem(itemId: string) {
  return mutate(db => {
    const n = db.items.length
    db.items = db.items.filter(i => i.id !== itemId)
    return db.items.length < n
  })
}

export async function deleteItems(ids: string[]) {
  return mutate(db => {
    const set = new Set(ids)
    db.items = db.items.filter(i => !set.has(i.id))
  })
}

// Wipe all items, or only one type. Sources are kept.
export async function clearItems(type?: SourceType) {
  return mutate(db => {
    db.items = type ? db.items.filter(i => i.type !== type) : []
  })
}

// Insert items — dedup سه‌لایه:
// ۱) کلیدِ دقیقِ url+title (سریع)  ۲) تطبیقِ محتواییِ ویژگی‌محور (متن+مشخصات+لوکیشن، شباهت≥۰٫۸۵) →
//    آگهیِ بازنشرشدهٔ همان ملک (توکن/عنوانِ جدیدِ دیوار) به‌جای درجِ دوباره، «به‌روزرسانی» می‌شود
//    (قیمت/عکس/توضیح/لینک تازه، حفظِ id/آمار/وضعیت؛ اگر مهرِ فروخته داشت چون دوباره فعال شده برداشته می‌شود).
// Returns {added, dup, updated}
export async function insertItems(source: Source, raw: Omit<Item, 'id' | 'sourceId' | 'sourceName' | 'type' | 'category' | 'meta' | 'scrapedAt' | 'status'>[]): Promise<{ added: number; dup: number; updated: number }> {
  const newListingIds: string[] = []
  const fieldsOf = simFieldsOf
  const res = await mutate(db => {
    // فاز ۱۵۶ (A1): نگاشتِ کلید→آیتم تا اسکرپِ مجددِ «عینِ همان» آگهی، آیتمِ موجود را
    // درجا تازه کند — نه اینکه فقط «تکراری» شمرده شود و ردیف کهنه بماند.
    const existingByKey = new Map<string, Item>()
    for (const i of db.items) existingByKey.set((i.url || '') + '|' + i.title, i)
    // فاز ۱۵۶ (A2): تکراری‌ها هم مبنای هم‌ملک‌یابی‌اند — اسکرپِ تازهٔ همان ملک باید ردیفِ
    // قبلاً-تکراری را «بازپس بگیرد» و به صفِ ممیزی برگرداند، نه اینکه ردیفِ سوم بسازد.
    const twinIdx = new TwinIndex<Item>()
    if (source.type === 'listing') {
      for (const i of db.items) if (i.type === 'listing' && i.status !== 'rejected') twinIdx.add(fieldsOf(i), i)
    }
    // کلیدِ هویتیِ غیرآگهی‌ها (محصول/پروفایل/قیمت/مقاله): نوع + عنوانِ نرمال + مالک (تلفن/نام/منبع)
    const identKey = (i: { type?: string; title?: string; phone?: string; owner?: string; sourceName?: string }) =>
      `${i.type || source.type}|${simNorm(i.title)}|${(i.phone || '').replace(FA_DIGITS, faDigit).replace(/\D/g, '') || simNorm(i.owner) || simNorm(i.sourceName)}`
    const identMap = new Map<string, Item>()
    if (source.type !== 'listing') {
      for (const i of db.items) if (i.type === source.type && i.status !== 'rejected') identMap.set(identKey(i), i)
    }
    let added = 0, dup = 0, updated = 0
    db.owners = db.owners || []
    for (const r of raw) {
      const key = (r.url || '') + '|' + r.title
      const exact = existingByKey.get(key)
      if (exact) {
        // فاز ۱۵۶ (A1): همان آگهی (همان URL+عنوان) دوباره اسکرپ شد → آپدیتِ درجا (نه «تکراری»)
        if (r.price) exact.price = r.price
        if (r.image) exact.image = r.image
        if (r.excerpt) exact.excerpt = r.excerpt
        if (r.phone && !exact.phone) exact.phone = r.phone
        exact.scrapedAt = Date.now()
        if (exact.meta?.['__dealStatus']) { delete exact.meta['__dealStatus']; delete exact.meta['__soldAt'] }
        if (exact.status === 'duplicate') { exact.status = 'pending'; exact.moderatedAt = undefined; exact.aiReason = 'اسکرپِ تازهٔ همان آگهی — بازگشت از تکراری برای ممیزی' }
        updated++
        continue
      }
      // merge source meta (city/neighborhood/type/specialty) into the item
      const meta = source.meta && Object.keys(source.meta).length ? source.meta : undefined
      // Divar's card carries the relative time and the neighbourhood on one line, so
      // an unguarded r.location stored things like «۱۴ساعتپیشدرسلسبیلشمالی» - 616 rows
      // of it, matchable by no neighbourhood filter we have. Resolve against the geo
      // tree here, at the only door this value comes through.
      const loc = (r.location ? resolveScrapedLocation(r.location, meta?.['شهر']) : '')
        || [meta?.['شهر'], meta?.['محله']].filter(Boolean).join('، ')
        || undefined
      // ── گِیتِ محتوایی: همان ملک با URL/عنوانِ جدید؟ → آپدیتِ آیتمِ موجود، نه درجِ تکراری ──
      if (source.type === 'listing') {
        const f = fieldsOf({ title: r.title, price: r.price, location: loc, meta: { ...(meta || {}), ...((r as { meta?: Record<string, string> }).meta || {}) } })
        const twin = twinIdx.find(f)
        if (twin) {
          if (r.price) twin.price = r.price
          if (r.image) twin.image = r.image
          if (r.excerpt) twin.excerpt = r.excerpt
          if (r.url) twin.url = r.url
          if (r.phone && !twin.phone) twin.phone = r.phone
          twin.scrapedAt = Date.now()
          // بازنشر = ملک هنوز فعال است → مهرِ فروخته/اجاره‌رفتهٔ قبلی برداشته می‌شود
          if (twin.meta?.['__dealStatus']) { delete twin.meta['__dealStatus']; delete twin.meta['__soldAt'] }
          // فاز ۱۵۶ (A2): ردیفِ قبلاً-تکراری با اسکرپِ تازه بازپس گرفته می‌شود → صفِ ممیزی
          if (twin.status === 'duplicate') { twin.status = 'pending'; twin.moderatedAt = undefined; twin.aiReason = 'اسکرپِ تازهٔ همان ملک — بازگشت از تکراری برای ممیزی' }
          updated++
          continue
        }
      } else {
        // ── غیرآگهی (محصول/پروفایل/قیمت/مقاله): همان کالا/موجودیت از همان مالک → آپدیت، نه تکرار ──
        const twin = identMap.get(identKey({ ...r, type: source.type, sourceName: source.name }))
        if (twin) {
          if (r.price) twin.price = r.price
          if (r.image) twin.image = r.image
          if (r.excerpt) twin.excerpt = r.excerpt
          if (r.url) twin.url = r.url
          twin.scrapedAt = Date.now()
          updated++
          continue
        }
      }
      // owner dedup: one user per advertiser (by phone, else by name)
      let ownerId: string | undefined
      if (r.owner || r.phone) {
        const pn = r.phone ? r.phone.replace(FA_DIGITS, faDigit).replace(/\D/g, '') : ''
        const nn = normName(r.owner || '')
        let owner = db.owners.find(o => (pn && o.phone && o.phone.replace(FA_DIGITS, faDigit).replace(/\D/g, '') === pn) || (!pn && nn && normName(o.name) === nn))
        if (!owner) {
          owner = { id: id(), name: r.owner || 'نامشخص', phone: r.phone, count: 0, firstSeen: Date.now() }
          db.owners.push(owner)
        }
        if (r.phone && !owner.phone) owner.phone = r.phone
        owner.count++
        ownerId = owner.id
      }
      const newId = id()
      const item: Item = {
        id: newId, sourceId: source.id, sourceName: source.name, type: source.type,
        category: source.category, meta, scrapedAt: Date.now(), status: 'pending',
        ...r, location: loc, ownerId, firstSeenAt: Date.now(),
      }
      db.items.unshift(item)
      existingByKey.set(key, item)
      if (source.type === 'listing') { newListingIds.push(newId); twinIdx.add(fieldsOf(item), item) }
      else identMap.set(identKey(item), item)
      added++
    }
    // no item cap
    const s = db.sources.find(x => x.id === source.id)
    if (s) { s.lastRun = Date.now(); s.lastCount = added; s.status = 'ok'; s.lastError = undefined }
    return { added, dup, updated }
  })
  // تحلیلِ AI هر آگهیِ جدید همین حالا (هنگامِ اسکرپ) در پس‌زمینه ساخته و در دیتابیس ذخیره می‌شود،
  // تا بازکردنِ آگهی توسطِ کاربر دیگر AI را دوباره اجرا نکند. (import پویا برای پرهیز از حلقهٔ وابستگی.)
  if (newListingIds.length) import('./enrich-warm').then(m => m.warmMany(newListingIds)).catch(() => {})
  return res
}

// آیا این آگهیِ ورودی «هم‌ملکِ» یکی از آگهی‌های قابلِ‌نمایشِ موجود است؟
// گِیتِ عمومیِ همهٔ درهای ورود (ثبتِ کاربر، ساختِ دستیِ ادمین، انتشارِ پنل‌ها) — موتورِ ویژگی‌محور.
export async function findPublicListingTwin(probe: { title?: string; price?: string; location?: string; meta?: Record<string, string> }): Promise<Item | null> {
  const idx = new TwinIndex<Item>()
  for (const i of (await load()).items) {
    if (i.type !== 'listing' || i.status === 'duplicate' || i.status === 'rejected') continue
    idx.add(simFieldsOf(i), i)
  }
  return idx.find(simFieldsOf(probe))
}

// شکلِ ورودیِ مشترکِ ثبت/به‌روزرسانیِ آگهیِ کاربر (همان shapeِ همیشگی — فقط نام‌گذاری شد).
export type UserListingRaw = {
  title: string; price?: string; location?: string; image?: string; excerpt?: string;
  phone?: string; owner?: string; url?: string; meta?: Record<string, string>
}

// ایندکسِ هم‌ملک‌یابیِ آگهی‌های قابلِ‌نمایش روی همین db (همان predicateِ همیشگی:
// listing و نه duplicate/rejected — منقضی‌ها عمداً داخل‌اند، مثلِ رفتارِ قبلی).
function buildUserTwinIndex(db: DB): TwinIndex<Item> {
  const idx = new TwinIndex<Item>()
  for (const i of db.items) if (i.type === 'listing' && i.status !== 'duplicate' && i.status !== 'rejected') idx.add(simFieldsOf(i), i)
  return idx
}

// ── هستهٔ درون-تراکنشیِ ثبتِ آگهیِ کاربر (انتشارِ دسته‌ای) ─────────────────────────
// دقیقاً همان بدنهٔ addUserListing؛ فقط sync و روی db، تا هم مسیرِ تکی و هم دسته‌ای
// «یک» منطق داشته باشند (هم‌رفتاری by construction، نه دو کپی). twinIdx از بیرون
// می‌آید تا در دسته یک‌بار ساخته شود (تکی: همان buildUserTwinIndex روی همین db).
function addUserListingCore(db: DB, raw: UserListingRaw, twinIdx: TwinIndex<Item>): Item {
  db.owners = db.owners || []
  let ownerId: string | undefined
  if (raw.owner || raw.phone) {
    const pn = raw.phone ? raw.phone.replace(FA_DIGITS, faDigit).replace(/\D/g, '') : ''
    const nn = normName(raw.owner || '')
    let owner = db.owners.find(o => (pn && o.phone && o.phone.replace(FA_DIGITS, faDigit).replace(/\D/g, '') === pn) || (!pn && nn && normName(o.name) === nn))
    if (!owner) { owner = { id: id(), name: raw.owner || 'کاربر', phone: raw.phone, count: 0, firstSeen: Date.now() }; db.owners.push(owner) }
    if (raw.phone && !owner.phone) owner.phone = raw.phone
    owner.count++; ownerId = owner.id
  }
  // هم‌ملک‌یابیِ درجا (داخلِ همان تراکنش — بدونِ race با درج‌های هم‌زمان)
  const probeF = simFieldsOf({ title: raw.title, price: raw.price, location: raw.location, meta: raw.meta })
  const twin = twinIdx.find(probeF)
  const item: Item = {
    id: id(), sourceId: 'user', sourceName: 'ثبت توسط کاربر', type: 'listing',
    title: raw.title, price: raw.price, location: raw.location, image: raw.image,
    excerpt: raw.excerpt, phone: raw.phone, owner: raw.owner, url: raw.url, ownerId,
    meta: raw.meta && Object.keys(raw.meta).length ? raw.meta : undefined,
    // firstSeenAt فقط وقتی «حالا» است که فایل واقعاً تازه باشد. مسیرِ انتشار تاریخِ
    // ثبتِ اصلی را پاس می‌دهد. (تبدیلِ نوعِ محلی چون UserListingRaw این فیلد را اعلام نکرده.)
    scrapedAt: Date.now(), firstSeenAt: (raw as { firstSeenAt?: number }).firstSeenAt || Date.now(),
    status: twin ? 'duplicate' : 'pending',
    aiReason: twin ? `تکراری در لحظهٔ ثبت — هم‌ملکِ «${twin.title.slice(0, 60)}»` : undefined,
    expiresAt: Date.now() + LISTING_TTL,
  }
  db.items.unshift(item)
  return item
}

// Insert a single user-submitted listing (status pending → goes to AI moderation immediately).
// گِیتِ ضدتکراری در لحظهٔ ثبت: اگر هم‌ملکِ آگهیِ موجود باشد، با وضعیتِ «duplicate» ساخته می‌شود
// (هرگز عمومی نمی‌شود) و علتش برای ادمین ثبت است — نه اینکه نسخهٔ دوم واردِ سایت شود.
export function addUserListing(raw: UserListingRaw): Promise<Item> {
  return mutate(db => addUserListingCore(db, raw, buildUserTwinIndex(db)))
}
// فاز ۱۴۰ (فیدبک: «تأیید می‌کنم دوباره خودش برمی‌گردد») — به‌روزرسانیِ «درجای» آگهیِ عمومیِ کاربر.
// بازانتشار قبلاً حذف+ساختِ دوباره بود → هر سینکِ دیوار حکمِ ممیزی (تأیید/ردِ دستیِ ادمین) را پاک می‌کرد.
// حالا فیلدها درجا آپدیت می‌شوند و حکم می‌ماند؛ فقط اگر متنِ ممیزی‌شونده عوض شده باشد (remoderate)
// دوباره به صفِ ممیزی می‌رود. وضعیتِ duplicate دست نمی‌خورد.
// هستهٔ درون-تراکنشی — دقیقاً بدنهٔ قبلیِ updateUserListing (ازجمله «آپدیت‌نشدنِ url»
// که عمدی/تاریخی است، حفظِ __soldAt، و remoderate فقط وقتی status!=='duplicate').
function updateUserListingCore(db: DB, itemId: string, raw: UserListingRaw, opts?: { remoderate?: boolean }): Item | null {
  const it = db.items.find(i => i.id === itemId && i.type === 'listing')
  if (!it) return null
  it.title = raw.title; it.price = raw.price; it.location = raw.location; it.image = raw.image
  it.excerpt = raw.excerpt; it.phone = raw.phone; it.owner = raw.owner
  // فاز ۱۵۳: مهرِ زمانِ معامله (__soldAt) نباید با بازنشرِ آگهی گم شود — تنها منبعِ «زمانِ فروش» است
  const soldAt153 = it.meta?.['__soldAt']
  it.meta = raw.meta && Object.keys(raw.meta).length ? raw.meta : undefined
  if (soldAt153 && it.meta && it.meta['__dealStatus'] && !it.meta['__soldAt']) it.meta['__soldAt'] = soldAt153
  it.scrapedAt = Date.now(); it.expiresAt = Date.now() + LISTING_TTL
  if (opts?.remoderate && it.status !== 'duplicate') {
    it.status = 'pending'; it.moderatedAt = undefined; it.aiScore = undefined
    it.aiReason = 'متنِ آگهی تغییر کرد — در صفِ ممیزیِ دوباره'
  }
  return it
}
export async function updateUserListing(itemId: string, raw: UserListingRaw, opts?: { remoderate?: boolean }): Promise<Item | null> {
  return mutate(db => updateUserListingCore(db, itemId, raw, opts))
}

// ── انتشارِ دسته‌ای (CLAUDE.md «انتشارِ دسته‌ای») ────────────────────────────────
// ریشهٔ کندی: هر mutate روی PG یک فول‌اسکنِ جدولِ listings + ~۲×۲۸هزار stringify است؛
// N انتشارِ تکی = N فول‌اسکن. این‌جا هر چانک (~۱۵ درخواست) در «یک» mutate می‌نشیند و
// درونش دقیقاً همان هسته‌ها/همان منطقِ publishListing per-item اجرا می‌شود:
//   prevId موجود → آپدیتِ درجا (remoderate فقط با تغییرِ متنِ ممیزی‌شونده)؛
//   publicId شکسته → هم‌ملک‌یابی و بازپس‌گیری (فاز ۱۵۶A4)؛ وگرنه درجِ نو با گِیتِ ضدتکراری.
// ایندکسِ هم‌ملک‌یابی یک‌بار در ابتدای چانک ساخته می‌شود و آیتم‌های درج/آپدیت‌شده به آن
// افزوده می‌شوند تا درخواست‌های بعدیِ همان چانک هم‌ملک‌یابی شوند (هم‌ارزِ مسیرِ ترتیبی که
// هر publish ایندکس را از نو می‌سازد). انحرافِ آگاهانه و کم‌اثر: entryِ کهنهٔ آیتمِ
// آپدیت‌شده از ایندکس برداشته نمی‌شود — refش همان آیتم است، پس بدترین حالت آپدیتِ دوبارهٔ
// همان آیتم است، نه آگهیِ گم‌شده/تکراری.
export interface PublishUserListingReq { prevId?: string; raw: UserListingRaw }
const PUBLISH_CHUNK = 15   // قفلِ KV_META را طولانی نکن — بزرگ‌ترش نکنید (هشدارِ CLAUDE.md)
export async function publishUserListingsBatch(reqs: PublishUserListingReq[]): Promise<{ item: Item; created: boolean }[]> {
  const out: { item: Item; created: boolean }[] = []
  for (let c = 0; c < reqs.length; c += PUBLISH_CHUNK) {
    const chunk = reqs.slice(c, c + PUBLISH_CHUNK)
    const part = await mutate(db => {
      const idx = buildUserTwinIndex(db)
      const res: { item: Item; created: boolean }[] = []
      for (const { prevId, raw } of chunk) {
        // مثلِ publishListing: prev باید آیتمِ listing موجود باشد (وضعیتش هرچه باشد — حتی duplicate)
        const prev = prevId ? db.items.find(x => x.id === prevId && x.type === 'listing') : undefined
        if (prev) {
          const textChanged = prev.title !== raw.title || (prev.excerpt || '') !== (raw.excerpt || '')
          const it = updateUserListingCore(db, prev.id, raw, { remoderate: textChanged })
          if (it) {
            // فاز ۲۸۴ — اول اسنپ‌شاتِ کهنهٔ همین آیتم از ایندکس برداشته می‌شود (هم‌رفتاری با مسیرِ تکی
            // که هر بار ایندکس را تازه می‌سازد)، بعد فیلدهای جدید می‌نشیند.
            idx.remove(it)
            if (it.status !== 'duplicate' && it.status !== 'rejected') idx.add(simFieldsOf(it), it)
            res.push({ item: it, created: false })
            continue
          }
        }
        // publicId شکسته/غایب → هم‌ملکِ عمومیِ موجود بازپس گرفته می‌شود (فاز ۱۵۶A4)
        const twin = idx.find(simFieldsOf({ title: raw.title, price: raw.price, location: raw.location, meta: raw.meta }))
        if (twin) {
          const textChanged = twin.title !== raw.title || (twin.excerpt || '') !== (raw.excerpt || '')
          const it = updateUserListingCore(db, twin.id, raw, { remoderate: textChanged })
          if (it) {
            idx.remove(it)
            if (it.status !== 'duplicate' && it.status !== 'rejected') idx.add(simFieldsOf(it), it)
            res.push({ item: it, created: false })
            continue
          }
        }
        const it = addUserListingCore(db, raw, idx)
        if (it.status !== 'duplicate') idx.add(simFieldsOf(it), it)
        res.push({ item: it, created: true })
      }
      return res
    })
    out.push(...part)
  }
  return out
}
// فاز ۱۴۲ — در ادغامِ دو حساب، مالکیتِ آگهی‌های عمومی (نگاشتِ «آگهی‌های من») به شمارهٔ اصلی می‌رود.
export async function reassignListingOwnerPhone(from: string, to: string): Promise<number> {
  return mutate(db => {
    let n = 0
    for (const it of db.items) {
      if (it.type === 'listing' && it.meta?.['__ownerPhone'] === from) { it.meta['__ownerPhone'] = to; n++ }
    }
    return n
  })
}

// تمدیدِ آگهی برای ۳۰ روزِ دیگر
export async function renewListing(itemId: string): Promise<Item | null> {
  return mutateSome([itemId], ({ items }) => {
    const it = items.find(i => i.id === itemId); if (!it) return null
    it.expiresAt = Date.now() + LISTING_TTL; return it
  })
}
// شمارشِ آگهی‌های فعالِ (منقضی‌نشدهٔ) یک کاربر — برای سقفِ پلن
export async function countActiveListingsOf(ownerId: string): Promise<number> {
  const now = Date.now()
  return (await load()).items.filter(i => i.type === 'listing' && i.ownerId === ownerId && i.status !== 'rejected' && !isExpired(i, now)).length
}

// ── Articles (CMS) ──────────────────────────────────────────────────────────
// ── WordPress-like editorial article fields (rich CMS) ──────────────────────
export interface ArticleInput {
  title: string; body: string; excerpt?: string; image?: string; category?: string
  tags?: string[]; slug?: string; seoTitle?: string; metaDescription?: string
  focusKeyword?: string; status?: 'draft' | 'published'; author?: string; source?: string
  publishAt?: number   // زمان‌بندیِ انتشار (epoch ms)؛ اگر در آینده باشد، مقاله «زمان‌بندی‌شده» می‌شود
  bannerId?: string    // فاز ۱۵۰: بنرِ اختصاصیِ همین مقاله (انتخاب در مقاله‌ساز؛ خالی = هدف‌گیریِ عمومی)
}

export function slugify(s: string): string {
  return (s || '').trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w؀-ۿ-]/g, '')
    .replace(/-+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 80) || 'مقاله'
}

function uniqueSlug(db: DB, base: string, exceptId?: string): string {
  const s = slugify(base)
  let candidate = s, n = 2
  const taken = (sl: string) => db.items.some(i => i.type === 'article' && i.id !== exceptId && i.meta?.slug === sl)
  while (taken(candidate)) candidate = `${s}-${n++}`
  return candidate
}

// عنوانِ یکتا: اگر مقالهٔ دیگری دقیقاً همین عنوان را داشته باشد، یک پسوند شمارهٔ
// فارسی اضافه می‌شود تا تگ <title> و سئو تکراری نشود (کاملاً خودکار).
function uniqueTitle(db: DB, base: string, exceptId?: string): string {
  const t = String(base || '').trim()
  if (!t) return t
  const norm = (x: string) => x.replace(/\s+/g, ' ').trim()
  const taken = (tt: string) => db.items.some(i => i.type === 'article' && i.id !== exceptId && norm(i.title || '') === norm(tt))
  if (!taken(t)) return t
  let n = 2
  let candidate = `${t} (${n.toLocaleString('fa-IR')})`
  while (taken(candidate)) { n++; candidate = `${t} (${n.toLocaleString('fa-IR')})` }
  return candidate
}

// Insert an editorial article. Published → public immediately; draft → hidden from lists.
export async function addArticle(raw: ArticleInput): Promise<Item> {
  return mutate(db => {
    // اگر زمان‌بندی در آینده باشد، وضعیت «scheduled» می‌شود تا کران در زمانش منتشرش کند.
    const scheduled = !!raw.publishAt && raw.publishAt > Date.now()
    const status = scheduled ? 'scheduled' : (raw.status || 'published')
    const title = uniqueTitle(db, raw.title)
    const slug = uniqueSlug(db, raw.slug || title)
    const meta: Record<string, string> = {
      slug,
      cmsStatus: status,
      ...(scheduled ? { publishAt: String(raw.publishAt) } : {}),
      author: raw.author || raw.source || 'تحریریه ملک‌جت',
      seoTitle: raw.seoTitle || title,
      metaDescription: raw.metaDescription || (raw.excerpt || raw.body).slice(0, 160),
      focusKeyword: raw.focusKeyword || '',
      summary: raw.excerpt || raw.body.replace(/[#*_>`-]/g, '').slice(0, 200),
      ...(raw.bannerId ? { __bannerId: String(raw.bannerId) } : {}),
    }
    const item: Item = {
      id: id(), sourceId: 'cms', sourceName: raw.source || meta.author, type: 'article',
      category: raw.category, title, image: raw.image, excerpt: raw.body,
      tags: raw.tags && raw.tags.length ? raw.tags : undefined,
      meta, scrapedAt: Date.now(), firstSeenAt: Date.now(), status: 'approved',
    }
    db.items.unshift(item)
    return item
  })
}

export async function updateArticle(itemId: string, patch: Partial<ArticleInput>): Promise<Item | null> {
  return mutate(db => {
    const it = db.items.find(i => i.id === itemId && i.type === 'article')
    if (!it) return null
    const meta = { ...(it.meta || {}) }
    if (patch.title !== undefined) it.title = uniqueTitle(db, patch.title, itemId)
    if (patch.body !== undefined) { it.excerpt = patch.body; if (!patch.excerpt) meta.summary = patch.body.replace(/[#*_>`-]/g, '').slice(0, 200) }
    if (patch.excerpt !== undefined) meta.summary = patch.excerpt
    if (patch.image !== undefined) it.image = patch.image
    if (patch.category !== undefined) it.category = patch.category
    if (patch.tags !== undefined) it.tags = patch.tags.length ? patch.tags : undefined
    if (patch.slug !== undefined && patch.slug.trim()) meta.slug = uniqueSlug(db, patch.slug, itemId)
    if (patch.seoTitle !== undefined) meta.seoTitle = patch.seoTitle
    if (patch.metaDescription !== undefined) meta.metaDescription = patch.metaDescription
    if (patch.focusKeyword !== undefined) meta.focusKeyword = patch.focusKeyword
    if (patch.author !== undefined) { meta.author = patch.author; it.sourceName = patch.author }
    if (patch.bannerId !== undefined) { if (patch.bannerId) meta.__bannerId = String(patch.bannerId); else delete meta.__bannerId }
    // زمان‌بندی: اگر publishAt در آینده داده شد → scheduled؛ اگر منتشر شد → publishAt پاک می‌شود.
    if (patch.publishAt !== undefined && patch.publishAt > Date.now()) { meta.cmsStatus = 'scheduled'; meta.publishAt = String(patch.publishAt) }
    else if (patch.status !== undefined) { meta.cmsStatus = patch.status; if (patch.status === 'published' || patch.status === 'draft') delete meta.publishAt }
    it.meta = meta
    it.edited = true
    return it
  })
}

// All article items (newest first). publishedOnly → فقط «published» (نه پیش‌نویس، نه زمان‌بندی‌شده).
export async function listArticles(opts?: { publishedOnly?: boolean }): Promise<Item[]> {
  return (await load()).items
    .filter(i => i.type === 'article' && (!opts?.publishedOnly || (i.meta?.cmsStatus !== 'draft' && i.meta?.cmsStatus !== 'scheduled')))
    .sort((a, b) => b.scrapedAt - a.scrapedAt)
}

// مقالاتِ زمان‌بندی‌شده‌ای که زمانشان رسیده را منتشر می‌کند (برای کران). تعداد را برمی‌گرداند.
export async function publishDueArticles(): Promise<number> {
  return mutate(db => {
    const now = Date.now()
    let n = 0
    for (const it of db.items) {
      if (it.type !== 'article' || it.meta?.cmsStatus !== 'scheduled') continue
      const at = Number(it.meta?.publishAt || 0)
      if (at && at <= now) { it.meta!.cmsStatus = 'published'; delete it.meta!.publishAt; n++ }
    }
    return n
  })
}

export async function getArticleBySlug(slug: string): Promise<Item | null> {
  return (await load()).items.find(i => i.type === 'article' && i.meta?.slug === slug) || null
}

// ایجاد دستی یک آیتم (آگهی/محصول/پروفایل/قیمت) از سوپرادمین — منتشرشده.
export async function addItemManual(raw: {
  type: SourceType; title: string; price?: string; location?: string; image?: string
  url?: string; excerpt?: string; phone?: string; category?: string; owner?: string
  meta?: Record<string, string>
}): Promise<Item> {
  return mutate(db => {
    const item: Item = {
      id: id(), sourceId: 'manual', sourceName: 'ثبت دستی مدیر', type: raw.type,
      category: raw.category, title: raw.title, price: raw.price, location: raw.location,
      image: raw.image, url: raw.url, excerpt: raw.excerpt, phone: raw.phone, owner: raw.owner,
      meta: raw.meta && Object.keys(raw.meta).length ? raw.meta : undefined,
      scrapedAt: Date.now(), firstSeenAt: Date.now(), status: 'approved', edited: true,
    }
    db.items.unshift(item)
    return item
  })
}

export async function markError(sourceId: string, err: string) {
  return mutate(db => {
    const s = db.sources.find(x => x.id === sourceId)
    if (s) { s.lastRun = Date.now(); s.status = 'error'; s.lastError = err }
  })
}
