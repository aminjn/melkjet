#!/usr/bin/env node
// فاز ۲۹۸ه — پاک‌سازیِ سایت‌ها/دادهٔ «یتیم»: صاحبی که حسابش حذف شده ولی داده‌اش مانده.
// (cascade حذفِ حساب از این به بعد خودکار است؛ این اسکریپت یتیم‌های «گذشته» را جمع می‌کند،
//  مثلِ همان انبوه‌سازی که حسابش پاک شد ولی سایت‌سازش ماند.)
//
// گزارش (بدونِ حذف):  node --import ./scripts/reos-loader.mjs scripts/purge-orphan-sites.mjs
// حذفِ واقعی:          node --import ./scripts/reos-loader.mjs scripts/purge-orphan-sites.mjs --apply
//
// روی سرور با همان DATABASE_URL اجرا شود (از .env.production.local خوانده می‌شود اگر ست باشد).

const apply = process.argv.includes('--apply')
const { listSiteHeads } = await import('../app/lib/sites-store.ts')
const { getAccount } = await import('../app/lib/account-store.ts')
const { purgeUserData } = await import('../app/lib/account-purge.ts')

const heads = await listSiteHeads()
// مالکانِ یکتا که سایت دارند ولی دیگر حساب ندارند (و مالکِ غیرخالی).
const owners = [...new Set(heads.map(h => String(h.owner || '').trim()).filter(Boolean))]
const orphans = owners.filter(o => !getAccount(o))

console.log(`سایت‌ها: ${heads.length} · مالکانِ یکتا: ${owners.length} · یتیم (بی‌حساب): ${orphans.length}`)
if (!orphans.length) { console.log('هیچ یتیمی نیست ✅'); process.exit(0) }

for (const o of orphans) {
  const theirSites = heads.filter(h => String(h.owner || '').trim() === o).map(h => h.slug)
  console.log(`  یتیم: ${o}  →  سایت‌ها: ${theirSites.join(', ')}`)
}

if (!apply) {
  console.log('\n(گزارش است — چیزی حذف نشد. برای حذفِ واقعی --apply بزن.)')
  process.exit(0)
}

console.log('\n── حذفِ کاملِ دادهٔ یتیم‌ها ──')
let total = 0
for (const o of orphans) {
  const r = await purgeUserData(o)
  total += r.sites || 0
  console.log(`  ✓ ${o}: sites=${r.sites ?? 0} publicListings=${r.publicListings ?? 0} builder=${r.builder ?? false} materials=${r.materials ?? false} errors=${r.errors.length}${r.errors.length ? ' → ' + r.errors.join(' | ') : ''}`)
}
console.log(`\nتمام شد — ${total} سایتِ یتیم پاک شد.`)
process.exit(0)
