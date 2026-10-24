#!/usr/bin/env node
// ── تستِ «واقعیِ» بارگذاریِ مدل با فهرستِ سیاه/سفیدِ فعال ─────────────────────────────
// چرا جدا از reos-test: این تست مدلِ sparse را «در حافظهٔ ماژول» بار می‌کند (SP را عوض می‌کند)
// و اگر در سوئیتِ اصلی باشد تست‌های بعدی را آلوده می‌کند. این‌جا در پروسهٔ خودش اجرا می‌شود.
//
// چه چیزی را ثابت می‌کند (پاسخ به «تستِ واقعیِ بارگذاری، نه ادعا»):
//   ۱. با فهرست فعال، مدل همچنان بار می‌شود (hasSparse()===true). ریشهٔ باگِ قبلی این بود که
//      importِ حلقویِ واژه‌نامه↔roster-name-rules↔db بارگذاریِ مدل را می‌شکست.
//   ۲. با مدلِ بارشده، استخراج از «مسیرِ مدل» می‌رود نه fallbackِ آشغال (آگهیِ بی‌امضا → []).
//   ۳. وایت‌لیستِ مدیریتی مقدم بر مدل است («زروان صیاد» حتی با مدلِ بارشده قطعی برمی‌گردد).
//
// اجرا: node --import ./scripts/reos-loader.mjs scripts/roster-name-rules-model-test.mjs
let pass = 0, fail = 0
const ok = (name, cond) => { if (cond) { pass++; console.log('  ✓ ' + name) } else { fail++; console.log('  ✗ ' + name) } }

const ner = await import('../app/lib/roster-ner.ts')
const lex = await import('../app/lib/agency-name-lexicon.ts')
const { extractSignature } = await import('../app/lib/agency-roster.ts')
const { setNameRules, loadNameRules } = await import('../app/lib/roster-name-rules.ts')
const { rmSync } = await import('node:fs')

console.log('\n── بارگذاریِ مدل با فهرستِ سیاه/سفیدِ فعال ──')

// پیش‌شرط: بدونِ مدل، hasSparse=false.
ok('پیش‌شرط: در آغاز مدل بار نشده', ner.hasSparse() === false)

// مدلِ مصنوعی را «در حافظه» بار می‌کنیم. saveSparse پیش از kvSet مقدار SP را ست می‌کند؛
// kvSet بدونِ DB خطا می‌دهد که catch می‌شود — پس SP می‌مانَد و hasSparse()=true می‌شود.
// وزنِ همه‌منفی ⇒ مدل برای هر توکن «نه‌نام» رأی می‌دهد (ساکت) — تا مسیرِ مدل را از fallback جدا کنیم.
const w = new Float64Array(ner.SPARSE_DIM).fill(-20)
await ner.saveSparse(w, { n: 1 }).catch(() => {})
ok('۱) مدل با فهرست در گراف بار می‌شود (hasSparse=true)', ner.hasSparse() === true)

// با مدلِ بارشده و فهرستِ خالی: آگهیِ بی‌امضا باید [] بدهد (مسیرِ مدلِ ساکت)، نه آشغالِ fallback.
await setNameRules({ blacklist: [], whitelist: [] }); await loadNameRules()
const junk = 'کوچه بسیار آرام و دنج\nخوش نقشه\nطبقه دوم\nفول امکانات'
const outJunk = await extractSignature('۹۲ متر نوساز', junk, 'آژانس تست')
ok('۲) مدلِ بارشده: آگهیِ بی‌امضا نامِ جعلی نمی‌سازد (مسیرِ مدل، نه fallback)', outJunk.length === 0)

// وایت‌لیست مقدم بر مدل: «زروان صیاد» حتی با مدلِ بارشده قطعی برمی‌گردد.
await setNameRules({ blacklist: [], whitelist: ['زروان صیاد'] }); await loadNameRules()
const outWl = await extractSignature('۱۵۰ متر', 'کارگزار ملکی شما : زروان صیاد هستم', 'آژانس خلج')
ok('۳) مدلِ بارشده + وایت‌لیست: «زروان صیاد» قطعی استخراج می‌شود', JSON.stringify(outWl) === JSON.stringify(['زروان صیاد']))
ok('۳ب) فهرست مدل را بار نگه می‌دارد (hasSparse ثابت true)', ner.hasSparse() === true)

// سیاهِ چندکلمه‌ای با مدلِ بارشده هم کار می‌کند.
await setNameRules({ blacklist: ['متریال استفاده'], whitelist: [] }); await loadNameRules()
ok('سیاهِ چندکلمه‌ای با مدلِ بارشده: «متریال استفاده» رد', lex.validName('متریال استفاده', '') === '')

await setNameRules({ blacklist: [], whitelist: [] }); await loadNameRules()
try { rmSync(new URL('../.roster-name-rules.json', import.meta.url), { force: true }) } catch {}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} پاس · ${fail} خطا\n`)
process.exit(fail === 0 ? 0 : 1)
