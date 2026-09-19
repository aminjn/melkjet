#!/usr/bin/env node
// هرسِ تحلیل‌های یتیم — کلیدهایی که آگهی‌شان دیگر وجود ندارد.
//
// Every re-scrape of a listing mints a new id, so the enrichment it already had is
// stranded under the old key. 29.6% of the 53.6MB file (7,206 keys) pointed at
// listings that are no longer in the table, and every write of that file carried
// the dead weight - as did every re-parse of it in the other three pm2 instances.
//
// Two things make this safe to delete: enrichment is a cache, and the key is only
// reachable through a listing id that no longer exists. If the listing ever comes
// back it comes back with a new id anyway, so nothing here could have been read.
//
// The reload at the end is not optional. Each instance holds the whole map in
// memory and snapshot() writes { ...disk, ...memory }, so pruning the file alone
// would be undone by the next snapshot. Reloading makes them re-read the pruned
// file as their baseline.
//
// اجرا:  node --import ./scripts/reos-loader.mjs scripts/enrich-prune.mjs [--delete]
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

function loadEnv(f) {
  if (!existsSync(f)) return
  for (const l of readFileSync(f, 'utf-8').split('\n')) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (process.env[m[1]] === undefined) process.env[m[1]] = v
  }
}
loadEnv('.env.production.local'); loadEnv('.env')

const DELETE = process.argv.includes('--delete')
const FILE = '.enrich-data.json'
const mb = n => (n / 1048576).toFixed(1) + 'MB'

const { pgEnabled, pgTx } = await import('../app/lib/db.ts')
const { readJsonFresh, writeJsonCached, withFileLock } = await import('../app/lib/json-file.ts')

if (!pgEnabled()) { console.error('دیتابیس در دسترس نیست — هرس انجام نشد.'); process.exit(1) }
if (!existsSync(FILE)) { console.error('no ' + FILE); process.exit(1) }

const before = readFileSync(FILE).length
const db = JSON.parse(readFileSync(FILE, 'utf-8'))
const keys = Object.keys(db)

// Every id the table knows about, whatever its type or status. A key is only an
// orphan if nothing in listings could ever reach it again.
const r = await pgTx(c => c.query('SELECT id FROM listings'))
const live = new Set(r.rows.map(x => x.id))

// If the query came back implausibly small, something is wrong with the database,
// not with the cache - and deleting on that basis would wipe the whole file.
if (live.size < 1000) { console.error('فهرستِ آگهی‌ها مشکوک است (' + live.size + ') — متوقف شدم.'); process.exit(1) }

const orphans = keys.filter(k => live.has(k) === false)
console.log('کلیدهای فایل: ' + keys.length + '   آگهیِ زنده: ' + live.size)
console.log('یتیم: ' + orphans.length + '  (' + (keys.length ? (orphans.length / keys.length * 100).toFixed(1) : '0') + '٪)   حجمِ فعلی: ' + mb(before))

if (orphans.length === 0) { console.log('چیزی برای هرس نیست.'); process.exit(0) }
if (orphans.length > keys.length * 0.6) { console.error('بیش از ۶۰٪ یتیم شمرده شد — مشکوک است، متوقف شدم.'); process.exit(1) }

if (!DELETE) { console.log('اجرای آزمایشی — برای حذفِ واقعی: --delete'); process.exit(0) }

const gone = new Set(orphans)
withFileLock(FILE, () => {
  const disk = readJsonFresh(FILE, {})
  for (const k of gone) delete disk[k]
  writeJsonCached(FILE, disk)   // atomic write, and its shrink guard still applies
})
const after = readFileSync(FILE).length
console.log('فایل: ' + mb(before) + ' → ' + mb(after))

// The rows are deltas for live listings; an orphan's row is dead too.
for (let i = 0; i < orphans.length; i += 500) {
  const chunk = orphans.slice(i, i + 500)
  try { await pgTx(c => c.query('DELETE FROM enrich WHERE id = ANY($1::text[])', [chunk])) } catch {}
}
const left = await pgTx(c => c.query('SELECT count(*) AS n FROM enrich'))
console.log('ردیف‌های باقی‌مانده: ' + left.rows[0].n)

// Without this the next snapshot writes the orphans straight back from memory.
try {
  execSync('pm2 reload ecosystem.config.js --update-env', { stdio: 'ignore' })
  console.log('اینستنس‌ها reload شدند — عکسِ تازه مبنای حافظه شد.')
} catch {
  console.error('✗ reload نشد — حتماً دستی بزن: pm2 reload ecosystem.config.js --update-env')
}
process.exit(0)
