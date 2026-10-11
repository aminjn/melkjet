// تستِ نویسندهٔ یادگیرنده (بازنویسیِ ۳۰۱ب — نویسندهٔ منسجم): متنِ روان، گراندشده روی فکت‌ها،
// یکتا، بدونِ ادعای سختِ تأییدنشده (پاسیو/تک‌واحدی/نوساز/سند/ویو)، بدونِ آرتیفکتِ ستاره،
// و نمایشِ درستِ طبقه («۶+» → «به بالا»).
import { buildWriterCorpusFrom, __setWriterCorpus, writeDescriptionFromData } from '../app/lib/listing-writer.ts'

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m) } }

// پیکره فقط برای «رتبه‌بندیِ صفت‌ها» است؛ نمونه‌ها شاملِ نثرِ خوب + ادعای سخت + تماس.
const samples = [
  { text: 'واحدی دلباز و دنج با نقشهٔ کاربردی. فضایی آرام و مناسب برای زندگی. جهتِ هماهنگی با آقای رضایی ۰۹۱۲۳۴۵۶۷۸۹ تماس بگیرید. نوساز و فول امکانات.' },
  { text: 'محیطی صمیمی و روشن. چیدمانِ منطقی و بدونِ پرتِ فضا. نزدیک مترو. سند تک برگ.' },
  { text: 'فضایی روشن و باصفا و تمیز. مناسبِ سکونتِ خانواده. کفِ تمیز و دیوارهای مرتب. املاکِ بهار.' },
  { text: 'آپارتمانی تمیز و جمع‌وجور و دلباز. همسایگیِ محترم و آرام. دسترسیِ راحت.' },
  { text: 'واحدی خوش‌نقشه و نورگیر و دنج، دلنشین و مرتب. مناسبِ سلیقه‌های گوناگون.' },
]
const c = buildWriterCorpusFrom(samples)
__setWriterCorpus(c)
ok(c.n >= 4, `corpus samples counted: ${c.n}`)
ok((c.descCount['دلباز'] || 0) >= 2 && (c.descCount['تمیز'] || 0) >= 2, 'descriptor frequency learned from data')

// پیکرهٔ کوچک هم باید متن بدهد (نویسندهٔ منسجم به پیکرهٔ بزرگ نیاز ندارد)
const thin = await writeDescriptionFromData({ deal: 'اجاره', propertyType: 'آپارتمان', area: '85', rooms: '2', hood: 'جنت‌آباد', parking: true })
ok(typeof thin === 'string' && thin.length > 40, 'coherent text even with thin corpus: ' + (thin ? 'ok' : 'NULL'))

// متنِ کامل روی فکت‌های واقعی
const f = {
  deal: 'فروش', propertyType: 'آپارتمان', area: '95', rooms: '2', floor: '3', totalFloors: '6',
  hood: 'جنت‌آباد', city: 'تهران', parking: true, elevator: true, storage: true,
  age: '۵ سال', advisorName: 'علی رضایی',
}

// یکتایی + نبودِ ادعای سخت/آرتیفکت
const outs = new Set()
let leaked = 0, star = 0, rawFloor = 0, hasLoc = 0, hasAmenity = 0
for (let i = 0; i < 100; i++) {
  const d = await writeDescriptionFromData(f)
  outs.add(d)
  if (/پاسیو|تک[‌ ]?واحدی|نوساز|فول|سند|ویو|استخر|مترو|پاساژ|۰۹/.test(d)) leaked++
  if (/\*/.test(d)) star++
  if (/طبقهٔ?\s*[۰-۹\d]*\+|\+[۰-۹\d]/.test(d)) rawFloor++
  if (d.includes('جنت‌آباد')) hasLoc++
  if (/پارکینگ|آسانسور|انباری/.test(d)) hasAmenity++
}
ok(outs.size >= 70, `100 generations → ${outs.size} unique`)
ok(leaked === 0, `no leaked hard claims (got ${leaked})`)
ok(star === 0, `no asterisk artifact (got ${star})`)
ok(rawFloor === 0, `no raw "+" floor artifact (got ${rawFloor})`)
ok(hasLoc >= 95, `grounded on location (${hasLoc}/100)`)
ok(hasAmenity >= 95, `grounded on amenities (${hasAmenity}/100)`)

// نمایشِ درستِ «۶+» (طبقهٔ ۶ به بالا) و «همکف»
const plus = await writeDescriptionFromData({ ...f, floor: '6+', totalFloors: '' })
ok(/به بالا/.test(plus) && !/\+/.test(plus), 'floor "6+" → "طبقهٔ ۶ به بالا"')
const ground = await writeDescriptionFromData({ ...f, floor: 'همکف' })
ok(/همکف/.test(ground), 'floor "همکف" rendered')

// صفت‌های امن حاضر باشند
const sample = await writeDescriptionFromData(f)
ok(/دلباز|نورگیر|آفتاب‌گیر|دنج|خوش‌نقشه|کاربردی|تمیز|شیک|جمع‌وجور|باصفا|آرام|روشن|صمیمی|مرتب|نقلی|دلنشین/.test(sample), 'uses a safe descriptor')
ok(sample.includes('رضایی'), 'advisor name woven into CTA')

console.log('\n— نمونهٔ یادگرفته —\n' + sample + '\n')
console.log(`${fail === 0 ? '✅' : '❌'} listing-writer-test: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
