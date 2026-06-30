// تستِ لاگینِ خودکارِ پرشین سازه با مرورگرِ پنهان (Playwright).
// روی سرور:
//   cd /var/www/melkjet/melkjet-nextjs
//   npm i playwright && npx playwright install --with-deps chromium
//   PS_USER=09129327906 PS_PASS='پسوردت' node scripts/persiansaze-pw-test.mjs
//
// اگر موفق شد، اسکرپرِ کامل را روی همین مبنا می‌سازم.

import { chromium } from 'playwright'

const USER = process.env.PS_USER || ''
const PASS = process.env.PS_PASS || ''
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'

const FILTER_BODY = {
  term: '', searchType: 'Project', type: 'All', onlyWithConstructor: true,
  cityIds: [], regionIds: [], subRegionIds: [], phaseIds: [], folderIds: [],
  usageTypesIds: [], structureTypeIds: [], lastPhaseUpdateDateType: null, subscriptionTypes: [],
}

async function main() {
  console.log('═══════════ تستِ Playwright پرشین سازه ═══════════')
  if (!USER || !PASS) { console.log('⚠ PS_USER و PS_PASS را ست کن.'); return }
  const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] }
  if (process.env.PS_CHANNEL) { launchOpts.channel = process.env.PS_CHANNEL; console.log('channel:', process.env.PS_CHANNEL) }
  if (process.env.PS_CHROME) { launchOpts.executablePath = process.env.PS_CHROME; console.log('کروم:', process.env.PS_CHROME) }
  const browser = await chromium.launch(launchOpts)
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 430, height: 932 }, locale: 'fa-IR' })
  const page = await ctx.newPage()
  page.setDefaultTimeout(45000)
  try {
    console.log('→ بازکردنِ پنل…')
    await page.goto('https://my.persiansaze.com/', { waitUntil: 'domcontentloaded', timeout: 60000 })
    // به صفحهٔ ورودِ id.persiansaze.com ریدایرکت می‌شود (Blazor)
    await page.waitForURL(/id\.persiansaze\.com\/login/, { timeout: 60000 }).catch(() => {})
    console.log('   آدرسِ فعلی:', page.url())

    console.log('→ پر کردنِ فرمِ ورود…')
    const mobile = page.locator('input[name="_model.MobileNumber"], input[placeholder*="موبایل"]').first()
    await mobile.waitFor({ state: 'visible', timeout: 30000 })
    await mobile.click(); await mobile.fill(''); await mobile.type(USER, { delay: 40 })
    const pass = page.locator('input[type="password"], input[name="_model.Password"]').first()
    await pass.click(); await pass.fill(''); await pass.type(PASS, { delay: 40 })

    console.log('→ زدنِ دکمهٔ ورود…')
    await Promise.all([
      page.waitForURL(/my\.persiansaze\.com/, { timeout: 60000 }).catch(() => {}),
      page.locator('button:has-text("ورود"), button[type="submit"]').first().click(),
    ])
    // کمی صبر تا توکن در storage بنشیند
    await page.waitForTimeout(4000)
    console.log('   آدرسِ بعدِ ورود:', page.url())

    const token = await page.evaluate(() => {
      const a = { ...localStorage, ...sessionStorage }
      const k = Object.keys(a).find(k => /oidc\.user/i.test(k))
      if (!k) return null
      try { return JSON.parse(a[k]).access_token } catch { return null }
    })
    if (!token) {
      console.log('✗ توکن پیدا نشد — احتمالاً ورود کامل نشد. اسکرین‌شات: /tmp/ps-login.png')
      await page.screenshot({ path: '/tmp/ps-login.png', fullPage: true }).catch(() => {})
      const txt = await page.evaluate(() => document.body.innerText.slice(0, 300)).catch(() => '')
      console.log('   متنِ صفحه:', txt.replace(/\s+/g, ' '))
      return
    }
    console.log('✓✓ ورود موفق! طولِ access_token:', token.length)

    console.log('\n→ کشیدنِ لیستِ پروژه‌ها از داخلِ همان نشست (HTTP/2 + همهٔ هدرها خودکار)…')
    const res = await page.evaluate(async (body) => {
      const r = await fetch('/rest/api/user/v1/Project/Filter?limit=3&offset=0', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body),
      })
      return { status: r.status, text: (await r.text()).slice(0, 1600) }
    }, FILTER_BODY)
    console.log('   وضعیت:', res.status)
    console.log('   نمونهٔ دیتا:', res.text)

    // تعدادِ کلِ پروژه‌ها (با offset بزرگ یا هدرِ count) — یک تستِ سریع
    console.log('\n✓ اگر بالا لیستِ پروژه‌ها آمد، یعنی کلِ زنجیره خودکار کار می‌کند.')
  } catch (e) {
    console.log('✗ خطا:', e.message)
    await page.screenshot({ path: '/tmp/ps-login.png', fullPage: true }).catch(() => {})
    console.log('   اسکرین‌شات: /tmp/ps-login.png')
  } finally {
    await browser.close()
  }
}

main().catch(e => { console.error('خطای کلی:', e); process.exit(1) })
