// ── آیا «آژانس‌هایی که برایشان حساب ساختیم» در دایرکتوری دیده می‌شوند؟ (تشخیص، فقط‌خواندنی) ──
// سؤالِ کاربر: «هوش آژانس، آژانس‌هایی که حساب ایجاد می‌کنیم را نشان نمی‌دهد؟ اینجا باید همان‌هایی
// که برایشان حساب درست کردیم را نشان بدهد.»
//
// این اسکریپت با دادهٔ «واقعیِ زنده» این‌ها را نشان می‌دهد (قانونِ آهنین؛ هیچ حدسی):
//   ۱) چند حساب نقشِ «آژانس املاک» دارند و چندتاشان در دایرکتوری دیده می‌شوند (و چرا بقیه نه).
//   ۲) چند آژانسِ رُستر «graduate» شده‌اند (agencyPhone دارند) و آیا هرکدام حسابِ نقش‌دار دارند.
//   ۳) موارد باگ‌دار: آژانسی که graduate شده ولی حسابش نقشِ «آژانس املاک» ندارد (در دایرکتوری گم است).
//
// اجرا روی سرور:
//   cd /var/www/melkjet/melkjet-nextjs && set -a && . ./.env.production.local && set +a
//   node --import ./scripts/reos-loader.mjs scripts/agency-directory-check.mjs
// و برای ترمیمِ آژانس‌های graduateشده‌ای که نقششان افتاده (تا در دایرکتوری ظاهر شوند):
//   … scripts/agency-directory-check.mjs --fix

const APPLY = process.argv.includes('--fix')
const { listAccounts, adminUpdate } = await import('../app/lib/account-store.ts')
const { listRoles } = await import('../app/lib/role-store.ts')
const { getProfile } = await import('../app/lib/profile-store.ts')
const { listScrapes } = await import('../app/lib/agency-roster-store.ts')

// نگاشتِ نقش → دستهٔ دایرکتوری — عیناً از app/api/directory/route.ts
const ROLE_CAT = {
  'مشاور املاک': 'مشاور', 'آژانس املاک': 'آژانس', 'تأمین‌کنندهٔ مصالح': 'مصالح', 'مشاور حقوقی': 'حقوقی',
  'معمار و طراح داخلی': 'معمار', 'پیمانکار': 'پیمانکار', 'کارشناس رسمی': 'کارشناس', 'دفتر حقوقی': 'حقوقی',
  'بانک و بیمه': 'بیمه', 'دفترخانه': 'دفترخانه',
}

const roles = listRoles()
const roleName = (rid) => { if (!rid) return ''; const r = roles.find(x => x.id === rid || x.name === rid); return r?.name || rid }
const digits = s => String(s || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g, '')

const accounts = listAccounts()
console.log(`\n═══ حساب‌ها: ${accounts.length} کل ═══`)

// شمارشِ حساب‌ها بر اساسِ دستهٔ دایرکتوری
const byCat = {}
const agencyAccts = []
const noRole = []
for (const a of accounts) {
  const rn = roleName(a.role)
  const cat = ROLE_CAT[rn]
  if (a.role && !cat) { /* نقش دارد ولی به دایرکتوری نگاشت نمی‌شود */ }
  if (!cat) continue
  byCat[cat] = (byCat[cat] || 0) + 1
  if (cat === 'آژانس') agencyAccts.push(a)
}
console.log('شمارشِ نقش‌دارها بر اساسِ دسته:', byCat)

// آژانس‌ها: کدام در دایرکتوری دیده می‌شوند (نام لازم است) و کدام گم می‌شوند
console.log(`\n═══ حساب‌های نقشِ «آژانس املاک»: ${agencyAccts.length} ═══`)
let shown = 0, dropped = 0
for (const a of agencyAccts) {
  const p = getProfile(a.phone)
  const name = (p.businessName || p.displayName || a.name || '').trim()
  if (name) shown++
  else { dropped++; console.log(`  ⚠️ بی‌نام (در دایرکتوری گم): phone=${a.phone} role=${roleName(a.role)}`) }
}
console.log(`  → در دایرکتوری دیده می‌شوند: ${shown}`)
console.log(`  → به‌دلیلِ نبودِ نام حذف می‌شوند: ${dropped}`)

// رُستر: آژانس‌های graduate‌شده (agencyPhone) و تطابق با حساب
const scrapes = await listScrapes()
const acctByPhone = new Map(accounts.map(a => [digits(a.phone), a]))
let gradAgencies = 0, gradOk = 0, gradBadRole = 0, gradNoAcct = 0
const problems = []
for (const sc of scrapes) {
  const ph = digits(sc.agencyPhone)
  if (!/^\d{10,11}$/.test(ph)) continue   // هنوز graduate نشده (کلیدِ موقتِ agency:slug)
  gradAgencies++
  const acc = acctByPhone.get(ph)
  if (!acc) { gradNoAcct++; problems.push(`  ❌ «${sc.agencyName}» (${ph}): graduate شده ولی هیچ حسابی ندارد`); continue }
  const cat = ROLE_CAT[roleName(acc.role)]
  if (cat === 'آژانس') gradOk++
  else {
    gradBadRole++; problems.push(`  ❌ «${sc.agencyName}» (${ph}): حساب دارد ولی نقشش «${roleName(acc.role) || '(بی‌نقش)'}» است نه «آژانس املاک» → در دستهٔ آژانسِ دایرکتوری گم`)
    if (APPLY) {
      const agencyRole = roles.find(r => r.dashboard === '/agency' && r.active) || roles.find(r => r.name === 'آژانس املاک')
      if (agencyRole) { adminUpdate(acc.phone, { role: agencyRole.id }); console.log(`  🔧 ترمیم شد: ${acc.phone} → نقشِ «آژانس املاک»`) }
      else console.log('  ⚠️ نقشِ «آژانس املاک» در role-store نیست — ترمیم ناممکن')
    }
  }
}
console.log(`\n═══ آژانس‌های رُستر: ${scrapes.length} کل ═══`)
console.log(`  graduate‌شده (شمارهٔ حساب دارند): ${gradAgencies}`)
console.log(`  ✅ حساب + نقشِ درست (در دایرکتوری): ${gradOk}`)
console.log(`  ❌ حساب دارد ولی نقشِ غلط (گم): ${gradBadRole}`)
console.log(`  ❌ graduate ولی بی‌حساب: ${gradNoAcct}`)
console.log(`  (آژانس‌های بدونِ شماره — graduateنشده — اصلاً نمی‌توانند حساب بگیرند: ${scrapes.length - gradAgencies})`)
if (problems.length) { console.log('\n── مواردِ باگ‌دار ──'); problems.slice(0, 40).forEach(x => console.log(x)) }

console.log('\n── خلاصه ──')
console.log(`دایرکتوری «آژانس» باید ${shown} ردیف نشان دهد (= حساب‌های نقشِ آژانس با نام).`)
console.log(`اگر این عدد از تعدادِ آژانس‌هایی که برایشان حساب ساختی کمتر است، علت در مواردِ باگ‌دارِ بالاست.`)
