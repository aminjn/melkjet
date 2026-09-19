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
//
// The generator is fixed, but a summary is only ever built once (analysisOk), so
// the entries already in the cache would keep their Latin digits forever. This
// rewrites those in place - summary only, nothing else is touched.
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

const { listItems } = await import('../app/lib/scraper-store.ts')
const { getEnrichment, patchEnrichment, flushEnrichment } = await import('../app/lib/enrich-store.ts')

const items = await listItems('listing', { publicOnly: true })
if (!items.length) { console.error('هیچ آگهیِ عمومی‌ای خوانده نشد — DATABASE_URL را بررسی کنید.'); process.exit(1) }

const hits = []
for (const it of items) {
  const a = getEnrichment(it.id)?.analysis
  const s = a && typeof a.summary === 'string' ? a.summary : ''
  if (s && /[0-9]/.test(s)) hits.push({ id: it.id, a, before: s, after: enToFa(s) })
}

console.log('آگهیِ عمومی: ' + items.length)
console.log('خلاصهٔ دارایِ رقمِ لاتین: ' + hits.length)
for (const h of hits.slice(0, 3)) {
  console.log('  قبل:  ' + h.before.slice(0, 100))
  console.log('  بعد:  ' + h.after.slice(0, 100))
}
if (!hits.length) { console.log('چیزی برای ترمیم نیست.'); process.exit(0) }
if (!APPLY) { console.log('\nنمایشی بود. برای اعمال: --apply'); process.exit(0) }

for (const h of hits) patchEnrichment(h.id, { analysis: { ...h.a, summary: h.after } })
flushEnrichment()
console.log('\nاعمال شد: ' + hits.length)
console.log('اینستنس‌ها تا ۲۰ ثانیهٔ بعد ردیف‌ها را sync می‌کنند؛ صفحه‌های کش‌شده با revalidate بعدی تازه می‌شوند.')
process.exit(0)
