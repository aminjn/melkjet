// ─────────────────────────────────────────────────────────────────────────────
// Economy QA (فاز ۳۴ — سند ۲۳ فصل ۱۳ Part 09): ممیزیِ خودکارِ اقتصادِ «امپراتوری»
// پیش از هر انتشار — روی knobهای «زندهٔ» همین سرور (نه پیش‌فرض‌ها)، چون ادمین
// می‌تواند هر عددی را عوض کرده باشد. سؤال‌های سند:
//   آیا راهی برای تولیدِ پولِ نامحدود ایجاد شده؟ سودی غیرمنطقی شده؟
//   مأموریتی بیش از حد پاداش می‌دهد؟ تغییرات تعادل را به هم زده‌اند؟
// اجرا:  node --import ./scripts/reos-loader.mjs scripts/economy-qa.mjs
// خروجی: ✗ = نقضِ تعادل (exit 1) · ⚠ = مشکوک، چشمی چک شود · ✓ = سالم
// deploy.sh این را بعد از build اجرا می‌کند (هشدار — دیپلوی را متوقف نمی‌کند).
// ─────────────────────────────────────────────────────────────────────────────
import { primeConfig, config } from '../app/lib/reos/reos-config.ts'
import { negotiationOutcome, designPlanOf, assemblyUnitPriceOf, chestRewardOf, offerOf, activeCoinPacks, rateHit, dayNumberOf } from '../app/lib/empire-store.ts'

await primeConfig()
const E = config().empire
let crit = 0, warn = 0, okN = 0
const bad = (m) => { crit++; console.log(`  ✗ ${m}`) }
const sus = (m) => { warn++; console.log(`  ⚠ ${m}`) }
const ok = (m) => { okN++; console.log(`  ✓ ${m}`) }
const chk = (cond, okMsg, badMsg, level = 'crit') => cond ? ok(okMsg) : (level === 'crit' ? bad(badMsg) : sus(badMsg))

console.log('🏛 Economy QA — ممیزیِ knobهای زندهٔ اقتصادِ مسیرِ رشد\n')

// ── ۱) پول باید از چرخه خارج شود (بقای پول — قانون ۶) ──
console.log('💰 خروجِ پول از چرخه')
chk(E.transferTaxPct > 0, `مالیاتِ انتقال ${E.transferTaxPct}٪ → خزانه`, 'مالیاتِ انتقال صفر است — خرید/فروشِ مکرر بدونِ اصطکاک = پمپِ ارزش')
chk(E.assembly.demolishCostPct > 0, `هزینهٔ تخریب ${E.assembly.demolishCostPct}٪`, 'تخریبِ مجانی — تبدیلِ بی‌هزینهٔ ساختمان به زمین', 'warn')
chk(E.assembly.extraUnitPremiumPct >= 0, `پرمیومِ تجمیع ${E.assembly.extraUnitPremiumPct}٪`, 'پرمیومِ تجمیع منفی است — خریدِ واحدِ بعدی ارزان‌تر از بازار!')
chk((E.pros?.appraisalFee || 0) > 0 && (E.pros?.notaryFeePct || 0) > 0, 'کارمزدِ نقش‌های حرفه‌ای برقرار', 'کارمزدِ کارشناس/دفترخانه صفر شده', 'warn')

// ── ۲) سرعت/زمان فقط «خریدنی» باشد، نه مجانی (سند ۲۲: پرداخت برای سرعت) ──
console.log('\n⚡ زمان‌خری')
chk(E.speed.permitCoinsPerDay > 0, `پیگیریِ پروانه ${E.speed.permitCoinsPerDay} کوین/روز`, 'پیگیریِ پروانه رایگان شده — زمان بدونِ هزینه می‌پرد')
chk(E.speed.buildCoinsPerDay > 0, `شیفتِ شبانه ${E.speed.buildCoinsPerDay} کوین/روز`, 'شیفتِ شبانه رایگان شده')

// ── ۳) مذاکره در محدودهٔ منطقی (تخفیفِ نامحدود = پولِ مجانی) ──
console.log('\n🤝 مذاکره')
chk(E.nego.discountMax <= 30, `سقفِ تخفیف ${E.nego.discountMax}٪`, `سقفِ تخفیفِ مذاکره ${E.nego.discountMax}٪ است — بالای ۳۰٪ یعنی خریدِ زیرِ قیمتِ سیستماتیک`, 'warn')
chk(E.nego.discountMin <= E.nego.discountMax, 'بازهٔ تخفیف معتبر', 'کفِ تخفیف از سقف بزرگ‌تر است')
{
  const out = [...Array(30)].map((_, i) => negotiationOutcome('qa' + i, 'L', 50, E.nego)).filter(o => o.success)
  chk(out.every(o => o.discountPct >= E.nego.discountMin && o.discountPct <= E.nego.discountMax),
    'تخفیفِ واقعی داخلِ بازهٔ knob (۳۰ نمونهٔ قطعی)', 'تخفیفِ محاسبه‌شده از بازهٔ تنظیم‌شده بیرون می‌زند')
}

// ── ۴) پاداش‌ها در تعادل (مأموریتِ بیش‌ازحد سخاوتمند؟) ──
console.log('\n🎁 پاداش‌ها')
chk((E.levelUpCoins || 0) <= 200, `پاداشِ سطح ${E.levelUpCoins} کوین`, `پاداشِ هر سطح ${E.levelUpCoins} کوین است — بالای ۲۰۰ چاپِ کوین است`, 'warn')
chk((E.chest?.maxCoins || 0) <= 500, `سقفِ صندوقچه ${E.chest?.maxCoins} کوین`, `سقفِ صندوقچهٔ روزانه ${E.chest?.maxCoins} — بالای ۵۰۰ تورمِ کوین`, 'warn')
{
  const r = chestRewardOf('qa-user', 12345, E.chest)
  chk(r.amount <= Math.max(E.chest?.maxCoins || 0, 100), 'جایزهٔ واقعیِ صندوقچه زیرِ سقف', 'جایزهٔ صندوقچه از سقفِ knob بیشتر درمی‌آید')
}
chk((E.quests?.weeklyCoins || 0) <= 500, `کوئستِ هفتگی ${E.quests?.weeklyCoins} کوین`, 'پاداشِ هفتگی خارج از تعادل', 'warn')

// ── ۵) فروشگاهِ کوین (پولِ واقعی): قیمت‌گذاریِ سازگار ──
console.log('\n🪙 فروشگاهِ ملک‌کوین')
{
  const packs = activeCoinPacks(E.coinShop?.packs || [])
  if (!E.coinShop?.enabled || packs.length === 0) sus('فروشگاهِ کوین خاموش یا بدونِ بستهٔ فعال است')
  else {
    chk(packs.every(p => p.coins > 0 && p.priceToman > 0), `${packs.length} بستهٔ فعال، همه با کوین و قیمتِ مثبت`, 'بسته‌ای با کوین/قیمتِ صفر فعال است')
    const rates = packs.map(p => p.priceToman / p.coins)
    const spread = Math.max(...rates) / Math.max(1, Math.min(...rates))
    chk(spread <= 4, `نسبتِ گران‌ترین به ارزان‌ترین نرخِ کوین ${spread.toFixed(1)}× (سازگار)`, `نرخِ کوین بینِ بسته‌ها ${spread.toFixed(1)}× فرق دارد — احتمالاً اشتباهِ قیمت‌گذاری`, 'warn')
  }
}

// ── ۶) ساخت‌وساز و شهرداری ──
console.log('\n🏗 ساخت و ماده۱۰۰')
chk(E.build.costPerM > 0, `هزینهٔ ساخت ${E.build.costPerM.toLocaleString('fa-IR')}/متر`, 'هزینهٔ ساخت صفر است — ساختِ مجانی = پولِ نامحدود')
chk((E.m100?.finePerM2Mult || 0) >= 1, `جریمهٔ ماده۱۰۰ ×${E.m100?.finePerM2Mult} هزینهٔ ساخت`, `جریمهٔ تخلف ×${E.m100?.finePerM2Mult} است — زیرِ ×۱ یعنی تخلف از ساختِ قانونی ارزان‌تر است`)
chk((E.design?.architectFeePct || 0) > 0, `حق‌الزحمهٔ معمار ${E.design?.architectFeePct}٪`, 'طراحیِ معمار مجانی شده', 'warn')
{
  const d = designPlanOf(200, 3, 2, { ...E.design, buildFactor: E.build.buildFactor })
  chk(d.ok && d.legalFloors >= 1, 'نمونهٔ طراحیِ ۲۰۰متری معتبر است', 'designPlanOf روی زمینِ نمونه جواب نمی‌دهد')
}
chk(assemblyUnitPriceOf(1000, E.assembly.extraUnitPremiumPct) >= 1000, 'قیمتِ واحدِ تجمیع ≥ قیمتِ بازار', 'واحدِ تجمیع زیرِ قیمتِ بازار درمی‌آید')

// ── ۷) بازسازی: ارزش‌افزوده نباید چاپِ پول باشد ──
console.log('\n🛠 بازسازی')
for (const [k, v] of Object.entries(E.renovation?.options || {})) {
  chk(v.costPct > 0, `«${k}»: هزینه ${v.costPct}٪`, `بازسازیِ «${k}» مجانی است`)
  chk(v.valuePct <= v.costPct * 3, `«${k}»: ارزش ${v.valuePct}٪ ≤ ۳×هزینه`, `«${k}»: ارزش‌افزوده ${v.valuePct}٪ در برابرِ هزینهٔ ${v.costPct}٪ — سودِ غیرمنطقی`, 'warn')
}
chk((E.renovation?.maxBoostPct || 0) <= 50, `سقفِ ارزش‌افزودهٔ کل ${E.renovation?.maxBoostPct}٪`, 'سقفِ بازسازی بالای ۵۰٪ — تورمِ مصنوعیِ ارزش', 'warn')

// ── ۸) ظاهر هرگز اقتصادی نشود (سند ۲۲) + سپرِ API (سند ۲۳) ──
console.log('\n🎨 ظاهر و سپرِ API')
chk((E.cosmetics?.items || []).every(i => i.priceCoins > 0 || !i.enabled), 'همهٔ آیتم‌های ظاهریِ فعال قیمت دارند', 'آیتمِ ظاهریِ مجانیِ فعال هست', 'warn')
{
  const day = dayNumberOf(Date.now())
  const o = offerOf({ createdAt: Date.now() - 30 * 864e5, claims: {}, coins: 0, xp: 0, stats: {}, cosmetics: undefined, offerHist: undefined }, day, E.offers, (E.cosmetics?.items || []).filter(i => i.enabled), activeCoinPacks(E.coinShop?.packs || []))
  chk(o === null || !Array.isArray(o), 'حداکثر یک پیشنهاد در روز', 'موتورِ پیشنهاد بیش از یکی برمی‌گرداند')
}
{
  const lim = E.api?.rateLimitPerMin ?? 0
  if (lim <= 0) sus('سپرِ نرخِ درخواست خاموش است (empire.api.rateLimitPerMin=0)')
  else {
    let r = { state: undefined, limited: false }
    for (let i = 0; i <= lim; i++) r = rateHit(r.state, 100, lim)   // lim+1 درخواست در یک دقیقه
    const fresh = rateHit(r.state, 101, lim)                        // دقیقهٔ بعد → پنجرهٔ تازه
    chk(r.limited && !fresh.limited, `سقفِ ${lim}/دقیقه: درخواستِ مازاد بسته و دقیقهٔ بعد باز می‌شود`, 'رفتارِ سپرِ نرخِ درخواست غلط است')
  }
}

// ── جمع‌بندی ──
console.log(`\n${crit ? '❌' : warn ? '⚠️' : '✅'} Economy QA: ${okN} سالم · ${warn} هشدار · ${crit} نقضِ تعادل`)
if (crit) console.log('   نقض‌ها را قبل از انتشار در ادمین → امپراتوری اصلاح کن.')
process.exit(crit ? 1 : 0)
