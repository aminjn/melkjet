// ایمپورتِ «کارشناسِ رسمی» و «وکیل» به دایرکتوری از فایل‌های JSON + موقعیتِ نقشه با نکسا‌مپ،
// و پاک‌سازیِ فیچرِ قدیمیِ «بنیاد وکلا» و دسته‌های بی‌ربط (سازندگان تهران و…).
// امن: بدونِ فلگ فقط گزارش می‌دهد (هیچ تغییری). روی سرور:
//   node --import ./scripts/reos-loader.mjs scripts/import-legal.mjs                  # فقط گزارش
//   node --import ./scripts/reos-loader.mjs scripts/import-legal.mjs --import         # ایمپورت + ژئوکد
//   node --import ./scripts/reos-loader.mjs scripts/import-legal.mjs --remove-bonyad  # حذفِ فیچرِ قدیمی
//   node --import ./scripts/reos-loader.mjs scripts/import-legal.mjs --delete-cat="سازندگان تهران"
import { readFileSync } from 'fs'
if (!process.env.DATABASE_URL) {
  for (const f of ['.env.production.local', '.env.local', '.env']) {
    try { for (const line of readFileSync(f, 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') } } catch {}
  }
}
const { insertItems, listItems, deleteItems, setModerationBatch } = await import('../app/lib/scraper-store.ts')
const { geoGeocode, geoApiEnabled } = await import('../app/lib/geo-api.ts')

const FA = /[۰-۹]/g
const digits = s => String(s || '').replace(FA, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString()).replace(/\D/g, '')
const S = s => (s == null ? '' : String(s)).trim()
const args = process.argv.slice(2)
const has = f => args.includes(f)
const delCat = (args.find(a => a.startsWith('--delete-cat=')) || '').split('=').slice(1).join('=').replace(/^["']|["']$/g, '')
const DO_IMPORT = has('--import')
const DO_GEO = DO_IMPORT && !has('--no-geo')
const BONYAD = 'بنیاد وکلا — وکلای ملکی'
const CAT_EXPERT = 'کارشناسان رسمی', CAT_LAWYER = 'دفاتر حقوقی و وکلا'

console.log(process.env.DATABASE_URL ? '🗄  منبع: PostgreSQL (زنده)' : '⚠️  DATABASE_URL نیست!')
console.log(geoApiEnabled() ? '🗺  نکسا‌مپ: پیکربندی‌شده' : '⚠️  کلیدِ نکسا‌مپ تنظیم نیست — بدونِ مختصات ایمپورت می‌شود', '\n')

const experts = JSON.parse(readFileSync(new URL('./data/legal-experts.json', import.meta.url))).groups.flatMap(g => g.items)
const lawyers = JSON.parse(readFileSync(new URL('./data/legal-lawyers.json', import.meta.url))).groups.flatMap(g => g.items)

// ── گزارشِ وضعیتِ فعلیِ دایرکتوری ───────────────────────────────────────────
const dir = await listItems('directory')
const byCat = {}; for (const it of dir) { const c = S(it.category) || '(بی‌دسته)'; byCat[c] = (byCat[c] || 0) + 1 }
console.log('— دسته‌های فعلیِ دایرکتوری —')
for (const [c, n] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${c}`)
const bonyadItems = dir.filter(i => i.sourceName === BONYAD)
console.log(`\nآیتم‌های «بنیاد وکلا» (فیچرِ قدیمی): ${bonyadItems.length}`)
console.log(`دادهٔ فایل‌ها: ${experts.length} کارشناسِ رسمی · ${lawyers.length} وکیل`)
console.log(`دارای آدرس: کارشناس ${experts.filter(e => S(e['آدرس'])).length} · وکیل ${lawyers.filter(l => S(l['آدرس'])).length} (بقیه با مرکزِ شهر ژئوکد می‌شوند)\n`)

// ── ژئوکد با نکسا‌مپ (کشِ محله‌/شهرِ تکراری + throttle) ──────────────────────
const geoCache = new Map()
async function geo(province, city, addr) {
  if (!DO_GEO || !geoApiEnabled()) return null
  const q = [province, city, addr].map(S).filter(Boolean).join(' ')
  if (!q) return null
  const key = addr ? q : `${S(province)} ${S(city)}`   // بی‌آدرس‌ها را per-شهر کش کن
  if (geoCache.has(key)) return geoCache.get(key)
  let pt = null
  try { const r = await geoGeocode(q, 6000); if (r && r.lat && r.lng) pt = { lat: r.lat, lng: r.lng } } catch {}
  geoCache.set(key, pt)
  await new Promise(r => setTimeout(r, 350))   // مهربان با سهمیهٔ نکسا‌مپ
  return pt
}

function rawExpert(e) {
  const meta = { 'استان': S(e['استان']), 'شهر': S(e['شهر']), 'پایه': S(e['پایه']), 'رشته': S(e['رشته کارشناسی']), 'شماره پروانه': S(e['شماره پروانه']), 'اعتبار پروانه': S(e['اعتبار']), 'تلفن موسسه': S(e['تلفن موسسه']), 'آدرس': S(e['آدرس']), 'صلاحیت': S(e['صلاحیت های کارشناس']).slice(0, 300) }
  const excerpt = [S(e['پایه']), S(e['رشته کارشناسی']) && `رشتهٔ ${S(e['رشته کارشناسی'])}`, S(e['صلاحیت های کارشناس']).slice(0, 140)].filter(Boolean).join(' · ')
  return { title: S(e['نام']), owner: S(e['نام']), location: [S(e['شهر']), S(e['استان'])].filter(Boolean).join('، '), phone: digits(e['تلفن همراه']) || undefined, url: S(e['لینک پروفایل']) || undefined, excerpt, tags: [S(e['رشته کارشناسی'])].filter(Boolean), meta }
}
function rawLawyer(l) {
  const meta = { 'استان': S(l['استان']), 'شهر': S(l['شهر']), 'پایه': S(l['پایه']), 'شماره پروانه': S(l['شماره پروانه']), 'اعتبار پروانه': S(l['اعتبار']), 'تلفن موسسه': S(l['تلفن موسسه']), 'آدرس': S(l['آدرس']) }
  const excerpt = [S(l['پایه']) || 'وکیل دادگستری', S(l['شهر']) && `${S(l['استان'])}، ${S(l['شهر'])}`].filter(Boolean).join(' · ')
  return { title: S(l['نام']), owner: S(l['نام']), location: [S(l['شهر']), S(l['استان'])].filter(Boolean).join('، '), phone: digits(l['تلفن همراه']) || undefined, url: S(l['لینک پروفایل']) || undefined, excerpt, tags: [S(l['پایه'])].filter(Boolean), meta }
}

async function importGroup(items, mapper, category, srcId, srcName) {
  const raw = []
  let g = 0
  for (const x of items) {
    const r = mapper(x)
    if (!r.title) continue
    const pt = await geo(r.meta['استان'], r.meta['شهر'], r.meta['آدرس'])
    if (pt) { r.meta['__lat'] = String(pt.lat); r.meta['__lng'] = String(pt.lng); g++ }
    raw.push(r)
    if (raw.length % 50 === 0) console.log(`  ${srcName}: آماده‌سازی ${raw.length}/${items.length} (ژئوکدشده ${g})`)
  }
  const source = { id: srcId, name: srcName, url: '', type: 'directory', category, method: 'manual', enabled: true, schedule: 'manual', lastRun: null, lastCount: 0, status: 'idle' }
  const res = await insertItems(source, raw)
  // دایرکتوریِ حرفه‌ای → تأییدِ خودکار (نه صفِ ممیزی).
  const mine = (await listItems('directory')).filter(i => i.sourceId === srcId && i.status === 'pending')
  if (mine.length) await setModerationBatch(mine.map(i => ({ id: i.id, status: 'approved', reason: 'دایرکتوریِ حرفه‌ای — کانون', score: 90 })), { notifyNew: false })
  console.log(`✅ ${srcName}: added=${res.added} updated=${res.updated} dup=${res.dup} · ژئوکدشده=${g}/${raw.length}\n`)
}

// ── اجرا ───────────────────────────────────────────────────────────────────
if (DO_IMPORT) {
  console.log('⏳ ایمپورتِ کارشناسانِ رسمی…'); await importGroup(experts, rawExpert, CAT_EXPERT, 'legal-experts', 'کارشناسانِ رسمی (کانون)')
  console.log('⏳ ایمپورتِ وکلا…'); await importGroup(lawyers, rawLawyer, CAT_LAWYER, 'legal-lawyers', 'وکلای دادگستری (کانون)')
}
if (has('--remove-bonyad')) {
  if (bonyadItems.length) { await deleteItems(bonyadItems.map(i => i.id)); console.log(`🗑 ${bonyadItems.length} آیتمِ «بنیاد وکلا» حذف شد.`) }
  else console.log('بنیاد وکلا: چیزی برای حذف نبود.')
}
if (delCat) {
  const victims = dir.filter(i => S(i.category) === delCat)
  if (victims.length) { await deleteItems(victims.map(i => i.id)); console.log(`🗑 دستهٔ «${delCat}»: ${victims.length} آیتم حذف شد.`) }
  else console.log(`دستهٔ «${delCat}»: آیتمی نبود.`)
}
if (!DO_IMPORT && !has('--remove-bonyad') && !delCat) {
  console.log('— این فقط گزارش بود. برای اجرا یکی از فلگ‌ها را بزن: —')
  console.log('  --import            (ایمپورتِ کارشناس+وکیل با مختصات)')
  console.log('  --remove-bonyad     (حذفِ فیچرِ قدیمیِ بنیاد وکلا)')
  console.log('  --delete-cat="سازندگان تهران"   (حذفِ دستهٔ بی‌ربط)')
}
process.exit(0)
