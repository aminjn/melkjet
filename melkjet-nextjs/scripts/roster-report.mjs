// ── گزارشِ کاملِ رُستر: همهٔ آژانس‌ها + مشاورها + وضعیتِ همگام‌سازیِ خودکار ──────────
// پاسخِ قطعی به «آیا آژانس‌ها خودکار سینک می‌شوند؟ مشاورها در چه حالی‌اند؟»
// اجرا (روی سرور):
//   node --import ./scripts/reos-loader.mjs scripts/roster-report.mjs
import { readFileSync, existsSync } from 'fs'
function loadEnv(f) { if (!existsSync(f)) return; for (const l of readFileSync(f, 'utf-8').split('\n')) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[m[1]] === undefined) process.env[m[1]] = v } }
loadEnv('.env.production.local'); loadEnv('.env')

const { listScrapes, getRosterSettings } = await import('../app/lib/agency-roster-store.ts')
const { getCronBeat } = await import('../app/lib/cron-heartbeat.ts')

const fa = (n) => Number(n || 0).toLocaleString('fa-IR')
const now = Date.now()
const ago = (t) => {
  if (!t) return 'هرگز'
  const m = Math.round((now - t) / 60000)
  if (m < 60) return `${fa(m)} دقیقه پیش`
  const h = Math.round(m / 60)
  if (h < 48) return `${fa(h)} ساعت پیش`
  return `${fa(Math.round(h / 24))} روز پیش`
}

const settings = await getRosterSettings()
const scrapes = await listScrapes()
const beat = await getCronBeat()

console.log('════════════════ گزارشِ کاملِ رُسترِ آژانس‌ها ════════════════\n')

// ── ۱) سلامتِ همگام‌سازیِ خودکار ──
console.log('■ همگام‌سازیِ خودکار')
console.log(`  وضعیت: ${settings.autoSync ? '✓ روشن' : '✗ خاموش'}  ·  پنجره: ساعتِ ${fa(settings.startHour)} تا ${fa(settings.endHour)} (به وقتِ ایران)`)
console.log(`  یعنی آژانسِ «قبلاً سینک‌شده» فقط در این پنجره تازه می‌شود؛ آژانسِ «هرگز سینک‌نشده» هر ساعتی.`)
console.log(`  آخرین تیکِ کرون (اینستنسِ ۰): ${ago(beat.at)}  ·  شمارهٔ اینستنس: ${beat.instance ?? '—'}`)
console.log(`  آخرین باری که کرون یک آژانسِ سررسیده را «دید»: ${ago(beat.lastRosterDueAt)}`)
console.log(`  آخرین باری که کرون یک سینک را «شروع کرد»: ${ago(beat.lastRosterSyncAt)}${beat.lastRosterSyncSlug ? ` (${beat.lastRosterSyncSlug})` : ''}`)
if (!beat.at || now - beat.at > 10 * 60000) console.log('  ⚠️ کرون بیش از ۱۰ دقیقه است تیک نزده — ممکن است اینستنسِ ۰ مرده باشد (pm2 restart melkjet-3000).')
console.log('')

// ── ۲) جدولِ آژانس‌ها ──
let totAds = 0, totAdv = 0, totNamedAdv = 0, totGrad = 0, totUnnamed = 0, neverSynced = 0, running = 0, autoOff = 0
const rows = scrapes.map(s => {
  const adv = s.advisors || []
  const named = adv.filter(a => a.phone).length         // حساب‌دار (graduate شده)
  const grad = adv.filter(a => a.graduating).length      // در صفِ ساختِ حساب
  totAds += s.lastTotal || 0; totAdv += adv.length; totNamedAdv += named; totGrad += grad
  totUnnamed += s.lastUnnamed || 0
  if (!s.lastRun) neverSynced++
  if (s.running) running++
  const autoOn = s.autoSync !== undefined ? s.autoSync : settings.autoSync
  if (!autoOn || s.schedule === 'off') autoOff++
  return { s, adv: adv.length, named, grad, autoOn }
}).sort((a, b) => (b.s.lastTotal || 0) - (a.s.lastTotal || 0))

console.log(`■ ${fa(scrapes.length)} آژانس  ·  ${fa(totAds)} آگهیِ اسکن‌شده  ·  ${fa(totAdv)} مشاورِ شناسایی‌شده (${fa(totNamedAdv)} حساب‌دار، ${fa(totGrad)} در صفِ ساخت)  ·  ${fa(totUnnamed)} آگهیِ بی‌نام`)
console.log(`  هرگز سینک‌نشده: ${fa(neverSynced)}  ·  در حالِ اجرا الان: ${fa(running)}  ·  اتوسینک خاموش: ${fa(autoOff)}\n`)

console.log('  آژانس'.padEnd(26) + 'اسلاگ'.padEnd(14) + 'آگهی'.padStart(7) + 'مشاور'.padStart(7) + 'حساب'.padStart(6) + 'بی‌نام'.padStart(7) + '  آخرین سینک'.padEnd(15) + ' اتو')
console.log('  ' + '─'.repeat(92))
for (const r of rows) {
  const name = (r.s.agencyName || r.s.slug || '—').slice(0, 24)
  const line =
    '  ' + name.padEnd(24) +
    String(r.s.slug || '—').slice(0, 12).padEnd(14) +
    fa(r.s.lastTotal || 0).padStart(7) +
    fa(r.adv).padStart(7) +
    fa(r.named).padStart(6) +
    fa(r.s.lastUnnamed || 0).padStart(7) +
    ('  ' + (r.s.running ? '⏳ اجرا' : ago(r.s.lastRun))).padEnd(16) +
    (r.autoOn && r.s.schedule !== 'off' ? '✓' : '✗')
  console.log(line)
  if (r.s.lastError) console.log('     ↳ خطا: ' + String(r.s.lastError).slice(0, 80))
}

// ── آژانس‌های با نامِ تکراری (احتمالِ اسکرپِ دوتایی) ──
const byName = new Map()
for (const s of scrapes) {
  const k = (s.agencyName || '').replace(/\s+/g, ' ').trim()
  if (!k) continue
  ;(byName.get(k) || byName.set(k, []).get(k)).push(s)
}
const dups = [...byName.entries()].filter(([, v]) => v.length > 1)
if (dups.length) {
  console.log(`\n■ ⚠️ ${fa(dups.length)} نامِ آژانسِ تکراری (شاید اسکرپِ دوتایی — یا شعبه‌های واقعی):`)
  for (const [name, list] of dups) {
    console.log(`  «${name}»:`)
    for (const s of list.sort((a, b) => (b.lastTotal || 0) - (a.lastTotal || 0)))
      console.log(`     slug=${s.slug}  ·  ${fa(s.lastTotal || 0)} آگهی  ·  ${fa((s.advisors || []).length)} مشاور  ·  آخرین سینک ${ago(s.lastRun)}`)
  }
  console.log('  (اگر دو ردیف «یک divar profile» باشند، ردیفِ کوچک/قدیمی را در پنل حذف کن — فایل‌ها می‌مانند.)')
}

// ── سلامتِ خطا: چند آژانس در آخرین پاس خطای گذرا خوردند ──
const transientN = scrapes.filter(s => /گذرا/.test(s.lastError || '')).length
const fatalN = scrapes.filter(s => s.lastError && !/گذرا/.test(s.lastError)).length
if (transientN || fatalN) console.log(`\n■ خطاها: ${fa(transientN)} آژانس خطای «گذرا» (خودکار دوباره تلاش می‌شود) · ${fa(fatalN)} خطای «قطعی» (نیاز به بررسی)`)

// ── ۳) مشاورهای حساب‌دار (graduate شده) ──
const graduated = []
for (const s of scrapes) for (const a of (s.advisors || [])) if (a.phone) graduated.push({ agency: s.agencyName || s.slug, name: a.name, phone: a.phone, files: a.listingCount || (a.tokens?.length || 0) })
graduated.sort((a, b) => b.files - a.files)
console.log(`\n■ ${fa(graduated.length)} مشاورِ حساب‌دار (نمونهٔ ۳۰ پرفایل):`)
for (const g of graduated.slice(0, 30)) console.log(`  ${g.phone}  ${String(g.name).padEnd(18)} ${fa(g.files).padStart(4)} فایل   (${g.agency})`)

process.exit(0)
