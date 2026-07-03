import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

const DATA_FILE = join(process.cwd(), '.scraper-data.json')

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

export function listOwners(): Owner[] {
  return (load().owners || []).sort((a, b) => b.count - a.count)
}

export function updateOwner(ownerId: string, patch: { name?: string; phone?: string }) {
  const db = load()
  const o = (db.owners || []).find(x => x.id === ownerId)
  if (!o) return null
  if (patch.name !== undefined) o.name = String(patch.name)
  if (patch.phone !== undefined) {
    o.phone = String(patch.phone)
    // propagate the phone to all of this owner's items
    db.items.forEach(it => { if (it.ownerId === ownerId) it.phone = o.phone })
  }
  save(db)
  return o
}

export function deleteOwner(ownerId: string) {
  const db = load()
  db.owners = (db.owners || []).filter(x => x.id !== ownerId)
  save(db)
}

function id() { return randomBytes(6).toString('hex') }

const DEFAULT_CATEGORIES = [
  'مشاور', 'آژانس', 'سازنده', 'مصالح', 'معمار', 'پیمانکار', 'کارشناس',
  'حقوقی', 'وکیل', 'بیمه', 'بانک', 'دفترخانه', 'سردفتر', 'ارزیاب',
]

const DEFAULT_SOURCES: Source[] = [
  { id: id(), name: 'اخبار املاک - ایسنا', url: 'https://www.isna.ir/rss/tp/45', type: 'article', method: 'rss', enabled: true, schedule: 'daily', lastRun: null, lastCount: 0, status: 'idle' },
]

export function load(): DB {
  if (existsSync(DATA_FILE)) {
    try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {}
  }
  return { sources: DEFAULT_SOURCES, items: [] }
}

export function save(db: DB) {
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8')
}

export function listSources(): Source[] { return load().sources }

export function listCategories(): string[] {
  const db = load()
  const fromItems = Array.from(new Set(db.items.filter(i => i.type === 'directory' && i.category).map(i => i.category as string)))
  const merged = Array.from(new Set([...(db.categories || DEFAULT_CATEGORIES), ...fromItems]))
  return merged
}

export function addCategory(name: string): string[] {
  const db = load()
  const n = name.trim()
  if (!n) return listCategories()
  const cats = db.categories || DEFAULT_CATEGORIES.slice()
  if (!cats.includes(n)) cats.unshift(n)
  db.categories = cats
  save(db)
  return listCategories()
}

export function addSource(input: Omit<Source, 'id' | 'lastRun' | 'lastCount' | 'status'>): Source {
  const db = load()
  const src: Source = { ...input, id: id(), lastRun: null, lastCount: 0, status: 'idle' }
  db.sources.unshift(src)
  save(db)
  return src
}

export function updateSource(sid: string, patch: Partial<Source>): Source | null {
  const db = load()
  const s = db.sources.find(x => x.id === sid)
  if (!s) return null
  Object.assign(s, patch)
  save(db)
  return s
}

export function deleteSource(sid: string) {
  const db = load()
  db.sources = db.sources.filter(x => x.id !== sid)
  db.items = db.items.filter(x => x.sourceId !== sid)
  save(db)
}

export function listItems(type?: SourceType, opts?: { category?: string; publicOnly?: boolean }): Item[] {
  const db = load()
  let items = type ? db.items.filter(i => i.type === type) : db.items
  if (opts?.category) items = items.filter(i => i.category === opts.category)
  if (opts?.publicOnly) { const now = Date.now(); items = items.filter(i => i.status !== 'rejected' && i.status !== 'duplicate' && !isExpired(i, now)) }
  return items.sort((a, b) => b.scrapedAt - a.scrapedAt)
}

export function getItemById(itemId: string): Item | null {
  return load().items.find(i => i.id === itemId) || null
}

// Items awaiting AI moderation (pending, not yet moderated)
export function pendingForModeration(limit = 25): Item[] {
  return load().items.filter(i => i.status === 'pending' && !i.moderatedAt).slice(0, limit)
}

export function setModeration(itemId: string, status: ItemStatus, reason: string, score: number) {
  const db = load()
  const it = db.items.find(i => i.id === itemId)
  if (it) { it.status = status; it.aiReason = reason; it.aiScore = score; it.moderatedAt = Date.now(); save(db) }
}

// Persist many moderation verdicts in a single atomic write (avoids file races under concurrency).
export function setModerationBatch(verdicts: { id: string; status: ItemStatus; reason: string; score: number }[]) {
  if (!verdicts.length) return
  const db = load()
  const now = Date.now()
  const map = new Map(verdicts.map(v => [v.id, v]))
  for (const it of db.items) {
    const v = map.get(it.id)
    if (v) { it.status = v.status; it.aiReason = v.reason; it.aiScore = v.score; it.moderatedAt = now }
  }
  save(db)
}

export function setItemStatus(itemId: string, status: ItemStatus) {
  const db = load()
  const it = db.items.find(i => i.id === itemId)
  if (it) { it.status = status; save(db) }
}

export function updateItem(itemId: string, patch: EditableItem) {
  const db = load()
  const it = db.items.find(i => i.id === itemId)
  if (!it) return null
  const allowed: (keyof EditableItem)[] = ['title', 'price', 'location', 'image', 'url', 'excerpt', 'phone', 'category', 'status', 'featured']
  for (const k of allowed) {
    if (patch[k] !== undefined) (it as any)[k] = patch[k]
  }
  it.edited = true
  save(db)
  return it
}

export function deleteItem(itemId: string) {
  const db = load()
  const n = db.items.length
  db.items = db.items.filter(i => i.id !== itemId)
  save(db)
  return db.items.length < n
}

export function deleteItems(ids: string[]) {
  const db = load()
  const set = new Set(ids)
  db.items = db.items.filter(i => !set.has(i.id))
  save(db)
}

// Wipe all items, or only one type. Sources are kept.
export function clearItems(type?: SourceType) {
  const db = load()
  db.items = type ? db.items.filter(i => i.type !== type) : []
  save(db)
}

// Insert items, dedup by url+title. Returns {added, dup}
export function insertItems(source: Source, raw: Omit<Item, 'id' | 'sourceId' | 'sourceName' | 'type' | 'category' | 'meta' | 'scrapedAt' | 'status'>[]): { added: number; dup: number } {
  const db = load()
  const existingKeys = new Set(db.items.map(i => (i.url || '') + '|' + i.title))
  let added = 0, dup = 0
  const newListingIds: string[] = []
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
    db.items.unshift({
      id: newId, sourceId: source.id, sourceName: source.name, type: source.type,
      category: source.category, meta, scrapedAt: Date.now(), status: 'pending',
      ...r, location: loc, ownerId,
    })
    if (source.type === 'listing') newListingIds.push(newId)
    added++
  }
  if (db.items.length > 1000) db.items = db.items.slice(0, 1000)
  const s = db.sources.find(x => x.id === source.id)
  if (s) { s.lastRun = Date.now(); s.lastCount = added; s.status = 'ok'; s.lastError = undefined }
  save(db)
  // تحلیلِ AI هر آگهیِ جدید همین حالا (هنگامِ اسکرپ) در پس‌زمینه ساخته و در دیتابیس ذخیره می‌شود،
  // تا بازکردنِ آگهی توسطِ کاربر دیگر AI را دوباره اجرا نکند. (import پویا برای پرهیز از حلقهٔ وابستگی.)
  if (newListingIds.length) import('./enrich-warm').then(m => m.warmMany(newListingIds)).catch(() => {})
  return { added, dup }
}

// Insert a single user-submitted listing (status pending → goes to AI moderation immediately).
export function addUserListing(raw: {
  title: string; price?: string; location?: string; image?: string; excerpt?: string;
  phone?: string; owner?: string; url?: string; meta?: Record<string, string>
}): Item {
  const db = load()
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
  const item: Item = {
    id: id(), sourceId: 'user', sourceName: 'ثبت توسط کاربر', type: 'listing',
    title: raw.title, price: raw.price, location: raw.location, image: raw.image,
    excerpt: raw.excerpt, phone: raw.phone, owner: raw.owner, url: raw.url, ownerId,
    meta: raw.meta && Object.keys(raw.meta).length ? raw.meta : undefined,
    scrapedAt: Date.now(), status: 'pending', expiresAt: Date.now() + LISTING_TTL,
  }
  db.items.unshift(item)
  save(db)
  return item
}
// تمدیدِ آگهی برای ۳۰ روزِ دیگر
export function renewListing(itemId: string): Item | null {
  const db = load(); const it = db.items.find(i => i.id === itemId); if (!it) return null
  it.expiresAt = Date.now() + LISTING_TTL; save(db); return it
}
// شمارشِ آگهی‌های فعالِ (منقضی‌نشدهٔ) یک کاربر — برای سقفِ پلن
export function countActiveListingsOf(ownerId: string): number {
  const now = Date.now()
  return load().items.filter(i => i.type === 'listing' && i.ownerId === ownerId && i.status !== 'rejected' && !isExpired(i, now)).length
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
export function addArticle(raw: ArticleInput): Item {
  const db = load()
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
  save(db)
  return item
}

export function updateArticle(itemId: string, patch: Partial<ArticleInput>): Item | null {
  const db = load()
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
  save(db)
  return it
}

// All article items (newest first). publishedOnly → فقط «published» (نه پیش‌نویس، نه زمان‌بندی‌شده).
export function listArticles(opts?: { publishedOnly?: boolean }): Item[] {
  return load().items
    .filter(i => i.type === 'article' && (!opts?.publishedOnly || (i.meta?.cmsStatus !== 'draft' && i.meta?.cmsStatus !== 'scheduled')))
    .sort((a, b) => b.scrapedAt - a.scrapedAt)
}

// مقالاتِ زمان‌بندی‌شده‌ای که زمانشان رسیده را منتشر می‌کند (برای کران). تعداد را برمی‌گرداند.
export function publishDueArticles(): number {
  const db = load()
  const now = Date.now()
  let n = 0
  for (const it of db.items) {
    if (it.type !== 'article' || it.meta?.cmsStatus !== 'scheduled') continue
    const at = Number(it.meta?.publishAt || 0)
    if (at && at <= now) { it.meta!.cmsStatus = 'published'; delete it.meta!.publishAt; n++ }
  }
  if (n) save(db)
  return n
}

export function getArticleBySlug(slug: string): Item | null {
  return load().items.find(i => i.type === 'article' && i.meta?.slug === slug) || null
}

// ایجاد دستی یک آیتم (آگهی/محصول/پروفایل/قیمت) از سوپرادمین — منتشرشده.
export function addItemManual(raw: {
  type: SourceType; title: string; price?: string; location?: string; image?: string
  url?: string; excerpt?: string; phone?: string; category?: string; owner?: string
  meta?: Record<string, string>
}): Item {
  const db = load()
  const item: Item = {
    id: id(), sourceId: 'manual', sourceName: 'ثبت دستی مدیر', type: raw.type,
    category: raw.category, title: raw.title, price: raw.price, location: raw.location,
    image: raw.image, url: raw.url, excerpt: raw.excerpt, phone: raw.phone, owner: raw.owner,
    meta: raw.meta && Object.keys(raw.meta).length ? raw.meta : undefined,
    scrapedAt: Date.now(), status: 'approved', edited: true,
  }
  db.items.unshift(item)
  save(db)
  return item
}

export function markError(sourceId: string, err: string) {
  const db = load()
  const s = db.sources.find(x => x.id === sourceId)
  if (s) { s.lastRun = Date.now(); s.status = 'error'; s.lastError = err }
  save(db)
}
