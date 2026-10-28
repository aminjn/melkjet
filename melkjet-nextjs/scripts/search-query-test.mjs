// فاز د — تستِ search-query (محدودهٔ نقشه + امضای جستجوی ذخیره‌شده + هم‌زبانیِ هشدار با فهرست).
// اجرا: node --import ./scripts/reos-loader.mjs scripts/search-query-test.mjs
import { parsePoly, encodePoly, pointInPoly, canonSpecQs, specFromParams, matchesSpec, specLabel, specToSearchHref, hoodMatch } from '../app/lib/search-query.ts'
import { deriveListing } from '../app/lib/listing-search.ts'
let pass = 0, fail = 0
const t = (name, ok) => { if (ok) pass++; else fail++; console.log(`${ok ? '✓' : '✗'} ${name}`) }

const sq = [{ lat: 35.70, lng: 51.30 }, { lat: 35.70, lng: 51.40 }, { lat: 35.80, lng: 51.40 }, { lat: 35.80, lng: 51.30 }]
t('نقطهٔ داخلِ مربع', pointInPoly(35.75, 51.35, sq))
t('نقطهٔ بیرونِ مربع', !pointInPoly(35.85, 51.35, sq))
const L = [{ lat: 0, lng: 0 }, { lat: 0, lng: 4 }, { lat: 1, lng: 4 }, { lat: 1, lng: 1 }, { lat: 4, lng: 1 }, { lat: 4, lng: 0 }]
t('چندضلعیِ مقعر (L): گوشهٔ خالی بیرون است', !pointInPoly(3, 3, L) && pointInPoly(3, 0.5, L))
t('parse/encode رفت‌وبرگشت', JSON.stringify(parsePoly(encodePoly(sq))) === JSON.stringify(sq))
t('parse: کمتر از ۳ رأس → null', parsePoly('35.7,51.3;35.8,51.4') === null)
t('parse: مختصاتِ نامعتبر حذف', parsePoly('35.7,51.3;abc;35.8,51.4;35.9,51.5').length === 3)
const many = Array.from({ length: 200 }, (_, i) => ({ lat: 35.7 + Math.sin(i / 32) * 0.1, lng: 51.3 + Math.cos(i / 32) * 0.1 }))
t('encode: حداکثر ۴۰ رأس', encodePoly(many).split(';').length === 40)

const a = canonSpecQs(new URLSearchParams('kind=آپارتمان&deal=sale&city=شهر تهران&sort=x&bbox=1,2,3,4'))
const b = canonSpecQs(new URLSearchParams('city=تهران&kind=آپارتمان'))
t('امضا: ترتیب/شهرِ «شهر تهران»/deal پیش‌فرض/کلیدهای غیرمعنادار → یکسان', a === b)
t('امضا: فیلترِ متفاوت → متفاوت', a !== canonSpecQs(new URLSearchParams('city=تهران&kind=آپارتمان&beds=2')))

const mk = (o) => deriveListing({ id: o.id || 'x', title: o.title || 'آپارتمان ۸۰ متری ۲ خوابه', price: o.price || '۵ میلیارد', location: o.location || 'ونک، تهران', meta: o.meta || { 'متراژ': '۸۰', 'اتاق': '۲' }, category: 'آپارتمان' })
const spec = specFromParams(new URLSearchParams('deal=sale&city=تهران&hood=ونک&kind=آپارتمان&pmax=8'))
t('matchesSpec: مطابق', matchesSpec(mk({}), spec))
t('matchesSpec: محلهٔ دیگر رد', !matchesSpec(mk({ location: 'پونک، تهران' }), spec))
t('matchesSpec: شهرِ دیگر رد', !matchesSpec(mk({ location: 'ونک، مشهد' }), spec))
t('matchesSpec: بالای سقفِ قیمت رد', !matchesSpec(mk({ price: '۱۲ میلیارد' }), spec))
t('hoodMatch دوسویه: «جنت‌آباد» ⇄ «جنت آباد شمالی»', hoodMatch('جنت آباد شمالی، تهران', 'جنت‌آباد') && hoodMatch('جنت‌آباد، تهران', 'جنت آباد شمالی', 'تهران'))
t('hoodMatch: «ونک» پونک را نمی‌گیرد', !hoodMatch('پونک، تهران', 'ونک', 'تهران'))
t('hoodMatch: «تهران نو» کلِ تهران را نمی‌بلعد', !hoodMatch('ونک، تهران', 'تهران نو', 'تهران') && hoodMatch('تهران نو، تهران', 'تهران نو', 'تهران'))

const lbl = specLabel(new URLSearchParams('deal=rent&city=تهران&hood=ونک&kind=آپارتمان&pmax=5&beds=2'))
t('برچسب: نوع/معامله/مکان/قیمت/خواب', /آپارتمان/.test(lbl) && /اجاره/.test(lbl) && /ونک، تهران/.test(lbl) && /تا ۵ میلیارد/.test(lbl) && /۲|2/.test(lbl))
t('برچسب: محدودهٔ رسم‌شده', /محدودهٔ رسم‌شده/.test(specLabel(new URLSearchParams('poly=' + encodePoly(sq)))))
t('لینک: deal→type، sale حذف', specToSearchHref('deal=rent&city=تهران') === '/search?type=rent&city=' + encodeURIComponent('تهران') && specToSearchHref('deal=sale&kind=x') === '/search?kind=x')

console.log(`\n${pass} پاس، ${fail} شکست`)
process.exit(fail ? 1 : 0)
