// فاز ۳۴۶ب/ج — «وقتی حذف می‌کنم چرا نمی‌فهمد و دوباره می‌آورد؟» + «نمی‌توانم بزنم که بفهمد این واقعاً مشاور است».
// حذفِ مشاور ⇒ آن نام در همین آژانس دیگر مشاور نمی‌شود (و به AI گفته می‌شود)؛ «✎ مشاور» ⇒ حکمِ ادمین برای همان یک آگهی.
// Run: node --import ./scripts/reos-loader.mjs scripts/roster-reject-346c-test.mjs
const { fakeAi } = await import('./roster-fake-ai.mjs')
const S = await import('../app/lib/agency-roster-store.ts')
let pass = 0, fail = 0
const ok = (n, c) => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n) } }
const T = 'فروش آپارتمان'
const D = { a1: 'نوساز\nکارشناس فروش امیر', a2: 'فول\nکارشناس فروش امیر', z1: 'بازدید= آزاد\nمشاور آزاد', z2: 'نورگیر\nبازدید آزاد مشاور آزاد' }
let lastNot = []
const ai = async (items, ag, notNames = []) => { lastNot = notNames; const r = await fakeAi(items); for (const it of items) if (notNames.includes(r.map[it.i])) delete r.map[it.i]; return r }
const f = { ai, profileTokens: async () => ({ posts: Object.keys(D).map(t => ({ token: t, title: T })), name: 'املاک تستِ حذف' }), post: async (t) => ({ title: T, description: D[t], images: [] }) }
const fetchPost = async (t) => ({ title: T, description: D[t] || '', images: [], facts: [], amenities: [] })
const sync = (id) => S.syncRoster(id, undefined, { budgetMs: 60000, f, fetchPost })
let id = ''
try {
  const add = await S.addScrape({ slug: 'MjReject346', agencyName: 'املاک تستِ حذف' })
  id = add.scrape?.id || (await S.listScrapes()).find(s => s.slug === 'MjReject346').id
  await sync(id)
  let sc = await S.getScrape(id)
  const az = sc.advisors.find(a => a.name === 'آزاد')
  ok('پیش‌شرط: AI «آزاد» را مشاور گفت', !!az && sc.advisors.some(a => a.name === 'امیر'))
  ok('حذف موفق', (await S.removeAdvisor(id, az.key)).ok)
  sc = await S.getScrape(id)
  ok('«آزاد» در فهرستِ حذف‌شده‌های همین آژانس است', (sc.rejectedNames || []).includes('آزاد'))
  // AIِ «لجباز» که همچنان «آزاد» می‌گوید هم نباید آن را برگرداند
  const stubborn = { ...f, ai: async (items, ag, notNames = []) => { lastNot = notNames; return fakeAi(items) } }
  await S.syncRoster(id, undefined, { budgetMs: 60000, f: stubborn, fetchPost })
  sc = await S.getScrape(id)
  ok('پس از سینک «آزاد» برنگشت (حتی وقتی AI باز گفت)', !sc.advisors.some(a => a.name === 'آزاد'))
  ok('آگهی‌های «آزاد» بی‌نام شدند', ['z1', 'z2'].every(t => (sc.unnamedTokens || []).includes(t)))
  ok('آگهی‌های «آزاد» یک بار دیگر با گفتنِ «آزاد نام نیست» از AI پرسیده شدند', lastNot.includes('آزاد'))
  lastNot = ['-']
  await sync(id)
  ok('و در سینکِ بعد دیگر دوباره پرسیده نمی‌شوند (کش)', lastNot[0] === '-')
  // تعیینِ دستیِ مشاورِ یک آگهی
  const m = await S.setAdName(id, 'z1', 'امیر')
  ok('«✎ مشاور»: ثبت شد', m.ok && m.name === 'امیر')
  ok('«✎ مشاور»: همگام‌سازی در صف رفت', (await S.getScrape(id)).runRequested === true)
  const n = await S.setAdName(id, 'a2', '')
  ok('«بی‌مشاور» ثبت شد', n.ok)
  await sync(id)
  sc = await S.getScrape(id)
  const amir = sc.advisors.find(a => a.name === 'امیر')
  ok('حکمِ ادمین بر AI مقدم: z1 به «امیر» رفت (نام در متنش نیست — معاف از ضدِ توهم)', !!amir && (amir.tokens || []).includes('z1'))
  ok('حکمِ «بی‌مشاور»: a2 بی‌نام شد', !(amir?.tokens || []).includes('a2') && (sc.unnamedTokens || []).includes('a2'))
  // برگرداندن
  ok('برگرداندنِ «آزاد»', (await S.unrejectName(id, 'آزاد')).ok)
  await S.syncRoster(id, undefined, { budgetMs: 60000, f: stubborn, fetchPost })
  sc = await S.getScrape(id)
  ok('پس از برگرداندن، «آزاد» دوباره از جوابِ AI می‌آید (فقط z2؛ z1 حکمِ ادمین دارد)', sc.advisors.some(a => a.name === 'آزاد' && a.tokens.length === 1 && a.tokens[0] === 'z2'))
} catch (e) { fail++; console.log('  ✗ استثنا:', e?.stack || e) }
finally { if (id) try { await S.removeScrape(id) } catch {} }
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
