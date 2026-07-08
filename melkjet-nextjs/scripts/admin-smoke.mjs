// دودآزمای سوپرادمین — دو حالت:
//   ۱) مرورگرِ واقعی (playwright): تک‌تکِ منوها (view=…) را باز می‌کند و خطای JS /
//      placeholder «در حال توسعه» / خطای شبکه را گزارش می‌دهد. (کامل‌ترین چک)
//   ۲) حالتِ HTTP (بدونِ مرورگر — روی سرور خودکار فعال می‌شود اگر playwright نبود):
//      • صفحهٔ /admin با کوکیِ سوپرادمین باید 200 بدهد
//      • تک‌تکِ chunkهای /_next/static داخلِ HTML باید 200 بدهند (لوکال)
//      • همان chunkها از دامنهٔ عمومی هم چک می‌شوند → کشفِ «کشِ کهنهٔ آروان»
//        (علتِ اصلیِ «منو کار نمی‌کند» در پروداکشن)
//      • APIهای ادمینِ پشتِ منوها با توکن چک می‌شوند (5xx = خراب)
// روی سرور:  node scripts/admin-smoke.mjs                 (BASE پیش‌فرض: http://127.0.0.1:3001)
// لوکال:     BASE=http://127.0.0.1:3100 node scripts/admin-smoke.mjs
// فقط HTTP:  HTTP_ONLY=1 node scripts/admin-smoke.mjs
// بدونِ چکِ دامنه: PUBLIC=0   |   دامنهٔ دیگر: PUBLIC=https://melkjet.com
// توکن با JWT_SECRET همان محیط امضا می‌شود (env یا پیش‌فرضِ session.ts).
import { SignJWT } from 'jose'

const BASE = process.env.BASE || 'http://127.0.0.1:3001'
const PUBLIC = process.env.PUBLIC === '0' ? '' : (process.env.PUBLIC || 'https://melkjet.com')
const VIEWS = ('overview,reos,reports,empire,empirePlayers,empireEconomy,empireCapital,empireMissions,empireEngage,empireWorld,empireLiveops,empireAccess,'
  + 'listings,moderation,products,catalog,articles,categories,studio,scraper,persiansaze,'
  + 'users,profiles,agencyintel,crm,roles,suspension,support,'
  + 'plans,payment,promos,discounts,ads,tracker,sms,aicost,smscost,'
  + 'api,connections,geo,sitemap,settings,health,servers,queue,audit,flags').split(',')

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'melkjet-default-secret-change-in-prod')
const token = await new SignJWT({ phone: '09122862184', role: 'super_admin' })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret)

// ---------- حالت ۱: مرورگرِ واقعی ----------
let chromium = null
if (process.env.HTTP_ONLY !== '1') {
  try { ({ chromium } = await import('playwright')) }
  catch { chromium = (await import('/opt/node22/lib/node_modules/playwright/index.mjs').catch(() => ({}))).chromium || null }
}

if (chromium) {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined }).catch(() => chromium.launch({ channel: 'chrome' }))
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } })
  const host = new URL(BASE).hostname
  await ctx.addCookies([{ name: 'mj_session', value: token, domain: host, path: '/' }])
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message.slice(0, 200)))
  page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
  page.on('response', r => { if (r.status() >= 500 && r.url().includes('/api/')) errs.push(`API ${r.status()}: ` + r.url().replace(BASE, '').slice(0, 120)) })

  let bad = 0
  for (const v of VIEWS) {
    errs.length = 0
    try {
      await page.goto(`${BASE}/admin?view=${v}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(2500)
      const stub = await page.getByText('این بخش در حال توسعه است').count().catch(() => 0)
      const uniq = [...new Set(errs)]
      if (uniq.length || stub) { bad++; console.log(`${stub ? '⚠️ STUB' : '❌'} ${v}${uniq.length ? ' | ' + uniq.slice(0, 3).join(' ; ') : ''}`) }
      else console.log(`✓ ${v}`)
    } catch (e) { bad++; console.log(`❌ ${v} NAV-FAIL ${e.message.slice(0, 100)}`) }
  }
  await browser.close()
  console.log(bad ? `\n❌ ${bad} منوی مشکل‌دار` : '\n✅ همهٔ منوهای سوپرادمین سالم')
  process.exit(bad ? 1 : 0)
}

// ---------- حالت ۲: HTTP (بدونِ مرورگر) ----------
console.log('playwright در دسترس نیست — حالتِ HTTP (چکِ صفحه + chunkها + APIها)\n')
const COOKIE = { headers: { cookie: `mj_session=${token}` } }
const get = (url, opts, timeoutMs = 15000) =>
  fetch(url, { ...opts, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) })
    .then(r => ({ status: r.status, text: () => r.text() }))
    .catch(e => ({ status: 0, err: String(e && e.cause || e).slice(0, 80), text: () => Promise.resolve('') }))
let bad = 0
const fail = msg => { bad++; console.log('❌ ' + msg) }

// ۱) صفحهٔ ادمین با کوکی باید 200 بدهد (302 → مشکلِ JWT_SECRET/کوکی)
const adm = await get(`${BASE}/admin`, COOKIE)
if (adm.status !== 200) fail(`/admin → ${adm.status || adm.err} (انتظار 200؛ اگر 30x بود یعنی کوکی/JWT_SECRET نمی‌خورد)`)
else console.log('✓ /admin با توکنِ سوپرادمین 200')
const html = adm.status === 200 ? await adm.text() : ''

// ۲) همهٔ chunkهای استاتیکِ داخلِ HTML — لوکال و از دامنهٔ عمومی
const chunks = [...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map(m => m[1]))]
if (adm.status === 200 && !chunks.length) fail('هیچ chunkِ استاتیکی در HTML پیدا نشد (HTML خراب؟)')
let localBad = 0, cdnBad = 0
for (const c of chunks) {
  const l = await get(BASE + c)
  if (l.status !== 200) { localBad++; fail(`chunk لوکال ${l.status || l.err}: ${c.slice(0, 90)}`) }
}
if (chunks.length && !localBad) console.log(`✓ هر ${chunks.length} chunk استاتیک روی خودِ سرور 200`)
if (PUBLIC && chunks.length) {
  let reachable = true
  for (const c of chunks) {
    const p = await get(PUBLIC + c, undefined, 20000)
    if (p.status === 0) { reachable = false; break }
    if (p.status !== 200) { cdnBad++; fail(`chunk از ${PUBLIC} → ${p.status}: ${c.slice(0, 90)}  ← کشِ کهنهٔ آروان`) }
  }
  if (!reachable) console.log(`⚠️ ${PUBLIC} از اینجا در دسترس نبود — چکِ CDN انجام نشد (PUBLIC=0 برای خاموش‌کردن)`)
  else if (!cdnBad) console.log(`✓ همان chunkها از ${PUBLIC} هم 200 (CDN تازه است)`)
  else console.log(`\n⛔ ${cdnBad} chunk در CDN کهنه است → پنلِ آروان → CDN → پاک‌سازیِ کش، بعد Ctrl+Shift+R`)
}

// ۳) APIهای ادمینِ پشتِ منوها — هر 5xx یعنی آن منو واقعاً خراب است (4xx = هندل‌شده، اشکالی نیست)
const APIS = [
  '/api/admin/system', '/api/admin/users', '/api/admin/profiles', '/api/admin/roles',
  '/api/admin/crm', '/api/admin/support', '/api/admin/plans', '/api/admin/payment',
  '/api/admin/promos', '/api/admin/promotions', '/api/admin/banners', '/api/admin/categories',
  '/api/admin/geo', '/api/admin/audit', '/api/admin/ai-cost', '/api/admin/sms-cost',
  '/api/admin/tracker-config', '/api/admin/agency-intel', '/api/admin/scraper/sources', '/api/admin/profile-options',
  '/api/admin/empire?view=overview', '/api/admin/empire?view=players', '/api/admin/empire?view=world',
  '/api/admin/empire?view=liveops', '/api/admin/empire?view=capital', '/api/admin/empire?view=engage', '/api/reos/admin', '/api/reos/config', '/api/reos/flags',
]
let apiBad = 0
for (const a of APIS) {
  const r = await get(BASE + a, COOKIE)
  if (r.status >= 500 || r.status === 0) { apiBad++; fail(`API ${r.status || r.err}: ${a}`) }
}
if (!apiBad) console.log(`✓ هر ${APIS.length} APIِ ادمین بدونِ 5xx`)

console.log(bad ? `\n❌ ${bad} مشکل پیدا شد` : '\n✅ حالتِ HTTP: صفحه، chunkها و APIها همه سالم')
if (!bad) console.log('   (برای چکِ کاملِ رندرِ تک‌تکِ منوها، همین را لوکال با playwright اجرا کن)')
process.exit(bad ? 1 : 0)
