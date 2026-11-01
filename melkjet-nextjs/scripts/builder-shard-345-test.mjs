// فاز ۳۴۵ — شاردِ سازنده‌ها: «انبوه‌سازها روی "در حال بارگذاری پروژه…" می‌مانند».
// Run (روی PostgreSQLِ تمیز): DATABASE_URL=postgres://reos:reos@127.0.0.1:5432/reos_bt node --import ./scripts/reos-loader.mjs scripts/builder-shard-345-test.mjs
if (!process.env.DATABASE_URL) { console.log('DATABASE_URL لازم است (PG تمیز)'); process.exit(1) }
let pass = 0, fail = 0
const ok = (n, c) => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.log('  ✗ ' + n) } }
const db = await import('../app/lib/db.ts')
// بلابِ قدیمی: دو سازنده، یکی با پروژهٔ پرشین‌سازه (hashId)
const legacy = {
  '09120000001': { projects: [{ id: 'p1', name: 'برج الف', location: 'تهران', phase: 'سفت‌کاری', progress: 20, units: [{ id: 'u1', number: '1-1', floor: 1, area: 100, price: 0, status: 'available' }], investors: [], milestones: [], monthlySales: [], createdAt: 1, source: { hashId: 'HASH1' } }], imported: true, importVersion: 5 },
  '09120000002': { projects: [{ id: 'p2', name: 'برج ب', location: 'کرج', phase: 'تحویل', progress: 100, units: [], investors: [], milestones: [], monthlySales: [], createdAt: 2 }], imported: true, importVersion: 5 },
}
await db.kvSet('builder', legacy)
const B = await import('../app/lib/builder-store.ts')
const l1 = await B.listProjects('09120000001')
ok('مهاجرت: پروژه‌های سازندهٔ ۱ از بلابِ قدیمی خوانده شد', l1.length === 1 && l1[0].name === 'برج الف')
ok('هر سازنده ردیفِ خودش را دارد', !!(await db.kvGet('builder:09120000001', null)) && !!(await db.kvGet('builder:09120000002', null)))
ok('نشانِ مهاجرت ثبت شد', (await db.kvGet('builder_migrated_v2', {})).done === true)
const p = await B.addProject('09120000002', 'پروژهٔ تازه', 'شیراز')
ok('نوشتن فقط در ردیفِ همان سازنده', (await B.listProjects('09120000002')).length === 2 && (await B.listProjects('09120000001')).length === 1)
ok('بلابِ قدیمی یخ‌زده می‌ماند (پشتیبان)', Object.keys(await db.kvGet('builder', {})).length === 2 && (await db.kvGet('builder', {}))['09120000002'].projects.length === 1)
const u = await B.addUnit('09120000002', p.id, { number: '2-1', floor: 2, area: 80, price: 5, status: 'available' })
ok('افزودنِ واحد', !!u && (await B.getProject('09120000002', p.id)).units.length === 1)
ok('سازندهٔ تازه (بی‌ردیف) ⇒ فهرستِ خالی، نه خطا', (await B.listProjects('09129999999')).length === 0)
const st = await B.unitStatusesForHash('HASH1')
ok('صفحهٔ عمومیِ پروژه: وضعیتِ واحدها با ایندکسِ hashId', st?.counts.available === 1)
ok('رزروِ واحد از سایت با hashId', (await B.reserveUnitByHash('HASH1', '1-1', 'خریدار')) === true && (await B.getProject('09120000001', 'p1')).units[0].status === 'reserved')
ok('hashIdِ ناشناخته ⇒ null', (await B.unitStatusesForHash('NOPE')) === null)
ok('حذفِ دادهٔ یک سازنده فقط ردیفِ خودش', (await B.deleteBuilderData('09120000002')) === true && (await B.listProjects('09120000002')).length === 0 && (await B.listProjects('09120000001')).length === 1)
await db.kvSet('builder_migrated_v2', { done: true })   // مهاجرتِ دوباره نباید بازنویسی کند
ok('مهاجرت ایدمپوتنت است (ردیفِ تغییرکرده بازنویسی نمی‌شود)', (await B.getProject('09120000001', 'p1')).units[0].status === 'reserved')
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
