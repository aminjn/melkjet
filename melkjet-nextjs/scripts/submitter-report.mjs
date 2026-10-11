// گزارشِ «ثبت‌کننده‌های آگهی» — برای بررسیِ انباشتِ «منتظر» (مثلاً یک شمارهٔ انبوه‌ثبت‌کننده).
// روی سرور (جایی که DATABASE_URL ست است) اجرا کن:
//   node --import ./scripts/reos-loader.mjs scripts/submitter-report.mjs [شمارهٔ تلفن]
// بدونِ آرگومان: ۲۰ ثبت‌کنندهٔ پرتعداد را با تفکیکِ وضعیت نشان می‌دهد.
// با آرگومانِ شماره: جزئیاتِ همان شماره (وضعیت‌ها + نمونه‌ها + دلیلِ ممیزی + «واقعی به‌نظر می‌رسد؟»).
//
// نکتهٔ مهم: Next خودش .env.production.local را می‌خواند، ولی اسکریپتِ مستقیمِ node نه — پس
// بدونِ این بارگذاری، DATABASE_URL ست نمی‌شود و استور به «فایلِ منجمدِ قدیمی» می‌افتد (نه پایگاهِ
// زنده). این بلوک env را از .env.production.local می‌خواند تا داده واقعاً از PostgreSQL بیاید.
import { readFileSync } from 'fs'
if (!process.env.DATABASE_URL) {
  for (const f of ['.env.production.local', '.env.local', '.env']) {
    try {
      for (const line of readFileSync(f, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
    } catch { /* فایل نبود */ }
  }
}
const { listItems } = await import('../app/lib/scraper-store.ts')
console.log(process.env.DATABASE_URL ? '🗄  منبع: PostgreSQL (زنده)\n' : '⚠️  DATABASE_URL پیدا نشد — دادهٔ فایلِ قدیمی (ممکن است ناقص باشد)\n')

const FA = /[۰-۹]/g
const faMap = d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString()
const norm = p => String(p || '').replace(FA, faMap).replace(/\D/g, '')
const arg = norm(process.argv[2] || '')

const items = await listItems('listing')
console.log(`\nکلِ آگهی‌ها: ${items.length.toLocaleString('en-US')}\n`)

// آیا آگهی «واقعی» به‌نظر می‌رسد؟ (متراژ + قیمت + موقعیت دارد)
const areaOf = it => {
  const m = (it.meta || {})['متراژ'] || ''
  const n = parseInt(norm(m) || norm(it.title).match(/\d{2,4}/)?.[0] || '', 10)
  return Number.isFinite(n) ? n : 0
}
const looksReal = it => {
  const a = areaOf(it)
  const hasPrice = !!(it.price && norm(it.price).length >= 7)
  const hasLoc = !!(it.location || (it.meta || {})['شهر'])
  return a >= 15 && a <= 100000 && hasPrice && hasLoc
}

// گروه‌بندی بر اساسِ شماره
const by = new Map()
for (const it of items) {
  if (it.type !== 'listing') continue
  const ph = norm(it.phone)
  const key = ph || '(بدونِ شماره)'
  const g = by.get(key) || { total: 0, approved: 0, pending: 0, rejected: 0, duplicate: 0, real: 0, source: new Set(), samples: [] }
  g.total++
  g[it.status] = (g[it.status] || 0) + 1
  if (looksReal(it)) g.real++
  g.source.add(it.sourceId || '?')
  if (g.samples.length < 10) g.samples.push(it)
  by.set(key, g)
}

const fmt = g => `کل ${g.total} | ✅ ${g.approved || 0} · 🕒 ${g.pending || 0} · ❌ ${g.rejected || 0} · ♻️ ${g.duplicate || 0} | «واقعی» ${g.real}/${g.total} | منبع: ${[...g.source].join(',')}`

if (arg) {
  const g = by.get(arg)
  if (!g) { console.log(`شمارهٔ ${arg} هیچ آگهی‌ای ندارد.`); process.exit(0) }
  console.log(`📞 ${arg}\n${fmt(g)}\n`)
  console.log('— نمونه‌ها —')
  for (const it of g.samples) {
    const st = { approved: '✅', pending: '🕒', rejected: '❌', duplicate: '♻️' }[it.status] || '?'
    console.log(`${st} [${looksReal(it) ? 'واقعی' : 'مشکوک'}] ${it.title?.slice(0, 70)}`)
    console.log(`     قیمت: ${it.price || '—'} | متراژ: ${areaOf(it)} | ${it.location || '—'}`)
    if (it.aiReason) console.log(`     دلیل: ${it.aiReason.slice(0, 120)}`)
  }
  // تشخیصِ کلی
  const realPct = Math.round((g.real / g.total) * 100)
  console.log(`\n▶ ${realPct}٪ آگهی‌های این شماره «واقعی» به‌نظر می‌رسند (متراژ+قیمت+موقعیت).`)
  console.log(realPct >= 80 ? '  به‌احتمالِ زیاد منبعِ واقعی/معتبر است → مناسبِ تأیید (پس از نگاهِ نهاییِ تو).'
    : realPct <= 30 ? '  به‌احتمالِ زیاد اسپم/آشغال است → مناسبِ رد/حذف.'
    : '  مخلوط است — بهتر است با گِیتِ سلامت + تأییدِ خودکار پالایش شود.')
} else {
  const rows = [...by.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 20)
  console.log('— ۲۰ ثبت‌کنندهٔ پرتعداد —')
  for (const [ph, g] of rows) console.log(`${ph.padEnd(14)} ${fmt(g)}`)
  console.log('\nبرای جزئیاتِ یک شماره:  node --import ./scripts/reos-loader.mjs scripts/submitter-report.mjs <شماره>')
}
process.exit(0)
