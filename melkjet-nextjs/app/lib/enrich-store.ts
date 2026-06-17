import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const FILE = join(process.cwd(), '.enrich-data.json')

export interface Enrichment {
  gallery?: string[]
  facts?: { label: string; value: string }[]
  amenities?: string[]
  description?: string
  geo?: { lat: number; lng: number }
  nearby?: { type?: string; name?: string; time: string }[]
  analysis?: any
  analysisOk?: boolean   // آیا تحلیل AI یک‌بار با موفقیت تولید شده؟ (تا دیگر بازتولید نشود)
  baseDone?: boolean     // آیا بخش‌های غیر-AI (دیوار/نشان) یک‌بار محاسبه شده؟
  enrichedAt?: number
}

type DB = Record<string, Enrichment>

function load(): DB {
  if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} }
  return {}
}
function save(db: DB) { writeFileSync(FILE, JSON.stringify(db), 'utf-8') }

export function getEnrichment(id: string): Enrichment | null {
  return load()[id] || null
}

export function patchEnrichment(id: string, patch: Partial<Enrichment>): Enrichment {
  const db = load()
  const cur = db[id] || {}
  const next = { ...cur, ...patch, enrichedAt: Date.now() }
  db[id] = next
  save(db)
  return next
}

export function clearEnrichment(id?: string) {
  if (!id) { save({}); return }
  const db = load(); delete db[id]; save(db)
}
