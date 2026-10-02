// ── گزارشِ وضعیتِ سایت‌سازِ خودکار + تشخیصِ یک سایتِ مشخص ─────────────────────────
// پاسخِ قطعی به «چرا تغییر رو سایت نیومد؟»: دیپلوی شده؟ بازسازی به کجا رسیده؟ این سایت
// در چه نسخه‌ای است و دادهٔ پروژه برای صاحبش اصلاً وجود دارد؟
// اجرا (روی سرور):
//   node --import ./scripts/reos-loader.mjs scripts/autosite-status.mjs            ← وضعیتِ کلی
//   node --import ./scripts/reos-loader.mjs scripts/autosite-status.mjs باران-نژاد  ← + تشخیصِ همان سایت
import { readFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
function loadEnv(f) { if (!existsSync(f)) return; for (const l of readFileSync(f, 'utf-8').split('\n')) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[m[1]] === undefined) process.env[m[1]] = v } }
loadEnv('.env.production.local'); loadEnv('.env')

const { kvGet, pgEnabled } = await import('../app/lib/db.ts')
const { AUTO_SITE_V } = await import('../app/lib/auto-site.ts')
const fa = (n) => Number(n || 0).toLocaleString('fa-IR')
const ago = (t) => t ? `${Math.round((Date.now() - t) / 60000).toLocaleString('fa-IR')} دقیقه پیش` : '—'

console.log('════════════ وضعیتِ سایت‌سازِ خودکار ════════════')
try { console.log('کدِ روی دیسک:', execSync('git log -1 --format="%h %s (%cr)"', { encoding: 'utf-8' }).trim()) } catch {}
console.log(`نسخهٔ سازندهٔ این کد: v${AUTO_SITE_V}`)
if (!pgEnabled()) { console.log('⚠️ DATABASE_URL نیست — این اسکریپت فقط روی سرور معنا دارد.'); process.exit(0) }

const meta = await kvGet('autosite_meta', { done: {} })
const recs = Object.values(meta.done || {})
const byV = {}
let manual = 0
for (const r of recs) { if (r.manual) { manual++; continue } const v = r.v || 1; byV[v] = (byV[v] || 0) + 1 }
console.log(`\nکلِ رکوردها: ${fa(recs.length)} (دست‌ساز: ${fa(manual)})`)
for (const v of Object.keys(byV).sort((a, b) => a - b)) {
  console.log(`  v${v}: ${fa(byV[v])} سایت${Number(v) < AUTO_SITE_V ? '  ← در صفِ بازسازی (۲۴تا در هر ۴۵ ثانیه)' : '  ✓ به‌روز'}`)
}
const behind = recs.filter(r => !r.manual && (r.v || 1) < AUTO_SITE_V).length
if (behind) console.log(`⏳ ${fa(behind)} سایت هنوز قدیمی‌اند — حدودِ ${fa(Math.ceil(behind / 24 * 45 / 60))} دقیقه تا پایانِ بازسازی.`)
else console.log('✅ همهٔ سایت‌های خودکار به‌روزند.')

const slugArg = process.argv[2]
if (slugArg) {
  console.log(`\n──────── تشخیصِ سایتِ «${slugArg}» ────────`)
  const { getSite } = await import('../app/lib/sites-store.ts')
  const site = await getSite(slugArg)
  if (!site) { console.log('✗ سایتی با این اسلاگ نیست.'); process.exit(0) }
  const owner = String(site.owner || '')
  const rec = (meta.done || {})[owner]
  console.log(`صاحب: ${owner} · آخرین نوشتنِ سایت: ${ago(site.updatedAt)} · نسخهٔ رکورد: v${rec?.v || '—'}${rec?.manual ? ' (دست‌ساز — هرگز بازنویسی نمی‌شود)' : ''}`)
  console.log(`صفحه‌ها: ${site.pages.map(p => p.slug).join('، ')}`)
  const blocks = site.pages.flatMap(p => p.blocks || [])
  const hasProj = blocks.some(b => b.type === 'services' && String(b.props?.heading || '') === 'پروژه‌های ما')
  const ftr = blocks.find(b => b.type === 'footer')
  const links = Array.isArray(ftr?.props?.links) ? ftr.props.links : []
  console.log(`بلوکِ «پروژه‌های ما»: ${hasProj ? '✓ هست' : '✗ نیست'}`)
  console.log(`منوی فوتر: ${links.length ? links.map(l => l.label).join(' / ') + (String(links[0]?.href || '').startsWith('#') ? '  ⚠ هنوز انکرِ قدیمی' : '  ✓ لینکِ واقعی') : '✗ خالی'}`)
  // دادهٔ پروژه برای این صاحب اصلاً وجود دارد؟
  try {
    const ps = await import('../app/lib/persiansaze-store.ts')
    const bid = ps.builderIdForPhone(owner)
    const prof = bid ? ps.getProfile(bid) : null
    if (prof) console.log(`پرشین‌سازه: ✓ پروفایل ${bid} («${prof.name}») با ${fa(prof.projectCount)} پروژه`)
    else console.log('پرشین‌سازه: ✗ هیچ سازنده‌ای با این شماره در بانک نیست — کارتِ پروژه برای این سایت «داده ندارد»، نه باگ.')
  } catch (e) { console.log('پرشین‌سازه: خطا در خواندن —', String(e?.message || e).slice(0, 80)) }
  if (rec && !rec.manual && (rec.v || 1) < AUTO_SITE_V) console.log(`⏳ این سایت هنوز در صفِ بازسازی است (v${rec.v || 1} → v${AUTO_SITE_V}).`)
}
console.log('\nلاگِ زندهٔ جارو:  tail -n 200 /root/.pm2/logs/melkjet-3000-out.log | grep autosite')
