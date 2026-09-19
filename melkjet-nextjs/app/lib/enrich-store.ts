import { join } from 'path'
import { readJsonCached, writeJsonCached, readJsonFresh, withFileLock } from './json-file'
import { statSync } from 'fs'
import { pgEnabled, pgTx } from './db'

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

// Persistence: the file is the baseline, the rows are the deltas.
//
// patchEnrichment used to stringify and fsync the entire ~52MB document (21,555
// keys) for every field it touched. With 12 warms per sweep that was tens of 52MB
// fsynced writes a minute - the 191% CPU and 13-18MB/s of disk on the cron
// instance. It also read-modify-wrote with no lock while four pm2 instances shared
// the file, so results silently overwrote each other; that is what the repeated
// "this listing has no analysis" reports were actually about, and what phases 191,
// 195, 197b, 201, 203, 207, 211 and 212 each treated a symptom of.
//
// The read API has to stay synchronous - it is called three times per listing
// render, once per item in /api/reos/similar and 16k times per sweep - and moving
// it to the database would have cost a round trip per call while saving no memory,
// since readJsonCached already kept the whole document parsed in every instance.
// So the file is still read synchronously at boot and kept as the in-memory
// baseline, and only what happens after that changed:
//
//   write    -> one small upsert into enrich(id, data) every FLUSH_MS
//   sync-in  -> rows with updated_at > watermark merged in every SYNC_MS, so an
//               instance sees the others' results without re-parsing 52MB
//   snapshot -> the whole file written once every SNAP_MS, and on exit
//
// The rows carry only deltas since the snapshot, so if the file were lost the rows
// alone would be incomplete. That is acceptable and deliberate: this is a cache,
// the sweep rebuilds anything missing, and the snapshot keeps the gap under SNAP_MS.
const FLUSH_MS = 10_000
const SYNC_MS = 20_000
const SNAP_MS = 10 * 60_000
const pending = new Map<string, Partial<Enrichment>>()
let flushTimer: ReturnType<typeof setTimeout> | null = null
let timersStarted = false
let memDirty = false
let loggedMode = false
// Start from the snapshot's own mtime, so the first sync-in also picks up whatever
// the other instances wrote after this file was last written.
let watermark = (() => {
  try { return new Date(statSync(FILE).mtimeMs).toISOString() } catch { return new Date().toISOString() }
})()

function snapshot(): void {
  if (!memDirty && !pending.size) return
  try {
    withFileLock(FILE, () => {
      const disk = readJsonFresh<DB>(FILE, {})
      save({ ...disk, ...load() })   // memory is a superset: it was seeded from disk
    })
    memDirty = false
  } catch { /* next snapshot */ }
}

async function flushRows(): Promise<void> {
  if (!pending.size) return
  const batch = new Map(pending)
  pending.clear()
  try {
    await pgTx(async c => {
      for (const [id, p] of batch) {
        await c.query(
          `INSERT INTO enrich (id, data) VALUES ($1, $2::jsonb)
           ON CONFLICT (id) DO UPDATE SET data = enrich.data || EXCLUDED.data, updated_at = now()`,
          [id, JSON.stringify(p)])
      }
    })
    console.log('[enrich-store] flushed ' + batch.size + ' rows')
  } catch (e) {
    console.error('[enrich-store] flush failed:', (e as { code?: string })?.code || '', (e as Error)?.message)
    // Keep the work for the next flush rather than dropping it; a later patch to
    // the same id wins, which is what a cache wants.
    for (const [id, p] of batch) if (!pending.has(id)) pending.set(id, p)
  }
}

async function syncIn(): Promise<void> {
  try {
    const r = await pgTx(c => c.query(
      `SELECT id, data, updated_at FROM enrich WHERE updated_at > $1::timestamptz
       ORDER BY updated_at LIMIT 5000`, [watermark]))
    if (!r.rows.length) return
    const db = load()
    for (const row of r.rows as { id: string; data: Enrichment; updated_at: Date | string }[]) {
      db[row.id] = { ...(db[row.id] || {}), ...row.data }
      const t = new Date(row.updated_at).toISOString()
      if (t > watermark) watermark = t
    }
    memDirty = true
  } catch (e) { console.error('[enrich-store] sync failed:', (e as Error)?.message) }
}

// Await this. The first caller did not: it called flushEnrichment() and then
// process.exit(0), and all 15,250 of its upserts were cut off mid-flight because
// flushRows() was still running. The signature now makes that impossible to miss.
export async function flushEnrichment(): Promise<void> {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
  if (pgEnabled()) await flushRows()
  snapshot()   // synchronous, and already holds everything in memory
}

function startTimers(): void {
  if (timersStarted) return
  timersStarted = true
  for (const sig of ['exit', 'SIGINT', 'SIGTERM'] as const) {
    try { process.once(sig, () => { try { snapshot() } catch {} }) } catch {}
  }
  if (pgEnabled()) { const t = setInterval(() => { void syncIn() }, SYNC_MS); t.unref?.() }
  const n = setInterval(snapshot, SNAP_MS); n.unref?.()
}

function scheduleFlush(): void {
  startTimers()
  if (!loggedMode) { loggedMode = true; console.log('[enrich-store] persistence = ' + (pgEnabled() ? 'rows' : 'file')) }
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    if (pgEnabled()) void flushRows()
    else snapshot()
  }, FLUSH_MS)
}

export function patchEnrichment(id: string, patch: Partial<Enrichment>): Enrichment {
  const cur = load()[id] || {}
  const next = { ...cur, ...patch, enrichedAt: Date.now() } as Enrichment
  // Visible to readers in this process immediately; persisted on the next flush.
  load()[id] = next
  const queued = pending.get(id) || {}
  pending.set(id, { ...queued, ...patch, enrichedAt: next.enrichedAt })
  memDirty = true
  scheduleFlush()
  return next
}

// Clearing has to reach the rows as well. Without that the row survives, syncIn
// merges it back within SYNC_MS, and the admin who cleared the cache to make an
// edit visible watches the stale enrichment reappear twenty seconds later.
export function clearEnrichment(id?: string) {
  if (!id) {
    save({})
    if (pgEnabled()) void pgTx(c => c.query('DELETE FROM enrich')).catch(() => {})
    return
  }
  pending.delete(id)
  const db = load(); delete db[id]; save(db)
  if (pgEnabled()) void pgTx(c => c.query('DELETE FROM enrich WHERE id = $1', [id])).catch(() => {})
}
