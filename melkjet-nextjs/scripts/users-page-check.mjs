#!/usr/bin/env node
// صفحهٔ «کاربران» چقدر طول می‌کشد — و اصلاحِ aada4dd چقدر کم کرد.
//
// GET /api/admin/users used to do four full-document reads PER ACCOUNT: getCredit
// and getTokenUsage both pull the whole `comm` document (which holds every order),
// listLeads pulls all leads, listTasks pulls all tasks. With N accounts that is 4N
// full fetches and JSON parses on a 15-connection pool.
//
// It now reads each document once. This times both paths on the live data, so the
// difference is a measurement rather than a claim. The old path is sampled on a
// few accounts and extrapolated - running it for every account is the very thing
// that made the page slow.
//
// اجرا:  node --import ./scripts/reos-loader.mjs scripts/users-page-check.mjs
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

const ms = t => Math.round(t) + 'ms'
const time = async fn => { const t0 = Date.now(); const r = await fn(); return [Date.now() - t0, r] }

const { listAccounts } = await import('../app/lib/account-store.ts')
const { listItemsStable } = await import('../app/lib/scraper-store.ts')
const { creditsByOwner, getCredit, getTokenUsage } = await import('../app/lib/comm-store.ts')
const { leadCountsByOwner, listLeads } = await import('../app/lib/leads-store.ts')
const { taskCountsByOwner, listTasks } = await import('../app/lib/crm-store.ts')
const { getProfile, completeness } = await import('../app/lib/profile-store.ts')
const { listRoles, dashForRoleId } = await import('../app/lib/role-store.ts')
const { listPlans } = await import('../app/lib/plan-store.ts')

const [tAcc, accounts] = await time(async () => listAccounts())
console.log('حساب‌ها: ' + accounts.length + '   (' + ms(tAcc) + ')')
if (!accounts.length) { console.error('هیچ حسابی خوانده نشد — DATABASE_URL را بررسی کنید.'); process.exit(1) }

console.log('')
console.log('— مسیرِ فعلی: هر سند یک بار —')
const [tRoles] = await time(async () => { listRoles(); listPlans() })
const [tItems, items] = await time(() => listItemsStable('listing'))
const [tCount] = await time(async () => { const c = {}; for (const it of items) { const p = String(it.meta?.__ownerPhone || ''); if (p) c[p] = (c[p] || 0) + 1 } return c })
const [tBulk] = await time(() => Promise.all([creditsByOwner(), leadCountsByOwner(), taskCountsByOwner()]))
const [tProf] = await time(async () => accounts.map(a => completeness(getProfile(a.phone)) + dashForRoleId(a.role).length))
const nowTotal = tAcc + tRoles + tItems + tCount + tBulk + tProf
console.log('  نقش‌ها و پلن‌ها      ' + ms(tRoles))
console.log('  آگهی‌ها (memoشده)   ' + ms(tItems) + '   ' + items.length + ' آیتم')
console.log('  شمارشِ آگهیِ مالک   ' + ms(tCount))
console.log('  سه سند دسته‌ای      ' + ms(tBulk))
console.log('  پروفایل‌ها           ' + ms(tProf))
console.log('  ــــــــــــــــــــــــــــ')
console.log('  جمع                 ' + ms(nowTotal))

// حجمِ خودِ پاسخ: با هزاران حساب، سرورِ سریع هنوز می‌تواند مرورگرِ کند بدهد.
const [tJson, payload] = await time(async () => {
  const [credits, leadCounts, taskCounts] = await Promise.all([creditsByOwner(), leadCountsByOwner(), taskCountsByOwner()])
  const counts = {}
  for (const it of items) { const p = String(it.meta?.__ownerPhone || ''); if (p) counts[p] = (counts[p] || 0) + 1 }
  const users = accounts.map(a => {
    const cw = credits[a.phone]
    return { ...a, dashboard: dashForRoleId(a.role), listings: counts[a.phone] || 0,
      leads: leadCounts[a.phone] || 0, tasks: taskCounts[a.phone] || 0,
      credit: cw ? cw.credit : { sms: 0, email: 0, token: 0 }, tokenUsed: cw ? cw.tokenUsed : 0,
      profileCompletion: completeness(getProfile(a.phone)) }
  })
  return JSON.stringify({ users })
})
const kb = Math.round(payload.length / 1024)
console.log('')
console.log('— حجمِ پاسخ —')
console.log('  ساخت + JSON      ' + ms(tJson))
console.log('  حجم              ' + kb + ' KB   (' + Math.round(payload.length / accounts.length) + ' بایت به ازای هر حساب)')
if (kb > 1500) console.log('  ← همین محتملاً گلوگاهِ مرورگر است: صفحه‌بندی/جستجوی سمتِ سرور لازم است، نه فرستادنِ همه یکجا.')

// مسیرِ قدیمی را روی نمونه می‌سنجیم؛ اجرای کاملش همان چیزی است که صفحه را کند می‌کرد.
const SAMPLE = Math.min(8, accounts.length)
console.log('')
console.log('— مسیرِ قدیمی: چهار سندِ کامل به ازای هر حساب —')
const [tSample] = await time(async () => {
  await Promise.all(accounts.slice(0, SAMPLE).map(async a => {
    await getCredit(a.phone)
    try { await listLeads(a.phone) } catch {}
    try { await listTasks(a.phone) } catch {}
    await getTokenUsage(a.phone)
  }))
})
const per = tSample / SAMPLE
const est = Math.round(per * accounts.length)
console.log('  نمونهٔ ' + SAMPLE + ' حساب       ' + ms(tSample) + '   (' + ms(per) + ' به ازای هر حساب)')
console.log('  برآوردِ ' + accounts.length + ' حساب   ' + ms(est) + '   ← همان بخشی که حذف شد')

console.log('')
const gain = est > 0 ? (est / Math.max(1, nowTotal)) : 0
console.log(nowTotal < 1000
  ? '✓ کلِ کارِ سرور برای این صفحه ' + ms(nowTotal) + ' است. اگر در مرورگر هنوز کند است، گلوگاه در اپ نیست — nginx/CDN یا خودِ رندرِ کلاینت.'
  : '✗ هنوز ' + ms(nowTotal) + ' — بزرگ‌ترین سهم را از فهرستِ بالا بردار و همان را بگو.')
if (est > nowTotal) console.log('  (مسیرِ قدیمی تقریباً ' + Math.round(gain) + '× کندتر بود)')
process.exit(0)
