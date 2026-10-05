// ── حذفِ یک رکوردِ رُستر (مثلاً رکوردِ تکراریِ کهنه) — فقط ردیفِ رُستر می‌رود ──────────
// حساب/آگهی/پروفایلِ مشاورانِ graduateشده دست‌نخورده می‌ماند (در استورِ جدا ذخیره‌اند).
//   گزارش:  node --import ./scripts/reos-loader.mjs scripts/roster-remove.mjs <id>
//   حذف:    node --import ./scripts/reos-loader.mjs scripts/roster-remove.mjs <id> --apply
const APPLY = process.argv.includes('--apply')
const id = (process.argv[2] || '').trim()
const { listScrapes, removeScrape } = await import('../app/lib/agency-roster-store.ts')
if (!id) { console.log('استفاده: scripts/roster-remove.mjs <id> [--apply]'); process.exit(1) }
const s = (await listScrapes()).find(x => x.id === id)
if (!s) { console.log('✗ رکوردی با این id نیست:', id); process.exit(1) }
const grad = (s.advisors || []).filter(a => a.phone)
console.log(`رکورد: id=${s.id} · slug=${s.slug} · نام=${s.agencyName || '-'}`)
console.log(`   آگهی=${s.lastTotal || 0} · مشاور=${(s.advisors || []).length} · graduateشده=${grad.length}`)
console.log(`   (حسابِ ${grad.length} مشاورِ graduateشده دست‌نخورده می‌ماند — فقط ردیفِ رُستر حذف می‌شود)`)
if (!APPLY) { console.log('\nبرای حذفِ واقعی، همین دستور را با --apply بزن.'); process.exit(0) }
await removeScrape(id)
console.log('\n✓ رکوردِ رُستر حذف شد.')
