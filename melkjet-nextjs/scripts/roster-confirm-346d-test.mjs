// فاز ۳۴۶د — «کلی امیر پاشا هست، باید دونه‌دونه بزنم؟» — تأییدِ یک نام = همهٔ آگهی‌های همین آژانس که AI برایشان نامی نداد و
// این نام را در متن دارند به همان مشاور می‌روند (یک کلیک). جوابِ نام‌دارِ AI بازنویسی نمی‌شود؛ آژانسِ دیگر اثر نمی‌گیرد.
// Run: node --import ./scripts/reos-loader.mjs scripts/roster-confirm-346d-test.mjs
const S = await import('../app/lib/agency-roster-store.ts')
let pass = 0, fail = 0
const ok = (n, c) => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n) } }
const T = 'فروش آپارتمان'
const sig = 'کارشناس ملکی منطقه امیر پاشا'
const D = { p1: 'نوساز\n' + sig, p2: 'فول\n' + sig, p3: 'دوخواب\n' + sig, p4: 'نورگیر\n' + sig, p5: 'با تشکر رضایی\n' + sig, x1: 'سند آزاد\nتماس بگیرید' }
// AIِ «کم‌کار»: برای امضای «منطقه امیر پاشا» چیزی نمی‌گوید؛ فقط p5 را «رضایی» می‌گوید
const ai = async (items) => ({ map: Object.fromEntries(items.filter(it => /رضایی/.test(it.desc)).map(it => [it.i, 'رضایی'])), raw: '', answered: items.map(it => it.i) })
const mk = (slug, d) => ({ ai, profileTokens: async () => ({ posts: Object.keys(d).map(t => ({ token: t, title: T })), name: slug }), post: async (t) => ({ title: T, description: d[t], images: [] }) })
const fp = (d) => async (t) => ({ title: T, description: d[t] || '', images: [], facts: [], amenities: [] })
const ids = []
try {
  const id = (await S.addScrape({ slug: 'MjConfirm346', agencyName: 'املاک تأیید' })).scrape.id; ids.push(id)
  const D2 = { q1: 'نوساز\n' + sig, q2: 'فول\n' + sig }
  const id2 = (await S.addScrape({ slug: 'MjConfirm346b', agencyName: 'املاک دیگر' })).scrape.id; ids.push(id2)
  await S.syncRoster(id, undefined, { budgetMs: 60000, f: mk('a', D), fetchPost: fp(D) })
  await S.syncRoster(id2, undefined, { budgetMs: 60000, f: mk('b', D2), fetchPost: fp(D2) })
  let sc = await S.getScrape(id)
  ok('پیش‌شرط: AI «امیر پاشا» را نگفت (۴ آگهی بی‌نام)', !sc.advisors.some(a => a.name === 'امیر پاشا') && ['p1', 'p2', 'p3', 'p4'].every(t => (sc.unnamedTokens || []).includes(t)))
  const r = await S.setAdName(id, 'p1', 'امیر پاشا')
  ok('یک کلیک: ۵ آگهیِ این آژانس این نام را دارند', r.ok && r.matched === 5)
  await S.syncRoster(id, undefined, { budgetMs: 60000, f: mk('a', D), fetchPost: fp(D) })
  sc = await S.getScrape(id)
  const ap = sc.advisors.find(a => a.name === 'امیر پاشا')
  ok('هر ۴ آگهیِ بی‌نامِ «امیر پاشا» به همان مشاور رفتند', !!ap && ['p1', 'p2', 'p3', 'p4'].every(t => (ap.tokens || []).includes(t)))
  ok('جوابِ نام‌دارِ AI («رضایی» در p5) بازنویسی نشد', sc.advisors.some(a => a.name === 'رضایی' && (a.tokens || []).includes('p5')) && !(ap?.tokens || []).includes('p5'))
  ok('آگهیِ بی‌ربط (x1) بی‌نام ماند', (sc.unnamedTokens || []).includes('x1'))
  ok('منبعِ این‌ها «تأییدِ ادمین» است', (ap?.src?.sig || 0) === 4)
  await S.syncRoster(id2, undefined, { budgetMs: 60000, f: mk('b', D2), fetchPost: fp(D2) })
  ok('آژانسِ دیگر اثر نگرفت (فقط همین آژانس)', !(await S.getScrape(id2)).advisors.some(a => a.name === 'امیر پاشا'))
  // حذفِ همان مشاور ⇒ از تأییدشده‌ها هم برداشته می‌شود
  ok('حذفِ مشاور', (await S.removeAdvisor(id, ap.key)).ok)
  sc = await S.getScrape(id)
  ok('حذف ⇒ از «تأییدشده‌ها» برداشته و به «حذف‌شده‌ها» رفت', !(sc.confirmedNames || []).includes('امیر پاشا') && (sc.rejectedNames || []).includes('امیر پاشا'))
} catch (e) { fail++; console.log('  ✗ استثنا:', e?.stack || e) }
finally { for (const id of ids) try { await S.removeScrape(id) } catch {} }
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
