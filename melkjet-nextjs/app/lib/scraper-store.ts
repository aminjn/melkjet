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
  scrapedAt: number
  status: ItemStatus
}

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
  if (opts?.publicOnly) items = items.filter(i => i.status !== 'rejected' && i.status !== 'duplicate')
  return items.sort((a, b) => b.scrapedAt - a.scrapedAt)
}

export function getItemById(itemId: string): Item | null {
  return load().items.find(i => i.id === itemId) || null
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
    db.items.unshift({
      id: id(), sourceId: source.id, sourceName: source.name, type: source.type,
      category: source.category, meta, scrapedAt: Date.now(), status: 'pending',
      ...r, location: loc, ownerId,
    })
    added++
  }
  if (db.items.length > 1000) db.items = db.items.slice(0, 1000)
  const s = db.sources.find(x => x.id === source.id)
  if (s) { s.lastRun = Date.now(); s.lastCount = added; s.status = 'ok'; s.lastError = undefined }
  save(db)
  return { added, dup }
}

export function markError(sourceId: string, err: string) {
  const db = load()
  const s = db.sources.find(x => x.id === sourceId)
  if (s) { s.lastRun = Date.now(); s.status = 'error'; s.lastError = err }
  save(db)
}
