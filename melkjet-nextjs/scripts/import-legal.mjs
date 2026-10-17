// ایمپورتِ «کارشناسِ رسمی» یا «وکیل» به دایرکتوری از یک فایلِ JSONِ آپلودشده + مختصاتِ نکسا‌مپ.
// نوعِ فایل از فیلدِ `section` خودش تشخیص داده می‌شود (کارشناس/وکیل).
//   node --import ./scripts/reos-loader.mjs scripts/import-legal.mjs --file=/path/to.json   # ایمپورت
//   node --import ./scripts/reos-loader.mjs scripts/import-legal.mjs --remove-bonyad         # حذفِ دادهٔ قدیمی
//   node --import ./scripts/reos-loader.mjs scripts/import-legal.mjs --delete-cat="سازندگان تهران"
import { readFileSync } from 'fs'
if (!process.env.DATABASE_URL) {
  for (const f of ['.env.production.local', '.env.local', '.env']) {
    try { for (const line of readFileSync(f, 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') } } catch {}
  }
}
const { insertItems, listItems, deleteItems, setModerationBatch, removeCategory, setItemCoords } = await import('../app/lib/scraper-store.ts')
const { geoGeocode, geoApiEnabled } = await import('../app/lib/geo-api.ts')

const FA = /[۰-۹]/g
const digits = s => String(s || '').replace(FA, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString()).replace(/\D/g, '')
const S = s => (s == null ? '' : String(s)).trim()
const args = process.argv.slice(2)
const argVal = p => { const a = args.find(x => x.startsWith(p)); return a ? a.slice(p.length).replace(/^["']|["']$/g, '') : '' }
const FILE = argVal('--file=')
const NO_GEO = args.includes('--no-geo')
const delCat = argVal('--delete-cat=')
const BONYAD = 'بنیاد وکلا — وکلای ملکی'

console.log(process.env.DATABASE_URL ? '🗄  PostgreSQL (زنده)' : '⚠️  DATABASE_URL نیست!')
console.log(geoApiEnabled() ? '🗺  نکسا‌مپ: پیکربندی‌شده' : '⚠️  کلیدِ نکسا‌مپ تنظیم نیست — بدونِ مختصات', '\n')

// ── ژئوکد با نکسا‌مپ (مرکزِ شهر + اعتبارسنجیِ استان) ─────────────────────────
// آدرسِ آزادِ این دیتاست برای شهرهای کوچک نکسامپ را به شهرِ دیگری می‌برد (مثلِ «قیروکارزین، فارس»
// که روی «ارومیه» می‌افتاد). پس «شهر، استان» (مرکزِ شهر) مبنا است و نتیجه فقط وقتی پذیرفته می‌شود
// که آدرسِ برگشتیِ نکسامپ همان استان/شهر را داشته باشد — وگرنه پین گذاشته نمی‌شود (پینِ غلط بدتر از بی‌پین).
const geoCache = new Map()
const fold = s => String(s || '').replace(/\s+/g, '').replace(/[يی]/g, 'ی').replace(/[كک]/g, 'ک').replace(/ـ/g, '')
function fmtOk(fmt, prov, city) {
  const nf = fold(fmt); if (!nf) return false
  const np = fold(prov), nc = fold(city)
  return (np.length >= 3 && nf.includes(np)) || (nc.length >= 3 && nf.includes(nc))
}
async function geo(province, city /*, addr — عمداً استفاده نمی‌شود */) {
  if (NO_GEO || !geoApiEnabled()) return null
  const prov = S(province), city0 = S(city)
  if (!prov && !city0) return null
  const tries = []
  if (city0 && prov) tries.push(`${city0}، ${prov}`)
  else if (city0) tries.push(city0)
  if (prov) tries.push(prov)   // آخرین‌چاره: مرکزِ استان
  for (const q of tries) {
    if (geoCache.has(q)) { const c = geoCache.get(q); if (c) return c; continue }
    let pt = null
    try { const r = await geoGeocode(q, 6000); if (r && r.lat && r.lng && fmtOk(r.formatted, prov, city0)) pt = { lat: r.lat, lng: r.lng } } catch {}
    geoCache.set(q, pt); await new Promise(r => setTimeout(r, 150))
    if (pt) return pt
  }
  return null
}
const loc = (city, prov) => [S(city), S(prov)].filter(Boolean).join('، ')
function rawExpert(e) {
  // صلاحیت را کامل نگه می‌داریم (قبلاً به ۳۰۰ نویسه بریده می‌شد و متن «نصفه» می‌آمد)؛ فقط سقفِ ایمنی ۲۰۰۰.
  const meta = { 'استان': S(e['استان']), 'شهر': S(e['شهر']), 'پایه': S(e['پایه']), 'رشته': S(e['رشته کارشناسی']), 'شماره پروانه': S(e['شماره پروانه']), 'اعتبار پروانه': S(e['اعتبار']), 'تلفن موسسه': S(e['تلفن موسسه']), 'آدرس': S(e['آدرس']), 'صلاحیت': S(e['صلاحیت های کارشناس']).slice(0, 2000) }
  return { title: S(e['نام']), owner: S(e['نام']), location: loc(e['شهر'], e['استان']), phone: digits(e['تلفن همراه']) || undefined, url: S(e['لینک پروفایل']) || undefined, image: S(e['عکس']) || undefined, excerpt: [S(e['پایه']), S(e['رشته کارشناسی']) && `رشتهٔ ${S(e['رشته کارشناسی'])}`, S(e['صلاحیت های کارشناس']).slice(0, 140)].filter(Boolean).join(' · '), tags: [S(e['رشته کارشناسی'])].filter(Boolean), meta }
}
function rawLawyer(l) {
  const meta = { 'استان': S(l['استان']), 'شهر': S(l['شهر']), 'پایه': S(l['پایه']), 'شماره پروانه': S(l['شماره پروانه']), 'اعتبار پروانه': S(l['اعتبار']), 'تلفن موسسه': S(l['تلفن موسسه']), 'آدرس': S(l['آدرس']) }
  return { title: S(l['نام']), owner: S(l['نام']), location: loc(l['شهر'], l['استان']), phone: digits(l['تلفن همراه']) || undefined, url: S(l['لینک پروفایل']) || undefined, image: S(l['عکس']) || undefined, excerpt: [S(l['پایه']) || 'وکیل دادگستری', loc(l['شهر'], l['استان'])].filter(Boolean).join(' · '), tags: [S(l['پایه'])].filter(Boolean), meta }
}

async function importFile(path) {
  const doc = JSON.parse(readFileSync(path, 'utf8'))
  const items = (doc.groups || []).flatMap(g => g.items || [])
  const section = S(doc.section)
  const isLawyer = /وکیل/.test(section) || !/کارشناس/.test(section) && (doc.groups || []).some(g => /lawyer/.test(S(g.source)))
  // کلیدِ کوتاهِ دستهٔ دایرکتوری (نه برچسبِ کامل) — وگرنه دستهٔ تکراری ساخته می‌شود و شمارش نمی‌خورد.
  // 'کارشناس' → «کارشناسان رسمی» · 'حقوقی' → «دفاتر حقوقی و وکلا» (نگاشت در app/directory CATS).
  const category = isLawyer ? 'حقوقی' : 'کارشناس'
  const mapper = isLawyer ? rawLawyer : rawExpert
  const srcId = isLawyer ? 'legal-lawyers' : 'legal-experts'
  const srcName = isLawyer ? 'وکلای دادگستری (کانون)' : 'کارشناسانِ رسمی (کانون)'
  console.log(`فایل: section=«${section}» → دستهٔ «${category}» · ${items.length} مورد`)
  // فازِ ۱ — درجِ فوری «بدونِ ژئوکد»: آیتم‌ها ظرفِ چند ثانیه در دایرکتوری ظاهر می‌شوند و
  // روی دیسک می‌نشینند. (قبلاً ژئوکدِ ۴۳۵موردیِ throttle‌دار «پیش از» درج بود → ~۲ دقیقه قفل،
  // و هر لغو/کرش کلِ پیشرفت را دور می‌ریخت → «هی گیر میکنه».)
  const raw = []
  for (const x of items) { const r = mapper(x); if (r.title) raw.push(r) }
  const source = { id: srcId, name: srcName, url: '', type: 'directory', category, method: 'manual', enabled: true, schedule: 'manual', lastRun: null, lastCount: 0, status: 'idle' }
  const res = await insertItems(source, raw)
  const mine = (await listItems('directory')).filter(i => i.sourceId === srcId && i.status === 'pending')
  if (mine.length) await setModerationBatch(mine.map(i => ({ id: i.id, status: 'approved', reason: 'دایرکتوریِ حرفه‌ای — کانون', score: 90 })), { notifyNew: false })
  console.log(`✅ درج شد: added=${res.added} updated=${res.updated} dup=${res.dup} — حالا موقعیتِ نقشه (ادامه‌پذیر)…`)
  // فازِ ۲ — ژئوکدِ «ادامه‌پذیر»: فقط آیتم‌های بی‌مختصات؛ هر مورد بلافاصله با setItemCoords
  // ذخیره می‌شود. پس اگر لغو/کرش شد، پیشرفت می‌مانَد و اجرای بعدی از همان‌جا ادامه می‌دهد.
  if (NO_GEO || !geoApiEnabled()) { console.log('ژئوکد غیرفعال — بدونِ مختصات'); return }
  const need = (await listItems('directory')).filter(i => i.sourceId === srcId && !((i.meta || {})['__lat'] && (i.meta || {})['__lng']))
  console.log(`موقعیتِ نقشه برای ${need.length} موردِ بی‌مختصات (بقیه از قبل دارند).`)
  let done = 0, ok = 0
  for (const it of need) {
    const m = it.meta || {}
    const pt = await geo(m['استان'], m['شهر'], m['آدرس'])
    if (pt) { try { await setItemCoords(it.id, pt.lat, pt.lng); ok++ } catch {} }
    if (++done % 25 === 0) console.log(`  موقعیت ${done}/${need.length} (موفق ${ok})`)
  }
  console.log(`✅ «${category}» تمام — موقعیتِ ${ok}/${need.length} مورد`)
}

if (args.includes('--reset')) {
  // پاک‌سازیِ ایمپورتِ قبلی (دستهٔ اشتباه) تا دوباره با کلیدِ درست وارد شود.
  const v = (await listItems('directory')).filter(i => i.sourceId === 'legal-experts' || i.sourceId === 'legal-lawyers')
  if (v.length) { await deleteItems(v.map(i => i.id)); console.log(`🗑 ${v.length} آیتمِ ایمپورتِ قبلی حذف شد.`) } else console.log('ایمپورتِ قبلی: چیزی نبود.')
  await removeCategory('کارشناسان رسمی'); await removeCategory('دفاتر حقوقی و وکلا')
  console.log('🗑 دسته‌های برچسب‌کاملِ اشتباه از فهرست پاک شدند.')
}
async function regeoAll() {
  // محاسبهٔ دوبارهٔ موقعیتِ «همهٔ» موارد حقوقی با منطقِ اعتبارسنجی‌شده (برای تصحیحِ پین‌های غلطِ قبلی).
  if (NO_GEO || !geoApiEnabled()) { console.log('ژئوکد غیرفعال.'); return }
  const items = (await listItems('directory')).filter(i => i.sourceId === 'legal-experts' || i.sourceId === 'legal-lawyers')
  console.log(`محاسبهٔ دوبارهٔ موقعیت برای ${items.length} موردِ حقوقی…`)
  let done = 0, ok = 0, cleared = 0
  for (const it of items) {
    const m = it.meta || {}
    const pt = await geo(m['استان'], m['شهر'], m['آدرس'])
    try {
      if (pt) { await setItemCoords(it.id, pt.lat, pt.lng, true); ok++ }
      else { await setItemCoords(it.id, 0, 0, true); cleared++ }   // پینِ غلط را بردار (بی‌پین بهتر از غلط)
    } catch {}
    if (++done % 25 === 0) console.log(`  ${done}/${items.length} (درست ${ok} · بی‌پین ${cleared})`)
  }
  console.log(`✅ موقعیتِ دوباره: درست=${ok} · بی‌پین=${cleared} از ${items.length}`)
}

if (args.includes('--regeo')) { await regeoAll() }
else if (FILE) { await importFile(FILE) }
else if (args.includes('--reset')) { /* فقط ریست */ }
else if (args.includes('--remove-bonyad')) {
  const v = (await listItems('directory')).filter(i => i.sourceName === BONYAD)
  if (v.length) { await deleteItems(v.map(i => i.id)); console.log(`🗑 ${v.length} آیتمِ «بنیاد وکلا» حذف شد.`) } else console.log('بنیاد وکلا: چیزی نبود.')
}
else if (delCat) {
  const v = (await listItems('directory')).filter(i => S(i.category) === delCat)
  if (v.length) { await deleteItems(v.map(i => i.id)); console.log(`🗑 دستهٔ «${delCat}»: ${v.length} آیتم حذف شد.`) } else console.log(`دستهٔ «${delCat}»: آیتمی نداشت.`)
  await removeCategory(delCat)   // خودِ «دسته» را هم از فهرست پاک کن (حتی اگر بی‌آیتم بود)
  console.log(`🗑 دستهٔ «${delCat}» از فهرستِ دسته‌ها برداشته شد.`)
}
else {
  const dir = await listItems('directory'); const byCat = {}
  for (const it of dir) { const c = S(it.category) || '(بی‌دسته)'; byCat[c] = (byCat[c] || 0) + 1 }
  console.log('— دسته‌های فعلی —'); for (const [c, n] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${c}`)
  console.log('\nبرای ایمپورت: --file=<path>  ·  حذف: --remove-bonyad یا --delete-cat="..."')
}
process.exit(0)
