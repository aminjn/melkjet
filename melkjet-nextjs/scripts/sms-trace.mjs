#!/usr/bin/env node
// چرا این شماره این‌همه پیامک گرفت؟
//
// There is no central SMS log in this codebase - sendServiceSms just sends. The one
// trail that exists is the link shortener: every message containing a link registers
// a tracker row with {phone, channel, createdAt}. That is the evidence this reads.
//
// اجرا:  node --import ./scripts/reos-loader.mjs scripts/sms-trace.mjs 09xxxxxxxxx
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

const FA = '۰۱۲۳۴۵۶۷۸۹'
const arg = (process.argv[2] || '').replace(/[۰-۹]/g, d => String(FA.indexOf(d))).replace(/\D/g, '')
if (!/^09\d{9}$/.test(arg)) { console.error('شماره را بده: node … scripts/sms-trace.mjs 09123456789'); process.exit(1) }

const fa = n => Number(n).toLocaleString('fa-IR')
const when = t => new Date(t).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })

console.log('شماره: ' + arg)
console.log('')

// ۰) لاگِ مرکزی (از ۸ اکتبر). برای پیامک‌های پیش از آن خالی است — آن‌ها فقط ردِ ترکر دارند.
console.log('— لاگِ مرکزیِ پیامک —')
try {
  const { recentForPhone, countSince, topRecipients } = await import('../app/lib/sms-log.ts')
  const rows = await recentForPhone(arg, 500)
  if (!rows.length) console.log('  خالی — یا پیش از راه‌اندازیِ لاگ بوده، یا از این شماره ارسالی نرفته.')
  else {
    const d1 = await countSince(arg, Date.now() - 86400000)
    const d7 = await countSince(arg, Date.now() - 7 * 86400000)
    console.log('  کل: ' + fa(rows.length) + '   ۲۴ ساعت: ' + fa(d1) + '   ۷ روز: ' + fa(d7))
    const byCh = new Map()
    for (const r of rows) byCh.set(r.ch, (byCh.get(r.ch) || 0) + 1)
    for (const [c, n] of [...byCh.entries()].sort((a, b) => b[1] - a[1])) console.log('    ' + String(n).padStart(5) + '  ' + c)
    console.log('  ده موردِ آخر:')
    for (const r of rows.slice(0, 10)) console.log('    ' + when(r.at) + '  ' + r.ch + (r.ok ? '  ✓' : '  ✗ ' + (r.note || '')))
  }
  const top = await topRecipients(86400000, 8)
  if (top.length) {
    console.log('')
    console.log('  پرگیرنده‌ترین شماره‌ها در ۲۴ ساعت (برای دیدنِ حادثه پیش از شکایت):')
    for (const t of top) console.log('    ' + t.phone + '  ' + fa(t.n) + '  (' + t.chans + ')')
  }
} catch (e) { console.log('  خطا: ' + (e?.message || e)) }
console.log('')

// ۱) ردِ پای ترکر — تنها سابقهٔ واقعیِ ارسال که داریم
console.log('— پیامک‌های لینک‌دار (از ثبتِ کوتاه‌کنندهٔ لینک) —')
try {
  const { listLinks } = await import('../app/lib/tracker-links-store.ts')
  const all = await listLinks(1000000)
  const mine = all.filter(l => String(l.phone || '').replace(/\D/g, '') === arg)
  if (!mine.length) console.log('  هیچ ردی نیست — یا پیامک‌ها لینک نداشتند (ثبت نمی‌شوند) یا از کانالِ دیگری رفته‌اند.')
  else {
    const byCh = new Map()
    for (const l of mine) byCh.set(l.channel || '(بی‌کانال)', (byCh.get(l.channel || '(بی‌کانال)') || 0) + 1)
    console.log('  کلِ ردیف: ' + fa(mine.length))
    for (const [c, n] of [...byCh.entries()].sort((a, b) => b[1] - a[1])) console.log('    ' + String(n).padStart(5) + '  کانال: ' + c)
    const ts = mine.map(l => l.createdAt).filter(Boolean).sort((a, b) => a - b)
    if (ts.length) {
      console.log('  نخستین: ' + when(ts[0]))
      console.log('  آخرین:  ' + when(ts[ts.length - 1]))
      const hours = (ts[ts.length - 1] - ts[0]) / 3600_000
      if (hours > 0.1) console.log('  آهنگ: ' + (mine.length / hours).toFixed(1) + ' پیامک در ساعت')
      const byDay = new Map()
      for (const t of ts) { const d = new Date(t).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' }); byDay.set(d, (byDay.get(d) || 0) + 1) }
      console.log('  تفکیکِ روزانه:')
      for (const [d, n] of [...byDay.entries()].slice(-10)) console.log('    ' + d + '  ' + fa(n))
    }
  }
} catch (e) { console.log('  خطا: ' + (e?.message || e)) }

// ۲) جستجوهای ذخیره‌شده — مظنونِ اصلی: یک پیامک به ازای هر جستجو در هر چرخهٔ ۵دقیقه‌ای
console.log('')
console.log('— جستجوهای ذخیره‌شدهٔ این کاربر (مسیرِ هشدار) —')
try {
  const { listAll } = await import('../app/lib/saved-search-store.ts')
  const rows = (await listAll()).filter(s => String(s.owner || '').replace(/\D/g, '') === arg)
  console.log('  تعداد: ' + fa(rows.length))
  for (const s of rows) {
    const broad = !s.priceMax && !s.area ? '  ← باز (بدونِ محله و سقفِ قیمت)' : ''
    console.log('    «' + (s.label || '—') + '»  معامله=' + (s.deal || '—') + '  شهر=' + (s.city || '—') +
      '  محله=' + (s.area || '—') + '  سقف=' + (s.priceMax || '—') + '  آخرین بررسی=' + (s.lastCheck ? when(s.lastCheck) : '—') + broad)
  }
  if (rows.length) {
    console.log('')
    console.log('  چرخهٔ هشدار هر ۵ دقیقه اجرا می‌شود (TICK_MS) و به ازای «هر جستجو» که آگهیِ')
    console.log('  تازهٔ منطبق داشته باشد یک پیامک می‌فرستد — بدونِ هیچ سقفِ روزانه.')
    console.log('  سقفِ نظری: ' + fa(rows.length * 288) + ' پیامک در روز برای همین کاربر.')
  }
} catch (e) { console.log('  خطا: ' + (e?.message || e)) }

// ۳) سایت‌ساز (سقفِ ۳ تلاش دارد، ولی ارسالِ دستی ندارد)
console.log('')
console.log('— سایت‌سازِ خودکار —')
try {
  const { pgEnabled, kvGet } = await import('../app/lib/db.ts')
  if (!pgEnabled()) console.log('  بدونِ DATABASE_URL')
  else {
    const m = await kvGet('autosite_meta', { done: {} })
    const r = (m.done || {})[arg]
    console.log(r ? '  ' + JSON.stringify(r) : '  ردیفی برای این شماره نیست')
  }
} catch (e) { console.log('  خطا: ' + (e?.message || e)) }

console.log('')
console.log('یادآوری: پیامکِ بی‌لینک هیچ ردی نمی‌گذارد، پس عددِ بالا «کف» است نه کل.')
process.exit(0)
