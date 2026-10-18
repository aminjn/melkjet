#!/usr/bin/env node
// ── راستی‌آزماییِ سئوِ آگهی‌ها از اپِ زنده (نه از حرفِ من) ─────────────────────────
// برای هر آگهیِ نمونه این سه چیز را «واقعاً» از سرورِ زنده می‌سنجد و PASS/FAIL می‌دهد:
//   ۱) صفحه با وضعیتِ ۲۰۰ برمی‌گردد (نه ۳۰۸/۴۰۴/۵xx)
//   ۲) هیچ ریدایرکتی رخ نمی‌دهد (frozen URL باید مستقیم ۲۰۰ بدهد)
//   ۳) تگِ <link rel="canonical"> «دقیقاً» برابرِ همان URLِ درخواستی است
// اگر این سه برای همهٔ نمونه‌ها PASS شود، یعنی زنجیرهٔ ایندکس (که گوگل می‌بیند) سالم است.
//
// اجرا روی سرور:
//   cd /var/www/melkjet/melkjet-nextjs
//   node --import ./scripts/reos-loader.mjs scripts/verify-listing-seo.mjs            # ۳۰ نمونه از localhost:3001
//   node --import ./scripts/reos-loader.mjs scripts/verify-listing-seo.mjs --n=60     # نمونهٔ بیشتر
//   node --import ./scripts/reos-loader.mjs scripts/verify-listing-seo.mjs --base=https://melkjet.com   # از مسیرِ عمومی/CDN
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

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d }
const N = Math.max(1, Number(arg('n', '30')) || 30)
const BASE = (arg('base', 'http://127.0.0.1:3001')).replace(/\/$/, '')
const PUBLIC = 'https://melkjet.com'   // canonical همیشه باید دامنهٔ عمومی باشد، فارغ از این‌که از کجا fetch می‌کنیم

const { pgEnabled, pgTx } = await import('../app/lib/db.ts')
const { listingHref } = await import('../app/lib/listing-url.ts')
if (!pgEnabled()) { console.error('DATABASE_URL تنظیم نیست — این اسکریپت فقط روی سرور معنا دارد.'); process.exit(1) }

// نمونهٔ تصادفیِ آگهی‌های seoSlug‌دار.
const rows = (await pgTx(c => c.query(
  `SELECT id, data->>'title' AS title, data->>'location' AS location, data->>'seoSlug' AS slug
   FROM listings WHERE type='listing' AND data->>'seoSlug' <> '' ORDER BY random() LIMIT $1`, [N]
))).rows
if (!rows.length) { console.error('هیچ آگهیِ seoSlug‌داری پیدا نشد — اول اسکریپتِ انجماد را اجرا کن.'); process.exit(1) }

console.log(`سنجشِ ${rows.length} آگهی از ${BASE} (canonical باید ${PUBLIC}/listing/… باشد)\n`)
let pass = 0, fail = 0
const fails = []

for (const r of rows) {
  const path = listingHref(r.id, r.title, r.location, r.slug)   // عینِ همان چیزی که canonical/سایت‌مپ می‌سازند
  const want = `${PUBLIC}${path}`
  let status = 0, redirected = false, canon = '', err = ''
  try {
    const res = await fetch(`${BASE}${path}`, { redirect: 'manual', headers: { 'user-agent': 'melkjet-seo-verify' } })
    status = res.status
    redirected = status >= 300 && status < 400
    if (status === 200) {
      const html = await res.text()
      const m = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)
      const h = m && m[0].match(/href=["']([^"']+)["']/i)
      canon = h ? h[1] : ''
    }
  } catch (e) { err = String(e?.message || e) }

  const ok = status === 200 && !redirected && canon === want
  if (ok) { pass++ }
  else { fail++; fails.push({ path, status, redirected, canon, want, err }) }
  const mark = ok ? '✅' : '❌'
  console.log(`${mark} ${status || err || '—'}  ${path}${!ok && canon && canon !== want ? `\n      canonical=${canon}  ولی باید=${want}` : ''}${redirected ? '  (ریدایرکت!)' : ''}`)
}

console.log(`\n── نتیجه: ${pass} PASS ، ${fail} FAIL از ${rows.length} ──`)
if (fail === 0) {
  console.log('✅ همه سالم: هر آگهی ۲۰۰ می‌دهد، ریدایرکت ندارد، و canonicalش دقیقاً خودش است — دقیقاً چیزی که گوگل برای ایندکس می‌خواهد.')
} else {
  console.log('❌ برخی نمونه‌ها مشکل دارند (بالا با جزئیات). این یعنی هنوز جایی می‌لنگد.')
  process.exitCode = 1
}
process.exit()
