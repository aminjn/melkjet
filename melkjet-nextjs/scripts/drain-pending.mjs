// تخلیهٔ یک‌شاتِ صفِ «منتظر» — همان منطقِ moderatePending را پشتِ‌سرِهم اجرا می‌کند تا صف خالی شود
// (به‌جای انتظار برای تیکِ ۴۵ثانیه‌ایِ کرون). روی سرور:
//   node --import ./scripts/reos-loader.mjs scripts/drain-pending.mjs
// امن: همان گِیت‌های سلامت/تکرار + سیاستِ جاری (نامطمئن→تأیید). بی‌صدا (بدونِ پیامک/آلارمِ انبوه).
import { readFileSync } from 'fs'
if (!process.env.DATABASE_URL) {
  for (const f of ['.env.production.local', '.env.local', '.env']) {
    try { for (const line of readFileSync(f, 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') } } catch {}
  }
}
const { moderatePending } = await import('../app/lib/moderation.ts')
const { listItems } = await import('../app/lib/scraper-store.ts')

console.log(process.env.DATABASE_URL ? '🗄  منبع: PostgreSQL (زنده)\n' : '⚠️  DATABASE_URL نیست!\n')
const pendingCount = async () => (await listItems('listing')).filter(i => i.status === 'pending').length

let start = await pendingCount()
console.log(`شروع — منتظر: ${start}`)
let total = 0
for (let i = 1; i <= 120; i++) {
  let r
  try { r = await moderatePending(250) }
  catch (e) { console.log(`دور ${i}: خطای گذرا (${String(e.message || e).slice(0, 60)}) — کمی صبر و ادامه`); await new Promise(res => setTimeout(res, 2000)); continue }
  total += r.moderated
  const left = await pendingCount()
  console.log(`دور ${i}: حکم‌شده ${r.moderated} | باقی‌مانده منتظر: ${left}${r.error ? ' · ' + r.error : ''}`)
  if (left <= 20 || r.moderated === 0) break
  await new Promise(res => setTimeout(res, 400))   // نفس به کرون/اسکرپرِ زنده بده (کاهشِ رقابتِ قفل)
}
const end = await pendingCount()
console.log(`\n✅ تمام. منتظر: ${start} → ${end} (جمعاً ${total} حکم).`)
console.log(end > 20 ? 'اگر هنوز بالاست، دوباره اجرا کن یا چند دقیقه صبر کن (کرون هم ادامه می‌دهد).' : 'صف خالی شد.')
process.exit(0)
