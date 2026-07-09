// REOS · Config Center — تنظیماتِ قابل‌ویرایشِ سوپرادمین برای همهٔ موتورها.
// پیش‌فرض‌ها = ثابت‌های فعلیِ کد؛ سوپرادمین می‌تواند override کند. کشِ همگام تا مسیرهای داغ بخوانند.
import { pgEnabled, pgTx } from '../db'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

export interface ReosConfig {
  gateway: { cacheTtlMin: number; rates: Record<string, number> }
  rl: { lr: number; epsilon: number; rewards: { click: number; save: number; contact: number; visit: number; contract: number } }
  promotion: { boost: number; featured: number; vip: number; trustGate: boolean }
  trust: { weights: { verified: number; profile: number; response: number; deals: number; rating: number; tenure: number } }
  training: { autoHours: number; enabled: boolean; useLearnedLead: boolean }
  feed: { rankWeights: { userMatch: number; quality: number; engagement: number; freshness: number; demand: number; promotion: number } }
  scoring: { budget: number; location: number; behavior: number; intent: number; historical: number; demand: number }
  hybrid: { ml: number; vector: number; rule: number; behavioral: number; boost: number }
  twin: { saleWindowDays: number; overpricePct: number; underpricePct: number }
  territory: { weights: { transactions: number; listingQuality: number; leadConversion: number; satisfaction: number; content: number; activity: number; aiTrust: number }; battleDays: number; fraudThreshold: number; feedAuthority: number; contestGap: number }
  xp: { actions: Record<string, number>; levelBase: number; levelExp: number }
  economy: { commissionPct: number; affiliatePct: number; loyaltyBonusPct: number; missionRewardXp: number; missionRewardCredit: number }
  community: { weights: { followers: number; dominance: number; trust: number; level: number }; commentMaxLen: number }
  automl: { enabled: boolean; promoteMargin: number; minSamples: number }
  suspension: { enabled: boolean; fraudPct: number; autoSuspend: boolean }
  empire: {
    giftToman: number; welcomeCoins: number; welcomeXp: number; welcomeAiTokens: number
    buyRewardXp: number; missionRewardXp: number; missionRewardCoins: number
    guessTolerancePct: number; guessRewardXp: number; guessRewardCoins: number
    levelCurve: { base: number; exp: number }
    mentorInitiates: boolean
    dailyBrief: boolean
    sellProfitXp: number
    land: { buildGainPct: number; partnerGainPct: number; buildMonths: number }
    rentIncome: boolean
    maintenancePctYear: number
    chest: { enabled: boolean; maxCoins: number; maxXp: number }
    bank: { enabled: boolean; maxLoanPctOfNetWorth: number; baseRatePctYear: number; termDays: number; repayXp: number }
    transferTaxPct: number
    quests: { dailyXp: number; dailyCoins: number; weeklyXp: number; weeklyCoins: number }
    referralCoins: number
    capital: {
      enabled: boolean; fundFeePctYear: number; fundMinSamples: number; investRewardXp: number; dividends: boolean
      crowd: { enabled: boolean; unitToman: number; minPrice: number; maxPools: number }
    }
    company: {
      enabled: boolean; regFee: number; engineerSalaryBase: number; maxEngineers: number
      permit: { baseDays: number; extraDaysMax: number; feePct: number; objectionPct: number; engineerSpeedupDays: number }
    }
    build: {
      enabled: boolean; buildFactor: number; unitArea: number; costPerM: number; buildDays: number
      presaleMinPct: number; presaleMaxPct: number; presaleDiscountPct: number
      // GDD فصل ۴ (گیم‌پلی تصمیم‌محور): هدفِ پروژه، امکاناتِ میان‌ساخت، اشباعِ فروشِ عمده، اثرِ تیمِ ماهر.
      goalFastPricePct: number; goalFastPresaleBonusPp: number; goalRepPricePct: number; repProjectScore: number
      bulkFreeUnits: number; bulkStepPct: number; eventSkillCutPct: number
      amenities: Record<string, { costPct: number; valuePct: number }>
    }
    // GDD فصل ۴ بخش ۱۰ + پیوتِ «مدل B»: فرصت‌های محدودِ روزانه (Hook) از آگهی‌های واقعی با شمارشِ معکوسِ واقعی.
    deals: { enabled: boolean; count: number }
    // فاز ۲۵ (تجمیع و تخریب): خریدِ واحدبه‌واحدِ ساختمانِ واقعی → تخریب فقط با مالکیتِ کامل → زمینِ قابلِ‌ساخت.
    // total واحدها اول از متای واقعیِ آگهی («طبقه: X از Y»)، وگرنه قطعی از هش بینِ unitsMin..unitsMax.
    assembly: { enabled: boolean; unitsMin: number; unitsMax: number; extraUnitPremiumPct: number; demolishCostPct: number }
    // فاز ۲۷ (قانون ۵: «پرداخت فقط برای سرعت/تحلیل/ظاهر»): ملک‌کوین زمانِ انتظار را می‌خرد — نه قدرت را.
    speed: { enabled: boolean; permitCoinsPerDay: number; buildCoinsPerDay: number }
    // فاز ۲۸: فروشگاهِ ملک‌کوین (زرین‌پال) — تنها نقطهٔ ورودِ پولِ واقعی؛ کوین هرگز قدرت نمی‌خرد (بدونِ P2W).
    // فاز ۳۳ (سند ۲۲ فصل ۷ Bundles): until = تاریخِ پایانِ بستهٔ زمان‌دار (YYYY-MM-DD؛ خالی = دائمی) — تایمرِ واقعی، نه نمایشی.
    coinShop: { enabled: boolean; packs: Array<{ id: string; label: string; coins: number; priceToman: number; enabled: boolean; until?: string }> }
    // فاز ۳۳ (سند ۲۲ فصل ۳ Cosmetic Store): آیتم‌های صرفاً ظاهری با ملک‌کوین — «هیچ آیتمِ ظاهری روی اقتصاد/سرعت/قدرت اثر نمی‌گذارد».
    cosmetics: { enabled: boolean; items: Array<{ id: string; label: string; icon: string; kind: 'frame' | 'flair'; priceCoins: number; enabled: boolean }> }
    // فاز ۳۳ (سند ۲۲ فصل ۹ Special Offers): موتورِ پیشنهادِ قطعی از رفتارِ واقعی — حداکثر ۱ در روز، قابلِ‌بستن، بدونِ تایمرِ ساختگی.
    offers: { enabled: boolean; cooldownDays: number; minAgeDays: number }
    // فاز ۲۹: نقش‌های حرفه‌ایِ سایت در سناریو — تا آمدنِ متخصصانِ واقعی، «سیستم» بازی‌شان می‌کند؛ کارمزدها مصرفِ شفافِ پول (servicesPaid).
    pros: {
      notaryFeePct: number              // دفترخانه: حق‌الثبتِ سند در خرید (٪ قیمت)
      advisorRentCommissionPct: number  // مشاورِ املاک: کمیسیونِ اجاره (٪ از یک ماه اجاره — عرفِ واقعی ۲۵٪)
      advisorSellCommissionPct: number  // مشاورِ املاک: کمیسیونِ فروش (٪ قیمتِ فروش)
      lawyerFeePct: number              // وکیل: حق‌الوکالهٔ دفاعِ ماده۱۰۰ (٪ جریمهٔ اولیه)
      lawyerCutPct: number              // اگر دفاع موفق شد: ٪ کاهشِ جریمه
      lawyerWinChancePct: number        // شانسِ موفقیتِ دفاع (قطعی از هش)
      appraisalFee: number              // کارشناسِ رسمی: هزینهٔ ارزیابیِ وام (تومان)
    }
    // فاز ۲۹: طراحیِ معمار پیش از پروانه — طبقات/واحد در طبقه با تراکمِ قانونی؛ طبقهٔ مازاد = تخلف (ماده۱۰۰).
    design: {
      enabled: boolean
      occupancyPct: number   // سطحِ اشغالِ زمین (٪) — footprint = زمین × این
      maxOverFloors: number  // حداکثر طبقهٔ مازادِ قابلِ‌ساخت (تخلفِ عمدی)
      designDays: number     // مدتِ طراحیِ معمار (قابلِ‌تسریع با کوین)
      architectFeePct: number // حق‌الزحمهٔ معمار (٪ برآوردِ هزینهٔ ساخت)
      minUnitArea: number    // حداقل متراژِ قانونیِ هر واحد
    }
    // فاز ۲۹: کمیسیونِ ماده۱۰۰ شهرداری — جریمهٔ هر مترِ مازاد = costPerM × این ضریب → خزانه.
    m100: { finePerM2Mult: number }
    // فاز ۲۹: بازسازیِ واقعی — هزینهٔ الان (٪ ارزش)، ارزش‌افزودهٔ شفاف (٪)، با سقف.
    renovation: { enabled: boolean; maxBoostPct: number; options: Record<string, { costPct: number; valuePct: number }> }
    // فاز ۳۲ (سند ۲۱ — فصل ۱۱ Audio): بازخوردِ صوتیِ سنتزشده؛ کاربر هم کنترلِ خاموش/حجمِ خودش را دارد.
    sound: { enabled: boolean }
    // فاز ۲۷: شانس و بازهٔ تخفیفِ مذاکره — قبلاً هاردکد بود (۲۵٪ پایه، ۲..۶٪) و کاربر می‌دید؛ حالا knob.
    nego: { baseChancePct: number; discountMin: number; discountMax: number }
    // GDD فصل ۴ بخش ۱۵: اعتبارِ ⭐ باید اثرِ واقعی داشته باشد — روی مذاکره و شرایطِ بانک.
    reputation: { negoBonusPerStar: number; loanRateCutPctPerStar: number }
    // سند ۱۶ (فصل ۶ بخش ۱): پاداشِ رسیدن به هر سطحِ جدید (ملک‌کوین) — Level Up باید حس شود.
    levelUpCoins: number
    // سند ۱۸ (فصل ۸ LiveOps): رویدادهای زندهٔ ادمین — بدونِ دیپلوی از پنل ساخته/زمان‌بندی می‌شوند؛
    // پیشرفت فقط از رفتارِ واقعیِ REOS (بازدید/ذخیره/جستجو/محله‌ها) در بازهٔ رویداد.
    events: Array<{ id: string; title: string; desc: string; icon: string; metric: 'views' | 'saves' | 'searches' | 'hoods'; target: number; rewardXp: number; rewardCoins: number; startAt: number; endAt: number; enabled: boolean }>
    // سند ۱۸ (فصل ۸ بخش ۱): پاداشِ نقاطِ عطفِ ورودِ پیاپی (استریکِ واقعی) — روزهای ۷/۱۴/۲۱/۳۰.
    streakBonus: { d7: number; d14: number; d21: number; d30: number }
    // GDD فصل ۴ بخش ۱۹ (Progression): «اعداد نباید بزرگ‌تر شوند؛ امکانات باید بیشتر شوند» — قابلیت‌ها سطح‌گشا هستند
    // + فصل ۵ (منابع): ظرفیتِ پروژهٔ همزمانِ شرکت با سطح رشد می‌کند؛ خروج از پروژهٔ نیمه‌کاره با ٪ شفاف.
    unlocks: { capitalLevel: number; companyLevel: number; crowdLevel: number; projectsBase: number; projectsPerLevels: number; projectExitPct: number }
  }
}

export const DEFAULT_CONFIG: ReosConfig = {
  gateway: { cacheTtlMin: 10, rates: { 'gpt-4o': 3000, 'gpt-4o-mini': 300, default: 800 } },
  rl: { lr: 0.05, epsilon: 0.1, rewards: { click: 1, save: 5, contact: 20, visit: 40, contract: 100 } },
  promotion: { boost: 0.5, featured: 0.75, vip: 1, trustGate: true },
  trust: { weights: { verified: 0.28, profile: 0.16, response: 0.16, deals: 0.16, rating: 0.16, tenure: 0.08 } },
  training: { autoHours: 6, enabled: true, useLearnedLead: true },
  feed: { rankWeights: { userMatch: 0.35, quality: 0.20, engagement: 0.15, freshness: 0.10, demand: 0.10, promotion: 0.10 } },
  scoring: { budget: 0.35, location: 0.25, behavior: 0.15, intent: 0.10, historical: 0.10, demand: 0.05 },
  hybrid: { ml: 0.30, vector: 0.25, rule: 0.20, behavioral: 0.15, boost: 0.10 },
  twin: { saleWindowDays: 45, overpricePct: 12, underpricePct: 8 },
  territory: { weights: { transactions: 0.30, listingQuality: 0.15, leadConversion: 0.20, satisfaction: 0.10, content: 0.10, activity: 0.10, aiTrust: 0.05 }, battleDays: 7, fraudThreshold: 0.5, feedAuthority: 0.08, contestGap: 8 },
  xp: { actions: { list_property: 10, close_deal: 200, respond_lead: 5, get_review: 30, publish_content: 20, win_battle: 100, verify: 40, refer_convert: 60 }, levelBase: 100, levelExp: 1.6 },
  economy: { commissionPct: 0.02, affiliatePct: 0.2, loyaltyBonusPct: 0.005, missionRewardXp: 50, missionRewardCredit: 20000 },
  community: { weights: { followers: 0.30, dominance: 0.30, trust: 0.25, level: 0.15 }, commentMaxLen: 800 },
  automl: { enabled: true, promoteMargin: 0.02, minSamples: 100 },
  // قوانینِ تعلیق: تقلب ≥ fraudPct٪ → پرچمِ بازبینی؛ اگر autoSuspend روشن باشد → تعلیقِ خودکار (ورود مسدود).
  suspension: { enabled: true, fraudPct: 70, autoSuspend: false },
  // امپراتوری (سندِ Empire، جلد۲ فصل ۱–۶): چهار نوع ارزش — XP (غیرقابل‌خرید)، Melk Coin (ارزِ داخلی)،
  // Real Asset (به تومان، دارایی = آگهیِ واقعی)، Reputation (از trustِ REOS). بستهٔ خوش‌آمد طبق §6.3.
  empire: {
    giftToman: 10_000_000_000, welcomeCoins: 500, welcomeXp: 100, welcomeAiTokens: 5,
    buyRewardXp: 100, missionRewardXp: 200, missionRewardCoins: 50,
    guessTolerancePct: 15, guessRewardXp: 30, guessRewardCoins: 10,
    // سطح‌بندیِ GDD جلد۳: سطحِ L نیازمندِ base×(L-1)^exp XP تجمعی — مراحل: Rookie→Explorer→…→Empire.
    levelCurve: { base: 100, exp: 1.5 },
    mentorInitiates: true,
    dailyBrief: true,
    // چرخهٔ عمرِ ملک (§6.7-6.8 و فصل ۵): فروش با سود → XP؛ برآوردِ زمین (ساخت/مشارکت) با پارامترهای شفافِ ادمین.
    sellProfitXp: 50,
    land: { buildGainPct: 45, partnerGainPct: 20, buildMonths: 18 },
    // درآمدِ اجاره از میانهٔ اجارهٔ واقعیِ هم‌محله‌ها + هزینهٔ مالکیت (GDD جلد۵: اقتصاد باید در گردش بماند).
    rentIncome: true,
    maintenancePctYear: 1,
    chest: { enabled: true, maxCoins: 100, maxXp: 50 },
    // بانک (GDD جلد ۱۶): سقف و نرخِ وام تابعِ امتیازِ اعتباری؛ نرخِ پایه سالانه است، بهره روزشمار.
    bank: { enabled: true, maxLoanPctOfNetWorth: 50, baseRatePctYear: 18, termDays: 90, repayXp: 40 },
    // مالیاتِ نقل‌وانتقال (جلد ۵/۱۶): روی خرید و فروش؛ واردِ «خزانه» می‌شود — هیچ پولی بی‌هدف نیست.
    transferTaxPct: 1,
    // کوئستِ روزانه/هفتگیِ شخصی (GDD جلد ۲) + دعوتِ شراکتی (§7.4 — هر دو طرف پاداش می‌گیرند).
    quests: { dailyXp: 30, dailyCoins: 15, weeklyXp: 120, weeklyCoins: 60 },
    referralCoins: 200,
    // بازار سرمایه (جلد ۴۰): صندوقِ شاخصی (واحد = یک مترِ مجازی از بازارِ واقعی) + مشارکتِ جمعی روی
    // آگهی‌های واقعیِ گران. کارمزدِ مدیریت → خزانه؛ سودِ دوره‌ای از میانهٔ اجارهٔ واقعی؛ بدونِ نمونهٔ کافی، صندوق عرضه نمی‌شود.
    capital: {
      enabled: true, fundFeePctYear: 2, fundMinSamples: 8, investRewardXp: 20, dividends: true,
      crowd: { enabled: true, unitToman: 500_000_000, minPrice: 20_000_000_000, maxPools: 12 },
    },
    // شرکتِ ساختمانی (جلد ۶۱) + پروانه (جلد ۶۳): هزینهٔ ثبت/عوارض → خزانه؛ حقوقِ مهندس جریانِ واقعیِ پول؛
    // مهلتِ بررسی و اعتراض قطعی از هش (قانون ۷) در بازه‌های قابل‌تنظیمِ ادمین.
    company: {
      enabled: true, regFee: 50_000_000, engineerSalaryBase: 30_000_000, maxEngineers: 5,
      permit: { baseDays: 2, extraDaysMax: 4, feePct: 2, objectionPct: 30, engineerSpeedupDays: 1 },
    },
    // موتورِ ساخت (جلد ۶۴–۷۲): بنا = مساحتِ زمین × تراکم؛ هزینهٔ هر متر knob شفاف؛ پیشرفت = روزهای پرداخت‌شده
    // (بی‌پولی = توقف — جلد ۷۱)؛ قیمتِ واحدها همیشه از میانهٔ متریِ واقعیِ محله (پیش‌فروش با تخفیفِ شفاف).
    build: {
      enabled: true, buildFactor: 2.2, unitArea: 100, costPerM: 25_000_000, buildDays: 21,
      presaleMinPct: 30, presaleMaxPct: 50, presaleDiscountPct: 12,
      // GDD فصل ۴: هدفِ «فروشِ سریع» = قیمتِ ۹۶٪ میانهٔ واقعی + سقفِ پیش‌فروشِ بیشتر؛ «اعتبار» = ۹۷٪ + امتیازِ برند؛
      // فروشِ عمده (بیش از bulkFreeUnits در یک سفارش) هر واحدِ اضافه bulkStepPct٪ ارزان‌تر (اشباعِ عرضهٔ خودِ بازیکن)؛
      // تیمِ ماهر (مهارت ≥۵۰) هزینهٔ رویدادِ کارگاه را eventSkillCutPct٪ کم می‌کند — همان اثرِ روی کارتِ استخدام.
      goalFastPricePct: 96, goalFastPresaleBonusPp: 15, goalRepPricePct: 97, repProjectScore: 10,
      bulkFreeUnits: 3, bulkStepPct: 2, eventSkillCutPct: 20,
      amenities: {
        pool: { costPct: 6, valuePct: 8 },
        roof: { costPct: 3, valuePct: 4 },
        gym: { costPct: 4, valuePct: 5 },
        parking: { costPct: 5, valuePct: 6 },
      },
    },
    // سطح‌گشایی (سند ۱۵ / GDD فصل ۴ بخش ۱۹): بازارِ سرمایه از سطح ۳، شرکتِ ساختمانی از سطح ۴، مشارکتِ جمعی از سطح ۶؛
    // ظرفیتِ پروژهٔ همزمان = ۱ + سطح ÷ ۱۰؛ خروج از پروژهٔ نیمه‌کاره به ۸۵٪ بهای تمام‌شده (منهای مالیات → خزانه).
    unlocks: { capitalLevel: 3, companyLevel: 4, crowdLevel: 6, projectsBase: 1, projectsPerLevels: 10, projectExitPct: 85 },
    // Hook روزانه (سند ۱۴): N آگهیِ واقعیِ قطعی از هشِ کاربر+روز؛ بعضی واقعاً زیرِ میانهٔ محله‌اند، بعضی نه —
    // بازی قضاوت نمی‌کند؛ بازیکن فکر می‌کند یا ژتونِ تحلیل خرج می‌کند («اگر پاسخ واضح باشد، سیستم شکست خورده»).
    deals: { enabled: true, count: 5 },
    // تجمیع و تخریب (فاز ۲۵): هر واحدِ اضافه با ٪ گران‌تر (مالک‌ها می‌فهمند دنبالِ تجمیعی)؛ تخریب = ٪ ارزشِ ساختمان.
    assembly: { enabled: true, unitsMin: 3, unitsMax: 8, extraUnitPremiumPct: 10, demolishCostPct: 5 },
    // زمان‌خری (فاز ۲۷): پیگیریِ پروانه ۱۵ کوین/روز · شیفتِ شبانهٔ کارگاه ۱۰ کوین/روز (+ هزینهٔ تومانیِ خودِ روز).
    speed: { enabled: true, permitCoinsPerDay: 15, buildCoinsPerDay: 10 },
    // فروشگاهِ کوین: بسته‌ها کاملاً از ادمین؛ درگاه = زرین‌پالِ «اتصال‌ها». کوین فقط سرعت/تحلیل/ظاهر می‌خرد.
    coinShop: {
      enabled: true,
      packs: [
        { id: 'brz', label: 'بستهٔ برنزی', coins: 100, priceToman: 100_000, enabled: true },
        { id: 'slv', label: 'بستهٔ نقره‌ای', coins: 300, priceToman: 250_000, enabled: true },
        { id: 'gld', label: 'بستهٔ طلایی', coins: 800, priceToman: 500_000, enabled: true },
      ],
    },
    // فروشگاهِ ظاهری (سند ۲۲ فصل ۳): قاب/نشان فقط برای نمایش — دیگران در لیدربورد و پروفایل می‌بینند؛ صفر اثرِ اقتصادی.
    cosmetics: {
      enabled: true,
      items: [
        { id: 'frame_gold', label: 'قابِ طلایی', icon: '🥇', kind: 'frame' as const, priceCoins: 200, enabled: true },
        { id: 'frame_emerald', label: 'قابِ زمردی', icon: '🟢', kind: 'frame' as const, priceCoins: 300, enabled: true },
        { id: 'frame_ruby', label: 'قابِ یاقوتی', icon: '🔴', kind: 'frame' as const, priceCoins: 300, enabled: true },
        { id: 'frame_diamond', label: 'قابِ الماس', icon: '💎', kind: 'frame' as const, priceCoins: 800, enabled: true },
        { id: 'flair_crane', label: 'نشانِ برج‌ساز', icon: '🏗', kind: 'flair' as const, priceCoins: 400, enabled: true },
        { id: 'flair_falcon', label: 'نشانِ شاهینِ مذاکره', icon: '🦅', kind: 'flair' as const, priceCoins: 400, enabled: true },
      ],
    },
    // پیشنهادِ هوشمند (سند ۲۲ فصل ۹): حداکثر ۱ در روز؛ بستن = cooldownDays روز پنهان؛ فقط از رفتارِ واقعی و قطعی.
    offers: { enabled: true, cooldownDays: 5, minAgeDays: 2 },
    // مذاکره: همان رفتارِ قبلی به‌صورتِ پیش‌فرض (۲۵٪ پایه تا ۷۵٪ با مهارت؛ تخفیف ۲..۶٪) — حالا قابل‌تنظیم.
    nego: { baseChancePct: 25, discountMin: 2, discountMax: 6 },
    // نقش‌های حرفه‌ای (فاز ۲۹): اعدادِ عرفِ واقعیِ بازارِ ایران — همه knob.
    pros: { notaryFeePct: 0.5, advisorRentCommissionPct: 25, advisorSellCommissionPct: 0.5, lawyerFeePct: 10, lawyerCutPct: 40, lawyerWinChancePct: 50, appraisalFee: 2_000_000 },
    design: { enabled: true, occupancyPct: 60, maxOverFloors: 2, designDays: 2, architectFeePct: 3, minUnitArea: 35 },
    m100: { finePerM2Mult: 1.5 },
    renovation: {
      enabled: true, maxBoostPct: 25,
      options: { kitchen: { costPct: 3, valuePct: 5 }, facade: { costPct: 4, valuePct: 6 }, full: { costPct: 10, valuePct: 15 } },
    },
    // صدا (فاز ۳۲): کلیدِ سراسری — کاربر هم در HUD خاموش/حجم دارد (localStorage).
    sound: { enabled: true },
    // اعتبار = دارایی (سند ۱۴): هر ستارهٔ بالای ۱ → مذاکرهٔ راحت‌تر + نرخِ وامِ بهتر — شفاف و قطعی.
    reputation: { negoBonusPerStar: 2, loanRateCutPctPerStar: 3 },
    // پاداشِ سطح (سند ۱۶): هر سطحِ جدید × این مقدار ملک‌کوین — بدونِ پاداشِ گذشته‌نگر برای قدیمی‌ها.
    levelUpCoins: 20,
    // استودیوی رویداد (سند ۱۸): پیش‌فرض خالی — ادمین از کنسولِ LiveOps می‌سازد؛ نیازی به دیپلوی نیست.
    events: [],
    // پاداشِ نقاطِ عطفِ استریک (سند ۱۸ بخش ۱): ملک‌کوین در روزهای ۷/۱۴/۲۱/۳۰ِ ورودِ پیاپیِ واقعی.
    streakBonus: { d7: 30, d14: 60, d21: 100, d30: 200 },
  },
}

const FILE = join(process.cwd(), '.reos-config-settings.json')
let ready = false
async function ensure() { if (ready) return; await pgTx(c => c.query(`CREATE TABLE IF NOT EXISTS reos_config (id text PRIMARY KEY, data jsonb NOT NULL, at bigint NOT NULL)`)); ready = true }

// ادغامِ عمیقِ ساده (یک سطح تودرتو).
function merge(base: ReosConfig, over: Record<string, unknown>): ReosConfig {
  const out = JSON.parse(JSON.stringify(base)) as Record<string, Record<string, unknown>>
  for (const k in over) {
    const v = over[k]
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k]) {
      for (const kk in v as Record<string, unknown>) {
        const vv = (v as Record<string, unknown>)[kk]
        if (vv && typeof vv === 'object' && !Array.isArray(vv) && out[k][kk]) Object.assign(out[k][kk] as object, vv)
        else (out[k] as Record<string, unknown>)[kk] = vv
      }
    } else out[k] = v as Record<string, unknown>
  }
  return out as unknown as ReosConfig
}

async function loadStored(): Promise<Record<string, unknown>> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT data FROM reos_config WHERE id='main'`)); return (r.rows[0]?.data as Record<string, unknown>) || {} }
  if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} }
  return {}
}

// ── کشِ همگام (مسیرهای داغ) ──
let CFG: ReosConfig = DEFAULT_CONFIG
let primedAt = 0
export function config(): ReosConfig { return CFG }              // همگام
export async function primeConfig(): Promise<ReosConfig> {
  if (Date.now() - primedAt < 60_000) return CFG
  try { CFG = merge(DEFAULT_CONFIG, await loadStored()); primedAt = Date.now() } catch { CFG = DEFAULT_CONFIG }
  return CFG
}
export async function getConfig(): Promise<ReosConfig> { return merge(DEFAULT_CONFIG, await loadStored()) }
export async function setConfig(patch: Record<string, unknown>): Promise<ReosConfig> {
  const stored = await loadStored()
  const next = merge(merge(DEFAULT_CONFIG, stored), patch)
  // فقط delta نسبت به پیش‌فرض را ذخیره نمی‌کنیم؛ کلِ merged را ذخیره می‌کنیم (ساده و قابلِ‌بازگردانی).
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`INSERT INTO reos_config(id,data,at) VALUES('main',$1,$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data, at=EXCLUDED.at`, [JSON.stringify(next), Date.now()])) }
  else { try { writeFileSync(FILE, JSON.stringify(next)) } catch {} }
  CFG = next; primedAt = Date.now()
  return next
}
export async function resetConfig(): Promise<ReosConfig> {
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`DELETE FROM reos_config WHERE id='main'`)) }
  else { try { if (existsSync(FILE)) writeFileSync(FILE, '{}') } catch {} }
  CFG = DEFAULT_CONFIG; primedAt = Date.now()
  return DEFAULT_CONFIG
}
