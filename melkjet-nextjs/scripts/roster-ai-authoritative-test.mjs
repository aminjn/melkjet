#!/usr/bin/env node
// فاز ۳۲۳ب — تعادلِ روستر با AIِ مالک روشن:
//  • qwen اولویت دارد، ولی heuristic (استخراجِ امضا) جای خالی را پر می‌کند → پوشش بالا می‌ماند
//    (فیدبک: «qwen خیلی‌ها را بی‌نام کرد و درصد افتاد»).
//  • واژه‌نامهٔ آموختهٔ تاریخی و «یادگیری» با AI روشن خاموش‌اند → آشغالِ قدیمی «چسبان» نمی‌شود
//    (فیدبک: «دری‌وری‌ها را پاک می‌کنم، برمی‌گردند»).
//  • با AI خاموش، رفتارِ ML-onlyِ قبلی کاملاً دست‌نخورده.
// اجرا: node --import ./scripts/reos-loader.mjs scripts/roster-ai-authoritative-test.mjs
let pass = 0, fail = 0
const ok = (n, c) => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.log('  ✗ ' + n) } }

const { saveAdminData, getAdminData } = await import('../app/lib/admin-store.ts')
const { buildAgencyRoster } = await import('../app/lib/agency-roster.ts')
const ADMIN_SNAPSHOT = JSON.parse(JSON.stringify(getAdminData()))
const restore = () => { try { saveAdminData(ADMIN_SNAPSHOT) } catch {} }
process.on('exit', restore)
const base = { email: 'x', passwordHash: 'x', gapgpt: { baseUrl: 'http://127.0.0.1:1/v1', apiKey: 'k' }, agentModels: { content: { text: 'm' } } }

// ۸ آگهی: idx 0-3 امضای واضح («کارشناس فروش جهت راهنمایی نقی» → cand=نقی)، idx 4-7 بی‌امضا (cand=[]).
const tokens = Array.from({ length: 8 }, (_, i) => 'ak' + i)
const mkF = (aiFn) => ({
  profileTokens: async () => ({ posts: tokens.map(t => ({ token: t, title: 'آپارتمان ' + t })), name: 'آژانس تست', reason: '' }),
  post: async (t) => { const i = tokens.indexOf(t); return { title: 'آپارتمان ' + t, description: i < 4 ? 'نوساز، کارشناس فروش جهت راهنمایی نقی' : 'نوساز فول امکانات', images: [] } },
  ai: aiFn,
})
const names = (r) => r.advisors.map(a => ({ n: a.name, c: a.tokens.length }))

// ── ۱: AI روشن + qwen برای همه خالی → heuristic پوشش را حفظ می‌کند («نقی» ۴تایی) ──
saveAdminData({ ...base, aiEnabled: true, aiAreas: { roster: true } })
const r1 = await buildAgencyRoster('s1', { useAI: true, f: mkF(async () => ({ map: {}, raw: '' })) })
ok('AI روشن + qwen خالی: پوشش حفظ شد — heuristic «نقی» (۴) را ساخت', r1.advisors.some(a => a.name === 'نقی' && a.tokens.length === 4))
ok('AI روشن: آگهیِ واقعاً بی‌امضا بی‌نام می‌ماند (cand خالی)', r1.unnamed.tokens.length === 4)

// ── ۲: AI روشن + qwen برای idx 4-7 «رضایی» می‌دهد → qwen جای خالی را پر می‌کند و نامش می‌آید ──
const r2 = await buildAgencyRoster('s2', { useAI: true, f: mkF(async (ch) => { const m = {}; for (const it of ch) if (it.i >= 4) m[it.i] = 'رضایی'; return { map: m, raw: '' } }) })
ok('AI روشن: نامِ qwen («رضایی» ۴) می‌آید', r2.advisors.some(a => a.name === 'رضایی' && a.tokens.length === 4))
// فاز ۳۴۱ — AI همهٔ دسته را خواند و برای idx 0-3 گفت «بی‌امضا» → حدسِ ماشین («نقی») دیگر جای «نه»ِ AI را نمی‌گیرد.
ok('AI روشن: «نه»ِ AI نهایی است — حدسِ heuristic جای خالیِ AI را پر نمی‌کند', !r2.advisors.some(a => a.name === 'نقی') && r2.unnamed.tokens.length === 4)

// ── ۳: AI خاموش → رفتارِ ML-onlyِ قبلی دست‌نخورده ──
saveAdminData({ ...base, aiEnabled: false })
const r3 = await buildAgencyRoster('s3', { useAI: true, f: mkF(async () => ({ map: {}, raw: '' })) })
ok('AI خاموش: رفتارِ قبلی — heuristic خوشهٔ «نقی» (۴) را می‌سازد', r3.advisors.some(a => a.name === 'نقی' && a.tokens.length === 4))

// ── ۴ (فاز ۳۴۱ — نمونهٔ زندهٔ مالک): «وضعیت سند: تعاونی» / «سرمایش: فن کوئل» و AI می‌گوید بی‌امضا ──
saveAdminData({ ...base, aiEnabled: true, aiAreas: { roster: true } })
const live = 'فروش آپارتمان 128 متری | ۳ خواب\n\nمتراژ: ۱۳۱ متر مربع\nتعداد خواب: ۳ خوابه\nطبقه: ۱۰\nسیستم سرمایش: فن کوئل\nسال ساخت: ۱۳۹۳\nوضعیت سند: تعاونی\nقیمت کل: 29 میلیارد تومان\n\nجهت کسب اطلاعات بیشتر و هماهنگی بازدید تماس بگیرید.'
const mkLive = (aiFn) => ({ ...mkF(aiFn), post: async (t) => ({ title: 'آپارتمان ' + t, description: live, images: [] }) })
const r4 = await buildAgencyRoster('s4', { useAI: true, f: mkLive(async (ch) => ({ map: {}, raw: '[]', answered: ch.map(it => it.i) })) })
ok('AI می‌گوید بی‌امضا ← «تعاونی»/«فن کوئل» مشاور نمی‌شوند', r4.advisors.length === 0 && r4.unnamed.tokens.length === 8)
// همان آگهی با AI خاموش (فقط ماشین): مقدارِ «برچسب: مقدار» هم دیگر نام نیست
saveAdminData({ ...base, aiEnabled: false })
const r5 = await buildAgencyRoster('s5', { useAI: true, f: mkLive(async () => ({ map: {}, raw: '' })) })
ok('AI خاموش: «تعاونی»/«فن کوئل»/«کوئل» هم نام نمی‌شوند', !r5.advisors.some(a => /تعاونی|کوئل|فن/.test(a.name)))
const { extractSignature } = await import('../app/lib/agency-roster.ts')
ok('کارشناس فروش: مرادی (برچسبِ نقش) هنوز نام است', extractSignature('آپارتمان', 'نوساز\nوضعیت سند: تعاونی\nکارشناس فروش: مرادی')[0] === 'مرادی')

// ── ۶: نامِ خالیِ کش‌شدهٔ قدیمی (ممکن است تایم‌اوت بوده) دوباره پرسیده می‌شود؛ خالیِ aiv=2 نه ──
saveAdminData({ ...base, aiEnabled: true, aiAreas: { roster: true } })
const asked = []
const cached = Object.fromEntries(tokens.map((t, i) => [t, { title: 'آپارتمان ' + t, desc: 'نوساز', name: '', ...(i < 4 ? { aiv: 2 } : {}) }]))
await buildAgencyRoster('s6', { useAI: true, cached, f: mkF(async (ch) => { asked.push(...ch.map(it => it.i)); return { map: {}, raw: '[]', answered: ch.map(it => it.i) } }) })
ok('خالیِ بی‌نسخه دوباره پرسیده شد، خالیِ aiv=2 نه', asked.sort().join(',') === '4,5,6,7')

restore()
console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} پاس · ${fail} خطا\n`)
process.exit(fail === 0 ? 0 : 1)
