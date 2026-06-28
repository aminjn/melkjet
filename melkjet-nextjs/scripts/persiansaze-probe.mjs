// پروبِ تشخیصیِ پرشین سازه — برای فهمیدنِ مکانیزمِ ورود و ساختارِ دیتا.
// روی سرور (IP ایران) اجرا کن، چون سایت IP خارجی را می‌بندد.
//
// روشِ اجرا روی سرور:
//   cd /var/www/melkjet/melkjet-nextjs
//   PS_USER='یوزرت' PS_PASS='پسوردت' node scripts/persiansaze-probe.mjs
//   (اختیاری) آدرسِ صفحهٔ لیستِ سازنده‌ها را هم بده تا نمونه‌اش را بگیرد:
//   PS_USER='..' PS_PASS='..' node scripts/persiansaze-probe.mjs "https://my.persiansaze.com/..."
//
// خروجی را کامل برایم بفرست (یوزر/پسورد در خروجی چاپ نمی‌شود).

const USER = process.env.PS_USER || ''
const PASS = process.env.PS_PASS || ''
const LIST_URL = process.argv[2] || ''

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const BASE_HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
}

// نامزدهای صفحهٔ ورود (اولین که جواب داد استفاده می‌شود).
const LOGIN_CANDIDATES = [
  'https://my.persiansaze.com/login',
  'https://my.persiansaze.com/',
  'https://panel.persiansaze.com/login',
  'https://panel.persiansaze.com/',
]

// ── ابزارِ ساده برای کوکی و پارسِ HTML بدونِ وابستگی ──────────────────────
const jar = new Map()
function storeCookies(res) {
  const sc = (typeof res.headers.getSetCookie === 'function') ? res.headers.getSetCookie() : []
  for (const line of sc) {
    const [pair] = line.split(';')
    const i = pair.indexOf('=')
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim())
  }
  return sc
}
function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}
function hdr(extra = {}) {
  const h = { ...BASE_HEADERS, ...extra }
  if (jar.size) h['Cookie'] = cookieHeader()
  return h
}
function snippet(s, n = 1200) { return (s || '').replace(/\s+/g, ' ').slice(0, n) }

// استخراجِ فرم‌ها و اینپوت‌ها از HTML
function parseForms(html) {
  const forms = []
  const formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi
  let m
  while ((m = formRe.exec(html))) {
    const attrs = m[1], inner = m[2]
    const action = (attrs.match(/action\s*=\s*["']([^"']*)["']/i) || [])[1] || ''
    const method = ((attrs.match(/method\s*=\s*["']([^"']*)["']/i) || [])[1] || 'GET').toUpperCase()
    const inputs = []
    const inRe = /<(input|select|textarea)\b([^>]*)>/gi
    let im
    while ((im = inRe.exec(inner))) {
      const a = im[2]
      inputs.push({
        tag: im[1].toLowerCase(),
        name: (a.match(/name\s*=\s*["']([^"']*)["']/i) || [])[1] || '',
        type: (a.match(/type\s*=\s*["']([^"']*)["']/i) || [])[1] || '',
        value: (a.match(/value\s*=\s*["']([^"']*)["']/i) || [])[1] || '',
        id: (a.match(/id\s*=\s*["']([^"']*)["']/i) || [])[1] || '',
        placeholder: (a.match(/placeholder\s*=\s*["']([^"']*)["']/i) || [])[1] || '',
      })
    }
    forms.push({ action, method, inputs })
  }
  return forms
}

function detectSpa(html) {
  const markers = []
  if (/__NEXT_DATA__/.test(html)) markers.push('Next.js')
  if (/window\.__NUXT__/.test(html)) markers.push('Nuxt')
  if (/id=["']root["']|id=["']app["']/.test(html)) markers.push('SPA root div (React/Vue)')
  if (/csrf[-_]?token/i.test(html)) markers.push('csrf-token present')
  const scripts = [...html.matchAll(/<script[^>]*src\s*=\s*["']([^"']+)["']/gi)].map(x => x[1]).slice(0, 8)
  return { markers, scripts }
}

function abs(base, url) {
  try { return new URL(url, base).toString() } catch { return url }
}

async function main() {
  console.log('═══════════ پروبِ پرشین سازه ═══════════')
  console.log('Node:', process.version, '| creds:', USER ? 'داده‌شده' : 'خالی')

  // ── ۱) صفحهٔ ورود را پیدا و تحلیل کن ──────────────────────────────────
  let loginUrl = '', loginHtml = '', loginRes = null
  for (const u of LOGIN_CANDIDATES) {
    try {
      const r = await fetch(u, { headers: hdr(), redirect: 'follow' })
      const body = await r.text()
      console.log(`\nGET ${u} → HTTP ${r.status} | ${r.headers.get('content-type') || ''} | ${body.length}b`)
      storeCookies(r)
      if (r.status === 200 && body.length > 200) { loginUrl = r.url || u; loginHtml = body; loginRes = r; break }
    } catch (e) { console.log(`\nGET ${u} → خطا: ${e.message}`) }
  }
  if (!loginHtml) { console.log('\n⚠ هیچ صفحهٔ ورودی باز نشد. (DNS/شبکهٔ سرور را چک کن یا آدرس را دستی بده)'); return }

  console.log('\n── تحلیلِ صفحهٔ ورود:', loginUrl, '──')
  const spa = detectSpa(loginHtml)
  console.log('نشانه‌ها:', spa.markers.join(', ') || 'هیچ (احتمالاً HTMLِ سروری)')
  console.log('اسکریپت‌ها:', spa.scripts.join('  ') || '—')
  const forms = parseForms(loginHtml)
  console.log(`فرم‌ها: ${forms.length}`)
  forms.forEach((f, i) => {
    console.log(`  فرم#${i}: ${f.method} action="${f.action}"`)
    f.inputs.forEach(inp => console.log(`     - ${inp.tag} name="${inp.name}" type="${inp.type}" id="${inp.id}" ph="${inp.placeholder}" ${inp.value ? `value="${inp.value.slice(0, 20)}"` : ''}`))
  })
  console.log('کوکی‌های اولیه:', [...jar.keys()].join(', ') || '—')

  if (!USER || !PASS) {
    console.log('\nℹ برای تستِ ورود، PS_USER و PS_PASS را ست کن و دوباره اجرا کن.')
    console.log('\n── نمونهٔ HTMLِ صفحهٔ ورود (۸۰۰ کاراکتر) ──\n', snippet(loginHtml, 800))
    return
  }

  // ── ۲) تلاش برای ورود ────────────────────────────────────────────────
  // فرمی که اینپوتِ password دارد را انتخاب کن
  const loginForm = forms.find(f => f.inputs.some(i => i.type === 'password')) || forms[0]
  if (!loginForm) { console.log('\n⚠ فرمِ ورودی پیدا نشد — احتمالاً SPA است؛ تب Network مرورگر را بفرست.'); return }
  const passField = (loginForm.inputs.find(i => i.type === 'password') || {}).name || 'password'
  const userField = (loginForm.inputs.find(i => /text|email|tel|^$/.test(i.type) && i.name && i.name !== passField) || {}).name || 'username'
  // همهٔ فیلدهای مخفی/پیش‌فرض را حفظ کن (CSRF و …)
  const payload = {}
  for (const inp of loginForm.inputs) if (inp.name && inp.value) payload[inp.name] = inp.value
  payload[userField] = USER
  payload[passField] = PASS
  const postUrl = abs(loginUrl, loginForm.action || loginUrl)
  console.log(`\n── ارسالِ ورود → ${loginForm.method} ${postUrl}`)
  console.log(`   فیلدِ یوزر="${userField}"  فیلدِ پسورد="${passField}"  سایرِ فیلدها: ${Object.keys(payload).filter(k => k !== userField && k !== passField).join(', ') || '—'}`)

  let postRes, postBody = ''
  try {
    postRes = await fetch(postUrl, {
      method: 'POST',
      headers: hdr({ 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': new URL(loginUrl).origin, 'Referer': loginUrl }),
      body: new URLSearchParams(payload).toString(),
      redirect: 'manual',
    })
    postBody = await postRes.text().catch(() => '')
  } catch (e) { console.log('   خطا در ارسالِ ورود:', e.message); return }
  const newCookies = storeCookies(postRes)
  console.log(`   پاسخ: HTTP ${postRes.status} | location=${postRes.headers.get('location') || '—'}`)
  console.log(`   کوکی‌های جدید: ${newCookies.map(c => c.split(';')[0]).join(', ') || '—'}`)
  console.log(`   نوعِ پاسخ: ${postRes.headers.get('content-type') || '—'} | ${postBody.length}b`)
  // اگر JSON برگرداند (توکن)، نشانش بده
  if (/json/.test(postRes.headers.get('content-type') || '')) console.log('   بدنه(JSON):', snippet(postBody, 600))
  const loggedIn = (postRes.status >= 300 && postRes.status < 400) || jar.size > [...jar.keys()].length - newCookies.length || newCookies.length > 0
  console.log(`   به‌نظر ورود ${loggedIn ? 'موفق ✓' : 'ناموفق ✗ (شاید کپچا/OTP یا فیلدِ اشتباه)'}`)

  // اگر ریدایرکت داد، دنبالش کن تا کوکیِ نشست تثبیت شود
  const loc = postRes.headers.get('location')
  if (loc) {
    const dash = abs(postUrl, loc)
    try {
      const r = await fetch(dash, { headers: hdr(), redirect: 'follow' })
      const b = await r.text(); storeCookies(r)
      console.log(`\nGET داشبورد ${dash} → HTTP ${r.status} | ${r.headers.get('content-type')} | ${b.length}b`)
      // لینک‌های داخلِ داشبورد (برای یافتنِ صفحهٔ لیستِ سازنده‌ها)
      const links = [...b.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(x => x[1]).filter(h => /list|build|saze|project|porozhe|karfarma|data|search/i.test(h))
      console.log('لینک‌های محتمل (لیست/پروژه/سازنده):', [...new Set(links)].slice(0, 15).join('  ') || '—')
    } catch (e) { console.log('خطا در گرفتنِ داشبورد:', e.message) }
  }

  // ── ۳) نمونهٔ صفحهٔ دیتا ──────────────────────────────────────────────
  if (LIST_URL) {
    try {
      const r = await fetch(LIST_URL, { headers: hdr(), redirect: 'follow' })
      const ct = r.headers.get('content-type') || ''
      const b = await r.text()
      console.log(`\n── صفحهٔ دیتا ${LIST_URL} → HTTP ${r.status} | ${ct} | ${b.length}b ──`)
      if (/json/.test(ct)) {
        console.log('JSON ✓ (عالی — مستقیم API را می‌زنیم). نمونه:\n', snippet(b, 1500))
      } else {
        // به‌دنبالِ نشانه‌های جدول/کارت بگرد
        const rows = (b.match(/<tr\b/gi) || []).length
        const cards = (b.match(/class\s*=\s*["'][^"']*(card|item|list-row|box)[^"']*["']/gi) || []).length
        console.log(`HTML — <tr>=${rows} کارت‌ها≈${cards}`)
        console.log('نمونهٔ HTML:\n', snippet(b, 1500))
      }
    } catch (e) { console.log('خطا در گرفتنِ صفحهٔ دیتا:', e.message) }
  } else {
    console.log('\nℹ آدرسِ صفحهٔ لیستِ سازنده‌ها را به‌عنوانِ آرگومان بده تا نمونهٔ دیتا را هم بگیرم.')
  }
  console.log('\n═══════════ پایان ═══════════')
}

main().catch(e => console.error('خطای کلی:', e))
