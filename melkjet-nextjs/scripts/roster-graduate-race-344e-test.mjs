// فاز ۳۴۴ه — «بیش از ۱۰ دقیقه است ساخت حساب زدم، ساخته نمی‌شود» (فیدبکِ مالک).
// مسابقه: ادمین وسطِ سینک «ساخت حساب»/حذف می‌زند و نوشتنِ پایانیِ سینک (از اسنپ‌شاتِ اولِ سینک) آن را پاک می‌کرد.
// Run: node --import ./scripts/reos-loader.mjs scripts/roster-graduate-race-344e-test.mjs
const S = await import('../app/lib/agency-roster-store.ts')
const { accountExists } = await import('../app/lib/account-store.ts')
let pass = 0, fail = 0
const ok = (n, c) => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n) } }

// ── واحد: mergeLiveAdvisors ──
{
  const stale = [{ key: 'a', name: 'کاظمی', tokens: ['t1', 't2'] }, { key: 'b', name: 'رادمهر', tokens: ['t3'] }, { key: 'n', name: 'تازه', tokens: ['t9'] }]
  const live = [{ key: 'a', name: 'کاظمی (ادمین)', tokens: ['t1'], phone: '0912', owner: '0912', graduating: true, transferFrom: 'adv:x:a' }]
  const out = S.mergeLiveAdvisors(live, stale, new Set(['a', 'b']))
  const a = out.find(x => x.key === 'a')
  ok('واحد: شماره/owner/graduating/transferFrom از نسخهٔ زنده', a?.phone === '0912' && a.owner === '0912' && a.graduating === true && a.transferFrom === 'adv:x:a')
  ok('واحد: توکن‌های تازهٔ سینک حفظ شد', a?.tokens.length === 2)
  ok('واحد: نامِ حساب‌دار دستِ ادمین می‌ماند', a?.name === 'کاظمی (ادمین)')
  ok('واحد: رکوردِ حذف‌شده وسطِ سینک زنده نشد', !out.some(x => x.key === 'b'))
  ok('واحد: خوشهٔ تازهٔ همین سینک اضافه شد', out.some(x => x.key === 'n'))
  const out2 = S.mergeLiveAdvisors([{ key: 'a', name: 'کاظمی' }], [{ key: 'a', name: 'کاظمی', phone: '0999', graduating: true }], new Set(['a']))
  ok('واحد: فیلدِ حسابِ برداشته‌شده وسطِ سینک برنمی‌گردد', out2[0].phone === undefined && out2[0].graduating === undefined)
}

// ── یکپارچه: ساخت حساب و حذف «وسطِ» سینک ──
const T = 'فروش آپارتمان'
const D = { a1: 'نوساز\nکارشناس فروش خانم کاظمی', a2: 'فول\nکارشناس فروش خانم کاظمی', b1: 'نوساز\nمشاور فروش آقای رادمهر', b2: 'فول\nمشاور فروش آقای رادمهر' }
let hook = null
const f = {
  profileTokens: async () => { if (hook) { const h = hook; hook = null; await h() } return { posts: Object.keys(D).map(t => ({ token: t, title: T })), name: 'املاک تستِ مسابقه' } },
  post: async (t) => ({ title: T, description: D[t], images: [] }),
}
const fetchPost = async (t) => ({ title: T, description: D[t] || '', images: [], facts: [], amenities: [] })
const ids = []
try {
  const add = await S.addScrape({ slug: 'MjRace344e', agencyName: 'املاک تستِ مسابقه' })
  const id = add.scrape?.id || (await S.listScrapes()).find(s => s.slug === 'MjRace344e').id; ids.push(id)
  await S.syncRoster(id, undefined, { budgetMs: 60000, f, fetchPost })
  let sc = await S.getScrape(id)
  const kz = sc.advisors.find(a => a.name === 'کاظمی'), rd = sc.advisors.find(a => a.name === 'رادمهر')
  ok('پیش‌شرط: دو مشاورِ «کاظمی» و «رادمهر»', !!kz && !!rd)
  const PH = '09120003445'
  hook = async () => {
    const g = await S.graduateAdvisor(id, kz.key, PH, 'advisor', { deferTransfer: true })
    ok('وسطِ سینک: بخشِ آنیِ ساخت حساب موفق', g.ok && accountExists(PH))
    const r = await S.removeAdvisor(id, rd.key)
    ok('وسطِ سینک: حذفِ رادمهر', r.ok)
  }
  await S.syncRoster(id, undefined, { budgetMs: 60000, f, fetchPost })
  ok('هوک واقعاً وسطِ سینک اجرا شد', hook === null)
  sc = await S.getScrape(id)
  const kz2 = sc.advisors.find(a => a.key === kz.key)
  ok('پس از سینک: شمارهٔ کاظمی سرِ جاست (دیگر «در حال ساخت حساب…» نمی‌ماند)', kz2?.phone === PH && kz2.owner === PH)
  ok('پس از سینک: رادمهرِ حذف‌شده با نسخهٔ کهنه زنده نشد', !sc.advisors.some(a => a.key === rd.key))

  // ── خودترمیم: ردیف‌هایی که «پیش از» این فیکس گیر کرده‌اند (کار prepared، شماره روی رکورد نیست) ──
  sc = await S.getScrape(id)
  const PH2 = '09120003446'
  // رادمهر حذف شد؛ یک سینکِ تازه برش می‌گرداند تا مشاورِ دومِ بی‌حساب داشته باشیم
  await S.syncRoster(id, undefined, { budgetMs: 60000, f, fetchPost })
  sc = await S.getScrape(id)
  const rd3 = sc.advisors.find(a => a.name === 'رادمهر' && !a.phone)
  ok('پیش‌شرط: مشاورِ بی‌حسابِ دوم', !!rd3)
  const q = await S.enqueueGraduate(id, rd3.key, PH2)
  await S.patchScrape(id, { running: true, lastProgressAt: Date.now(), runStartedAt: Date.now() })   // سینکِ در جریان ⇒ انتقال عقب می‌افتد
  await S.processGraduateQueue()
  sc = await S.getScrape(id)
  ok('صف: بخشِ آنی شماره را نشاند', q.ok && sc.advisors.find(a => a.key === rd3.key)?.phone === PH2)
  // شبیه‌سازیِ پاک‌شدنِ شماره با نسخهٔ کهنهٔ سینکِ قدیمی (همان وضعیتِ گیرکردهٔ تولید)
  const wiped = sc.advisors.map(a => a.key === rd3.key ? { ...a, phone: undefined, owner: a.transferFrom || a.owner } : a)
  await S.patchScrape(id, { advisors: wiped })
  sc = await S.getScrape(id)
  ok('پیش‌شرط: ردیف گیر کرد (graduating بی‌شماره)', !sc.advisors.find(a => a.key === rd3.key)?.phone && sc.advisors.find(a => a.key === rd3.key)?.graduating)
  await S.processGraduateQueue()
  sc = await S.getScrape(id)
  ok('خودترمیم: تیکِ بعدیِ صف شماره را دوباره نشاند', sc.advisors.find(a => a.key === rd3.key)?.phone === PH2)
  await S.patchScrape(id, { running: false })
  for (let i = 0; i < 4; i++) await S.processGraduateQueue()
  sc = await S.getScrape(id)
  const fin = sc.advisors.find(a => a.key === rd3.key)
  ok('پس از پایانِ سینک: انتقال تمام و پرچمِ «در حال ساخت» خاموش', fin?.phone === PH2 && !fin.graduating && !((await S.listScrapes()).find(x => x.id === id).gradJobs || []).length)
} finally { for (const id of ids) try { await S.removeScrape(id) } catch {} }
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
