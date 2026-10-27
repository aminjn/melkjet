#!/usr/bin/env node
// ── پاک‌سازیِ نامِ مشاورانِ «ذخیره‌شده»ی روستر با قوانینِ تازه (فاز ۳۳۵/۳۳۶) ───────────
// چرا: فیکسِ نام‌گذاری فقط روی «سینکِ بعدی» اثر می‌کند، پس نام‌های جعلیِ قدیمی (خیابان/محله/
// عدد/شعار) تا سینکِ مجددِ هر آژانس در پنل می‌مانند. این اسکریپت بدونِ انتظار و بدونِ دیوار،
// از RowCache (نام‌های AIِ کش‌شده + heuristicِ تازه) دوباره خوشه‌بندی می‌کند و فقط نامِ نمایشیِ
// خوشه‌های «بدونِ حساب» را تصحیح می‌کند: خوشهٔ خیابانی («خوش/جیحون/سپه/طوس») حذف، و
// «خوش هاشمی»→«هاشمی» rename. مشاورِ دارای حساب (graduate) و در-صفِ ساختِ حساب دست‌نخورده می‌مانند.
//
// نکته: آگهی‌های خوشه‌های حذف‌شده را «سینکِ واقعیِ بعدی» (یا scripts/roster-orphans.mjs --apply)
//       آزاد می‌کند؛ این اسکریپت فقط نامِ پنل را تمیز می‌کند. مدل مثلِ تولید prime می‌شود.
//
// نمایش (dry-run، بدونِ تغییر):
//   cd /var/www/melkjet/melkjet-nextjs
//   sudo -E env "PATH=$PATH" node --import ./scripts/reos-loader.mjs scripts/roster-reclean-names.mjs
// اعمال:
//   … scripts/roster-reclean-names.mjs --apply
// فقط یک آژانس (برای آزمایش): … scripts/roster-reclean-names.mjs --apply --slug=<slug یا id>
import { readFileSync, existsSync } from 'node:fs'

function loadEnv(f) {
  if (!existsSync(f)) return
  for (const l of readFileSync(f, 'utf-8').split('\n')) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if (v.length > 1 && ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'")))) v = v.slice(1, -1)
    if (process.env[m[1]] === undefined) process.env[m[1]] = v
  }
}
loadEnv('.env.production.local'); loadEnv('.env')

const apply = process.argv.includes('--apply')
const onlyArg = (process.argv.find(a => a.startsWith('--slug=')) || '').split('=')[1] || ''

// مدل‌ها را دقیقاً مثلِ شروعِ سینکِ تولید prime کن (وگرنه مسیرِ تصمیم فرق می‌کند).
try { const { primeNameModel } = await import('../app/lib/roster-name-model.ts'); await primeNameModel() } catch (e) { console.error('prime name-model:', String(e?.message || e).slice(0, 120)) }
try { const { loadNer } = await import('../app/lib/roster-ner.ts'); await loadNer() } catch (e) { console.error('loadNer:', String(e?.message || e).slice(0, 120)) }

const store = await import('../app/lib/agency-roster-store.ts')
const all = await store.listScrapes()
const targets = onlyArg ? all.filter(s => s.id === onlyArg || s.slug === onlyArg) : all
console.log(`${targets.length} آژانس بررسی می‌شود${apply ? ' (اعمال)' : ' (فقط نمایش — برای تغییر --apply بزن)'}…\n`)

let totRemoved = 0, totRenamed = 0, skipped = 0, done = 0
for (const s of targets) {
  try {
    const r = await store.recleanNames(s.id, apply)
    done++
    if (!r.ok) { skipped++; continue }
    if (r.removed.length || r.renamed.length) {
      console.log(`▪ ${s.agencyName || s.slug}:`)
      if (r.removed.length) console.log(`   حذف (${r.removed.length}): ${r.removed.slice(0, 20).join('، ')}${r.removed.length > 20 ? ' …' : ''}`)
      if (r.renamed.length) console.log(`   تغییرِ نام (${r.renamed.length}): ${r.renamed.slice(0, 20).map(x => `${x.from}→${x.to}`).join('، ')}${r.renamed.length > 20 ? ' …' : ''}`)
      totRemoved += r.removed.length; totRenamed += r.renamed.length
    }
  } catch (e) { skipped++; console.error(`   خطا در ${s.slug}: ${String(e?.message || e).slice(0, 120)}`) }
  if (done % 20 === 0) console.log(`… ${done}/${targets.length}`)
}
console.log(`\n${apply ? '✅ اعمال شد' : 'نمایشِ خشک'} — حذف: ${totRemoved} خوشهٔ جعلی، تغییرِ نام: ${totRenamed}، رد/بی‌کش: ${skipped}، بررسی‌شده: ${done}.`)
if (!apply) console.log('برای اعمال، دوباره با --apply اجرا کن.')
else console.log('آگهی‌های خوشه‌های حذف‌شده را سینکِ بعدی یا «scripts/roster-orphans.mjs --apply» آزاد می‌کند.')
process.exit(0)
