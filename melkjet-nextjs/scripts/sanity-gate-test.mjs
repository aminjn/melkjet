// تستِ گِیتِ منطقِ مقدارِ ممیزی (listingSanityIssues) — آگهیِ چرت نباید سالم شمرده شود.
import { listingSanityIssues } from '../app/lib/moderation.ts'

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m) } }
const mk = (price, meta) => ({ type: 'listing', title: 't', price, meta })

// آگهیِ چرتِ گزارش‌شده: ۵ متر، ودیعهٔ نجومی، سالِ آینده
const bad = mk('ودیعه ۵۰۰,۰۰۰,۰۰۰,۰۰۰,۰۰۰ تومان · اجاره ۵۰,۰۰۰,۰۰۰,۰۰۰ تومان', { 'نوع معامله': 'اجاره', 'متراژ': '۵', 'سن بنا': '۱۴۰۶' })
const bi = listingSanityIssues(bad)
ok(bi.length >= 2, 'garbage flagged: ' + JSON.stringify(bi))
ok(bi.some(x => x.includes('متراژ')), 'metraj flagged')
ok(bi.some(x => x.includes('نجومی')), 'absurd price flagged')
ok(bi.some(x => x.includes('آینده')), 'future year flagged')

// آگهیِ سالمِ عادی — هیچ ایرادی
const good = mk('ودیعه ۲۰۰,۰۰۰,۰۰۰ تومان · اجاره ۱۵,۰۰۰,۰۰۰ تومان', { 'نوع معامله': 'اجاره', 'متراژ': '۸۵', 'سن بنا': '۱۳۹۵' })
ok(listingSanityIssues(good).length === 0, 'healthy rent not flagged: ' + JSON.stringify(listingSanityIssues(good)))

// فروشِ گران ولی معقول (۱۲ میلیارد) — نباید فلگ شود
const sale = mk('۱۲,۰۰۰,۰۰۰,۰۰۰ تومان', { 'نوع معامله': 'فروش', 'متراژ': '۱۲۰', 'سن بنا': '۱۴۰۰' })
ok(listingSanityIssues(sale).length === 0, 'reasonable 12bn sale not flagged: ' + JSON.stringify(listingSanityIssues(sale)))

// استودیوی کوچک ۲۵ متری — نباید فلگ شود (مرزِ ۸ متر)
const studio = mk('۳,۰۰۰,۰۰۰,۰۰۰ تومان', { 'نوع معامله': 'فروش', 'متراژ': '۲۵' })
ok(listingSanityIssues(studio).length === 0, 'small studio not flagged')

// پیش‌فروش با سالِ تحویلِ آینده — سال نباید فلگ شود
const presale = mk('۵,۰۰۰,۰۰۰,۰۰۰ تومان', { 'نوع معامله': 'پیش‌فروش', 'متراژ': '۹۰', 'سن بنا': '۱۴۰۸' })
ok(listingSanityIssues(presale).length === 0, 'presale future year allowed: ' + JSON.stringify(listingSanityIssues(presale)))

console.log(`\n${fail === 0 ? '✅' : '❌'} sanity-gate-test: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
