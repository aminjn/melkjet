#!/usr/bin/env node
// فاز ۳۴۶ — بازنویسی: نامِ مشاور «فقط» با AI (قراردادِ تازه در بدنه). سرتیترِ زیر تاریخچهٔ فاز ۳۲۳ب است.
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
const { buildAgencyRoster, AI_PROMPT_V, AI_OFF_ERROR, AI_INCOMPLETE_ERROR } = await import('../app/lib/agency-roster.ts')
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

// ── فاز ۳۴۶ — «فقط AI تشخیص بدهد» (دستورِ صریحِ مالک). قاعده/ماشین/فهرستِ سفید در تصمیم نیستند. ──
saveAdminData({ ...base, aiEnabled: true, aiAreas: { roster: true } })
// ۱: AI برای همه «بی‌امضا» ⇒ هیچ مشاوری؛ حدسِ ماشین («نقی» از «کارشناس فروش جهت راهنمایی نقی») جای خالی را پر نمی‌کند
const r1 = await buildAgencyRoster('s1', { useAI: true, f: mkF(async (ch) => ({ map: {}, raw: '[]', answered: ch.map(it => it.i) })) })
ok('AI می‌گوید بی‌امضا ⇒ ماشین جای خالی را پر نمی‌کند (۰ مشاور، ۸ بی‌نام)', r1.ok && r1.advisors.length === 0 && r1.unnamed.tokens.length === 8)
// ۲: نامِ AI می‌آید
const mk2 = (aiFn) => ({ ...mkF(aiFn), post: async (t) => { const i = tokens.indexOf(t); return { title: 'آپارتمان ' + t, description: i < 4 ? 'نوساز، کارشناس فروش جهت راهنمایی نقی' : 'نوساز فول امکانات\nبا تشکر رضایی', images: [] } } })
const r2 = await buildAgencyRoster('s2', { useAI: true, f: mk2(async (ch) => { const m = {}; for (const it of ch) if (it.i >= 4) m[it.i] = 'رضایی'; return { map: m, raw: '', answered: ch.map(it => it.i) } }) })
ok('نامِ AI («رضایی» ۴) می‌آید؛ «نقی»ِ ماشین نه', r2.advisors.some(a => a.name === 'رضایی' && a.tokens.length === 4 && a.src?.ai === 4) && !r2.advisors.some(a => a.name === 'نقی'))
// ۳: «همهٔ» آگهی‌های دارای متن به AI می‌روند — امضای صریح دیگر از AI معاف نیست
const asked3 = []
await buildAgencyRoster('s3', { useAI: true, f: mk2(async (ch) => { asked3.push(...ch.map(it => it.i)); return { map: {}, raw: '', answered: ch.map(it => it.i) } }) })
ok('همهٔ ۸ آگهی (یکی‌یکی) به AI رفتند', asked3.length === 8)
// ۴: AI خاموش ⇒ سینک با خطای روشن می‌ایستد؛ هیچ نامی از ماشین ساخته نمی‌شود (فهرستِ فعلی دست‌نخورده می‌ماند)
saveAdminData({ ...base, aiEnabled: false })
const r4 = await buildAgencyRoster('s4', { useAI: true, f: { ...mkF(undefined), ai: undefined } })
ok('AI خاموش ⇒ خطای «AI خاموش»، صفر مشاورِ ماشینی', !r4.ok && r4.error === AI_OFF_ERROR && r4.advisors.length === 0)
saveAdminData({ ...base, aiEnabled: true, aiAreas: { roster: true } })
const r4b = await buildAgencyRoster('s4b', { useAI: false, f: mkF(async () => ({ map: {}, raw: '' })) })
ok('AIِ این آژانس خاموش (useAI=false) ⇒ همان خطا', !r4b.ok && r4b.error === AI_OFF_ERROR)
// ۵: ضدِ توهم — نامی که در متن نیست («شمس» فقط در عنوان) پذیرفته نمی‌شود و شمرده می‌شود
const shamsF = (aiFn, desc) => ({
  profileTokens: async () => ({ posts: tokens.map(t => ({ token: t, title: '۱۶۵ متر / شمس آباد / تک واحدی' })), name: 'املاک شهاب', reason: '' }),
  post: async () => ({ title: '۱۶۵ متر / شمس آباد / تک واحدی', description: desc, images: [] }),
  ai: aiFn,
})
const sayShams = async (ch) => ({ map: Object.fromEntries(ch.map(it => [it.i, 'شمس'])), raw: '', answered: ch.map(it => it.i) })
const r5 = await buildAgencyRoster('s5', { useAI: true, f: shamsF(sayShams, 'فروش آپارتمان ۱۶۵ متری\nسه خواب، نوساز\nجهت بازدید تماس بگیرید') })
ok('AI «شمس» می‌گوید ولی در متن نیست ⇒ رد (ضدِ توهم)', !r5.advisors.some(a => a.name === 'شمس') && r5.nameStats.aiRejected === 8)
// ۶: AI همه را نخوانده (پاسخِ خراب) ⇒ فهرست بازنویسی نمی‌شود، خطای «ادامه در پاسِ بعد»
const r6 = await buildAgencyRoster('s6', { useAI: true, f: mkF(async () => ({ map: {}, raw: 'xx', answered: [] })) })
ok('AI جواب نداد ⇒ AI_INCOMPLETE (بازنویسی نمی‌شود) + پیشرفت', !r6.ok && r6.error === AI_INCOMPLETE_ERROR && r6.aiProgress?.asked === 0 && r6.aiProgress?.total === 8)
// ۷: جوابِ کش‌شدهٔ نسخهٔ فعلی دوباره پرسیده نمی‌شود؛ بی‌نسخه دوباره
const asked7 = []
const cached = Object.fromEntries(tokens.map((t, i) => [t, { title: 'آپارتمان ' + t, desc: 'نوساز', name: '', ...(i < 4 ? { aiv: AI_PROMPT_V } : {}) }]))
await buildAgencyRoster('s7', { useAI: true, cached, f: mkF(async (ch) => { asked7.push(...ch.map(it => it.i)); return { map: {}, raw: '[]', answered: ch.map(it => it.i) } }) })
ok('جوابِ بی‌نسخه دوباره پرسیده شد، جوابِ نسخهٔ فعلی نه', asked7.sort().join(',') === '4,5,6,7')
// ۸: نمونهٔ اسکرین‌شاتِ مالک — «سند آزاد» / «با صداقت» / «تماس یا پیام»: اگر AI نگوید، هیچ‌کدام مشاور نمی‌شوند،
// حتی وقتی همین واژه‌ها در فهرستِ سفید باشند (فهرستِ سفید دیگر در تصمیم نیست).
const { setNameRuleCache, keyOf } = await import('../app/lib/agency-name-lexicon.ts')
setNameRuleCache(new Set(), new Set(['آزاد', 'پیام', 'صداقت'].map(keyOf)), ['آزاد', 'پیام', 'صداقت'])
const liveDesc = 'آپارتمان ۱۲۰ متری\nسند آزاد شش دانگ\nبا صداقت در خدمت شما هستیم\nجهت هماهنگی تماس یا پیام'
const r8 = await buildAgencyRoster('s8', { useAI: true, f: { ...mkF(async (ch) => ({ map: {}, raw: '[]', answered: ch.map(it => it.i) })), post: async (t) => ({ title: 'آپارتمان ' + t, description: liveDesc, images: [] }) } })
ok('«آزاد/صداقت/پیام» (حتی در فهرستِ سفید) بدونِ حکمِ AI مشاور نمی‌شوند', r8.ok && r8.advisors.length === 0)
setNameRuleCache(new Set(), new Set(), [])

restore()
console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} پاس · ${fail} خطا\n`)
process.exit(fail === 0 ? 0 : 1)
