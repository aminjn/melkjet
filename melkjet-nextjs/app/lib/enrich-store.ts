import { join } from 'path'
import { readJsonCached, writeJsonCached } from './json-file'

const FILE = join(process.cwd(), '.enrich-data.json')

export interface Enrichment {
  v?: number             // نسخهٔ کش — برای باطل‌کردن ورودی‌های قدیمی/خراب
  gallery?: string[]
  facts?: { label: string; value: string }[]
  amenities?: string[]
  description?: string
  geo?: { lat: number; lng: number }
  nearby?: { type?: string; name?: string; time: string }[]
  analysis?: any
  analysisOk?: boolean   // آیا تحلیل AI یک‌بار با موفقیت تولید شده؟ (تا دیگر بازتولید نشود)
  analysisTriedAt?: number  // آخرین باری که تحلیل AI تلاش شد (کول‌داونِ تلاشِ مجدد در صورتِ شکست)
  analysisErr?: boolean  // فاز ۵۷: شکستِ آخر «خطای سرویس» بود (کلید/شبکه) → کول‌داونِ کوتاه تا بعدِ رفعِ مشکل خودکار ترمیم شود
  baseDone?: boolean     // آیا بخش‌های غیر-AI (دیوار/نشان) یک‌بار محاسبه شده؟
  enrichedAt?: number
}

type DB = Record<string, Enrichment>

function load(): DB { return readJsonCached<DB>(FILE, {}) }
function save(db: DB) { writeJsonCached(FILE, db) }

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
