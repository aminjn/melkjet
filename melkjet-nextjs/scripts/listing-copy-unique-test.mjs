// تستِ یکتایی: با ورودیِ یکسان، متنِ fallback نباید تکراری باشد («هیچ آگهی شبیه هم نباشد»).
import { fallbackDescription, fallbackTitle } from '../app/lib/listing-copy.ts'

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m) } }

const f = { deal: 'اجاره', propertyType: 'آپارتمان', city: 'تهران', hood: 'جنت‌آباد', area: '85', rooms: '2', floor: '3', age: '۱۳۹۵', parking: true, elevator: true, storage: true, price: 'ودیعه ۲۰۰ اجاره ۱۵', advisorName: 'علی رضایی' }

const descs = new Set()
for (let i = 0; i < 200; i++) descs.add(fallbackDescription(f))
ok(descs.size >= 185, `200 descriptions (same input) → ${descs.size} unique (want ≥185)`)

const titles = new Set()
for (let i = 0; i < 80; i++) titles.add(fallbackTitle(f))
ok(titles.size >= 3, `title variants: ${titles.size}`)

// آگهیِ مینیمال (فقط نوع + شهر) هم باید متنوع باشد
const f2 = { deal: 'فروش', propertyType: 'مغازه', city: 'کرج' }
const d2 = new Set()
for (let i = 0; i < 100; i++) d2.add(fallbackDescription(f2))
ok(d2.size >= 50, `minimal listing → ${d2.size} unique of 100`)

// خروجی باید واقعی و چندبندی باشد
const sample = fallbackDescription(f)
ok(sample.includes('\n\n') && sample.length > 60, 'multi-paragraph, non-trivial')
ok(!/ملکِ دلباز و خوش‌نقشه|گزینه‌ای مطمئن و ارزشمند/.test(sample), 'no old cliché phrases')

console.log('\n— نمونه —\n' + sample + '\n')
console.log(`${fail === 0 ? '✅' : '❌'} listing-copy-unique-test: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
