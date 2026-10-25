#!/usr/bin/env node
// تستِ امبدینگِ معنایی (bge-m3): cosine، متنِ آگهی، و fallbackِ graceful وقتی تنظیم‌نشده.
// endpointِ واقعی اینجا تست نمی‌شود (روی سرورِ خودِ مالک است)؛ منطق و بی‌خطربودن تست می‌شود.
// اجرا: node --import ./scripts/reos-loader.mjs scripts/embeddings-test.mjs
let pass = 0, fail = 0
const ok = (n, c) => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.log('  ✗ ' + n) } }

const emb = await import('../app/lib/embeddings.ts')
const { similarProperties } = await import('../app/lib/reos/data.ts')

console.log('\n── امبدینگ ──')
ok('cosine(هم‌جهت) = ۱', Math.abs(emb.cosine([1, 2, 3], [1, 2, 3]) - 1) < 1e-9)
ok('cosine(عمود) = ۰', Math.abs(emb.cosine([1, 0], [0, 1])) < 1e-9)
ok('cosine(مقیاس‌شده) = ۱', Math.abs(emb.cosine([1, 2], [2, 4]) - 1) < 1e-9)
ok('cosine(خالی) = ۰ (بدونِ خطا)', emb.cosine([], [1, 2]) === 0)

const t = emb.listingEmbedText({ title: 'آپارتمان نوساز', location: 'تهران، سعادت‌آباد', category: 'آپارتمان', meta: { 'متراژ': '120', 'اتاق': '2', 'منطقه': '۲' } })
ok('متنِ آگهی عنوان/مکان/متراژ را دارد', /آپارتمان نوساز/.test(t) && /سعادت/.test(t) && /متراژ 120/.test(t) && /2 خواب/.test(t))
ok('متنِ آگهیِ خالی خطا نمی‌دهد', emb.listingEmbedText({}) === '' && emb.listingEmbedText(null) === '')

// بدونِ تنظیمِ ایجنتِ embed، امبدینگ «خاموش» است → similarProperties همان رفتارِ قبلی (فیلتر+امتیاز).
ok('embeddingsConfigured در تست خاموش است (بدونِ تخصیصِ مدل)', emb.embeddingsConfigured() === false)
ok('embedListingsCached خاموش → مپِ خالی (بدونِ فراخوانِ شبکه)', (await emb.embedListingsCached([{ id: 'x', text: 'آپارتمان' }])).size === 0)

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} پاس · ${fail} خطا\n`)
process.exit(fail === 0 ? 0 : 1)
