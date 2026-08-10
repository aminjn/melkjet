// ── گزارشِ سلامتِ کلِ ماشین‌لرنینگِ پلتفرم (نه فقط لِکسیکونِ اسمِ آژانس) ──────────────
// نشان می‌دهد کدام مدل‌ها زنده‌اند، روی چند نمونه آموزش دیده‌اند، AUC/دقت چقدر است، و کِی آموزش دیدند.
// اجرا (روی سرور):  node --import ./scripts/reos-loader.mjs scripts/ml-status.mjs
import { readFileSync, existsSync } from 'fs'
function loadEnv(f) { if (!existsSync(f)) return; for (const l of readFileSync(f, 'utf-8').split('\n')) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[m[1]] === undefined) process.env[m[1]] = v } }
loadEnv('.env.production.local'); loadEnv('.env')

const { pgTx, pgEnabled } = await import('../app/lib/db.ts')
const ago = (t) => t ? `${Math.round((Date.now() - t) / 3600000)} ساعت پیش` : 'هرگز'
const cnt = async (t) => { try { const r = await pgTx(c => c.query(`SELECT count(*)::int n FROM ${t}`)); return r.rows[0].n } catch { return '—' } }

console.log('════════════════ سلامتِ ماشین‌لرنینگِ کلِ پلتفرم ════════════════')
console.log(`منبعِ داده: ${pgEnabled() ? 'PostgreSQL (زنده)' : '⚠️ فایل — DATABASE_URL نیست'}\n`)

if (!pgEnabled()) { console.log('بدونِ DATABASE_URL آمار زنده در دسترس نیست.'); process.exit(0) }

// ۱) حجمِ دادهٔ خامی که ML روی آن می‌نشیند
console.log('── حجمِ داده ──')
console.log(`  آگهی‌ها (listings): ${await cnt('listings')}`)
console.log(`  رویدادهای رفتاری REOS (reos_events): ${await cnt('reos_events')}`)
console.log(`  مدل‌های ذخیره‌شدهٔ REOS (reos_models): ${await cnt('reos_models')}`)
console.log(`  گرافِ دانش (reos_graph_edges): ${await cnt('reos_graph_edges')}`)

// ۲) REOS — موتورِ اصلی: آموزشِ خودکار هر چند ساعت، champion/challenger
console.log('\n── REOS (موتورِ اصلیِ توصیه/امتیاز/بازار) ──')
try {
  let cfg = {}; try { const c = await import('../app/lib/reos/reos-config.ts'); cfg = (c.primeConfig ? await c.primeConfig() : (c.config ? c.config() : {})) } catch {}
  const tr = cfg.training || {}
  console.log(`  آموزشِ خودکار: ${tr.enabled === false ? 'خاموش ❌' : `روشن ✅ هر ${tr.autoHours || '?'} ساعت`}`)
  const { trainLog } = await import('../app/lib/reos/train-log.ts')
  const log = await trainLog()
  console.log(`  آخرین آموزش: ${ago(log.lastAt)}`)
  const last = (log.runs || []).slice(-8).reverse()
  for (const r of last) console.log(`    • ${r.kind}: n=${r.n ?? '—'} ${r.auc != null ? `AUC=${r.auc}` : ''} ${r.ok ? '✓' : '✗'} ${r.note || ''}  (${ago(r.at)})`)
  if (!last.length) console.log('    (هنوز آموزشی ثبت نشده — کرونِ اینستنسِ ۰ هر چند ساعت می‌زند)')
} catch (e) { console.log('  خطا:', e.message) }

// ۳) مدل‌های champion در رجیستری با متریک‌ها
try {
  const r = await pgTx(c => c.query(`SELECT name, version, metrics, at FROM reos_models WHERE status='champion' ORDER BY name`))
  console.log('\n── مدل‌های فعال (champion) در رجیستری ──')
  if (!r.rows.length) console.log('  (هیچ مدلِ championی هنوز ثبت نشده)')
  for (const m of r.rows) {
    const mt = m.metrics || {}
    const metricStr = Object.entries(mt).map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(3) : v}`).join(' ، ')
    console.log(`  • ${m.name} v${m.version}   ${metricStr || '(بدونِ متریک)'}   (${ago(Number(m.at))})`)
  }
} catch (e) { console.log('  رجیستری:', e.message) }

// ۴) ممیزیِ آگهی (moderation ML)
try {
  const { mlStats } = await import('../app/lib/moderation-ml.ts')
  const s = mlStats()
  console.log('\n── ممیزیِ آگهی (moderation ML) ──')
  console.log('  ' + JSON.stringify(s).slice(0, 300))
} catch (e) { console.log('  moderation-ml:', e.message) }

// ۵) لِکسیکونِ اسمِ مشاورِ آژانس (همان چیزی که این چند روز کار کردیم)
try {
  const { mlStats, knownNames } = await import('../app/lib/agency-roster-ml.ts')
  const s = await mlStats(); const trusted = (await knownNames(2)).length
  console.log('\n── لِکسیکونِ نامِ مشاورِ آژانس ──')
  console.log(`  یادگرفته: ${s.learned} (ادمین ${s.byAdmin} / AI ${s.byAi}) ، مورد اعتماد(≥۲): ${trusted} ، منفی: ${s.negatives}`)
} catch (e) { console.log('  agency-roster-ml:', e.message) }

// ۶) دروازهٔ ML (اول‌ماشین‌لرنینگ) — سهمِ هر کار که بدونِ AI حل شده
try {
  const { gatewayStats, gatewayCacheSize } = await import('../app/lib/ml-gateway.ts')
  const gs = await gatewayStats()
  const tasks = Object.entries(gs)
  console.log('\n── دروازهٔ «اول ماشین‌لرنینگ» (سهمِ بدونِ AI) ──')
  if (!tasks.length) console.log('  (هنوز هیچ کاری از دروازه رد نشده)')
  for (const [t, s] of tasks) console.log(`  • ${t}: ML ${s.mlPct}٪ (کش ${s.cache} / مدل ${s.model} / AI ${s.ai}) از ${s.total}`)
  console.log(`  اندازهٔ کش: ${await gatewayCacheSize()} ورودی`)
} catch (e) { console.log('  ml-gateway:', e.message) }

console.log('\n════════════════════════════════════════════════════════════════')
process.exit(0)
