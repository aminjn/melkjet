import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

const DATA_FILE = join(process.cwd(), '.scraper-data.json')

export type SourceType = 'listing' | 'article' | 'price'
export type Method = 'auto' | 'jsonld' | 'og' | 'rss'
export type ItemStatus = 'pending' | 'approved' | 'duplicate' | 'rejected'

export interface Source {
  id: string
  name: string
  url: string
  type: SourceType
  method: Method
  enabled: boolean
  schedule: string          // 'manual' | 'hourly' | 'daily' | '6h'
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
  title: string
  price?: string
  location?: string
  image?: string
  url?: string
  excerpt?: string
  scrapedAt: number
  status: ItemStatus
}

interface DB { sources: Source[]; items: Item[] }

function id() { return randomBytes(6).toString('hex') }

const DEFAULT_SOURCES: Source[] = [
  { id: id(), name: 'دیوار - تهران', url: 'https://divar.ir/s/tehran/buy-apartment', type: 'listing', method: 'auto', enabled: true, schedule: '6h', lastRun: null, lastCount: 0, status: 'idle' },
  { id: id(), name: 'شیپور - املاک', url: 'https://www.sheypoor.com/s/tehran/real-estate', type: 'listing', method: 'auto', enabled: true, schedule: 'daily', lastRun: null, lastCount: 0, status: 'idle' },
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

export function listItems(type?: SourceType): Item[] {
  const db = load()
  const items = type ? db.items.filter(i => i.type === type) : db.items
  return items.sort((a, b) => b.scrapedAt - a.scrapedAt)
}

export function setItemStatus(itemId: string, status: ItemStatus) {
  const db = load()
  const it = db.items.find(i => i.id === itemId)
  if (it) { it.status = status; save(db) }
}

// Insert items, dedup by url+title. Returns {added, dup}
export function insertItems(source: Source, raw: Omit<Item, 'id' | 'sourceId' | 'sourceName' | 'type' | 'scrapedAt' | 'status'>[]): { added: number; dup: number } {
  const db = load()
  const existingKeys = new Set(db.items.map(i => (i.url || '') + '|' + i.title))
  let added = 0, dup = 0
  for (const r of raw) {
    const key = (r.url || '') + '|' + r.title
    if (existingKeys.has(key)) { dup++; continue }
    existingKeys.add(key)
    db.items.unshift({
      id: id(), sourceId: source.id, sourceName: source.name, type: source.type,
      scrapedAt: Date.now(), status: 'pending', ...r,
    })
    added++
  }
  // cap stored items to last 500
  if (db.items.length > 500) db.items = db.items.slice(0, 500)
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
