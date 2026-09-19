#!/usr/bin/env node
// چقدر طول می‌کشد تا یک پراسسِ تازه به سرویس‌های بیرونی برسد؟
//
// The OTP path spent 9-13 seconds on DNS for 8 of 29 sends, and the reason was a
// cold cache: every pm2 reload starts four fresh processes, and the first user of
// each paid for the resolve. The cache now lives on disk, so a fresh process
// should start warm.
//
// This script IS a fresh process, so what it measures is exactly what the first
// user after a deploy gets - without spending an SMS to find out.
//
// اجرا:  node --import ./scripts/reos-loader.mjs scripts/dns-check.mjs
import { readFileSync, existsSync } from 'node:fs'

function loadEnv(f) {
  if (!existsSync(f)) return
  for (const l of readFileSync(f, 'utf-8').split('\n')) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (process.env[m[1]] === undefined) process.env[m[1]] = v
  }
}
loadEnv('.env.production.local'); loadEnv('.env')

const HOSTS = ['api2.ippanel.com', 'api.gapgpt.app', 'api.pod.ir']
const F = '.dns-cache.json'

console.log('— کشِ روی دیسک —')
try {
  const raw = JSON.parse(readFileSync(F, 'utf-8'))
  const n = Object.keys(raw).length
  if (!n) console.log('  خالی است — هنوز هیچ هاستی ننشسته')
  for (const [h, v] of Object.entries(raw)) {
    const left = Math.round((Number(v.exp) - Date.now()) / 1000)
    console.log('  ' + h.padEnd(20) + v.ip.padEnd(18) + (left > 0 ? 'تازه، ' + left + 'ث دیگر' : 'کهنه (' + (-left) + 'ث) — در پس‌زمینه تازه می‌شود'))
  }
} catch { console.log('  فایل نیست — یعنی هیچ پراسسی هنوز ننوشته یا مسیر اشتباه است') }

// همان تابعی که مسیرِ پیامک استفاده می‌کند. اگر کش کار کند، باید آنی باشد.
const { warmDns } = await import('../app/lib/shecan-https.ts')
const { Resolver } = await import('node:dns')

console.log('')
console.log('— resolve در همین پراسسِ تازه —')
let worst = 0
for (const h of HOSTS) {
  const t0 = Date.now()
  await new Promise(r => { warmDns(h); setTimeout(r, 0) })
  // warmDns بی‌صداست؛ برای اندازه‌گیریِ واقعی خودِ مسیر را صدا می‌زنیم
  const { shecanRequest } = await import('../app/lib/shecan-https.ts')
  try { await shecanRequest('https://' + h + '/__ping', { method: 'GET', headers: {}, timeout: 5000 }) } catch {}
  const ms = Date.now() - t0
  worst = Math.max(worst, ms)
  console.log('  ' + h.padEnd(20) + ms + 'ms')
}

console.log('')
if (worst < 1500) console.log('✓ پراسسِ تازه گرم بالا می‌آید — اولین کاربرِ بعد از دیپلوی منتظرِ DNS نمی‌ماند.')
else console.log('✗ هنوز ' + worst + 'ms — کش کار نکرده؛ لاگِ [dns] slow را ببین.')
process.exit(0)
