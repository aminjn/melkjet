#!/usr/bin/env node
// قالبِ قیمت‌ها، و مهم‌تر: عددی که از هر قالب درمی‌آید درست است یا نه.
//
// deriveListing parses the price with one rule:
//
//     rawPrice = parseFloat(all digits of the string)
//     priceNum = /میلیارد/ ? rawPrice : /میلیون/ ? rawPrice/1000 : rawPrice/1e9
//
// It is right for a plain number («۱۹٬۸۰۰٬۰۰۰٬۰۰۰ تومان» → 19.8 میلیارد) and right
// for a single unit word. It is wrong the moment a string carries two magnitudes:
// «۱۹ میلیارد و ۸۰۰ میلیون» strips to 19800 and, because the word میلیارد is
// present, is read as 19,800 میلیارد.
//
// That number is not only the SEO title's «متری» - it is the price filter, the
// market analysis and the originality score. So this counts the formats that
// actually exist in the data and flags every listing whose parsed price per meter
// lands outside anything a human would call plausible.
//
// اجرا:  node --import ./scripts/reos-loader.mjs scripts/price-audit.mjs [--samples N]
import { readFileSync, existsSync } from 'node:fs'

function loadEnv(f) {
  if (!existsSync(f)) return
  for (const l of readFileSync(f, 'utf-8').split('\n')) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (process.env[m[1]] === undefined) process.env[m[1]] = v
  }
}
loadEnv('.env.production.local'); loadEnv('.env')

const si = process.argv.indexOf('--samples')
const NSAMP = si > -1 ? Math.max(1, parseInt(process.argv[si + 1], 10) || 0) : 3

const { listItems } = await import('../app/lib/scraper-store.ts')
const { deriveListing } = await import('../app/lib/listing-search.ts')

const items = await listItems('listing', { publicOnly: true })
if (!items.length) { console.error('هیچ آگهیِ عمومی‌ای خوانده نشد — DATABASE_URL را بررسی کنید.'); process.exit(1) }

// قالبِ متنِ قیمت — فقط از روی خودِ رشته، بدونِ حدس
function shape(p) {
  const s = String(p || '').trim()
  if (!s) return 'خالی'
  if (!/[\d۰-۹]/.test(s)) return 'بدونِ رقم (توافقی و…)'
  const md = /میلیارد/.test(s), mn = /میلیون/.test(s)
  if (md && mn) return 'میلیارد + میلیون (دو مقیاس)'
  if (md) return 'فقط میلیارد'
  if (mn) return 'فقط میلیون'
  if (/هزار/.test(s)) return 'هزار'
  return 'فقط عدد'
}

const byShape = new Map()
for (const it of items) {
  const k = shape(it.price)
  let b = byShape.get(k)
  if (!b) { b = { n: 0, ex: [] }; byShape.set(k, b) }
  b.n++
  if (b.ex.length < NSAMP) b.ex.push(it)
}

console.log('آگهیِ عمومی: ' + items.length)
console.log('')
console.log('— قالبِ متنِ قیمت —')
for (const [k, b] of [...byShape.entries()].sort((a, b) => b[1].n - a[1].n)) {
  console.log('  ' + String(b.n).padStart(6) + '  ' + k)
  for (const it of b.ex) {
    const d = deriveListing(it)
    console.log('          «' + String(it.price || '').slice(0, 46) + '»  →  ' + (Math.round(d.priceNum * 100) / 100) + ' میلیارد')
  }
}

// عددِ پارس‌شده منطقی است؟ فقط فروشیِ دارایِ متراژ سنجیده می‌شود —
// اجاره «ودیعه + اجاره» است و یک عدد نیست، پس متریِ آن معنا ندارد.
const PPM_MIN = 1, PPM_MAX = 3000      // میلیون تومان بر متر
let checked = 0
const absurd = []
for (const it of items) {
  const d = deriveListing(it)
  if (d.deal !== 'sale' || !(d.priceNum > 0) || !(d.areaNum > 0)) continue
  checked++
  const ppm = (d.priceNum * 1e9) / d.areaNum / 1e6
  if (ppm < PPM_MIN || ppm > PPM_MAX) absurd.push({ it, d, ppm })
}
absurd.sort((a, b) => b.ppm - a.ppm)

console.log('')
console.log('— عددِ پارس‌شده (فقط فروشیِ دارایِ متراژ) —')
console.log('  سنجیده: ' + checked)
console.log('  متریِ بی‌معنا (خارج از ' + PPM_MIN + ' تا ' + PPM_MAX + ' میلیون): ' + absurd.length +
            '  ' + (checked ? (Math.round((absurd.length / checked) * 1000) / 10).toFixed(1) + '٪' : '-'))
for (const a of absurd.slice(0, 10)) {
  console.log('    «' + String(a.it.price || '').slice(0, 44) + '»  ' + a.d.areaNum + 'م  →  متری ' + Math.round(a.ppm).toLocaleString('fa-IR') + ' میلیون')
  console.log('      ' + String(a.it.title || '').slice(0, 80))
  // خامِ متا هم چاپ می‌شود تا بدانیم باگِ پارس است یا خودِ داده غلط است —
  // بدونِ این، هر دو یکِسان به نظر می‌رسند.
  console.log('      خام: متراژ=«' + (a.it.meta?.['متراژ'] ?? '—') + '»  نوع معامله=«' + (a.it.meta?.['نوع معامله'] ?? '—') + '»')
}
if (absurd.length) {
  const byS = new Map()
  for (const a of absurd) byS.set(shape(a.it.price), (byS.get(shape(a.it.price)) || 0) + 1)
  console.log('  تفکیکِ قالبِ موارد بی‌معنا: ' + [...byS.entries()].map(([k, v]) => k + '=' + v).join('، '))
}

// مهرِ صریحِ متا با رشتهٔ قیمت نمی‌خواند؟ یکی از دو طرف دروغ می‌گوید و
// تا امروز متا برنده می‌شد — آگهیِ اجاره در فیلترِ خرید.
const rentPrice = /ودیعه|رهن|اجاره/
const mism = items.filter(it => rentPrice.test(String(it.price || '')) && /فروش|خرید/.test(String(it.meta?.['نوع معامله'] || '')))
console.log('')
console.log('— مهرِ «فروش» با قیمتِ اجاره —')
console.log('  تعداد: ' + mism.length)
for (const it of mism.slice(0, NSAMP)) {
  console.log('    «' + String(it.price || '').slice(0, 44) + '»  →  dealOf=' + deriveListing(it).deal)
  console.log('      ' + String(it.title || '').slice(0, 80))
}

process.exit(0)
