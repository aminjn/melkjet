// اسکرپرِ پرشین سازه — لاگینِ خودکار (Playwright + Chrome) و کشیدنِ همهٔ پروژه‌ها،
// سپس یکتاکردنِ سازنده‌ها. خروجی در .persiansaze-data.json (کنارِ اپ، gitignore).
//
// روی سرور:
//   PS_CHANNEL=chrome PS_USER=09xxxxxxxxx PS_PASS='...' node scripts/persiansaze-scrape.mjs
//   (اختیاری) PS_MAX_PAGES=5  → فقط ۵ صفحه (۱۰۰ پروژه) برای تست
//   (اختیاری) PS_LIMIT=50     → اندازهٔ هر صفحه (پیش‌فرض ۲۰، مثلِ خودِ سایت)
//
// کانفیگ از env یا از فایلِ .persiansaze-config.json (gitignore) خوانده می‌شود.

import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const CWD = process.cwd()
const CONFIG_FILE = path.join(CWD, '.persiansaze-config.json')
const DATA_FILE = path.join(CWD, '.persiansaze-data.json')

function loadConfig() {
  let c = {}
  try { c = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) } catch {}
  return {
    user: process.env.PS_USER || c.user || '',
    pass: process.env.PS_PASS || c.pass || '',
    channel: process.env.PS_CHANNEL || c.channel || 'chrome',
    chrome: process.env.PS_CHROME || c.chrome || '',
    limit: Number(process.env.PS_LIMIT || c.limit || 20),
    maxPages: Number(process.env.PS_MAX_PAGES || c.maxPages || 0), // 0 = همه
  }
}

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
const FILTER_BODY = {
  term: '', searchType: 'Project', type: 'All', onlyWithConstructor: true,
  cityIds: [], regionIds: [], subRegionIds: [], phaseIds: [], folderIds: [],
  usageTypesIds: [], structureTypeIds: [], lastPhaseUpdateDateType: null, subscriptionTypes: [],
}

const log = (...a) => console.log(new Date().toLocaleTimeString('en-GB'), ...a)

// ── ورودِ خودکار، برگرداندنِ page برای صدا زدنِ API از داخلِ نشست ──
async function login(cfg) {
  const opts = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] }
  if (cfg.channel) opts.channel = cfg.channel
  if (cfg.chrome) opts.executablePath = cfg.chrome
  const browser = await chromium.launch(opts)
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 430, height: 932 }, locale: 'fa-IR' })
  const page = await ctx.newPage()
  page.setDefaultTimeout(45000)
  log('باز کردنِ پنل و ورود…')
  await page.goto('https://my.persiansaze.com/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForURL(/id\.persiansaze\.com\/login/, { timeout: 60000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const mobile = page.locator('input[name="_model.MobileNumber"], input[placeholder*="موبایل"], input[type="tel"]').first()
  await mobile.waitFor({ state: 'visible', timeout: 30000 })
  await mobile.click(); await mobile.pressSequentially(cfg.user, { delay: 70 }); await mobile.press('Tab')
  await page.waitForTimeout(400)
  const pass = page.locator('input[type="password"], input[name="_model.Password"]').first()
  await pass.click(); await pass.pressSequentially(cfg.pass, { delay: 70 }); await pass.press('Tab')
  await page.waitForTimeout(700)
  const submit = page.getByRole('button', { name: 'ورود', exact: true })
  await ((await submit.count()) ? submit.first() : page.locator('button[type="submit"]').first()).click()
  let ok = false
  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(1000)
    if (await page.evaluate(() => { const a = { ...localStorage, ...sessionStorage }; return Object.keys(a).some(k => /oidc\.user/i.test(k)) }).catch(() => false)) { ok = true; break }
  }
  if (!ok) { await browser.close(); throw new Error('ورود ناموفق — یوزر/پسورد یا فرمِ ورود را بررسی کن.') }
  log('✓ ورود موفق.')
  return { browser, page }
}

// یک صفحه از Project/Filter را از داخلِ نشست می‌گیرد.
async function fetchPage(page, offset, limit) {
  return page.evaluate(async ({ body, offset, limit }) => {
    const a = { ...localStorage, ...sessionStorage }
    const k = Object.keys(a).find(k => /oidc\.user/i.test(k))
    const token = k ? JSON.parse(a[k]).access_token : ''
    const did = a['did'] || a['deviceId'] || ''
    const headers = { 'content-type': 'application/json', accept: 'application/json', authorization: 'Bearer ' + token }
    if (did) headers['did'] = did
    const r = await fetch(`/rest/api/user/v1/Project/Filter?limit=${limit}&offset=${offset}`, { method: 'POST', headers, body: JSON.stringify(body) })
    if (r.status !== 200) return { status: r.status, results: [] }
    const j = await r.json().catch(() => ({}))
    return { status: 200, results: j.results || j.items || [] }
  }, { body: FILTER_BODY, offset, limit })
}

function summarizeBuilders(projects) {
  const map = new Map()
  for (const p of projects) {
    const name = (p.receptor || '').trim()
    if (!name) continue
    if (!map.has(name)) map.set(name, { name, projectCount: 0, hashIds: [], regions: new Set() })
    const b = map.get(name)
    b.projectCount++
    if (b.hashIds.length < 50) b.hashIds.push(p.hashId)
    if (p.regionId) b.regions.add(p.regionId)
  }
  return [...map.values()].map(b => ({ name: b.name, projectCount: b.projectCount, hashIds: b.hashIds, regions: [...b.regions] }))
    .sort((a, b) => b.projectCount - a.projectCount)
}

async function main() {
  const cfg = loadConfig()
  console.log('═══════════ اسکرپِ پرشین سازه ═══════════')
  if (!cfg.user || !cfg.pass) { console.log('⚠ یوزر/پسورد تنظیم نشده (PS_USER/PS_PASS یا .persiansaze-config.json).'); process.exit(1) }
  const t0 = Date.now()
  let session
  try { session = await login(cfg) } catch (e) { console.log('✗', e.message); process.exit(1) }
  const { browser, page } = session

  const all = []
  const seen = new Set()
  let offset = 0, pageNo = 0, empty = 0
  try {
    while (true) {
      pageNo++
      const { status, results } = await fetchPage(page, offset, cfg.limit)
      if (status !== 200) { log(`صفحهٔ ${pageNo}: HTTP ${status} — توقف.`); break }
      if (!results.length) { empty++; if (empty >= 2) { log('پایانِ لیست.'); break } }
      else empty = 0
      for (const p of results) { if (p.hashId && !seen.has(p.hashId)) { seen.add(p.hashId); all.push(p) } }
      if (pageNo % 10 === 0 || results.length < cfg.limit) log(`صفحهٔ ${pageNo} | offset ${offset} | تا اینجا ${all.length} پروژه`)
      offset += cfg.limit
      if (cfg.maxPages && pageNo >= cfg.maxPages) { log(`به سقفِ ${cfg.maxPages} صفحه رسید.`); break }
      await page.waitForTimeout(300) // ملایم
    }
  } catch (e) { log('خطا حینِ کشیدن:', e.message) }
  await browser.close()

  const builders = summarizeBuilders(all)
  const out = {
    lastSync: new Date().toISOString(),
    totalProjects: all.length,
    totalBuilders: builders.length,
    projects: all,
    builders,
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(out))
  const secs = Math.round((Date.now() - t0) / 1000)
  console.log('\n═══════════ نتیجه ═══════════')
  console.log(`پروژه‌ها: ${all.length.toLocaleString('en-US')}`)
  console.log(`سازنده‌های یکتا: ${builders.length.toLocaleString('en-US')}`)
  console.log(`نسبتِ صرفه‌جویی: هر سازنده میانگین ${(all.length / Math.max(1, builders.length)).toFixed(1)} پروژه`)
  console.log(`زمان: ${secs} ثانیه`)
  console.log(`ذخیره شد در: ${DATA_FILE}`)
  console.log('\nنمونهٔ ۵ سازندهٔ پرکار:')
  for (const b of builders.slice(0, 5)) console.log(`   ${b.projectCount}×  ${b.name}`)
}

main().catch(e => { console.error('خطای کلی:', e); process.exit(1) })
