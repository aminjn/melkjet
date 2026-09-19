#!/usr/bin/env node
// چند درصدِ آگهی‌ها واقعاً «شبیهِ دیوار نیستند»؟
//
// Phase 228 rebuilds the <title> and meta description of a listing page from the
// listing's own structured fields instead of copying Divar's text. But that
// rebuild has a guard:
//
//     if (!kind || !d.areaNum || !place) return d.title
//
// - when the property kind or the area cannot be derived, the page silently falls
// back to the Divar title, and that page is duplicate content again. Nothing
// reports how often that happens, so this counts it on the real data.
//
// It calls the very same functions the page calls, so the audit and the page can
// never disagree about what a rebuilt title looks like.
//
// اجرا:  node --import ./scripts/reos-loader.mjs scripts/seo-title-audit.mjs [--samples N]
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

const si = process.argv.indexOf('--samples')
const NSAMP = si > -1 ? Math.max(0, parseInt(process.argv[si + 1], 10) || 0) : 5

const { listItems } = await import('../app/lib/scraper-store.ts')
const { deriveListing, seoListingTitle, seoListingDescription } = await import('../app/lib/listing-search.ts')

const items = await listItems('listing', { publicOnly: true })
if (!items.length) { console.error('هیچ آگهیِ عمومی‌ای خوانده نشد — DATABASE_URL را بررسی کنید.'); process.exit(1) }

const bucket = { rebuilt: [], noKind: [], noArea: [], noBoth: [], unknownLoc: [] }
let descShort = 0

for (const it of items) {
  const d = deriveListing(it)
  const t = seoListingTitle(d)
  const kindOk = !!(d.kind || '').split('/')[0]
  const areaOk = !!d.areaNum
  if (!kindOk && !areaOk) bucket.noBoth.push(it)
  else if (!kindOk) bucket.noKind.push(it)
  else if (!areaOk) bucket.noArea.push(it)
  else {
    bucket.rebuilt.push(it)
    if (/نامشخص/.test(t)) bucket.unknownLoc.push(it)
  }
  if (seoListingDescription(d, it.price).length < 120) descShort++
}

const n = items.length
const pct = x => (Math.round((x / n) * 1000) / 10).toFixed(1) + '٪'
const fellBack = bucket.noKind.length + bucket.noArea.length + bucket.noBoth.length

console.log('آگهیِ عمومی (ایندکس‌شدنی): ' + n)
console.log('')
console.log('عنوانِ بازساخته (شبیهِ دیوار نیست): ' + bucket.rebuilt.length + '  ' + pct(bucket.rebuilt.length))
console.log('برگشت به عنوانِ دیوار (تکراری):    ' + fellBack + '  ' + pct(fellBack))
console.log('    بدونِ نوعِ ملک:        ' + bucket.noKind.length)
console.log('    بدونِ متراژ:           ' + bucket.noArea.length)
console.log('    بدونِ هیچ‌کدام:        ' + bucket.noBoth.length)
console.log('')
console.log('عنوانِ بازساخته ولی «در نامشخص»: ' + bucket.unknownLoc.length + '  ' + pct(bucket.unknownLoc.length))
console.log('توضیحِ متایِ کوتاه‌تر از ۱۲۰ نویسه: ' + descShort)

// متنِ بدنهٔ صفحه. دقت کن: enrich.description «متنِ یکتا» نیست — خروجیِ fetchDivarPost است،
// یعنی متنِ کاملِ خودِ دیوار (enrich-warm.ts:54). محتوایی که واقعاً مالِ ماست analysis.summary
// است (از دادهٔ ساختاریافته ساخته می‌شود، بدونِ یک کلمه از دیوار) — همین شمرده می‌شود.
// کلیدِ فایل و ردیفِ enrich هر دو (فایل = پایه، ردیف = دلتا).
const withSummary = new Set()
try {
  if (existsSync('.enrich-data.json')) {
    const raw = JSON.parse(readFileSync('.enrich-data.json', 'utf-8'))
    for (const [k, v] of Object.entries(raw)) if (String(v?.analysis?.summary || '').trim()) withSummary.add(k)
  }
} catch {}
try {
  const { pgEnabled, pgTx } = await import('../app/lib/db.ts')
  if (pgEnabled()) {
    const r = await pgTx(c => c.query("SELECT id FROM enrich WHERE coalesce(data->'analysis'->>'summary','') <> ''"))
    for (const x of r.rows) withSummary.add(x.id)
  }
} catch {}
const bodyUnique = items.filter(it => withSummary.has(it.id)).length
console.log('')
console.log('محتوایِ ساختهٔ ما در بدنه (analysis.summary): ' + bodyUnique + '  ' + pct(bodyUnique))
console.log('بدونِ محتوایِ ساختهٔ ما:                 ' + (n - bodyUnique) + '  ' + pct(n - bodyUnique))

const show = (label, arr) => {
  if (!NSAMP || !arr.length) return
  console.log('')
  console.log('— ' + label + ' —')
  for (const it of arr.slice(0, NSAMP)) {
    const d = deriveListing(it)
    console.log('  دیوار:   ' + (it.title || '').slice(0, 90))
    console.log('  ملک‌جت:  ' + seoListingTitle(d).slice(0, 90))
    console.log('  مکان: ' + (it.location || '—') + '   نوع: ' + (d.kind || '—') + '   متراژ: ' + (d.areaNum || '—'))
    console.log('')
  }
}
show('نمونهٔ بازساخته', bucket.rebuilt)
show('نمونهٔ بدونِ نوعِ ملک', bucket.noKind)
show('نمونهٔ بدونِ متراژ', bucket.noArea)
show('نمونهٔ بدونِ هیچ‌کدام', bucket.noBoth)
show('نمونهٔ «در نامشخص»', bucket.unknownLoc)

process.exit(0)
