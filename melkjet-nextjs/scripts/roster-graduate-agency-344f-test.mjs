// فاز ۳۴۴و — «ساخت حساب آژانس را باید ۳۰ بار بزنم و ۱۵–۲۰ دقیقه طول می‌کشد» + «هنوز گیر کرده».
// Run: node --import ./scripts/reos-loader.mjs scripts/roster-graduate-agency-344f-test.mjs
const S = await import('../app/lib/agency-roster-store.ts')
const A = await import('../app/lib/advisor-store.ts')
const { accountExists } = await import('../app/lib/account-store.ts')
let pass = 0, fail = 0
const ok = (n, c) => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n) } }

const T = 'فروش آپارتمان'
const D = {
  a1: 'نوساز\nکارشناس فروش خانم کاظمی', a2: 'فول\nکارشناس فروش خانم کاظمی',
  u1: 'آپارتمان نوساز فول امکانات با پارکینگ و انباری', u2: 'ملک کلنگی مناسب ساخت با سند تک برگ', u3: 'واحد دوخواب با ویوی ابدی و نورگیر',
}
const f = { profileTokens: async () => ({ posts: Object.keys(D).map(t => ({ token: t, title: T })), name: 'املاک تستِ آژانس' }), post: async (t) => ({ title: T, description: D[t], images: [] }) }
const fetchPost = async (t) => ({ title: T, description: D[t] || '', images: [], facts: [], amenities: [] })
const ids = []
try {
  const add = await S.addScrape({ slug: 'MjAgency344f', agencyName: 'املاک تستِ آژانس' })
  const id = add.scrape?.id || (await S.listScrapes()).find(s => s.slug === 'MjAgency344f').id; ids.push(id)
  await S.syncRoster(id, undefined, { budgetMs: 60000, f, fetchPost })
  let sc = await S.getScrape(id)
  const legacy = `agency:${sc.slug}`
  if (!(await A.getAdvisor(legacy)).listings.length) {   // فایل‌های «بی‌نام (خودِ آژانس)» — همان چیزی که سینک زیرِ agencyOwner می‌سازد
    for (const t of ['آگهی بی‌نام ۱', 'آگهی بی‌نام ۲', 'آگهی بی‌نام ۳']) await A.addListing(legacy, { title: t, deal: 'sale', status: 'active', price: 1 })
  }
  const before = (await A.getAdvisor(legacy)).listings.length
  ok(`پیش‌شرط: فایل‌های بی‌نام زیرِ ${legacy} (${before})`, before >= 2)

  // ── آژانس: ساخت حساب وسطِ سینک (فقط بخشِ آنی)، بعد انتقال ──
  const PA = '09120003447'
  const q = await S.enqueueGraduate(id, '__agency__', PA, 'agency')
  sc = (await S.listScrapes()).find(s => s.id === id)
  ok('آژانس: بلافاصله پس از کلیک «⏳ در صف» دیده می‌شود (agencyGraduating)', q.ok && sc.agencyGraduating === true)
  const q2 = await S.enqueueGraduate(id, '__agency__', PA, 'agency')
  ok('آژانس: کلیکِ دوباره کارِ دوم نمی‌سازد', q2.ok && (await S.listScrapes()).find(s => s.id === id).gradJobs.filter(j => j.key === '__agency__').length === 1)
  await S.patchScrape(id, { running: true, lastProgressAt: Date.now(), runStartedAt: Date.now() })
  const did = await S.prepareGraduateJobs({ id, key: '__agency__' })
  sc = await S.getScrape(id)
  ok('آژانس: بخشِ آنی (همان کاری که API فوراً می‌کند) حساب و شماره را نشاند', did === 1 && accountExists(PA) && sc.agencyPhone === PA && sc.agencyTransferFrom === legacy)
  await S.processGraduateQueue()
  ok('آژانس: وسطِ سینک فایل‌ها هنوز منتقل نشده‌اند (عقب می‌افتد)', (await A.getAdvisor(legacy)).listings.length === before)
  await S.patchScrape(id, { running: false })
  for (let i = 0; i < 4; i++) await S.processGraduateQueue()
  sc = (await S.listScrapes()).find(s => s.id === id)
  ok('آژانس: پس از پایانِ سینک فایل‌ها واقعاً به حسابِ آژانس رسید (کدِ قبلی: صفر فایل)', (await A.getAdvisor(PA)).listings.length >= before && (await A.getAdvisor(legacy)).listings.length === 0)
  ok('آژانس: پرچمِ صف خاموش و مبدأ پاک شد', !sc.agencyGraduating && !sc.agencyTransferFrom && !(sc.gradJobs || []).length)

  // ── ترمیمِ آژانس‌های قدیمی: حساب دارند ولی فایل‌ها زیرِ agency:slug جا مانده‌اند ──
  await A.addListing(legacy, { title: 'جامانده ۱', deal: 'sale', status: 'active', price: 1 })
  await A.addListing(legacy, { title: 'جامانده ۲', deal: 'sale', status: 'active', price: 1 })
  const pBefore = (await A.getAdvisor(PA)).listings.length
  const healed = await S.healAgencyLegacyFiles()
  ok('ترمیم: فایل‌های جامانده منتقل شد', healed === 2 && (await A.getAdvisor(legacy)).listings.length === 0 && (await A.getAdvisor(PA)).listings.length === pBefore + 2)

  // ── مشاور: کارِ claimشده (startedAt) که شماره‌اش پریده — دیگر پشتِ قفلِ انتقال گیر نمی‌کند ──
  sc = await S.getScrape(id)
  const kz = sc.advisors.find(a => a.name === 'کاظمی')
  const PK = '09120003448'
  await S.enqueueGraduate(id, kz.key, PK)
  await S.patchScrape(id, { running: true, lastProgressAt: Date.now(), runStartedAt: Date.now() })
  await S.processGraduateQueue()
  sc = await S.getScrape(id)
  ok('مشاور: بخشِ آنی', sc.advisors.find(a => a.key === kz.key)?.phone === PK)
  // شبیه‌سازی: پیش از دیپلوی claim شده و نوشتنِ کهنهٔ سینک شماره را پاک کرده
  await S.patchScrape(id, { advisors: sc.advisors.map(a => a.key === kz.key ? { ...a, phone: undefined, owner: a.transferFrom } : a) })
  const fs = await import('node:fs')
  const raw = JSON.parse(fs.readFileSync('.agency-roster-data.json', 'utf-8'))
  const jj = (raw.graduateQueue || []).find(j => j.key === kz.key); if (jj) jj.startedAt = Date.now()
  fs.writeFileSync('.agency-roster-data.json', JSON.stringify(raw, null, 2))
  await S.prepareGraduateJobs()
  sc = await S.getScrape(id)
  ok('مشاور: کارِ claimشده با شمارهٔ پریده هم خودترمیم می‌شود', sc.advisors.find(a => a.key === kz.key)?.phone === PK)
  await S.patchScrape(id, { running: false })
} finally { for (const id of ids) try { await S.removeScrape(id) } catch {} }
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
