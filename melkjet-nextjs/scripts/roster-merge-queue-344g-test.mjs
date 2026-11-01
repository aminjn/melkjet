// فاز ۳۴۴ز — «ادغام‌ها را ۲۰ بار زدم، نیم ساعت هیچ اتفاقی نیفتاد» + «ساخت حساب و ادغام یک ساعت طول می‌کشد» + «خانم‌رامندی».
// Run: node --import ./scripts/reos-loader.mjs scripts/roster-merge-queue-344g-test.mjs
const S = await import('../app/lib/agency-roster-store.ts')
const A = await import('../app/lib/advisor-store.ts')
const R = await import('../app/lib/agency-roster.ts')
const { normFa } = await import('../app/lib/agency-name-lexicon.ts')
let pass = 0, fail = 0
const ok = (n, c) => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n) } }

// ── لقبِ چسبیده با نیم‌فاصله ──
const sigDesc = (sep) => `مشخصات واحد: ۱۰۷متر\nسیستم سرمایش اسپلیت\nاملاک شار | تخصص شهرک خرازی\nکارشناس تخصصی واحدهای شهرک خرازی و مشاور شما: خانم${sep}رامندی\nفروش، رهن و اجاره فایل شما در کمترین زمان ممکن`
for (const [sep, lbl] of [['‌', 'نیم‌فاصله'], ['', 'بی‌فاصله'], [' ', 'فاصله']]) {
  const sig = R.extractSignature(normFa('بلوک A /طبقه ۱۴'), normFa(sigDesc(sep)), 'املاک شار')
  ok(`«خانم${lbl === 'فاصله' ? ' ' : lbl === 'نیم‌فاصله' ? '‌' : ''}رامندی» (${lbl}) ⇒ «رامندی»`, sig[0] === 'رامندی')
}
ok('«آقا‌زاده» (نام خانوادگی) شکسته نمی‌شود', normFa('آقا‌زاده') === 'آقا‌زاده' && normFa('آقازاده') === 'آقازاده')
ok('«خانمها/خانم‌ها/خانمی» شکسته نمی‌شوند', normFa('خانمها') === 'خانمها' && normFa('خانم‌ها') === 'خانم‌ها' && normFa('خانمی') === 'خانمی')

// ── ادغام در صف ──
const T = 'فروش آپارتمان'
const D = { a1: 'نوساز\nکارشناس فروش خانم کاظمی', a2: 'فول\nکارشناس فروش خانم کاظمی', b1: 'نوساز\nمشاور فروش آقای رادمهر', b2: 'فول\nمشاور فروش آقای رادمهر' }
const f = { profileTokens: async () => ({ posts: Object.keys(D).map(t => ({ token: t, title: T })), name: 'املاک صفِ ادغام' }), post: async (t) => ({ title: T, description: D[t], images: [] }) }
const fetchPost = async (t) => ({ title: T, description: D[t] || '', images: [], facts: [], amenities: [] })
const ids = []
try {
  const add = await S.addScrape({ slug: 'MjMergeQ344g', agencyName: 'املاک صفِ ادغام' })
  const id = add.scrape?.id || (await S.listScrapes()).find(s => s.slug === 'MjMergeQ344g').id; ids.push(id)
  const add2 = await S.addScrape({ slug: 'MjOther344g', agencyName: 'آژانسِ دیگر' })
  const id2 = add2.scrape?.id || (await S.listScrapes()).find(s => s.slug === 'MjOther344g').id; ids.push(id2)
  await S.syncRoster(id, undefined, { budgetMs: 60000, f, fetchPost })
  let sc = await S.getScrape(id)
  const kz = sc.advisors.find(a => a.name === 'کاظمی'), rd = sc.advisors.find(a => a.name === 'رادمهر')
  const PH = '09120003450'
  await S.graduateAdvisor(id, kz.key, PH)
  await A.addListing(rd.owner, { title: 'آپارتمان ۱', deal: 'sale', status: 'active', price: 1 })
  await A.addListing(rd.owner, { title: 'آپارتمان ۲', deal: 'sale', status: 'active', price: 1 })
  const before = (await A.getAdvisor(PH)).listings.length

  const t0 = Date.now()
  const q = await S.enqueueMerge(id, rd.key, id, kz.key)
  const q2 = await S.enqueueMerge(id, rd.key, id, kz.key)
  sc = (await S.listScrapes()).find(s => s.id === id)
  const rdRow = sc.advisors.find(a => a.key === rd.key)
  ok('کلیکِ ادغام فوری برمی‌گردد و ردیف «⏳ در حالِ ادغام با کاظمی» می‌شود', q.ok && Date.now() - t0 < 3000 && rdRow?.mergePending?.name === 'کاظمی' && rdRow.graduating === true)
  ok('کلیکِ دوباره کارِ دوم نمی‌سازد', q2.ok && (sc.gradJobs || []).filter(j => j.key === rd.key).length === 1)

  // سینکِ «همین» آژانس در جریان ⇒ صبر
  await S.patchScrape(id, { running: true, lastProgressAt: Date.now(), runStartedAt: Date.now() })
  await S.processGraduateQueue()
  ok('وسطِ سینکِ «همین» آژانس ادغام صبر می‌کند', !!(await S.getScrape(id)).advisors.find(a => a.key === rd.key))
  await S.patchScrape(id, { running: false })

  // سینکِ «آژانسِ دیگر» در جریان ⇒ دیگر مانع نیست (قبلاً تا پایانِ همهٔ سینک‌ها صبر می‌کرد)
  await S.patchScrape(id2, { running: true, lastProgressAt: Date.now(), runStartedAt: Date.now() })
  for (let i = 0; i < 3; i++) await S.processGraduateQueue()
  sc = (await S.listScrapes()).find(s => s.id === id)
  ok('سینکِ آژانسِ دیگر مانعِ ادغام نیست — ادغام انجام شد', !sc.advisors.some(a => a.key === rd.key) && (sc.advisors.find(a => a.key === kz.key)?.aliases || []).includes(rd.key))
  ok('فایل‌های رادمهر به حسابِ کاظمی رسید', (await A.getAdvisor(PH)).listings.length - before >= 2 && (await A.getAdvisor(rd.owner)).listings.length === 0)
  ok('کارِ صف پاک شد', !(sc.gradJobs || []).length)
  await S.patchScrape(id2, { running: false })
} finally { for (const id of ids) try { await S.removeScrape(id) } catch {} }
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
