// فاز ۳۴۴ — پورتِ مسیرِ نام‌یابیِ رُستر از خودروجت (فاز ۳۴۷–۳۵۲). نمونهٔ مرجعِ خودروجت (کارنو) عیناً + نمونه‌های ملکی.
// کارنو: دیوار «⭕️____کارشناس خانم اسماعیلی____⭕️» دارد، ولی متنی که به AI رفته بود «انتشار آگهی / آخرین نردبان» بود
// و ماشین «تیوفایو» را از عنوان برمی‌داشت.
// Run: node --import ./scripts/reos-loader.mjs scripts/roster-karno-344-test.mjs
import { extractSignature, signatureTrusted, gateAiName, buildAgencyRoster } from '../app/lib/agency-roster.ts'
import { gazetteerName } from '../app/lib/roster-ner.ts'
import { isDivarMetaText } from '../app/lib/divar-text.ts'
import { divarDescriptionWidget, parseDivarPostBody } from '../app/lib/divar-post.ts'
const { saveAdminData, getAdminData } = await import('../app/lib/admin-store.ts')

let pass = 0, fail = 0
const ok = (n, c) => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗', n) } }

const T = 'رانا(تیوفایو)TU5 تحویل فوری', AG = 'کارنو خودرو'
const D = 'کارنو خودرو\n\nنمایندگی تحت نظراتحادیه و اصناف خودرو\n\n✅کد رسمی اصناف ۱۵۵۶✅\n✅کد رسمی نمایندگی۶۶۶۴۱۳ ✅\n\n⭕️____کارشناس خانم اسماعیلی____⭕️\n\n✅نماینده رسمی فروش محصولات\n\nمدیران خودرو/کرمان موتور/سایپا/ایرانخودرو/بهمن موتور\n\n✅فروش نقدی ✅\n✅با ۱۸ سال سابقه درخشان فروش درغرب تهران\n✅تحویل درب منزل به درخواست مشتری\n✅ امکان رویت وکارشناسی قبل ازتسویه مبلغ خودرو'
const M = 'انتشار آگهی: ۱۱ آذر ۱۴۰۴، ۱۲:۴۳\nآخرین نردبان: ۷ آبان ۱۴۰۵، ۱۱:۵۷'

console.log('── متادیتای انتشار ──')
ok('«انتشار آگهی / آخرین نردبان» متادیتاست', isDivarMetaText(M))
ok('برچسبِ ناشناخته + تاریخ/زمانِ نسبی هم متادیتاست', isDivarMetaText('آخرین بازدید: ۳ روز پیش') && isDivarMetaText('نردبان شده: دیروز، ۱۰:۲۰'))
ok('متنِ واقعی متادیتا نیست', !isDivarMetaText(D) && !isDivarMetaText('تحویل: فوری') && !isDivarMetaText('قیمت: ۲ میلیارد'))

console.log('── خوانشِ توضیحات از ویجت ──')
const post = (descType = 'DESCRIPTION_ROW', text = D, title = T) => ({ sections: [
  { section_name: 'TITLE', widgets: [{ widget_type: 'LEGEND_TITLE_ROW', data: { title, subtitle: 'دقایقی پیش در تهران، صادقیه' } }, { widget_type: 'DESCRIPTION_ROW', data: { text: M } }] },
  { section_name: 'DESCRIPTION', widgets: [{ widget_type: 'TITLE_ROW', data: { title: 'توضیحات' } }, { widget_type: descType, data: { text } }] },
  { section_name: 'SUGGESTION', widgets: [{ widget_type: 'POST_ROW', data: { token: 'gaOTHER1', title: 'آگهیِ دیگر', description: 'متنِ بلندِ یک آگهیِ دیگرِ همین کسب‌وکار که هرگز نباید توضیحاتِ این آگهی شود؛ کارشناس فروش آقای هوشمند در خدمت شماست و این متن عمداً بلندتر است.' } }] },
] })
ok('توضیحات = متنِ فروشنده، نه «آخرین نردبان»', divarDescriptionWidget(post()) === D)
ok('ویجتِ متنِ بخشِ DESCRIPTION با نوعِ دیگر هم خوانده می‌شود', divarDescriptionWidget(post('EXPANDABLE_TEXT_ROW')) === D)
const parsed = parseDivarPostBody('QaueoySK', JSON.stringify(post()))
ok('پارسِ کامل: description = متنِ کارنو، عنوان = عنوانِ خودِ آگهی', parsed.description === D && parsed.title === T)
const short = parseDivarPostBody('gaSHORT1', JSON.stringify(post('DESCRIPTION_ROW', 'نوساز، تک واحدی')))
ok('آگهیِ کوتاه: متنِ «آگهیِ دیگر» (بلندتر) برداشته نمی‌شود', short.description === 'نوساز، تک واحدی')
const metaOnly = parseDivarPostBody('gaMETA01', JSON.stringify({ sections: [{ section_name: 'TITLE', widgets: [{ widget_type: 'LEGEND_TITLE_ROW', data: { title: T } }, { widget_type: 'DESCRIPTION_ROW', data: { text: M } }] }] }))
ok('آگهی‌ای که فقط متادیتا دارد ⇒ توضیحاتِ خالی', !metaOnly.description)

console.log('── نام (کارنو) ──')
ok('بی‌متن (فقط عنوان) ⇒ هیچ نامی؛ «تیوفایو»ِ عنوان نام نیست', extractSignature(T, '', AG).length === 0)
ok('فقط متادیتا ⇒ هیچ نامی', extractSignature(T, M, AG).length === 0)
ok('با متن ⇒ «اسماعیلی»', extractSignature(T, D, AG)[0] === 'اسماعیلی')
ok('امضای صریح (لقب + نام) ⇒ قطعی، بی‌نیاز به AI', signatureTrusted(T, D, AG))
ok('جوابِ درستِ AI با زیرخط‌های چسبیده رد نمی‌شود', gateAiName('اسماعیلی', D, new Set()) === 'اسماعیلی')
ok('«نماینده رسمی فروش محصولات» ⇒ نام نیست (اسمِ جمع)', gazetteerName('متن\nنماینده رسمی فروش محصولات') === null)
ok('ضدتست: «کارشناس فروش بیات» هنوز امضاست', gazetteerName('متن\nکارشناس فروش بیات') === 'بیات')
ok('لقب + نام بر «خطِ نقش + یک واژه»ِ پایین‌ترش مقدم است', gazetteerName('سلام\nکارشناس خانم اسماعیلی\nمشاور فروش بیات') === 'اسماعیلی')
ok('ضدتست: نامِ امضاشده در خودِ عنوان پذیرفته است', extractSignature('آپارتمان ۹۰ متری کارشناس خانم احمدی', 'نوساز فول امکانات', AG).includes('احمدی'))
ok('«…زاده/ستوده» دیگر «نامِ مکان» نیست', gazetteerName('نوساز\nکارشناس خانم ستوده') === 'ستوده' && gazetteerName('نوساز\nمشاور فروش علیزاده') === 'علیزاده')

console.log('── نمونهٔ ملکی ──')
const TM = '۱۶۵ متر / شمس آباد / فقط امروز ۵۵.۵ م / تک واحدی', AGM = 'املاک شهاب'
const DM = 'فروش آپارتمان ۱۶۵ متری در شمس‌آباد، میدان بهشتی\nتک واحدی، نوساز، سند تک برگ\nوضعیت سند: تعاونی\nسیستم سرمایش: فن کوئل\n\n⭕️____مشاور فروش آقای کاظمی____⭕️\n✅ خدمات املاک شهاب\n✅ کارشناسی رایگان قیمت'
ok('ملکی: «کاظمی» از امضا (نه «شمس»ِ عنوان، نه «تعاونی/فن کوئل»)', extractSignature(TM, DM, AGM)[0] === 'کاظمی')
ok('ملکی: امضای صریح ⇒ قطعی', signatureTrusted(TM, DM, AGM))
ok('ملکی: نامِ AI «شمس» (فقط در عنوان و پیش از «آباد») رد', gateAiName('شمس', DM, new Set()) === '' || !extractSignature(TM, DM, AGM).includes('شمس'))
ok('ملکی: «کلید هوشمند» ⇒ «هوشمند» نام نیست (وسطِ جمله)', gateAiName('هوشمند', 'آپارتمان نوساز\nکلید هوشمند، آیفون تصویری', new Set()) === '')
ok('ملکی: «جهت بازدید هماهنگی با آقای رادمهر» ⇒ «رادمهر»', gateAiName('رادمهر', 'نوساز\nجهت بازدید هماهنگی با آقای رادمهر', new Set()) === 'رادمهر')
ok('ملکی: بی‌امضا ⇒ هیچ نامی', extractSignature('آپارتمان ۸۰ متری', 'نوساز\nجهت کسب اطلاعات بیشتر و هماهنگی بازدید تماس بگیرید', AGM).length === 0)

console.log('── چرخهٔ کاملِ رُستر (AI تک‌آگهی، امضای قطعی بی‌AI، متادیتا) ──')
const SNAP = JSON.parse(JSON.stringify(getAdminData()))
process.on('exit', () => { try { saveAdminData(SNAP) } catch {} })
saveAdminData({ email: 'x', passwordHash: 'x', gapgpt: { baseUrl: 'http://127.0.0.1:1/v1', apiKey: 'k' }, agentModels: { roster: { text: 'm' } }, aiEnabled: true, aiAreas: { roster: true } })
const toks = ['k0', 'k1', 'k2', 'k3', 'k4', 'k5']
const texts = { k0: DM, k1: DM, k2: 'نوساز\nجهت بازدید هماهنگی با رادمهر ۰۹۱۲۱۲۳۴۵۶۷', k3: 'نوساز\nجهت بازدید هماهنگی با رادمهر ۰۹۱۲۱۲۳۴۵۶۷', k4: M, k5: 'نوساز\nکلید هوشمند، آیفون تصویری\nپارکینگ و انباری\nآسانسور\nلابی\nجهت بازدید تماس بگیرید' }
const asked = []
const r = await buildAgencyRoster('s344', { useAI: true, f: {
  profileTokens: async () => ({ posts: toks.map(t => ({ token: t, title: TM })), name: AGM, reason: '' }),
  post: async (t) => ({ title: TM, description: texts[t], images: [] }),
  ai: async (ch) => {
    asked.push(...ch.map(it => it.i))
    const m = {}
    for (const it of ch) m[it.i] = /رادمهر/.test(it.desc) ? 'رادمهر' : /هوشمند/.test(it.desc) ? 'هوشمند' : 'شمس'
    return { map: m, raw: '', answered: ch.map(it => it.i) }
  },
} })
const st = r.nameStats || {}
ok('آگهی‌های امضای قطعی (کاظمی) به AI نرفتند', !asked.includes(0) && !asked.includes(1) && st.skippedSig === 2)
ok('AI آگهی‌به‌آگهی پرسیده شد (هر درخواست یک آگهی)', asked.length === 3)
ok('«کاظمی» (امضا) با ۲ فایل، منبع = امضا', r.advisors.some(a => a.name === 'کاظمی' && a.tokens.length === 2 && a.src?.sig === 2))
ok('«رادمهر» (AI در موضعِ امضا، کنارِ شماره) با ۲ فایل، منبع = AI', r.advisors.some(a => a.name === 'رادمهر' && a.tokens.length === 2 && a.src?.ai === 2))
ok('«هوشمند» (AI، وسطِ جمله) رد شد', !r.advisors.some(a => a.name === 'هوشمند') && st.aiRejected >= 1)
ok('آگهیِ فقط-متادیتا بی‌نام ماند و شمرده شد', r.unnamed.tokens.includes('k4') && st.metaText === 1)
ok('هیچ «شمس»ی ساخته نشد', !r.advisors.some(a => /شمس/.test(a.name)))
ok('آمار: AI روشن با مدلِ RosterAgent', st.aiOn === true && st.model === 'm')

console.log('── باگِ خودروجت: متنِ خوانده‌نشده + فهرستِ سفیدِ «با نقش» ──')
const { sanitizeWhitelistName } = await import('../app/lib/agency-name-lexicon.ts')
ok('فهرستِ سفید: «کارشناس خانم اسماعیلی» ⇒ «اسماعیلی»', sanitizeWhitelistName('کارشناس خانم اسماعیلی') === 'اسماعیلی')
ok('فهرستِ سفید: «⭕️ مشاور فروش: آقای علی رضایی» ⇒ «علی رضایی»', sanitizeWhitelistName('⭕️ مشاور فروش: آقای علی رضایی') === 'علی رضایی')
ok('فهرستِ سفید: فقط نقش/لقب ⇒ خالی (ذخیره نمی‌شود)', sanitizeWhitelistName('کارشناس فروش خانم') === '')
// خواندنِ متن: بارِ اول دیوار ۴۲۹ می‌دهد، تلاشِ دوباره در همان سینک موفق است
let calls = 0
const flaky = {}
const r2 = await buildAgencyRoster('s344b', { useAI: false, f: {
  profileTokens: async () => ({ posts: ['f0', 'f1'].map(t => ({ token: t, title: 'آپارتمان' })), name: AGM, reason: '' }),
  post: async (t) => { calls++; flaky[t] = (flaky[t] || 0) + 1; return flaky[t] === 1 && t === 'f1' ? { images: [], facts: [], amenities: [], reason: 'http_429' } : { title: 'آپارتمان', description: 'نوساز\nکارشناس خانم اسماعیلی', images: [] } },
} })
ok('متنی که بارِ اول خوانده نشد، در همان سینک دوباره خوانده شد (نامش آمد)', r2.advisors.some(a => a.name === 'اسماعیلی' && a.tokens.length === 2) && r2.nameStats.textMissing === 0 && flaky.f1 === 2)
const r3 = await buildAgencyRoster('s344c', { useAI: false, f: {
  profileTokens: async () => ({ posts: [{ token: 'g0', title: 'آپارتمان' }], name: AGM, reason: '' }),
  post: async () => ({ images: [], facts: [], amenities: [], reason: 'unreachable' }),
} })
ok('متنی که هرگز خوانده نشد ⇒ در آمار (textMissing) دیده می‌شود، نه بی‌صدا', r3.nameStats.textMissing === 1 && r3.unnamed.tokens.length === 1)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
