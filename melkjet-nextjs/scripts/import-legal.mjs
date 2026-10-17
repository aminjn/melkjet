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
const { insertItems, listItems, deleteItems, setModerationBatch, removeCategory } = await import('../app/lib/scraper-store.ts')
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

// ── ژئوکد با نکسا‌مپ (کشِ شهر/آدرس + throttle) ─────────────────────────────
const geoCache = new Map()
async function geo(province, city, addr) {
  if (NO_GEO || !geoApiEnabled()) return null
  const q = [province, city, addr].map(S).filter(Boolean).join(' ')
  if (!q) return null
  const key = addr ? q : `${S(province)} ${S(city)}`
  if (geoCache.has(key)) return geoCache.get(key)
  let pt = null
  try { const r = await geoGeocode(q, 6000); if (r && r.lat && r.lng) pt = { lat: r.lat, lng: r.lng } } catch {}
  geoCache.set(key, pt); await new Promise(r => setTimeout(r, 350)); return pt
}
const loc = (city, prov) => [S(city), S(prov)].filter(Boolean).join('، ')
function rawExpert(e) {
  // صلاحیت را کامل نگه می‌داریم (قبلاً به ۳۰۰ نویسه بریده می‌شد و متن «نصفه» می‌آمد)؛ فقط سقفِ ایمنی ۲۰۰۰.
  const meta = { 'استان': S(e['استان']), 'شهر': S(e['شهر']), 'پایه': S(e['پایه']), 'رشته': S(e['رشته کارشناسی']), 'شماره پروانه': S(e['شماره پروانه']), 'اعتبار پروانه': S(e['اعتبار']), 'تلفن موسسه': S(e['تلفن موسسه']), 'آدرس': S(e['آدرس']), 'صلاحیت': S(e['صلاحیت های کارشناس']).slice(0, 2000) }
  return { title: S(e['نام']), owner: S(e['نام']), location: loc(e['شهر'], e['استان']), phone: digits(e['تلفن همراه']) || undefined, url: S(e['لینک پروفایل']) || undefined, excerpt: [S(e['پایه']), S(e['رشته کارشناسی']) && `رشتهٔ ${S(e['رشته کارشناسی'])}`, S(e['صلاحیت های کارشناس']).slice(0, 140)].filter(Boolean).join(' · '), tags: [S(e['رشته کارشناسی'])].filter(Boolean), meta }
}
function rawLawyer(l) {
  const meta = { 'استان': S(l['استان']), 'شهر': S(l['شهر']), 'پایه': S(l['پایه']), 'شماره پروانه': S(l['شماره پروانه']), 'اعتبار پروانه': S(l['اعتبار']), 'تلفن موسسه': S(l['تلفن موسسه']), 'آدرس': S(l['آدرس']) }
  return { title: S(l['نام']), owner: S(l['نام']), location: loc(l['شهر'], l['استان']), phone: digits(l['تلفن همراه']) || undefined, url: S(l['لینک پروفایل']) || undefined, excerpt: [S(l['پایه']) || 'وکیل دادگستری', loc(l['شهر'], l['استان'])].filter(Boolean).join(' · '), tags: [S(l['پایه'])].filter(Boolean), meta }
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
  // بارگذاریِ مجدد = سریع: مختصاتِ قبلاً‌ذخیره‌شده دوباره ژئوکد نمی‌شوند (ژئوکد با throttle ۳۵۰ms بود و
  // ۴۳۵ مورد ~۲.۵ دقیقه UI را قفل می‌کرد). کلید = لینکِ پروفایل (یا نام) → __lat/__lng موجود.
  const prevCoords = new Map()
  try {
    for (const it of (await listItems('directory')).filter(i => i.sourceId === srcId)) {
      const m = it.meta || {}
      if (m['__lat'] && m['__lng']) prevCoords.set(String(it.url || it.title || ''), { lat: m['__lat'], lng: m['__lng'] })
    }
  } catch {}
  const raw = []; let g = 0, reused = 0
  for (const x of items) {
    const r = mapper(x); if (!r.title) continue
    const prev = prevCoords.get(String(r.url || r.title || ''))
    if (prev) { r.meta['__lat'] = prev.lat; r.meta['__lng'] = prev.lng; reused++ }
    else {
      const pt = await geo(r.meta['استان'], r.meta['شهر'], r.meta['آدرس'])
      if (pt) { r.meta['__lat'] = String(pt.lat); r.meta['__lng'] = String(pt.lng); g++ }
    }
    raw.push(r)
    if (raw.length % 50 === 0) console.log(`  آماده‌سازی ${raw.length}/${items.length} (ژئوکدِ تازه ${g} · بازاستفاده ${reused})`)
  }
  const source = { id: srcId, name: srcName, url: '', type: 'directory', category, method: 'manual', enabled: true, schedule: 'manual', lastRun: null, lastCount: 0, status: 'idle' }
  const res = await insertItems(source, raw)
  const mine = (await listItems('directory')).filter(i => i.sourceId === srcId && i.status === 'pending')
  if (mine.length) await setModerationBatch(mine.map(i => ({ id: i.id, status: 'approved', reason: 'دایرکتوریِ حرفه‌ای — کانون', score: 90 })), { notifyNew: false })
  console.log(`✅ «${category}»: added=${res.added} updated=${res.updated} dup=${res.dup} · ژئوکدِ تازه=${g} · بازاستفاده=${reused} از ${raw.length}`)
}

if (args.includes('--reset')) {
  // پاک‌سازیِ ایمپورتِ قبلی (دستهٔ اشتباه) تا دوباره با کلیدِ درست وارد شود.
  const v = (await listItems('directory')).filter(i => i.sourceId === 'legal-experts' || i.sourceId === 'legal-lawyers')
  if (v.length) { await deleteItems(v.map(i => i.id)); console.log(`🗑 ${v.length} آیتمِ ایمپورتِ قبلی حذف شد.`) } else console.log('ایمپورتِ قبلی: چیزی نبود.')
  await removeCategory('کارشناسان رسمی'); await removeCategory('دفاتر حقوقی و وکلا')
  console.log('🗑 دسته‌های برچسب‌کاملِ اشتباه از فهرست پاک شدند.')
}
if (FILE) { await importFile(FILE) }
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
