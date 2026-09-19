#!/usr/bin/env node
// عنوان‌هایی که عنوان نیستند: خطِ زمان‌دارِ کارتِ دیوار به‌جای عنوان.
//
// Divar's listing card carries a meta line - «۳ هفته پیش در تهران، هروی، خ مکران
// جنوبی» - and for some listings the scraper stored that line as the title. The
// same family as the 594 broken locations, this time in the title field. It shows
// up as the page's H1 and inside the URL slug, so fixing the metadata alone (which
// seoListingTitle now does) leaves the visible page and the address wrong.
//
// The real title is in the Divar post response and fetchDivarPost already returns
// it, so the first choice is always the real one. enrich-warm now applies it on
// every enrichment, which closes the door; this repairs what already came through.
//
// If Divar cannot be reached or the post is gone, the fallback is the title
// seoListingTitle already shows in the metadata - so the page, the URL and the
// meta tag end up saying the same thing instead of three different things.
//
// اجرا:  node --import ./scripts/reos-loader.mjs scripts/repair-titles.mjs [--apply] [--limit N]
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
const li = process.argv.indexOf('--limit')
const LIMIT = li > -1 ? Math.max(1, parseInt(process.argv[li + 1], 10) || 0) : 0
const nap = ms => new Promise(r => setTimeout(r, ms))

const { pgEnabled, pgTx } = await import('../app/lib/db.ts')
const { hasTimePrefix } = await import('../app/lib/location-match.ts')
const { fetchDivarPost, divarToken } = await import('../app/lib/divar-post.ts')
const { deriveListing, seoListingTitle } = await import('../app/lib/listing-search.ts')
const { repairTimePrefixTitle } = await import('../app/lib/scraper-store.ts')
if (!pgEnabled()) { console.error('دیتابیس در دسترس نیست.'); process.exit(1) }

// پیش‌فیلترِ ارزانِ SQL، آزمونِ دقیق در JS — پیشوند رقمِ فارسی و ZWNJ دارد.
const rows = await pgTx(c => c.query(
  "SELECT data FROM listings WHERE type='listing' AND data->>'title' LIKE '%پیش%'"))
let bad = rows.rows.map(r => r.data).filter(it => hasTimePrefix(it.title || ''))
console.log('کاندیدا: ' + rows.rows.length + '   واقعاً خراب: ' + bad.length)
if (!bad.length) { console.log('چیزی برای ترمیم نیست.'); process.exit(0) }
if (LIMIT) bad = bad.slice(0, LIMIT)

let fromDivar = 0, fromDerived = 0, stuck = 0, applied = 0
const samples = []

for (const it of bad) {
  let title = '', source = ''
  const token = divarToken(it.url)
  if (token) {
    try { const g = await fetchDivarPost(token); if (g.title && !hasTimePrefix(g.title)) { title = g.title.trim(); source = 'divar' } } catch {}
    await nap(500)   // دیوار را اشباع نکن (همان درسِ «روی ۱۲۶ گیر کرد»)
  }
  if (!title) {
    const t = seoListingTitle(deriveListing(it))
    if (t && !hasTimePrefix(t)) { title = t; source = 'derived' }
  }
  if (!title) { stuck++; continue }
  if (source === 'divar') fromDivar++; else fromDerived++
  if (samples.length < 6) samples.push({ before: it.title, after: title, source })
  if (APPLY) { try { if (await repairTimePrefixTitle(it.id, title)) applied++ } catch (e) { console.error('  ' + it.id + ': ' + (e?.message || e)) } }
}

console.log('عنوانِ واقعی از دیوار: ' + fromDivar + '   ساخته از دادهٔ آگهی: ' + fromDerived + '   بی‌چاره: ' + stuck)
for (const s of samples) {
  console.log('  [' + s.source + ']')
  console.log('    قبل: ' + s.before.slice(0, 95))
  console.log('    بعد: ' + s.after.slice(0, 95))
}
if (!APPLY) { console.log('\nنمایشی بود. برای اعمال: --apply'); process.exit(0) }

console.log('\nاعمال شد: ' + applied)
const left = await pgTx(c => c.query(
  "SELECT count(*)::int AS n FROM listings WHERE type='listing' AND data->>'title' LIKE '%پیش%'"))
console.log('کاندیدایِ باقی‌مانده در دیتابیس: ' + left.rows[0].n + '  (شاملِ عنوان‌هایی که واقعاً واژهٔ «پیش» دارند)')
console.log('آدرسِ قبلی با ۳۰۸ به آدرسِ تازه می‌رود، پس هیچ لینکی نمی‌شکند.')
process.exit(0)
