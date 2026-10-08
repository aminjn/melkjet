// ── فهرستِ همهٔ رکوردهای رُستر که با یک عبارت می‌خوانند (برای یافتنِ رکوردِ درست/تکراری) ──
//   node --import ./scripts/reos-loader.mjs scripts/roster-list.mjs شاهان
const q = (process.argv[2] || '').trim()
const { listScrapes } = await import('../app/lib/agency-roster-store.ts')
const scrapes = await listScrapes()
const m = q ? scrapes.filter(x => `${x.id} ${x.slug} ${x.agencyName || ''}`.includes(q)) : scrapes
console.log(`${m.length} رکورد${q ? ` با «${q}»` : ''} (از کلِ ${scrapes.length}):\n`)
for (const s of m.sort((a, b) => (b.lastTotal || 0) - (a.lastTotal || 0))) {
  console.log(`id=${s.id}  slug=${s.slug}  نام=${s.agencyName || '-'}`)
  console.log(`   آگهی(lastTotal)=${s.lastTotal || 0} · مشاور=${(s.advisors || []).length} · بی‌نامِ‌سینک=${s.lastUnnamed || 0} · unnamedTokensِ‌ذخیره=${(s.unnamedTokens || []).length} · running=${!!s.running}`)
  console.log(`   آخرین‌سینکِ‌موفق=${s.lastOkAt ? new Date(s.lastOkAt).toLocaleString('fa-IR') : '—'} · آخرین‌تلاش=${s.lastRun ? new Date(s.lastRun).toLocaleString('fa-IR') : '—'} · خطا=${s.lastError || '—'}`)
}
