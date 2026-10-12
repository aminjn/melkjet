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
console.log('(توجه: درین به سینکِ روستر باج می‌دهد؛ اگر روستر در جریان باشد این دورها ۰ می‌شوند و منتظر می‌ماند.)')
let total = 0, idle = 0
for (let i = 1; i <= 400; i++) {
  let r
  try { r = await moderatePending(200) }
  catch (e) { console.log(`دور ${i}: خطای گذرا (${String(e.message || e).slice(0, 60)}) — صبر و ادامه`); await new Promise(res => setTimeout(res, 3000)); continue }
  total += r.moderated
  const left = await pendingCount()
  console.log(`دور ${i}: حکم‌شده ${r.moderated} | باقی‌مانده: ${left}${r.error ? ' · ' + r.error : ''}`)
  if (left <= 20) break
  // فقط وقتی تسلیم شو که چند دورِ پیاپی صفر بود (نه یک دورِ تنها — ممکن است روستر مشغول باشد).
  idle = r.moderated === 0 ? idle + 1 : 0
  if (idle >= 8) { console.log('۸ دورِ پیاپی بی‌پیشرفت — فعلاً متوقف. بعداً دوباره بزن یا بگذار کرون آرام تخلیه کند.'); break }
  await new Promise(res => setTimeout(res, r.moderated === 0 ? 4000 : 600))   // بیکار؟ صبرِ بیشتر
}
const end = await pendingCount()
console.log(`\n✅ تمام. منتظر: ${start} → ${end} (جمعاً ${total} حکم).`)
console.log(end > 20 ? 'اگر هنوز بالاست، دوباره اجرا کن یا چند دقیقه صبر کن (کرون هم ادامه می‌دهد).' : 'صف خالی شد.')
process.exit(0)
