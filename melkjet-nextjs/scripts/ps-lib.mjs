// کتابخانهٔ مشترکِ پرشین سازه: لاگینِ خودکار با مرورگرِ پنهان + صدا زدنِ API
// از داخلِ همان نشست (HTTP/2 + توکن خودکار). توسطِ اسکریپت‌های scrape/reveal استفاده می‌شود.

import { chromium } from 'playwright'

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'

export async function launch(cfg) {
  const opts = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] }
  if (cfg.channel) opts.channel = cfg.channel
  if (cfg.chrome) opts.executablePath = cfg.chrome
  const browser = await chromium.launch(opts)
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 430, height: 932 }, locale: 'fa-IR' })
  const page = await ctx.newPage()
  page.setDefaultTimeout(45000)
  await page.goto('https://my.persiansaze.com/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForURL(/id\.persiansaze\.com\/login/, { timeout: 60000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const m = page.locator('input[name="_model.MobileNumber"], input[placeholder*="موبایل"], input[type="tel"]').first()
  await m.waitFor({ state: 'visible', timeout: 30000 })
  await m.click(); await m.pressSequentially(cfg.user, { delay: 70 }); await m.press('Tab'); await page.waitForTimeout(400)
  const p = page.locator('input[type="password"], input[name="_model.Password"]').first()
  await p.click(); await p.pressSequentially(cfg.pass, { delay: 70 }); await p.press('Tab'); await page.waitForTimeout(700)
  const s = page.getByRole('button', { name: 'ورود', exact: true })
  await ((await s.count()) ? s.first() : page.locator('button[type="submit"]').first()).click()
  let ok = false
  for (let i = 0; i < 45; i++) { await page.waitForTimeout(1000); if (await page.evaluate(() => Object.keys({ ...localStorage, ...sessionStorage }).some(k => /oidc\.user/i.test(k))).catch(() => false)) { ok = true; break } }
  if (!ok) { await browser.close(); throw new Error('ورود ناموفق — یوزر/پسورد یا فرمِ ورود را بررسی کن.') }
  return { browser, page }
}

// صدا زدنِ API از داخلِ نشست (توکن/هدرها خودکار). متد GET یا POST.
export async function api(page, path, { method = 'GET', body } = {}) {
  return page.evaluate(async ({ path, method, body }) => {
    const a = { ...localStorage, ...sessionStorage }
    const k = Object.keys(a).find(k => /oidc\.user/i.test(k))
    const token = k ? JSON.parse(a[k]).access_token : ''
    const did = a['did'] || a['deviceId'] || ''
    const headers = { accept: 'application/json', authorization: 'Bearer ' + token }
    if (method === 'POST') headers['content-type'] = 'application/json'
    if (did) headers['did'] = did
    const opt = { method, headers }
    if (method === 'POST') opt.body = body || '{}'
    const r = await fetch(path, opt)
    const t = await r.text()
    let json = null; try { json = JSON.parse(t) } catch {}
    return { status: r.status, json, text: t }
  }, { path, method, body })
}
