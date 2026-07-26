// فاز ۲۲۰ — راستی‌آزماییِ سئو روی «سایتِ واقعی» (نه ادعا): از خودِ سایت‌مپِ زنده نمونه می‌گیرد،
// وضعِ HTTP و تگِ canonical هر نمونه را چک می‌کند، و می‌شمارد هر هاب چند لینکِ داخلیِ SSR دارد.
// اجرا روی سرور بعدِ دیپلوی:  node scripts/seo-verify.mjs
// (پیش‌فرض به اینستنسِ لوکال می‌زند؛ برای تستِ از بیرونِ سرور: BASE=https://melkjet.com node scripts/seo-verify.mjs)

const BASE = process.env.BASE || 'http://127.0.0.1:3001'
const SITE = 'https://melkjet.com'
const SAMPLES_PER_GROUP = 6

const get = async (path) => {
  const url = path.startsWith('http') ? path : BASE + path
  try {
    const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'melkjet-seo-verify' } })
    const body = r.status === 200 ? await r.text() : ''
    return { status: r.status, body, location: r.headers.get('location') || '' }
  } catch (e) { return { status: 0, body: '', location: '', err: e?.message } }
}
const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
const groupOf = (u) => {
  const p = u.replace(SITE, '')
  if (p.startsWith('/listing/')) return 'آگهی'
  if (p.startsWith('/locations')) return 'محله'
  if (p.startsWith('/blog')) return 'بلاگ'
  if (p.startsWith('/projects')) return 'پروژه'
  if (p.startsWith('/builders/')) return 'سازنده'
  if (p.startsWith('/product/')) return 'محصول'
  if (p.startsWith('/store/')) return 'فروشگاه'
  if (/^\/(pros|architect|notary|appraiser|contractor|lawfirm|finance|legal|agency)\//.test(p)) return 'متخصص'
  return 'ثابت'
}
const pick = (arr, n) => {
  if (arr.length <= n) return arr
  const out = []
  for (let i = 0; i < n; i++) out.push(arr[Math.floor((i * (arr.length - 1)) / (n - 1))])
  return [...new Set(out)]
}
const fa = (n) => Number(n).toLocaleString('fa-IR')

console.log(`\n🔎 راستی‌آزماییِ سئو — ${BASE}\n`)
let fail = 0
const bad = (msg) => { fail++; console.log(`  ✗ ${msg}`) }

// ── ۱) سایت‌مپ: ایندکس + شاردها + شمارش به تفکیکِ گروه ──
const idx = await get('/sitemap.xml')
if (idx.status !== 200) { bad(`sitemap.xml → ${idx.status}`); process.exit(1) }
const shardUrls = locs(idx.body)
console.log(`سایت‌مپ: ${fa(shardUrls.length)} شارد`)
const byGroup = new Map()
for (const su of shardUrls) {
  const s = await get(su.replace(SITE, ''))
  if (s.status !== 200) { bad(`شارد ${su} → ${s.status}`); continue }
  for (const u of locs(s.body)) {
    const g = groupOf(u)
    if (!byGroup.has(g)) byGroup.set(g, [])
    byGroup.get(g).push(u)
  }
}
let total = 0
for (const [g, urls] of [...byGroup.entries()].sort((a, b) => b[1].length - a[1].length)) { total += urls.length; console.log(`  ${g}: ${fa(urls.length)} URL`) }
console.log(`  جمع: ${fa(total)} URL\n`)

// ── ۲) نمونه‌گیری از هر گروه: باید ۲۰۰ (یا ریدایرکتِ ۳۰۱/۳۰۸ به canonical) بدهد + تگِ canonical داشته باشد ──
console.log('نمونه‌گیریِ واقعی از هر گروه:')
for (const [g, urls] of byGroup.entries()) {
  let ok200 = 0, redir = 0, errs = []
  for (const u of pick(urls, SAMPLES_PER_GROUP)) {
    const r = await get(u.replace(SITE, ''))
    // canonical فقط برای صفحاتِ محتوایی الزامی است؛ صفحاتِ ثابتِ بدونِ canonical هشدارند نه خطا
    if (r.status === 200) { ok200++; if (!r.body.includes('rel="canonical"') && g !== 'ثابت') errs.push(`${u} بدونِ canonical`) }
    else if (r.status === 301 || r.status === 308 || r.status === 307) redir++
    else errs.push(`${u} → ${r.status}`)
  }
  const line = `  ${g}: ${fa(ok200)} تا ۲۰۰${redir ? ` + ${fa(redir)} ریدایرکت` : ''} از ${fa(Math.min(SAMPLES_PER_GROUP, urls.length))} نمونه`
  if (errs.length) { bad(`${line} — خطاها: ${errs.join(' | ')}`) } else console.log(`  ✓${line.slice(2)}`)
}

// ── ۳) هاب‌ها: در HTMLِ سرور (همان که گوگل می‌بیند) چند لینکِ داخلی از هر نوع هست؟ ──
console.log('\nلینک‌های داخلیِ SSR در هاب‌ها (چیزی که واقعاً به گوگل می‌رسد):')
const count = (body, re) => (body.match(re) || []).length
// حداقلِ موردِ انتظارِ هر هاب از روی «خودِ سایت‌مپ» محاسبه می‌شود — گروهی که در سایت‌مپ خالی است، هابِ خالی‌اش سالم است.
const gN = (g) => (byGroup.get(g) || []).length
const hubChecks = [
  ['/listings', /href="\/listing\//g, Math.min(30, gN('آگهی')), 'لینکِ آگهی'],
  ['/listings?page=2', /href="\/listing\//g, gN('آگهی') > 48 ? 30 : 0, 'لینکِ آگهی (صفحهٔ ۲)'],
  ['/locations', /href="\/locations\//g, Math.min(10, gN('محله')), 'لینکِ محله'],
  ['/projects', /href="\/projects\//g, Math.min(5, gN('پروژه')), 'لینکِ پروژه'],
  ['/blog', /href="\/blog\//g, Math.min(3, (byGroup.get('بلاگ') || []).filter(u => u.replace(SITE, '').split('/').filter(Boolean).length >= 3).length), 'لینکِ بلاگ (مقاله‌ها)'],
  ['/browse', /href="\/browse\//g, 3, 'لینکِ گروه‌های مرور'],
  ['/browse/specialists', /href="\/(pros|architect|notary|appraiser|contractor|lawfirm|finance|legal|agency)\//g, Math.min(1, gN('متخصص')), 'لینکِ متخصص'],
  ['/browse/builders', /href="\/builders\//g, Math.min(1, gN('سازنده')), 'لینکِ سازنده'],
  ['/browse/products', /href="\/product\//g, Math.min(1, gN('محصول')), 'لینکِ محصول'],
  ['/browse/stores', /href="\/store\//g, Math.min(1, gN('فروشگاه')), 'لینکِ فروشگاه'],
]
for (const [path, re, min, label] of hubChecks) {
  const r = await get(path)
  if (r.status !== 200) { bad(`${path} → ${r.status}`); continue }
  const n = count(r.body, re)
  const leak = count(r.body, /href="https?:\/\/(www\.)?divar\.ir/g)
  if (leak) bad(`${path}: ${fa(leak)} لینک به divar.ir نشت کرده!`)
  if (n >= min) console.log(`  ✓ ${path}: ${fa(n)} ${label}`)
  else bad(`${path}: فقط ${fa(n)} ${label} (حداقلِ موردِ انتظار ${fa(min)})`)
}

// ── ۴) robots ──
const rb = await get('/robots.txt')
if (rb.status === 200 && rb.body.includes('Sitemap:') && rb.body.includes('Disallow: /admin')) console.log('  ✓ robots.txt: سایت‌مپ + بستنِ ادمین')
else bad(`robots.txt ناقص (status ${rb.status})`)

console.log(`\n${fail === 0 ? '✅ همه‌چیز واقعاً به گوگل می‌رسد — صفر خطا' : `❌ ${fa(fail)} مشکلِ واقعی — همین خروجی را بفرست تا بسته شود`}\n`)
process.exit(fail === 0 ? 0 : 1)
