#!/usr/bin/env node
// چرا کلِ سایت کند است: بارگذاریِ جدولِ آگهی‌ها.
//
// users-page-check timed one page and found 21,164ms of its 21,538ms was a single
// call: loading all 46,336 listings. Two paths pay that cost:
//
//   read  - load() reloads every row whenever the global rev changes, and the
//           floor between reloads is 15s while a reload takes ~21s
//   write - mutate() runs `SELECT data FROM listings` inside the transaction, so
//           every one of its 22 call sites loads the whole table while holding the
//           writer lock on the metadata row
//
// Before rewriting either, this measures whether an incremental reload is actually
// viable: how long the full read takes, how long an id-only read takes (to detect
// deletions), and how long a "changed since" delta takes. If the delta is cheap,
// the fix is to stop re-reading rows that did not change.
//
// اجرا:  node --import ./scripts/reos-loader.mjs scripts/listings-load-check.mjs
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

const { pgEnabled, pgTx } = await import('../app/lib/db.ts')
if (!pgEnabled()) { console.error('دیتابیس در دسترس نیست.'); process.exit(1) }

const ms = t => Math.round(t) + 'ms'
async function timed(label, sql, params = []) {
  const t0 = Date.now()
  const r = await pgTx(c => c.query(sql, params))
  const took = Date.now() - t0
  console.log('  ' + label.padEnd(38) + String(r.rowCount).padStart(7) + ' ردیف   ' + ms(took).padStart(9))
  return { took, rows: r.rows }
}

const size = await pgTx(c => c.query(`
  SELECT count(*)::int AS n,
         pg_size_pretty(pg_total_relation_size('listings')) AS total,
         pg_size_pretty(avg(pg_column_size(data))::bigint) AS avg_row
  FROM listings`))
console.log('جدولِ listings: ' + size.rows[0].n + ' ردیف، ' + size.rows[0].total + '، میانگینِ هر ردیف ' + size.rows[0].avg_row)
console.log('')

console.log('— آنچه امروز در هر بازخوانی و هر نوشتن اجرا می‌شود —')
const full = await timed('SELECT data (همه)', 'SELECT data FROM listings ORDER BY scraped_at DESC')

console.log('')
console.log('— آنچه یک بازخوانیِ افزایشی لازم دارد —')
const ids = await timed('SELECT id (برای تشخیصِ حذف)', 'SELECT id FROM listings')
for (const mins of [5, 60, 1440]) {
  await timed('SELECT data تغییرکرده در ' + mins + ' دقیقه', `
    SELECT data FROM listings WHERE scraped_at > (extract(epoch from now()) * 1000) - $1`, [mins * 60 * 1000])
}

// نیمهٔ نویسندهٔ بازخوانیِ افزایشی: آیا نویسنده‌ها واقعاً شناسه‌ها را ثبت می‌کنند؟
// اگر لاگ خالی باشد، خواننده هرگز مسیرِ دلتا را پیدا نمی‌کند و همیشه کامل می‌خواند —
// بدونِ این بخش، نبودنِ خطِ delta در لاگ دو تفسیرِ مختلف دارد و قابلِ تفکیک نیست.
console.log('')
console.log('— لاگِ تغییر در متاداتا (پایهٔ بازخوانیِ افزایشی) —')
try {
  const mr = await pgTx(c => c.query("SELECT data->'__rev' AS rev, data->'__log' AS log, pg_column_size(data) AS bytes FROM kv WHERE key='scraper_meta'"))
  if (!mr.rows.length) console.log('  سندِ scraper_meta نیست — مهاجرت هنوز اجرا نشده؟')
  else {
    const rev = mr.rows[0].rev, log = mr.rows[0].log || [], bytes = Number(mr.rows[0].bytes)
    console.log('  rev کنونی: ' + rev + '   ورودیِ لاگ: ' + log.length + '   حجمِ سند: ' + Math.round(bytes / 1024) + ' KB')
    if (!log.length) {
      console.log('  ✗ لاگ خالی است — یا از دیپلوی تا حالا هیچ نوشتنی نبوده، یا نویسنده‌ها ثبت نمی‌کنند.')
    } else {
      const withIds = log.filter(e => (e.ids || []).length || (e.del || []).length).length
      const fulls = log.filter(e => e.full).length
      console.log('  ورودیِ دارای شناسه: ' + withIds + '   ورودیِ full (درشت، بازخوانیِ کامل): ' + fulls)
      for (const e of log.slice(-5)) {
        console.log('    rev ' + e.rev + (e.full ? '  full' : '  ids=' + (e.ids || []).length + ' del=' + (e.del || []).length))
      }
      const consecutive = log.every((e, i) => i === 0 || e.rev === log[i - 1].rev + 1)
      console.log(consecutive ? '  ✓ revها پیوسته‌اند — خواننده می‌تواند به دلتا اعتماد کند.'
                          : '  ✗ جایِ خالی در revها — یک مسیرِ نوشتن لاگ نمی‌گذارد (باید پیدا شود).')
    }
  }
} catch (e) { console.log('  خطا: ' + (e?.message || e)) }

console.log('')
const idsPlusDelta = ids.took
if (idsPlusDelta * 5 < full.took) {
  console.log('✓ بازخوانیِ افزایشی صرف می‌کند: خواندنِ شناسه‌ها ' + ms(ids.took) + ' در برابرِ ' + ms(full.took) + ' برای کلِ جدول.')
} else {
  console.log('✗ حتی خواندنِ شناسه‌ها هم گران است (' + ms(ids.took) + ') — مسئله پهنای‌باندِ دیتابیس نیست، جای دیگری است.')
}
process.exit(0)
