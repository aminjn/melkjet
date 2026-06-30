// تستِ تمدیدِ بدونِ‌مرورگر (silent-renew) برای پرشین سازه — فقط با curl (HTTP/2).
// با کوکیِ نشستِ id.persiansaze.com، یک access_tokenِ تازه می‌سازد.
//
// روی سرور:
//   PS_IDP_COOKIE='<کوکیِ کاملِ id.persiansaze.com>' node scripts/persiansaze-renew.mjs
//
// کوکی را از مرورگر بگیر: DevTools → Application → Cookies → https://id.persiansaze.com
// همهٔ ردیف‌ها را به‌صورت  name1=value1; name2=value2  بچسبان.

import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

const COOKIE = process.env.PS_IDP_COOKIE || ''
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
const CLIENT = 'PSC'
const REDIRECTS = ['https://my.persiansaze.com', 'https://my.persiansaze.com/auth-silent-callback', 'https://my.persiansaze.com/auth-callback']

function curl(args) {
  try { return execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) }
  catch (e) { return (e.stdout || '') + (e.stderr || '') }
}

function pkce() {
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

function authorize(redirectUri) {
  const { verifier, challenge } = pkce()
  const state = crypto.randomBytes(8).toString('hex'), nonce = crypto.randomBytes(8).toString('hex')
  const q = new URLSearchParams({
    client_id: CLIENT, redirect_uri: redirectUri, response_type: 'code',
    scope: 'openid profile', state, nonce,
    code_challenge: challenge, code_challenge_method: 'S256',
    prompt: 'none', response_mode: 'query',
  })
  const url = `https://id.persiansaze.com/connect/authorize?${q}`
  const out = curl(['-sS', '-i', '--http2', '-m', '25', url, '-H', `cookie: ${COOKIE}`, '-H', `user-agent: ${UA}`, '-H', 'accept: text/html'])
  const status = (out.match(/HTTP\/[\d.]+\s+(\d+)/) || [])[1]
  const loc = (out.match(/^location:\s*(.+)$/im) || [])[1]?.trim()
  return { status, loc, verifier, out }
}

function exchange(code, redirectUri, verifier) {
  const out = curl(['-sS', '--http2', '-m', '25', '-X', 'POST', 'https://id.persiansaze.com/connect/token',
    '-H', 'content-type: application/x-www-form-urlencoded', '-H', `user-agent: ${UA}`, '-H', 'accept: application/json',
    '--data', `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${CLIENT}&code_verifier=${verifier}`])
  return out
}

function main() {
  console.log('═══════════ تستِ silent-renew پرشین سازه ═══════════')
  if (!COOKIE) { console.log('⚠ PS_IDP_COOKIE را ست کن.'); return }
  console.log('طولِ کوکی:', COOKIE.length, '| تعدادِ کوکی:', COOKIE.split(';').length)

  for (const redirectUri of REDIRECTS) {
    console.log(`\n── authorize با redirect_uri=${redirectUri} (prompt=none) ──`)
    const a = authorize(redirectUri)
    console.log('   HTTP', a.status, '| location:', (a.loc || '—').slice(0, 130))
    if (!a.loc) { console.log('   (بدونِ ریدایرکت — این redirect_uri جواب نداد)'); continue }
    const code = (() => { try { return new URL(a.loc).searchParams.get('code') } catch { return null } })()
    const err = (() => { try { return new URL(a.loc).searchParams.get('error') } catch { return null } })()
    if (err) { console.log('   ⚠ خطا در authorize:', err, '— احتمالاً کوکی نامعتبر/منقضی یا redirect_uri اشتباه.'); continue }
    if (!code) { console.log('   (کد در location نبود)'); continue }
    console.log('   ✓ کد گرفته شد:', code.slice(0, 20), '…')
    const tok = exchange(code, redirectUri, a.verifier)
    if (/access_token/.test(tok)) {
      let len = 0; try { len = JSON.parse(tok).access_token.length } catch {}
      console.log('   ✓✓✓ access_token گرفته شد! (طول:', len, ') — silent-renew کار می‌کند! 🎉')
      console.log('   ⇒ redirect_uriِ درست:', redirectUri)
      console.log('\n   نمونهٔ پاسخِ توکن:', tok.slice(0, 200))
      return
    }
    console.log('   ✗ تبادلِ توکن ناموفق:', tok.slice(0, 200))
  }
  console.log('\n⚠ هیچ‌کدام جواب نداد. یا کوکی ناقص است، یا scope/redirect فرق دارد.')
  console.log('   برای تشخیص، آدرسِ دقیقِ یکی از درخواست‌های authorizeِ مرورگر (هنگامِ silent-renew) را بفرست.')
}

main()
