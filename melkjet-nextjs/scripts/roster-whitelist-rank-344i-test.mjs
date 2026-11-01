// فاز ۳۴۴ط — «مشاور فعال منطقه مجید شاکری» ولی ماشین «قدیمی» را «امضای صریح» گفت؛ و «این نام است» صفر آگهی شمرد.
// Run: node --import ./scripts/reos-loader.mjs scripts/roster-whitelist-rank-344i-test.mjs
let pass = 0, fail = 0
const ok = (n, c) => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.log('  ✗ ' + n) } }
const R = await import('../app/lib/agency-roster.ts')
const NR = await import('../app/lib/roster-name-rules.ts')
const { normFa } = await import('../app/lib/agency-name-lexicon.ts')
const before = await NR.getNameRules()
try {
  const title = '۷۰۰متر مستغلات خیابان ولیعصر'
  const desc = `❌خـرید/فـروش/رهـن/اجـاره هر متراژ تضمینی❌\n✓قدیمی تا نوساز.\n✓متناسب با بودجه شما.\n✅ مسکن بـزرگ آلفا برنـد ثبت شـده کشوری.\n✅ مشـاور فـعال مـنطقه مجـید شـاکری.\n\n✓خیابان بهشتی عباس آباد\n✓خیابان مفتح`
  await NR.setNameRules({ blacklist: [], whitelist: ['قدیمی', 'مجید شاکری'] })   // ورودیِ اشتباه «اول» فهرست
  const sig = R.extractSignature(normFa(title), normFa(desc), 'مسکن بزرگ آلفا')
  ok(`با «قدیمی» اولِ فهرستِ سفید، امضا «مجید شاکری» برنده است (${sig.join('، ')})`, sig[0] === 'مجید شاکری')
  const hits = R.whitelistHits(normFa(`${title}\n${desc}`))
  ok('هر دو نامِ فهرستِ سفید دیده می‌شوند (برای دکمهٔ حذف در پنل)', hits.includes('قدیمی') && hits.includes('مجید شاکری'))
  await NR.setNameRules({ blacklist: [], whitelist: ['مجید شاکری'] })
  ok('فقط «مجید شاکری» در فهرست ⇒ همان (متنِ کشیده‌دار «مجـید شـاکری»)', R.extractSignature(normFa(title), normFa(desc), 'مسکن بزرگ آلفا')[0] === 'مجید شاکری')
  await NR.setNameRules({ blacklist: [], whitelist: [] })
  ok('بی‌فهرستِ سفید هم «مجید شاکری» (نه «قدیمی»)', R.extractSignature(normFa(title), normFa(desc), 'مسکن بزرگ آلفا')[0] === 'مجید شاکری')
  // دو نامِ واقعی: امضا (پس از نقش) بر نامِ وسطِ متن مقدم است
  await NR.setNameRules({ blacklist: [], whitelist: ['رضایی', 'کاظمی'] })
  const d2 = 'همسایه‌ها: خانوادهٔ رضایی ساکن طبقه اول\nکارشناس فروش کاظمی'
  ok('نامِ در موضعِ امضا بر نامِ وسطِ متن مقدم است', R.extractSignature('آپارتمان', normFa(d2), '')[0] === 'کاظمی')
} finally { await NR.setNameRules(before) }
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
