#!/usr/bin/env node
// ترمیمِ مکان‌هایی که پیشوندِ زمانِ دیوار در آن‌ها گیر کرده است.
//
// Divar's listing card puts the relative time and the neighbourhood on one line, and
// the scraper stored the whole line: 616 rows hold values like
// «۱۴ساعتپیشدرسلسبیلشمالی». Nothing can match those - not the loc_norm trigram
// filter, not /locations, not the neighbourhood browse in the game - so those
// listings are invisible to every place-based path in the product.
//
// The door is closed in scraper-store now; this repairs what already came through.
// resolveScrapedLocation does the work, so the scrape path and this script cannot
// disagree about what a cleaned location looks like.
//
// اجرا:  node --import ./scripts/reos-loader.mjs scripts/repair-locations.mjs [--apply]
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
const { hasTimePrefix } = await import('../app/lib/location-match.ts')
const { resolveScrapedLocation } = await import('../app/lib/geo-store.ts')
if (!pgEnabled()) { console.error('دیتابیس در دسترس نیست.'); process.exit(1) }

// Cheap SQL pre-filter, exact test in JS - the prefix uses Persian digits and
// optional ZWNJ, which is painful to express as a Postgres regex and easy here.
const rows = await pgTx(c => c.query(`
  SELECT id, data->>'location' AS loc, data->'meta'->>'شهر' AS city
  FROM listings WHERE data->>'location' LIKE '%پیش%'`))
const bad = rows.rows.filter(r => hasTimePrefix(r.loc || ''))
console.log('کاندیدا: ' + rows.rows.length + '   واقعاً آلوده: ' + bad.length)
if (!bad.length) { console.log('چیزی برای ترمیم نیست.'); process.exit(0) }

let resolved = 0, plain = 0, unchanged = 0
const fixes = []
for (const r of bad) {
  const next = resolveScrapedLocation(r.loc, r.city || undefined)
  if (!next || next === r.loc) { unchanged++; continue }
  // A value the geo tree recognised comes back without the timestamp and with the
  // tree's own spelling; one it did not still loses the timestamp.
  if (hasTimePrefix(next)) { unchanged++; continue }
  const viaTree = !!r.city && next.startsWith(r.city)
  if (viaTree) resolved++; else plain++
  fixes.push({ id: r.id, from: r.loc, to: next })
}
console.log('با درختِ محله‌ها حل شد: ' + resolved + '   فقط زمان حذف شد: ' + plain + '   بدونِ تغییر: ' + unchanged)
for (const f of fixes.slice(0, 8)) console.log('  ' + f.from + '  →  ' + f.to)

if (!APPLY) { console.log('اجرای آزمایشی — برای اعمالِ واقعی: --apply'); process.exit(0) }

for (let i = 0; i < fixes.length; i += 200) {
  const chunk = fixes.slice(i, i + 200)
  await pgTx(async c => {
    for (const f of chunk) {
      await c.query(`UPDATE listings SET data = jsonb_set(data, '{location}', to_jsonb($2::text)) WHERE id = $1`, [f.id, f.to])
    }
  })
}
console.log('اعمال شد: ' + fixes.length)

// loc_norm is a generated column, so the trigram index follows the update on its
// own - but the instances keep their cached snapshot until the rev moves.
await pgTx(c => c.query(`
  UPDATE kv SET data = jsonb_set(data, '{__rev}', to_jsonb(COALESCE((data->>'__rev')::bigint, 0) + 1)), updated_at = now()
  WHERE key = 'scraper_meta'`))
console.log('rev بالا رفت.')
process.exit(0)
