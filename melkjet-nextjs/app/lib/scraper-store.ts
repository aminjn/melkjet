import { join } from 'path'
import { randomBytes } from 'crypto'
import { readJsonCached, writeJsonCached } from './json-file'
import { pgEnabled, kvGet, pgTx, pgListingsAll } from './db'
// موتورِ خالصِ هم‌ملک‌یابیِ ویژگی‌محور (متن+مشخصات+لوکیشن) — گِیتِ ضدتکراریِ همهٔ ورودی‌ها
import { fieldsOf as simFieldsOf, TwinIndex, norm as simNorm } from './listing-similarity'

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
let pgCache: { at: number; data: DB } | null = null
// کش ۱۵ ثانیه‌ای رویِ مسیرِ PG: صفحاتِ عمومی در هر رندر listItems را صدا می‌زنند. کش بارِ
// خواندنِ دیتابیس را شدیداً کم می‌کند؛ نوشتن کش را باطل می‌کند.
const PG_TTL = 15_000

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

/** خواندنِ سندِ کاملِ اسکرپر (دو-حالته: PG یا فایل). */
async function load(): Promise<DB> {
  if (!pgEnabled()) return fileLoad()
  const now = Date.now()
  if (pgCache && now - pgCache.at < PG_TTL) return pgCache.data
  try {
    await ensureMigrated()
    // متادیتای زنده از KV_META؛ اگر هنوز نبود (لحظهٔ گذار)، از بلابِ قدیمی bootstrap کن.
    const [meta, items] = await Promise.all([kvGet<Partial<DB>>(KV_META, {}), pgListingsAll() as Promise<Item[]>])
    const m = (meta.sources || meta.owners || meta.categories) ? meta : await kvGet<Partial<DB>>(KV_KEY, {})
    const data: DB = {
      sources: m.sources && m.sources.length ? m.sources : DEFAULT_SOURCES,
      items,
      categories: m.categories,
      owners: m.owners || [],
    }
    pgCache = { at: now, data }
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
    await c.query(`UPDATE kv SET data=$2, updated_at=now() WHERE key=$1`, [KV_META, JSON.stringify(metaOf(db))])
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

export async function listItems(type?: SourceType, opts?: { category?: string; publicOnly?: boolean }): Promise<Item[]> {
  const db = await load()
  // کپی (نه ارجاع به آرایهٔ کش‌شده) تا sortِ درجا کشِ مشترک را جابه‌جا نکند.
  let items = type ? db.items.filter(i => i.type === type) : [...db.items]
  if (opts?.category) items = items.filter(i => i.category === opts.category)
  if (opts?.publicOnly) { const now = Date.now(); items = items.filter(i => i.status !== 'rejected' && i.status !== 'duplicate' && !isExpired(i, now)) }
  return items.sort((a, b) => b.scrapedAt - a.scrapedAt)
}

// Candidate generation (معادلِ Elasticsearch/جستجوی توزیع‌شده در همین استک):
// به‌جای بارگذاریِ همهٔ ردیف‌ها در حافظه و برش در JS، مستقیماً از جدولِ `listings` با SQL و
// LIMIT کاندیدا می‌گیرد (ایندکسِ type + scraped_at). پس با میلیون‌ها آگهی هم مسیرِ رتبه‌بندی
// فقط N کاندیدا را می‌گیرد، نه کلِ جدول. در حالتِ فایل به listItems برمی‌گردد.
export async function candidateListings(limit = 500, type: SourceType = 'listing'): Promise<Item[]> {
  if (pgEnabled()) {
    try {
      const r = await pgTx(c => c.query(
        `SELECT data FROM listings WHERE type=$1 AND status NOT IN ('rejected','duplicate')
         ORDER BY scraped_at DESC LIMIT $2`, [type, limit]))
      const now = Date.now()
      return (r.rows.map(x => x.data as Item)).filter(i => !isExpired(i, now))
    } catch { /* اگر جدول/DB آماده نبود → مسیرِ امن */ }
  }
  return (await listItems(type, { publicOnly: true })).slice(0, limit)
}

export async function getItemById(itemId: string): Promise<Item | null> {
  return (await load()).items.find(i => i.id === itemId) || null
}

// Items awaiting AI moderation (pending, not yet moderated)
export async function pendingForModeration(limit = 25): Promise<Item[]> {
  return (await load()).items.filter(i => i.status === 'pending' && !i.moderatedAt).slice(0, limit)
}

export async function setModeration(itemId: string, status: ItemStatus, reason: string, score: number) {
  return mutate(db => {
    const it = db.items.find(i => i.id === itemId)
    if (it) { it.status = status; it.aiReason = reason; it.aiScore = score; it.moderatedAt = Date.now() }
  })
}

// Persist many moderation verdicts in a single atomic write (avoids file races under concurrency).
export async function setModerationBatch(verdicts: { id: string; status: ItemStatus; reason: string; score: number }[]) {
  if (!verdicts.length) return
  return mutate(db => {
    const now = Date.now()
    const map = new Map(verdicts.map(v => [v.id, v]))
    for (const it of db.items) {
      const v = map.get(it.id)
      if (v) { it.status = v.status; it.aiReason = v.reason; it.aiScore = v.score; it.moderatedAt = now }
    }
  })
}

export async function setItemStatus(itemId: string, status: ItemStatus) {
  return mutate(db => {
    const it = db.items.find(i => i.id === itemId)
    if (it) it.status = status
  })
}

export async function updateItem(itemId: string, patch: EditableItem) {
  return mutate(db => {
    const it = db.items.find(i => i.id === itemId)
    if (!it) return null
    const allowed: (keyof EditableItem)[] = ['title', 'price', 'location', 'image', 'url', 'excerpt', 'phone', 'category', 'status', 'featured']
    for (const k of allowed) {
      if (patch[k] !== undefined) (it as any)[k] = patch[k]
    }
    it.edited = true
    return it
  })
}

// وضعیتِ معاملهٔ آگهیِ عمومی (فروخته‌شده/اجاره‌رفته) روی خودِ آیتم مهر می‌خورد تا در صفحه/کارت‌ها دیده شود.
// status = '' یعنی برگشت به «فعال» (مهر برداشته می‌شود).
export async function setItemDealStatus(itemId: string, status: 'sold' | 'rented' | '') {
  return mutate(db => {
    const it = db.items.find(i => i.id === itemId)
    if (!it) return
    it.meta = it.meta || {}
    if (status) it.meta['__dealStatus'] = status
    else delete it.meta['__dealStatus']
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
    const existingKeys = new Set(db.items.map(i => (i.url || '') + '|' + i.title))
    // ایندکسِ هم‌ملک‌یابی روی آگهی‌های قابلِ‌نمایشِ موجود (تکراری/ردشده‌ها مبنا نیستند)
    const twinIdx = new TwinIndex<Item>()
    if (source.type === 'listing') {
      for (const i of db.items) if (i.type === 'listing' && i.status !== 'duplicate' && i.status !== 'rejected') twinIdx.add(fieldsOf(i), i)
    }
    // کلیدِ هویتیِ غیرآگهی‌ها (محصول/پروفایل/قیمت/مقاله): نوع + عنوانِ نرمال + مالک (تلفن/نام/منبع)
    const identKey = (i: { type?: string; title?: string; phone?: string; owner?: string; sourceName?: string }) =>
      `${i.type || source.type}|${simNorm(i.title)}|${(i.phone || '').replace(/\D/g, '') || simNorm(i.owner) || simNorm(i.sourceName)}`
    const identMap = new Map<string, Item>()
    if (source.type !== 'listing') {
      for (const i of db.items) if (i.type === source.type && i.status !== 'rejected') identMap.set(identKey(i), i)
    }
    let added = 0, dup = 0, updated = 0
    db.owners = db.owners || []
    for (const r of raw) {
      const key = (r.url || '') + '|' + r.title
      if (existingKeys.has(key)) { dup++; continue }
      existingKeys.add(key)
      // merge source meta (city/neighborhood/type/specialty) into the item
      const meta = source.meta && Object.keys(source.meta).length ? source.meta : undefined
      const loc = r.location
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
          if (twin.meta?.['__dealStatus']) delete twin.meta['__dealStatus']
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
        const pn = r.phone ? r.phone.replace(/\D/g, '') : ''
        const nn = normName(r.owner || '')
        let owner = db.owners.find(o => (pn && o.phone && o.phone.replace(/\D/g, '') === pn) || (!pn && nn && normName(o.name) === nn))
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
        ...r, location: loc, ownerId,
      }
      db.items.unshift(item)
      if (source.type === 'listing') { newListingIds.push(newId); twinIdx.add(fieldsOf(item), item) }
      else identMap.set(identKey(item), item)
      added++
    }
    if (db.items.length > 1000) db.items = db.items.slice(0, 1000)
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

// Insert a single user-submitted listing (status pending → goes to AI moderation immediately).
// گِیتِ ضدتکراری در لحظهٔ ثبت: اگر هم‌ملکِ آگهیِ موجود باشد، با وضعیتِ «duplicate» ساخته می‌شود
// (هرگز عمومی نمی‌شود) و علتش برای ادمین ثبت است — نه اینکه نسخهٔ دوم واردِ سایت شود.
export function addUserListing(raw: {
  title: string; price?: string; location?: string; image?: string; excerpt?: string;
  phone?: string; owner?: string; url?: string; meta?: Record<string, string>
}): Promise<Item> {
  return mutate(db => {
    db.owners = db.owners || []
    let ownerId: string | undefined
    if (raw.owner || raw.phone) {
      const pn = raw.phone ? raw.phone.replace(/\D/g, '') : ''
      const nn = normName(raw.owner || '')
      let owner = db.owners.find(o => (pn && o.phone && o.phone.replace(/\D/g, '') === pn) || (!pn && nn && normName(o.name) === nn))
      if (!owner) { owner = { id: id(), name: raw.owner || 'کاربر', phone: raw.phone, count: 0, firstSeen: Date.now() }; db.owners.push(owner) }
      if (raw.phone && !owner.phone) owner.phone = raw.phone
      owner.count++; ownerId = owner.id
    }
    // هم‌ملک‌یابیِ درجا (داخلِ همان تراکنش — بدونِ race با درج‌های هم‌زمان)
    const probeF = simFieldsOf({ title: raw.title, price: raw.price, location: raw.location, meta: raw.meta })
    const twinIdx = new TwinIndex<Item>()
    for (const i of db.items) if (i.type === 'listing' && i.status !== 'duplicate' && i.status !== 'rejected') twinIdx.add(simFieldsOf(i), i)
    const twin = twinIdx.find(probeF)
    const item: Item = {
      id: id(), sourceId: 'user', sourceName: 'ثبت توسط کاربر', type: 'listing',
      title: raw.title, price: raw.price, location: raw.location, image: raw.image,
      excerpt: raw.excerpt, phone: raw.phone, owner: raw.owner, url: raw.url, ownerId,
      meta: raw.meta && Object.keys(raw.meta).length ? raw.meta : undefined,
      scrapedAt: Date.now(),
      status: twin ? 'duplicate' : 'pending',
      aiReason: twin ? `تکراری در لحظهٔ ثبت — هم‌ملکِ «${twin.title.slice(0, 60)}»` : undefined,
      expiresAt: Date.now() + LISTING_TTL,
    }
    db.items.unshift(item)
    return item
  })
}
// تمدیدِ آگهی برای ۳۰ روزِ دیگر
export async function renewListing(itemId: string): Promise<Item | null> {
  return mutate(db => {
    const it = db.items.find(i => i.id === itemId); if (!it) return null
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
    }
    const item: Item = {
      id: id(), sourceId: 'cms', sourceName: raw.source || meta.author, type: 'article',
      category: raw.category, title, image: raw.image, excerpt: raw.body,
      tags: raw.tags && raw.tags.length ? raw.tags : undefined,
      meta, scrapedAt: Date.now(), status: 'approved',
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
      scrapedAt: Date.now(), status: 'approved', edited: true,
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
