#!/usr/bin/env node
// ارقامِ لاتین را از خلاصه‌های ساخته‌شده پاک می‌کند.
//
// analyze.ts builds analysis.summary from fact values, and those come in mixed:
// the area often arrives in Persian digits from Divar, the room count and the
// build year arrive as plain numbers. The result read
//
//     آپارتمان ۱۹۰ متر، 4 خوابه. سالِ ساختِ حدودِ 1395. برای فروش.
//
// That text is now rendered in the initial HTML and indexed as the listing's
// schema description, so the mixed digits are visible to both readers and Google.
// The generator is fixed, but a summary is only ever built once (analysisOk), so
// the entries already in the cache would keep their Latin digits forever.
//
// Why this writes the rows with SQL instead of calling patchEnrichment: the store
// flushes on a timer and flushEnrichment() does not await flushRows(), so the
// first version of this script had its 15,250 upserts cut off by process.exit.
// Writing the delta rows directly is the designed channel anyway - every instance
// merges them in within SYNC_MS and snapshots them into the file later.
//
// اجرا:  node --import ./scripts/reos-loader.mjs scripts/fix-summary-digits.mjs [--apply]
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
const FA = '۰۱۲۳۴۵۶۷۸۹'
const enToFa = s => String(s || '').replace(/[0-9]/g, d => FA[Number(d)])
const FILE = '.enrich-data.json'

const { pgEnabled, pgTx } = await import('../app/lib/db.ts')
if (!pgEnabled()) { console.error('دیتابیس در دسترس نیست.'); process.exit(1) }

// حالتِ مؤثر = ردیف (دلتایِ تازه‌تر) وگرنه فایل (پایه). هر دو خوانده می‌شوند،
// وگرنه چیزی که اینستنس‌ها تازه نوشته‌اند دیده نمی‌شود.
const analysisOf = new Map()
if (existsSync(FILE)) {
  const raw = JSON.parse(readFileSync(FILE, 'utf-8'))
  for (const [id, v] of Object.entries(raw)) if (v?.analysis) analysisOf.set(id, v.analysis)
}
const fileKeys = analysisOf.size
const rows = await pgTx(c => c.query("SELECT id, data->'analysis' AS a FROM enrich WHERE data ? 'analysis'"))
for (const r of rows.rows) if (r.a) analysisOf.set(r.id, r.a)

const hits = []
for (const [id, a] of analysisOf) {
  const s = typeof a?.summary === 'string' ? a.summary : ''
  if (s && /[0-9]/.test(s)) hits.push({ id, a, before: s, after: enToFa(s) })
}

console.log('خلاصه در فایل: ' + fileKeys + '   در ردیف‌ها: ' + rows.rows.length + '   مؤثر: ' + analysisOf.size)
console.log('دارایِ رقمِ لاتین: ' + hits.length)
for (const h of hits.slice(0, 3)) {
  console.log('  قبل:  ' + h.before.slice(0, 100))
  console.log('  بعد:  ' + h.after.slice(0, 100))
}
if (!hits.length) { console.log('چیزی برای ترمیم نیست.'); process.exit(0) }
if (!APPLY) { console.log('\nنمایشی بود. برای اعمال: --apply'); process.exit(0) }

// دسته‌دسته و await‌شده. data || EXCLUDED.data ادغامِ سطحی است، پس کلِ آبجکتِ
// analysis فرستاده می‌شود نه فقط summary — وگرنه بقیهٔ تحلیل پاک می‌شد.
const CHUNK = 500
let done = 0
for (let i = 0; i < hits.length; i += CHUNK) {
  const part = hits.slice(i, i + CHUNK)
  await pgTx(async c => {
    for (const h of part) {
      await c.query(
        `INSERT INTO enrich (id, data) VALUES ($1, $2::jsonb)
         ON CONFLICT (id) DO UPDATE SET data = enrich.data || EXCLUDED.data, updated_at = now()`,
        [h.id, JSON.stringify({ analysis: { ...h.a, summary: h.after }, enrichedAt: Date.now() })])
    }
  })
  done += part.length
  process.stdout.write('\r  نوشته‌شده: ' + done + '/' + hits.length)
}
console.log('')

// تأییدِ همان‌جا، از خودِ دیتابیس — نه از حافظه.
const left = await pgTx(c => c.query(
  "SELECT count(*)::int AS n FROM enrich WHERE data->'analysis'->>'summary' ~ '[0-9]'"))
console.log('باقی‌ماندهٔ دارایِ رقمِ لاتین در ردیف‌ها: ' + left.rows[0].n)
console.log('اینستنس‌ها تا ۲۰ ثانیه ردیف‌ها را sync می‌کنند و در اسنپ‌شاتِ بعدی در فایل می‌نشیند.')
process.exit(0)
