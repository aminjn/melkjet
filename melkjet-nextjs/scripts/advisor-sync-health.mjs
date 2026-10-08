#!/usr/bin/env node
// چرا منبع‌های دیوارِ «مشاورها» چند روز اسکرپ نشده‌اند؟
//
// قرینهٔ roster-health، برای نیمهٔ دیگر. از بیرون این چهار چیز یکسان به‌نظر می‌رسند:
//   1. خاموش        - schedule === 'off' یا بدونِ searchUrl (عمدی، نه خرابی)
//   2. پنجره‌بسته    - schedule === 'daily' فقط قبل از ۶ صبحِ تهران سررسید می‌شود
//   3. گرسنه        - سالم ولی نوبتش نمی‌رسد؛ صف از توانِ هر شب بیشتر است
//   4. گیرکرده      - کارِ running/paused که کارگر رهایش کرده
// حدس‌زدن بینشان روزها وقت می‌برد. این‌ها را روی دادهٔ زنده جدا می‌کند و
// «توانِ واقعیِ هر شب» را از خودِ lastRunها می‌شمارد، نه از تخمین.
//
// اجرا:  node --import ./scripts/reos-loader.mjs scripts/advisor-sync-health.mjs
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

const { allSources, listDueSources, tehranHourOf } = await import('../app/lib/advisor-divar-store.ts')
const { getJob, listQueuedJobs, listPausedJobs, countActiveJobs, queueHeartbeat, isStale } =
  await import('../app/lib/advisor-divar-job.ts')

const now = Date.now()
const hour = tehranHourOf(now)
const fa = n => Number(n || 0).toLocaleString('fa-IR')
const row = (k, v, note) => console.log('  ' + String(k).padEnd(26) + String(v).padStart(5) + (note ? '   ' + note : ''))
const days = ms => (ms / 86400_000).toFixed(1)

// سقفِ همزمانی در cron-runner هاردکد است (MAX_ACTIVE_SYNCS)؛ اگر عوض شد اینجا هم عوض شود.
const CAP = 4
const all = allSources()
const due = listDueSources(now)

console.log('منبع‌های دیوارِ مشاوران: ' + fa(all.length) + '   (مشاور: ' + fa(new Set(all.map(x => x.phone)).size) + ')')
console.log('ساعتِ تهران: ' + hour + ':۰۰ → پنجرهٔ منبعِ «روزانه» ' + (hour < 6 ? 'باز است' : 'بسته است (فقط قبل از ۶ صبح)'))
console.log('سقفِ همزمانیِ صف: ' + CAP + '   (MAX_ACTIVE_SYNCS در cron-runner)')
const hb = queueHeartbeat()
console.log('ضربانِ صف: ' + (hb ? Math.round((now - hb.at) / 1000) + ' ثانیه پیش (اینستنسِ ' + hb.instance + ')' : '— هیچ‌وقت؛ یعنی کارگرِ صف اجرا نشده'))

// ── چرا سررسید نمی‌شوند ──────────────────────────────────────────────────────
const off = all.filter(x => x.source.schedule === 'off')
const noUrl = all.filter(x => x.source.schedule !== 'off' && !x.source.searchUrl)
const live = all.filter(x => x.source.schedule !== 'off' && x.source.searchUrl)
const daily = live.filter(x => x.source.schedule === 'daily')
const never = live.filter(x => !x.source.lastRun)

console.log('')
console.log('— وضعیتِ منبع‌ها —')
row('فعال (لینک + زمان‌بندی)', fa(live.length))
row('خاموش', fa(off.length), 'schedule=off — عمدی')
row('بی‌لینک', fa(noUrl.length), 'searchUrl خالی — هرگز اجرا نمی‌شود')
row('روزانه', fa(daily.length), 'فقط قبل از ۶ صبحِ تهران سررسید می‌شود')
row('هرگز اجرا نشده', fa(never.length))
row('سررسیدهٔ همین الان', fa(due.length))

// ── عمرِ آخرین اجرا ──────────────────────────────────────────────────────────
console.log('')
console.log('— عمرِ آخرین اجرای هر منبعِ فعال —')
const b = { 'هیچ‌وقت': 0, '<۱ روز': 0, '۱ تا ۳ روز': 0, '۳ تا ۷ روز': 0, '۷ تا ۳۰ روز': 0, '۳۰+ روز': 0 }
for (const { source } of live) {
  if (!source.lastRun) b['هیچ‌وقت']++
  else {
    const d = (now - source.lastRun) / 86400_000
    if (d < 1) b['<۱ روز']++; else if (d < 3) b['۱ تا ۳ روز']++
    else if (d < 7) b['۳ تا ۷ روز']++; else if (d < 30) b['۷ تا ۳۰ روز']++; else b['۳۰+ روز']++
  }
}
for (const [k, v] of Object.entries(b)) row(k, fa(v))

// ── توانِ واقعیِ هر شب، از خودِ lastRunها ────────────────────────────────────
// منبعِ «روزانه» فقط در پنجرهٔ ۰۰–۰۶ سررسید می‌شود، پس lastRunها در همان بازه خوشه
// می‌خورند. شمردنشان بر اساسِ شب = توانِ عبوریِ واقعی؛ دورهٔ تکرار = کل ÷ همان.
console.log('')
console.log('— توانِ واقعیِ هر شب (از lastRunِ منبع‌های روزانه) —')
{
  const IR = 3.5 * 3600_000
  const nightOf = t => {
    const d = new Date(t + IR)
    const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    return day.toISOString().slice(0, 10)
  }
  const byNight = new Map()
  let n = 0
  for (const { source } of daily) {
    if (!source.lastRun) continue
    n++
    const k = nightOf(source.lastRun)
    byNight.set(k, (byNight.get(k) || 0) + 1)
  }
  if (!n) console.log('  هیچ منبعِ روزانه‌ای اجرا نشده — مشکل ظرفیت نیست، اجرا است.')
  else {
    const nights = [...byNight.entries()].sort((a, c) => c[0].localeCompare(a[0])).slice(0, 7)
    for (const [k, v] of nights) console.log('  ' + k + '   ' + String(fa(v)).padStart(5) + ' منبع')
    const best = Math.max(...nights.map(x => x[1]))
    console.log('  بهترین شب: ' + fa(best) + ' منبع   ⇒ دورهٔ تکرار ≈ ' +
      (best ? (daily.length / best).toFixed(1) : '∞') + ' شب برای ' + fa(daily.length) + ' منبعِ روزانه')
  }
}

// ── کارهای گیرکرده ──────────────────────────────────────────────────────────
console.log('')
console.log('— صف —')
row('در حالِ اجرا', fa(countActiveJobs()))
row('در صف', fa(listQueuedJobs().length))
row('مکث‌شده (نیمه‌کاره)', fa(listPausedJobs().length), 'resumeJob در تیکِ بعد برمی‌داردشان')
const owners = [...new Set(all.map(x => x.phone))]
const stuck = []
for (const o of owners) {
  const j = getJob(o)
  if (j.running && isStale(j)) stuck.push({ o, j })
}
row('زامبی (running کهنه)', fa(stuck.length), stuck.length ? 'کارگر رهایشان کرده' : '')
for (const { o, j } of stuck.slice(0, 8)) {
  console.log('    ' + o + '   بی‌پیشرفت از ' + Math.round((now - (j.lastProgressAt || j.startedAt || now)) / 60000) + ' دقیقه پیش' +
    '   مانده=' + fa((j.pending || []).length))
}

// ── قدیمی‌ترین‌ها ────────────────────────────────────────────────────────────
const oldest = live.filter(x => x.source.lastRun).sort((a, c) => a.source.lastRun - c.source.lastRun).slice(0, 10)
if (oldest.length) {
  console.log('')
  console.log('— قدیمی‌ترین‌ها —')
  for (const { phone, source } of oldest) {
    console.log('  ' + days(now - source.lastRun).padStart(6) + ' روز پیش   ' + phone.padEnd(13) +
      String(source.schedule).padEnd(7) + String(source.name || source.id).slice(0, 24).padEnd(26) +
      (source.lastError ? 'خطا: ' + String(source.lastError).slice(0, 40) : ''))
  }
}

console.log('')
if (!live.length) console.log('← هیچ منبعِ فعالی نیست: «اسکرپ نشدن» اینجا یعنی چیزی برای اسکرپ تعریف نشده.')
else if (stuck.length > live.length * 0.2) console.log('← بیشترِ مشکل کارهای زامبی است، نه ظرفیت.')
else if (due.length > CAP * 20) console.log('← بیشترِ مشکل ظرفیت است: سررسیده‌ها از توانِ پنجره بیشترند، پس نوبتی می‌شوند نه روزانه.')
else console.log('← نه زامبی غالب است نه کمبودِ ظرفیت؛ سطلِ عمرِ آخرین اجرا و قدیمی‌ترین‌ها را نگاه کن.')
process.exit(0)
