// جزئیاتِ کاملِ یک پروژه را می‌گیرد تا ببینیم شمارهٔ سازنده کجاست.
// روی سرور:
//   PS_CHANNEL=chrome PS_USER=09122862184 PS_PASS='...' PS_HASH=44511088 node scripts/persiansaze-project.mjs
// (پیش‌فرض hashId همانی است که قبلاً دیده شده، تا سهمیهٔ اضافه مصرف نشود.)

import { chromium } from 'playwright-core'

const USER = process.env.PS_USER || '', PASS = process.env.PS_PASS || ''
const HASH = process.env.PS_HASH || '44511088'
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'

async function login(page) {
  await page.goto('https://my.persiansaze.com/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForURL(/id\.persiansaze\.com\/login/, { timeout: 60000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const m = page.locator('input[name="_model.MobileNumber"], input[placeholder*="موبایل"], input[type="tel"]').first()
  await m.waitFor({ state: 'visible', timeout: 30000 })
  await m.click(); await m.pressSequentially(USER, { delay: 70 }); await m.press('Tab'); await page.waitForTimeout(400)
  const p = page.locator('input[type="password"], input[name="_model.Password"]').first()
  await p.click(); await p.pressSequentially(PASS, { delay: 70 }); await p.press('Tab'); await page.waitForTimeout(700)
  const s = page.getByRole('button', { name: 'ورود', exact: true })
  await ((await s.count()) ? s.first() : page.locator('button[type="submit"]').first()).click()
  for (let i = 0; i < 45; i++) { await page.waitForTimeout(1000); if (await page.evaluate(() => Object.keys({ ...localStorage, ...sessionStorage }).some(k => /oidc\.user/i.test(k))).catch(() => false)) return true }
  return false
}

async function apiGet(page, path) {
  return page.evaluate(async (path) => {
    const a = { ...localStorage, ...sessionStorage }
    const k = Object.keys(a).find(k => /oidc\.user/i.test(k))
    const token = k ? JSON.parse(a[k]).access_token : ''
    const did = a['did'] || a['deviceId'] || ''
    const headers = { accept: 'application/json', authorization: 'Bearer ' + token }
    if (did) headers['did'] = did
    const r = await fetch(path, { headers })
    const t = await r.text()
    return { status: r.status, text: t }
  }, path)
}

async function main() {
  console.log('═══════════ جزئیاتِ پروژه ═══════════')
  if (!USER || !PASS) { console.log('⚠ PS_USER/PS_PASS لازم است.'); return }
  const opts = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] }
  if (process.env.PS_CHANNEL) opts.channel = process.env.PS_CHANNEL
  if (process.env.PS_CHROME) opts.executablePath = process.env.PS_CHROME
  const browser = await chromium.launch(opts)
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 430, height: 932 }, locale: 'fa-IR' })
  const page = await ctx.newPage()
  page.setDefaultTimeout(45000)
  if (!await login(page)) { console.log('✗ ورود ناموفق'); await browser.close(); return }
  console.log('✓ ورود موفق. hashId =', HASH)

  for (const path of [
    `/rest/api/user/v1/Project/${HASH}`,
    `/rest/api/user/v1/Project/${HASH}/Constructor`,
    `/rest/api/user/v1/Project/${HASH}/Constructors`,
    `/rest/api/user/v1/Project/${HASH}/Receptor`,
    `/rest/api/user/v1/Project/${HASH}/Contact`,
  ]) {
    const r = await apiGet(page, path)
    console.log(`\nGET ${path} → ${r.status}`)
    if (r.status === 200) {
      // JSON را زیبا چاپ کن (کاملِ پاسخ تا ۳۵۰۰ کاراکتر)
      let pretty = r.text
      try { pretty = JSON.stringify(JSON.parse(r.text), null, 1) } catch {}
      console.log(pretty.slice(0, 3500))
    } else {
      console.log('   ', r.text.slice(0, 200))
    }
  }
  // POST Constructor = گرفتنِ سازنده/شماره (چون GET آن ۴۰۵ داد، متد POST است)
  console.log('\n── POST Constructor (گرفتنِ شماره) ──')
  for (const body of ['{}', '', JSON.stringify({ projectHashId: HASH })]) {
    const r = await page.evaluate(async ({ path, body }) => {
      const a = { ...localStorage, ...sessionStorage }
      const k = Object.keys(a).find(k => /oidc\.user/i.test(k))
      const token = k ? JSON.parse(a[k]).access_token : ''
      const did = a['did'] || a['deviceId'] || ''
      const headers = { accept: 'application/json', 'content-type': 'application/json', authorization: 'Bearer ' + token }
      if (did) headers['did'] = did
      const opt = { method: 'POST', headers }
      if (body) opt.body = body
      const res = await fetch(path, opt)
      return { status: res.status, text: await res.text() }
    }, { path: `/rest/api/user/v1/Project/${HASH}/Constructor`, body })
    console.log(`POST .../Constructor  body=${body || '(خالی)'} → ${r.status}`)
    let pretty = r.text; try { pretty = JSON.stringify(JSON.parse(r.text), null, 1) } catch {}
    console.log('   ', pretty.slice(0, 1200))
    if (r.status >= 200 && r.status < 300) break
  }
  await browser.close()
  console.log('\n═══════════ پایان ═══════════')
}

main().catch(e => { console.error('خطای کلی:', e); process.exit(1) })
