// ── پروبِ نام‌گذاریِ یک آگهیِ مشخص با «کدِ زندهٔ سرور» (فقط‌خواندنی) ─────────────────
// چرا: کاربر سینک زد ولی هنوز نامِ غلط می‌بیند. این اسکریپت دقیقاً می‌گوید کدِ همین‌لحظهٔ
// سرور روی «همان آگهیِ واقعی» چه نامی درمی‌آورد — تا بفهمیم فیکس دیپلوی شده یا نه، و آیا
// سینک باید دوباره زده شود. «عینِ تولید» مدل‌ها prime می‌شوند.
//
// اجرا:
//   cd /var/www/melkjet/melkjet-nextjs && set -a && . ./.env.production.local && set +a
//   node --import ./scripts/reos-loader.mjs scripts/roster-name-probe.mjs gaBHwqM_ [نامِ آژانس]

import { execSync } from 'child_process'
try { console.log('کدِ دیپلوی‌شده (HEAD):', execSync('git -c safe.directory=/var/www/melkjet rev-parse --short HEAD', { cwd: '/var/www/melkjet/melkjet-nextjs' }).toString().trim()) } catch { /* بی‌اهمیت */ }

const token = (process.argv[2] || '').trim()
const agency = (process.argv[3] || 'آژانس شاهان').trim()
if (!token) { console.log('استفاده: scripts/roster-name-probe.mjs <token> [نامِ آژانس]'); process.exit(1) }

const { fetchDivarPost } = await import('../app/lib/divar-post.ts')
const { extractSignature } = await import('../app/lib/agency-roster.ts')
const ner = await import('../app/lib/roster-ner.ts')
const { primeNameModel } = await import('../app/lib/roster-name-model.ts')
const primed = await primeNameModel().catch(() => false)
const nerLoaded = !!(await ner.loadNer().catch(() => null))
console.log(`مدل‌ها: nameProb=${primed ? '✓' : '✗'} · NER=${nerLoaded ? '✓' : '✗'}`)
console.log(`gazetteerName موجود است؟ ${typeof ner.gazetteerName === 'function' ? '✓ (فیکسِ ۲۹۸ل/م دیپلوی شده)' : '✗ (کدِ قدیمی — هنوز دیپلوی نشده!)'}`)

let title = '', desc = ''
try { const d = await fetchDivarPost(token); title = (d.title || '').trim(); desc = (d.description || '').trim() }
catch (e) { console.log('✗ واکشیِ آگهی از دیوار شکست:', String(e?.message || e).slice(0, 100)); process.exit(1) }

console.log('\n── ۸ خطِ آخرِ توضیحات ──')
console.log(desc.split('\n').map(l => l.trim()).filter(Boolean).slice(-8).map(l => '  │ ' + l).join('\n'))

console.log('\n── نتیجهٔ کدِ زنده ──')
if (typeof ner.gazetteerName === 'function') console.log('  gazetteerName :', JSON.stringify(ner.gazetteerName(desc)))
console.log('  labeledName   :', JSON.stringify(ner.labeledName(desc)))
console.log('  selfIntroName :', JSON.stringify(ner.selfIntroName(desc)))
const bn = ner.bestName(title, desc)
console.log('  bestName      :', bn ? `${JSON.stringify(bn.name)} @ p=${bn.p}` : 'null')
const sig = extractSignature(title, desc, agency)
console.log('  extractSignature (نامِ نهایی) →', JSON.stringify(sig))
console.log(`\n⇒ در سینکِ بعدی این آگهی «${sig[0] || '(بی‌نام)'}» نام می‌گیرد` +
  (sig[0] ? '' : ' — اگر اینجا اسمِ درست دیدی ولی در پنل نه، یعنی آن خوشه graduate شده (پین) و باید دستی ویرایش شود.'))
