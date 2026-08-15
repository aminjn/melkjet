// ── پاک‌سازیِ «مشاورهای یتیم» رُستر (فاز ۲۷۸) ────────────────────────────────
// مسئله: تا پیش از فاز ۲۷۸، وقتی یک خوشهٔ آشغال («لوکیشن»، «منطقه»، …) از رُستر هرس
// می‌شد، آگهی‌هایش زیرِ ownerِ موقتِ `adv:{slug}:{key}` جا می‌ماندند و هیچ‌کس دیگر
// سراغشان نمی‌رفت. روی سرورِ زنده هزاران ردیف این‌طور مانده بود
// (`advisor:adv:pQRgYEXa:لوکیشن` = ۵۷۰ فایل).
//
// این اسکریپت هر کلیدِ `advisor:adv:*` را با رُسترِ واقعی مقایسه می‌کند: اگر هیچ اسکرپی
// چنین مشاوری نداشته باشد، آن کلید یتیم است. آگهی‌های ownerِ موقت هرگز عمومی نمی‌شوند،
// پس حذفشان روی سایت اثری ندارد.
//
// اجرا (اول فقط گزارش):
//   cd /var/www/melkjet/melkjet-nextjs && set -a && . ./.env.production.local && set +a
//   node --import ./scripts/reos-loader.mjs scripts/roster-orphans.mjs
// و برای حذفِ واقعی:  … scripts/roster-orphans.mjs --apply

const APPLY = process.argv.includes('--apply')

const { kvGetPrefix, kvDelete, pgEnabled } = await import('../app/lib/db.ts')
const { listScrapes } = await import('../app/lib/agency-roster-store.ts')

if (!pgEnabled()) { console.log('DATABASE_URL تنظیم نیست — این اسکریپت فقط روی مسیرِ PostgreSQL معنا دارد.'); process.exit(0) }

// همهٔ ownerهای موقتِ «زنده» = آنهایی که هنوز رکوردِ مشاور دارند.
const scrapes = await listScrapes()
const live = new Set()
for (const s of scrapes) {
  live.add(s.agencyOwner)
  for (const a of s.advisors || []) { live.add(a.owner); if (a.transferFrom) live.add(a.transferFrom) }
}

const rows = await kvGetPrefix('advisor:adv:')
let orphanFiles = 0, keptFiles = 0
const orphans = []
for (const { key, data } of rows) {
  const owner = key.slice('advisor:'.length)
  const n = (data?.listings || []).length
  if (live.has(owner)) { keptFiles += n; continue }
  orphans.push({ key, owner, n }); orphanFiles += n
}
orphans.sort((a, b) => b.n - a.n)

console.log(`\n── مشاورهای یتیم ──`)
console.log(`اسکرپ‌ها: ${scrapes.length}   ownerهای زنده: ${live.size}   کلیدهای advisor:adv: ${rows.length}`)
console.log(`یتیم: ${orphans.length} خوشه / ${orphanFiles} فایل      سالم: ${keptFiles} فایل\n`)
for (const o of orphans.slice(0, 25)) console.log(`  ${o.n.toString().padStart(5)}  ${o.owner}`)
if (orphans.length > 25) console.log(`  … و ${orphans.length - 25} خوشهٔ دیگر`)

if (!APPLY) { console.log(`\nفقط گزارش بود. برای حذف: node --import ./scripts/reos-loader.mjs scripts/roster-orphans.mjs --apply\n`); process.exit(0) }

let done = 0
for (const o of orphans) { await kvDelete(o.key); if (++done % 20 === 0) console.log(`  حذف ${done}/${orphans.length}`) }
console.log(`\n✓ ${orphans.length} خوشهٔ یتیم (${orphanFiles} فایل) حذف شد.\n`)
