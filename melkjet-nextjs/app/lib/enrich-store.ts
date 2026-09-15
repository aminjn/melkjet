import { join } from 'path'
import { readJsonCached, writeJsonCached, readJsonFresh, withFileLock } from './json-file'

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
  analysisNote?: string  // فاز ۲۱۰: علتِ دقیقِ آخرین شکستِ تحلیل — بدونِ این، «چرا تحلیل نمی‌آید» قابلِ‌تشخیص نبود
  baseDone?: boolean     // آیا بخش‌های غیر-AI (دیوار/نشان) یک‌بار محاسبه شده؟
  baseTriedAt?: number   // فاز ۲۰۱: آخرین تلاشِ ناموفقِ واکشیِ دیوار (شکستِ گذرا baseDone نمی‌شود؛ بعدِ کول‌داون دوباره)
  baseRepairedAt?: number // فاز ۲۰۱: مهرِ ترمیمِ یک‌بارهٔ کش‌های خراب (baseDone بدونِ گالری) — جلوگیری از حلقهٔ ترمیم
  nearbyTriedAt?: number // فاز ۲۰۱: آخرین تلاشِ بازسازیِ «دسترسی‌های اطراف» وقتی geo هست ولی nearby خالی کش شده
  nearbyV?: number       // فاز ۲۱۳: نسخهٔ منطقِ nearby — کش‌های نسخهٔ قدیمی (اعتبارسنجیِ دوریِ محله‌ای/شعاعِ شل) بازنشسته می‌شوند
  enrichedAt?: number
}

type DB = Record<string, Enrichment>

function load(): DB { return readJsonCached<DB>(FILE, {}) }
function save(db: DB) { writeJsonCached(FILE, db) }

export function getEnrichment(id: string): Enrichment | null {
  return load()[id] || null
}

// Batched, locked persistence.
//
// patchEnrichment used to stringify and fsync the entire ~48MB document (21,555
// keys) for every single field it touched. With 12 warms per sweep, each patching
// several times, that was tens of 48MB fsynced writes per minute - the 191% CPU
// and 13-18MB/s of disk the cron instance was showing.
//
// It also did read-modify-write with no lock, while four pm2 instances and 12
// concurrent warms shared the file, so results silently overwrote each other.
// That is what the repeated "this listing has no analysis" reports were actually
// about: phases 191, 195, 197b, 201, 203, 207, 211 and 212 all treated symptoms of
// this one bug. Writes now merge onto a fresh read inside withFileLock, which is
// the same lock json-file.ts already provides and this store never used.
//
// Enrichment is a cache, so losing at most FLUSH_MS of it to a hard kill is
// acceptable; the sweep re-warms anything missing. A flush on exit covers the
// ordinary pm2 restart.
const FLUSH_MS = 10_000
const pending = new Map<string, Partial<Enrichment>>()
let flushTimer: ReturnType<typeof setTimeout> | null = null

export function flushEnrichment(): void {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
  if (!pending.size) return
  const batch = new Map(pending)
  pending.clear()
  try {
    withFileLock(FILE, () => {
      const disk = readJsonFresh<DB>(FILE, {})
      for (const [id, p] of batch) disk[id] = { ...(disk[id] || {}), ...p } as Enrichment
      save(disk)
    })
  } catch {
    // Keep the work for the next flush rather than dropping it; a later patch to
    // the same id wins, which is what a cache wants.
    for (const [id, p] of batch) if (!pending.has(id)) pending.set(id, p)
  }
}

let exitHooked = false
function scheduleFlush(): void {
  if (!exitHooked) {
    exitHooked = true
    for (const sig of ['exit', 'SIGINT', 'SIGTERM'] as const) {
      try { process.once(sig, () => { try { flushEnrichment() } catch {} }) } catch {}
    }
  }
  if (!flushTimer) flushTimer = setTimeout(flushEnrichment, FLUSH_MS)
}

export function patchEnrichment(id: string, patch: Partial<Enrichment>): Enrichment {
  const cur = load()[id] || {}
  const next = { ...cur, ...patch, enrichedAt: Date.now() } as Enrichment
  // Visible to readers in this process immediately; persisted on the next flush.
  load()[id] = next
  const queued = pending.get(id) || {}
  pending.set(id, { ...queued, ...patch, enrichedAt: next.enrichedAt })
  scheduleFlush()
  return next
}

export function clearEnrichment(id?: string) {
  if (!id) { save({}); return }
  const db = load(); delete db[id]; save(db)
}
