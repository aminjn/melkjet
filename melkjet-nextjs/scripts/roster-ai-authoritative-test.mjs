#!/usr/bin/env node
// فاز ۳۲۳ — «AI (qwen) حرفِ آخر است»: وقتی AIِ نام‌گذاری روشن است و qwen برای یک آگهی نامی نمی‌دهد،
// آن آگهی «بی‌نام (خودِ آژانس)» می‌شود — نه این‌که به حدسِ heuristic/واژه‌نامهٔ آموخته برگردد و
// مشاورِ آشغال بسازد (فیدبکِ مالک: «دری‌وری‌ها را پاک می‌کنم، برمی‌گردند؛ ماشین‌لرنینگ هنوز تو کار هست»).
// با AI خاموش، رفتارِ ML-onlyِ قبلی باید دست‌نخورده بماند.
// اجرا: node --import ./scripts/reos-loader.mjs scripts/roster-ai-authoritative-test.mjs
let pass = 0, fail = 0
const ok = (n, c) => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.log('  ✗ ' + n) } }

const { saveAdminData, getAdminData } = await import('../app/lib/admin-store.ts')
const { buildAgencyRoster } = await import('../app/lib/agency-roster.ts')
const base = { email: 'x', passwordHash: 'x', gapgpt: { baseUrl: 'http://127.0.0.1:1/v1', apiKey: 'k' }, agentModels: { content: { text: 'm' } } }
// اسنپ‌شاتِ ادمینِ واقعی — تا این تست روی سرور هم کانفیگِ AIِ مالک را خراب نکند (در finally برمی‌گردد).
const ADMIN_SNAPSHOT = JSON.parse(JSON.stringify(getAdminData()))
const restore = () => { try { saveAdminData(ADMIN_SNAPSHOT) } catch {} }
process.on('exit', restore)

// ۱۰ آگهی: idx 0-3 امضای heuristicِ واضح («کارشناس فروش جهت راهنمایی نقی»)، بقیه بی‌امضا.
const tokens = Array.from({ length: 10 }, (_, i) => 'ak' + i)
const mkF = (aiFn) => ({
  profileTokens: async () => ({ posts: tokens.map(t => ({ token: t, title: 'آپارتمان ' + t })), name: 'آژانس تست', reason: '' }),
  post: async (t) => { const i = tokens.indexOf(t); return { title: 'آپارتمان ' + t, description: i < 4 ? 'نوساز، کارشناس فروش جهت راهنمایی نقی' : 'نوساز فول امکانات', images: [] } },
  ai: aiFn,
})

// ── حالتِ ۱: AI روشن، qwen برای «همه» خالی می‌دهد (هیچ امضای مشاوری نیست) ──
saveAdminData({ ...base, aiEnabled: true, aiAreas: { roster: true } })
const rEmpty = await buildAgencyRoster('s1', { useAI: true, f: mkF(async () => ({ map: {}, raw: '' })) })
ok('AI روشن + qwen خالی: هیچ مشاوری ساخته نمی‌شود (آشغالِ heuristicِ «نقی» سرکوب شد)', rEmpty.advisors.length === 0 && rEmpty.unnamed.tokens.length === 10)

// ── حالتِ ۲: AI روشن، qwen برای ۶ آگهیِ اول «رضایی» می‌دهد، بقیه خالی ──
const rSome = await buildAgencyRoster('s2', { useAI: true, f: mkF(async (ch) => { const m = {}; for (const it of ch) if (it.i < 6) m[it.i] = 'رضایی'; return { map: m, raw: '' } }) })
ok('AI روشن: فقط نامِ qwen خوشه می‌سازد (رضایی×۶)', rSome.advisors.length === 1 && rSome.advisors[0].name === 'رضایی' && rSome.advisors[0].tokens.length === 6)
ok('AI روشن: بقیه (qwen خالی) بی‌نام می‌مانند، نه خوشهٔ «نقی»ی heuristic', rSome.unnamed.tokens.length === 4 && !rSome.advisors.some(a => a.name === 'نقی'))

// ── حالتِ ۳: AI خاموش → رفتارِ ML-onlyِ قبلی دست‌نخورده: heuristic «نقی» را می‌سازد ──
saveAdminData({ ...base, aiEnabled: false })
const rOff = await buildAgencyRoster('s3', { useAI: true, f: mkF(async () => ({ map: {}, raw: '' })) })
ok('AI خاموش: رفتارِ قبلی حفظ شد — heuristic خوشهٔ «نقی» (۴ فایل) را می‌سازد', rOff.advisors.some(a => a.name === 'نقی' && a.tokens.length === 4))

restore()
console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} پاس · ${fail} خطا\n`)
process.exit(fail === 0 ? 0 : 1)
