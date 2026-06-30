// کشفِ endpointِ «گرفتنِ شمارهٔ تماس» در پرشین سازه — با مرورگرِ پنهان.
// لاگین می‌کند، صفحهٔ پنل را باز می‌کند، همهٔ درخواست‌های API را شنود می‌کند،
// ساختارِ کارت را چاپ می‌کند و دکمه‌های کارت را می‌زند تا درخواستِ شماره را شکار کند.
//
// روی سرور:
//   PS_CHANNEL=chrome PS_USER=09122862184 PS_PASS='...' node scripts/persiansaze-discover-reveal.mjs
// (۱ شماره از سهمیه کم می‌شود — برای کشفِ endpoint لازم است.)

import { chromium } from 'playwright'

const USER = process.env.PS_USER || ''
const PASS = process.env.PS_PASS || ''
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
const KNOWN = /Filter|Account|Popup|Folder|Badge|BusinessLines|Version|Entities|Notif|Claims|Avatar|Profile/

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

async function main() {
  console.log('═══════════ کشفِ endpointِ شماره ═══════════')
  if (!USER || !PASS) { console.log('⚠ PS_USER/PS_PASS لازم است.'); return }
  const opts = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] }
  if (process.env.PS_CHANNEL) opts.channel = process.env.PS_CHANNEL
  if (process.env.PS_CHROME) opts.executablePath = process.env.PS_CHROME
  const browser = await chromium.launch(opts)
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 430, height: 932 }, locale: 'fa-IR' })
  const page = await ctx.newPage()
  page.setDefaultTimeout(45000)

  // شنودِ همهٔ درخواست‌های API (به‌جز شناخته‌شده‌ها)
  const captured = []
  page.on('request', req => {
    const u = req.url()
    if (/\/rest\/api\//.test(u) && !KNOWN.test(u)) captured.push({ method: req.method(), url: u, body: req.postData() || '' })
  })
  page.on('response', async res => {
    const u = res.url()
    if (/\/rest\/api\//.test(u) && !KNOWN.test(u)) {
      let t = ''; try { t = (await res.text()).slice(0, 300) } catch {}
      console.log(`\n📥 RESP ${res.status()} ${res.request().method()} ${u}\n   ${t}`)
    }
  })

  if (!await login(page)) { console.log('✗ ورود ناموفق'); await browser.close(); return }
  console.log('✓ ورود موفق. باز کردنِ لیستِ پروژه‌ها…')
  await page.goto('https://my.persiansaze.com/', { waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.waitForTimeout(6000) // لود شدنِ کارت‌ها

  // ساختارِ اولین کارت را چاپ کن (برای یافتنِ دکمهٔ شماره)
  const cardHtml = await page.evaluate(() => {
    const sel = ['[class*="card"]', '[class*="Card"]', '[class*="item"]', '[class*="project"]', 'article', 'li']
    for (const s of sel) { const el = document.querySelector(s); if (el && el.querySelector('img')) return el.outerHTML }
    return document.body.innerHTML.slice(0, 3000)
  }).catch(() => '')
  console.log('\n── HTMLِ اولین کارت (۲۵۰۰ کاراکتر) ──\n', cardHtml.replace(/\s+/g, ' ').slice(0, 2500))

  // همهٔ دکمه‌ها/آیکن‌های کلیک‌پذیرِ داخلِ اولین کارت را پیدا کن و یکی‌یکی بزن
  console.log('\n── کلیک روی دکمه‌های کارت برای شکارِ درخواستِ شماره ──')
  const clickables = await page.evaluate(() => {
    const card = [...document.querySelectorAll('[class*="card"],[class*="item"],[class*="project"],article,li')].find(el => el.querySelector('img'))
    if (!card) return 0
    const els = card.querySelectorAll('button, [role="button"], svg, i, [class*="icon"], [class*="btn"], a')
    return els.length
  }).catch(() => 0)
  console.log('   تعدادِ عناصرِ کلیک‌پذیرِ کارت:', clickables)

  for (let i = 0; i < Math.min(clickables, 8); i++) {
    const before = captured.length
    try {
      await page.evaluate((idx) => {
        const card = [...document.querySelectorAll('[class*="card"],[class*="item"],[class*="project"],article,li')].find(el => el.querySelector('img'))
        const els = card.querySelectorAll('button, [role="button"], svg, i, [class*="icon"], [class*="btn"], a')
        if (els[idx]) els[idx].dispatchEvent(new MouseEvent('click', { bubbles: true }))
      }, i)
    } catch {}
    await page.waitForTimeout(1500)
    if (captured.length > before) {
      console.log(`   ✓ کلیکِ عنصرِ #${i} یک درخواستِ جدید زد:`)
      for (const c of captured.slice(before)) console.log(`      ${c.method} ${c.url}  body=${c.body || '—'}`)
    }
  }

  console.log('\n── همهٔ درخواست‌های ناشناختهٔ ثبت‌شده ──')
  if (!captured.length) console.log('   هیچ — شاید دکمهٔ شماره با کلیکِ مصنوعی فعال نشد. HTMLِ کارت بالا را بفرست تا سلکتورِ دقیق را بدهم.')
  for (const c of captured) console.log(`   ${c.method} ${c.url}  body=${c.body || '—'}`)
  await browser.close()
  console.log('\n═══════════ پایان ═══════════')
}

main().catch(e => { console.error('خطای کلی:', e); process.exit(1) })
