#!/usr/bin/env node
// پرکردنِ firstSeenAt برای آگهی‌هایی که قبل از افزودنِ این فیلد ثبت شده‌اند.
//
// firstSeenAt was added later, so ~9,400 listings never got one. /api/reos/role-feed
// sorts newest-first on it, and its fallback was 0, which parked every one of those
// listings permanently at the bottom of the feed. The code now falls back to
// scrapedAt, so this backfill is no longer load-bearing - but leaving the field
// empty means the distinction between "first seen" and "last scraped" stays lost
// for those rows, and every future consumer inherits the same trap.
//
// scrapedAt is the best available answer: for a listing never re-scraped it is
// exactly right, and for one that has been it is at least the correct order of
// magnitude. Rows that already have the field are never touched.
//
// اجرا:  node --import ./scripts/reos-loader.mjs scripts/backfill-first-seen.mjs [--apply]
import { readFileSync, existsSync } from 'node:fs'

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

const APPLY = process.argv.includes('--apply')
const { pgEnabled, pgTx } = await import('../app/lib/db.ts')
if (!pgEnabled()) { console.error('دیتابیس در دسترس نیست.'); process.exit(1) }

const WHERE = `data->'firstSeenAt' IS NULL AND scraped_at > 0`

const before = await pgTx(c => c.query(`
  SELECT count(*) AS total,
         count(*) FILTER (WHERE ${WHERE}) AS missing
  FROM listings`))
console.log('کلِ ردیف‌ها: ' + before.rows[0].total + '   بدونِ firstSeenAt: ' + before.rows[0].missing)

if (Number(before.rows[0].missing) === 0) { console.log('چیزی برای پرکردن نیست.'); process.exit(0) }

if (!APPLY) {
  const s = await pgTx(c => c.query(`
    SELECT id, scraped_at, to_timestamp(scraped_at/1000)::date AS as_date
    FROM listings WHERE ${WHERE} ORDER BY scraped_at LIMIT 3`))
  for (const r of s.rows) console.log('  نمونه: ' + r.id + '  →  ' + r.as_date.toISOString().slice(0, 10))
  console.log('اجرای آزمایشی — برای اعمالِ واقعی: --apply')
  process.exit(0)
}

// jsonb_set only on rows that lack the key, so this is safe to re-run and can
// never overwrite a real first-seen stamp with a later scrape.
const r = await pgTx(c => c.query(`
  UPDATE listings SET data = jsonb_set(data, '{firstSeenAt}', to_jsonb(scraped_at))
  WHERE ${WHERE}`))
console.log('پر شد: ' + r.rowCount)

const after = await pgTx(c => c.query(`SELECT count(*) FILTER (WHERE ${WHERE}) AS missing FROM listings`))
console.log('باقی‌مانده: ' + after.rows[0].missing)

// The scraper cache keys off a rev in kv; without bumping it the instances would
// serve the pre-backfill snapshot for up to their reload floor.
await pgTx(c => c.query(`
  UPDATE kv SET data = jsonb_set(data, '{__rev}', to_jsonb(COALESCE((data->>'__rev')::bigint, 0) + 1)), updated_at = now()
  WHERE key = 'scraper_meta'`))
console.log('rev بالا رفت — اینستنس‌ها در خواندنِ بعدی تازه می‌شوند.')
process.exit(0)
