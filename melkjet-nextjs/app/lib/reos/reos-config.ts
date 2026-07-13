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
      // فاز ۱۱۲ (کاربریِ پروژه): ضریبِ هزینهٔ ساختِ هر کاربری نسبت به مسکونی + حداقل نمونهٔ واقعیِ محله برای قیمتِ محلی
      useCost: { commercial: number; office: number; villa: number }
      useMinSamples: number
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
    // فاز ۱۰۷ (سند ۲۲ Creator Store): بازیکنان طرحِ ظاهری می‌سازند؛ تأییدِ انسانیِ ادمین → فروش در فروشگاه؛ سهمِ سازنده به کوینِ او (باقی = چاهِ کوین).
    creator: { enabled: boolean; sharePct: number; minPriceCoins: number; maxPriceCoins: number; maxPendingPerUser: number }
    // فاز ۳۳ (سند ۲۲ فصل ۹ Special Offers): موتورِ پیشنهادِ قطعی از رفتارِ واقعی — حداکثر ۱ در روز، قابلِ‌بستن، بدونِ تایمرِ ساختگی.
    offers: { enabled: boolean; cooldownDays: number; minAgeDays: number }
    // فاز ۳۴ (سند ۲۳ فصل ۱۳ Technical — Part 04): سقفِ درخواستِ هر بازیکن در دقیقه روی API مسیرِ رشد؛ ۰ = خاموش.
    api: { rateLimitPerMin: number }
    // فاز ۳۵ (سند ۲۴ فصل ۱۴ Analytics — Part 06): آستانه‌های هشدارِ سلامتِ اقتصاد روی تاریخچهٔ روزانه.
    metrics: { enabled: boolean; inflationAlertPct: number; dauDropAlertPct: number; concentrationAlertPct: number; capGrowthAlertPct: number }
    // فاز ۳۹ (سند ۲۶ فصل ۱۶ Cognitive AI): هوشِ سرمایه‌گذاری — ارزش‌گذاری/تصمیم‌یار/روندِ محله‌ها/سلامتِ مالی؛ همهٔ آستانه‌ها زنده.
    intel: { enabled: boolean; minComps: number; fairBandPct: number; expensivePct: number; bubblePct: number; trendDays: number; loanSoonDays: number; liqHigh: number; liqMid: number; crisisRunwayDays: number; crisisStalledDays: number }
    // فاز ۴۰ (سند ۲۷ Part 13): مرکزِ خودکارسازی — قوانینِ قابل‌تعریفِ بازیکن (فقط اطلاع/پیشنهاد، هرگز اجرا).
    automation: { enabled: boolean; maxRules: number; logCap: number }
    // فاز ۴۱ (سند ۲۸ فصل ۱۷ Part 07): معاملهٔ بزرگِ هفته — یک ملکِ واقعیِ گران از سگمنتِ بالای بازار، شهری و رقابتی.
    bigDeal: { enabled: boolean; periodDays: number; topPct: number; discountMax: number; baseChancePct: number; level: number }
    weatherEnabled: boolean   // فاز ۱۰۴: هوای واقعیِ شهر در تبِ دنیا (Open-Meteo)
    // فاز ۱۰۹ (Visual Pass 2): لایه‌های بصریِ شهرِ زنده — همه از دادهٔ واقعی (ساعت/هوا/دارایی)؛ هر کدام جدا خاموش‌شدنی
    visual: { dayNight: boolean; weatherFx: boolean; streetLife: boolean; facades: boolean }
    // فاز ۱۰۳ (جلد ۳): Prestige — بازتولدِ داوطلبانه با امتیازِ مهارتِ دائمی (اثرهای کوچکِ شفاف)
    prestige: { enabled: boolean; minLevel: number; pointsPerPrestige: number; maxPerBranch: number; negoPpPerPoint: number; buildCostPctPerPoint: number; marketIncomePctPerPoint: number }
    // فاز ۱۰۰ (جلد ۴۳): شاخصِ قیمتِ مصالح از بازارِ واقعی → ضریبِ هزینهٔ ساخت (با کف/سقف)
    materialsIndex: { enabled: boolean; minItems: number; clampMin: number; clampMax: number }
    // فاز ۴۵ (سند ۲۹ Auction Saga): تالارِ مزایدهٔ هفته — گام/حملهٔ سنگین (٪ لنگر)، سقفِ راند، باندِ برآورد،
    // سقفِ رقبا، سقفِ نفوذِ کسب‌شده (٪)، سوختِ انتقام (٪ به سقفِ بودجهٔ رقیب به‌ازای هر برد)، XP برد/شرکت.
    auction: { enabled: boolean; periodDays: number; level: number; stepPct: number; powerPct: number; maxRounds: number; estBandPct: number; rivalsMax: number; influenceMax: number; revengePct: number; xpWin: number; xpTry: number; nemesisWins: number }
    // فاز ۴۸: جوایزِ پولِ واقعی — نردبانِ مرحله‌ای (آستانهٔ ارزشِ خالص × رشدِ هندسیِ تند؛ جایزهٔ تومانی با رشدِ کند و سقف)
    // + استخرِ پایدار: سقفِ کلِ پرداخت = payoutPct٪ از درآمدِ واقعیِ تأییدشدهٔ درگاه + گاردهای ضدسوءاستفاده.
    rewards: { enabled: boolean; payoutPct: number; baseThresholdToman: number; thresholdGrowth: number; baseRewardToman: number; rewardGrowth: number; maxSteps: number; maxRewardToman: number; minLevel: number; minAccountDays: number; monthlyCapToman: number }
    // فاز ۶۲ (سند ۳۱ — فصل ۲۰ End Game): آستانهٔ لایه‌های نقش (l2..l8، تومانِ ارزشِ خالص) + وزن‌های شاخصِ میراث
    // + حداقلِ ثبتِ هر «شگفتیِ دنیا» + سقفِ رؤیاهای شخصیِ فعال — همه knob، هیچ عددی در کد.
    endgame: { l2: number; l3: number; l4: number; l5: number; l6: number; l7: number; l8: number; legacyBuild: number; legacyJobsPer: number; legacyTaxPer: number; legacyQuality: number; legacySocial: number; legacyBadge: number; wonderMinIncome: number; wonderMinProjects: number; wonderMinAuction: number; wonderMinKudos: number; wonderMinWages: number; wonderMinLegacy: number; dreamsMax: number }
    // فاز ۶۳ (سند ۳۲ — فصل ۲۱ Live World): سالِ دنیا + سقفِ کتابِ تاریخ + شایعاتِ منصفانه + وزن/آستانه‌های دمای دنیا.
    world: { daysPerYear: number; historyCap: number; rumorsPerWeek: number; rumorCredMin: number; rumorCredMax: number; heatWActive: number; heatWEvent: number; heatWAuction: number; heatLow: number; heatHigh: number }
    // فاز ۶۵ (NPC Civilization v1): شرکت‌های سیستمیِ زنده — تعداد، سرمایهٔ شروع، شانسِ حرکتِ روزانه، سقفِ دارایی.
    npc: { enabled: boolean; count: number; startCapital: number; actChancePct: number; maxAssets: number
      // فاز ۱۰۱ (NPC v2): جنگِ شرکتی + تصاحبِ خصمانهٔ شرکت‌های NPC (نه بازیکنانِ واقعی)
      warDays: number; warBuyPoints: number; warXpPerPoint: number; warXpWin: number
      takeoverEnabled: boolean; takeoverLevel: number; takeoverPremiumPct: number }
    // فاز ۶۶ (Season Engine v1): فصلِ فعالِ دنیا — تمِ داستانی + متریکِ واقعی (growth/projects/auctionWins/income)
    // + جایزهٔ کوینِ رتبه‌های ۱..۳ سرِ پایانِ فصل. «هیچ متایی دائمی نیست» — ادمین فصلِ بعد را همین‌جا تعریف می‌کند.
    season: { enabled: boolean; id: string; name: string; icon: string; story: string; startDay: number; lengthDays: number; metric: string; r1: number; r2: number; r3: number }
    // فاز ۱۱۰ (سند ۲۲ Part 04 — CEO Pass): گذرنامهٔ فصل — فقط آیتم‌های ظاهریِ انحصاریِ هر فصل (No P2W)؛ قیمت = پلنِ ادمین با مجوزِ season_pass
    pass: { enabled: boolean; frameIcon: string; frameLabel: string; flairIcon: string; flairLabel: string }
    // فاز ۱۱۱ (فصل‌های ۸/۱۰ — گفت‌وگوی سراسریِ شهر): polling سبک + ماژولِ نظارت؛ ضدِ اسپم همه knob
    chat: { enabled: boolean; maxLen: number; cooldownSec: number; minLevel: number; keep: number }
    // فاز ۷۰ (دولتِ زنده — فصل ۲۱ «دولت هر روز تصمیم می‌گیرد» + Future Engine «اعلامِ پیشاپیش»):
    // مصوبهٔ هفتگیِ قطعی از هش در دامنه‌های محدودِ knob — همیشه یک هفته زودتر اعلام می‌شود (انصاف).
    gov: { enabled: boolean; chancePct: number; maxTaxDelta: number; maxLoanDelta: number }
    // بیمهٔ کارگاه (صفِ GDD): حقِ بیمه ٪ هزینهٔ ساخت → پوششِ ٪ هزینهٔ رویدادهای کارگاه.
    insurance: { enabled: boolean; premiumPct: number; coveragePct: number }
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
      occupancyPct: number   // سطحِ اشغالِ زمین (٪) — footprint = زمین × این (عرفِ طرحِ تفصیلی: ۶۰٪)
      maxOverFloors: number  // حداکثر طبقهٔ مازادِ قابلِ‌ساخت (تخلفِ عمدی)
      designDays: number     // مدتِ طراحیِ معمار (قابلِ‌تسریع با کوین)
      architectFeePct: number // حق‌الزحمهٔ معمار (٪ برآوردِ هزینهٔ ساخت)
      minUnitArea: number    // حداقل متراژِ قانونیِ هر واحد (حدنصابِ تفکیکِ طرحِ تفصیلی)
      // ضابطهٔ واقعیِ طبقاتِ مجاز (فیدبکِ کاربر): پلکانی با متراژِ زمین + تعدیل از عرفِ واقعیِ ساختِ محله.
      tierA: number; tierAFloors: number   // زمینِ کوچک‌تر از tierA متر → tierAFloors طبقه
      tierB: number; tierBFloors: number
      tierC: number; tierCFloors: number
      tierD: number; tierDFloors: number
      bigFloors: number                    // زمینِ ≥ tierD → این تعداد (برج‌سازی با طرحِ ویژه)
      hoodBonusMax: number                 // سقفِ طبقاتِ اضافه به اعتبارِ عرفِ بلندمرتبهٔ محله
      parkingAreaPerUnit: number           // سرانهٔ پارکینگِ هر واحد (متر — با مانور)؛ ۰ = ضابطهٔ پارکینگ خاموش
      parkingLevels: number                // طبقاتِ قابلِ‌پارک (همکف + زیرزمین = ۲)
      // فاز ۱۲۶ (فیدبکِ مستقیم: «برای هر کاربری گزینه‌های متفاوت بیاید»): ضابطهٔ جداگانهٔ هر کاربری.
      comMaxFloors: number                 // تجاری: سقفِ طبقاتِ مغازه/پاساژ (عرف: همکف + یک طبقه)
      comMinShopArea: number               // تجاری: حدنصابِ تفکیکِ هر مغازه (متر)
      comUnitsPerSpot: number              // تجاری: چند مغازه به‌ازای یک پارکینگ (عرفِ ضابطهٔ تجاری)
      offMinUnitArea: number               // اداری: حدنصابِ تفکیکِ هر واحدِ اداری (متر — کوچک‌تر از مسکونی مجاز است)
      villaMaxFloors: number               // ویلایی: سقفِ طبقاتِ ویلا (۱=فلت، ۲=دوبلکس، ۳=تریپلکس)
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
    // فاز ۱۰۵ (Quest Studio کامل): + متریک‌های گیم‌پلی (خرید/تحویلِ پروژه/پروانه — از تایم‌استمپ‌های واقعی) + گیتِ سطح
    events: Array<{ id: string; title: string; desc: string; icon: string; metric: 'views' | 'saves' | 'searches' | 'hoods' | 'buys' | 'projects' | 'permits'; target: number; rewardXp: number; rewardCoins: number; startAt: number; endAt: number; enabled: boolean; minLevel?: number }>
    // سند ۱۸ (فصل ۸ بخش ۱): پاداشِ نقاطِ عطفِ ورودِ پیاپی (استریکِ واقعی) — روزهای ۷/۱۴/۲۱/۳۰.
    streakBonus: { d7: number; d14: number; d21: number; d30: number }
    // GDD فصل ۴ بخش ۱۹ (Progression): «اعداد نباید بزرگ‌تر شوند؛ امکانات باید بیشتر شوند» — قابلیت‌ها سطح‌گشا هستند
    // + فصل ۵ (منابع): ظرفیتِ پروژهٔ همزمانِ شرکت با سطح رشد می‌کند؛ خروج از پروژهٔ نیمه‌کاره با ٪ شفاف.
    unlocks: { capitalLevel: number; companyLevel: number; crowdLevel: number; projectsBase: number; projectsPerLevels: number; projectExitPct: number; tradeLevel: number; clanLevel: number }
    // فاز ۳۷ (درخواستِ مستقیم): مالکیتِ انحصاریِ آگهی + بازارِ بازیکنان + مشارکتِ ساخت + اتحاد — همه سطح‌گشا.
    social: { exclusiveEnabled: boolean; tradeEnabled: boolean; jvEnabled: boolean; jvMaxPct: number; clanEnabled: boolean; clanCreateFee: number; clanMaxMembers: number; p2pAuctionEnabled: boolean; p2pAuctionStepPct: number; p2pAuctionMaxDays: number
      // فاز ۱۰۲: گفتگوی دوستان + دوئلِ هفتگی + خزانه/کنسرسیومِ اتحاد
      dmEnabled: boolean; dmMaxLen: number; dmCooldownSec: number; duelEnabled: boolean; duelXpWin: number; holdingEnabled: boolean; consortiumEnabled: boolean }
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
      useCost: { commercial: 1.35, office: 1.2, villa: 1.15 },   // فاز ۱۱۲ — تأسیسات/اسکلتِ تجاری‌واداری گران‌تر
      useMinSamples: 3,
      amenities: {
        pool: { costPct: 6, valuePct: 8 },
        roof: { costPct: 3, valuePct: 4 },
        gym: { costPct: 4, valuePct: 5 },
        parking: { costPct: 5, valuePct: 6 },
      },
    },
    // سطح‌گشایی (سند ۱۵ / GDD فصل ۴ بخش ۱۹): بازارِ سرمایه از سطح ۳، شرکتِ ساختمانی از سطح ۴، مشارکتِ جمعی از سطح ۶؛
    // ظرفیتِ پروژهٔ همزمان = ۱ + سطح ÷ ۱۰؛ خروج از پروژهٔ نیمه‌کاره به ۸۵٪ بهای تمام‌شده (منهای مالیات → خزانه).
    unlocks: { capitalLevel: 3, companyLevel: 4, crowdLevel: 6, projectsBase: 1, projectsPerLevels: 10, projectExitPct: 85, tradeLevel: 6, clanLevel: 8 },
    // اجتماع (فاز ۳۷): یک آگهیِ واقعی = یک مالک؛ معامله و مشارکتِ ساخت بینِ بازیکنان؛ اتحاد با هزینهٔ ثبتِ → خزانه.
    social: { exclusiveEnabled: true, tradeEnabled: true, jvEnabled: true, jvMaxPct: 49, clanEnabled: true, clanCreateFee: 100_000_000, clanMaxMembers: 20, p2pAuctionEnabled: true, p2pAuctionStepPct: 5, p2pAuctionMaxDays: 7,
      dmEnabled: true, dmMaxLen: 300, dmCooldownSec: 5, duelEnabled: true, duelXpWin: 100, holdingEnabled: true, consortiumEnabled: true },   // فاز ۱۰۲
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
    // فروشگاهِ سازندگان (فاز ۱۰۷ — سند ۲۲ Creator Store): طرحِ بازیکن + تأییدِ انسانی + سهمِ سازنده؛ فقط ظاهر، صفر قدرت.
    creator: { enabled: true, sharePct: 70, minPriceCoins: 20, maxPriceCoins: 500, maxPendingPerUser: 3 },
    // پیشنهادِ هوشمند (سند ۲۲ فصل ۹): حداکثر ۱ در روز؛ بستن = cooldownDays روز پنهان؛ فقط از رفتارِ واقعی و قطعی.
    offers: { enabled: true, cooldownDays: 5, minAgeDays: 2 },
    // سپرِ API (سند ۲۳ Part 04): بازیِ عادی به این سقف نمی‌رسد؛ فقط جلوی اسکریپت/سوءاستفاده را می‌گیرد.
    api: { rateLimitPerMin: 120 },
    // رصدخانهٔ اقتصاد (سند ۲۴ Part 06): هشدار وقتی تورمِ ۷روزه/افتِ DAU/تمرکزِ ثروت/رشدِ نقدینگی از آستانه بگذرد.
    metrics: { enabled: true, inflationAlertPct: 15, dauDropAlertPct: 40, concentrationAlertPct: 70, capGrowthAlertPct: 50 },
    // هوشِ سرمایه‌گذاری (سند ۲۶ فصل ۱۶): حداقلِ نمونهٔ واقعی برای ارزش‌گذاری + باندهای قضاوتِ قیمت + روند/سررسید/عمقِ بازار.
    intel: { enabled: true, minComps: 4, fairBandPct: 8, expensivePct: 20, bubblePct: 35, trendDays: 7, loanSoonDays: 7, liqHigh: 15, liqMid: 6, crisisRunwayDays: 10, crisisStalledDays: 5 },
    // خودکارسازی (سند ۲۷ Part 13): سقفِ قوانینِ هر بازیکن و طولِ دفترِ ثبت — «هیچ اقدامِ مالی خودکار نیست».
    automation: { enabled: true, maxRules: 8, logCap: 30 },
    // معاملهٔ بزرگِ هفته (سند ۲۸ Part 07): از topPct٪ گران‌ترین آگهی‌های واقعی؛ یک تلاش/هفته؛ تخفیف تا سقف.
    bigDeal: { enabled: true, periodDays: 7, topPct: 5, discountMax: 12, baseChancePct: 35, level: 5 },   // periodDays: دورهٔ برگزاری (۷=هفتگی، ۱=روزانه) — فاز ۷۶
    weatherEnabled: true,   // فاز ۱۰۴
    visual: { dayNight: true, weatherFx: true, streetLife: true, facades: true },   // فاز ۱۰۹ (Visual Pass 2)
    prestige: { enabled: true, minLevel: 30, pointsPerPrestige: 3, maxPerBranch: 5, negoPpPerPoint: 2, buildCostPctPerPoint: 2, marketIncomePctPerPoint: 3 },   // فاز ۱۰۳
    materialsIndex: { enabled: true, minItems: 5, clampMin: 0.85, clampMax: 1.2 },   // فاز ۱۰۰: پوششِ حداقلی + کف/سقفِ ضریبِ ساخت
    // تالارِ مزایدهٔ هفته (سند ۲۹ Auction Saga): یک ملکِ واقعی از باندِ میانیِ بازار؛ یک ورود/هفته؛ شروع زیرِ قیمت.
    auction: { enabled: true, periodDays: 7, level: 6, stepPct: 4, powerPct: 12, maxRounds: 10, estBandPct: 18, rivalsMax: 4, influenceMax: 5, revengePct: 6, xpWin: 120, xpTry: 30, nemesisWins: 3 },
    // جوایزِ پولِ واقعی (فاز ۴۸): مرحلهٔ ۱ = ارزشِ خالصِ ۱۰۰ میلیارد → ۳م تومان؛ آستانه ×۴ هر مرحله، جایزه ×۱٫۵
    // (سقف ۲۰م)؛ سقفِ پرداختِ کل = ۴۰٪ درآمدِ واقعی (۵۰۰ خرج شد → حداکثر ۲۰۰ برگردد)؛ تأییدِ نهایی همیشه با ادمین.
    rewards: { enabled: true, payoutPct: 40, baseThresholdToman: 100_000_000_000, thresholdGrowth: 4, baseRewardToman: 3_000_000, rewardGrowth: 1.5, maxSteps: 10, maxRewardToman: 20_000_000, minLevel: 5, minAccountDays: 7, monthlyCapToman: 10_000_000 },
    // End Game (فصل ۲۰): لایه‌ها از ۱۰ میلیارد شروع و تا ۲۰ تریلیون؛ میراث: هر پروژه ۱۲۰ امتیاز، هر ۱۰۰م دستمزد ۱ امتیاز و…
    endgame: { l2: 10_000_000_000, l3: 50_000_000_000, l4: 200_000_000_000, l5: 500_000_000_000, l6: 2_000_000_000_000, l7: 5_000_000_000_000, l8: 20_000_000_000_000, legacyBuild: 120, legacyJobsPer: 100_000_000, legacyTaxPer: 200_000_000, legacyQuality: 2, legacySocial: 15, legacyBadge: 25, wonderMinIncome: 200_000_000, wonderMinProjects: 3, wonderMinAuction: 3, wonderMinKudos: 5, wonderMinWages: 1_000_000_000, wonderMinLegacy: 500, dreamsMax: 6 },
    // دنیای زنده (فصل ۲۱): سالِ دنیا = ۹۰ روزِ واقعی؛ ۲ شایعه/هفته با اعتبارِ ۵۵..۸۵٪؛ دما فقط «پیشنهاد» به ادمین.
    world: { daysPerYear: 90, historyCap: 400, rumorsPerWeek: 2, rumorCredMin: 55, rumorCredMax: 85, heatWActive: 6, heatWEvent: 15, heatWAuction: 10, heatLow: 35, heatHigh: 85 },
    // شرکت‌های زندهٔ شهر: ۶ شرکت، هر کدام روزی حداکثر یک حرکتِ قطعی روی آگهی‌های واقعی — حلقهٔ پولیِ بسته.
    npc: { enabled: true, count: 6, startCapital: 300_000_000_000, actChancePct: 55, maxAssets: 10,
      warDays: 7, warBuyPoints: 10, warXpPerPoint: 50, warXpWin: 150,
      takeoverEnabled: true, takeoverLevel: 12, takeoverPremiumPct: 15 },   // فاز ۱۰۱
    season: { enabled: true, id: 'S1', name: 'فصلِ آغاز', icon: '🌱', story: 'اولین فصلِ این دنیا — هر فصل قهرمانانِ خودش را در تاریخ ثبت می‌کند.', startDay: 0, lengthDays: 90, metric: 'growth', r1: 500, r2: 300, r3: 150 },
    pass: { enabled: true, frameIcon: '👔', frameLabel: 'قابِ CEO', flairIcon: '💼', flairLabel: 'نشانِ مدیرعامل' },   // فاز ۱۱۰ (CEO Pass)
    chat: { enabled: true, maxLen: 240, cooldownSec: 15, minLevel: 3, keep: 200 },   // فاز ۱۱۱ (گفت‌وگوی شهر)
    gov: { enabled: true, chancePct: 60, maxTaxDelta: 0.5, maxLoanDelta: 2 },
    insurance: { enabled: true, premiumPct: 3, coveragePct: 70 },
    // مذاکره: همان رفتارِ قبلی به‌صورتِ پیش‌فرض (۲۵٪ پایه تا ۷۵٪ با مهارت؛ تخفیف ۲..۶٪) — حالا قابل‌تنظیم.
    nego: { baseChancePct: 25, discountMin: 2, discountMax: 6 },
    // نقش‌های حرفه‌ای (فاز ۲۹): اعدادِ عرفِ واقعیِ بازارِ ایران — همه knob.
    pros: { notaryFeePct: 0.5, advisorRentCommissionPct: 25, advisorSellCommissionPct: 0.5, lawyerFeePct: 10, lawyerCutPct: 40, lawyerWinChancePct: 50, appraisalFee: 2_000_000 },
    // ضابطهٔ طبقات = عرفِ رایجِ طرحِ تفصیلی: <۱۵۰م→۲ط، <۲۵۰→۳ط، <۵۰۰→۴ط، <۱۰۰۰→۵ط، بزرگ‌تر→۶ط؛ محلهٔ بلندمرتبه تا +۲.
    design: { enabled: true, occupancyPct: 60, maxOverFloors: 2, designDays: 2, architectFeePct: 3, minUnitArea: 35, tierA: 150, tierAFloors: 2, tierB: 250, tierBFloors: 3, tierC: 500, tierCFloors: 4, tierD: 1000, tierDFloors: 5, bigFloors: 6, hoodBonusMax: 2, parkingAreaPerUnit: 25, parkingLevels: 2, comMaxFloors: 2, comMinShopArea: 15, comUnitsPerSpot: 3, offMinUnitArea: 25, villaMaxFloors: 3 },
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
