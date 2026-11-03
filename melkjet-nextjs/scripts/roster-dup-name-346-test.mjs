// فاز ۳۴۶ — اسکرین‌شاتِ مالک: دو «امیر» پشتِ سرِ هم — یکی حساب‌دار با ۰ فایل، یکی بی‌حساب با ۳۴ فایل.
// حسابِ «امیر» کلیدِ دیگری داشت (نامش ویرایش شده بود) و ردیفِ بی‌حسابِ هم‌کلیدِ «امیر» از سینکِ قبل مانده بود ⇒ نگاشت انجام نمی‌شد.
// Run: node --import ./scripts/reos-loader.mjs scripts/roster-dup-name-346-test.mjs
const { fakeAi } = await import('./roster-fake-ai.mjs')
const S = await import('../app/lib/agency-roster-store.ts')
let pass = 0, fail = 0
const ok = (n, c) => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n) } }
const T = 'فروش آپارتمان'
const D = { a1: 'نوساز\nکارشناس فروش امیر', a2: 'فول\nکارشناس فروش امیر', b1: 'نوساز\nمشاور فروش آقای رادمهر', b2: 'فول\nمشاور فروش آقای رادمهر' }
const f = { ai: fakeAi, profileTokens: async () => ({ posts: Object.keys(D).map(t => ({ token: t, title: T })), name: 'املاک تستِ دوامیر' }), post: async (t) => ({ title: T, description: D[t], images: [] }) }
const fetchPost = async (t) => ({ title: T, description: D[t] || '', images: [], facts: [], amenities: [] })
let id = ''
try {
  const add = await S.addScrape({ slug: 'MjDup346', agencyName: 'املاک تستِ دوامیر' })
  id = add.scrape?.id || (await S.listScrapes()).find(s => s.slug === 'MjDup346').id
  await S.syncRoster(id, undefined, { budgetMs: 60000, f, fetchPost })
  let sc = await S.getScrape(id)
  const am = sc.advisors.find(a => a.name === 'امیر'), rd = sc.advisors.find(a => a.name === 'رادمهر')
  ok('پیش‌شرط: «امیر» (بی‌حساب) و «رادمهر»', !!am && !am.phone && !!rd)
  // ادمین «رادمهر» را حساب‌دار می‌کند و نامش را «امیر» می‌گذارد (کلید «رادمهر» می‌ماند)
  const PH = '09120003461'
  const g = await S.graduateAdvisor(id, rd.key, PH)
  ok('حساب ساخته شد', g.ok)
  const e = await S.editAdvisor(id, rd.key, { name: 'امیر' })
  ok('نام به «امیر» تغییر کرد', e.ok)
  sc = await S.getScrape(id)
  ok('پیش‌شرط: حالا دو «امیر» هست (یکی حساب‌دار)', sc.advisors.filter(a => a.name === 'امیر').length === 2)
  await S.syncRoster(id, undefined, { budgetMs: 60000, f, fetchPost })
  sc = await S.getScrape(id)
  const amirs = sc.advisors.filter(a => a.name === 'امیر')
  ok('پس از سینک: فقط یک «امیر»', amirs.length === 1)
  ok('همان «امیر»ِ حساب‌دار است و آگهی‌های «امیر» را گرفت', amirs[0]?.phone === PH && ['a1', 'a2'].every(t => (amirs[0].tokens || []).includes(t)))
  ok('ردیفِ بی‌حسابِ «امیر» هرس شد', !sc.advisors.some(a => a.key === am.key && !a.phone))
} catch (e) { fail++; console.log('  ✗ استثنا:', e?.stack || e) }
finally { if (id) try { await S.removeScrape(id) } catch {} }
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
