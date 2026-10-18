#!/usr/bin/env node
// ── انجمادِ seoSlug برای همهٔ آگهی‌های قدیمی (فاز ۳۰۹ک) ───────────────────────────
// چرا: URLِ canonicalِ آگهی باید «منجمد» باشد تا با هر اسکرپِ دوباره (که عنوان را عوض
// می‌کند) جابه‌جا نشود — وگرنه گوگل همان آگهی را «Page with redirect» می‌بیند و ایندکس
// نمی‌کند (ریشهٔ «آگهی‌ها اصلا ایندکس نمی‌شوند»). از فاز ۲۹۸ی آیتمِ تازه هنگامِ ساخت
// seoSlug می‌گیرد و آیتمِ قدیمی فقط موقعِ twin-merge «تنبل» منجمد می‌شد — پس هزاران
// آگهیِ قدیمی هنوز seoSlug ندارند و URLشان از عنوانِ جاری ساخته می‌شود (ناپایدار).
//
// این اسکریپت برای هر آگهیِ بی‌seoSlug یک‌بار همان مقدارِ `slugText(title, location)` را
// (دقیقاً همان تابعی که صفحه/سایت‌مپ استفاده می‌کنند) محاسبه و «قفل» می‌کند. پس از آن
// URLِ آگهی دیگر هرگز با تغییرِ عنوان جابه‌جا نمی‌شود → سایت‌مپ/canonical پایدار.
//
// ایمن و قابلِ تکرار: فقط ردیف‌هایی که seoSlug ندارند لمس می‌شوند؛ مقدارِ موجود هرگز
// بازنویسی نمی‌شود. آگهی‌ای که عنوان/محلهٔ هردو خالی دارد (slug خالی) رها می‌شود چون
// URLش با /listing/{id} پایدار است.
//
// اجرا (اول گزارشِ آزمایشی):
//   cd /var/www/melkjet/melkjet-nextjs
//   node --import ./scripts/reos-loader.mjs scripts/freeze-listing-slugs.mjs
// و برای اعمالِ واقعی:
//   node --import ./scripts/reos-loader.mjs scripts/freeze-listing-slugs.mjs --apply
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
// slugText همان تابعِ اپ است (slugify → ترجمهٔ فارسی به kebabِ ASCII). پس مقدارِ منجمد
// «عینِ» چیزی است که listingHref/صفحه/سایت‌مپ می‌سازند — هیچ اختلافی ممکن نیست.
const { slugText } = await import('../app/lib/listing-url.ts')

if (!pgEnabled()) { console.error('DATABASE_URL تنظیم نیست — این اسکریپت فقط روی مسیرِ PostgreSQL معنا دارد.'); process.exit(1) }

// آگهی (type='listing') که seoSlug ندارد یا خالی است.
const WHERE = `type = 'listing' AND (data->>'seoSlug' IS NULL OR data->>'seoSlug' = '')`

const before = await pgTx(c => c.query(`
  SELECT count(*) FILTER (WHERE type = 'listing') AS total,
         count(*) FILTER (WHERE ${WHERE}) AS missing
  FROM listings`))
const total = Number(before.rows[0].total), missing = Number(before.rows[0].missing)
console.log(`کلِ آگهی‌ها: ${total}   بدونِ seoSlugِ منجمد: ${missing}`)
if (missing === 0) { console.log('همه از قبل منجمد‌اند — چیزی برای انجماد نیست.'); process.exit(0) }

// ردیف‌های بی‌seoSlug را می‌کشیم (فقط id + عنوان + محله — سبک).
const rows = (await pgTx(c => c.query(
  `SELECT id, data->>'title' AS title, data->>'location' AS location FROM listings WHERE ${WHERE}`
))).rows

// slug را در JS با همان تابعِ اپ می‌سازیم؛ خالی‌ها را کنار می‌گذاریم (URLشان /listing/{id} پایدار است).
const updates = []
let emptySlug = 0
for (const r of rows) {
  const slug = slugText(r.title || '', r.location || '')
  if (slug) updates.push({ id: r.id, slug }); else emptySlug++
}

if (!APPLY) {
  console.log('\nنمونه‌ها (id → seoSlugِ منجمد):')
  for (const u of updates.slice(0, 5)) console.log('  ' + u.id + '  →  ' + u.slug)
  console.log(`\nقابلِ انجماد: ${updates.length}   بدونِ متن (رها می‌شوند، /listing/{id}): ${emptySlug}`)
  console.log('این اجرای آزمایشی بود — برای اعمالِ واقعی دوباره با --apply اجرا کن.')
  process.exit(0)
}

// اعمال در دسته‌های ۵۰۰تایی با UPDATE ... FROM (VALUES …) — سریع و پارامتری.
// jsonb_set فقط روی همین ردیف‌ها (که seoSlug نداشتند)؛ هیچ مقدارِ موجودی لمس نمی‌شود.
let done = 0
const CHUNK = 500
for (let i = 0; i < updates.length; i += CHUNK) {
  const batch = updates.slice(i, i + CHUNK)
  const params = []
  const values = batch.map((u, k) => { params.push(u.id, u.slug); return `($${k * 2 + 1}, $${k * 2 + 2})` }).join(',')
  const r = await pgTx(c => c.query(
    `UPDATE listings AS l
       SET data = jsonb_set(l.data, '{seoSlug}', to_jsonb(v.slug::text))
       FROM (VALUES ${values}) AS v(id, slug)
      WHERE l.id = v.id`,
    params,
  ))
  done += r.rowCount || 0
  console.log(`  … ${done}/${updates.length}`)
}
console.log(`منجمد شد: ${done}`)

const after = await pgTx(c => c.query(`SELECT count(*) FILTER (WHERE ${WHERE}) AS missing FROM listings`))
console.log('باقی‌مانده (بی‌متن/رهاشده): ' + after.rows[0].missing)

// بالابردنِ revِ scraper_meta تا هر چهار اینستنس در خواندنِ بعدی کشِ تازه بگیرند
// (وگرنه تا کفِ بازخوانی، اسنپ‌شاتِ پیش‌از‌انجماد را سرو می‌کنند).
await pgTx(c => c.query(`
  UPDATE kv SET data = jsonb_set(data, '{__rev}', to_jsonb(COALESCE((data->>'__rev')::bigint, 0) + 1)), updated_at = now()
  WHERE key = 'scraper_meta'`))
console.log('rev بالا رفت — اینستنس‌ها در خواندنِ بعدی تازه می‌شوند. سپس در Search Console سایت‌مپ را Resubmit کن.')
process.exit(0)
