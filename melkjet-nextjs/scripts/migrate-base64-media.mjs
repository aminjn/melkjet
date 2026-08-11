// ── مهاجرتِ عکس‌های base64ِ مقالات به سیستمِ مدیا (فایل + URL) ─────────────────────────
// ریشهٔ کندیِ سایت: کاور و عکس‌های بدنهٔ مقالات به‌صورت data:URI (base64) داخلِ خودِ HTML بودند —
// یک کاور تا ۲.۳MB، صفحهٔ /blog تا ۷۷MB، صفحهٔ مقاله تا ۱۸MB! این اسکریپت هر base64 را یک فایلِ
// مدیا می‌کند و فیلد/بدنه را با URLِ کوتاهِ /api/media/{id} جایگزین می‌کند. عکس‌ها حفظ، حجم نابود.
// اجرا (روی سرور):  node --import ./scripts/reos-loader.mjs scripts/migrate-base64-media.mjs [--dry]
// بعدش:  pm2 reload ecosystem.config.js   (تا کشِ مقاله و ایندکسِ مدیا تازه شوند)
import { readFileSync, existsSync } from 'fs'
function loadEnv(f) { if (!existsSync(f)) return; for (const l of readFileSync(f, 'utf-8').split('\n')) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[m[1]] === undefined) process.env[m[1]] = v } }
loadEnv('.env.production.local'); loadEnv('.env')

const DRY = process.argv.includes('--dry')
const { listItems, updateArticle } = await import('../app/lib/scraper-store.ts')
const { saveMedia } = await import('../app/lib/media-store.ts')

const RE = /data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/g
function toMedia(mime, b64) {
  try { const buf = Buffer.from(b64, 'base64'); if (!buf.length) return null; const m = saveMedia(buf, mime, 'article'); return `/api/media/${m.id}` } catch { return null }
}
const cleanSummary = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200)

const arts = await listItems('article')
let changed = 0, nCover = 0, nBody = 0, before = 0, after = 0
for (const a of arts) {
  const patch = {}
  // کاور
  if (typeof a.image === 'string' && a.image.startsWith('data:')) {
    const mm = a.image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/)
    if (mm) { before += a.image.length; const u = DRY ? '/api/media/DRY' : toMedia(mm[1], mm[2]); if (u) { patch.image = u; after += u.length; nCover++ } }
  }
  // بدنه (در فیلدِ excerpt ذخیره می‌شود)
  const body = typeof a.excerpt === 'string' ? a.excerpt : ''
  if (body.includes('data:image')) {
    let hit = false
    const newBody = body.replace(RE, (full, mime, b64) => { before += full.length; const u = DRY ? '/api/media/DRY' : toMedia(mime, b64); if (u) { after += u.length; nBody++; hit = true; return u } return full })
    if (hit) { patch.body = newBody; patch.excerpt = a.meta?.summary || cleanSummary(newBody) }   // خلاصه حفظ می‌شود
  }
  if (Object.keys(patch).length) {
    changed++
    if (!DRY) await updateArticle(a.id, patch)
    console.log(`✓ ${a.id}  «${(a.title || '').slice(0, 42)}»  کاور:${patch.image ? '✓' : '-'}  عکسِ‌بدنه:${patch.body ? '✓' : '-'}`)
  }
}
console.log(`\n${DRY ? '[DRY-RUN] ' : ''}مقالاتِ تغییرکرده: ${changed}  |  کاور: ${nCover}  |  عکسِ بدنه: ${nBody}`)
console.log(`حجمِ base64ِ حذف‌شده از HTML: ${(before / 1e6).toFixed(1)}MB  →  URLها: ${(after / 1e3).toFixed(1)}KB`)
console.log(DRY ? 'این فقط پیش‌نمایش بود؛ بدونِ --dry واقعی اجرا کن، بعد pm2 reload.' : 'انجام شد. حالا: pm2 reload ecosystem.config.js')
process.exit(0)
