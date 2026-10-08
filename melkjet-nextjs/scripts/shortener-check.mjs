// ── تشخیصِ کوتاه‌کنندهٔ لینک (nxal) — پاسخِ قطعی به «چرا لینکِ بلند رفت؟» ──────────
// اجرا (روی سرور):
//   node --import ./scripts/reos-loader.mjs scripts/shortener-check.mjs            ← با URL نمونه
//   node --import ./scripts/reos-loader.mjs scripts/shortener-check.mjs زهرا-شهابی ← با اسلاگ واقعی
import { readFileSync, existsSync } from 'fs'
function loadEnv(f) { if (!existsSync(f)) return; for (const l of readFileSync(f, 'utf-8').split('\n')) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[m[1]] === undefined) process.env[m[1]] = v } }
loadEnv('.env.production.local'); loadEnv('.env')

const { getAdminData } = await import('../app/lib/admin-store.ts')
const { shortenUrlDetailed } = await import('../app/lib/shortener.ts')

console.log('════════════ تشخیصِ کوتاه‌کنندهٔ لینک ════════════')
const sh = getAdminData().shortener
if (!sh?.apiKey) {
  console.log('✗ کوتاه‌کننده پیکربندی نشده — در پنلِ ادمین (بخشِ ترکر) «کلیدِ API نوال» خالی است.')
  console.log('  تا وقتی کلید ثبت نشود، پیامکِ سایت‌ساز ارسال نمی‌شود و همین خطا در پنل دیده می‌شود.')
  process.exit(0)
}
console.log(`کلیدِ nxal: ***${sh.apiKey.slice(-4)}`)
console.log(`پایه: ${sh.baseUrl || 'https://nxal.ir'}${sh.domain ? `  دامنهٔ کوتاه: ${sh.domain}` : ''}`)

const slug = process.argv[2] || 'زهرا-شهابی'
const url = `https://melkjet.com/${encodeURIComponent(slug)}`
console.log(`\nآزمایش با همان URLی که پیامکِ سایت‌ساز می‌سازد:\n  ${url}`)
const r = await shortenUrlDetailed(url)
if (r.ok) console.log(`✅ کوتاه شد: ${r.shortUrl}  (id: ${r.id})`)
else console.log(`✗ شکست: ${r.error}`)
process.exit(0)
