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

import crypto from 'node:crypto'

const USER = process.env.PS_USER || ''
const PASS = process.env.PS_PASS || ''
const TOKEN = process.env.PS_TOKEN || ''
const DID = process.env.PS_DID || 'ZXFCLKGXBHGXAZXBVEGKDDPNDDIJAIZK'
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

// fetch با تایم‌اوت (تا اگر سایت جواب نداد، گیر نکنیم)
async function fetchT(url, opts = {}, ms = 15000) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), ms)
  try { return await fetch(url, { ...opts, signal: ac.signal }) }
  finally { clearTimeout(t) }
}

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

// decodeِ entityهای HTML (مهم برای action که &amp; دارد)
function htmlDecode(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/gi, "'").replace(/&nbsp;/g, ' ')
}

// استخراجِ فرم‌ها و اینپوت‌ها از HTML
function parseForms(html) {
  const forms = []
  const formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi
  let m
  while ((m = formRe.exec(html))) {
    const attrs = m[1], inner = m[2]
    const action = htmlDecode((attrs.match(/action\s*=\s*["']([^"']*)["']/i) || [])[1] || '')
    const method = ((attrs.match(/method\s*=\s*["']([^"']*)["']/i) || [])[1] || 'GET').toUpperCase()
    const inputs = []
    const inRe = /<(input|select|textarea)\b([^>]*)>/gi
    let im
    while ((im = inRe.exec(inner))) {
      const a = im[2]
      inputs.push({
        tag: im[1].toLowerCase(),
        name: htmlDecode((a.match(/name\s*=\s*["']([^"']*)["']/i) || [])[1] || ''),
        type: (a.match(/type\s*=\s*["']([^"']*)["']/i) || [])[1] || '',
        value: htmlDecode((a.match(/value\s*=\s*["']([^"']*)["']/i) || [])[1] || ''),
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

// API را که React صدا می‌زند، از env.js و bundleهای JS کشف کن.
let API_BASE = ''
const API_PATHS = new Set()
const ENV = {}

// سندِ OIDC و صفحهٔ ورودِ Identity Server را بررسی کن.
async function discoverOidc() {
  const authority = (Object.values(ENV).find(v => /id\.persiansaze|identity|sso/i.test(v)) || 'https://id.persiansaze.com').replace(/\/$/, '')
  console.log('\n── بررسیِ OIDC روی', authority, '──')
  let disc = null
  try {
    const r = await fetchT(authority + '/.well-known/openid-configuration', { headers: hdr({ Accept: 'application/json' }) }, 15000)
    const txt = await r.text()
    console.log(`GET .well-known/openid-configuration → ${r.status} | ${txt.length}b`)
    if (r.status === 200) { try { disc = JSON.parse(txt) } catch {} }
  } catch (e) { console.log('  خطا:', e.message) }
  if (disc) {
    console.log('  token_endpoint:', disc.token_endpoint)
    console.log('  authorization_endpoint:', disc.authorization_endpoint)
    console.log('  grant_types_supported:', (disc.grant_types_supported || []).join(', '))
    console.log('  scopes_supported:', (disc.scopes_supported || []).join(', '))
    const hasRopc = (disc.grant_types_supported || []).includes('password')
    console.log('  ⇒ ورود مستقیم با پسورد (ROPC):', hasRopc ? 'پشتیبانی می‌شود ✓' : 'پشتیبانی نمی‌شود ✗ (باید از صفحهٔ ورود برویم)')
    if (hasRopc && USER && PASS) await tryRopc(disc.token_endpoint)
  }
  // صفحهٔ ورودِ Identity Server (معمولاً HTMLِ سروری با توکنِ antiforgery)
  for (const lp of ['/Account/Login', '/account/login', '/Identity/Account/Login', '/login']) {
    try {
      const r = await fetchT(authority + lp, { headers: hdr() }, 15000)
      if (r.status === 404) continue
      const html = await r.text(); storeCookies(r)
      console.log(`\nGET ${authority}${lp} → ${r.status} | ${r.headers.get('content-type')} | ${html.length}b`)
      const forms = parseForms(html)
      console.log(`  فرم‌ها: ${forms.length}`)
      forms.forEach((f, i) => { console.log(`   فرم#${i}: ${f.method} action="${f.action}"`); f.inputs.forEach(inp => console.log(`      - name="${inp.name}" type="${inp.type}" ${inp.value ? `value="${inp.value.slice(0, 24)}…"` : ''}`)) })
      if (forms.length) break
    } catch (e) { /* بعدی */ }
  }
  // اگر ROPC نبود و کردِنشیال داریم، ورودِ کاملِ code+PKCE را امتحان کن
  if (USER && PASS && !(disc?.grant_types_supported || []).includes('password')) {
    await tryOidcCodeFlow()
  }
}

// ورودِ مستقیم با پسورد (Resource Owner Password Credentials).
async function tryRopc(tokenEndpoint) {
  const clientId = Object.entries(ENV).find(([k]) => /CLIENT_ID/i.test(k))?.[1] || 'js' || 'react'
  console.log('\n── تلاش ROPC با client_id =', clientId, '──')
  const scopes = ['openid profile', 'openid profile api', 'openid profile offline_access', 'openid profile api offline_access']
  for (const scope of scopes) {
    const form = new URLSearchParams({ grant_type: 'password', client_id: clientId, username: USER, password: PASS, scope })
    try {
      const r = await fetchT(tokenEndpoint, { method: 'POST', headers: hdr({ 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }), body: form.toString() }, 15000)
      const txt = await r.text()
      console.log(`POST token [scope="${scope}"] → ${r.status} | ${snippet(txt, 300)}`)
      if (r.status === 200 && /access_token/.test(txt)) { console.log('  ✓✓ توکن گرفته شد! ROPC کار می‌کند.'); return JSON.parse(txt) }
    } catch (e) { console.log('  خطا:', e.message) }
  }
  return null
}

// ── ورودِ کاملِ Authorization Code + PKCE (فرمِ موبایل/پسوردِ Identity Server) ──
// jarِ هاست‌محور (کوکیِ هر دامنه جدا)
const jars = new Map()
function jarFor(host) { if (!jars.has(host)) jars.set(host, new Map()); return jars.get(host) }
function storeCk(res, urlStr) {
  const host = new URL(urlStr).host
  const j = jarFor(host)
  const sc = (typeof res.headers.getSetCookie === 'function') ? res.headers.getSetCookie() : []
  for (const line of sc) { const [pair] = line.split(';'); const i = pair.indexOf('='); if (i > 0) j.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim()) }
}
function ckHeader(urlStr) { const j = jars.get(new URL(urlStr).host); return j ? [...j.entries()].map(([k, v]) => `${k}=${v}`).join('; ') : '' }
function H(urlStr, extra = {}) { const h = { ...BASE_HEADERS, ...extra }; const c = ckHeader(urlStr); if (c) h.Cookie = c; return h }

// دنبال‌کردنِ دستیِ ریدایرکت‌ها با ذخیرهٔ کوکیِ هر هاست؛ تا رسیدن به code= یا یک صفحهٔ غیرِریدایرکت.
async function follow(startUrl, opts = {}, maxHops = 8) {
  let url = startUrl, method = opts.method || 'GET', body = opts.body, hops = 0
  while (hops++ < maxHops) {
    const res = await fetchT(url, { method, body, headers: H(url, opts.headers || {}), redirect: 'manual' }, 20000)
    storeCk(res, url)
    const loc = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && loc) {
      const next = new URL(loc, url).toString()
      // اگر کد در آدرسِ بازگشتی بود، همان‌جا بایست
      if (/[?#&]code=/.test(next)) return { res, url: next, body: '', code: new URL(next).searchParams.get('code') }
      url = next; method = 'GET'; body = undefined
      continue
    }
    const text = await res.text().catch(() => '')
    return { res, url, body: text, code: null }
  }
  return { res: null, url, body: '', code: null }
}

async function tryOidcCodeFlow() {
  const authority = (Object.values(ENV).find(v => /id\.persiansaze|identity/i.test(v)) || 'https://id.persiansaze.com').replace(/\/$/, '')
  const clientId = ENV.REACT_APP_CLIENT_ID || 'PSC'
  const redirectUri = ENV.REACT_APP_REDIRECT_URI || 'https://my.persiansaze.com'
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  const state = crypto.randomBytes(16).toString('hex'), nonce = crypto.randomBytes(16).toString('hex')
  console.log('\n── ورودِ Authorization Code + PKCE ──')
  console.log(`   authority=${authority}  client_id=${clientId}  redirect_uri=${redirectUri}`)

  // ۱) شروعِ authorize → ریدایرکت به صفحهٔ /login
  const authUrl = `${authority}/connect/authorize?` + new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: 'code',
    scope: 'openid profile offline_access', state, nonce,
    code_challenge: challenge, code_challenge_method: 'S256',
  }).toString()
  const a = await follow(authUrl)
  console.log(`   authorize → رسیدیم به: ${a.url.slice(0, 90)}… (HTTP ${a.res?.status})`)
  if (a.code) { console.log('   (بدونِ لاگین کد گرفتیم؟ احتمالاً نشستِ قبلی)'); return await exchange(a.code) }

  // ۲) صفحهٔ لاگین → استخراجِ فرم و توکنِ antiforgery
  const loginPageUrl = a.url
  const forms = parseForms(a.body)
  const form = forms.find(f => f.inputs.some(i => i.type === 'password')) || forms[0]
  if (!form) { console.log('   ⚠ فرمِ لاگین پیدا نشد. نمونهٔ صفحه:', snippet(a.body, 400)); return null }
  const payload = {}
  for (const inp of form.inputs) if (inp.name) payload[inp.name] = inp.value || ''
  // نام‌فیلدهای موبایل/پسورد را پر کن
  const userKey = Object.keys(payload).find(k => /mobile|username|user|phone/i.test(k)) || '_model.MobileNumber'
  const passKey = Object.keys(payload).find(k => /password/i.test(k)) || '_model.Password'
  payload[userKey] = USER; payload[passKey] = PASS
  if (!('_handler' in payload)) payload['_handler'] = 'password-login'
  const postUrl = new URL(form.action || loginPageUrl, loginPageUrl).toString()
  // ReturnUrl را از آدرسِ صفحهٔ لاگین حفظ کن
  const ru = new URL(loginPageUrl).searchParams.get('ReturnUrl') || new URL(loginPageUrl).searchParams.get('returnUrl')
  const postFull = ru && !/ReturnUrl/i.test(postUrl) ? `${postUrl}?ReturnUrl=${encodeURIComponent(ru)}` : postUrl
  console.log(`   POST لاگین → ${postFull.slice(0, 90)}  (user="${userKey}", pass="${passKey}", فیلدها: ${Object.keys(payload).join(',')})`)

  const p = await follow(postFull, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: authority, Referer: loginPageUrl },
    body: new URLSearchParams(payload).toString(),
  })
  console.log(`   نتیجهٔ لاگین: HTTP ${p.res?.status} | رسیدیم به: ${p.url.slice(0, 110)}…`)
  if (p.code) return await exchange(p.code, verifier, authority, clientId, redirectUri)
  // صفحهٔ لاگین دوباره آمد → خطا. پیامِ خطای واقعی را استخراج کن.
  const body = p.body || ''
  // بلوک‌های خطا (validation-summary / text-danger / alert)
  const errs = []
  for (const m of body.matchAll(/<(?:div|span|p|li)[^>]*class\s*=\s*["'][^"']*(?:validation|danger|error|alert)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|p|li)>/gi)) {
    const t = htmlDecode(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
    if (t) errs.push(t)
  }
  console.log('   ✗ لاگین ناموفق.')
  if (errs.length) console.log('   پیامِ خطا:', [...new Set(errs)].join(' | ').slice(0, 400))
  else console.log('   (پیامِ خطای صریحی پیدا نشد)')
  // آیا ویجتِ reCAPTCHA واقعاً در صفحه رندر شده؟
  const hasWidget = /class\s*=\s*["'][^"']*g-recaptcha/i.test(body) || /grecaptcha\.(render|execute)/i.test(body)
  const onlyScript = /recaptcha\/api\.js/i.test(body)
  console.log(`   reCAPTCHA: ویجت=${hasWidget ? 'بله ⚠' : 'خیر'}  اسکریپت=${onlyScript ? 'بله' : 'خیر'}`)
  // آیا فیلدِ کپچا در فرمِ بازگشتی هست؟
  const f2 = (parseForms(body)[0] || { inputs: [] })
  const capField = f2.inputs.find(i => /captcha|recaptcha/i.test(i.name))
  if (capField) console.log('   ⚠ فیلدِ کپچا در فرم:', capField.name, '→ احتمالاً اجباری است.')
  console.log('   نمونهٔ متنِ صفحه:', snippet(body.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' '), 300))
  return null

  async function exchange(code, ver = verifier, auth = authority, cid = clientId, ruri = redirectUri) {
    console.log('\n   ── تبادلِ کد با توکن ──')
    const r = await fetchT(`${auth}/connect/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: ruri, client_id: cid, code_verifier: ver }).toString(),
    }, 15000)
    const txt = await r.text()
    console.log(`   POST /connect/token → ${r.status} | ${snippet(txt, 200)}`)
    if (r.status === 200 && /access_token/.test(txt)) {
      const tok = JSON.parse(txt)
      console.log('   ✓✓✓ ورود کامل موفق! access_token گرفتیم (طول:', (tok.access_token || '').length, '، refresh_token:', tok.refresh_token ? 'دارد ✓' : 'ندارد', ')')
      await testApi(tok.access_token)
      return tok
    }
    console.log('   ✗ تبادلِ توکن ناموفق.')
    return null
  }
}

// تستِ چند endpointِ دیتا با access_token تا ببینیم خروجی چیست.
async function testApi(accessToken) {
  const bases = { rest: ENV.REACT_APP_PSC_URL || 'https://my.persiansaze.com/rest', mgmt: ENV.REACT_APP_MANAGEMENT_URL || 'https://management.persiansaze.com' }
  const tries = [
    [bases.rest, '/api/v1/Account/Profile'],
    [bases.mgmt, '/api/v1/Account/Profile'],
    [bases.rest, '/api/v1/Account'],
    [bases.rest, '/project'],
    [bases.mgmt, '/project'],
  ]
  console.log('\n   ── تستِ APIِ دیتا با توکن ──')
  for (const [base, path] of tries) {
    const url = base.replace(/\/$/, '') + path
    try {
      const r = await fetchT(url, { headers: { ...BASE_HEADERS, Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } }, 15000)
      const txt = await r.text().catch(() => '')
      console.log(`   GET ${url} → ${r.status} | ${r.headers.get('content-type')} | ${txt.length}b`)
      if (r.status >= 200 && r.status < 300) console.log('       نمونه:', snippet(txt, 400))
    } catch (e) { console.log(`   GET ${url} → خطا: ${e.message}`) }
  }
}
async function discoverSpaApi(loginUrl, scripts) {
  const origin = new URL(loginUrl).origin
  console.log('\n── کشفِ API از فایل‌های SPA ──')
  // env.js (معمولاً آدرسِ پایهٔ API اینجاست)
  const sources = ['./env.js', './config.js', '/env.js', ...scripts]
  const fetched = new Set()
  for (const s of sources) {
    const url = abs(loginUrl, s)
    if (fetched.has(url)) continue
    fetched.add(url)
    try {
      process.stdout.write(`→ ${url} ...`)
      const r = await fetchT(url, { headers: hdr() }, 20000)
      const js = await r.text()
      console.log(` ${r.status} | ${js.length}b`)
      if (r.status !== 200) continue
      // env.js را کامل چاپ کن (client_id و آدرس‌های پایه اینجاست) — مگر اینکه HTMLِ SPA باشد
      if (/env\.js/i.test(s) && !/<!doctype/i.test(js)) {
        console.log('   ── محتوای کاملِ env.js ──\n' + js + '\n   ──────────')
        // مقادیرِ کلیدی را استخراج کن
        for (const m of js.matchAll(/["']?([A-Z0-9_]*(?:CLIENT_ID|AUTHORITY|API|REST|MANAGEMENT|IDENTITY|SCOPE|BASE_URL|REDIRECT)[A-Z0-9_]*)["']?\s*[:=]\s*["']([^"']+)["']/gi)) {
          ENV[m[1]] = m[2]
        }
      }
      // آدرس‌های کاملِ http (به‌جز خودِ سایت/فونت/سی‌دی‌ان)
      for (const m of js.matchAll(/https?:\/\/[a-zA-Z0-9_.\-]+(?:\/[a-zA-Z0-9_./\-]*)?/g)) {
        const u = m[0]
        if (/persiansaze|api|back|service|panel/i.test(u) && !/\.(png|jpg|svg|css|woff|gif)/i.test(u)) {
          if (/api|back|service/i.test(u) && !API_BASE) API_BASE = u.replace(/\/$/, '')
          API_PATHS.add(u)
        }
      }
      // مسیرهای نسبیِ API ("/api/...", "/auth/login", ...)
      for (const m of js.matchAll(/["'`](\/(?:api|auth|user|users|account|login|otp|verify|token|build|saze|project|projects|porozhe|karfarma|list|search|panel|v1|v2)[a-zA-Z0-9_./\-]*)["'`]/gi)) {
        API_PATHS.add(m[1])
      }
    } catch (e) { console.log(` خطا: ${e.message}`) }
  }
  console.log('\nآدرسِ پایهٔ API (حدس):', API_BASE || '— (در خروجیِ env.js بالا بگرد)')
  const paths = [...API_PATHS].sort()
  console.log('مسیرها/آدرس‌های یافت‌شده:')
  for (const p of paths.slice(0, 60)) console.log('   ', p)
  if (paths.length > 60) console.log(`   … و ${paths.length - 60} مورد دیگر`)
}

// تلاش برای ورودِ JSON به endpointهای محتمل با شماره‌موبایل/پسورد.
async function tryJsonLogin(loginUrl) {
  const origin = new URL(loginUrl).origin
  const bases = [API_BASE, origin, origin + '/api', origin + '/api/v1'].filter(Boolean)
  const loginPaths = [...new Set([...API_PATHS].filter(p => /login|signin|auth|token/i.test(p)))]
  const tryPaths = loginPaths.length ? loginPaths : ['/api/login', '/api/auth/login', '/api/v1/auth/login', '/login', '/auth/login']
  // ترکیب‌های مختلفِ نامِ فیلد
  const bodies = [
    { username: USER, password: PASS },
    { mobile: USER, password: PASS },
    { phone: USER, password: PASS },
    { email: USER, password: PASS },
    { user: USER, pass: PASS },
  ]
  console.log('\n── تلاش برای ورودِ JSON ──')
  for (const base of bases) {
    for (const p of tryPaths) {
      const url = p.startsWith('http') ? p : (base.replace(/\/$/, '') + (p.startsWith('/') ? p : '/' + p))
      for (const body of bodies) {
        try {
          const r = await fetchT(url, {
            method: 'POST',
            headers: hdr({ 'Content-Type': 'application/json', 'Accept': 'application/json', 'Origin': origin, 'Referer': loginUrl }),
            body: JSON.stringify(body), redirect: 'manual',
          }, 15000)
          const txt = await r.text().catch(() => '')
          const ct = r.headers.get('content-type') || ''
          const sc = storeCookies(r)
          // فقط نتایجِ جالب را چاپ کن (نه 404/405)
          if (r.status !== 404 && r.status !== 405) {
            const field = Object.keys(body).filter(k => k !== 'password' && k !== 'pass')[0]
            console.log(`\nPOST ${url}  [${field}=موبایل] → HTTP ${r.status} | ${ct} | ${txt.length}b | کوکی: ${sc.map(c => c.split(';')[0]).join(',') || '—'}`)
            console.log('   پاسخ:', snippet(txt, 500))
            // اگر توکن/کوکی گرفتیم، ورود موفق بوده
            if (r.status >= 200 && r.status < 300 && (/token|access|jwt/i.test(txt) || sc.length)) {
              console.log('   ✓✓ به‌نظر ورودِ موفق! این endpoint و این فیلدها درست‌اند.')
              return { url, field, body: Object.keys(body) }
            }
          }
        } catch (e) { /* بی‌صدا برو سراغِ بعدی */ }
      }
    }
  }
  console.log('\n⚠ ورودِ خودکار جواب نداد. احتمالاً endpoint یا نامِ فیلدها فرق دارد یا OTP لازم است.')
  console.log('   لطفاً در مرورگر وارد شو و از تب Network، درخواستِ login را (URL + بدنهٔ JSON + پاسخ) بفرست.')
  return null
}

// حالتِ توکن: با access_tokenِ گرفته‌شده از مرورگر، API دیتا را کاوش کن.
async function tokenMode() {
  const rest = (ENV.REACT_APP_PSC_URL || 'https://my.persiansaze.com/rest').replace(/\/$/, '')
  const mgmt = (ENV.REACT_APP_MANAGEMENT_URL || 'https://management.persiansaze.com').replace(/\/$/, '')
  console.log('═══════════ پروبِ پرشین سازه — حالتِ توکن ═══════════')
  console.log('طولِ توکن:', TOKEN.length)
  // اثرانگشتِ کاملِ مرورگر (WAFِ openresty رویِ POST این‌ها را چک می‌کند)
  const auth = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Authorization': `Bearer ${TOKEN}`,
    'Origin': 'https://my.persiansaze.com',
    'Referer': 'https://my.persiansaze.com/',
    'did': DID,
    'sec-ch-ua': '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': '"iOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'priority': 'u=1, i',
    ...(process.env.PS_COOKIE ? { Cookie: process.env.PS_COOKIE } : {}),
  }
  async function hit(url, opts = {}) {
    try {
      const r = await fetchT(url, { headers: auth, ...opts }, 20000)
      const txt = await r.text().catch(() => '')
      const ct = r.headers.get('content-type') || ''
      console.log(`\n${opts.method || 'GET'} ${url}\n   → ${r.status} | ${ct} | ${txt.length}b`)
      if (r.status >= 200 && r.status < 300 && /json/.test(ct)) console.log('   نمونه:', snippet(txt, 800))
      else if (txt) console.log('   پاسخ:', snippet(txt.replace(/<[^>]+>/g, ' '), 300))
      return { status: r.status, ct, txt }
    } catch (e) { console.log(`\nGET ${url}\n   → خطا: ${e.message}`); return { status: 0 } }
  }
  console.log('\n── تأییدِ توکن (حساب) ──')
  await hit(`${rest}/api/user/v1/Account/Detail`)
  console.log('\n── لیستِ پروژه‌ها (POST با بدنهٔ واقعی) ──')
  const filterUrl = `${rest}/api/user/v1/Project/Filter?limit=5&offset=0`
  const filterBody = {
    term: '', searchType: 'Project', type: 'All', onlyWithConstructor: true,
    cityIds: [], regionIds: [], folderIds: [], lastPhaseUpdateDateType: null,
    phaseIds: [], structureTypeIds: [], subRegionIds: [], subscriptionTypes: [], usageTypesIds: [],
  }
  const list = await hit(filterUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(filterBody) })
  // ساختارِ کاملِ اولین پروژه را چاپ کن
  let pid = ''
  try {
    const j = JSON.parse(list.txt)
    const arr = Array.isArray(j) ? j : (j.items || j.data || j.result || j.list || j.projects || j.value || [])
    console.log(`\n   تعدادِ کل (اگر باشد): ${j.totalCount ?? j.total ?? j.count ?? '—'} | در این صفحه: ${arr.length}`)
    if (arr[0]) console.log('   ساختارِ کاملِ پروژهٔ اول:\n', JSON.stringify(arr[0], null, 1).slice(0, 1800))
    pid = String(arr?.[0]?.id || arr?.[0]?.projectId || arr?.[0]?.code || '')
  } catch (e) { console.log('   خطا در پارس:', e.message) }
  console.log('\n── جزئیات/تماسِ یک پروژه (شناسه:', pid || '—', ') ──')
  if (pid) {
    for (const p of [
      `/api/user/v1/Project/${pid}`,
      `/api/user/v1/Project/Detail/${pid}`,
      `/api/user/v1/Project/${pid}/Contact`,
      `/api/user/v1/Project/${pid}/Phone`,
      `/api/user/v1/Project/Related/Entities?projectId=${pid}`,
      `/api/user/v1/Project/Contact/${pid}`,
    ]) await hit(`${rest}${p}`)
  }
  if (LIST_URL) { console.log('\n── آدرسِ داده‌شده ──'); await hit(LIST_URL) }
  console.log('\nℹ اگر تماس نیامد، در مرورگر روی آیکنِ 👤 بزن و آدرسِ آن درخواست را به‌عنوان آرگومان بده.')
}

async function main() {
  if (TOKEN) { await tokenMode(); return }
  console.log('═══════════ پروبِ پرشین سازه ═══════════')
  console.log('Node:', process.version, '| creds:', USER ? 'داده‌شده' : 'خالی')

  // ── ۱) صفحهٔ ورود را پیدا و تحلیل کن ──────────────────────────────────
  let loginUrl = '', loginHtml = '', loginRes = null
  for (const u of LOGIN_CANDIDATES) {
    try {
      process.stdout.write(`\n→ GET ${u} ...`)
      const r = await fetchT(u, { headers: hdr(), redirect: 'follow' })
      const body = await r.text()
      console.log(` HTTP ${r.status} | ${r.headers.get('content-type') || ''} | ${body.length}b`)
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

  // ── اگر SPA بود، API را از env.js و bundleها کشف کن ───────────────────
  if (forms.length === 0 || spa.markers.some(m => /SPA|Next|Nuxt/.test(m))) {
    await discoverSpaApi(loginUrl, spa.scripts)
    await discoverOidc()
    return
  }

  if (!USER || !PASS) {
    console.log('\nℹ برای تستِ ورود، PS_USER و PS_PASS را ست کن و دوباره اجرا کن.')
    console.log('\n── نمونهٔ HTMLِ صفحهٔ ورود (۸۰۰ کاراکتر) ──\n', snippet(loginHtml, 800))
    return
  }

  // ── ۲) تلاش برای ورود (فرمِ HTML) ─────────────────────────────────────
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
    postRes = await fetchT(postUrl, {
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
      const r = await fetchT(dash, { headers: hdr(), redirect: 'follow' })
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
      const r = await fetchT(LIST_URL, { headers: hdr(), redirect: 'follow' })
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

// نگهبان: اگر بیش از ۹۰ ثانیه طول کشید، با پیام خارج شو (تا هیچ‌وقت بی‌صدا گیر نکند)
const watchdog = setTimeout(() => { console.error('\n⏱ بیش از ۹۰ ثانیه طول کشید — خروجِ اجباری.'); process.exit(2) }, 90000)
watchdog.unref?.()

main()
  .then(() => { clearTimeout(watchdog); process.exit(0) })
  .catch(e => { clearTimeout(watchdog); console.error('خطای کلی:', e); process.exit(1) })
