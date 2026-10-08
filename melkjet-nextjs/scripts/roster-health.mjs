#!/usr/bin/env node
// چرا آژانس‌ها طبقِ برنامه آپدیت نمی‌شوند؟
//
// Three different things look identical from outside — "the agency is not updating":
//   1. parked   - repeated unfinished runs, so it waits for a manual click
//   2. starved  - healthy but never gets a slot; the night window plus the
//                 concurrency cap simply cannot cover every agency each night
//   3. off      - autoSync disabled, or schedule === 'off'
//
// Guessing between them wastes days. This separates them on the live data, and
// shows the window and the cap next to the numbers so the arithmetic is visible.
//
// اجرا:  node --import ./scripts/reos-loader.mjs scripts/roster-health.mjs
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

const { listScrapes, listDueRosters, getRosterSettings, inSyncWindow } = await import('../app/lib/agency-roster-store.ts')

const now = Date.now()
const IR = 3.5 * 3600_000
const iranHour = t => new Date(t + IR).getUTCHours()
const hours = ms => Math.round(ms / 3600_000)
const days = ms => (ms / 86400_000).toFixed(1)

const all = await listScrapes()
let st = {}
try { st = await getRosterSettings() } catch {}
const g = { autoSync: st.autoSync !== false, startHour: st.startHour ?? 0, endHour: st.endHour ?? 6 }
const hour = iranHour(now)
const inWindow = inSyncWindow(hour, g.startHour, g.endHour)
const cap = Math.max(1, Math.min(8, Number(process.env.ROSTER_SYNCS) || 1))   // ۸ اکتبر: پیش‌فرضِ کد ۱ است (cron-runner)، نه ۳

console.log('آژانس‌ها: ' + all.length)
console.log('پنجرهٔ سینک: ' + g.startHour + ':۰۰ تا ' + g.endHour + ':۰۰ به وقتِ ایران   (الان ' + hour + ':۰۰ → ' +
  (inWindow ? 'داخلِ پنجره' : 'بیرونِ پنجره') + ')')
const winH = (g.endHour - g.startHour + 24) % 24 || 24
console.log('سقفِ همزمانی: ' + cap + '   پنجره: ' + winH + ' ساعت')
console.log('زمان‌بندیِ سراسری: ' + (g.autoSync ? 'روشن' : 'خاموش'))

const off = all.filter(s => s.schedule === 'off' || (s.autoSync !== undefined ? !s.autoSync : !g.autoSync))
const running = all.filter(s => s.running)
const parked = all.filter(s => (s.runAttempts || 0) >= 3 && !s.running)
const errored = all.filter(s => s.lastError && !s.running)
const never = all.filter(s => !s.lastRun)
const due = await listDueRosters(now)

console.log('')
console.log('— وضعیت —')
const row = (k, v, note) => console.log('  ' + String(k).padEnd(26) + String(v).padStart(5) + (note ? '   ' + note : ''))
row('در حالِ اجرا', running.length)
row('هیچ‌وقت سینک نشده', never.length, 'در هر ساعتی سررسیده‌اند')
row('سررسیده همین الان', due.length)
row('زمان‌بندی خاموش', off.length, 'عمدی — schedule=off یا autoSync خاموش')
row('پارک‌شده (۳+ تلاشِ ناتمام)', parked.length, 'منتظرِ کلیکِ دستی')
row('دارای خطای آخر', errored.length)


// ── چرا هر آژانس هر چند روز یک‌بار؟ اندازه‌گیری، نه حدس ─────────────────────────
// lastOkAt هر آژانس «آخرین سینکِ موفقش» است. اگر این‌ها را بر اساسِ شبی که در آن
// افتاده‌اند بشماریم، توانِ واقعیِ هر شب درمی‌آید — و دورهٔ تکرار = کلِ آژانس‌ها ÷ همان.
// این عدد را هیچ‌جا نگه نمی‌داشتیم، پس «۲-۳ روز» تا امروز فقط حس بود.
console.log('')
console.log('— توانِ واقعیِ هر شب (از lastOkAtِ خودِ آژانس‌ها) —')
let slotEvery = 1          // «هر چند شب یک‌بار نوبتِ یک آژانس می‌شود» — در بخشِ کش هم لازم است
{
  const nightOf = t => {                       // «شبِ» مالکِ یک زمان: روزی که پنجره‌اش در آن باز شد
    const d = new Date(t + IR)
    const h = d.getUTCHours()
    const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    if (h < g.startHour) day.setUTCDate(day.getUTCDate() - 1)
    return day.toISOString().slice(0, 10)
  }
  const byNight = new Map()
  let ok = 0
  for (const s of all) { if (!s.lastOkAt) continue; ok++; const k = nightOf(s.lastOkAt); byNight.set(k, (byNight.get(k) || 0) + 1) }
  if (!ok) console.log('  هیچ آژانسی سینکِ موفق ندارد (lastOkAt خالی است — کدِ پیش از فاز ۲۹۷ض) — از lastRun استفاده کن.')
  else {
    const nights = [...byNight.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7)
    for (const [k, v] of nights) console.log('  ' + k + '   ' + String(v).padStart(4) + ' آژانس')
    // «آخرین موفقیت» است، پس شب‌های قدیمی‌تر کم‌شمرده می‌شوند؛ تازه‌ترین شبِ کامل واقع‌بینانه‌ترین است.
    const best = Math.max(...nights.map(x => x[1]))
    if (best) slotEvery = all.length / best
    console.log('  بهترین شب: ' + best + ' آژانس   ⇒ دورهٔ تکرار ≈ ' + (best ? slotEvery.toFixed(1) : '∞') + ' شب')
  }
}

// طولِ هر پاس — تازه ثبت شده (lastOkMs)؛ تا پرشدن، خطِ «نامعلوم» را می‌بینی.
console.log('')
console.log('— طولِ آخرین پاسِ موفق (ظرفیت = پنجره ÷ همین) —')
{
  const ms = all.map(s => s.lastOkMs).filter(x => Number(x) > 0).sort((a, b) => a - b)
  if (!ms.length) console.log('  نامعلوم — lastOkMs از این دیپلوی به بعد نوشته می‌شود؛ فردا دوباره بزن.')
  else {
    const mins = x => (x / 60000).toFixed(1)
    const med = ms[Math.floor(ms.length / 2)]
    row('نمونه', ms.length)
    row('میانه', mins(med) + ' دقیقه')
    row('بیشترین', mins(ms[ms.length - 1]) + ' دقیقه')
    const perNight = med > 0 ? Math.floor((winH * 3600_000) / med) * cap : 0
    console.log('  ظرفیتِ نظریِ پنجره: ' + winH + ' ساعت ÷ ' + mins(med) + ' دقیقه × ' + cap + ' هم‌زمان = ' + perNight + ' آژانس در هر شب')
    if (perNight && perNight < all.length) console.log('  ⇒ با ' + all.length + ' آژانس، هر کدام هر ' + (all.length / perNight).toFixed(1) + ' شب یک‌بار نوبتش می‌شود. همین است «۲-۳ روز».')
  }
}
console.log('')
// برچسبِ قبلیِ این بخش «سینکِ موفق» بود و غلط بود: lastRun در شکست هم ست می‌شود.
console.log('— عمرِ آخرین تلاشِ سینک (موفق یا ناموفق) —')
const buckets = { 'هیچ‌وقت': 0, '<۱ روز': 0, '۱ تا ۳ روز': 0, '۳ تا ۷ روز': 0, '۷ تا ۳۰ روز': 0, '۳۰+ روز': 0 }
for (const s of all) {
  if (!s.lastRun) buckets['هیچ‌وقت']++
  else { const d = (now - s.lastRun) / 86400_000
    if (d < 1) buckets['<۱ روز']++; else if (d < 3) buckets['۱ تا ۳ روز']++
    else if (d < 7) buckets['۳ تا ۷ روز']++; else if (d < 30) buckets['۷ تا ۳۰ روز']++; else buckets['۳۰+ روز']++ }
}
for (const [k, v] of Object.entries(buckets)) row(k, v)

console.log('')
console.log('— عمرِ آخرین سینکِ «موفق» (همان چیزی که پنل نشان می‌دهد) —')
const okB = { 'هیچ‌وقت': 0, '<۱ روز': 0, '۱ تا ۳ روز': 0, '۳ تا ۷ روز': 0, '۷ تا ۳۰ روز': 0, '۳۰+ روز': 0 }
for (const s of all) {
  if (!s.lastOkAt) okB['هیچ‌وقت']++
  else { const d = (now - s.lastOkAt) / 86400_000
    if (d < 1) okB['<۱ روز']++; else if (d < 3) okB['۱ تا ۳ روز']++
    else if (d < 7) okB['۳ تا ۷ روز']++; else if (d < 30) okB['۷ تا ۳۰ روز']++; else okB['۳۰+ روز']++ }
}
for (const [k, v] of Object.entries(okB)) row(k, v)

// «اجرا شد» با «چیزی آورد» یکی نیست. رانی که موفق تمام شود ولی صفر آگهی ببیند
// (دیوار throttle کرده، پروفایل عوض شده، slug مرده) از بیرون دقیقاً مثلِ «آپدیت نمی‌شود» است.
console.log('')
console.log('— دستاوردِ آخرین رانِ موفق —')
const tb = { 'صفر آگهی': 0, '۱ تا ۵۰': 0, '۵۱ تا ۲۰۰': 0, '۲۰۰+': 0, 'نامعلوم': 0 }
let advTotal = 0, noAdv = 0
for (const s2 of all) {
  const t = s2.lastTotal
  if (t === undefined || t === null) tb['نامعلوم']++
  else if (t === 0) tb['صفر آگهی']++
  else if (t <= 50) tb['۱ تا ۵۰']++
  else if (t <= 200) tb['۵۱ تا ۲۰۰']++
  else tb['۲۰۰+']++
  const n = Array.isArray(s2.advisors) ? s2.advisors.length : 0
  advTotal += n
  if (!n) noAdv++
}
for (const [k, v] of Object.entries(tb)) row(k, v)
row('کلِ مشاوران', advTotal)
row('آژانسِ بدونِ مشاور', noAdv, noAdv ? 'ران تمام شده ولی خروجی نداشته' : '')

// چرا محتوا تکان نمی‌خورد حتی وقتی سینک «هر شب» اجرا می‌شود — دو ضرب، نه یکی:
//   (۱) هر پاس حداکثر `max(30, ردیف/۱۴)` ردیفِ کهنه را تازه می‌کند (agency-roster-store).
//       این سقف با این فرض مشتق شده که آژانس «هر شب» یک اسلات می‌گیرد.
//   (۲) ولی واقعاً هر K شب یک‌بار نوبتش می‌شود (K را از بخشِ توانِ شبانه می‌گیریم).
// پس دورِ واقعیِ تازه‌سازی = ۱۴ × K شب، نه ۱۴. تا امروز این بخش CAP را ۳۰ِ ثابت
// فرض می‌کرد (کدِ فعلی مشتق می‌کند) و K را هم در حساب نمی‌آورد — هر دو گمراه‌کننده.
console.log('')
console.log('— کشِ ردیفِ روستر: آیا دورِ تازه‌سازی به خودش می‌رسد؟ —')
const AGE_D = 14
try {
  const { pgEnabled, pgTx } = await import('../app/lib/db.ts')
  if (!pgEnabled()) console.log('  بدونِ DATABASE_URL — این بخش رد شد')
  else {
    const r = await pgTx(c => c.query(
      "SELECT key, (SELECT count(*) FROM jsonb_object_keys(data)) AS rows FROM kv WHERE key LIKE 'agency_roster_cache:%'"))
    const sizes = r.rows.map(x => Number(x.rows)).sort((a, b) => b - a)
    const capOf = n => Math.max(30, Math.ceil(n / AGE_D))   // عیناً refreshCapِ agency-roster-store
    const nightsIfEveryNight = n => Math.ceil(n / capOf(n))
    const realNights = n => Math.round(nightsIfEveryNight(n) * slotEvery * 10) / 10
    const behind = sizes.filter(n => realNights(n) > AGE_D)
    row('آژانسِ دارای کش', sizes.length)
    row('مجموعِ ردیف‌ها', sizes.reduce((a, b) => a + b, 0))
    row('نوبتِ هر آژانس', slotEvery.toFixed(1) + ' شب', 'از بخشِ توانِ شبانه')
    row('بزرگ‌ترین', sizes[0] || 0, sizes[0] ? 'سقفِ پاس ' + capOf(sizes[0]) + ' ⇒ ' + nightsIfEveryNight(sizes[0]) + ' پاس = ' + realNights(sizes[0]) + ' شب' : '')
    row('میانه', sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0, sizes.length ? 'سقفِ پاس ' + capOf(sizes[Math.floor(sizes.length / 2)]) : '')
    row('عقب‌مانده از چرخه', behind.length, '>' + AGE_D + ' شب تا یک دورِ کامل — محتوایشان یخ می‌زند')
    // بارِ واقعیِ شبانه روی دیوار، که سقفِ عبوری را تعیین می‌کند
    const perNightFetch = sizes.reduce((a, n) => a + capOf(n), 0) / Math.max(1, slotEvery)
    console.log('  واکشیِ تازه‌سازی در هر شب ≈ ' + Math.round(perNightFetch) + ' توکن (فقط refresh، بی‌حسابِ آگهیِ تازه)')
    console.log('  ⇒ همین بارِ دیوار است که طولِ پاس را می‌سازد؛ بخشِ «طولِ آخرین پاسِ موفق» بالا عددش را می‌دهد.')
  }
} catch (e) { console.log('  خطا: ' + (e?.message || e)) }

const byErr = new Map()
for (const s of errored) { const k = String(s.lastError).slice(0, 70); byErr.set(k, (byErr.get(k) || 0) + 1) }
if (byErr.size) {
  console.log('')
  console.log('— خطاهای پرتکرار —')
  for (const [k, v] of [...byErr.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) console.log('  ' + String(v).padStart(4) + '×  ' + k)
}

const oldest = all.filter(s => s.lastRun).sort((a, b) => a.lastRun - b.lastRun).slice(0, 8)
if (oldest.length) {
  console.log('')
  console.log('— قدیمی‌ترین‌ها —')
  for (const s of oldest) {
    console.log('  ' + days(now - s.lastRun).padStart(6) + ' روز پیش   ' + String(s.slug || s.id).slice(0, 26).padEnd(28) +
      'تلاش=' + (s.runAttempts || 0) + '  ' + (s.lastError ? 'خطا: ' + String(s.lastError).slice(0, 44) : 'بدونِ خطا'))
  }
}

console.log('')
if (parked.length > all.length * 0.2) console.log('← بیشترِ مشکل «پارک‌شده» است: خطای تکراری صف را نمی‌بندد ولی آژانس منتظرِ دستِ آدم می‌ماند.')
else if (due.length > cap * 20) console.log('← بیشترِ مشکل ظرفیت است: سررسیده‌ها از آنچه پنجره جا می‌دهد بیشترند، پس نوبتی می‌شوند نه روزانه.')
else console.log('← نه پارک‌شدگی غالب است نه کمبودِ ظرفیت؛ سطلِ عمرِ سینک بالا را نگاه کن.')
process.exit(0)
