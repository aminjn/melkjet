// فاز ۳۴۴ج — «ادغام می‌شود ولی به اکانتِ مقصد هیچی نمی‌رود، و سینکِ بعد دوباره می‌آید» (فیدبکِ مالک).
// Run: node --import ./scripts/reos-loader.mjs scripts/roster-merge-344c-test.mjs
const S = await import('../app/lib/agency-roster-store.ts')
const A = await import('../app/lib/advisor-store.ts')
const { accountExists } = await import('../app/lib/account-store.ts')
let pass = 0, fail = 0
const ok = (n, c) => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n) } }

const T = 'فروش آپارتمان'
const D = { a1: 'نوساز\nکارشناس فروش خانم کاظمی', a2: 'فول\nکارشناس فروش خانم کاظمی', b1: 'نوساز\nمشاور فروش آقای رادمهر', b2: 'فول\nمشاور فروش آقای رادمهر' }
const f = { profileTokens: async () => ({ posts: Object.keys(D).map(t => ({ token: t, title: T })), name: 'املاک تستِ ادغام' }), post: async (t) => ({ title: T, description: D[t], images: [] }) }
const fetchPost = async (t) => ({ title: T, description: D[t] || '', images: [], facts: [], amenities: [] })
const ids = []
const cleanup = async () => { for (const id of ids) try { await S.removeScrape(id) } catch {} }
try {
  const add = await S.addScrape({ slug: 'MjMerge344c', agencyName: 'املاک تستِ ادغام' })
  const id = add.scrape?.id || (await S.listScrapes()).find(s => s.slug === 'MjMerge344c').id; ids.push(id)
  await S.syncRoster(id, undefined, { budgetMs: 60000, f, fetchPost })
  let sc = await S.getScrape(id)
  const kz = sc.advisors.find(a => a.name === 'کاظمی'), rd = sc.advisors.find(a => a.name === 'رادمهر')
  ok('پیش‌شرط: دو مشاورِ «کاظمی» و «رادمهر»', !!kz && !!rd)
  // کاظمی حساب می‌گیرد
  const PH = '09120003441'
  const g = await S.graduateAdvisor(id, kz.key, PH)
  ok('کاظمی حساب گرفت', g.ok && accountExists(PH))
  const before = (await A.getAdvisor(PH)).listings.length
  // رادمهرِ بی‌حساب دو فایل زیرِ ownerِ موقت دارد (همان حالتِ واقعیِ پیش از «ساخت حساب»)
  sc = await S.getScrape(id)
  const rdRec = sc.advisors.find(a => a.name === 'رادمهر')
  await A.addListing(rdRec.owner, { title: 'آپارتمان ۱', deal: 'sale', status: 'active', price: 1 })
  await A.addListing(rdRec.owner, { title: 'آپارتمان ۲', deal: 'sale', status: 'active', price: 1 })
  const tmpBefore = (await A.getAdvisor(rdRec.owner)).listings.length
  ok('پیش‌شرط: رادمهر ۲ فایل زیرِ ownerِ موقت دارد', tmpBefore >= 2)
  // ادغام (همان مسیرِ «این شماره از قبل به کاظمی داده شده — همان شخص است»)
  const m = await S.mergeAdvisorInto(id, rdRec.key, id, kz.key)
  ok('ادغام موفق و فایل‌ها شمرده شد', m.ok && m.moved >= 2)
  const after = (await A.getAdvisor(PH)).listings.length
  ok('فایل‌های رادمهر به حسابِ کاظمی رسید', after - before >= 2)
  ok('ownerِ موقتِ رادمهر خالی شد (یتیم نماند)', (await A.getAdvisor(rdRec.owner)).listings.length === 0)
  sc = await S.getScrape(id)
  ok('ردیفِ رادمهر حذف و کلیدش در aliasesِ کاظمی است', !sc.advisors.some(a => a.key === rdRec.key) && (sc.advisors.find(a => a.key === kz.key).aliases || []).includes(rdRec.key))
  // سینکِ بعد: رادمهر دوباره ساخته نمی‌شود و آگهی‌هایش به کاظمی می‌رسد
  await S.syncRoster(id, undefined, { budgetMs: 60000, f, fetchPost })
  sc = await S.getScrape(id)
  ok('سینکِ بعد: «رادمهر» دوباره نیامد', !sc.advisors.some(a => a.name === 'رادمهر'))
  const kz2 = sc.advisors.find(a => a.key === kz.key)
  ok('سینکِ بعد: توکن‌های رادمهر زیرِ کاظمی (همان حساب)', !!kz2 && kz2.phone === PH && ['b1', 'b2'].every(t => (kz2.tokens || []).includes(t)))

  // ── آژانسِ دیگر: همان شخص در دو آژانس ──
  const D2 = { c1: 'نوساز\nمشاور فروش آقای رادمهر', c2: 'فول\nمشاور فروش آقای رادمهر' }
  const f2 = { profileTokens: async () => ({ posts: Object.keys(D2).map(t => ({ token: t, title: T })), name: 'املاک دوم' }), post: async (t) => ({ title: T, description: D2[t], images: [] }) }
  const add2 = await S.addScrape({ slug: 'MjMerge344d', agencyName: 'املاک دوم' })
  const id2 = add2.scrape?.id || (await S.listScrapes()).find(s => s.slug === 'MjMerge344d').id; ids.push(id2)
  await S.syncRoster(id2, undefined, { budgetMs: 60000, f: f2, fetchPost: async (t) => ({ title: T, description: D2[t] || '', images: [], facts: [], amenities: [] }) })
  let sc2 = await S.getScrape(id2)
  const r2 = sc2.advisors.find(a => a.name === 'رادمهر')
  await A.addListing(r2.owner, { title: 'آپارتمان ۳', deal: 'sale', status: 'active', price: 1 })
  const b2 = (await A.getAdvisor(PH)).listings.length
  const m2 = await S.mergeAdvisorInto(id2, r2.key, id, kz.key)
  ok('آژانسِ دیگر: ادغام و انتقالِ فایل به همان حساب', m2.ok && (await A.getAdvisor(PH)).listings.length - b2 >= 1)
  sc2 = await S.getScrape(id2)
  const r2b = sc2.advisors.find(a => a.key === r2.key)
  ok('آژانسِ دیگر: رکورد به همان شماره وصل ماند (سینکِ بعد زیرِ همان حساب)', !!r2b && r2b.phone === PH && r2b.mergedInto?.key === kz.key)
} finally { await cleanup() }
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
