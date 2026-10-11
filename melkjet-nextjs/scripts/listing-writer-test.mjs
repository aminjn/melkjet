// تستِ نویسندهٔ یادگیرنده: پاک‌سازیِ جمله‌ها (ضدِ جعل/تماس)، یکتایی، و بافتِ واقعیِ پیکره.
import { buildWriterCorpusFrom, __setWriterCorpus, writeDescriptionFromData } from '../app/lib/listing-writer.ts'

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m) } }

// نمونهٔ «توضیحاتِ واقعیِ» آگهی‌ها (شاملِ نثرِ نرمِ خوب + ادعاهای سخت + تماس/نام که باید حذف شوند)
const samples = [
  { type: 'آپارتمان', text: 'واحدی دلباز و دنج با نقشهٔ کاربردی. فضایی آرام و مناسب برای زندگی. جهتِ هماهنگی با آقای رضایی ۰۹۱۲۳۴۵۶۷۸۹ تماس بگیرید. نوساز و فول امکانات.' },
  { type: 'آپارتمان', text: 'محیطی صمیمی و بی‌سروصدا. چیدمانِ منطقی و بدونِ پرتِ فضا. نزدیک مترو و پاساژ. سند تک برگ.' },
  { type: 'آپارتمان', text: 'فضایی روشن و باصفا. مناسبِ سکونتِ خانواده. کفِ تمیز و دیوارهای مرتب. املاکِ بهار.' },
  { type: 'ویلا', text: 'حیاطی سرسبز و دلنشین. محیطی خلوت و رو به آفتاب. ویو ابدی و استخر اختصاصی.' },
  { type: 'آپارتمان', text: 'آپارتمانی تمیز و جمع‌وجور. همسایگیِ محترم و آرام. دسترسیِ راحت به امکاناتِ روزمره.' },
]
const c = buildWriterCorpusFrom(samples)
__setWriterCorpus(c)

// جمله‌های آلوده نباید در پیکره باشند
const all = (c.byType['*'] || []).join(' | ')
ok(c.n >= 6, `corpus sentences: ${c.n}`)
ok(!/۰۹|رضایی|تماس|هماهنگ|مترو|پاساژ|املاک/.test(all), 'PII/contact/place stripped: ' + all.slice(0, 120))
ok(!/نوساز|فول|سند|ویو|استخر/.test(all), 'hard claims stripped')
ok(/دلباز|دنج|آرام|روشن|تمیز|کاربردی|صمیمی/.test(all), 'soft real prose kept')

// برای پیکرهٔ کوچک (زیرِ کف) باید null بدهد — تا روی قالب بیفتد
const small = await writeDescriptionFromData({ deal: 'اجاره', propertyType: 'آپارتمان', area: '85', rooms: '2', hood: 'جنت‌آباد', parking: true })
ok(small === null, 'thin corpus → null (falls back): ' + (small ? 'GOT TEXT' : 'null'))

// حالا پیکرهٔ «بزرگ» بساز (۵۰ جملهٔ یکتا) تا مسیرِ یادگیرنده فعال شود (کفِ ۴۰)
const adjs = ['دلباز', 'دنج', 'آرام', 'روشن', 'تمیز', 'باصفا', 'صمیمی', 'خلوت', 'جمع‌وجور', 'دلنشین']
const tails = ['و نقشهٔ کاربردی', 'و مناسبِ زندگی', 'با همسایگیِ محترم', 'و بی‌سروصدا', 'برای سکونتِ خانواده']
const goodSents = []
for (const a of adjs) for (const t of tails) goodSents.push(`فضایی ${a} ${t}`)
const big = { builtAt: Date.now(), n: goodSents.length, byType: { '*': [...goodSents], 'آپارتمان': [...goodSents] } }
__setWriterCorpus(big)

const f = { deal: 'اجاره', propertyType: 'آپارتمان', area: '85', rooms: '2', floor: '3', hood: 'جنت‌آباد', parking: true, elevator: true, advisorName: 'علی رضایی' }
const outs = new Set()
let usedReal = 0
for (let i = 0; i < 100; i++) { const d = await writeDescriptionFromData(f); outs.add(d); if (goodSents.some(s => d.includes(s))) usedReal++ }
ok(outs.size >= 80, `100 generations → ${outs.size} unique`)
ok(usedReal >= 95, `weaves real corpus sentences: ${usedReal}/100`)
const sample = await writeDescriptionFromData(f)
ok(sample.includes('جنت‌آباد') && sample.includes('پارکینگ'), 'grounded on real facts (loc + amenities)')
ok(!/۰۹|تماس بگیرید ۰|مترو/.test(sample), 'no fabricated specifics')

console.log('\n— نمونهٔ یادگرفته —\n' + sample + '\n')
console.log(`${fail === 0 ? '✅' : '❌'} listing-writer-test: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
