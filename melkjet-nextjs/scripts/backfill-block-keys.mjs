#!/usr/bin/env node
// SCALE-2M مرحلهٔ A — پرکردنِ ستونِ block_keys برای ردیف‌های موجودِ listings.
//
// block_keys تازه اضافه شده، پس همهٔ ردیف‌های قبلی NULL‌اند. مسیرهای نوشتن از حالا خودشان
// پرش می‌کنند (هر آگهی که دوباره اسکرپ/ویرایش شود)، ولی برای پوششِ کلِ جدول این یک‌بار لازم است.
// فاز A هیچ مسیرِ خواندنی از block_keys استفاده نمی‌کند، پس این backfill رفتار را عوض نمی‌کند؛
// فقط داده را برای مرحلهٔ B (dedupِ بلوکی) آماده می‌کند. امن برای اجرای دوباره (فقط NULLها).
//
// دسته‌ای و بدونِ قفلِ طولانی: هر دسته یک تراکنشِ کوچکِ UPDATE by-id است، نه یک UPDATEِ
// سراسریِ جدول. آگهی‌ها blockKeys واقعی می‌گیرند؛ نوع‌های دیگر آرایهٔ خالی (تا دوباره انتخاب نشوند).
//
// اجرا:  node --import ./scripts/reos-loader.mjs scripts/backfill-block-keys.mjs [--apply]
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
const { fieldsOf, blockKeys } = await import('../app/lib/listing-similarity.ts')
if (!pgEnabled()) { console.error('دیتابیس در دسترس نیست.'); process.exit(1) }

// محاسبهٔ کلیدهای بلوک — عینِ listingBlockKeys در scraper-store (فقط آگهی‌ها؛ خطا = آرایهٔ خالی).
function keysFor(type, data) {
  if (type !== 'listing') return []
  try { return blockKeys(fieldsOf(data)) } catch { return [] }
}

const before = await pgTx(c => c.query(`
  SELECT count(*) AS total,
         count(*) FILTER (WHERE block_keys IS NULL) AS missing,
         count(*) FILTER (WHERE block_keys IS NULL AND type='listing') AS missing_listings
  FROM listings`))
console.log('کلِ ردیف‌ها: ' + before.rows[0].total +
  '   بدونِ block_keys: ' + before.rows[0].missing +
  '   (آگهی: ' + before.rows[0].missing_listings + ')')

if (Number(before.rows[0].missing) === 0) { console.log('چیزی برای پرکردن نیست.'); process.exit(0) }

if (!APPLY) {
  const s = await pgTx(c => c.query(`SELECT id, type, data FROM listings WHERE block_keys IS NULL AND type='listing' LIMIT 5`))
  for (const r of s.rows) console.log('  نمونه ' + r.id + ' → [' + keysFor(r.type, r.data).join(', ') + ']')
  console.log('اجرای آزمایشی — برای اعمالِ واقعی: --apply')
  process.exit(0)
}

const BATCH = 500
let done = 0
for (;;) {
  const rows = await pgTx(c => c.query(`SELECT id, type, data FROM listings WHERE block_keys IS NULL LIMIT $1`, [BATCH]))
  if (!rows.rows.length) break
  await pgTx(async (c) => {
    for (const r of rows.rows) {
      await c.query(`UPDATE listings SET block_keys = $2 WHERE id = $1`, [r.id, keysFor(r.type, r.data)])
    }
  })
  done += rows.rows.length
  process.stdout.write('\r  پر شد: ' + done)
}
process.stdout.write('\n')

const after = await pgTx(c => c.query(`SELECT count(*) FILTER (WHERE block_keys IS NULL) AS missing FROM listings`))
console.log('باقی‌مانده: ' + after.rows[0].missing)
console.log('تمام. مرحلهٔ A کامل شد — block_keys روی همهٔ ردیف‌ها نشست (رفتارِ خواندن عوض نشده).')
process.exit(0)
