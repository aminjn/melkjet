// پاک‌کردنِ همهٔ آگهی‌های یک «شماره» (دادهٔ تست) + رکوردِ مالکش — دقیق، با پیش‌نمایشِ امن.
// روی سرور:
//   node --import ./scripts/reos-loader.mjs scripts/purge-submitter.mjs 09927757232            # فقط پیش‌نمایش
//   node --import ./scripts/reos-loader.mjs scripts/purge-submitter.mjs 09927757232 --apply     # واقعاً حذف
// تطبیق فقط با «شماره» است (نه نام «خسروی») تا اگر مشاورِ واقعی‌ای به همین نام بود، آسیب نبیند.
import { readFileSync } from 'fs'
if (!process.env.DATABASE_URL) {
  for (const f of ['.env.production.local', '.env.local', '.env']) {
    try { for (const line of readFileSync(f, 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') } } catch {}
  }
}
const { listItems, deleteItems, listOwners, deleteOwner } = await import('../app/lib/scraper-store.ts')

const FA = /[۰-۹]/g
const norm = p => String(p || '').replace(FA, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString()).replace(/\D/g, '')
const phone = norm(process.argv[2] || '')
const APPLY = process.argv.includes('--apply')
if (!phone) { console.log('شماره بده. مثال: ... purge-submitter.mjs 09927757232 [--apply]'); process.exit(1) }

console.log(process.env.DATABASE_URL ? '🗄  منبع: PostgreSQL (زنده)\n' : '⚠️  DATABASE_URL نیست — دادهٔ فایلِ قدیمی (احتمالاً اشتباه)\n')

const items = await listItems('listing')
const mine = items.filter(i => i.type === 'listing' && norm(i.phone) === phone)
const byStatus = {}
for (const it of mine) byStatus[it.status] = (byStatus[it.status] || 0) + 1

console.log(`📞 ${phone}`)
console.log(`آگهی‌های منطبق: ${mine.length}  (${Object.entries(byStatus).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'})\n`)
console.log('— نمونه (۸ تا) —')
for (const it of mine.slice(0, 8)) console.log(`  • [${it.status}] ${(it.title || '').slice(0, 70)} | ${it.price || '—'}`)

const owners = (await listOwners()).filter(o => norm(o.phone) === phone)
console.log(`\nرکوردِ مالکِ منطبق: ${owners.length}${owners.length ? ' (' + owners.map(o => o.name).join(', ') + ')' : ''}`)

if (!mine.length && !owners.length) { console.log('\n✅ چیزی برای حذف نیست.'); process.exit(0) }

if (!APPLY) {
  console.log(`\n⚠️  این فقط پیش‌نمایش بود. برای حذفِ واقعی دوباره با --apply بزن:`)
  console.log(`   node --import ./scripts/reos-loader.mjs scripts/purge-submitter.mjs ${phone} --apply`)
  process.exit(0)
}

// حذفِ تکه‌تکه (تا تراکنش/قفل سنگین نشود)
const ids = mine.map(i => i.id)
const CHUNK = 1000
for (let i = 0; i < ids.length; i += CHUNK) {
  await deleteItems(ids.slice(i, i + CHUNK))
  console.log(`حذف شد: ${Math.min(i + CHUNK, ids.length)}/${ids.length}`)
}
for (const o of owners) { await deleteOwner(o.id); console.log(`مالک حذف شد: ${o.name} (${o.id})`) }

// تأیید
const after = (await listItems('listing')).filter(i => norm(i.phone) === phone)
console.log(`\n✅ تمام. باقی‌مانده با این شماره: ${after.length} (باید ۰ باشد).`)
process.exit(0)
